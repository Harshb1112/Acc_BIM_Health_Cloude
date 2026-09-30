import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function requireActiveSubscription(request: NextRequest): Promise<NextResponse | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: payload.userId,
      status: 'active',
      endDate: { gte: new Date() },
    },
    select: { id: true },
  });

  if (!subscription) {
    return NextResponse.json({ success: false, error: 'Active subscription required' }, { status: 403 });
  }

  return null;
}