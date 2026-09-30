import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
} from '@/lib/email';
import { isAdmin } from '@/lib/admin-auth';

const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const PLAN_DURATION: Record<string, number> = {
  '1_month':   30,
  '3_months':  90,
  '6_months':  180,
  '12_months': 365,
};

/**
 * GET /api/admin/quick-action?action=approve|reject&id=123&token=xxx
 *
 * Admin clicks this link from email — gets redirected to admin panel
 * with a success/error message shown.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action    = searchParams.get('action');
  const id        = searchParams.get('id');
  const adminNote = searchParams.get('note') || undefined;

  // ── Auth ──────────────────────────────────────────────────────────────
  if (!isAdmin(req)) {
    return NextResponse.redirect(`${APP_URL}/admin/payments?error=unauthorized`);
  }

  if (!action || !id || !['approve', 'reject'].includes(action)) {
    return NextResponse.redirect(`${APP_URL}/admin/payments?error=invalid`);
  }

  try {
    const payReq = await prisma.paymentRequest.findUnique({
      where:   { id: Number(id) },
      include: { user: true },
    });

    if (!payReq) {
      return NextResponse.redirect(`${APP_URL}/admin/payments?error=notfound`);
    }

    if (payReq.status !== 'pending') {
      return NextResponse.redirect(
        `${APP_URL}/admin/payments?error=already_${payReq.status}&id=${id}`
      );
    }

    const now = new Date();

    if (action === 'approve') {
      const days    = PLAN_DURATION[payReq.plan] ?? 30;
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      // Cancel existing subscriptions
      await prisma.subscription.updateMany({
        where: { userId: payReq.userId, status: 'active' },
        data:  { status: 'cancelled' },
      });

      // Activate new subscription
      await prisma.subscription.create({
        data: {
          userId:    payReq.userId,
          plan:      payReq.plan,
          status:    'active',
          startDate: now,
          endDate,
          isTrial:   false,
          paymentId: `manual_${payReq.id}`,
          amount:    payReq.amount,
          currency:  payReq.currency,
        },
      });

      await prisma.paymentRequest.update({
        where: { id: payReq.id },
        data: {
          status:     'approved',
          reviewedAt: now,
          reviewedBy: 'admin-email-link',
          adminNote:  adminNote || 'Approved via email link.',
        },
      });

      await prisma.activity.create({
        data: {
          userId:       payReq.userId,
          activityType: 'SUBSCRIPTION_ACTIVATED',
          details:      `Plan: ${payReq.plan}, via email-link approval #${payReq.id}`,
        },
      });

      try {
        await sendPaymentApprovedEmail({
          userEmail: payReq.user.email,
          userName:  payReq.user.name,
          plan:      payReq.plan,
          endDate,
        });
      } catch (e) { console.error('Email err:', e); }

      return NextResponse.redirect(
        `${APP_URL}/admin/payments?success=approved&user=${encodeURIComponent(payReq.user.email)}&id=${id}`
      );
    }

    // reject
    const reason = adminNote || 'Payment screenshot could not be verified.';
    await prisma.paymentRequest.update({
      where: { id: payReq.id },
      data: {
        status:     'rejected',
        reviewedAt: now,
        reviewedBy: 'admin-email-link',
        adminNote:  reason,
      },
    });

    await prisma.activity.create({
      data: {
        userId:       payReq.userId,
        activityType: 'PAYMENT_REQUEST_REJECTED',
        details:      `Request #${payReq.id}, via email-link rejection`,
      },
    });

    try {
      await sendPaymentRejectedEmail({
        userEmail: payReq.user.email,
        userName:  payReq.user.name,
        plan:      payReq.plan,
        adminNote: reason,
      });
    } catch (e) { console.error('Email err:', e); }

    return NextResponse.redirect(
      `${APP_URL}/admin/payments?success=rejected&user=${encodeURIComponent(payReq.user.email)}&id=${id}`
    );

  } catch (error: any) {
    console.error('Quick-action error:', error);
    return NextResponse.redirect(`${APP_URL}/admin/payments?error=server`);
  }
}
