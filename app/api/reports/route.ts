import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get all reports from cache
    const reportCache = (global as any).reportCache || new Map();
    
    const reports: any[] = [];
    
    reportCache.forEach((reportData: any, reportId: string) => {
      reports.push({
        id: reportId,
        projectName: reportData.projectName || 'Untitled Project',
        generatedDate: reportData.generatedDate || new Date().toISOString(),
        uploadedAt: reportData.uploadedAt || reportData.generatedDate || new Date().toISOString(),
        revitVersion: reportData.revitVersion || 'N/A',
        overallGrade: reportData.quality?.overallGrade || 'N/A',
        statistics: reportData.statistics || {},
        issues: reportData.issues || [],
        performance: reportData.performance || {},
        quality: reportData.quality || {},
        source: reportData.source || 'Upload',
        fileSize: reportData.performance?.fileSize || 0,
        totalElements: reportData.statistics?.totalElements || 0,
        // Add the missing fields for dashboard metrics
        worksetCount: reportData.worksetCount || 0,
        designOptionsCount: reportData.designOptionsCount || 0,
        linkedRevitFiles: reportData.linkedRevitFiles || 0,
        linkedCADFiles: reportData.linkedCADFiles || 0,
      });
    });
    
    // Sort by uploadedAt (newest first)
    reports.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    
    return NextResponse.json({
      success: true,
      reports,
      count: reports.length,
    });
  } catch (error: any) {
    console.error('❌ Error fetching reports:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch reports',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Delete report
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');
    
    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      );
    }
    
    const reportCache = (global as any).reportCache || new Map();
    
    if (!reportCache.has(reportId)) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }
    
    reportCache.delete(reportId);
    
    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error: any) {
    console.error('❌ Error deleting report:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete report',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
