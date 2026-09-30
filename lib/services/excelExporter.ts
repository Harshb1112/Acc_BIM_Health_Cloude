import XLSX from 'xlsx';
import { BIMHealthReport } from '../types/report';

export class ExcelExporter {
  static exportToExcel(report: BIMHealthReport): Buffer {
    const workbook = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['BIM Health Report'],
      [''],
      ['Project Name', report.projectName],
      ['Generated Date', new Date(report.generatedDate).toLocaleString()],
      ['Revit Version', report.revitVersion],
      ['Overall Grade', report.quality.overallGrade],
      ['Total Elements', report.statistics.totalElements],
      ['Model Size (MB)', report.statistics.modelSize.toFixed(2)],
      [''],
      ['Quality Metrics'],
      ['Model Completeness', `${report.quality.modelCompleteness}%`],
      ['Geometric Accuracy', `${report.quality.geometricAccuracy}%`],
      ['Information Richness', `${report.quality.informationRichness}%`],
      [''],
      ['Performance'],
      ['Performance Rating', report.performance.performanceRating],
      ['File Size (MB)', report.performance.fileSize.toFixed(2)],
      ['View Count', report.performance.viewCount],
      ['Unused Families', report.performance.unusedFamilies],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Statistics Sheet
    const statsData = [
      ['Element Type', 'Count'],
      ['Total Elements', report.statistics.totalElements],
      ['Walls', report.statistics.walls],
      ['Floors', report.statistics.floors],
      ['Ceilings', report.statistics.ceilings],
      ['Doors', report.statistics.doors],
      ['Windows', report.statistics.windows],
      ['Columns', report.statistics.columns],
      ['Beams', report.statistics.beams],
      ['Rooms', report.statistics.rooms],
      ['Spaces', report.statistics.spaces],
      ['Views', report.statistics.views],
      ['Sheets', report.statistics.sheets],
      ['Families', report.statistics.families],
      ['Materials', report.statistics.materials],
    ];
    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');

    // Issues Sheet
    const issuesData = [
      ['Category', 'Severity', 'Description', 'Count', 'Recommendation'],
      ...report.issues.map(issue => [
        issue.category,
        issue.severity,
        issue.description,
        issue.count,
        issue.recommendation
      ])
    ];
    const issuesSheet = XLSX.utils.aoa_to_sheet(issuesData);
    XLSX.utils.book_append_sheet(workbook, issuesSheet, 'Issues');

    // Warnings Sheet
    if (report.warnings && report.warnings.length > 0) {
      const warningsData = [
        ['Category', 'Description', 'Element IDs'],
        ...report.warnings.map(warning => [
          warning.category,
          warning.description,
          warning.elementIds.join(', ')
        ])
      ];
      const warningsSheet = XLSX.utils.aoa_to_sheet(warningsData);
      XLSX.utils.book_append_sheet(workbook, warningsSheet, 'Warnings');
    }

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}
