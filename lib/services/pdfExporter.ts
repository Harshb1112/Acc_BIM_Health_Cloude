import PDFDocument from 'pdfkit';

export class PDFExporter {
  static async exportToPDF(report: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);
        this.generatePDFContent(doc, report);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ── Helper: Section title ──────────────────────────────────────────────────
  private static section(doc: any, title: string): void {
    doc.addPage();
    doc.fontSize(20).fillColor('#0369a1').text(title.toUpperCase());
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#0369a1').lineWidth(2).stroke();
    doc.moveDown(0.8);
  }

  // ── Helper: Key-Value row ─────────────────────────────────────────────────
  private static kv(doc: any, label: string, value: string | number): void {
    doc.fontSize(11).fillColor('#444').text(label + ':', { continued: true, width: 200 });
    doc.fontSize(11).fillColor('#000').text('  ' + value, { align: 'left' });
  }

  // ── Helper: Bar chart row (label | ████████░░░░ | count) ─────────────────
  private static barRow(doc: any, label: string, value: number, max: number, color: string = '#0284c7'): void {
    const barMaxWidth = 250;
    const barWidth = max > 0 ? Math.max(4, Math.round((value / max) * barMaxWidth)) : 4;
    const startX = 50;
    const labelWidth = 160;
    const barX = startX + labelWidth + 10;
    const y = doc.y;

    // Label
    doc.fontSize(10).fillColor('#333').text(label, startX, y, { width: labelWidth, ellipsis: true });

    // Bar background
    doc.rect(barX, y + 1, barMaxWidth, 14).fillColor('#e5e7eb').fill();
    // Bar filled
    doc.rect(barX, y + 1, barWidth, 14).fillColor(color).fill();
    // Value
    doc.fontSize(9).fillColor('#000').text(
      value.toLocaleString(),
      barX + barMaxWidth + 8, y + 2,
      { width: 70 }
    );

    doc.moveDown(1.2);
  }

  // ── Helper: render a dictionary as bar chart ──────────────────────────────
  private static dictChart(doc: any, data: Record<string, number>, color: string = '#0284c7'): void {
    if (!data || Object.keys(data).length === 0) {
      doc.fontSize(10).fillColor('#888').text('No data available for this section.');
      return;
    }
    const entries = Object.entries(data)
      .filter(([, v]) => v >= 0)
      .sort(([, a], [, b]) => b - a);
    const max = Math.max(...entries.map(([, v]) => v), 1);
    entries.forEach(([k, v]) => this.barRow(doc, k, v, max, color));
  }

  // ── Main content ──────────────────────────────────────────────────────────
  private static generatePDFContent(doc: any, report: any): void {

    // ── PAGE 1: Cover ────────────────────────────────────────────────────────
    doc.fontSize(32).fillColor('#0284c7').text('BIM HEALTH REPORT', { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(20).fillColor('#111').text(report.projectName || 'Untitled Project', { align: 'center' });
    doc.moveDown(2);

    const gradeColor =
      report.quality?.overallGrade === 'A' ? '#10b981' :
      report.quality?.overallGrade === 'B' ? '#3b82f6' :
      report.quality?.overallGrade === 'C' ? '#f59e0b' : '#ef4444';
    doc.fontSize(72).fillColor(gradeColor).text(report.quality?.overallGrade || '–', { align: 'center' });
    doc.fontSize(13).fillColor('#666').text('Overall Grade', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(11).fillColor('#666')
      .text(`Generated: ${new Date(report.generatedDate || Date.now()).toLocaleString()}`, { align: 'center' })
      .text(`Revit Version: ${report.revitVersion || 'N/A'}`, { align: 'center' })
      .text(`File Size: ${(report.statistics?.modelSize || 0).toFixed(2)} MB`, { align: 'center' });

    // ── PAGE 2: Executive Summary ─────────────────────────────────────────────
    this.section(doc, 'Executive Summary');
    doc.fontSize(12).fillColor('#000');

    const stats = report.statistics || {};
    this.kv(doc, 'Total Elements',  (stats.totalElements || 0).toLocaleString());
    this.kv(doc, 'Model Size',      `${(stats.modelSize || 0).toFixed(2)} MB`);
    this.kv(doc, 'Warnings',        (stats.warnings || 0).toString());
    this.kv(doc, 'Walls',           (stats.walls || 0).toString());
    this.kv(doc, 'Floors',          (stats.floors || 0).toString());
    this.kv(doc, 'Doors',           (stats.doors || 0).toString());
    this.kv(doc, 'Windows',         (stats.windows || 0).toString());
    this.kv(doc, 'Columns',         (stats.columns || 0).toString());
    this.kv(doc, 'Beams',           (stats.beams || 0).toString());
    this.kv(doc, 'Rooms',           (stats.rooms || 0).toString());
    this.kv(doc, 'Spaces',          (stats.spaces || 0).toString());
    this.kv(doc, 'Views',           (stats.views || 0).toString());
    this.kv(doc, 'Sheets',          (stats.sheets || 0).toString());
    this.kv(doc, 'Families',        (stats.families || 0).toString());
    this.kv(doc, 'Materials',       (stats.materials || 0).toString());
    this.kv(doc, 'Linked RVT Files',(stats.linkedRevitFiles || 0).toString());
    this.kv(doc, 'Linked CAD Files',(stats.linkedCADFiles || 0).toString());
    this.kv(doc, 'Performance',     report.performance?.performanceRating || 'N/A');
    this.kv(doc, 'Issues Found',    (report.issues?.length || 0).toString());

    // ── PAGE 3: Quality Metrics ───────────────────────────────────────────────
    this.section(doc, 'Quality Metrics');
    if (report.quality) {
      const q = report.quality;
      const qColor = '#0284c7';
      const qMax = 100;
      this.barRow(doc, 'Model Completeness',   q.modelCompleteness  || 0, qMax, '#10b981');
      this.barRow(doc, 'Geometric Accuracy',   q.geometricAccuracy  || 0, qMax, '#3b82f6');
      this.barRow(doc, 'Information Richness', q.informationRichness|| 0, qMax, '#f59e0b');
      this.barRow(doc, 'Compliance',           q.compliance         || 0, qMax, '#8b5cf6');
      this.barRow(doc, 'Performance Score',    q.performance        || 0, qMax, '#ef4444');
    }

    // ── PAGE 4: Element Distribution ─────────────────────────────────────────
    this.section(doc, 'Architectural Elements');
    const archData: Record<string, number> = {
      'Walls':       stats.walls    || 0,
      'Floors':      stats.floors   || 0,
      'Ceilings':    stats.ceilings || 0,
      'Doors':       stats.doors    || 0,
      'Windows':     stats.windows  || 0,
      'Columns':     stats.columns  || 0,
      'Roofs':       stats.roofs    || 0,
      'Stairs':      stats.stairs   || 0,
      'Railings':    stats.railings || 0,
      'Curtain Walls':stats.curtainWalls || 0,
      'Rooms':       stats.rooms    || 0,
    };
    this.dictChart(doc, archData, '#0369a1');

    // ── PAGE 5: MEP Systems ───────────────────────────────────────────────────
    this.section(doc, 'MEP Systems');
    if (report.mepElements && Object.keys(report.mepElements).length > 0) {
      this.dictChart(doc, report.mepElements, '#f97316');
    } else {
      // Fallback to statistics if mepElements not extracted separately
      const mepFallback: Record<string, number> = {
        'Ducts':               stats.ducts               || 0,
        'Pipes':               stats.pipes               || 0,
        'Cable Trays':         stats.cableTrays          || 0,
        'Conduits':            stats.conduits            || 0,
        'Lighting Fixtures':   stats.lightingFixtures    || 0,
        'Plumbing Fixtures':   stats.plumbingFixtures    || 0,
        'Mechanical Equipment':stats.mechanicalEquipment || 0,
        'Electrical Equipment':stats.electricalEquipment || 0,
        'Sprinklers':          stats.sprinklers          || 0,
        'Fire Alarm Devices':  stats.fireAlarmDevices    || 0,
      };
      this.dictChart(doc, mepFallback, '#f97316');
    }

    // ── PAGE 6: Structural Elements ───────────────────────────────────────────
    this.section(doc, 'Structural Elements');
    if (report.structuralElements && Object.keys(report.structuralElements).length > 0) {
      this.dictChart(doc, report.structuralElements, '#6b7280');
    } else {
      const structFallback: Record<string, number> = {
        'Structural Columns':     stats.structuralColumns    || 0,
        'Structural Framing':     stats.structuralFraming    || 0,
        'Foundations':            stats.foundations          || 0,
        'Rebar':                  stats.rebar                || 0,
        'Structural Connections': stats.structuralConnections|| 0,
      };
      this.dictChart(doc, structFallback, '#6b7280');
    }

    // ── PAGE 7: Views & Sheets ────────────────────────────────────────────────
    this.section(doc, 'Views & Sheets Analysis');
    if (report.viewDetails && Object.keys(report.viewDetails).length > 0) {
      this.dictChart(doc, report.viewDetails, '#8b5cf6');
    } else {
      const viewFallback: Record<string, number> = {
        'Total Views':   stats.views  || 0,
        'Total Sheets':  stats.sheets || 0,
        'Floor Plans':   stats.floorPlans   || 0,
        'Elevations':    stats.elevations   || 0,
        'Sections':      stats.sections     || 0,
        '3D Views':      stats.views3D      || 0,
        'Schedules':     stats.schedules    || 0,
      };
      this.dictChart(doc, viewFallback, '#8b5cf6');
    }

    // ── PAGE 8: Materials ─────────────────────────────────────────────────────
    this.section(doc, 'Materials Analysis');
    if (report.materialDetails && Object.keys(report.materialDetails).length > 0) {
      const matData: Record<string, number> = {};
      Object.entries(report.materialDetails).forEach(([k, v]) => {
        if (typeof v === 'number') matData[k] = v;
      });
      this.dictChart(doc, matData, '#10b981');
    } else {
      doc.fontSize(11).fillColor('#444').text(`Total Materials: ${(stats.materials || 0).toLocaleString()}`);
      doc.fontSize(10).fillColor('#888').text('Detailed material breakdown not available.');
    }

    // ── PAGE 9: Levels & Grids ────────────────────────────────────────────────
    this.section(doc, 'Levels & Grids');
    if (report.levelsAndGrids && Object.keys(report.levelsAndGrids).length > 0) {
      this.dictChart(doc, report.levelsAndGrids, '#0891b2');
    } else {
      const lgFallback: Record<string, number> = {
        'Total Levels': stats.levels || 0,
        'Total Grids':  stats.grids  || 0,
      };
      this.dictChart(doc, lgFallback, '#0891b2');
    }

    // ── PAGE 10: Issues ───────────────────────────────────────────────────────
    if (report.issues && report.issues.length > 0) {
      this.section(doc, 'Issues Detected');
      report.issues.slice(0, 20).forEach((issue: any, i: number) => {
        const sev = (issue.severity || 'info').toUpperCase();
        const sevColor = sev === 'HIGH' ? '#dc2626' : sev === 'MEDIUM' ? '#d97706' : '#0284c7';
        doc.fontSize(10).fillColor(sevColor).text(`[${sev}]`, { continued: true });
        doc.fillColor('#111').text(` ${issue.category || 'Issue'}: ${issue.description || ''}`);
        if (issue.recommendation) {
          doc.fontSize(9).fillColor('#555').text(`   → ${issue.recommendation}`, { indent: 10 });
        }
        doc.moveDown(0.4);
      });
    }

    // ── PAGE 11: Recommendations ──────────────────────────────────────────────
    if (report.quality?.recommendations?.length > 0) {
      this.section(doc, 'Recommendations');
      report.quality.recommendations.forEach((rec: string, i: number) => {
        doc.fontSize(11).fillColor('#000').text(`${i + 1}. ${rec}`);
        doc.moveDown(0.5);
      });
    }

    // ── Footer on last page ───────────────────────────────────────────────────
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#999').text(
      `BIMBOSS BIM Health Report v1.0.0  |  Generated ${new Date().toLocaleDateString()}  |  www.bimboss.com`,
      { align: 'center' }
    );
  }
}
