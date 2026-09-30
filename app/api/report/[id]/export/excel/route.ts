import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
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

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    
    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];
    
    summarySheet.addRows([
      { metric: 'Project Name', value: reportData.projectName || 'N/A' },
      { metric: 'Generated Date', value: reportData.generatedDate || 'N/A' },
      { metric: 'Revit Version', value: reportData.revitVersion || 'N/A' },
      { metric: 'Overall Grade', value: reportData.quality?.overallGrade || 'N/A' },
      { metric: 'Total Elements', value: reportData.statistics?.totalElements || 0 },
      { metric: 'File Size (MB)', value: reportData.performance?.fileSize || 0 },
      { metric: 'Issues Found', value: reportData.issues?.length || 0 },
    ]);

    // Statistics Sheet
    if (reportData.statistics) {
      const statsSheet = workbook.addWorksheet('Statistics');
      statsSheet.columns = [
        { header: 'Element Type', key: 'type', width: 30 },
        { header: 'Count', key: 'count', width: 15 },
      ];
      
      Object.entries(reportData.statistics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          statsSheet.addRow({ type: key, count: value });
        }
      });
    }

    // Issues Sheet
    if (reportData.issues && reportData.issues.length > 0) {
      const issuesSheet = workbook.addWorksheet('Issues');
      issuesSheet.columns = [
        { header: 'Severity', key: 'severity', width: 15 },
        { header: 'Category', key: 'category', width: 25 },
        { header: 'Description', key: 'description', width: 50 },
        { header: 'Recommendation', key: 'recommendation', width: 50 },
      ];
      
      reportData.issues.forEach((issue: any) => {
        issuesSheet.addRow({
          severity: issue.severity || 'N/A',
          category: issue.category || 'N/A',
          description: issue.description || 'N/A',
          recommendation: issue.recommendation || 'N/A',
        });
      });
    }

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="BIM-Health-Report-${reportId}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Error exporting to Excel:', error);
    return NextResponse.json(
      {
        error: 'Failed to export to Excel',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
