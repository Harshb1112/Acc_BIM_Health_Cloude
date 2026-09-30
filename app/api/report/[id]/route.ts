import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSubscription } from '@/lib/subscription-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const accessError = await requireActiveSubscription(request);
    if (accessError) return accessError;

    const reportId = params.id;

    // Get report from cache
    const reportCache = (global as any).reportCache || new Map();
    const reportData = reportCache.get(reportId);

    if (!reportData) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: reportData,
    });
  } catch (error: any) {
    console.error('❌ Error fetching report:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch report',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
