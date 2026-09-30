import axios from 'axios';

/**
 * Revit File Analyzer
 * Analyzes Revit file binary to detect actual version
 */
export class RevitFileAnalyzer {
  
  /**
   * Detect Revit version from file binary header
   * Revit files have version info in first few KB
   */
  async detectVersionFromBinary(storageUrn: string, userToken: string): Promise<string | null> {
    try {
      console.log('🔍 Analyzing Revit file binary to detect version...');
      
      // Download first 64KB of file (enough to read header)
      const ossUrl = storageUrn.replace('urn:adsk.objects:os.object:', '');
      const [bucketKey, objectKey] = ossUrl.split('/');
      
      const response = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${objectKey}`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Range': 'bytes=0-65535' // First 64KB
          },
          responseType: 'arraybuffer'
        }
      );
      
      const buffer = Buffer.from(response.data);
      const headerText = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
      
      // Look for Revit version patterns in header
      // Revit files contain version strings like "Autodesk Revit 2024" or format version numbers
      const versionPatterns = [
        /Autodesk Revit (\d{4})/i,
        /Format:\s*(\d{4})/i,
        /RVT\s*(\d{4})/i,
        /Version:\s*(\d{4})/i,
        // Format version to year mapping
        /Format:\s*2023/i,  // Revit 2023
        /Format:\s*2024/i,  // Revit 2024
        /Format:\s*2025/i,  // Revit 2025
        /Format:\s*2026/i,  // Revit 2026
        /Format:\s*2027/i,  // Revit 2027
      ];
      
      for (const pattern of versionPatterns) {
        const match = headerText.match(pattern);
        if (match && match[1]) {
          const year = match[1];
          if (year >= '2023' && year <= '2027') {
            console.log(`✅ Detected Revit ${year} from file binary`);
            return year;
          }
        }
      }
      
      // Try to detect from format version bytes
      // Revit uses specific byte sequences for version identification
      const version = this.detectFromFormatBytes(buffer);
      if (version) {
        console.log(`✅ Detected Revit ${version} from format bytes`);
        return version;
      }
      
      console.log('⚠️  Could not detect version from file binary');
      return null;
      
    } catch (error: any) {
      console.log('⚠️  Error analyzing file binary:', error.message);
      return null;
    }
  }
  
  /**
   * Detect version from Revit format bytes
   * Different Revit versions have different format identifiers
   */
  private detectFromFormatBytes(buffer: Buffer): string | null {
    // Revit format version identifiers (approximate)
    // These are common byte patterns found in Revit files
    const formatMappings = [
      { pattern: Buffer.from([0x00, 0x00, 0x00, 0x27]), version: '2023' },
      { pattern: Buffer.from([0x00, 0x00, 0x00, 0x28]), version: '2024' },
      { pattern: Buffer.from([0x00, 0x00, 0x00, 0x29]), version: '2025' },
      { pattern: Buffer.from([0x00, 0x00, 0x00, 0x2A]), version: '2026' },
      { pattern: Buffer.from([0x00, 0x00, 0x00, 0x2B]), version: '2027' },
    ];
    
    // Search for format patterns in first 1KB
    const searchBuffer = buffer.slice(0, 1024);
    
    for (const mapping of formatMappings) {
      if (searchBuffer.includes(mapping.pattern)) {
        return mapping.version;
      }
    }
    
    return null;
  }
  
  /**
   * Get comprehensive version info from multiple sources
   */
  async getVersionInfo(storageUrn: string, userToken: string): Promise<{
    version: string | null;
    confidence: 'high' | 'medium' | 'low';
    source: string;
  }> {
    // Try binary analysis first (most reliable)
    const binaryVersion = await this.detectVersionFromBinary(storageUrn, userToken);
    if (binaryVersion) {
      return {
        version: binaryVersion,
        confidence: 'high',
        source: 'file_binary'
      };
    }
    
    return {
      version: null,
      confidence: 'low',
      source: 'none'
    };
  }
}
