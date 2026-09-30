import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { ActivitySetupService } from '@/lib/services/activitySetup';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 7200; // 120 minutes (2 hours)

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; itemId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { projectId, itemId } = params;
    const { clientId, clientSecret, fileName } = await request.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing clientId or clientSecret' },
        { status: 400 }
      );
    }

    console.log(`🔄 Processing ACC file: ${fileName}`);
    console.log(`   Project: ${projectId}`);
    console.log(`   Item: ${itemId}`);

    // Get 2-legged token for Design Automation
    const daTokenResponse = await axios.post(
      'https://developer.api.autodesk.com/authentication/v2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'code:all data:read data:write bucket:create bucket:read'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const daToken = daTokenResponse.data.access_token;

    // Get file info and download URL
    // If itemId is a lineage, we need to get the tip version first
    let versionId = itemId;
    let storageUrn: string | null = null;
    
    if (itemId.includes('dm.lineage')) {
      console.log(`   📌 Item is a lineage, fetching tip version...`);
      
      // Clean the item ID and use simple URL encoding (not Base64)
      const cleanItemId = itemId.split('?')[0];
      const encodedItemId = encodeURIComponent(cleanItemId);
      
      console.log(`   🔍 Clean item ID: ${cleanItemId}`);
      
      // Get the item to find its tip version
      const itemResponse = await axios.get(
        `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodedItemId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      versionId = itemResponse.data.data.relationships?.tip?.data?.id;
      
      if (!versionId) {
        throw new Error('Could not get tip version from item');
      }
      
      // Remove query parameters from version ID (e.g., ?version=1)
      versionId = versionId.split('?')[0];
      
      console.log(`   ✅ Got tip version: ${versionId}`);
      
      // Check if storage URN is in included data
      if (itemResponse.data.included) {
        for (const item of itemResponse.data.included) {
          if (item.type === 'versions') {
            storageUrn = item.relationships?.storage?.data?.id;
            if (storageUrn) {
              console.log(`   ✅ Got storage URN from included data: ${storageUrn}`);
              break;
            }
          }
        }
      }
    } else if (!itemId.includes('urn:')) {
      // If it's just an ID, convert to version URN
      versionId = `urn:adsk.wipprod:fs.file:vf.${itemId}`;
    }
    
    console.log(`   📄 Using version ID: ${versionId}`);
    
    // Only fetch version info if we don't have storage URN yet
    if (!storageUrn) {
      console.log(`   📋 Fetching version info to get storage URN...`);
      
      // For version endpoints, use Base64 URL-safe encoding
      const encodedVersionForInfo = Buffer.from(versionId)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      try {
        const fileInfoResponse = await axios.get(
          `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodedVersionForInfo}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        storageUrn = fileInfoResponse.data.data.relationships?.storage?.data?.id;
        if (!storageUrn) {
          throw new Error('Could not get storage URN from file');
        }

        console.log(`   📦 Storage URN: ${storageUrn}`);
      } catch (versionError: any) {
        console.error(`   ❌ Version fetch failed:`, versionError.response?.data || versionError.message);
        throw versionError;
      }
    }
    
    if (!storageUrn) {
      throw new Error('Could not get storage URN');
    }

    console.log(`   ✅ Ready to process with storage URN: ${storageUrn}`);

    // Detect REAL Revit version using Forge Model Derivative API
    let detectedVersion = null;
    
    try {
      console.log(`   🔍 Detecting REAL Revit version using Forge API...`);
      
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
        console.log(`   📋 Translation job started, waiting for manifest...`);
      } catch (e: any) {
        // Job might already exist, that's ok
        console.log(`   ℹ️  Translation job already exists or error: ${e.message}`);
      }
      
      // Wait longer for manifest to be ready (10 seconds)
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Get manifest which contains file metadata
      const manifestResponse = await axios.get(
        `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodedStorageUrn}/manifest`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log(`   📋 Manifest status: ${manifestResponse.data.status}`);
      
      // Check derivatives for Revit version info
      const derivatives = manifestResponse.data.derivatives || [];
      console.log(`   📋 Found ${derivatives.length} derivatives`);
      
      for (const derivative of derivatives) {
        // Check in children (where Revit metadata usually is)
        const children = derivative.children || [];
        for (const child of children) {
          const name = child.name || '';
          const guid = child.guid || '';
          
          console.log(`   🔍 Checking child: ${name} (${guid})`);
          
          // Revit version often in name like "Revit 2023"
          const versionMatch = name.match(/20(21|22|23|24|25|26)/);
          if (versionMatch) {
            detectedVersion = versionMatch[0];
            console.log(`   ✅ REAL Revit version detected: ${detectedVersion} (from derivative name)`);
            break;
          }
        }
        
        if (detectedVersion) break;
        
        const properties = derivative.properties || {};
        
        // Look for Revit version in properties
        if (properties['Document Information']) {
          const docInfo = properties['Document Information'];
          console.log(`   📋 Document Info:`, JSON.stringify(docInfo, null, 2));
          
          const revitVersion = docInfo['RVTVersion'] || docInfo['Revit Version'] || docInfo['Application Version'] || docInfo['Revit Build'];
          
          if (revitVersion) {
            // Convert to string if it's a number
            const versionStr = String(revitVersion);
            const versionMatch = versionStr.match(/20(21|22|23|24|25|26)/);
            if (versionMatch) {
              detectedVersion = versionMatch[0];
              console.log(`   ✅ REAL Revit version detected: ${detectedVersion} (from RVTVersion property)`);
              break;
            }
          }
        }
        
        // Also check in messages
        if (derivative.messages) {
          for (const msg of derivative.messages) {
            const text = String(msg.message || ''); // Convert to string to avoid match error
            const versionMatch = text.match(/Revit 20(23|24|25|26|27)/i);
            if (versionMatch) {
              detectedVersion = `20${versionMatch[1]}`;
              console.log(`   ✅ REAL Revit version detected: ${detectedVersion} (from messages)`);
              break;
            }
          }
        }
      }
      
      if (!detectedVersion) {
        console.log(`   ⚠️  Revit version not found in manifest (status: ${manifestResponse.data.status})`);
        console.log(`   💡 Manifest might not be ready yet, will try all versions`);
      }
    } catch (forgeError: any) {
      console.log(`   ⚠️  Forge API error: ${forgeError.message}`);
    }
    
    // If not detected, use default and try all
    if (!detectedVersion) {
      detectedVersion = '2023';  // Default to 2023 (most stable)
      console.log(`   💡 Will try all versions starting with ${detectedVersion}`);
    } else {
      // Validate detected version is in supported range (2023-2027)
      const year = parseInt(detectedVersion);
      if (year < 2023 || year > 2027) {
        console.log(`   ⚠️  Detected version ${detectedVersion} not in supported range (2023-2027)`);
        detectedVersion = '2023';  // Fallback to 2023
        console.log(`   💡 Using default version ${detectedVersion} instead`);
      }
    }

    // Create output bucket
    const bucketKey = `bim_health_${clientId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    try {
      await axios.post(
        'https://developer.api.autodesk.com/oss/v2/buckets',
        {
          bucketKey,
          policyKey: 'transient'
        },
        {
          headers: { Authorization: `Bearer ${daToken}` }
        }
      );
    } catch (e: any) {
      // Bucket already exists
    }

    const reportId = crypto.randomBytes(16).toString('hex');
    const outputFileName = `report_${reportId}.json`;

    // Smart version order: detected version first, then sequential (2023-2027)
    const versionsToTry = [detectedVersion];
    ['2023', '2024', '2025', '2026', '2027'].forEach(v => {
      if (v !== detectedVersion) versionsToTry.push(v);
    });
    
    console.log(`   📋 Will try versions in order: ${versionsToTry.join(' → ')}`);
    console.log(`   💡 Detected version ${detectedVersion} will be tried first`);

    const activityService = new ActivitySetupService(clientId, clientSecret);
    let workItemSuccess = false;
    let reportData: any = null;
    let actualVersion = '';

    for (const tryVersion of versionsToTry) {
      try {
        console.log(`   🔧 Trying Revit ${tryVersion}...`);
        
        // Ensure activity exists
        const activityExists = await activityService.checkActivityExists(tryVersion);
        if (!activityExists) {
          console.log(`   📦 Setting up activity for Revit ${tryVersion}...`);
          await activityService.setupActivity(tryVersion);
        }

        // Create work item using OSS URN format (recommended by Autodesk)
        const outputStorageUrn = `urn:adsk.objects:os.object:${encodeURIComponent(bucketKey)}/${encodeURIComponent(outputFileName)}`;
        
        const workItemSpec = {
          activityId: `${clientId}.BIMHealthReportActivity${tryVersion}+prod`,
          arguments: {
            rvtFile: {
              url: storageUrn,  // Use storage URN directly
              verb: 'get',
              headers: {
                Authorization: `Bearer ${token}`  // User token for ACC file access
              }
            },
            result: {
              url: outputStorageUrn,  // OSS URN format (Design Automation handles S3 internally)
              verb: 'put',
              headers: {
                Authorization: `Bearer ${daToken}`  // DA token for output
              }
            }
          }
        };

        console.log(`   📤 Creating work item...`);
        console.log(`   📥 Input: ${storageUrn}`);
        console.log(`   📤 Output: ${outputStorageUrn} (OSS URN format)`);

        const workItemResponse = await axios.post(
          'https://developer.api.autodesk.com/da/us-east/v3/workitems',
          workItemSpec,
          {
            headers: { Authorization: `Bearer ${daToken}` }
          }
        );

        const workItemId = workItemResponse.data.id;
        console.log(`   ✅ Work item created: ${workItemId}`);
        
        // Log report URL for debugging
        const reportUrl = `https://developer.api.autodesk.com/da/us-east/v3/workitems/${workItemId}`;
        console.log(`   📋 Work item details: ${reportUrl}`);

        // Poll for completion
        let status = 'pending';
        let attempts = 0;
        const maxAttempts = 720;  // 60 minutes timeout (720 × 5 seconds)

        console.log(`   ⏳ Polling for completion (max 60 minutes)...`);

        while (status === 'pending' || status === 'inprogress') {
          if (attempts >= maxAttempts) {
            throw new Error('Timeout - work item took longer than 60 minutes');
          }

          await new Promise(resolve => setTimeout(resolve, 5000));

          const statusResponse = await axios.get(
            `https://developer.api.autodesk.com/da/us-east/v3/workitems/${workItemId}`,
            {
              headers: { Authorization: `Bearer ${daToken}` }
            }
          );

          status = statusResponse.data.status;
          attempts++;
          
          // Log every 30 seconds
          if (attempts % 6 === 0) {
            console.log(`   ⏳ Still processing... (${attempts * 5}s elapsed, status: ${status})`);
          }
        }

        console.log(`   📊 Final status: ${status} (took ${attempts * 5}s)`);
        
        // If failed, get the report to see why
        if (status === 'failed' || status === 'cancelled') {
          try {
            const reportResponse = await axios.get(
              `https://developer.api.autodesk.com/da/us-east/v3/workitems/${workItemId}`,
              {
                headers: { Authorization: `Bearer ${daToken}` }
              }
            );
            console.log(`   ❌ Work item report:`, JSON.stringify(reportResponse.data.reportUrl, null, 2));
          } catch (e) {
            // Ignore
          }
          throw new Error(`Work item ${status}`);
        }

        if (status === 'success') {
          // Download result using new signeds3download endpoint
          console.log(`   📥 Downloading report from OSS...`);
          
          // Get signed S3 download URL
          const signedUrlResponse = await axios.get(
            `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(outputFileName)}/signeds3download`,
            {
              headers: { Authorization: `Bearer ${daToken}` },
              params: {
                minutesExpiration: 10
              }
            }
          );
          
          const signedDownloadUrl = signedUrlResponse.data.url;
          console.log(`   ✅ Got signed download URL`);
          
          // Download from S3 using signed URL
          const resultResponse = await axios.get(signedDownloadUrl, {
            responseType: 'json',
            timeout: 30000
          });

          reportData = resultResponse.data;
          actualVersion = tryVersion;
          workItemSuccess = true;
          console.log(`   ✅ SUCCESS! File is actually Revit ${tryVersion}`);
          break;
        } else {
          throw new Error(`Failed: ${status}`);
        }
      } catch (versionError: any) {
        console.log(`   ❌ Revit ${tryVersion} failed: ${versionError.message}`);
        if (versionError.response?.data) {
          console.log(`   📋 Error details:`, JSON.stringify(versionError.response.data, null, 2));
        }
        // Continue to next version
      }
    }

    if (!workItemSuccess || !reportData) {
      throw new Error(`File could not be processed with any Revit version (tried: ${versionsToTry.join(', ')})`);
    }

    // Store in cache
    if (!(global as any).reportCache) {
      (global as any).reportCache = new Map();
    }
    
    (global as any).reportCache.set(reportId, {
      ...reportData,
      uploadedAt: new Date().toISOString(),
      source: 'acc',
      fileName: fileName,
      revitVersion: actualVersion
    });

    console.log(`   ✅ Report generated: ${reportId}`);

    return NextResponse.json({
      success: true,
      reportId,
      reportData,
      revitVersion: actualVersion,
      message: `File processed successfully with Revit ${actualVersion}`
    });

  } catch (error: any) {
    console.error('Process ACC file error:', error.response?.data || error.message);
    
    return NextResponse.json(
      { 
        error: 'Failed to process file',
        details: error.response?.data?.detail || error.message
      },
      { status: 500 }
    );
  }
}
