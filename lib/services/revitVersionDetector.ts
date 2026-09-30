import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { RevitFileAnalyzer } from '../utils/revitFileAnalyzer';

/**
 * Revit Version Detector
 * Detects Revit version from file metadata and selects appropriate activity
 */
export class RevitVersionDetector {
  
  /**
   * Detect Revit version from ACC file metadata
   */
  async detectVersionFromACC(storageUrn: string, userToken: string): Promise<string> {
    try {
      // Get file metadata from OSS
      const ossUrl = storageUrn.replace('urn:adsk.objects:os.object:', '');
      const [bucketKey, objectKey] = ossUrl.split('/');
      
      const response = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}/details`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        }
      );
      
      // Check for Revit version in metadata
      const metadata = response.data;
      
      // Try to get version from custom metadata
      if (metadata.customMetadata && metadata.customMetadata.revitVersion) {
        return this.normalizeVersion(metadata.customMetadata.revitVersion);
      }
      
      // Could not detect from metadata
      throw new Error('No Revit version found in metadata');
      
    } catch (error) {
      throw new Error('Could not detect version from metadata');
    }
  }
  
  /**
   * Normalize version string to year format
   * Only returns supported versions (2023-2027)
   */
  private normalizeVersion(version: string): string {
    // Extract year from various formats
    const match = version.match(/20(23|24|25|26|27)/);
    if (match) {
      return match[0];
    }
    
    // Default to 2024 (stable version)
    return '2024';
  }
  
  /**
   * Get activity ID for specific Revit version
   */
  getActivityId(clientId: string, revitVersion: string): string {
    return `${clientId}.BIMHealthReportActivity${revitVersion}+prod`;
  }
  
  /**
   * Get list of available Revit versions
   */
  getSupportedVersions(): string[] {
    return ['2023', '2024', '2025', '2026', '2027'];
  }
  
  /**
   * Check if version is supported
   */
  isVersionSupported(version: string): boolean {
    return this.getSupportedVersions().includes(version);
  }
  
  /**
   * Get available ZIP files on server
   * Only checks for supported versions (2023-2027)
   */
  getAvailableVersions(): string[] {
    const availableVersions: string[] = [];
    
    // Check which ZIP files exist (newest to oldest - reverse order for default selection)
    const versionsToCheck = ['2027', '2026', '2025', '2024', '2023'];
    
    // Check multiple possible locations for ZIP files
    const possiblePaths = [
      path.join(process.cwd(), 'bundle_upload'), // Primary: cloude_plugin/bundle_upload
      path.join(process.cwd()), // Secondary: cloude_plugin root
      path.join(process.cwd(), '../local_plugin/bundle/Design_Automation_bundle/zip') // Tertiary: local_plugin bundle
    ];
    
    for (const version of versionsToCheck) {
      let found = false;
      
      for (const basePath of possiblePaths) {
        const zipPath = path.join(basePath, `BIMHealthReportActivity-${version}.zip`);
        if (fs.existsSync(zipPath)) {
          availableVersions.push(version);
          found = true;
          break; // Found in this location, no need to check others
        }
      }
    }
    
    return availableVersions;
  }
  
  /**
   * Smart version detection with multiple strategies
   * Returns the EXACT version the file was created in
   */
  async detectVersion(fileName: string, storageUrn?: string, userToken?: string): Promise<string> {
    console.log('🔍 Detecting Revit version...');
    
    // Check available versions first
    const availableVersions = this.getAvailableVersions();
    
    if (availableVersions.length === 0) {
      throw new Error(
        'No Revit AppBundle ZIP files found. ' +
        'Please create bundles using DESIGN_AUTOMATION_BUNDLE_*.bat scripts in local_plugin folder. ' +
        'Supported versions: 2023, 2024, 2025, 2026, 2027. ' +
        'Available scripts: DESIGN_AUTOMATION_BUNDLE_2023.bat, 2024.bat, 2025.bat, 2026.bat, 2027.bat'
      );
    }
    
    console.log(`📦 Available versions on server: ${availableVersions.join(', ')}`);
    
    // Strategy 1: Try file binary analysis (if accessible)
    if (storageUrn && userToken) {
      try {
        const analyzer = new RevitFileAnalyzer();
        const versionInfo = await analyzer.getVersionInfo(storageUrn, userToken);
        if (versionInfo.version) {
          console.log(`✅ Detected from file binary: Revit ${versionInfo.version} (confidence: ${versionInfo.confidence})`);
          return versionInfo.version;
        }
      } catch (error) {
        console.log('⚠️  Could not analyze file binary (access restricted)');
      }
    }
    
    // Strategy 2: Try ACC metadata
    if (storageUrn && userToken) {
      try {
        const metadataVersion = await this.detectVersionFromACC(storageUrn, userToken);
        console.log(`✅ Detected from metadata: Revit ${metadataVersion}`);
        return metadataVersion;
      } catch (error) {
        console.log('⚠️  Could not detect from metadata');
      }
    }
    
    // Strategy 3: Use most recent available version as default
    const defaultVersion = availableVersions[0]; // Most recent
    console.log(`⚠️  Could not detect exact Revit version from file`);
    console.log(`📌 Using most recent available version: Revit ${defaultVersion}`);
    console.log(`💡 TIP: Specify version in request body/query: { "revitVersion": "2023" }`);
    console.log(`💡 Available versions: ${availableVersions.join(', ')}`);
    return defaultVersion;
  }
}
