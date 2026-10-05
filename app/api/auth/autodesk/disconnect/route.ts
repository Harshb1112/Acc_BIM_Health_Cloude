import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Disconnect Autodesk account
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Remove Autodesk tokens from database
    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        autodeskUserId: null,
        autodeskAccessToken: null,
        autodeskRefreshToken: null,
        autodeskTokenExpiry: null,
        autodeskConnectedAt: null
      }
    });

    console.log(`✅ Autodesk account disconnected for user ${payload.userId}`);

    return NextResponse.json({
      success: true,
      message: 'Autodesk account disconnected successfully'
    });

  } catch (error: any) {
    console.error('❌ Disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect', details: error.message },
      { status: 500 }
    );
  }
}
