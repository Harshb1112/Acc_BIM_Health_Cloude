import fs from 'fs';
import path from 'path';
import { ForgeService } from './forgeService';
import { getForgeService } from './serviceInstances';

/**
 * Revit File Processor
 * Processes RVT files using Forge Design Automation API (real processing only)
 */
export class RevitProcessor {
  private forgeService: ForgeService;
  private useForge: boolean;

  constructor(clientId?: string, clientSecret?: string) {
    // If user credentials provided, use them; otherwise use server credentials
    this.forgeService = getForgeService(clientId, clientSecret);
    this.useForge = process.env.ENABLE_FORGE_PROCESSING === 'true' && this.forgeService.isConfigured();

    if (this.useForge) {
      console.log('🚀 Forge API enabled - Real RVT processing active');
    } else {
      console.log('⚠️  Forge API not configured - Real processing only, no mock data');
      console.log('   Provide valid Autodesk credentials to process RVT files');
    }
  }
  
  /**
   * Process RVT file from storage URN (ACC files) - FORGE ONLY
   * This is the best method for ACC files as it doesn't require downloading
   */
  async processRVTFromStorageUrn(storageUrn: string, fileName: string, userToken?: string, requestedVersion?: string): Promise<any> {
    // Only use Forge API - no fallback
    if (!this.useForge) {
      const reason = !this.forgeService.isConfigured() 
        ? 'Autodesk credentials not provided or invalid'
        : 'ENABLE_FORGE_PROCESSING is not set to true in .env file';
      
      throw new Error(`Forge API is not configured. Reason: ${reason}. Please provide valid Autodesk credentials.`);
    }

    console.log('🔄 Processing with Forge Design Automation API...');
    console.log(`📄 File: ${fileName}`);
    console.log(`🔗 Storage URN: ${storageUrn}`);
    console.log(`🔑 User token: ${userToken ? 'Provided' : 'Not provided (will use 2-legged)'}`);
    
    if (requestedVersion) {
      console.log(`📌 Requested Revit version: ${requestedVersion}`);
    }
    
    try {
      const report = await this.forgeService.processRVTFromStorageUrn(storageUrn, fileName, userToken, requestedVersion);
      return report;
    } catch (error: any) {
      console.error('❌ Forge processing error:', error.message);
      
      // Provide more helpful error messages
      if (error.message.includes('Failed to authenticate')) {
        throw new Error('Invalid Autodesk credentials. Please check your Client ID and Client Secret.');
      } else if (error.message.includes('Work item failed') || error.message.includes('failedInstructions')) {
        console.error('Full error:', error.message);
        throw new Error(`Processing failed: ${error.message}`);
      } else if (error.message.includes('activity') && error.message.includes('404')) {
        throw new Error('Design Automation activity not found. The activity may need to be set up for your account.');
      }
      
      throw error;
    }
  }

  /**
   * Process RVT file from URL (no download needed) - FORGE ONLY
   */
  async processRVTFileFromUrl(fileUrl: string, fileName: string): Promise<any> {
    // Only use Forge API - no fallback
    if (!this.useForge) {
      const reason = !this.forgeService.isConfigured() 
        ? 'Autodesk credentials not provided or invalid'
        : 'ENABLE_FORGE_PROCESSING is not set to true in .env file';
      
      throw new Error(`Forge API is not configured. Reason: ${reason}. Please provide valid Autodesk credentials.`);
    }

    console.log('🔄 Processing with Forge Design Automation API...');
    console.log(`📄 File: ${fileName}`);
    console.log(`🔗 URL: ${fileUrl.substring(0, 50)}...`);
    
    try {
      const report = await this.forgeService.processRVTFileFromUrl(fileUrl, fileName);
      return report;
    } catch (error: any) {
      console.error('❌ Forge processing error:', error.message);
      
      // Provide more helpful error messages
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

  /**
   * Process RVT file and generate health report - FORGE ONLY
   */
  async processRVTFile(rvtPath: string, fileName: string): Promise<any> {
    // Get file stats
    const stats = fs.statSync(rvtPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // Only use Forge API - no fallback
    if (!this.useForge) {
      const reason = !this.forgeService.isConfigured() 
        ? 'Autodesk credentials not provided or invalid'
        : 'ENABLE_FORGE_PROCESSING is not set to true in .env file';
      
      throw new Error(`Forge API is not configured. Reason: ${reason}. Please provide valid Autodesk credentials.`);
    }

    console.log('🔄 Processing with Forge Design Automation API...');
    console.log(`📄 File: ${fileName} (${fileSizeMB.toFixed(2)} MB)`);
    
    try {
      const report = await this.forgeService.processRVTFile(rvtPath, fileName);
      return report;
    } catch (error: any) {
      console.error('❌ Forge processing error:', error.message);
      
      // Provide more helpful error messages
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

