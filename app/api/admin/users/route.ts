import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin-auth';

// DELETE /api/admin/users?id=123
// Deletes user + all related data (sessions, OTPs, subscriptions, activities, paymentRequests)
export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: { id: true, name: true, email: true },
    });

    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    // Delete all related data in correct order (foreign key constraints)
    await prisma.$transaction([
      prisma.session.deleteMany(         { where: { userId: user.id } }),
      prisma.oTP.deleteMany(             { where: { userId: user.id } }),
      prisma.activity.deleteMany(        { where: { userId: user.id } }),
      prisma.subscription.deleteMany(    { where: { userId: user.id } }),
      prisma.paymentRequest.deleteMany(  { where: { userId: user.id } }),
      prisma.user.delete(                { where: { id: user.id } }),
    ]);

    return NextResponse.json({
      success: true,
      message: `User "${user.name}" (${user.email}) and all related data deleted.`,
    });

  } catch (e: any) {
    console.error('Delete user error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
