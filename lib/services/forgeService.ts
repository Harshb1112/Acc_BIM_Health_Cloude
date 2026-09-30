import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import dns from 'dns';
import { ActivitySetupService } from './activitySetup';
import { RevitVersionDetector } from './revitVersionDetector';
import { RevitFileAnalyzer } from '../utils/revitFileAnalyzer';

// Force DNS to use Google DNS and increase timeout
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
dns.setDefaultResultOrder('ipv4first');

// Configure axios with better timeout and DNS settings for large files (2GB support)
axios.defaults.timeout = 1800000; // 30 minutes for large file uploads
axios.defaults.maxContentLength = Infinity;
axios.defaults.maxBodyLength = Infinity;
axios.defaults.httpAgent = new HttpAgent({ 
  keepAlive: true, 
  family: 4,
  timeout: 1800000,
  lookup: dns.lookup
});
axios.defaults.httpsAgent = new HttpsAgent({ 
  keepAlive: true, 
  family: 4,
  timeout: 1800000,
  lookup: dns.lookup
});

/**
 * Autodesk Forge Design Automation Service
 * Processes RVT files using Revit in the cloud
 */
export class ForgeService {
  private clientId: string;
  private clientSecret: string;
  private bucketKey: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId?: string, clientSecret?: string) {
    // Use provided credentials or fall back to server credentials
    this.clientId = clientId || process.env.FORGE_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.FORGE_CLIENT_SECRET || '';
    
    // Create unique bucket name based on client ID to avoid conflicts
    const bucketSuffix = this.clientId ? this.clientId.substring(0, 10).toLowerCase() : 'default';
    this.bucketKey = `bimhealth-${bucketSuffix}`;

    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️  Forge credentials not configured. Real processing only - no mock data available.');
    }
  }

  /**
   * Check if Forge is properly configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Get OAuth2 access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const params = new URLSearchParams();
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);
      params.append('grant_type', 'client_credentials');
      params.append('scope', 'data:read data:write data:create bucket:create bucket:read code:all');

      const response = await axios.post(
        'https://developer.api.autodesk.com/authentication/v2/token',
        params,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

      console.log('✅ Forge access token obtained');
      
      if (!this.accessToken) {
        throw new Error('Failed to obtain access token');
      }
      
      return this.accessToken;
    } catch (error: any) {
      console.error('❌ Failed to get Forge access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Forge API');
    }
  }

  /**
   * Ensure bucket exists - Fixed with better error handling
   */
  private async ensureBucket(): Promise<void> {
    const token = await this.getAccessToken();

    try {
      // Check if bucket exists
      const response = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/details`,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`✅ Bucket '${this.bucketKey}' exists (region: ${response.data.bucketRegion || 'US'})`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Bucket doesn't exist, create it
        try {
          console.log(`📦 Creating bucket '${this.bucketKey}'...`);
          
          const createResponse = await axios.post(
            'https://developer.api.autodesk.com/oss/v2/buckets',
            {
              bucketKey: this.bucketKey,
              policyKey: 'transient' // Files auto-delete after 24 hours
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log(`✅ Created bucket '${this.bucketKey}' (region: ${createResponse.data.bucketRegion || 'US'})`);
        } catch (createError: any) {
          // Check if bucket already exists (race condition)
          if (createError.response?.status === 409) {
            console.log(`✅ Bucket '${this.bucketKey}' already exists (created by another request)`);
            return;
          }
          
          console.error('❌ Failed to create bucket:', createError.response?.data || createError.message);
          throw new Error(`Failed to create OSS bucket: ${createError.response?.data?.reason || createError.message}`);
        }
      } else {
        console.error('❌ Failed to check bucket:', error.response?.data || error.message);
        throw new Error(`Failed to access OSS bucket: ${error.response?.data?.reason || error.message}`);
      }
    }
  }

  /**
   * Upload RVT file to Forge OSS - Using signed URLs (2024+ method)
   */
  private async uploadToOSS(rvtPath: string, fileName: string): Promise<string> {
    await this.ensureBucket();
    const token = await this.getAccessToken();

    const objectKey = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const fileBuffer = fs.readFileSync(rvtPath);
    const fileSize = fileBuffer.length;

    console.log(`📤 Uploading ${fileName} to OSS (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);
    console.log(`   Bucket: ${this.bucketKey}`);
    console.log(`   Object: ${objectKey}`);

    try {
      // Step 1: Get signed upload URL
      console.log(`   🔑 Getting signed upload URL...`);
      
      const signedUrlResponse = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          params: {
            minutesExpiration: 30
          }
        }
      );

      const uploadUrl = signedUrlResponse.data.urls[0];
      const uploadKey = signedUrlResponse.data.uploadKey;
      
      console.log(`   ✅ Got signed upload URL`);

      // Step 2: Upload file directly to S3 using signed URL
      console.log(`   📤 Uploading to S3...`);
      
      await axios.put(uploadUrl, fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileBuffer.length.toString()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 1800000, // 30 minutes for large files (2GB support)
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2);
            const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2);
            console.log(`   📤 Uploading: ${percentCompleted}% (${loadedMB}/${totalMB} MB)`);
          }
        }
      });

      console.log(`   ✅ Uploaded to S3`);

      // Step 3: Finalize upload (tell OSS that upload is complete)
      console.log(`   🔄 Finalizing upload...`);
      
      await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
        {
          uploadKey: uploadKey
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Upload completed: ${objectKey}`);
      return objectKey;

    } catch (error: any) {
      console.error('❌ Failed to upload to OSS:', error.response?.data || error.message);
      
      // If signed URL method fails, try the old resumable method as last resort
      // This includes network errors (ENOTFOUND, ETIMEDOUT) and API errors (404, 400)
      const isNetworkError = error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';
      const isApiError = error.response?.status === 404 || error.response?.status === 400;
      
      if (isNetworkError || isApiError) {
        console.log('   🔄 Trying legacy resumable upload...');
        return await this.uploadViaResumable(rvtPath, fileName, token, objectKey, fileBuffer, fileSize);
      }
      
      throw new Error(`Failed to upload RVT file: ${error.response?.status} - ${error.response?.data?.developerMessage || error.message}`);
    }
  }

  /**
   * Fallback: Upload using resumable method (for older accounts)
   */
  private async uploadViaResumable(
    rvtPath: string, 
    fileName: string, 
    token: string, 
    objectKey: string,
    fileBuffer: Buffer,
    fileSize: number
  ): Promise<string> {
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks

    try {
      // Start resumable upload
      const startResponse = await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectKey)}/resumable`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const uploadKey = startResponse.data.uploadKey;
      console.log(`   ✅ Resumable upload started`);

      // Upload chunks
      let offset = 0;
      let chunkIndex = 0;
      const totalChunks = Math.ceil(fileSize / chunkSize);

      while (offset < fileSize) {
        const end = Math.min(offset + chunkSize, fileSize);
        const chunk = fileBuffer.slice(offset, end);
        const contentRange = `bytes ${offset}-${end - 1}/${fileSize}`;

        await axios.put(
          `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectKey)}/resumable`,
          chunk,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/octet-stream',
              'Content-Range': contentRange,
              'Session-Id': uploadKey
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 1800000 // 30 minutes for large files
          }
        );

        chunkIndex++;
        const progress = Math.round((chunkIndex / totalChunks) * 100);
        console.log(`   📊 Upload progress: ${progress}% (chunk ${chunkIndex}/${totalChunks})`);
        
        offset = end;
      }

      console.log(`✅ Resumable upload completed: ${objectKey}`);
      return objectKey;

    } catch (error: any) {
      throw new Error(`All upload methods failed: ${error.response?.data?.developerMessage || error.message}`);
    }
  }

  /**
   * Process RVT file from storage URN (ACC files) using Design Automation
   * Uses Direct-to-S3 approach with user token
   */
  async processRVTFromStorageUrn(storageUrn: string, fileName: string, userToken?: string, requestedVersion?: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Forge API not configured. Set FORGE_CLIENT_ID and FORGE_CLIENT_SECRET in .env file');
    }

    try {
      console.log(`🔄 Processing RVT file from storage URN: ${fileName}`);
      console.log(`📦 Storage URN: ${storageUrn}`);

      // Detect or use requested Revit version
      const versionDetector = new RevitVersionDetector();
      let revitVersion: string;
      
      if (requestedVersion) {
        // User specified version - validate it
        const availableVersions = versionDetector.getAvailableVersions();
        if (!availableVersions.includes(requestedVersion)) {
          throw new Error(
            `Requested Revit ${requestedVersion} not available. ` +
            `Available versions: ${availableVersions.join(', ')}. ` +
            `Please create BIMHealthReportActivity-${requestedVersion}.zip using DESIGN_AUTOMATION_BUNDLE_${requestedVersion}.bat`
          );
        }
        revitVersion = requestedVersion;
        console.log(`📌 Using user-specified Revit ${revitVersion} activity`);
      } else {
        // Auto-detect version
        revitVersion = await versionDetector.detectVersion(fileName, storageUrn, userToken);
        console.log(`📌 Using auto-detected Revit ${revitVersion} activity`);
      }

      // Check if this version's ZIP exists
      const availableVersions = versionDetector.getAvailableVersions();
      if (!availableVersions.includes(revitVersion)) {
        throw new Error(
          `Revit ${revitVersion} AppBundle not found. ` +
          `Available versions: ${availableVersions.join(', ')}. ` +
          `Please create BIMHealthReportActivity-${revitVersion}.zip using DESIGN_AUTOMATION_BUNDLE_${revitVersion}.bat in local_plugin folder.`
        );
      }

      // Auto-setup activity if needed
      await this.ensureActivityExists(revitVersion);

      // Prepare output keys
      const timestamp = Date.now();
      const outputJsonKey = `output-${timestamp}.json`;

      // Create work item with Direct-to-S3 approach
      const { workItemId } = await this.createWorkItemWithDirectS3(storageUrn, outputJsonKey, userToken, revitVersion);
      
      // Wait for completion
      const result = await this.waitForCompletion(workItemId);
      
      // Download from OSS (Design Automation writes directly, no S3 sync delay)
      console.log(`📥 Downloading report from OSS...`);
      const reportData = await this.downloadReport(outputJsonKey);
      
      console.log(`✅ Forge processing completed successfully with Revit ${revitVersion}!`);
      return reportData;

    } catch (error: any) {
      console.error('❌ Forge processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Create work item using Direct-to-S3 approach
   * This allows Design Automation to access ACC files with user token
   * Returns both workItemId and the signed S3 URL for direct download (no OSS sync wait needed!)
   */
  private async createWorkItemWithDirectS3(inputStorageUrn: string, outputJsonKey: string, userToken?: string, revitVersion: string = '2024'): Promise<{ workItemId: string; outputJsonKey: string }> {
    // Use user's own activity with version
    const activityId = `${this.clientId}.BIMHealthReportActivity${revitVersion}+prod`;

    // Ensure bucket exists
    await this.ensureBucket();
    
    // Get our 2-legged token (file is now in our bucket)
    const ourToken = await this.getAccessToken();

    // Create output OSS URN (Design Automation will handle S3 internally)
    const outputStorageUrn = `urn:adsk.objects:os.object:${encodeURIComponent(this.bucketKey)}/${encodeURIComponent(outputJsonKey)}`;
    
    console.log(`📤 Output will be written to: ${outputStorageUrn}`);

    // Create work item using signed S3 URL for output
    const workItem = {
      activityId: activityId,
      arguments: {
        rvtFile: {
          url: inputStorageUrn,  // OSS URN from our bucket
          verb: 'get',
          headers: {
            Authorization: `Bearer ${ourToken}`  // Our 2-legged token
          }
        },
        result: {
          url: outputStorageUrn,  // OSS URN - Design Automation handles S3 internally
          verb: 'put',
          headers: {
            Authorization: `Bearer ${ourToken}`  // Our 2-legged token for write access
          }
        }
      }
    };

    try {
      console.log(`🔄 Creating Design Automation work item`);
      console.log(`📦 Activity: ${activityId}`);
      console.log(`📥 Input: ${inputStorageUrn}`);
      console.log(`📤 Output: ${outputStorageUrn} (OSS URN - DA handles S3 internally)`);
      console.log(`🔑 Using OSS URN format (recommended by Autodesk)`);
      
      const response = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/workitems',
        workItem,
        {
          headers: {
            'Authorization': `Bearer ${ourToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const workItemId = response.data.id;
      console.log(`✅ Work item created: ${workItemId}`);
      console.log(`💡 Output will be available in OSS after completion`);
      return { workItemId, outputJsonKey };
    } catch (error: any) {
      console.error('❌ Failed to create work item:', error.response?.data || error.message);
      throw new Error(`Failed to create Design Automation work item: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Get output storage URN for Direct-to-S3
   */
  private async getOutputStorageUrn(objectKey: string): Promise<string> {
    // Ensure bucket exists
    await this.ensureBucket();
    
    const token = await this.getAccessToken();
    
    // For Design Automation output, we need to use signed S3 upload URL
    // First, initiate the upload to get the uploadKey
    try {
      const initiateResponse = await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets/${encodeURIComponent(this.bucketKey)}/objects/${encodeURIComponent(objectKey)}/resumable`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const uploadKey = initiateResponse.data.uploadKey;
      console.log(`📦 Upload initiated, uploadKey: ${uploadKey}`);
      
      // Now get the signed URL for this upload
      const signedResponse = await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets/${encodeURIComponent(this.bucketKey)}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
        {
          minutesExpiration: 60,
          uploadKey: uploadKey
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const signedUrl = signedResponse.data.urls[0];
      console.log(`📦 Output signed URL generated for: ${objectKey}`);
      return signedUrl;
    } catch (error: any) {
      console.error('❌ Failed to generate signed URL:', error.response?.data || error.message);
      throw new Error(`Failed to generate output signed URL: ${error.message}`);
    }
  }

  /**
   * Process RVT file from URL using Design Automation (no upload needed)
   */
  async processRVTFileFromUrl(fileUrl: string, fileName: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Forge API not configured. Set FORGE_CLIENT_ID and FORGE_CLIENT_SECRET in .env file');
    }

    try {
      console.log(`🔄 Processing RVT file with Forge: ${fileName}`);

      // Detect Revit version
      const versionDetector = new RevitVersionDetector();
      const revitVersion = await versionDetector.detectVersion(fileName);
      console.log(`📌 Using Revit ${revitVersion} activity`);

      // Auto-setup activity if needed
      await this.ensureActivityExists(revitVersion);

      // Prepare output keys
      const timestamp = Date.now();
      const outputJsonKey = `output-${timestamp}.json`;

      // Create work item with direct URL (no upload needed)
      const { workItemId, outputDownloadUrl } = await this.createWorkItemFromUrl(fileUrl, outputJsonKey, revitVersion);
      
      // Wait for completion
      const result = await this.waitForCompletion(workItemId);
      
      // Download directly from S3 (instant, no OSS sync wait!)
      console.log(`📥 Downloading report directly from S3...`);
      const reportData = await this.downloadReportDirectFromS3(outputDownloadUrl);
      
      console.log('✅ Forge processing completed successfully!');
      return reportData;

    } catch (error: any) {
      console.error('❌ Forge processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Create work item from URL (no upload needed)
   * Returns both workItemId and the signed S3 URL for direct download
   */
  private async createWorkItemFromUrl(inputUrl: string, outputJsonKey: string, revitVersion: string = '2024'): Promise<{ workItemId: string; outputDownloadUrl: string }> {
    const token = await this.getAccessToken();

    // Use user's own activity with version
    const activityId = `${this.clientId}.BIMHealthReportActivity${revitVersion}+prod`;

    // Get signed URL for output (same URL works for both upload and download)
    const outputJsonSignedUrl = await this.getSignedUploadUrl(outputJsonKey);

    const workItem = {
      activityId: activityId,
      arguments: {
        rvtFile: {
          url: inputUrl  // Use the signed URL directly from ACC
        },
        result: {
          verb: 'put',
          url: outputJsonSignedUrl
        }
      }
    };

    try {
      console.log(`🔄 Creating Design Automation work item with activity: ${activityId}`);
      console.log(`💡 Will download directly from S3 (no OSS sync wait needed)`);
      const response = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/workitems',
        workItem,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Work item created: ${response.data.id}`);
      return { workItemId: response.data.id, outputDownloadUrl: outputJsonSignedUrl };
    } catch (error: any) {
      console.error('❌ Failed to create work item:', error.response?.data || error.message);
      throw new Error('Failed to create Design Automation work item');
    }
  }

  /**
   * Process RVT file using Design Automation
   * This runs your BIM Health plugin in the cloud
   * Now uses Direct-to-S3 for both input and output
   */
  async processRVTFile(rvtPath: string, fileName: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Forge API not configured. Set FORGE_CLIENT_ID and FORGE_CLIENT_SECRET in .env file');
    }

    try {
      console.log(`🔄 Processing RVT file with Forge: ${fileName}`);

      // Step 1: Upload RVT to OSS
      const inputObjectKey = await this.uploadToOSS(rvtPath, fileName);
      
      // Step 2: Create OSS URN for input (file already uploaded)
      const inputStorageUrn = `urn:adsk.objects:os.object:${this.bucketKey}/${inputObjectKey}`;

      // Step 3: Detect REAL Revit version
      let detectedVersion = await this.detectRevitVersionFromFile(inputStorageUrn);
      
      // Get all available versions
      const versionDetector = new RevitVersionDetector();
      const availableVersions = versionDetector.getAvailableVersions();
      
      if (availableVersions.length === 0) {
        throw new Error('No Revit AppBundle ZIP files found. Please create bundles first.');
      }
      
      // Smart version order: 
      let versionsToTry: string[];
      
      if (detectedVersion) {
        // Version DETECTED - ONLY try detected version, NO fallback!
        versionsToTry = [detectedVersion];
        console.log(`✅ Version detected: Revit ${detectedVersion}`);
        console.log(`📋 Will use ONLY detected version: ${detectedVersion}`);
        console.log(`💡 No fallback - if this fails, the file cannot be processed`);
      } else {
        // Version NOT detected - try all available versions (newest first)
        versionsToTry = [...availableVersions]; // Already sorted newest to oldest
        console.log(`⚠️  Could not detect version from file`);
        console.log(`📋 Will try all available versions: ${versionsToTry.join(' → ')}`);
        console.log(`💡 Starting with most recent: ${versionsToTry[0]}`);
      }

      // Try each version until one succeeds
      let lastError: any = null;
      
      for (const tryVersion of versionsToTry) {
        try {
          console.log(`🔧 Trying Revit ${tryVersion}...`);
          
          // Auto-setup activity if needed
          await this.ensureActivityExists(tryVersion);
          
          // Prepare output key
          const timestamp = Date.now();
          const outputJsonKey = `output-${timestamp}.json`;

          // Create work item
          const { workItemId } = await this.createWorkItemWithDirectS3(inputStorageUrn, outputJsonKey, undefined, tryVersion);
          
          // Wait for completion
          const result = await this.waitForCompletion(workItemId);
          
          // Download from OSS (Design Automation writes directly, no S3 sync delay)
          console.log(`📥 Downloading report from OSS...`);
          const reportData = await this.downloadReport(outputJsonKey);
          
          console.log(`✅ SUCCESS! File processed with Revit ${tryVersion}`);
          return reportData;
          
        } catch (versionError: any) {
          lastError = versionError;
          console.log(`❌ Revit ${tryVersion} failed: ${versionError.message}`);
          
          // If it's the last version, throw the error
          if (tryVersion === versionsToTry[versionsToTry.length - 1]) {
            throw new Error(
              `File could not be processed with any Revit version (tried: ${versionsToTry.join(', ')}).\n` +
              `Last error: ${versionError.message}`
            );
          }
          
          // Otherwise continue to next version
          console.log(`⏭️  Trying next version...`);
        }
      }
      
      // Should not reach here, but just in case
      throw lastError || new Error('Failed to process file with any version');

    } catch (error: any) {
      console.error('❌ Forge processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Detect REAL Revit version from uploaded file
   * Uses ONLY Model Derivative API (EXACT same as ACC browser)
   */
  private async detectRevitVersionFromFile(storageUrn: string): Promise<string | null> {
    try {
      console.log('🔍 Detecting REAL Revit version using Forge Model Derivative API...');
      
      const token = await this.getAccessToken();
      
      // Encode storage URN for Forge API
      const encodedStorageUrn = Buffer.from(storageUrn)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      // Start translation job to get metadata (this is fast, doesn't fully translate)
      try {
        await axios.post(
          'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
          {
            input: {
              urn: encodedStorageUrn
            },
            output: {
              formats: [{ type: 'svf', views: ['2d', '3d'] }]
            }
          },
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('📋 Translation job started, waiting for manifest...');
      } catch (e: any) {
        // Job might already exist, that's ok
        console.log(`ℹ️  Translation job already exists or error: ${e.message}`);
      }
      
      // Wait for manifest to be ready (2 minutes for large files)
      console.log('⏳ Waiting 2 minutes for manifest to be ready...');
      await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes
      
      // Get manifest which contains file metadata
      const manifestResponse = await axios.get(
        `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodedStorageUrn}/manifest`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log(`📋 Manifest status: ${manifestResponse.data.status}`);
      
      // Check derivatives for Revit version info
      const derivatives = manifestResponse.data.derivatives || [];
      console.log(`📋 Found ${derivatives.length} derivatives`);
      
      let detectedVersion: string | null = null;
      
      for (const derivative of derivatives) {
        // Check in children (where Revit metadata usually is)
        const children = derivative.children || [];
        for (const child of children) {
          const name = child.name || '';
          
          // Revit version often in name like "Revit 2023"
          const versionMatch = name.match(/20(21|22|23|24|25|26)/);
          if (versionMatch) {
            detectedVersion = versionMatch[0];
            console.log(`✅ REAL Revit version detected: ${detectedVersion} (from derivative name)`);
            return detectedVersion;
          }
        }
        
        if (detectedVersion) break;
        
        const properties = derivative.properties || {};
        
        // Look for Revit version in properties
        if (properties['Document Information']) {
          const docInfo = properties['Document Information'];
          
          const revitVersion = docInfo['RVTVersion'] || docInfo['Revit Version'] || 
                              docInfo['Application Version'] || docInfo['Revit Build'];
          
          if (revitVersion) {
            // Convert to string if it's a number
            const versionStr = String(revitVersion);
            const versionMatch = versionStr.match(/20(21|22|23|24|25|26)/);
            if (versionMatch) {
              detectedVersion = versionMatch[0];
              console.log(`✅ REAL Revit version detected: ${detectedVersion} (from RVTVersion property)`);
              return detectedVersion;
            }
          }
        }
        
        // Also check in messages
        if (derivative.messages) {
          for (const msg of derivative.messages) {
            const text = msg.message || '';
            const versionMatch = text.match(/Revit 20(21|22|23|24|25|26)/i);
            if (versionMatch) {
              detectedVersion = `20${versionMatch[1]}`;
              console.log(`✅ REAL Revit version detected: ${detectedVersion} (from messages)`);
              return detectedVersion;
            }
          }
        }
      }
      
      if (!detectedVersion) {
        console.log(`⚠️  Revit version not found in manifest (status: ${manifestResponse.data.status})`);
        console.log(`💡 Manifest might not be ready yet, will try all versions`);
      }
      
      return detectedVersion;
      
    } catch (error: any) {
      console.log(`⚠️  Version detection error: ${error.message}`);
      return null;
    }
  }

  /**
   * Ensure activity exists for user (auto-setup on first use)
   */
  private async ensureActivityExists(revitVersion: string = '2024'): Promise<void> {
    const setupService = new ActivitySetupService(this.clientId, this.clientSecret);
    
    const exists = await setupService.checkActivityExists(revitVersion);
    
    if (!exists) {
      console.log(`🔧 First-time setup: Creating activity for Revit ${revitVersion} for your account...`);
      await setupService.setupActivity(revitVersion);
    }
  }

  /**
   * Create Design Automation work item
   */
  private async createWorkItem(inputObjectKey: string, outputHtmlKey: string, outputJsonKey: string, revitVersion: string = '2024'): Promise<string> {
    const token = await this.getAccessToken();

    // Use user's own activity with version
    const activityId = `${this.clientId}.BIMHealthReportActivity${revitVersion}+prod`;

    // Get signed URLs for input and outputs
    const inputSignedUrl = await this.getSignedDownloadUrl(inputObjectKey);
    const outputJsonSignedUrl = await this.getSignedUploadUrl(outputJsonKey);

    const workItem = {
      activityId: activityId,
      arguments: {
        rvtFile: {
          url: inputSignedUrl
        },
        result: {
          verb: 'put',
          url: outputJsonSignedUrl
        }
      }
    };

    try {
      console.log(`🔄 Creating Design Automation work item with activity: ${activityId}`);
      const response = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/workitems',
        workItem,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Work item created: ${response.data.id}`);
      return response.data.id;
    } catch (error: any) {
      console.error('❌ Failed to create work item:', error.response?.data || error.message);
      throw new Error('Failed to create Design Automation work item');
    }
  }

  /**
   * Get signed download URL for OSS object
   */
  private async getSignedDownloadUrl(objectKey: string): Promise<string> {
    const token = await this.getAccessToken();
    
    try {
      const response = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${objectKey}/signeds3download`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          params: {
            minutesExpiration: 60  // 60 minutes instead of default 2 minutes
          }
        }
      );
      
      return response.data.url;
    } catch (error: any) {
      console.error('❌ Failed to get signed download URL:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get signed upload URL for OSS object
   */
  private async getSignedUploadUrl(objectKey: string): Promise<string> {
    const token = await this.getAccessToken();
    
    try {
      // Use signeds3upload endpoint to get a writable signed URL
      const response = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          params: {
            minutesExpiration: 60
          }
        }
      );
      
      // This returns a signed URL that can be used for uploading
      const signedUrl = response.data.urls?.[0] || response.data.url;
      
      if (!signedUrl) {
        throw new Error('No signed URL returned');
      }
      
      console.log(`✅ Got signed S3 upload URL (expires in 60 min)`);
      return signedUrl;
    } catch (error: any) {
      console.error('❌ Failed to get signed upload URL:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Wait for work item completion
   */
  private async waitForCompletion(workItemId: string): Promise<any> {
    const token = await this.getAccessToken();
    const maxAttempts = 2160; // 3 hours max (2160 attempts × 5 seconds = 10800 seconds = 3 hours)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `https://developer.api.autodesk.com/da/us-east/v3/workitems/${workItemId}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        const status = response.data.status;
        const elapsedMinutes = Math.floor((attempts * 5) / 60);
        const elapsedSeconds = (attempts * 5) % 60;
        console.log(`⏳ Work item status: ${status} (${elapsedMinutes}m ${elapsedSeconds}s elapsed, attempt ${attempts + 1}/${maxAttempts})`);

        if (status === 'success') {
          console.log('✅ Work item completed successfully');
          return response.data;
        } else if (status === 'failed' || status === 'cancelled' || status === 'failedInstructions' || status === 'failedDownload' || status === 'failedUpload') {
          // Download error report
          console.log(`❌ Work item ${status}`);
          console.log(`📄 Report URL: ${response.data.reportUrl}`);
          console.log(`📊 Work Item ID: ${workItemId}`);
          
          let errorDetails = '';
          try {
            const reportResponse = await axios.get(response.data.reportUrl);
            console.log('\n========== DESIGN AUTOMATION ERROR REPORT ==========');
            console.log(JSON.stringify(reportResponse.data, null, 2));
            console.log('====================================================\n');
            
            // Extract key error information
            if (reportResponse.data) {
              const report = reportResponse.data;
              
              // Check for common error patterns
              if (report.reportItems) {
                const errors = report.reportItems.filter((item: any) => 
                  item.message && (item.message.includes('error') || item.message.includes('exception'))
                );
                
                if (errors.length > 0) {
                  errorDetails = '\n\nKey Errors:\n' + errors.map((e: any) => `  - ${e.message}`).join('\n');
                }
              }
              
              // Check for plugin-specific errors
              if (report.toString().includes('plugin-error.txt')) {
                errorDetails += '\n\n⚠️ Plugin execution error detected. Check plugin code.';
              }
            }
            
            throw new Error(
              `Work item ${status}. ${errorDetails}\n\n` +
              `Work Item ID: ${workItemId}\n` +
              `Report URL: ${response.data.reportUrl}\n\n` +
              `Troubleshooting:\n` +
              `1. Check if the RVT file is valid and not corrupted\n` +
              `2. Verify the AppBundle has all required DLLs\n` +
              `3. Check the activity configuration\n` +
              `4. Use /api/acc/debug-workitem/${workItemId} endpoint for detailed report`
            );
          } catch (reportError: any) {
            if (reportError.message.includes('Work item')) {
              throw reportError; // Re-throw our formatted error
            }
            throw new Error(
              `Work item ${status}. Could not download error report.\n\n` +
              `Work Item ID: ${workItemId}\n` +
              `Report URL: ${response.data.reportUrl}\n\n` +
              `Use /api/acc/debug-workitem/${workItemId} endpoint to get detailed error information.`
            );
          }
        }

        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      } catch (error: any) {
        console.error('❌ Error checking work item status:', error.message);
        throw error;
      }
    }

    throw new Error('Work item timed out');
  }

  /**
   * Download generated report from OSS using signed URL
   */
  /**
   * Download report directly from S3 using signed URL
   * This is the REAL solution - no need to wait for OSS propagation
   */
  private async downloadFromS3(signedUrl: string): Promise<any> {
    try {
      console.log(`📥 Downloading from S3 (signed URL)...`);
      
      // Download directly from S3 - no auth needed, URL is pre-signed
      const response = await axios.get(signedUrl, {
        responseType: 'json'
      });
      
      console.log('✅ Report downloaded successfully from S3');
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Failed to download from S3:', error.response?.data || error.message);
      throw new Error(`Failed to download report from S3: ${error.message}`);
    }
  }

  /**
   * Download report directly from S3 using signed URL (no OSS sync wait!)
   * This is MUCH faster than waiting for S3 → OSS sync (instant vs 2-5 minutes)
   */
  private async downloadReportDirectFromS3(signedS3Url: string): Promise<any> {
    try {
      console.log(`📥 Downloading report directly from S3 (instant!)...`);
      
      // Try multiple times with short delays
      let attempts = 0;
      const maxAttempts = 5;
      let lastError: any = null;
      
      while (attempts < maxAttempts) {
        try {
          // Download using signed URL (no auth needed)
          const response = await axios.get(signedS3Url, {
            responseType: 'json',
            timeout: 30000 // 30 second timeout
          });
          
          console.log('✅ Report downloaded successfully from S3 (instant, no OSS sync wait!)');
          
          // Return JSON data directly
          return response.data;
        } catch (error: any) {
          lastError = error;
          attempts++;
          
          // If file not found or connection reset, wait a bit (Design Automation might still be writing)
          if ((error.response?.status === 404 || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') && attempts < maxAttempts) {
            const waitTime = 5000; // 5 seconds between retries
            console.log(`⏳ File not ready yet, waiting ${waitTime/1000}s before retry (attempt ${attempts}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            throw error;
          }
        }
      }
      
      // If we get here, all attempts failed
      throw lastError;
      
    } catch (error: any) {
      console.error('❌ Failed to download report from S3:', error.response?.data || error.message);
      
      // If file not found after all retries
      if (error.response?.status === 404) {
        throw new Error(
          `Output file not found in S3 after ${5} attempts (25 seconds of waiting).\n` +
          `The Design Automation work item may have failed to generate the output file.\n\n` +
          `Check the work item logs for errors.`
        );
      }
      
      throw new Error(`Failed to download generated report: ${error.message}`);
    }
  }

  /**
   * Download report with retry logic for S3→OSS sync delay
   */
  private async downloadReportWithRetry(objectKey: string, maxRetries: number = 12): Promise<any> {
    console.log(`📥 Downloading report from OSS: ${objectKey}`);
    console.log(`⏳ Note: S3→OSS sync can take 30-60 seconds, will retry if needed...`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const token = await this.getAccessToken();
        
        const response = await axios.get(
          `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${objectKey}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'json',
            timeout: 30000
          }
        );
        
        console.log(`✅ Report downloaded successfully from OSS (attempt ${attempt}/${maxRetries})`);
        return response.data;
        
      } catch (error: any) {
        if (error.response?.status === 404 && attempt < maxRetries) {
          const waitTime = 5000; // 5 seconds between retries
          console.log(`⏳ File not synced yet, waiting ${waitTime/1000}s before retry (attempt ${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (error.response?.status === 404) {
          throw new Error(
            `Output file not found in OSS after ${maxRetries} attempts (${maxRetries * 5} seconds).\n` +
            `Object key: ${objectKey}\n\n` +
            `S3→OSS sync is taking longer than expected. The file should appear eventually.`
          );
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Failed to download report after all retries');
  }

  private async downloadReport(objectKey: string): Promise<any> {
    try {
      console.log(`📥 Downloading report: ${objectKey}`);
      
      const token = await this.getAccessToken();
      
      // Use new signeds3download endpoint (legacy direct download is deprecated)
      console.log(`🔑 Getting signed S3 download URL...`);
      const signedUrlResponse = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            minutesExpiration: 10  // 10 minutes expiration
          }
        }
      );
      
      const signedDownloadUrl = signedUrlResponse.data.url;
      console.log(`✅ Got signed download URL`);
      
      // Download from S3 using signed URL
      console.log(`📥 Downloading from S3...`);
      const response = await axios.get(signedDownloadUrl, {
        responseType: 'json',
        timeout: 30000
      });
      
      console.log('✅ Report downloaded successfully from S3');
      return response.data;
      
    } catch (error: any) {
      console.error('❌ Failed to download report:', error.response?.data || error.message);
      
      // If 404, file not found
      if (error.response?.status === 404) {
        throw new Error(
          `Output file not found in OSS bucket.\n` +
          `Object key: ${objectKey}\n\n` +
          `The file may not have been created by Design Automation.`
        );
      }
      
      throw new Error('Failed to download generated report');
    }
  }

  /**
   * Process IFC file from URL using Design Automation (no upload needed)
   */
  async processIFCFileFromUrl(fileUrl: string, fileName: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Forge API not configured. Set FORGE_CLIENT_ID and FORGE_CLIENT_SECRET in .env file');
    }

    try {
      console.log(`🔄 Processing IFC file with Forge: ${fileName}`);

      // Auto-setup IFC activity if needed
      await this.ensureIFCActivityExists();

      // Prepare output keys
      const timestamp = Date.now();
      const outputJsonKey = `ifc-output-${timestamp}.json`;

      // Create work item with direct URL (no upload needed)
      const workItemId = await this.createIFCWorkItemFromUrl(fileUrl, outputJsonKey);
      
      // Wait for completion
      await this.waitForCompletion(workItemId);
      
      // Download JSON report
      const reportData = await this.downloadReport(outputJsonKey);
      
      console.log('✅ Forge IFC processing completed successfully!');
      return reportData;

    } catch (error: any) {
      console.error('❌ Forge IFC processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Process IFC file from storage URN using Design Automation
   * Uses Direct-to-S3 approach with user token
   */
  async processIFCFromStorageUrn(storageUrn: string, fileName: string, userToken?: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Forge API not configured. Set FORGE_CLIENT_ID and FORGE_CLIENT_SECRET in .env file');
    }

    try {
      console.log(`🔄 Processing IFC file from storage URN: ${fileName}`);
      console.log(`📦 Storage URN: ${storageUrn}`);

      // Auto-setup IFC activity if needed
      await this.ensureIFCActivityExists();

      // Prepare output keys
      const timestamp = Date.now();
      const outputJsonKey = `ifc-output-${timestamp}.json`;

      // Create work item with Direct-to-S3 approach for IFC
      const workItemId = await this.createIFCWorkItemWithDirectS3(storageUrn, outputJsonKey, userToken);

      // Wait for completion
      const result = await this.waitForCompletion(workItemId);

      // Download JSON report
      const reportData = await this.downloadReport(outputJsonKey);

      console.log('✅ Forge IFC processing completed successfully!');
      return reportData;

    } catch (error: any) {
      console.error('❌ Forge IFC processing failed:', error.message);
      throw error;
    }
  }


  /**
   * Process IFC file using Design Automation
   */
  async processIFCFile(ifcPath: string, fileName: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Forge API not configured. Set FORGE_CLIENT_ID and FORGE_CLIENT_SECRET in .env file');
    }

    try {
      console.log(`🔄 Processing IFC file with Forge: ${fileName}`);

      // Auto-setup IFC activity if needed
      await this.ensureIFCActivityExists();

      // Step 1: Upload IFC to OSS
      const inputObjectKey = await this.uploadToOSS(ifcPath, fileName);
      
      // Step 2: Prepare output keys
      const timestamp = Date.now();
      const outputJsonKey = `ifc-output-${timestamp}.json`;

      // Step 3: Create work item
      const workItemId = await this.createIFCWorkItem(inputObjectKey, outputJsonKey);
      
      // Step 4: Wait for completion
      await this.waitForCompletion(workItemId);
      
      // Step 5: Download JSON report
      const reportData = await this.downloadReport(outputJsonKey);
      
      console.log('✅ Forge IFC processing completed successfully!');
      return reportData;

    } catch (error: any) {
      console.error('❌ Forge IFC processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Ensure IFC activity exists for user (auto-setup on first use)
   */
  private async ensureIFCActivityExists(): Promise<void> {
    const setupService = new ActivitySetupService(this.clientId, this.clientSecret);
    
    const exists = await setupService.checkIFCActivityExists();
    
    if (!exists) {
      console.log('🔧 First-time setup: Creating IFC activity for your account...');
      await setupService.setupIFCActivity();
    }
  }

  /**
   * Create IFC work item using Direct-to-S3 approach
   */
  private async createIFCWorkItemWithDirectS3(inputStorageUrn: string, outputJsonKey: string, userToken?: string): Promise<string> {
    // Use user's own IFC activity
    const activityId = `${this.clientId}.BIMHealthIFCActivityV2+prod`;

    // Ensure bucket exists
    await this.ensureBucket();

    // Get signed S3 upload URL for output
    const outputSignedUrl = await this.getSignedUploadUrl(outputJsonKey);
    
    // Get our 2-legged token (file is now in our bucket)
    const ourToken = await this.getAccessToken();

    // Create work item using signed S3 URL for output
    const workItem = {
      activityId: activityId,
      arguments: {
        ifcFile: {
          url: inputStorageUrn,  // OSS URN from our bucket
          verb: 'get',
          headers: {
            Authorization: `Bearer ${ourToken}`  // Our 2-legged token
          }
        },
        result: {
          url: outputSignedUrl,  // Direct S3 signed URL
          verb: 'put'
          // No Authorization header for signed S3 URLs
        }
      }
    };

    try {
      console.log(`🔄 Creating Design Automation IFC work item`);
      console.log(`📦 Activity: ${activityId}`);
      console.log(`📥 Input: ${inputStorageUrn}`);
      console.log(`📤 Output: Direct S3 signed URL`);
      console.log(`🔑 Using signed S3 URL for output (no auth header needed)`);
      
      const response = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/workitems',
        workItem,
        {
          headers: {
            'Authorization': `Bearer ${ourToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const workItemId = response.data.id;
      console.log(`✅ IFC work item created: ${workItemId}`);
      return workItemId;
    } catch (error: any) {
      console.error('❌ Failed to create IFC work item:', error.response?.data || error.message);
      throw new Error(`Failed to create Design Automation IFC work item: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Create IFC work item from URL (no upload needed)
   */
  private async createIFCWorkItemFromUrl(inputUrl: string, outputJsonKey: string): Promise<string> {
    const token = await this.getAccessToken();

    // Use user's own IFC activity
    const activityId = `${this.clientId}.BIMHealthIFCActivityV2+prod`; // Changed from V1 to V2

    // Get signed URL for output
    const outputJsonSignedUrl = await this.getSignedUploadUrl(outputJsonKey);

    const workItem = {
      activityId: activityId,
      arguments: {
        ifcFile: {
          url: inputUrl  // Use the signed URL directly from ACC
        },
        result: {
          verb: 'put',
          url: outputJsonSignedUrl
        }
      }
    };

    try {
      console.log(`🔄 Creating Design Automation work item with IFC activity: ${activityId}`);
      const response = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/workitems',
        workItem,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ IFC work item created: ${response.data.id}`);
      return response.data.id;
    } catch (error: any) {
      console.error('❌ Failed to create IFC work item:', error.response?.data || error.message);
      throw new Error('Failed to create Design Automation IFC work item');
    }
  }

  /**
   * Create IFC Design Automation work item
   */
  private async createIFCWorkItem(inputObjectKey: string, outputJsonKey: string): Promise<string> {
    const token = await this.getAccessToken();

    // Use user's own IFC activity
    const activityId = `${this.clientId}.BIMHealthIFCActivityV2+prod`; // Changed from V1 to V2

    // Get signed URLs for input and outputs
    const inputSignedUrl = await this.getSignedDownloadUrl(inputObjectKey);
    const outputJsonSignedUrl = await this.getSignedUploadUrl(outputJsonKey);

    const workItem = {
      activityId: activityId,
      arguments: {
        ifcFile: {
          url: inputSignedUrl
        },
        result: {
          verb: 'put',
          url: outputJsonSignedUrl
        }
      }
    };

    try {
      console.log(`🔄 Creating Design Automation work item with IFC activity: ${activityId}`);
      const response = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/workitems',
        workItem,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ IFC work item created: ${response.data.id}`);
      return response.data.id;
    } catch (error: any) {
      console.error('❌ Failed to create IFC work item:', error.response?.data || error.message);
      throw new Error('Failed to create Design Automation IFC work item');
    }
  }
}
