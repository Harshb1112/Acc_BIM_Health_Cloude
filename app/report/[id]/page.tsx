'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import {
  ArrowLeft, FileText, AlertTriangle, CheckCircle,
  BarChart3, Activity, Layers, Box, Zap, Building2,
  FileType, Grid3x3, MapPin, Users, Ruler, Lightbulb
} from 'lucide-react';
import {
  BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface Report {
  id: string;
  projectName: string;
  generatedDate: string;
  revitVersion: string;
  statistics: any;
  familyAnalysis: any;
  memoryUsage: any;
  renderingPerformance: any;
  fileSizeBreakdown: any;
  performanceMetrics: any;
  architecturalElements: any;  // NEW!
  mepElements: any;
  structuralElements: any;
  annotationElements: any;
  viewDetails: any;
  sheetDetails: any;
  materialDetails: any;
  coordinateSystemDetails: any;
  linkedFiles: any;
  linkedRevitFiles: number;
  linkedCADFiles: number;
  worksetCount: number;
  designOptionsCount: number;
  groupDetails: any;
  levelsAndGrids: any;
  areasDetails: any;
  spacesDetails: any;
  archSystemFamilies: any;
  mepSystemFamilies: any;
  structuralSystemFamilies: any;
  projectInfo: any;
  performanceDetails: any;
  issues: any[];
  warnings: any[];
  performance: any;
  quality: any;
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const response = await axios.get(`/api/report/${id}`);
      // Next.js API returns { success: true, data: reportData }
      const reportData = response.data.data || response.data;
      setReport(reportData);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'excel' | 'pdf') => {
    setExporting(format);
    
    if (format === 'pdf') {
      // COMPREHENSIVE PDF EXPORT WITH ALL 21 SECTIONS
      try {
        const jsPDF = (await import('jspdf')).default;
        const html2canvas = (await import('html2canvas')).default;
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        let yPosition = margin;
        
        // Helper functions
        const addNewPage = () => {
          pdf.addPage();
          yPosition = margin;
        };
        
        const checkPageBreak = (requiredHeight: number) => {
          if (yPosition + requiredHeight > pageHeight - margin) {
            addNewPage();
            return true;
          }
          return false;
        };
        
        const addSectionTitle = (title: string, color: [number, number, number] = [33, 150, 243]) => {
          checkPageBreak(15);
          pdf.setFontSize(16);
          pdf.setTextColor(...color);
          pdf.setFont('helvetica', 'bold');
          pdf.text(title, margin, yPosition);
          yPosition += 10;
          pdf.setDrawColor(200, 200, 200);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 8;
        };
        
        const addText = (text: string, fontSize = 10, color: [number, number, number] = [0, 0, 0]) => {
          pdf.setFontSize(fontSize);
          pdf.setTextColor(...color);
          pdf.setFont('helvetica', 'normal');
          const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
          lines.forEach((line: string) => {
            checkPageBreak(6);
            pdf.text(line, margin, yPosition);
            yPosition += 5;
          });
        };
        
        const addStatCard = (label: string, value: string | number, color: [number, number, number] = [0, 0, 0]) => {
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(label, margin, yPosition);
          pdf.setFontSize(14);
          pdf.setTextColor(...color);
          pdf.setFont('helvetica', 'bold');
          pdf.text(String(value), margin + 50, yPosition);
          yPosition += 7;
        };
        
        // Helper function to sanitize text for PDF
        const sanitizeText = (text: string): string => {
          if (!text) return '';
          // Remove special characters that cause encoding issues
          return text
            .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .trim();
        };
        
        // ==================== COVER PAGE ====================
        pdf.setFillColor(33, 150, 243);
        pdf.rect(0, 0, pageWidth, 60, 'F');
        
        pdf.setFontSize(28);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.text('BIM HEALTH REPORT', pageWidth / 2, 30, { align: 'center' });
        
        pdf.setFontSize(16);
        pdf.text(sanitizeText(report?.projectName || 'Project Report'), pageWidth / 2, 45, { align: 'center' });
        
        yPosition = 80;
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Generated: ${new Date(report?.generatedDate || '').toLocaleDateString()}`, margin, yPosition);
        yPosition += 7;
        pdf.text(`Revit Version: ${sanitizeText(report?.revitVersion || 'N/A')}`, margin, yPosition);
        yPosition += 7;
        pdf.text(`Report Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
        yPosition += 15;
        
        // Executive Summary
        addSectionTitle('EXECUTIVE SUMMARY', [33, 150, 243]);
        addStatCard('Overall Grade', sanitizeText(report?.quality?.overallGrade || 'N/A'), [16, 185, 129]);
        addStatCard('Total Elements', (report?.statistics?.totalElements || 0).toLocaleString(), [139, 92, 246]);
        addStatCard('Issues Found', report?.issues.length || 0, [239, 68, 68]);
        addStatCard('Performance Rating', report?.performance.performanceRating || 'N/A', [245, 158, 11]);
        addStatCard('File Size', `${report?.performance.fileSize.toFixed(1)} MB` || 'N/A', [59, 130, 246]);
        yPosition += 10;
        
        // ==================== SECTION 1: ARCHITECTURAL ELEMENTS ====================
        addNewPage();
        addSectionTitle('SECTION 1: ARCHITECTURAL ELEMENTS', [33, 150, 243]);
        
        // Capture Element Distribution Chart
        const elementsChart1 = document.getElementById('elements-chart-1');
        if (elementsChart1) {
          try {
            const canvas = await html2canvas(elementsChart1, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = pageWidth - 2 * margin;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            checkPageBreak(imgHeight + 10);
            pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 80));
            yPosition += Math.min(imgHeight, 80) + 10;
          } catch (err) {
            console.error('Chart capture error:', err);
          }
        }
        
        addText('Element Statistics:', 11, [0, 0, 0]);
        yPosition += 3;
        const archStats = [
          ['Walls', report?.statistics.walls || 0],
          ['Floors', report?.statistics.floors || 0],
          ['Ceilings', report?.statistics.ceilings || 0],
          ['Doors', report?.statistics.doors || 0],
          ['Windows', report?.statistics.windows || 0],
          ['Columns', report?.statistics.columns || 0],
          ['Beams', report?.statistics.beams || 0],
          ['Rooms', report?.statistics.rooms || 0]
        ];
        
        archStats.forEach(([name, value]) => {
          addStatCard(name as string, value as number);
        });
        
        // ==================== SECTION 2: MEP SYSTEMS ====================
        if (report?.mepElements) {
          addNewPage();
          addSectionTitle('SECTION 2: MEP SYSTEMS', [239, 68, 68]);
          
          // Capture MEP Chart
          const mepChart1 = document.getElementById('mep-chart-1');
          if (mepChart1) {
            try {
              const canvas = await html2canvas(mepChart1, { scale: 2, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - 2 * margin;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              checkPageBreak(imgHeight + 10);
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 80));
              yPosition += Math.min(imgHeight, 80) + 10;
            } catch (err) {
              console.error('Chart capture error:', err);
            }
          }
          
          addText('MEP Elements Analysis:', 11);
          yPosition += 3;
          addStatCard('Ducts', report.mepElements.ducts || 0);
          addStatCard('Pipes', report.mepElements.pipes || 0);
          addStatCard('Electrical Fixtures', report.mepElements.electricalFixtures || 0);
          addStatCard('Lighting Fixtures', report.mepElements.lightingFixtures || 0);
          addStatCard('Plumbing Fixtures', report.mepElements.plumbingFixtures || 0);
          addStatCard('HVAC Equipment', report.mepElements.hvacEquipment || 0);
        }
        
        // ==================== SECTION 3: STRUCTURAL ELEMENTS ====================
        if (report?.structuralElements) {
          addNewPage();
          addSectionTitle('SECTION 3: STRUCTURAL ELEMENTS', [100, 116, 139]);
          
          // Capture Structural Chart
          const structuralChart1 = document.getElementById('structural-chart-1');
          if (structuralChart1) {
            try {
              const canvas = await html2canvas(structuralChart1, { scale: 2, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - 2 * margin;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              checkPageBreak(imgHeight + 10);
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 80));
              yPosition += Math.min(imgHeight, 80) + 10;
            } catch (err) {
              console.error('Chart capture error:', err);
            }
          }
          
          addText('Structural Components:', 11);
          yPosition += 3;
          addStatCard('Structural Columns', report.structuralElements.structuralColumns || 0);
          addStatCard('Structural Framing', report.structuralElements.structuralFraming || 0);
          addStatCard('Foundations', report.structuralElements.structuralFoundations || 0);
          addStatCard('Rebar', report.structuralElements.rebar || 0);
          addStatCard('Connections', report.structuralElements.structuralConnections || 0);
        }
        
        // ==================== SECTION 4: VIEWS & SHEETS ====================
        if (report?.viewDetails) {
          addNewPage();
          addSectionTitle('SECTION 4: VIEWS & SHEETS', [139, 92, 246]);
          
          // Capture Views Chart
          const viewsChart1 = document.getElementById('views-chart-1');
          if (viewsChart1) {
            try {
              const canvas = await html2canvas(viewsChart1, { scale: 2, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - 2 * margin;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              checkPageBreak(imgHeight + 10);
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 80));
              yPosition += Math.min(imgHeight, 80) + 10;
            } catch (err) {
              console.error('Chart capture error:', err);
            }
          }
          
          addText('View Types Distribution:', 11);
          yPosition += 3;
          addStatCard('Floor Plans', report.viewDetails.floorPlans || 0);
          addStatCard('Ceiling Plans', report.viewDetails.ceilingPlans || 0);
          addStatCard('Elevations', report.viewDetails.elevations || 0);
          addStatCard('Sections', report.viewDetails.sections || 0);
          addStatCard('3D Views', report.viewDetails.threeD || 0);
          addStatCard('Schedules', report.viewDetails.schedules || 0);
          addStatCard('Drafting Views', report.viewDetails.draftingViews || 0);
          
          if (report.sheetDetails) {
            yPosition += 5;
            addText('Sheet Information:', 11);
            yPosition += 3;
            addStatCard('Total Sheets', report.sheetDetails.totalSheets || 0);
            addStatCard('Sheets with Views', report.sheetDetails.sheetsWithViews || 0);
            addStatCard('Empty Sheets', report.sheetDetails.emptySheets || 0);
          }
        }
        
        // ==================== SECTION 5: MATERIALS ====================
        if (report?.materialDetails) {
          addNewPage();
          addSectionTitle('SECTION 5: MATERIALS', [245, 158, 11]);
          
          // Capture Materials Chart
          const materialsChart1 = document.getElementById('materials-chart-1');
          if (materialsChart1) {
            try {
              const canvas = await html2canvas(materialsChart1, { scale: 2, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - 2 * margin;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              checkPageBreak(imgHeight + 10);
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 80));
              yPosition += Math.min(imgHeight, 80) + 10;
            } catch (err) {
              console.error('Chart capture error:', err);
            }
          }
          
          addText('Material Analysis:', 11);
          yPosition += 3;
          addStatCard('Total Materials', report.materialDetails.totalMaterials || 0);
          addStatCard('With Appearance', report.materialDetails.materialsWithAppearance || 0);
          addStatCard('With Thermal Properties', report.materialDetails.materialsWithThermal || 0);
          addStatCard('With Physical Properties', report.materialDetails.materialsWithPhysical || 0);
        }
        
        // ==================== SECTION 6: LEVELS & GRIDS ====================
        if (report?.levelsAndGrids) {
          addNewPage();
          addSectionTitle('SECTION 6: LEVELS & GRIDS', [139, 92, 246]);
          
          // Capture Levels Chart
          const levelsChart1 = document.getElementById('levels-chart-1');
          if (levelsChart1) {
            try {
              const canvas = await html2canvas(levelsChart1, { scale: 2, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - 2 * margin;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              checkPageBreak(imgHeight + 10);
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 80));
              yPosition += Math.min(imgHeight, 80) + 10;
            } catch (err) {
              console.error('Chart capture error:', err);
            }
          }
          
          addText('Level and Grid Information:', 11);
          yPosition += 3;
          addStatCard('Total Levels', report.levelsAndGrids.levels || 0);
          addStatCard('Total Grids', report.levelsAndGrids.grids || 0);
          addStatCard('Named Levels', report.levelsAndGrids.namedLevels || 0);
          addStatCard('Named Grids', report.levelsAndGrids.namedGrids || 0);
          addStatCard('Structural Levels', report.levelsAndGrids.structuralLevels || 0);
          addStatCard('Building Story Levels', report.levelsAndGrids.buildingStoryLevels || 0);
        }
        
        // ==================== SECTION 7: AREAS & SPACES ====================
        if (report?.areasDetails && report?.spacesDetails) {
          addNewPage();
          addSectionTitle('SECTION 7: AREAS & SPACES', [16, 185, 129]);
          
          // Capture Areas Charts
          const areasChart1 = document.getElementById('areas-chart-1');
          if (areasChart1) {
            try {
              const canvas = await html2canvas(areasChart1, { scale: 2, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = (pageWidth - 3 * margin) / 2;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              checkPageBreak(imgHeight + 10);
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 70));
              
              // Capture Spaces Chart next to it
              const areasChart2 = document.getElementById('areas-chart-2');
              if (areasChart2) {
                try {
                  const canvas2 = await html2canvas(areasChart2, { scale: 2, backgroundColor: '#ffffff' });
                  const imgData2 = canvas2.toDataURL('image/png');
                  pdf.addImage(imgData2, 'PNG', margin + imgWidth + margin, yPosition, imgWidth, Math.min(imgHeight, 70));
                } catch (err) {
                  console.error('Chart capture error:', err);
                }
              }
              yPosition += Math.min(imgHeight, 70) + 10;
            } catch (err) {
              console.error('Chart capture error:', err);
            }
          }
          
          addText('Areas:', 11);
          yPosition += 3;
          addStatCard('Total Areas', report.areasDetails.totalAreas || 0);
          addStatCard('Placed Areas', report.areasDetails.placedAreas || 0);
          addStatCard('Unplaced Areas', report.areasDetails.unplacedAreas || 0);
          
          yPosition += 5;
          addText('Spaces:', 11);
          yPosition += 3;
          addStatCard('Total Spaces', report.spacesDetails.totalSpaces || 0);
          addStatCard('Placed Spaces', report.spacesDetails.placedSpaces || 0);
          addStatCard('Unplaced Spaces', report.spacesDetails.unplacedSpaces || 0);
        }
        
        // ==================== SECTION 8: COORDINATES ====================
        if (report?.coordinateSystemDetails) {
          addNewPage();
          addSectionTitle('SECTION 8: COORDINATE SYSTEM', [59, 130, 246]);
          
          addText('Coordinate Information:', 11);
          yPosition += 5;
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.text('Project Base Point:', margin, yPosition);
          yPosition += 5;
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(report.coordinateSystemDetails.projectBasePoint || 'Not Available', margin + 5, yPosition);
          yPosition += 8;
          
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.text('Survey Point:', margin, yPosition);
          yPosition += 5;
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(report.coordinateSystemDetails.surveyPoint || 'Not Available', margin + 5, yPosition);
          yPosition += 8;
          
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.text('True North Angle:', margin, yPosition);
          yPosition += 5;
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(report.coordinateSystemDetails.trueNorthAngle || 'Not Available', margin + 5, yPosition);
          yPosition += 10;
        }
        
        // ==================== SECTION 9: LINKED FILES ====================
        if (report?.linkedRevitFiles !== undefined || report?.linkedCADFiles !== undefined) {
          addSectionTitle('SECTION 9: LINKED FILES', [245, 158, 11]);
          
          // Capture Linked Files Chart
          const coordinatesChart1 = document.getElementById('coordinates-chart-1');
          if (coordinatesChart1) {
            try {
              const canvas = await html2canvas(coordinatesChart1, { scale: 2, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - 2 * margin;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              checkPageBreak(imgHeight + 10);
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 80));
              yPosition += Math.min(imgHeight, 80) + 10;
            } catch (err) {
              console.error('Chart capture error:', err);
            }
          }
          
          addText('Linked Files Information:', 11);
          yPosition += 3;
          addStatCard('Revit Links', report.linkedRevitFiles || 0);
          addStatCard('CAD Links', report.linkedCADFiles || 0);
          addStatCard('Total Links', (report.linkedRevitFiles || 0) + (report.linkedCADFiles || 0));
        }
        
        // ==================== SECTION 10: GROUPS ====================
        if (report?.groupDetails) {
          addNewPage();
          addSectionTitle('SECTION 10: GROUPS & ASSEMBLIES', [236, 72, 153]);
          
          // Capture Groups Chart
          const groupsChart1 = document.getElementById('groups-chart-1');
          if (groupsChart1) {
            try {
              const canvas = await html2canvas(groupsChart1, { scale: 2, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - 2 * margin;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              checkPageBreak(imgHeight + 10);
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 80));
              yPosition += Math.min(imgHeight, 80) + 10;
            } catch (err) {
              console.error('Chart capture error:', err);
            }
          }
          
          addText('Group Information:', 11);
          yPosition += 3;
          addStatCard('Model Groups', report.groupDetails.modelGroups || 0);
          addStatCard('Detail Groups', report.groupDetails.detailGroups || 0);
          addStatCard('Model Group Types', report.groupDetails.modelGroupTypes || 0);
          addStatCard('Detail Group Types', report.groupDetails.detailGroupTypes || 0);
          addStatCard('Unused Group Types', report.groupDetails.unusedGroupTypes || 0, [239, 68, 68]);
        }
        
        // ==================== SECTION 11: PERFORMANCE METRICS ====================
        addNewPage();
        addSectionTitle('SECTION 11: PERFORMANCE METRICS', [16, 185, 129]);
        
        addText('Performance Analysis:', 11);
        yPosition += 3;
        addStatCard('File Size', `${report?.performance.fileSize.toFixed(1)} MB` || 'N/A');
        addStatCard('View Count', report?.performance.viewCount || 0);
        addStatCard('Unused Families', report?.performance.unusedFamilies || 0);
        addStatCard('Performance Rating', report?.performance.performanceRating || 'N/A');
        
        // ==================== SECTION 12: QUALITY METRICS ====================
        addNewPage();
        addSectionTitle('SECTION 12: QUALITY METRICS', [16, 185, 129]);
        
        addText('Quality Assessment:', 11);
        yPosition += 3;
        addStatCard('Model Completeness', `${report?.quality.modelCompleteness?.toFixed(1)}%` || 'N/A');
        addStatCard('Geometric Accuracy', `${report?.quality.geometricAccuracy?.toFixed(1)}%` || 'N/A');
        addStatCard('Information Richness', `${report?.quality.informationRichness?.toFixed(1)}%` || 'N/A');
        addStatCard('Overall Grade', report?.quality.overallGrade || 'N/A', [16, 185, 129]);
        
        // ==================== SECTION 13: ISSUES & RECOMMENDATIONS ====================
        if (report?.issues && report.issues.length > 0) {
          addNewPage();
          addSectionTitle('SECTION 13: ISSUES & RECOMMENDATIONS', [239, 68, 68]);
          
          // Capture Issues Charts
          const issuesChart1 = document.getElementById('issues-chart-1');
          if (issuesChart1) {
            try {
              const canvas = await html2canvas(issuesChart1, { scale: 2, backgroundColor: '#ffffff' });
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = (pageWidth - 3 * margin) / 2;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              checkPageBreak(imgHeight + 10);
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 70));
              
              // Capture Issues by Category Chart next to it
              const issuesChart2 = document.getElementById('issues-chart-2');
              if (issuesChart2) {
                try {
                  const canvas2 = await html2canvas(issuesChart2, { scale: 2, backgroundColor: '#ffffff' });
                  const imgData2 = canvas2.toDataURL('image/png');
                  pdf.addImage(imgData2, 'PNG', margin + imgWidth + margin, yPosition, imgWidth, Math.min(imgHeight, 70));
                } catch (err) {
                  console.error('Chart capture error:', err);
                }
              }
              yPosition += Math.min(imgHeight, 70) + 10;
            } catch (err) {
              console.error('Chart capture error:', err);
            }
          }
          
          addText(`Total Issues Found: ${report.issues.length}`, 11, [239, 68, 68]);
          yPosition += 8;
          
          report.issues.forEach((issue: any) => {
            checkPageBreak(30);
            
            // Issue header
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            const severityColor: [number, number, number] = 
              issue.severity === 'Critical' ? [239, 68, 68] :
              issue.severity === 'High' ? [245, 158, 11] :
              issue.severity === 'Medium' ? [234, 179, 8] : [16, 185, 129];
            pdf.setTextColor(...severityColor);
            pdf.text(`${issue.severity}: ${issue.category}`, margin, yPosition);
            yPosition += 6;
            
            // Description
            pdf.setFontSize(9);
            pdf.setTextColor(60, 60, 60);
            pdf.setFont('helvetica', 'normal');
            const descLines = pdf.splitTextToSize(issue.description, pageWidth - 2 * margin);
            descLines.forEach((line: string) => {
              checkPageBreak(5);
              pdf.text(line, margin, yPosition);
              yPosition += 4;
            });
            yPosition += 2;
            
            // Recommendation
            pdf.setTextColor(100, 100, 100);
            pdf.setFont('helvetica', 'italic');
            const recLines = pdf.splitTextToSize(`→ ${issue.recommendation}`, pageWidth - 2 * margin);
            recLines.forEach((line: string) => {
              checkPageBreak(5);
              pdf.text(line, margin, yPosition);
              yPosition += 4;
            });
            yPosition += 8;
          });
        }
        
        // ==================== FOOTER ON EACH PAGE ====================
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setTextColor(150, 150, 150);
          pdf.text(
            `BIM Health Report - ${sanitizeText(report?.projectName || 'Project')} - Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          );
        }
        
        // Save PDF
        const filename = `${sanitizeText(report?.projectName || 'BIM-Report')}_Complete_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(filename);
        
        alert('✅ Complete PDF exported successfully with all sections!');
        
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('❌ Failed to generate PDF. Please try again.');
      }
    } else {
      // Excel export
      try {
        const response = await fetch(`/api/report/${id}/export/excel`);
        
        if (!response.ok) {
          throw new Error('Failed to export to Excel');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${report?.projectName || 'report'}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error(`Error exporting to Excel:`, error);
        alert(`Failed to export to Excel`);
      }
    }
    
    setExporting(null);
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      Critical: 'bg-red-100 text-red-800 border-red-200',
      High: 'bg-orange-100 text-orange-800 border-orange-200',
      Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      Low: 'bg-green-100 text-green-800 border-green-200',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'elements', label: 'Elements', icon: Box },
    ...(report?.familyAnalysis ? [{ id: 'families', label: 'Families', icon: Layers }] : []),
    ...(report?.architecturalElements ? [{ id: 'architectural', label: 'Architectural', icon: Building2 }] : []),
    { id: 'mep', label: 'MEP', icon: Zap },
    { id: 'structural', label: 'Structural', icon: Building2 },
    { id: 'views', label: 'Views & Sheets', icon: FileType },
    { id: 'materials', label: 'Materials', icon: Lightbulb },
    { id: 'coordinates', label: 'Coordinates', icon: MapPin },
    ...(report?.groupDetails ? [{ id: 'groups', label: 'Groups', icon: Users }] : []),
    { id: 'levels', label: 'Levels & Grids', icon: Grid3x3 },
    { id: 'areas', label: 'Areas & Spaces', icon: Ruler },
    { id: 'performance', label: 'Performance', icon: Activity },
    { id: 'issues', label: 'Issues', icon: AlertTriangle },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Not Found</h2>
        <Link href="/dashboard" className="text-blue-600 hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Animated Header with Gradient */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl p-8 animate-slide-in-left">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="group p-3 bg-white/20 hover:bg-white/30 rounded-2xl transition-all duration-300 backdrop-blur-sm">
              <ArrowLeft className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
            </Link>
            <div className="animate-fade-in">
              <div className="flex items-center space-x-3 mb-2">
                <FileText className="w-10 h-10 text-white animate-float" />
                <h1 className="text-4xl font-bold text-white drop-shadow-lg">{report.projectName}</h1>
              </div>
              <p className="text-white/90 text-lg font-medium flex items-center space-x-4">
                <span className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>{new Date(report.generatedDate).toLocaleDateString()}</span>
                </span>
                <span className="text-white/60">•</span>
                <span>Revit {report.revitVersion}</span>
              </p>
            </div>
          </div>
          <div className="flex space-x-3 animate-slide-in-right">
            <button onClick={() => exportReport('pdf')} disabled={exporting === 'pdf'}
              className="group px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 flex items-center space-x-2">
              {exporting === 'pdf' ? (
                <div className="spinner w-5 h-5 border-2 border-white/30 border-t-white"></div>
              ) : <FileText className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
              <span>Export PDF</span>
            </button>
          </div>
        </div>
        {/* Animated Background Pattern */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse-slow" style={{animationDelay: '1s'}}></div>
      </div>

      {/* Enhanced Summary Cards with Stagger Animation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-600 text-white transform hover:scale-105" style={{animationDelay: '0.1s'}}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Overall Grade</span>
              </p>
              <p className="text-5xl font-bold drop-shadow-lg animate-bounce-in">{report.quality.overallGrade}</p>
              <p className="text-blue-100 text-xs mt-2">Model Quality Score</p>
            </div>
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm animate-float">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-br from-purple-500 to-purple-600 text-white transform hover:scale-105" style={{animationDelay: '0.2s'}}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium mb-1 flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Total Elements</span>
              </p>
              <p className="text-5xl font-bold drop-shadow-lg animate-bounce-in">
                {report.statistics.totalElements.toLocaleString()}
              </p>
              <p className="text-purple-100 text-xs mt-2">BIM Components</p>
            </div>
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm animate-float" style={{animationDelay: '0.5s'}}>
              <BarChart3 className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-br from-orange-500 to-orange-600 text-white transform hover:scale-105" style={{animationDelay: '0.3s'}}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium mb-1 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Issues Found</span>
              </p>
              <p className="text-5xl font-bold drop-shadow-lg animate-bounce-in">{report.issues.length}</p>
              <p className="text-orange-100 text-xs mt-2">Needs Attention</p>
            </div>
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm animate-float" style={{animationDelay: '1s'}}>
              <AlertTriangle className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-br from-green-500 to-green-600 text-white transform hover:scale-105" style={{animationDelay: '0.4s'}}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium mb-1 flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Performance</span>
              </p>
              <p className="text-4xl font-bold drop-shadow-lg animate-bounce-in">{report.performance.performanceRating}</p>
              <p className="text-green-100 text-xs mt-2">System Rating</p>
            </div>
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm animate-float" style={{animationDelay: '1.5s'}}>
              <Activity className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Tabs Navigation with Glass Effect */}
      <div className="glass-effect rounded-3xl p-3 shadow-2xl animate-slide-up">
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button ${
                  activeTab === tab.id
                    ? 'tab-button-active'
                    : 'tab-button-inactive'
                }`}
                style={{animationDelay: `${index * 0.05}s`}}
              >
                <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'animate-bounce-in' : ''}`} />
                <span className="font-semibold">{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-full animate-scale-in"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content with Enhanced Card */}
      <div className="card animate-fade-in">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Project Overview</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div id="overview-chart-1">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                  { name: 'Walls', value: report.statistics.walls },
                  { name: 'Floors', value: report.statistics.floors },
                  { name: 'Doors', value: report.statistics.doors },
                  { name: 'Windows', value: report.statistics.windows },
                  { name: 'Columns', value: report.statistics.columns },
                  { name: 'Beams', value: report.statistics.beams },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0ea5e9" />
                </BarChart>
                </ResponsiveContainer>
              </div>
              <div id="overview-chart-2">
                <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={[
                  { metric: 'Completeness', value: report.quality.modelCompleteness },
                  { metric: 'Accuracy', value: report.quality.geometricAccuracy },
                  { metric: 'Richness', value: report.quality.informationRichness },
                  { metric: 'Compliance', value: report.quality.compliance },
                  { metric: 'Performance', value: report.quality.performance },
                ]}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis domain={[0, 100]} />
                  <Radar dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
                  <Tooltip />
                </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-blue-600 font-medium text-sm">File Size</p>
                <p className="text-2xl font-bold text-blue-900">{report.performance.fileSize.toFixed(1)} MB</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <p className="text-purple-600 font-medium text-sm">Views</p>
                <p className="text-2xl font-bold text-purple-900">{report.statistics.views}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-green-600 font-medium text-sm">Families</p>
                <p className="text-2xl font-bold text-green-900">{report.statistics.families}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="text-orange-600 font-medium text-sm">Materials</p>
                <p className="text-2xl font-bold text-orange-900">{report.statistics.materials}</p>
              </div>
            </div>
          </div>
        )}

        {/* ELEMENTS TAB */}
        {activeTab === 'elements' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Element Statistics</h2>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="elements-chart-1">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Element Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={[
                      { name: 'Walls', value: report.statistics?.walls || 0 },
                      { name: 'Floors', value: report.statistics?.floors || 0 },
                      { name: 'Doors', value: report.statistics?.doors || 0 },
                      { name: 'Windows', value: report.statistics?.windows || 0 },
                      { name: 'Columns', value: report.statistics?.columns || 0 },
                      { name: 'Beams', value: report.statistics?.beams || 0 },
                    ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1,2,3,4,5].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="elements-chart-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Element Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Walls', value: report.statistics?.walls || 0 },
                    { name: 'Floors', value: report.statistics?.floors || 0 },
                    { name: 'Ceilings', value: report.statistics?.ceilings || 0 },
                    { name: 'Doors', value: report.statistics?.doors || 0 },
                    { name: 'Windows', value: report.statistics?.windows || 0 },
                    { name: 'Rooms', value: report.statistics?.rooms || 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Walls</p><p className="text-2xl font-bold text-gray-900">{report.statistics?.walls || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Floors</p><p className="text-2xl font-bold text-gray-900">{report.statistics?.floors || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Ceilings</p><p className="text-2xl font-bold text-gray-900">{report.statistics?.ceilings || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Doors</p><p className="text-2xl font-bold text-gray-900">{report.statistics?.doors || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Windows</p><p className="text-2xl font-bold text-gray-900">{report.statistics?.windows || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Columns</p><p className="text-2xl font-bold text-gray-900">{report.statistics?.columns || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Beams</p><p className="text-2xl font-bold text-gray-900">{report.statistics?.beams || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Rooms</p><p className="text-2xl font-bold text-gray-900">{report.statistics?.rooms || 0}</p></div>
            </div>
            
            {report.annotationElements && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mt-6">Annotation Elements</h3>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { name: 'Dimensions', value: report.annotationElements.dimensions || 0 },
                      { name: 'Text Notes', value: report.annotationElements.textNotes || 0 },
                      { name: 'Tags', value: report.annotationElements.tags || 0 },
                      { name: 'Detail Lines', value: report.annotationElements.detailLines || 0 },
                      { name: 'Filled Regions', value: report.annotationElements.filledRegions || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                  <div className="stat-card"><p className="text-gray-600 text-sm">Dimensions</p><p className="text-2xl font-bold text-gray-900">{report.annotationElements.dimensions || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Text Notes</p><p className="text-2xl font-bold text-gray-900">{report.annotationElements.textNotes || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Tags</p><p className="text-2xl font-bold text-gray-900">{report.annotationElements.tags || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Detail Lines</p><p className="text-2xl font-bold text-gray-900">{report.annotationElements.detailLines || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Filled Regions</p><p className="text-2xl font-bold text-gray-900">{report.annotationElements.filledRegions || 0}</p></div>
                </div>
              </>
            )}
          </div>
        )}

        {/* FAMILIES TAB */}
        {activeTab === 'families' && report.familyAnalysis && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Family Analysis</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {report.familyAnalysis.familySizeDistribution && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Size Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <RePieChart>
                      <Pie data={[
                        { name: 'Small (<100KB)', value: report.familyAnalysis.familySizeDistribution.small || 0 },
                        { name: 'Medium (100-500KB)', value: report.familyAnalysis.familySizeDistribution.medium || 0 },
                        { name: 'Large (500KB-1MB)', value: report.familyAnalysis.familySizeDistribution.large || 0 },
                        { name: 'Very Large (>1MB)', value: report.familyAnalysis.familySizeDistribution.veryLarge || 0 },
                      ]} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                        {[0,1,2,3].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {report.familyAnalysis.familyUsageFrequency && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Usage Frequency</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { name: 'High (>50)', value: report.familyAnalysis.familyUsageFrequency.highUsage || 0 },
                      { name: 'Medium (10-50)', value: report.familyAnalysis.familyUsageFrequency.mediumUsage || 0 },
                      { name: 'Low (1-10)', value: report.familyAnalysis.familyUsageFrequency.lowUsage || 0 },
                      { name: 'Unused (0)', value: report.familyAnalysis.familyUsageFrequency.unused || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            {report.familyAnalysis.topFamilies && report.familyAnalysis.topFamilies.length > 0 && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mt-6">Top Families</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Family Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Instances</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size (KB)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {report.familyAnalysis.topFamilies.map((family: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{family.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{family.instances}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{family.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ARCHITECTURAL TAB */}
        {activeTab === 'architectural' && report.architecturalElements && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Architectural Elements</h2>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Architectural Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={[
                      { name: 'Walls', value: report.architecturalElements.walls || 0 },
                      { name: 'Doors', value: report.architecturalElements.doors || 0 },
                      { name: 'Windows', value: report.architecturalElements.windows || 0 },
                      { name: 'Floors', value: report.architecturalElements.floors || 0 },
                      { name: 'Roofs', value: report.architecturalElements.roofs || 0 },
                      { name: 'Stairs', value: report.architecturalElements.stairs || 0 },
                    ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1,2,3,4,5].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Element Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(report.architecturalElements)
                    .filter(([_, value]) => (value as number) > 0)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .slice(0, 10)
                    .map(([name, value]) => ({ name, value: value as number }))
                  }>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats Cards - Top Elements */}
            <h3 className="text-xl font-bold text-gray-900">Key Elements</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Walls</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.walls || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Doors</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.doors || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Windows</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.windows || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Floors</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.floors || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Roofs</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.roofs || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Ceilings</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.ceilings || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Stairs</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.stairs || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Railings</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.railings || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Columns</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.columns || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Furniture</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.furniture || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Casework</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.casework || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Generic Models</p><p className="text-2xl font-bold text-gray-900">{report.architecturalElements.genericModels || 0}</p></div>
            </div>

            {/* Complete Table */}
            <h3 className="text-xl font-bold text-gray-900">All Architectural Elements</h3>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Element Type</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.architecturalElements)
                    .filter(([_, value]) => (value as number) > 0)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">{value as number}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MEP TAB */}
        {activeTab === 'mep' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">MEP Elements (20 Types)</h2>
            
            {!report.mepElements && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <Zap className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">No MEP Data Available</h3>
                <p className="text-yellow-700">This project does not contain MEP elements or the data was not captured during report generation.</p>
              </div>
            )}
            
            {report.mepElements && (
              <>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="mep-chart-1">
                <h3 className="text-lg font-bold text-gray-900 mb-4">MEP Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={Object.entries(report.mepElements)
                      .filter(([_, value]) => (value as number) > 0)
                      .slice(0, 6)
                      .map(([name, value]) => ({ name, value: value as number }))
                    } cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1,2,3,4,5].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="mep-chart-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4">MEP Systems Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(report.mepElements)
                    .filter(([_, value]) => (value as number) > 0)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .slice(0, 10)
                    .map(([name, value]) => ({ name, value: value as number }))
                  }>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats Cards - HVAC */}
            <h3 className="text-xl font-bold text-gray-900">HVAC Systems</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Ducts</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.ducts || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Air Terminals</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.airTerminals || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Mechanical Equipment</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.mechanicalEquipment || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Mechanical Controls</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.mechanicalControlDevices || 0}</p></div>
            </div>

            {/* Plumbing */}
            <h3 className="text-xl font-bold text-gray-900">Plumbing Systems</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Pipes</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.pipes || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Plumbing Fixtures</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.plumbingFixtures || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Sprinklers</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.sprinklers || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Fire Alarm Devices</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.fireAlarmDevices || 0}</p></div>
            </div>

            {/* Electrical */}
            <h3 className="text-xl font-bold text-gray-900">Electrical Systems</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Conduits</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.conduits || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Cable Trays</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.cableTrays || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Wire</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.wire || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Electrical Equipment</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.electricalEquipment || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Electrical Fixtures</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.electricalFixtures || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Lighting Fixtures</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.lightingFixtures || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Lighting Devices</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.lightingDevices || 0}</p></div>
            </div>

            {/* Communication & Security */}
            <h3 className="text-xl font-bold text-gray-900">Communication & Security</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Data Devices</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.dataDevices || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Communication Devices</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.communicationDevices || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Security Devices</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.securityDevices || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Telephone Devices</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.telephoneDevices || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Nurse Call Devices</p><p className="text-2xl font-bold text-gray-900">{report.mepElements.nurseCallDevices || 0}</p></div>
            </div>

            {/* Complete Table */}
            <h3 className="text-xl font-bold text-gray-900">All MEP Elements</h3>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Element Type</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.mepElements)
                    .filter(([_, value]) => (value as number) > 0)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">{value as number}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            
            {report.mepSystemFamilies && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mt-6">MEP System Families</h3>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { name: 'Duct Types', value: report.mepSystemFamilies.ductTypes || 0 },
                      { name: 'Pipe Types', value: report.mepSystemFamilies.pipeTypes || 0 },
                      { name: 'Cable Tray', value: report.mepSystemFamilies.cableTrayTypes || 0 },
                      { name: 'Conduit', value: report.mepSystemFamilies.conduitTypes || 0 },
                      { name: 'Lighting', value: report.mepSystemFamilies.lightingFixtureTypes || 0 },
                      { name: 'Spaces', value: report.mepSystemFamilies.spaceTypes || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  <div className="stat-card"><p className="text-gray-600 text-sm">Duct Types</p><p className="text-2xl font-bold text-gray-900">{report.mepSystemFamilies.ductTypes || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Pipe Types</p><p className="text-2xl font-bold text-gray-900">{report.mepSystemFamilies.pipeTypes || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Cable Tray Types</p><p className="text-2xl font-bold text-gray-900">{report.mepSystemFamilies.cableTrayTypes || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Conduit Types</p><p className="text-2xl font-bold text-gray-900">{report.mepSystemFamilies.conduitTypes || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Lighting Fixture Types</p><p className="text-2xl font-bold text-gray-900">{report.mepSystemFamilies.lightingFixtureTypes || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Space Types</p><p className="text-2xl font-bold text-gray-900">{report.mepSystemFamilies.spaceTypes || 0}</p></div>
                </div>
              </>
            )}
              </>
            )}
          </div>
        )}

        {/* STRUCTURAL TAB */}
        {activeTab === 'structural' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Structural Elements (9 Types)</h2>
            
            {!report.structuralElements && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <Building2 className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Structural Data Available</h3>
                <p className="text-yellow-700">This project does not contain structural elements or the data was not captured during report generation.</p>
              </div>
            )}
            
            {report.structuralElements && (
              <>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="structural-chart-1">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Structural Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={Object.entries(report.structuralElements)
                      .filter(([_, value]) => (value as number) > 0)
                      .map(([name, value]) => ({ name, value: value as number }))
                    } cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1,2,3,4,5,6,7,8].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="structural-chart-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Structural Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(report.structuralElements)
                    .filter(([_, value]) => (value as number) > 0)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([name, value]) => ({ name, value: value as number }))
                  }>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats Cards - All 9 Types */}
            <h3 className="text-xl font-bold text-gray-900">Structural Components</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Structural Columns</p><p className="text-2xl font-bold text-gray-900">{report.structuralElements.structuralColumns || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Structural Framing</p><p className="text-2xl font-bold text-gray-900">{report.structuralElements.structuralFraming || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Foundations</p><p className="text-2xl font-bold text-gray-900">{report.structuralElements.structuralFoundations || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Structural Trusses</p><p className="text-2xl font-bold text-gray-900">{report.structuralElements.structuralTrusses || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Rebar</p><p className="text-2xl font-bold text-gray-900">{report.structuralElements.rebar || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Fabric Reinforcement</p><p className="text-2xl font-bold text-gray-900">{report.structuralElements.fabricReinforcement || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Connections</p><p className="text-2xl font-bold text-gray-900">{report.structuralElements.structuralConnections || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Stiffeners</p><p className="text-2xl font-bold text-gray-900">{report.structuralElements.structuralStiffeners || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Fabrication Parts</p><p className="text-2xl font-bold text-gray-900">{report.structuralElements.fabricationParts || 0}</p></div>
            </div>

            {/* Complete Table */}
            <h3 className="text-xl font-bold text-gray-900">All Structural Elements</h3>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Element Type</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.structuralElements)
                    .filter(([_, value]) => (value as number) > 0)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">{value as number}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            
            {report.structuralSystemFamilies && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mt-6">Structural System Families</h3>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { name: 'Column Types', value: report.structuralSystemFamilies.structuralColumnTypes || 0 },
                      { name: 'Framing Types', value: report.structuralSystemFamilies.structuralFramingTypes || 0 },
                      { name: 'Foundation Types', value: report.structuralSystemFamilies.structuralFoundationTypes || 0 },
                      { name: 'Rebar Types', value: report.structuralSystemFamilies.rebarTypes || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="stat-card"><p className="text-gray-600 text-sm">Column Types</p><p className="text-2xl font-bold text-gray-900">{report.structuralSystemFamilies.structuralColumnTypes || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Framing Types</p><p className="text-2xl font-bold text-gray-900">{report.structuralSystemFamilies.structuralFramingTypes || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Foundation Types</p><p className="text-2xl font-bold text-gray-900">{report.structuralSystemFamilies.structuralFoundationTypes || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Rebar Types</p><p className="text-2xl font-bold text-gray-900">{report.structuralSystemFamilies.rebarTypes || 0}</p></div>
                </div>
              </>
            )}
              </>
            )}
          </div>
        )}

        {/* VIEWS TAB */}
        {activeTab === 'views' && report.viewDetails && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Views & Sheets</h2>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="views-chart-1">
                <h3 className="text-lg font-bold text-gray-900 mb-4">View Types Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={[
                      { name: 'Floor Plans', value: report.viewDetails.floorPlans || 0 },
                      { name: 'Ceiling Plans', value: report.viewDetails.ceilingPlans || 0 },
                      { name: 'Elevations', value: report.viewDetails.elevations || 0 },
                      { name: 'Sections', value: report.viewDetails.sections || 0 },
                      { name: '3D Views', value: report.viewDetails.threeD || 0 },
                      { name: 'Schedules', value: report.viewDetails.schedules || 0 },
                    ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1,2,3,4,5].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="views-chart-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4">View Count Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Floor Plans', value: report.viewDetails.floorPlans || 0 },
                    { name: 'Elevations', value: report.viewDetails.elevations || 0 },
                    { name: 'Sections', value: report.viewDetails.sections || 0 },
                    { name: '3D Views', value: report.viewDetails.threeD || 0 },
                    { name: 'Schedules', value: report.viewDetails.schedules || 0 },
                    { name: 'Drafting', value: report.viewDetails.draftingViews || 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Floor Plans</p><p className="text-2xl font-bold text-gray-900">{report.viewDetails.floorPlans || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Ceiling Plans</p><p className="text-2xl font-bold text-gray-900">{report.viewDetails.ceilingPlans || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Elevations</p><p className="text-2xl font-bold text-gray-900">{report.viewDetails.elevations || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Sections</p><p className="text-2xl font-bold text-gray-900">{report.viewDetails.sections || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">3D Views</p><p className="text-2xl font-bold text-gray-900">{report.viewDetails.threeD || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Schedules</p><p className="text-2xl font-bold text-gray-900">{report.viewDetails.schedules || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Drafting Views</p><p className="text-2xl font-bold text-gray-900">{report.viewDetails.draftingViews || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Detail Views</p><p className="text-2xl font-bold text-gray-900">{report.viewDetails.detailViews || 0}</p></div>
            </div>
            
            {report.sheetDetails && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mt-6">Sheet Details</h3>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[
                      { name: 'Total Sheets', value: report.sheetDetails.totalSheets || 0 },
                      { name: 'With Views', value: report.sheetDetails.sheetsWithViews || 0 },
                      { name: 'Empty', value: report.sheetDetails.emptySheets || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ec4899" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="stat-card"><p className="text-gray-600 text-sm">Total Sheets</p><p className="text-2xl font-bold text-gray-900">{report.sheetDetails.totalSheets || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Sheets with Views</p><p className="text-2xl font-bold text-green-600">{report.sheetDetails.sheetsWithViews || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Empty Sheets</p><p className="text-2xl font-bold text-orange-600">{report.sheetDetails.emptySheets || 0}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Avg Views/Sheet</p><p className="text-2xl font-bold text-blue-600">{(report.sheetDetails.averageViewsPerSheet || 0).toFixed(1)}</p></div>
                </div>
              </>
            )}
          </div>
        )}

        {/* MATERIALS TAB */}
        {activeTab === 'materials' && report.materialDetails && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Materials Analysis</h2>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="materials-chart-1">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Material Properties Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={[
                      { name: 'With Appearance', value: report.materialDetails.materialsWithAppearance || 0 },
                      { name: 'With Thermal', value: report.materialDetails.materialsWithThermal || 0 },
                      { name: 'With Physical', value: report.materialDetails.materialsWithPhysical || 0 },
                      { name: 'Basic Only', value: Math.max(0, (report.materialDetails.totalMaterials || 0) - (report.materialDetails.materialsWithAppearance || 0)) },
                    ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1,2,3].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="materials-chart-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Material Quality Metrics</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Total Materials', value: report.materialDetails.totalMaterials || 0 },
                    { name: 'With Appearance', value: report.materialDetails.materialsWithAppearance || 0 },
                    { name: 'With Thermal', value: report.materialDetails.materialsWithThermal || 0 },
                    { name: 'With Physical', value: report.materialDetails.materialsWithPhysical || 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Total Materials</p><p className="text-2xl font-bold text-gray-900">{report.materialDetails.totalMaterials}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">With Appearance</p><p className="text-2xl font-bold text-green-600">{report.materialDetails.materialsWithAppearance}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">With Thermal</p><p className="text-2xl font-bold text-blue-600">{report.materialDetails.materialsWithThermal}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">With Physical</p><p className="text-2xl font-bold text-purple-600">{report.materialDetails.materialsWithPhysical}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Duplicates</p><p className="text-2xl font-bold text-orange-600">{report.materialDetails.duplicateMaterials || 0}</p></div>
            </div>
          </div>
        )}

        {/* COORDINATES TAB */}
        {activeTab === 'coordinates' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Coordinate System & Linked Files</h2>
            
            {/* Coordinate Info Cards */}
            {report.coordinateSystemDetails && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-900">Project Coordinates</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <p className="text-blue-600 font-medium mb-2">Project Base Point</p>
                    <p className="text-lg text-blue-900">{report.coordinateSystemDetails.projectBasePoint || 'Not Available'}</p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                    <p className="text-purple-600 font-medium mb-2">Survey Point</p>
                    <p className="text-lg text-purple-900">{report.coordinateSystemDetails.surveyPoint || 'Not Available'}</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <p className="text-green-600 font-medium mb-2">True North Angle</p>
                    <p className="text-lg text-green-900">{report.coordinateSystemDetails.trueNorthAngle || 'Not Available'}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Linked Files Charts - Always show */}
            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Linked Files Analysis</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Linked Files Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie data={[
                        { name: 'Revit Links', value: report.linkedRevitFiles || 0 },
                        { name: 'CAD Links', value: report.linkedCADFiles || 0 },
                      ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                        <Cell fill="#0ea5e9" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Linked Files Comparison</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { name: 'Revit Links', value: report.linkedRevitFiles || 0 },
                      { name: 'CAD Links', value: report.linkedCADFiles || 0 },
                      { name: 'Total Links', value: (report.linkedRevitFiles || 0) + (report.linkedCADFiles || 0) },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="stat-card">
                  <p className="text-gray-600 text-sm">Revit Links</p>
                  <p className="text-2xl font-bold text-blue-600">{report.linkedRevitFiles || 0}</p>
                </div>
                <div className="stat-card">
                  <p className="text-gray-600 text-sm">CAD Links</p>
                  <p className="text-2xl font-bold text-orange-600">{report.linkedCADFiles || 0}</p>
                </div>
                <div className="stat-card">
                  <p className="text-gray-600 text-sm">Total Links</p>
                  <p className="text-2xl font-bold text-gray-900">{(report.linkedRevitFiles || 0) + (report.linkedCADFiles || 0)}</p>
                </div>
                <div className="stat-card">
                  <p className="text-gray-600 text-sm">Worksets</p>
                  <p className="text-2xl font-bold text-purple-600">{report.worksetCount || 0}</p>
                </div>
              </div>
            </div>
            
            {/* Project Info */}
            {report.projectInfo && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Project Information</h3>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-600 text-sm">Worksets</p>
                      <p className="text-lg font-bold text-gray-900">{report.worksetCount || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-sm">Design Options</p>
                      <p className="text-lg font-bold text-gray-900">{report.designOptionsCount || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GROUPS TAB */}
        {activeTab === 'groups' && report.groupDetails && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Groups & Assemblies</h2>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="groups-chart-1">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Groups Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={[
                      { name: 'Model Groups', value: report.groupDetails.modelGroups || 0 },
                      { name: 'Detail Groups', value: report.groupDetails.detailGroups || 0 },
                      { name: 'Model Types', value: report.groupDetails.modelGroupTypes || 0 },
                      { name: 'Detail Types', value: report.groupDetails.detailGroupTypes || 0 },
                    ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1,2,3].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="groups-chart-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Groups Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Model Groups', value: report.groupDetails.modelGroups || 0 },
                    { name: 'Detail Groups', value: report.groupDetails.detailGroups || 0 },
                    { name: 'Model Types', value: report.groupDetails.modelGroupTypes || 0 },
                    { name: 'Detail Types', value: report.groupDetails.detailGroupTypes || 0 },
                    { name: 'Unused Types', value: report.groupDetails.unusedGroupTypes || 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ec4899" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Model Groups</p><p className="text-2xl font-bold text-blue-600">{report.groupDetails.modelGroups || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Detail Groups</p><p className="text-2xl font-bold text-green-600">{report.groupDetails.detailGroups || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Model Group Types</p><p className="text-2xl font-bold text-purple-600">{report.groupDetails.modelGroupTypes || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Detail Group Types</p><p className="text-2xl font-bold text-orange-600">{report.groupDetails.detailGroupTypes || 0}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Unused Types</p><p className="text-2xl font-bold text-red-600">{report.groupDetails.unusedGroupTypes || 0}</p></div>
            </div>
          </div>
        )}

        {/* LEVELS TAB */}
        {activeTab === 'levels' && report.levelsAndGrids && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Levels & Grids</h2>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="levels-chart-1">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Levels & Grids Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={[
                      { name: 'Total Levels', value: report.levelsAndGrids.levels || 0 },
                      { name: 'Total Grids', value: report.levelsAndGrids.grids || 0 },
                      { name: 'Structural Levels', value: report.levelsAndGrids.structuralLevels || 0 },
                      { name: 'Building Story', value: report.levelsAndGrids.buildingStoryLevels || 0 },
                    ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1,2,3].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="levels-chart-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Level & Grid Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Levels', value: report.levelsAndGrids.levels || 0 },
                    { name: 'Grids', value: report.levelsAndGrids.grids || 0 },
                    { name: 'Named Levels', value: report.levelsAndGrids.namedLevels || 0 },
                    { name: 'Named Grids', value: report.levelsAndGrids.namedGrids || 0 },
                    { name: 'Structural', value: report.levelsAndGrids.structuralLevels || 0 },
                    { name: 'Building Story', value: report.levelsAndGrids.buildingStoryLevels || 0 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Total Levels</p><p className="text-2xl font-bold text-gray-900">{report.levelsAndGrids.levels}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Total Grids</p><p className="text-2xl font-bold text-gray-900">{report.levelsAndGrids.grids}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Named Levels</p><p className="text-2xl font-bold text-green-600">{report.levelsAndGrids.namedLevels}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Named Grids</p><p className="text-2xl font-bold text-green-600">{report.levelsAndGrids.namedGrids}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Structural Levels</p><p className="text-2xl font-bold text-blue-600">{report.levelsAndGrids.structuralLevels}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Building Story</p><p className="text-2xl font-bold text-blue-600">{report.levelsAndGrids.buildingStoryLevels}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Duplicate Elevations</p><p className="text-2xl font-bold text-orange-600">{report.levelsAndGrids.duplicateElevations || 0}</p></div>
            </div>
          </div>
        )}

        {/* AREAS TAB */}
        {activeTab === 'areas' && report.areasDetails && report.spacesDetails && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Areas & Spaces</h2>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="areas-chart-1">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Areas Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={[
                      { name: 'Placed Areas', value: report.areasDetails.placedAreas || 0 },
                      { name: 'Unplaced Areas', value: report.areasDetails.unplacedAreas || 0 },
                    ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1].map((i) => <Cell key={`cell-${i}`} fill={i === 0 ? '#10b981' : '#f59e0b'} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="areas-chart-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Spaces Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie data={[
                      { name: 'Placed Spaces', value: report.spacesDetails.placedSpaces || 0 },
                      { name: 'Unplaced Spaces', value: report.spacesDetails.unplacedSpaces || 0 },
                    ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                      {[0,1].map((i) => <Cell key={`cell-${i}`} fill={i === 0 ? '#0ea5e9' : '#ef4444'} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Areas Stats */}
            <h3 className="text-lg font-bold text-gray-900">Areas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Total Areas</p><p className="text-2xl font-bold text-gray-900">{report.areasDetails.totalAreas}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Placed Areas</p><p className="text-2xl font-bold text-green-600">{report.areasDetails.placedAreas}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Unplaced Areas</p><p className="text-2xl font-bold text-orange-600">{report.areasDetails.unplacedAreas}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Area Schemes</p><p className="text-2xl font-bold text-blue-600">{report.areasDetails.areaSchemes}</p></div>
            </div>
            
            {/* Spaces Stats */}
            <h3 className="text-lg font-bold text-gray-900 mt-6">Spaces</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Total Spaces</p><p className="text-2xl font-bold text-gray-900">{report.spacesDetails.totalSpaces}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Placed Spaces</p><p className="text-2xl font-bold text-green-600">{report.spacesDetails.placedSpaces}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Unplaced Spaces</p><p className="text-2xl font-bold text-orange-600">{report.spacesDetails.unplacedSpaces}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Conditioned</p><p className="text-2xl font-bold text-blue-600">{report.spacesDetails.conditionedSpaces || 0}</p></div>
            </div>
            
            {/* Combined Comparison Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6" id="areas-chart-3">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Areas vs Spaces Comparison</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { name: 'Total Areas', value: report.areasDetails.totalAreas || 0 },
                  { name: 'Placed Areas', value: report.areasDetails.placedAreas || 0 },
                  { name: 'Total Spaces', value: report.spacesDetails.totalSpaces || 0 },
                  { name: 'Placed Spaces', value: report.spacesDetails.placedSpaces || 0 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ec4899" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Performance Analysis</h2>
            
            {/* Basic Performance Stats - Always show */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card">
                <p className="text-gray-600 text-sm">File Size</p>
                <p className="text-2xl font-bold text-gray-900">{report.performance?.fileSize?.toFixed(1) || report.statistics?.modelSize?.toFixed(1) || 0} MB</p>
              </div>
              <div className="stat-card">
                <p className="text-gray-600 text-sm">View Count</p>
                <p className="text-2xl font-bold text-gray-900">{report.performance?.viewCount || report.statistics?.views || 0}</p>
              </div>
              <div className="stat-card">
                <p className="text-gray-600 text-sm">Total Elements</p>
                <p className="text-2xl font-bold text-gray-900">{report.statistics?.totalElements?.toLocaleString() || 0}</p>
              </div>
              <div className="stat-card">
                <p className="text-gray-600 text-sm">Performance Rating</p>
                <p className="text-2xl font-bold text-green-600">{report.performance?.performanceRating || 'Good'}</p>
              </div>
            </div>

            {/* Detailed Performance - Only if data available */}
            {report.memoryUsage && report.fileSizeBreakdown ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Memory Usage</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <RePieChart>
                      <Pie data={[
                        { name: 'Geometry', value: report.memoryUsage.geometry },
                        { name: 'Families', value: report.memoryUsage.families },
                        { name: 'Materials', value: report.memoryUsage.materials },
                        { name: 'Views', value: report.memoryUsage.views },
                        { name: 'System', value: report.memoryUsage.system },
                      ]} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                        {[0,1,2,3,4].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">File Size Breakdown</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <RePieChart>
                      <Pie data={[
                        { name: 'Families', value: report.fileSizeBreakdown.families },
                        { name: 'Geometry', value: report.fileSizeBreakdown.geometry },
                        { name: 'Materials', value: report.fileSizeBreakdown.materials },
                        { name: 'Views', value: report.fileSizeBreakdown.views },
                        { name: 'Other', value: report.fileSizeBreakdown.other },
                      ]} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                        {[0,1,2,3,4].map((i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Model Size:</span>
                    <span className="font-bold">{report.performance?.fileSize?.toFixed(1) || report.statistics?.modelSize?.toFixed(1) || 0} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total Views:</span>
                    <span className="font-bold">{report.statistics?.views || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Total Families:</span>
                    <span className="font-bold">{report.statistics?.families || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Unused Families:</span>
                    <span className="font-bold">{report.performance?.unusedFamilies || 0}</span>
                  </div>
                </div>
              </div>
            )}
            
            {report.renderingPerformance && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mt-6">Rendering Performance (seconds)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="stat-card"><p className="text-gray-600 text-sm">Simple Views</p><p className="text-2xl font-bold text-green-600">{report.renderingPerformance.simpleViews}s</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Detailed Views</p><p className="text-2xl font-bold text-blue-600">{report.renderingPerformance.detailedViews}s</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">3D Views</p><p className="text-2xl font-bold text-orange-600">{report.renderingPerformance.threeD}s</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Rendered</p><p className="text-2xl font-bold text-red-600">{report.renderingPerformance.rendered}s</p></div>
                </div>
              </>
            )}
            
            {report.performanceDetails && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mt-6">Model Performance</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="stat-card"><p className="text-gray-600 text-sm">Elements per MB</p><p className="text-2xl font-bold text-gray-900">{report.performanceDetails.elementsPerMB}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Avg Element Size</p><p className="text-2xl font-bold text-gray-900">{report.performanceDetails.averageElementSize} KB</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Complexity</p><p className="text-2xl font-bold text-gray-900">{report.performanceDetails.modelComplexity}</p></div>
                  <div className="stat-card"><p className="text-gray-600 text-sm">Load Time</p><p className="text-2xl font-bold text-gray-900">{report.performanceDetails.estimatedLoadTime}</p></div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ISSUES TAB */}
        {activeTab === 'issues' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Issues & Recommendations</h2>
            
            {/* Charts Section */}
            {report.issues && report.issues.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="issues-chart-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Issues by Severity</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie data={[
                        { name: 'Critical', value: report.issues.filter((i: any) => i.severity === 'Critical').length },
                        { name: 'High', value: report.issues.filter((i: any) => i.severity === 'High').length },
                        { name: 'Medium', value: report.issues.filter((i: any) => i.severity === 'Medium').length },
                        { name: 'Low', value: report.issues.filter((i: any) => i.severity === 'Low').length },
                      ]} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                        <Cell fill="#ef4444" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#eab308" />
                        <Cell fill="#10b981" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id="issues-chart-2">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Issues by Category</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={
                      Object.entries(
                        report.issues.reduce((acc: any, issue: any) => {
                          acc[issue.category] = (acc[issue.category] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([name, value]) => ({ name, value })).slice(0, 6)
                    }>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            {!report.issues || report.issues.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-xl text-gray-600">No issues detected! Model is in excellent condition.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {report.issues.map((issue: any, index: number) => (
                  <div key={index} className={`border rounded-lg p-5 ${getSeverityColor(issue.severity)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="font-bold text-lg">{issue.category}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSeverityColor(issue.severity)}`}>
                            {issue.severity}
                          </span>
                          <span className="text-sm font-medium">Count: {issue.count}</span>
                        </div>
                        <p className="text-gray-700 mb-2">{issue.description}</p>
                        <p className="text-sm font-medium text-gray-800">
                          💡 Recommendation: {issue.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <h3 className="text-xl font-bold text-gray-900 mt-8">Quality Recommendations</h3>
            {report.quality?.recommendations && report.quality.recommendations.length > 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <ul className="space-y-2">
                  {report.quality.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-800">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <p className="text-gray-600">No recommendations available</p>
              </div>
            )}
          </div>
        )}

        {/* DETAILS TAB */}
        {activeTab === 'details' && report.projectInfo && report.archSystemFamilies && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Project Details</h2>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Project Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><p className="text-gray-600 text-sm">Project Name</p><p className="text-lg font-bold text-gray-900">{report.projectInfo.projectName}</p></div>
                <div><p className="text-gray-600 text-sm">Project Number</p><p className="text-lg font-bold text-gray-900">{report.projectInfo.projectNumber}</p></div>
                <div><p className="text-gray-600 text-sm">Client Name</p><p className="text-lg font-bold text-gray-900">{report.projectInfo.clientName}</p></div>
                <div><p className="text-gray-600 text-sm">Issue Date</p><p className="text-lg font-bold text-gray-900">{report.projectInfo.issueDate}</p></div>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mt-6">Architectural System Families</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="stat-card"><p className="text-gray-600 text-sm">Wall Types</p><p className="text-xl font-bold text-gray-900">{report.archSystemFamilies.wallTypes}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Floor Types</p><p className="text-xl font-bold text-gray-900">{report.archSystemFamilies.floorTypes}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Ceiling Types</p><p className="text-xl font-bold text-gray-900">{report.archSystemFamilies.ceilingTypes}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Roof Types</p><p className="text-xl font-bold text-gray-900">{report.archSystemFamilies.roofTypes}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Stair Types</p><p className="text-xl font-bold text-gray-900">{report.archSystemFamilies.stairTypes}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Railing Types</p><p className="text-xl font-bold text-gray-900">{report.archSystemFamilies.railingTypes}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Curtain Wall</p><p className="text-xl font-bold text-gray-900">{report.archSystemFamilies.curtainWallTypes}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Door Types</p><p className="text-xl font-bold text-gray-900">{report.archSystemFamilies.doorTypes}</p></div>
              <div className="stat-card"><p className="text-gray-600 text-sm">Window Types</p><p className="text-xl font-bold text-gray-900">{report.archSystemFamilies.windowTypes}</p></div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}