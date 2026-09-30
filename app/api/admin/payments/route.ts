import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
} from '@/lib/email';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const PLAN_DURATION: Record<string, number> = {
  '1_month':   30,
  '3_months':  90,
  '6_months':  180,
  '12_months': 365,
};

// ── GET /api/admin/payments?status=pending|all  ───────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get('status') || 'pending';

  const requests = await prisma.paymentRequest.findMany({
    where:   status === 'all' ? {} : { status },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  // Stats summary
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.paymentRequest.count(),
    prisma.paymentRequest.count({ where: { status: 'pending' } }),
    prisma.paymentRequest.count({ where: { status: 'approved' } }),
    prisma.paymentRequest.count({ where: { status: 'rejected' } }),
  ]);

  return NextResponse.json({
    success: true,
    stats: { total, pending, approved, rejected },
    requests,
  });
}

// ── POST /api/admin/payments  body: { action, requestId, adminNote? } ─────────
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body      = await req.json();
    const { action, requestId, adminNote } = body as {
      action:    'approve' | 'reject';
      requestId: number;
      adminNote?: string;
    };

    if (!action || !requestId) {
      return NextResponse.json({ success: false, error: 'action and requestId required' }, { status: 400 });
    }

    // Fetch the request
    const payReq = await prisma.paymentRequest.findUnique({
      where:   { id: Number(requestId) },
      include: { user: true },
    });

    if (!payReq) {
      return NextResponse.json({ success: false, error: 'Payment request not found' }, { status: 404 });
    }

    if (payReq.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Request already ${payReq.status}` },
        { status: 409 }
      );
    }

    const now = new Date();

    // ── APPROVE ───────────────────────────────────────────────────────────
    if (action === 'approve') {
      const days    = PLAN_DURATION[payReq.plan] ?? 30;
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      // Cancel any existing active/trial subscription first
      await prisma.subscription.updateMany({
        where:  { userId: payReq.userId, status: 'active' },
        data:   { status: 'cancelled' },
      });

      // Create new subscription
      const sub = await prisma.subscription.create({
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

      // Mark payment request as approved
      await prisma.paymentRequest.update({
        where: { id: payReq.id },
        data: {
          status:     'approved',
          reviewedAt: now,
          reviewedBy: 'admin',
          adminNote:  adminNote || 'Payment verified and approved.',
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId:       payReq.userId,
          activityType: 'SUBSCRIPTION_ACTIVATED',
          details:      `Plan: ${payReq.plan}, Days: ${days}, via manual payment #${payReq.id}`,
        },
      });

      // Email user
      try {
        await sendPaymentApprovedEmail({
          userEmail: payReq.user.email,
          userName:  payReq.user.name,
          plan:      payReq.plan,
          endDate,
        });
      } catch (e) {
        console.error('Approval email failed:', e);
      }

      return NextResponse.json({
        success:      true,
        message:      `✅ Approved! Subscription activated for ${payReq.user.email}`,
        subscription: sub,
      });
    }

    // ── REJECT ────────────────────────────────────────────────────────────
    if (action === 'reject') {
      const reason = adminNote || 'Payment screenshot could not be verified.';

      await prisma.paymentRequest.update({
        where: { id: payReq.id },
        data: {
          status:     'rejected',
          reviewedAt: now,
          reviewedBy: 'admin',
          adminNote:  reason,
        },
      });

      await prisma.activity.create({
        data: {
          userId:       payReq.userId,
          activityType: 'PAYMENT_REQUEST_REJECTED',
          details:      `Request #${payReq.id}, Reason: ${reason}`,
        },
      });

      try {
        await sendPaymentRejectedEmail({
          userEmail: payReq.user.email,
          userName:  payReq.user.name,
          plan:      payReq.plan,
          adminNote: reason,
        });
      } catch (e) {
        console.error('Rejection email failed:', e);
      }

      return NextResponse.json({
        success: true,
        message: `❌ Rejected. User ${payReq.user.email} has been notified.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Admin payments error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
