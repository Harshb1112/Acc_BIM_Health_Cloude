import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const section = req.nextUrl.searchParams.get('section') || 'overview';
  const page    = parseInt(req.nextUrl.searchParams.get('page')  || '1');
  const limit   = parseInt(req.nextUrl.searchParams.get('limit') || '20');
  const skip    = (page - 1) * limit;
  const search  = req.nextUrl.searchParams.get('search') || '';

  try {

    // ── OVERVIEW ─────────────────────────────────────────────────────────
    if (section === 'overview') {
      const now       = new Date();
      const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const in7days   = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        verifiedUsers,
        newUsersToday,
        newUsersThisMonth,
        totalSubs,
        activeSubs,
        trialSubs,
        totalRevenue,
        pendingPayments,
        approvedPayments,
        rejectedPayments,
        recentActivities,
        recentUsers,
        expiringSoon,
        expiredSubs,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isVerified: true } }),
        prisma.user.count({ where: { createdAt: { gte: today } } }),
        prisma.user.count({ where: { createdAt: { gte: thisMonth } } }),
        prisma.subscription.count(),
        prisma.subscription.count({ where: { status: 'active', isTrial: false } }),
        prisma.subscription.count({ where: { status: 'active', isTrial: true } }),
        prisma.paymentRequest.aggregate({
          where: { status: 'approved' },
          _sum:  { amount: true },
          _count:{ id: true },
        }),
        prisma.paymentRequest.count({ where: { status: 'pending'  } }),
        prisma.paymentRequest.count({ where: { status: 'approved' } }),
        prisma.paymentRequest.count({ where: { status: 'rejected' } }),
        prisma.activity.findMany({
          orderBy: { timestamp: 'desc' },
          take: 10,
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, name: true, email: true, isVerified: true, createdAt: true },
        }),
        prisma.subscription.findMany({
          where:   { status: 'active', endDate: { gte: now, lte: in7days } },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { endDate: 'asc' },
        }),
        prisma.subscription.findMany({
          where:   { status: 'active', endDate: { lt: now } },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { endDate: 'desc' },
          take: 20,
        }),
      ]);

      return NextResponse.json({
        success: true,
        overview: {
          users: {
            total: totalUsers,
            verified: verifiedUsers,
            unverified: totalUsers - verifiedUsers,
            newToday: newUsersToday,
            newThisMonth: newUsersThisMonth,
          },
          subscriptions: {
            total: totalSubs,
            active: activeSubs,
            trial: trialSubs,
            expiringSoon: expiringSoon.length,
            expired: expiredSubs.length,
          },
          revenue: {
            total: totalRevenue._sum.amount || 0,
            approvedCount: totalRevenue._count.id,
          },
          payments: {
            pending:  pendingPayments,
            approved: approvedPayments,
            rejected: rejectedPayments,
          },
        },
        recentActivities,
        recentUsers,
        expiringSoon,
        expiredSubs,
      });
    }

    // ── USERS ─────────────────────────────────────────────────────────────
    if (section === 'users') {
      const where = search ? {
        OR: [
          { name:  { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true, name: true, email: true, phone: true,
            region: true, isVerified: true, createdAt: true,
            subscriptions: {
              where:   { status: 'active' },
              orderBy: { endDate: 'desc' },
              take: 1,
              select: { plan: true, status: true, endDate: true, isTrial: true },
            },
            _count: { select: { activities: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return NextResponse.json({ success: true, users, total, page, limit });
    }

    // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────
    if (section === 'subscriptions') {
      const [subscriptions, total] = await Promise.all([
        prisma.subscription.findMany({
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        prisma.subscription.count(),
      ]);

      return NextResponse.json({ success: true, subscriptions, total, page, limit });
    }

    // ── PAYMENTS ──────────────────────────────────────────────────────────
    if (section === 'payments') {
      const statusFilter = req.nextUrl.searchParams.get('status');
      const where = statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {};

      const [payments, total] = await Promise.all([
        prisma.paymentRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        prisma.paymentRequest.count({ where }),
      ]);

      return NextResponse.json({ success: true, payments, total, page, limit });
    }

    // ── ACTIVITIES ────────────────────────────────────────────────────────
    if (section === 'activities') {
      const where = search ? {
        OR: [
          { activityType: { contains: search, mode: 'insensitive' as const } },
          { user: { email: { contains: search, mode: 'insensitive' as const } } },
        ],
      } : {};

      const [activities, total] = await Promise.all([
        prisma.activity.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        prisma.activity.count({ where }),
      ]);

      return NextResponse.json({ success: true, activities, total, page, limit });
    }

    return NextResponse.json({ success: false, error: 'Invalid section' }, { status: 400 });

  } catch (error: any) {
    console.error('Admin dashboard error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
