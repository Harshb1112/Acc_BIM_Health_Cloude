import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin-auth';

// DELETE /api/admin/subscriptions?id=123&action=cancel|delete
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const id     = req.nextUrl.searchParams.get('id');
  const action = req.nextUrl.searchParams.get('action') || 'cancel'; // cancel or delete

  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  try {
    const sub = await prisma.subscription.findUnique({
      where:   { id: Number(id) },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!sub) return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });

    if (action === 'delete') {
      await prisma.subscription.delete({ where: { id: Number(id) } });
      await prisma.activity.create({
        data: {
          userId:       sub.userId,
          activityType: 'SUBSCRIPTION_DELETED_BY_ADMIN',
          details:      `Plan: ${sub.plan} deleted by admin`,
        },
      });
      return NextResponse.json({ success: true, message: `Subscription deleted for ${sub.user.email}` });
    }

    // cancel
    await prisma.subscription.update({
      where: { id: Number(id) },
      data:  { status: 'cancelled' },
    });
    await prisma.activity.create({
      data: {
        userId:       sub.userId,
        activityType: 'SUBSCRIPTION_CANCELLED_BY_ADMIN',
        details:      `Plan: ${sub.plan} cancelled by admin`,
      },
    });
    return NextResponse.json({ success: true, message: `Subscription cancelled for ${sub.user.email}` });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
