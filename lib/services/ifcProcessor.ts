import fs from 'fs';
import path from 'path';
import { ForgeService } from './forgeService';
import { getForgeService } from './serviceInstances';

/**
 * IFC File Processor
 * Processes IFC files using Forge Design Automation API
 */
export class IFCProcessor {
  private forgeService: ForgeService;
  private useForge: boolean;

  constructor(clientId?: string, clientSecret?: string) {
    this.forgeService = getForgeService(clientId, clientSecret);
    this.useForge = process.env.ENABLE_FORGE_PROCESSING === 'true' && this.forgeService.isConfigured();

    if (this.useForge) {
      console.log('🚀 Forge API enabled - Real IFC processing active');
    } else {
      console.log('⚠️  Forge API not configured - Real processing only, no mock data');
      console.log('   Provide valid Autodesk credentials to process IFC files');
    }
  }
  
  /**
   * Process IFC file from URL (no download needed) - FORGE ONLY
   */
  async processIFCFileFromUrl(fileUrl: string, fileName: string): Promise<any> {
    if (!this.useForge) {
      const reason = !this.forgeService.isConfigured() 
        ? 'Autodesk credentials not provided or invalid'
        : 'ENABLE_FORGE_PROCESSING is not set to true in .env file';
      
      throw new Error(`Forge API is not configured. Reason: ${reason}. Please provide valid Autodesk credentials.`);
    }

    console.log('🔄 Processing IFC file with Forge Design Automation API...');
    console.log(`📄 File: ${fileName}`);
    console.log(`🔗 URL: ${fileUrl.substring(0, 50)}...`);
    
    try {
      const report = await this.forgeService.processIFCFileFromUrl(fileUrl, fileName);
      return report;
    } catch (error: any) {
      console.error('❌ Forge IFC processing error:', error.message);
      throw error;
    }
  }

  /**
   * Process IFC file from storage URN using Design Automation
   * This is the best method for ACC files as it doesn't require downloading
   */
  async processIFCFromStorageUrn(storageUrn: string, fileName: string, userToken?: string): Promise<any> {
    // Only use Forge API - no fallback
    if (!this.useForge) {
      const reason = !this.forgeService.isConfigured() 
        ? 'Autodesk credentials not provided or invalid'
        : 'ENABLE_FORGE_PROCESSING is not set to true in .env file';
      
      throw new Error(`Forge API is not configured. Reason: ${reason}. Please provide valid Autodesk credentials.`);
    }

    console.log('🔄 Processing IFC file from storage URN with Forge Design Automation API...');
    console.log(`📄 File: ${fileName}`);
    console.log(`📦 Storage URN: ${storageUrn}`);
    
    try {
      const report = await this.forgeService.processIFCFromStorageUrn(storageUrn, fileName, userToken);
      return report;
    } catch (error: any) {
      console.error('❌ Forge IFC processing error:', error.message);
      throw error;
    }
  }


  /**
   * Process IFC file and generate health report - FORGE ONLY
   */
  async processIFCFile(ifcPath: string, fileName: string): Promise<any> {
    const stats = fs.statSync(ifcPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (!this.useForge) {
      const reason = !this.forgeService.isConfigured() 
        ? 'Autodesk credentials not provided or invalid'
        : 'ENABLE_FORGE_PROCESSING is not set to true in .env file';
      
      throw new Error(`Forge API is not configured. Reason: ${reason}. Please provide valid Autodesk credentials.`);
    }

    console.log('🔄 Processing IFC file with Forge Design Automation API...');
    console.log(`📄 File: ${fileName} (${fileSizeMB.toFixed(2)} MB)`);
    
    try {
      const report = await this.forgeService.processIFCFile(ifcPath, fileName);
      return report;
    } catch (error: any) {
      console.error('❌ Forge IFC processing error:', error.message);
      
      if (error.message.includes('Failed to authenticate')) {
        throw new Error('Invalid Autodesk credentials. Please check your Client ID and Client Secret.');
      } else if (error.message.includes('Work item failed') || error.message.includes('failedInstructions')) {
        // Work item failed during execution - this is a plugin/file issue, not an activity issue
        console.error('Full error:', error.message);
        throw new Error(`Processing failed: ${error.message}`);
      } else if (error.message.includes('activity') && error.message.includes('404')) {
        // Only throw "activity not found" if we get a 404 on the activity itself
        throw new Error('Design Automation activity not found. The activity may need to be set up for your account.');
      }
      
      throw error;
    }
  }
}
