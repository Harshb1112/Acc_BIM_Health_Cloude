import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/plans — list all plans
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json({ success: true, plans });
}

// POST /api/admin/plans — create new plan
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, planId, duration, price, currency, description, isActive, isPopular, sortOrder } = body;

    if (!name || !planId || !duration || !price) {
      return NextResponse.json({ success: false, error: 'name, planId, duration, price are required' }, { status: 400 });
    }

    // Check duplicate planId
    const existing = await prisma.plan.findUnique({ where: { planId } });
    if (existing) {
      return NextResponse.json({ success: false, error: `Plan ID "${planId}" already exists` }, { status: 409 });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        planId,
        duration:    Number(duration),
        price:       Number(price),
        currency:    currency   || 'USD',
        description: description|| null,
        isActive:    isActive   ?? true,
        isPopular:   isPopular  ?? false,
        sortOrder:   sortOrder  ? Number(sortOrder) : 0,
      },
    });

    return NextResponse.json({ success: true, plan, message: `Plan "${name}" created!` });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// PUT /api/admin/plans — update existing plan
export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, name, planId, duration, price, currency, description, isActive, isPopular, sortOrder } = body;

    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    // Check planId conflict with another plan
    if (planId) {
      const conflict = await prisma.plan.findFirst({ where: { planId, NOT: { id: Number(id) } } });
      if (conflict) return NextResponse.json({ success: false, error: `Plan ID "${planId}" already used` }, { status: 409 });
    }

    const plan = await prisma.plan.update({
      where: { id: Number(id) },
      data: {
        ...(name        !== undefined && { name }),
        ...(planId      !== undefined && { planId }),
        ...(duration    !== undefined && { duration:  Number(duration)  }),
        ...(price       !== undefined && { price:     Number(price)     }),
        ...(currency    !== undefined && { currency }),
        ...(description !== undefined && { description }),
        ...(isActive    !== undefined && { isActive }),
        ...(isPopular   !== undefined && { isPopular }),
        ...(sortOrder   !== undefined && { sortOrder: Number(sortOrder) }),
      },
    });

    return NextResponse.json({ success: true, plan, message: `Plan "${plan.name}" updated!` });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin/plans?id=123 — delete plan
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

    const plan = await prisma.plan.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true, message: `Plan "${plan.name}" deleted!` });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
