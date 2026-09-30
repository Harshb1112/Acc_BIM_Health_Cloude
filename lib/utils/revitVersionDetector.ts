// Revit Version Detector
// Automatically detects Revit version from file and selects appropriate Design Automation activity

import fs from 'fs';
import path from 'path';

export interface RevitVersionInfo {
  version: string;
  activityName: string;
  engine: string;
  confidence: 'high' | 'medium' | 'low';
  detectionMethod: string;
}

const SUPPORTED_VERSIONS = ['2023', '2024', '2025', '2026', '2027'];
const DEFAULT_VERSION = '2024'; // Fallback version

const ENGINE_MAP: Record<string, string> = {
  '2023': 'Autodesk.Revit+2023',
  '2024': 'Autodesk.Revit+2024',
  '2025': 'Autodesk.Revit+2025',
  '2026': 'Autodesk.Revit+2026',
  '2027': 'Autodesk.Revit+2027'
};

/**
 * Detect Revit version from filename
 * Examples: "Project_2024.rvt", "Building-R2023.rvt", "Model_v2025.rvt"
 */
function detectFromFilename(filename: string): string | null {
  const patterns = [
    /[_-](\d{4})[._-]/,  // _2024_ or -2024-
    /[_-]R(\d{4})/i,     // _R2024 or -r2024
    /[_-]v(\d{4})/i,     // _v2024 or -V2024
    /(\d{4})\.rvt$/i     // 2024.rvt
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      const year = match[1];
      if (SUPPORTED_VERSIONS.includes(year)) {
        return year;
      }
    }
  }

  return null;
}

/**
 * Detect Revit version from file header
 * RVT files have version info in the first few bytes
 */
function detectFromFileHeader(filePath: string): string | null {
  try {
    const buffer = Buffer.alloc(1024);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);

    const header = buffer.toString('utf8', 0, 1024);

    // Look for version patterns in header
    // Revit files contain version strings like "Autodesk Revit 2024"
    const versionPatterns = [
      /Revit\s+(\d{4})/i,
      /Format:\s*(\d{4})/i,
      /Version:\s*(\d{4})/i
    ];

    for (const pattern of versionPatterns) {
      const match = header.match(pattern);
      if (match && match[1]) {
        const year = match[1];
        if (SUPPORTED_VERSIONS.includes(year)) {
          return year;
        }
      }
    }

    // Check for binary version markers
    // Revit 2023 = 0x17, 2024 = 0x18, 2025 = 0x19, 2026 = 0x1A, 2027 = 0x1B
    const versionByte = buffer[0x10]; // Version byte location (approximate)
    const versionMap: Record<number, string> = {
      0x17: '2023',
      0x18: '2024',
      0x19: '2025',
      0x1A: '2026',
      0x1B: '2027'
    };

    if (versionMap[versionByte]) {
      return versionMap[versionByte];
    }

  } catch (error) {
    console.error('Error reading file header:', error);
  }

  return null;
}

/**
 * Detect Revit version from file metadata
 */
function detectFromMetadata(filePath: string): string | null {
  try {
    const stats = fs.statSync(filePath);
    const modifiedDate = stats.mtime;
    const year = modifiedDate.getFullYear().toString();

    // If file was modified in a year that matches a Revit version, use it as a hint
    if (SUPPORTED_VERSIONS.includes(year)) {
      return year;
    }

  } catch (error) {
    console.error('Error reading file metadata:', error);
  }

  return null;
}

/**
 * Main detection function - tries multiple methods
 */
export function detectRevitVersion(filePath: string): RevitVersionInfo {
  const filename = path.basename(filePath);

  // Method 1: Try filename detection (highest confidence)
  const filenameVersion = detectFromFilename(filename);
  if (filenameVersion) {
    return {
      version: filenameVersion,
      activityName: `BIMHealthReportActivity${filenameVersion}`,
      engine: ENGINE_MAP[filenameVersion],
      confidence: 'high',
      detectionMethod: 'filename'
    };
  }

  // Method 2: Try file header detection (medium confidence)
  if (fs.existsSync(filePath)) {
    const headerVersion = detectFromFileHeader(filePath);
    if (headerVersion) {
      return {
        version: headerVersion,
        activityName: `BIMHealthReportActivity${headerVersion}`,
        engine: ENGINE_MAP[headerVersion],
        confidence: 'medium',
        detectionMethod: 'file_header'
      };
    }

    // Method 3: Try metadata detection (low confidence)
    const metadataVersion = detectFromMetadata(filePath);
    if (metadataVersion) {
      return {
        version: metadataVersion,
        activityName: `BIMHealthReportActivity${metadataVersion}`,
        engine: ENGINE_MAP[metadataVersion],
        confidence: 'low',
        detectionMethod: 'metadata'
      };
    }
  }

  // Fallback to default version
  console.warn(`Could not detect Revit version for ${filename}, using default: ${DEFAULT_VERSION}`);
  return {
    version: DEFAULT_VERSION,
    activityName: `BIMHealthReportActivity${DEFAULT_VERSION}`,
    engine: ENGINE_MAP[DEFAULT_VERSION],
    confidence: 'low',
    detectionMethod: 'default'
  };
}

/**
 * Get activity name for a specific version
 */
export function getActivityForVersion(version: string): string {
  if (!SUPPORTED_VERSIONS.includes(version)) {
    console.warn(`Unsupported version ${version}, using default: ${DEFAULT_VERSION}`);
    version = DEFAULT_VERSION;
  }
  return `BIMHealthReportActivity${version}`;
}

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: string): boolean {
  return SUPPORTED_VERSIONS.includes(version);
}

/**
 * Get all supported versions
 */
export function getSupportedVersions(): string[] {
  return [...SUPPORTED_VERSIONS];
}
