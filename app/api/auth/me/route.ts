import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me
 * Returns current user data including Autodesk connection status
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from header or cookie
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('accessToken')?.value;
    const token = authHeader?.replace('Bearer ', '') || cookieToken;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user from database with Autodesk connection info
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        region: true,
        isVerified: true,
        autodeskUserId: true,
        autodeskAccessToken: true,
        autodeskConnectedAt: true,
        autodeskTokenExpiry: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });

  } catch (error: any) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user data', details: error.message },
      { status: 500 }
    );
  }
}
