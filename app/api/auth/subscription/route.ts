import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const payload = token ? verifyToken(token) : null;
  const headers = { 'Cache-Control': 'no-store, max-age=0' };

  if (!payload) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401, headers });
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: payload.userId,
        status: 'active',
        endDate: { gte: new Date() },
      },
      orderBy: { endDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            endDate: subscription.endDate,
            isTrial: subscription.isTrial,
          }
        : null,
    }, { headers });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch subscription' }, { status: 500, headers });
  }
}
