import * as cheerio from 'cheerio';

export interface BIMReportData {
  projectName: string;
  projectPath: string;
  generatedDate: string;
  revitVersion: string;
  overallGrade: string;
  
  // Basic Statistics
  statistics: {
    totalElements: number;
    walls: number;
    floors: number;
    ceilings: number;
    doors: number;
    windows: number;
    columns: number;
    beams: number;
    rooms: number;
    spaces: number;
    views: number;
    sheets: number;
    families: number;
    materials: number;
    modelSize: number;
  };
  
  // MEP Elements
  mepElements?: {
    ducts?: number;
    pipes?: number;
    electricalFixtures?: number;
    lightingFixtures?: number;
    plumbingFixtures?: number;
    hvacEquipment?: number;
  };
  
  // Structural Elements
  structuralElements?: {
    structuralColumns?: number;
    structuralFraming?: number;
    structuralFoundations?: number;
    rebar?: number;
    structuralConnections?: number;
  };
  
  // Annotation Elements
  annotationElements?: {
    dimensions?: number;
    textNotes?: number;
    tags?: number;
    detailLines?: number;
    filledRegions?: number;
  };
  
  // View Details
  viewDetails?: {
    floorPlans?: number;
    ceilingPlans?: number;
    elevations?: number;
    sections?: number;
    threeD?: number;
    schedules?: number;
    draftingViews?: number;
    detailViews?: number;
  };
  
  // Sheet Details
  sheetDetails?: {
    totalSheets?: number;
    sheetsWithViews?: number;
    emptySheets?: number;
    averageViewsPerSheet?: number;
  };
  
  // Material Details
  materialDetails?: {
    totalMaterials?: number;
    materialsWithAppearance?: number;
    materialsWithThermal?: number;
    materialsWithPhysical?: number;
  };
  
  // Project Info
  projectInfo?: Record<string, string>;
  worksetCount?: number;
  designOptionsCount?: number;
  linkedRevitFiles?: number;
  linkedCADFiles?: number;
  
  // Levels and Grids
  levelsAndGrids?: Record<string, number>;
  
  // Areas and Spaces
  areasDetails?: Record<string, number>;
  spacesDetails?: Record<string, number>;
  
  // System Families
  archSystemFamilies?: Record<string, number>;
  mepSystemFamilies?: Record<string, number>;
  structuralSystemFamilies?: Record<string, number>;
  
  // Family Details
  familyDetails?: Record<string, any>;
  
  // Issues
  issues: Array<{
    category: string;
    severity: string;
    description: string;
    count: number;
    recommendation: string;
    elementIds?: string[];
  }>;
  
  // Warnings
  warnings?: Array<{
    description: string;
    category: string;
    elementIds?: string[];
  }>;
  
  // Performance
  performance: {
    rating: string;
    fileSize: number;
    viewCount: number;
    unusedFamilies: number;
    duplicateElements?: number;
    complexGeometry?: number;
  };
  
  // Quality
  quality: {
    completeness: number;
    accuracy: number;
    richness: number;
    overallGrade?: string;
    recommendations?: string[];
  };
  
  // Performance Details
  performanceDetails?: Record<string, any>;
  
  // Coordinate System
  coordinateSystemDetails?: Record<string, any>;
  
  // Groups
  groupDetails?: Record<string, any>;
}

export function parseHTMLReport(htmlContent: string): any {
  const $ = cheerio.load(htmlContent);
  
  // DEBUG: Log HTML structure
  console.log('🔍 HTML PARSER DEBUG:');
  console.log('  HTML length:', htmlContent.length);
  console.log('  Has h1:', $('h1').length);
  console.log('  Has .grade:', $('.grade').length);
  console.log('  Has script tags:', $('script').length);
  console.log('  Has .statCard:', $('.statCard').length);
  
  // Extract basic info from BIM Health Report
  const projectName = $('h1').first().text().replace('BIM Health Report:', '').replace('BIMBOSS BIM Health Report', '').trim() || 
                      $('title').text().replace('BIM Health Report -', '').replace('BIM Health Report', '').trim() || 
                      'Unknown Project';
  
  console.log('  📝 Project Name:', projectName);
  
  const generatedDate = $('p:contains("Generated:")').text().replace('Generated:', '').trim() || 
                        $('.portalStandardText:contains("Report Date")').next().text().trim() ||
                        new Date().toISOString();
  
  console.log('  📅 Generated Date:', generatedDate);
  
  const revitVersion = $('p:contains("Revit Version:")').text().replace('Revit Version:', '').trim() || 
                       'Revit 2024';
  
  const overallGrade = $('.grade').text().trim() || 
                       $('span.portalStandardText.grade').text().trim() ||
                       $('h2:contains("Overall Grade")').next().text().trim() || 
                       'B';
  
  console.log('  🎯 Overall Grade:', overallGrade);
  
  // Extract statistics
  console.log('  📊 Extracting Statistics...');
  const statistics = {
    totalElements: extractNumberFromStatCard($, 'Total Elements') || extractNumber($, 'Total Elements') || extractFromChartData($, 'elementDistributionChart', 'total') || 0,
    walls: extractFromChartData($, 'elementDistributionChart', 0) ?? extractNumberFromDebugOrScript($, 'Walls') ?? extractNumber($, 'Walls') ?? 0,
    floors: extractFromChartData($, 'elementDistributionChart', 1) ?? extractNumberFromDebugOrScript($, 'Floors') ?? extractNumber($, 'Floors') ?? 0,
    ceilings: extractNumber($, 'Ceilings') || 0,
    doors: extractFromChartData($, 'elementDistributionChart', 2) ?? extractNumberFromDebugOrScript($, 'Doors') ?? extractNumber($, 'Doors') ?? 0,
    windows: extractFromChartData($, 'elementDistributionChart', 3) ?? extractNumberFromDebugOrScript($, 'Windows') ?? extractNumber($, 'Windows') ?? 0,
    columns: extractFromChartData($, 'elementDistributionChart', 4) ?? extractNumberFromDebugOrScript($, 'Columns') ?? extractNumber($, 'Columns') ?? 0,
    beams: extractFromChartData($, 'elementDistributionChart', 5) ?? extractNumberFromDebugOrScript($, 'Beams') ?? extractNumber($, 'Beams') ?? 0,
    rooms: extractNumber($, 'Rooms') || 0,
    spaces: extractNumber($, 'Spaces') || 0,
    views: extractNumberFromStatCard($, 'Total Views') || extractNumber($, 'Views') || 0,
    sheets: extractNumber($, 'Sheets') || 0,
    families: extractNumberFromStatCard($, 'Families') || extractNumber($, 'Families') || 0,
    materials: extractNumber($, 'Materials') || 0,
    modelSize: extractDecimalFromStatCard($, 'Model Size') || extractDecimal($, 'Model Size') || extractDecimal($, 'File Size') || 0
  };
  
  console.log('  📊 Statistics Extracted:');
  console.log('    Total Elements:', statistics.totalElements);
  console.log('    Walls:', statistics.walls);
  console.log('    Floors:', statistics.floors);
  console.log('    Doors:', statistics.doors);
  console.log('    Windows:', statistics.windows);

  // Extract MEP Elements - Try multiple strategies
  let mepElements = {
    ducts: 0,
    pipes: 0,
    electricalFixtures: 0,
    lightingFixtures: 0,
    plumbingFixtures: 0,
    hvacEquipment: 0
  };

  // Strategy 1: Try to extract MEP data from JavaScript charts
  $('script').each((i, elem) => {
    const scriptContent = $(elem).html() || '';
    
    // Look for mepElementsChart data
    const mepChartMatch = scriptContent.match(/mepElementsChart[^{]*\{[^{]*data:\s*\[([^\]]+)\]/);
    if (mepChartMatch && mepChartMatch[1]) {
      const numbers = mepChartMatch[1].split(',').map(n => parseInt(n.trim()));
      if (numbers.length >= 6) {
        mepElements = {
          ducts: numbers[0] || 0,
          pipes: numbers[1] || 0,
          electricalFixtures: numbers[2] || 0,
          lightingFixtures: numbers[3] || 0,
          plumbingFixtures: numbers[4] || 0,
          hvacEquipment: numbers[5] || 0
        };
      }
    }
    
    // Also look for individual MEP values in script
    const ductsMatch = scriptContent.match(/ducts[:\s=]+(\d+)/i);
    const pipesMatch = scriptContent.match(/pipes[:\s=]+(\d+)/i);
    if (ductsMatch) mepElements.ducts = parseInt(ductsMatch[1]);
    if (pipesMatch) mepElements.pipes = parseInt(pipesMatch[1]);
  });
  
  // Strategy 2: Extract from text labels (fallback)
  if (mepElements.ducts === 0) mepElements.ducts = extractNumber($, 'Ducts') || 0;
  if (mepElements.pipes === 0) mepElements.pipes = extractNumber($, 'Pipes') || 0;
  if (mepElements.electricalFixtures === 0) mepElements.electricalFixtures = extractNumber($, 'Electrical Fixtures') || 0;
  if (mepElements.lightingFixtures === 0) mepElements.lightingFixtures = extractNumber($, 'Lighting Fixtures') || 0;
  if (mepElements.plumbingFixtures === 0) mepElements.plumbingFixtures = extractNumber($, 'Plumbing Fixtures') || 0;
  if (mepElements.hvacEquipment === 0) mepElements.hvacEquipment = extractNumber($, 'HVAC Equipment') || 0;
  
  // Check if MEP has any data - if all zeros, set to undefined
  const hasMEPData = Object.values(mepElements).some(v => v > 0);
  console.log('  🔧 MEP Elements:', hasMEPData ? mepElements : 'No MEP data');

  // Extract Structural Elements
  const structuralElements = {
    structuralColumns: extractNumber($, 'Structural Columns') || 0,
    structuralFraming: extractNumber($, 'Structural Framing') || 0,
    structuralFoundations: extractNumber($, 'Structural Foundations') || 0,
    rebar: extractNumber($, 'Rebar') || 0,
    structuralConnections: extractNumber($, 'Structural Connections') || 0
  };
  
  // Check if Structural has any data
  const hasStructuralData = Object.values(structuralElements).some(v => v > 0);
  console.log('  🏗️ Structural Elements:', hasStructuralData ? structuralElements : 'No Structural data');

  // Extract Annotation Elements
  const annotationElements = {
    dimensions: extractNumber($, 'Dimensions') || 0,
    textNotes: extractNumber($, 'Text Notes') || 0,
    tags: extractNumber($, 'Tags') || 0,
    detailLines: extractNumber($, 'Detail Lines') || 0,
    filledRegions: extractNumber($, 'Filled Regions') || 0
  };

  // Extract View Details
  let viewDetails = {
    floorPlans: extractNumber($, 'Floor Plans') || 0,
    ceilingPlans: extractNumber($, 'Ceiling Plans') || 0,
    elevations: extractNumber($, 'Elevations') || 0,
    sections: extractNumber($, 'Sections') || 0,
    threeD: extractNumber($, '3D Views') || 0,
    schedules: extractNumber($, 'Schedules') || 0,
    draftingViews: extractNumber($, 'Drafting Views') || 0,
    detailViews: extractNumber($, 'Detail Views') || 0
  };

  // Try to extract View data from JavaScript charts
  $('script').each((i, elem) => {
    const scriptContent = $(elem).html() || '';
    
    // Look for viewTypesChart data: [66, 12, 18, 25, 14, 1]
    const viewChartMatch = scriptContent.match(/viewTypesChart[^{]*\{[^{]*data:\s*\[([^\]]+)\]/);
    if (viewChartMatch && viewChartMatch[1]) {
      const numbers = viewChartMatch[1].split(',').map(n => parseInt(n.trim()));
      if (numbers.length >= 6) {
        viewDetails = {
          floorPlans: numbers[0] || 0,
          sections: numbers[1] || 0,
          threeD: numbers[2] || 0,
          elevations: numbers[3] || 0,
          schedules: numbers[4] || 0,
          draftingViews: numbers[5] || 0,
          ceilingPlans: 0,
          detailViews: 0
        };
      }
    }
  });

  // Extract Sheet Details
  const sheetDetails = {
    totalSheets: extractNumber($, 'Total Sheets') || statistics.sheets,
    sheetsWithViews: extractNumber($, 'Sheets with Views') || 0,
    emptySheets: extractNumber($, 'Empty Sheets') || 0,
    averageViewsPerSheet: extractDecimal($, 'Average Views per Sheet') || 0
  };

  // Extract Material Details
  const materialDetails = {
    totalMaterials: extractNumber($, 'Total Materials') || statistics.materials,
    materialsWithAppearance: extractNumber($, 'Materials with Appearance') || 0,
    materialsWithThermal: extractNumber($, 'Materials with Thermal') || 0,
    materialsWithPhysical: extractNumber($, 'Materials with Physical') || 0
  };

  // Extract Levels and Grids
  const levelsAndGrids = {
    levels: extractNumber($, 'Levels') || 0,
    grids: extractNumber($, 'Grids') || 0,
    namedLevels: extractNumber($, 'Named Levels') || 0,
    namedGrids: extractNumber($, 'Named Grids') || 0,
    structuralLevels: extractNumber($, 'Structural Levels') || 0,
    buildingStoryLevels: extractNumber($, 'Building Story Levels') || 0
  };

  // Extract Family Analysis
  const familyAnalysis: any = {
    topFamilies: [],
    familySizeDistribution: {},
    familyUsageFrequency: {}
  };

  // Extract families from table (Family Name, Category, Instances, Size)
  let familyTableFound = false;
  $('table.itemList').each((tableIndex, table) => {
    const $table = $(table);
    const headers = $table.find('tr').first().find('th').map((i, el) => $(el).text().trim()).get();
    
    // Check if this is the family table
    if (headers.includes('Family Name') && headers.includes('Instances') && headers.includes('Size (KB)')) {
      familyTableFound = true;
      
      $table.find('tr').slice(1).each((i, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 4) {
          const familyName = $(cells[0]).text().trim();
          const category = $(cells[1]).text().trim();
          const instances = parseInt($(cells[2]).text().trim()) || 0;
          const size = parseInt($(cells[3]).text().trim()) || 0;
          
          if (familyName && instances > 0) {
            familyAnalysis.topFamilies.push({
              name: familyName,
              category: category,
              instances: instances,
              size: size
            });
          }
        }
      });
    }
  });

  // If families found, calculate distributions
  if (familyAnalysis.topFamilies.length > 0) {
    // Size distribution
    familyAnalysis.familySizeDistribution = {
      small: familyAnalysis.topFamilies.filter((f: any) => f.size < 100).length,
      medium: familyAnalysis.topFamilies.filter((f: any) => f.size >= 100 && f.size < 500).length,
      large: familyAnalysis.topFamilies.filter((f: any) => f.size >= 500 && f.size < 1000).length,
      veryLarge: familyAnalysis.topFamilies.filter((f: any) => f.size >= 1000).length
    };
    
    // Usage frequency
    familyAnalysis.familyUsageFrequency = {
      highUsage: familyAnalysis.topFamilies.filter((f: any) => f.instances > 50).length,
      mediumUsage: familyAnalysis.topFamilies.filter((f: any) => f.instances >= 10 && f.instances <= 50).length,
      lowUsage: familyAnalysis.topFamilies.filter((f: any) => f.instances >= 1 && f.instances < 10).length,
      unused: 0
    };
  }

  // Extract Areas and Spaces
  const areasDetails = {
    totalAreas: extractNumber($, 'Total Areas') || 0,
    placedAreas: extractNumber($, 'Placed Areas') || 0,
    unplacedAreas: extractNumber($, 'Unplaced Areas') || 0,
    areaSchemes: extractNumber($, 'Area Schemes') || 0
  };

  const spacesDetails = {
    totalSpaces: extractNumber($, 'Total Spaces') || statistics.spaces,
    placedSpaces: extractNumber($, 'Placed Spaces') || 0,
    unplacedSpaces: extractNumber($, 'Unplaced Spaces') || 0
  };

  // Extract Project Info
  const worksetCount = extractNumber($, 'Worksets') || extractNumber($, 'Workset Count') || 1;
  const designOptionsCount = extractNumber($, 'Design Options') || 0;
  const linkedRevitFiles = extractNumber($, 'Linked Revit Files') || extractNumber($, 'Revit Links') || 0;
  const linkedCADFiles = extractNumber($, 'Linked CAD Files') || extractNumber($, 'CAD Links') || 0;

  // Extract issues
  const issuesRaw: any[] = [];
  
  // Strategy 1: Look for recommendations table (Priority, Category, Recommendation format)
  $('table.itemList tr').each((i, elem) => {
    if (i === 0) return; // Skip header row
    
    const $elem = $(elem);
    const cells = $elem.find('td');
    
    if (cells.length >= 3) {
      const priority = $(cells[0]).text().trim();
      const category = $(cells[1]).text().trim();
      const recommendation = $(cells[2]).text().trim();
      
      if (priority && category && recommendation) {
        // Map priority to severity
        const severityMap: Record<string, string> = {
          'High': 'High',
          'Medium': 'Medium',
          'Low': 'Low',
          'Critical': 'Critical'
        };
        
        issuesRaw.push({
          category: category,
          severity: severityMap[priority] || 'Medium',
          description: recommendation,
          count: 1,
          recommendation: recommendation
        });
      }
    }
  });
  
  // Strategy 2: Try multiple selectors for issues (original format)
  if (issuesRaw.length === 0) {
    $('.issue-item, .issue, tr.issue-row').each((i, elem) => {
      const $elem = $(elem);
      const category = $elem.find('.issue-category, .category, td:first-child').text().trim();
      const severity = $elem.find('.issue-severity, .severity, .badge').text().trim();
      const description = $elem.find('.issue-description, .description, td:nth-child(2)').text().trim();
      const count = parseInt($elem.find('.issue-count, .count, td:nth-child(3)').text()) || 1;
      const recommendation = $elem.find('.issue-recommendation, .recommendation, td:last-child').text().trim();
      
      if (category || description) {
        issuesRaw.push({
          category: category || 'General',
          severity: severity || 'Medium',
          description: description || 'Issue detected',
          count: count,
          recommendation: recommendation || 'Review and resolve this issue'
        });
      }
    });
  }

  // Group issues by category to remove duplicates
  const issuesMap = new Map<string, any>();
  issuesRaw.forEach(issue => {
    const key = issue.category;
    if (issuesMap.has(key)) {
      // Merge with existing issue - combine descriptions and sum counts
      const existing = issuesMap.get(key);
      existing.count += issue.count;
      // Combine descriptions if different
      if (existing.description !== issue.description) {
        existing.description = `${existing.description}; ${issue.description}`;
      }
      // Keep highest severity
      const severityOrder: Record<string, number> = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
      if ((severityOrder[issue.severity] || 0) > (severityOrder[existing.severity] || 0)) {
        existing.severity = issue.severity;
      }
    } else {
      issuesMap.set(key, { ...issue });
    }
  });
  
  // Convert map back to array
  const issues = Array.from(issuesMap.values());

  // Extract warnings
  const warnings: any[] = [];
  $('.warning-item, .warning, tr.warning-row').each((i, elem) => {
    const $elem = $(elem);
    const description = $elem.find('.warning-description, .description, td:first-child').text().trim();
    const category = $elem.find('.warning-category, .category, td:nth-child(2)').text().trim();
    
    if (description) {
      warnings.push({
        description: description,
        category: category || 'Model Warning',
        elementIds: []
      });
    }
  });

  // Extract performance metrics
  const performance = {
    fileSize: extractDecimal($, 'File Size') || statistics.modelSize,
    viewCount: statistics.views,
    unusedFamilies: extractNumber($, 'Unused Families') || 0,
    performanceRating: $('*:contains("Performance Rating")').next().text().trim() || 
                       extractText($, 'Performance Rating') || 
                       'Good'
  };

  // Extract quality metrics - REAL DATA ONLY (NO FAKE FALLBACKS)
  const quality = {
    modelCompleteness: extractDecimal($, 'Model Completeness') || 
                       extractDecimal($, 'Completeness') || 0,
    geometricAccuracy: extractDecimal($, 'Geometric Accuracy') || 
                       extractDecimal($, 'Accuracy') || 0,
    informationRichness: extractDecimal($, 'Information Richness') || 
                         extractDecimal($, 'Richness') || 0,
    overallGrade: overallGrade
  };

  return {
    projectName,
    generatedDate,
    revitVersion,
    statistics,
    architecturalElements: {}, // Add to show Architectural tab
    mepElements: hasMEPData ? mepElements : undefined, // Only include if has data
    structuralElements: hasStructuralData ? structuralElements : undefined, // Only include if has data
    annotationElements,
    viewDetails,
    sheetDetails,
    materialDetails,
    levelsAndGrids,
    areasDetails,
    spacesDetails,
    worksetCount,
    designOptionsCount,
    linkedRevitFiles,
    linkedCADFiles,
    coordinateSystemDetails: {}, // Add empty object to show tab
    groupDetails: {}, // Add empty object to show tab
    familyAnalysis: familyAnalysis.topFamilies.length > 0 ? familyAnalysis : undefined,
    issues,
    warnings,
    performance,
    quality
  };
}

function extractNumber($: cheerio.CheerioAPI, label: string): number {
  // Try multiple strategies to find the number
  
  // Strategy 1: Look for table cells with exact label match
  let text = $(`td:contains("${label}"), th:contains("${label}")`).next('td').text().trim();
  
  // Strategy 2: Look for divs/spans with class containing the label
  if (!text) {
    const labelClass = label.toLowerCase().replace(/\s+/g, '-');
    text = $(`.${labelClass}-value, .stat-${labelClass}, [data-label="${label}"]`).text().trim();
  }
  
  // Strategy 3: Look for elements with the label followed by a colon or number
  if (!text) {
    const regex = new RegExp(`${label}\\s*:?\\s*([\\d,]+)`, 'i');
    $('*').each((i, elem) => {
      const elemText = $(elem).text();
      const match = elemText.match(regex);
      if (match && match[1]) {
        text = match[1];
        return false; // break
      }
    });
  }
  
  // Strategy 4: Look in portalStandardText spans (BIM Health Report specific)
  if (!text) {
    $('span.portalHeadlineText').each((i, elem) => {
      if ($(elem).text().includes(label)) {
        text = $(elem).next('span.portalStandardText').text().trim();
        return false;
      }
    });
  }
  
  // Strategy 5: Look in script tags for debug info or chart data
  if (!text) {
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html() || '';
      const patterns = [
        new RegExp(`${label}[:\\s=]+(\\d+)`, 'i'),
        new RegExp(`"${label}"[:\\s]+(\\d+)`, 'i'),
        new RegExp(`'${label}'[:\\s]+(\\d+)`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = scriptContent.match(pattern);
        if (match && match[1]) {
          text = match[1];
          return false;
        }
      }
    });
  }
  
  // Extract only the number part, ignore dates and other patterns
  if (text) {
    // Remove any date-like patterns (YYYY-MM-DD, DD/MM/YYYY, etc)
    text = text.replace(/\d{4}[-\/]\d{2}[-\/]\d{2}/g, '');
    text = text.replace(/\d{2}[-\/]\d{2}[-\/]\d{4}/g, '');
    
    // Extract the first occurrence of a number (with optional commas)
    const match = text.match(/\b(\d{1,3}(?:,\d{3})*|\d+)\b/);
    if (match && match[1]) {
      const num = parseInt(match[1].replace(/,/g, ''));
      // Sanity check: if number is too large (like a timestamp), return 0
      if (num > 10000000) return 0;
      return num;
    }
  }
  
  return 0;
}

function extractDecimal($: cheerio.CheerioAPI, label: string): number {
  // Try multiple strategies to find the decimal number
  
  // Strategy 1: Look for table cells with exact label match
  let text = $(`td:contains("${label}"), th:contains("${label}")`).next('td').text().trim();
  
  // Strategy 2: Look for divs/spans with class containing the label
  if (!text) {
    const labelClass = label.toLowerCase().replace(/\s+/g, '-');
    text = $(`.${labelClass}-value, .stat-${labelClass}, [data-label="${label}"]`).text().trim();
  }
  
  // Strategy 3: Look for elements with the label followed by a colon
  if (!text) {
    const regex = new RegExp(`${label}\\s*:?\\s*([\\d,]+\\.?\\d*)`, 'i');
    $('*').each((i, elem) => {
      const elemText = $(elem).text();
      const match = elemText.match(regex);
      if (match && match[1]) {
        text = match[1];
        return false; // break
      }
    });
  }
  
  // Extract only the decimal number part
  if (text) {
    // Remove any date-like patterns
    text = text.replace(/\d{4}[-\/]\d{2}[-\/]\d{2}/g, '');
    text = text.replace(/\d{2}[-\/]\d{2}[-\/]\d{4}/g, '');
    
    // Extract the first occurrence of a decimal number
    const match = text.match(/\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\b/);
    if (match && match[1]) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      // Sanity check: if number is too large (like a timestamp), return 0
      if (num > 10000000) return 0;
      return num;
    }
  }
  
  return 0;
}

function extractText($: cheerio.CheerioAPI, label: string): string {
  return $(`td:contains("${label}")`).next().text().trim() || 
         $(`th:contains("${label}")`).next().text().trim() ||
         $(`*:contains("${label}")`).parent().text().replace(label, '').trim() ||
         '';
}

// Extract number from statCard divs (specific to BIM Health Report HTML structure)
function extractNumberFromStatCard($: cheerio.CheerioAPI, label: string): number {
  // Try multiple variations of the label
  const variations = [
    label,
    label.toLowerCase(),
    label.toUpperCase(),
    label.replace(/\s+/g, ''),
    label.replace(/\s+/g, '-')
  ];
  
  for (const variant of variations) {
    // Try exact match
    let statCard = $(`.statCard:has(h4:contains("${variant}"))`);
    if (statCard.length === 0) {
      // Try case-insensitive match
      statCard = $(`.statCard`).filter((i, elem) => {
        const h4Text = $(elem).find('h4').text().toLowerCase();
        return h4Text.includes(variant.toLowerCase());
      });
    }
    
    if (statCard.length > 0) {
      const valueText = statCard.find('.statValue').text().trim();
      const match = valueText.match(/\b(\d{1,3}(?:,\d{3})*|\d+)\b/);
      if (match && match[1]) {
        return parseInt(match[1].replace(/,/g, ''));
      }
    }
  }
  
  return 0;
}

// Extract decimal from statCard divs
function extractDecimalFromStatCard($: cheerio.CheerioAPI, label: string): number {
  const statCard = $(`.statCard:has(h4:contains("${label}"))`);
  if (statCard.length > 0) {
    const valueText = statCard.find('.statValue').text().trim();
    const match = valueText.match(/\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\b/);
    if (match && match[1]) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
  }
  return 0;
}

// Extract numbers from JavaScript debug info or console.log statements
function extractNumberFromDebugOrScript($: cheerio.CheerioAPI, label: string): number {
  // Look in script tags for debug info
  let result = 0;
  
  // First, try to extract from Debug Info statCard (W:9 F:5 D:3 format)
  const debugStatCard = $('.statCard:has(h4:contains("Debug Info"))');
  if (debugStatCard.length > 0) {
    const debugText = debugStatCard.find('.statValue').text().trim();
    
    const shortLabels: Record<string, string> = {
      'Walls': 'W',
      'Floors': 'F', 
      'Doors': 'D',
      'Windows': 'Win',
      'Columns': 'C',
      'Beams': 'B'
    };
    
    if (shortLabels[label]) {
      const pattern = new RegExp(`${shortLabels[label]}:(\\d+)`, 'i');
      const match = debugText.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1]);
      }
    }
  }
  
  // Then look in script tags for debug info
  $('script').each((i, elem) => {
    const scriptContent = $(elem).html() || '';
    
    // Pattern 1: W:166 F:21 D:128 format
    const shortLabels: Record<string, string> = {
      'Walls': 'W',
      'Floors': 'F', 
      'Doors': 'D',
      'Windows': 'Win',
      'Columns': 'C',
      'Beams': 'B'
    };
    
    if (shortLabels[label]) {
      const pattern = new RegExp(`${shortLabels[label]}:(\\d+)`, 'i');
      const match = scriptContent.match(pattern);
      if (match && match[1]) {
        result = parseInt(match[1]);
        return false; // break
      }
    }
    
    // Pattern 2: console.log with full label
    const pattern2 = new RegExp(`${label}=(\\d+)`, 'i');
    const match2 = scriptContent.match(pattern2);
    if (match2 && match2[1]) {
      result = parseInt(match2[1]);
      return false; // break
    }
    
    // Pattern 3: data array [166, 21, 128, ...]
    const labelIndex: Record<string, number> = {
      'Walls': 0,
      'Floors': 1,
      'Doors': 2,
      'Windows': 3,
      'Columns': 4,
      'Beams': 5
    };
    
    if (labelIndex[label] !== undefined) {
      const dataPattern = /data:\s*\[(\d+(?:,\s*\d+)*)\]/;
      const dataMatch = scriptContent.match(dataPattern);
      if (dataMatch && dataMatch[1]) {
        const numbers = dataMatch[1].split(',').map(n => parseInt(n.trim()));
        if (numbers[labelIndex[label]]) {
          result = numbers[labelIndex[label]];
          return false; // break
        }
      }
    }
  });
  
  return result;
}

// Extract data from Chart.js initialization code
function extractFromChartData($: cheerio.CheerioAPI, chartId: string, indexOrKey: number | string): number {
  let result = 0;
  
  $('script').each((i, elem) => {
    const scriptContent = $(elem).html() || '';
    
    // Look for createChart('chartId', { ... data: [numbers] ... })
    const chartPattern = new RegExp(`createChart\\(['"]${chartId}['"][^{]*\\{[^}]*data:\\s*\\[([^\\]]+)\\]`, 's');
    const match = scriptContent.match(chartPattern);
    
    if (match && match[1]) {
      const numbers = match[1].split(',').map(n => {
        const trimmed = n.trim();
        const parsed = parseInt(trimmed);
        return isNaN(parsed) ? 0 : parsed;
      });
      
      if (indexOrKey === 'total') {
        // Sum all numbers
        result = numbers.reduce((sum, num) => sum + num, 0);
      } else if (typeof indexOrKey === 'number' && numbers[indexOrKey] !== undefined) {
        result = numbers[indexOrKey];
      }
      
      return false; // break
    }
  });
  
  return result;
}
