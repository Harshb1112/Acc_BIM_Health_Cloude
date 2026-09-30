import axios from 'axios';
import fs from 'fs';
import path from 'path';

export class ACCService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Encode URN to URL-safe Base64 format for Autodesk API
   */
  private encodeURN(urn: string): string {
    return Buffer.from(urn)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Get 2-legged OAuth access token
   */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        'https://developer.api.autodesk.com/authentication/v2/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'data:read data:write bucket:read bucket:create'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;

      if (!this.accessToken) {
        throw new Error('Failed to obtain access token');
      }

      return this.accessToken;
    } catch (error: any) {
      console.error('Failed to get access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Autodesk');
    }
  }

  /**
   * Get user hubs
   */
  async getUserHubs(userToken: string): Promise<any[]> {
    try {
      console.log(`?? Fetching hubs with token: ${userToken.substring(0, 20)}...`);
      
      const response = await axios.get(
        'https://developer.api.autodesk.com/project/v1/hubs',
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const hubs = response.data.data.map((hub: any) => ({
        id: hub.id,
        name: hub.attributes.name,
        type: hub.attributes.extension?.type || 'hubs'
      }));

      console.log(`? Found ${hubs.length} hubs`);
      return hubs;
    } catch (error: any) {
      const errorDetails = error.response?.data || error.message;
      const statusCode = error.response?.status;
      
      console.error('? Failed to get hubs:', {
        status: statusCode,
        error: errorDetails,
        tokenProvided: !!userToken,
        tokenLength: userToken?.length
      });

      // Provide more specific error messages
      if (statusCode === 401) {
        throw new Error('Your Autodesk session has expired. Please log out and log in again to refresh your access token.');
      } else if (statusCode === 403) {
        throw new Error('Access denied. Your account may not have permission to access ACC hubs.');
      } else if (statusCode === 404) {
        throw new Error('No hubs found. Make sure you have access to at least one ACC hub.');
      }

      throw new Error(`Failed to fetch hubs: ${errorDetails}`);
    }
  }

  /**
   * Get hub projects
   */
  async getHubProjects(hubId: string, userToken: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://developer.api.autodesk.com/project/v1/hubs/${hubId}/projects`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data.map((project: any) => ({
        id: project.id,
        name: project.attributes.name,
        type: project.type
      }));
    } catch (error: any) {
      console.error('Failed to get projects:', error.response?.data || error.message);
      throw new Error('Failed to fetch projects');
    }
  }

  /**
   * Get project top folders
   */
  async getProjectTopFolders(hubId: string, projectId: string, userToken: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://developer.api.autodesk.com/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data.map((folder: any) => ({
        id: folder.id,
        name: folder.attributes.displayName || folder.attributes.name,
        type: folder.type,
        hidden: folder.attributes.hidden || false
      }));
    } catch (error: any) {
      console.error('Failed to get top folders:', error.response?.data || error.message);
      throw new Error('Failed to fetch top folders');
    }
  }

  /**
   * Get folder contents with file sizes
   */
  async getFolderContents(projectId: string, folderId: string, userToken: string): Promise<any> {
    try {
      console.log(`\n?? Fetching folder contents for folder: ${folderId}`);
      
      // Include version data in the response to get file sizes
      const response = await axios.get(
        `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents?includeHidden=false`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const folders: any[] = [];
      const files: any[] = [];

      console.log(`?? Found ${response.data.data.length} items in folder`);
      
      // Check if included data has version information
      const includedVersions = new Map();
      if (response.data.included) {
        console.log(`?? Found ${response.data.included.length} included items`);
        for (const included of response.data.included) {
          if (included.type === 'versions') {
            includedVersions.set(included.id, included);
            console.log(`   Version ${included.id}: ${included.attributes?.storageSize || 0} bytes`);
          }
        }
      }

      // Process all items
      for (const item of response.data.data) {
        if (item.type === 'folders') {
          folders.push({
            id: item.id,
            name: item.attributes.displayName || item.attributes.name,
            type: item.type,
            hidden: item.attributes.hidden || false
          });
          console.log(`?? Folder: ${item.attributes.displayName || item.attributes.name}`);
        } else if (item.type === 'items') {
          const fileName = item.attributes.displayName || item.attributes.name;
          const extension = item.attributes.extension?.type || '';
          
          console.log(`\n?? Processing file: ${fileName}`);
          
          const tipVersion = item.relationships?.tip?.data?.id;
          console.log(`   Tip version from folder contents: ${tipVersion}`);
          
          const cleanVersionId = tipVersion?.split('?')[0] || '';
          const fileId = cleanVersionId || item.id;

          // Get file size - first check included data, then fetch if needed
          let fileSize = 0;
          
          // Check if version data is in included array
          if (tipVersion && includedVersions.has(tipVersion)) {
            const versionData = includedVersions.get(tipVersion);
            fileSize = versionData.attributes?.storageSize || 0;
            console.log(`   ? Got size from included data: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
          } else if (tipVersion) {
            // Fetch version details if not in included data
            try {
              const cleanVersion = tipVersion.split('?')[0];
              console.log(`   Clean version URN: ${cleanVersion}`);
              
              // Use URL-safe Base64 encoding without padding
              const encodedVersion = Buffer.from(cleanVersion)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
              
              console.log(`   Encoded version: ${encodedVersion}`);
              
              console.log(`   ?? Fetching version details for size...`);
              const versionResponse = await axios.get(
                `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodedVersion}`,
                {
                  headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 10000
                }
              );
              
              fileSize = versionResponse.data.data.attributes.storageSize || 0;
              console.log(`   ? SUCCESS! File size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
            } catch (err: any) {
              console.log(`   ? ERROR: ${err.response?.status} - ${err.message}`);
              if (err.response?.data) {
                console.log(`   Error details:`, JSON.stringify(err.response.data));
              }
            }
          } else {
            console.log(`   ??  No tip version available for this file`);
          }

          files.push({
            id: fileId,
            lineageId: item.id,
            name: fileName,
            type: 'file',
            extension: extension,
            fileType: item.attributes.fileType || '',
            size: fileSize,
            version: item.attributes.extension?.version || '1',
            createTime: item.attributes.createTime,
            createUserId: item.attributes.createUserId,
            lastModifiedTime: item.attributes.lastModifiedTime,
            lastModifiedUserId: item.attributes.lastModifiedUserId,
            isRevitFile: fileName.toLowerCase().endsWith('.rvt'),
            isIFCFile: fileName.toLowerCase().endsWith('.ifc'),
            isProcessable: fileName.toLowerCase().endsWith('.rvt') || fileName.toLowerCase().endsWith('.ifc'),
            tipVersionId: cleanVersionId
          });
        }
      }

      console.log(`\n? SUMMARY: Found ${folders.length} folders and ${files.length} files`);

      return {
        folders,
        files,
        total: folders.length + files.length
      };
    } catch (error: any) {
      console.error('? Failed to get folder contents:', error.response?.data || error.message);
      throw new Error('Failed to fetch folder contents');
    }
  }

  /**
   * Get file versions
   */
  async getFileVersions(projectId: string, itemId: string, userToken?: string): Promise<any[]> {
    const token = userToken || await this.getAccessToken();

    try {
      console.log(`?? Fetching versions for file: ${itemId}`);

      const response = await axios.get(
        `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${itemId}/versions`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const versions = response.data.data.map((version: any) => ({
        id: version.id,
        versionNumber: version.attributes.versionNumber,
        displayName: version.attributes.displayName || version.attributes.name,
        createTime: version.attributes.createTime,
        createUserId: version.attributes.createUserId,
        storageSize: version.attributes.storageSize || 0,
        storageUrn: version.relationships?.storage?.data?.id || ''
      }));

      console.log(`? Found ${versions.length} versions`);
      return versions;
    } catch (error: any) {
      console.error('? Failed to get file versions:', error.response?.data || error.message);
      throw new Error('Failed to fetch file versions');
    }
  }

  /**
   * Get storage URN for a file (for Design Automation)
   * This returns the storage URN that Design Automation can use directly
   */
  /**
   * Get storage URN from ACC item for Design Automation
   * This is the official approach recommended by Autodesk
   */
  async getStorageUrnForDA(projectId: string, itemId: string, userToken: string): Promise<string> {
    try {
      console.log(`📋 Getting storage URN for Design Automation...`);
      
      // Clean and encode item ID
      const cleanItemId = itemId.split('?')[0];
      const encodedItemId = encodeURIComponent(cleanItemId);

      // Get item details
      const itemResponse = await axios.get(
        `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodedItemId}`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Get version ID from tip
      const tipVersionId = itemResponse.data.data.relationships?.tip?.data?.id;
      
      if (!tipVersionId) {
        throw new Error('Tip version not found');
      }

      console.log(`📋 Tip version: ${tipVersionId}`);

      // Check if we have storage in included data
      let storageUrn = null;
      const included = itemResponse.data.included;
      
      if (included && included.length > 0) {
        for (const item of included) {
          if (item.type === 'versions') {
            storageUrn = item.relationships?.storage?.data?.id;
            if (storageUrn) {
              console.log(`📦 Found storage URN in included: ${storageUrn}`);
              break;
            }
          }
        }
      }

      // If not in included, fetch version details
      if (!storageUrn) {
        const cleanVersionId = tipVersionId.split('?')[0];
        const encodedVersionId = encodeURIComponent(cleanVersionId);

        const versionResponse = await axios.get(
          `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodedVersionId}`,
          {
            headers: {
              'Authorization': `Bearer ${userToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        storageUrn = versionResponse.data.data.relationships?.storage?.data?.id;
        console.log(`📦 Found storage URN from version: ${storageUrn}`);
      }

      if (!storageUrn) {
        throw new Error('Storage URN not found');
      }

      return storageUrn;
      
    } catch (error: any) {
      console.error('❌ Failed to get storage URN:', error.response?.data || error.message);
      throw new Error(`Failed to get storage URN: ${error.message}`);
    }
  }

  /**
   * Download file from ACC and upload to our OSS bucket for Design Automation
   * FALLBACK METHOD - Use getStorageUrnForDA instead when possible
   */
  async downloadAndUploadToOSS(projectId: string, itemId: string, fileName: string, userToken: string, forgeService: any): Promise<string> {
    try {
      console.log(`📥 Downloading file from ACC: ${fileName}`);
      
      // Clean and encode item ID
      const cleanItemId = itemId.split('?')[0];
      const encodedItemId = encodeURIComponent(cleanItemId);
      
      // Use the item download endpoint - this works for all file types
      const itemDownloadUrl = `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodedItemId}/download`;
      console.log(`📥 Using item download endpoint...`);
      
      const fileResponse = await axios.get(itemDownloadUrl, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        },
        responseType: 'arraybuffer',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 1800000, // 30 minutes
        maxRedirects: 5,
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2);
            const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2);
            if (percentCompleted % 10 === 0) {
              console.log(`📥 Downloading: ${percentCompleted}% (${loadedMB}/${totalMB} MB)`);
            }
          }
        }
      });
      
      const fileSizeMB = (fileResponse.data.byteLength / 1024 / 1024).toFixed(2);
      console.log(`✅ Downloaded ${fileSizeMB} MB from ACC`);
      
      // Upload to our OSS bucket
      const timestamp = Date.now();
      const uploadKey = `acc-files/${timestamp}-${fileName}`;
      
      console.log(`📤 Uploading to our OSS bucket: ${uploadKey}`);
      
      // Ensure our bucket exists
      await forgeService.ensureBucket();
      
      // Get our 2-legged token
      const ourToken = await forgeService.getAccessToken();
      
      // Upload file to our bucket
      await axios.put(
        `https://developer.api.autodesk.com/oss/v2/buckets/${encodeURIComponent(forgeService.bucketKey)}/objects/${encodeURIComponent(uploadKey)}`,
        fileResponse.data,
        {
          headers: {
            'Authorization': `Bearer ${ourToken}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileResponse.data.byteLength
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2);
              const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2);
              if (percentCompleted % 10 === 0) {
                console.log(`📤 Uploading: ${percentCompleted}% (${loadedMB}/${totalMB} MB)`);
              }
            }
          }
        }
      );
      
      console.log(`✅ Uploaded to our bucket successfully`);
      
      // Return OSS URN
      const ossUrn = `urn:adsk.objects:os.object:${forgeService.bucketKey}/${uploadKey}`;
      console.log(`✅ OSS URN: ${ossUrn}`);
      return ossUrn;
      
    } catch (error: any) {
      // Decode buffer error if present
      let errorMessage = error.message;
      if (error.response?.data && Buffer.isBuffer(error.response.data)) {
        try {
          const decoded = error.response.data.toString('utf-8');
          errorMessage = decoded;
          console.error('❌ Error details:', decoded);
        } catch (e) {
          // Ignore decode error
        }
      } else if (error.response?.data) {
        console.error('❌ Error details:', JSON.stringify(error.response.data, null, 2));
        errorMessage = JSON.stringify(error.response.data);
      }
      
      console.error('❌ Failed to download and upload file:', errorMessage);
      console.error('❌ Error status:', error.response?.status);
      throw new Error(`Failed to download and upload file to OSS: ${errorMessage}`);
    }
  }

  /**
   * Get signed download URL for a file
   */
  async getSignedDownloadUrl(projectId: string, itemId: string, userToken?: string): Promise<string> {
      try {
        // Use user token for Data Management API
        const token = userToken || await this.getAccessToken();

        let versionId = null;

        if (itemId.includes('dm.lineage:') || itemId.includes('dm.item:')) {
          console.log(`?? Item/Lineage URN detected, fetching version...`);
          const cleanItemId = itemId.split('?')[0];
          const encodedItemId = encodeURIComponent(cleanItemId);

          const itemResponse = await axios.get(
            `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodedItemId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          versionId = itemResponse.data.data.relationships?.tip?.data?.id;
        } else if (itemId.includes('dm.version:')) {
          console.log(`?? Version URN detected`);
          versionId = itemId;
        }

        if (!versionId) {
          throw new Error('Version ID not found');
        }

        console.log(`?? Version ID: ${versionId}`);

        // Use Data Management API download endpoint instead of OSS
        const cleanVersionId = versionId.split('?')[0];
        const encodedVersionId = encodeURIComponent(cleanVersionId);

        console.log(`?? Using Data Management API for download URL`);
        const downloadUrl = `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodedVersionId}/downloads`;

        const downloadResponse = await axios.get(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const formats = downloadResponse.data.data?.formats;
        if (!formats || formats.length === 0) {
          throw new Error('No download formats available');
        }

        const signedUrl = formats[0].url;
        if (!signedUrl) {
          throw new Error('Download URL not found in response');
        }

        console.log(`? Got download URL from Data Management API`);
        return signedUrl;
      } catch (error: any) {
        console.error('? Failed to get download URL:', error.response?.data || error.message);
        throw new Error('Failed to get signed download URL');
      }
    }


  /**
   * Download file (RVT or IFC) from ACC
   */
  async downloadFile(projectId: string, itemId: string, outputPath: string, userToken?: string): Promise<string> {
      if (!userToken) {
        throw new Error('User token is required for ACC file downloads');
      }

      const token = userToken;

      try {
        console.log(`?? Downloading file: ${itemId}`);
        console.log(`?? Project ID: ${projectId}`);

        let versionId = itemId.trim();

        if (!versionId.startsWith('urn:')) {
          throw new Error(`Invalid URN format: ${versionId}`);
        }

        // If it's an item or lineage URN, get the tip version first
        if (versionId.includes('dm.lineage:') || versionId.includes('dm.item:')) {
          console.log(`?? Item/Lineage URN detected, fetching tip version...`);

          const cleanItemId = versionId.split('?')[0];
          console.log(`   Clean Item ID: ${cleanItemId}`);

          const encodedItemId = encodeURIComponent(cleanItemId);
          console.log(`   URL Encoded Item ID: ${encodedItemId}`);

          const itemResponse = await axios.get(
            `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodedItemId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          // Get the tip version URN from included data
          const tipVersionId = itemResponse.data.data.relationships?.tip?.data?.id;
          
          if (!tipVersionId) {
            throw new Error('Tip version not found in item response');
          }

          // The tip should already be a version URN (dm.version:)
          // But if we get a storage URN, fetch versions directly from the API
          if (tipVersionId.includes('fs.file:')) {
            console.log('Tip returned storage URN, using direct storage download...');
            
            // Fetch versions to get proper version URN
            const versionsResponse = await axios.get(
              `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodedItemId}/versions`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (versionsResponse.data.data && versionsResponse.data.data.length > 0) {
              const latestVersion = versionsResponse.data.data[0];
              console.log('Latest version found:', latestVersion.id);
              console.log('Version relationships:', JSON.stringify(latestVersion.relationships, null, 2));
              
              // For IFC files, try using the item's download endpoint first
              console.log('?? Trying item download endpoint for IFC file...');
              try {
                const itemDownloadUrl = `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodedItemId}/download`;
                console.log('Item download URL:', itemDownloadUrl);
                
                const fileResponse = await axios.get(itemDownloadUrl, {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  },
                  responseType: 'arraybuffer',
                  maxContentLength: Infinity,
                  maxBodyLength: Infinity,
                  timeout: 1800000,
                  maxRedirects: 5,
                  onDownloadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                      const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2);
                      const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2);
                      console.log(`📥 Downloading: ${percentCompleted}% (${loadedMB}/${totalMB} MB)`);
                    }
                  }
                });

                fs.writeFileSync(outputPath, Buffer.from(fileResponse.data));

                const fileSizeMB = (fileResponse.data.byteLength / 1024 / 1024).toFixed(2);
                console.log(`? File downloaded via item download endpoint: ${fileSizeMB} MB`);

                return outputPath;
              } catch (itemDownloadErr: any) {
                console.log('⚠️  Item download failed:', itemDownloadErr.message);
                if (itemDownloadErr.response?.status === 403) {
                  console.log('Error details:', itemDownloadErr.response?.data);
                }
              }
              
              // Check if the version has a downloadFormats link in relationships
              const downloadFormatsLink = latestVersion.relationships?.downloadFormats?.links?.related?.href;
              
              if (downloadFormatsLink) {
                console.log('?? Using downloadFormats link from version metadata...');
                try {
                  const downloadFormatsResponse = await axios.get(downloadFormatsLink, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  console.log('Download formats response:', JSON.stringify(downloadFormatsResponse.data, null, 2));
                  
                  const formats = downloadFormatsResponse.data.data?.formats;
                  if (formats && formats.length > 0) {
                    const signedUrl = formats[0].url;
                    if (signedUrl) {
                      console.log('? Got signed URL from Data Management API, downloading file...');
                      
                      // Download using signed URL (no auth needed)
                      const fileResponse = await axios.get(signedUrl, {
                        responseType: 'arraybuffer',
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        timeout: 1800000, // 30 minutes for large files
                        maxRedirects: 5,
                        onDownloadProgress: (progressEvent) => {
                          if (progressEvent.total) {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2);
                            const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2);
                            console.log(`📥 Downloading: ${percentCompleted}% (${loadedMB}/${totalMB} MB)`);
                          }
                        }
                      });

                      fs.writeFileSync(outputPath, Buffer.from(fileResponse.data));

                      const fileSizeMB = (fileResponse.data.byteLength / 1024 / 1024).toFixed(2);
                      console.log(`? File downloaded successfully: ${fileSizeMB} MB`);

                      return outputPath;
                    }
                  }
                  
                  console.log('⚠️  No download formats available, trying storage link...');
                } catch (err: any) {
                  console.log('⚠️  downloadFormats failed:', err.message, '- trying storage link...');
                }
              }
              
              // Fallback: use storage link with scopes
              const storageLink = latestVersion.relationships?.storage?.meta?.link?.href;
              if (storageLink) {
                console.log('⚠️  Storage link is deprecated, trying derivatives API...');
              }
              
              // For IFC files, use Direct-to-S3 approach
              // Get signed S3 URL from the storage URN
              const storageUrn = latestVersion.relationships?.storage?.data?.id;
              
              if (storageUrn) {
                console.log('🔗 Using Direct-to-S3 approach for IFC file...');
                console.log('Storage URN:', storageUrn);
                
                try {
                  // The storage link in metadata already has the S3 URL with scopes
                  // But it's deprecated. Instead, we need to use Data Management API
                  // to get a proper signed URL
                  
                  // Method 1: Try using the version's self link to get download
                  const versionSelfLink = latestVersion.links?.self?.href;
                  if (versionSelfLink) {
                    console.log('📥 Attempting download via version self link...');
                    
                    // Add /content to get the actual file content
                    const contentUrl = `${versionSelfLink}/content`;
                    console.log('Content URL:', contentUrl);
                    
                    const fileResponse = await axios.get(contentUrl, {
                      headers: {
                        'Authorization': `Bearer ${token}`
                      },
                      responseType: 'arraybuffer',
                      maxContentLength: Infinity,
                      maxBodyLength: Infinity,
                      timeout: 1800000,
                      maxRedirects: 5,
                      onDownloadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                          const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2);
                          const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2);
                          console.log(`📥 Downloading: ${percentCompleted}% (${loadedMB}/${totalMB} MB)`);
                        }
                      }
                    });

                    fs.writeFileSync(outputPath, Buffer.from(fileResponse.data));

                    const fileSizeMB = (fileResponse.data.byteLength / 1024 / 1024).toFixed(2);
                    console.log(`✅ File downloaded successfully: ${fileSizeMB} MB`);

                    return outputPath;
                  }
                } catch (s3Err: any) {
                  console.log('⚠️  Direct-to-S3 download failed:', s3Err.message);
                  console.log('Status:', s3Err.response?.status);
                  if (s3Err.response?.data) {
                    const errorData = Buffer.isBuffer(s3Err.response.data) 
                      ? s3Err.response.data.toString() 
                      : JSON.stringify(s3Err.response.data);
                    console.log('Error details:', errorData);
                  }
                }
              }
              
              const derivativesId = latestVersion.relationships?.derivatives?.data?.id;
              
              if (derivativesId) {
                console.log('?? Trying to download source file via Model Derivative API...');
                
                try {
                  // Get manifest to find source file
                  const manifestUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${derivativesId}/manifest`;
                  console.log('Manifest URL:', manifestUrl);
                  
                  const manifestResponse = await axios.get(manifestUrl, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  
                  console.log('Manifest status:', manifestResponse.data.status);
                  console.log('Manifest urn:', manifestResponse.data.urn);
                  console.log('Full manifest:', JSON.stringify(manifestResponse.data, null, 2));
                  
                  // Try downloading using the base64-encoded storage URN
                  if (storageUrn) {
                    console.log('?? Trying to download using encoded storage URN...');
                    const encodedStorageUrn = Buffer.from(storageUrn).toString('base64').replace(/=/g, '');
                    console.log('Encoded storage URN:', encodedStorageUrn);
                    
                    const storageDownloadUrl = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodedStorageUrn}`;
                    console.log('Storage download URL:', storageDownloadUrl);
                    
                    const fileResponse = await axios.get(storageDownloadUrl, {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept-Encoding': 'gzip, deflate'
                      },
                      responseType: 'arraybuffer',
                      maxContentLength: Infinity,
                      maxBodyLength: Infinity,
                      timeout: 1800000,
                      maxRedirects: 5,
                      onDownloadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                          const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2);
                          const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2);
                          console.log(`📥 Downloading: ${percentCompleted}% (${loadedMB}/${totalMB} MB)`);
                        }
                      }
                    });

                    fs.writeFileSync(outputPath, Buffer.from(fileResponse.data));

                    const fileSizeMB = (fileResponse.data.byteLength / 1024 / 1024).toFixed(2);
                    console.log(`? File downloaded using encoded storage URN: ${fileSizeMB} MB`);

                    return outputPath;
                  }
                } catch (derivErr: any) {
                  console.log('⚠️  Model Derivative download failed:', derivErr.message);
                  if (derivErr.response?.data) {
                    const errorData = Buffer.isBuffer(derivErr.response.data) 
                      ? derivErr.response.data.toString() 
                      : JSON.stringify(derivErr.response.data);
                    console.log('Error details:', errorData);
                  }
                }
              }
              
              throw new Error('No download method available for this IFC file. IFC files may need to be downloaded differently than Revit files.');
            } else {
              throw new Error('No versions found for this item');
            }
          } else {
            versionId = tipVersionId;
            console.log('Tip Version ID:', versionId);
          }
        }

        // Ensure we have a version URN at this point
        if (!versionId.includes('dm.version:')) {
          throw new Error(`Expected version URN, got: ${versionId}`);
        }

        const cleanVersionId = versionId.split('?')[0];
        const encodedVersionId = encodeURIComponent(cleanVersionId);

        // Use the Data Management API download endpoint with proper content disposition
        const downloadUrl = `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodedVersionId}`;

        console.log(`   Clean Version ID: ${cleanVersionId}`);
        console.log(`   Encoded Version ID: ${encodedVersionId}`);
        console.log(`?? Downloading file using Data Management API...`);

        // First get the download URL from the version metadata
        const versionResponse = await axios.get(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const storageId = versionResponse.data.data.relationships?.storage?.data?.id;
        if (!storageId) {
          throw new Error('Storage ID not found in version metadata');
        }

        console.log(`?? Storage ID: ${storageId}`);

        // Download using OSS (Object Storage Service) API
        // Extract bucket key and object key from storage URN
        // Storage URN format: urn:adsk.objects:os.object:bucket/objectKey
        const storageMatch = storageId.match(/urn:adsk\.objects:os\.object:([^\/]+)\/(.+)/);
        
        if (!storageMatch) {
          throw new Error(`Invalid storage URN format: ${storageId}`);
        }

        const bucketKey = storageMatch[1];
        const objectKey = storageMatch[2];
        
        console.log(`?? Bucket: ${bucketKey}`);
        console.log(`?? Object: ${objectKey}`);

        // Use Data Management API downloadFormats endpoint instead of OSS
        console.log(`?? Getting download URL from Data Management API...`);
        const downloadFormatsResponse = await axios.get(
          `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodedVersionId}/downloadFormats`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const formats = downloadFormatsResponse.data.data?.formats;
        if (!formats || formats.length === 0) {
          throw new Error('No download formats available for this file');
        }

        const signedUrl = formats[0].url;
        if (!signedUrl) {
          throw new Error('Download URL not found in response');
        }

        console.log(`?? Downloading file using signed URL...`);

        const fileResponse = await axios.get(signedUrl, {
          responseType: 'arraybuffer',
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 1800000, // 30 minutes for large files
          maxRedirects: 5,
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2);
              const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2);
              console.log(`📥 Downloading: ${percentCompleted}% (${loadedMB}/${totalMB} MB)`);
            }
          }
        });

        fs.writeFileSync(outputPath, Buffer.from(fileResponse.data));

        const fileSizeMB = (fileResponse.data.byteLength / 1024 / 1024).toFixed(2);
        console.log(`? File downloaded: ${fileSizeMB} MB`);

        return outputPath;
      } catch (error: any) {
        console.error('? Failed to download file:', error.response?.data || error.message);
        console.error('   Status:', error.response?.status);
        console.error('   Full error:', JSON.stringify(error.response?.data, null, 2));
        throw new Error(`Failed to download file from ACC: ${error.message}`);
      }
    }


  /**
   * Alternative download method using storage location
   */
  private async downloadViaStorage(projectId: string, itemId: string, outputPath: string, token: string): Promise<string> {
    try {
      let storageId = itemId.trim();

      if (!storageId.startsWith('urn:')) {
        throw new Error(`Invalid URN format: ${storageId}`);
      }

      let versionId = storageId;

      // If it's an item or lineage URN, get the tip version first
      if (versionId.includes('dm.lineage:') || versionId.includes('dm.item:')) {
        console.log(`?? Item/Lineage URN detected, fetching tip version...`);
        const cleanItemId = versionId.split('?')[0];
        const encodedItemId = encodeURIComponent(cleanItemId);

        const itemResponse = await axios.get(
          `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodedItemId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        versionId = itemResponse.data.data.relationships?.tip?.data?.id;

        if (!versionId) {
          throw new Error('Tip version not found');
        }
        
        console.log(`?? Tip Version ID: ${versionId}`);
      }

      // Now we have a version URN or storage URN
      const cleanVersionId = versionId.split('?')[0];
      
      // If we already have a storage URN, use it directly
      if (versionId.includes('fs.file:')) {
        console.log('Already have storage URN, using it directly...');
        storageId = versionId;
      } else {
        // Otherwise, fetch storage location from version
        const encodedVersionId = encodeURIComponent(cleanVersionId);

        console.log('Fetching storage location from version...');
        const versionResponse = await axios.get(
          `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodedVersionId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        storageId = versionResponse.data.data.relationships?.storage?.data?.id;

        if (!storageId) {
          throw new Error('Storage ID not found');
        }

        console.log('Storage ID:', storageId);
      }

      // Extract bucket and object key from storage URN
      const parts = storageId.split(':');
      let bucketKey, objectKey;

      if (storageId.includes('fs.file:')) {
        objectKey = parts[parts.length - 1].split('?')[0]; // Remove version query param
        bucketKey = 'wip.dm.prod';
      } else {
        const bucketAndObject = parts[parts.length - 1];

        if (bucketAndObject.includes('/')) {
          const slashIndex = bucketAndObject.indexOf('/');
          bucketKey = bucketAndObject.substring(0, slashIndex);
          objectKey = bucketAndObject.substring(slashIndex + 1);
        } else {
          bucketKey = 'wip.dm.prod';
          objectKey = bucketAndObject;
        }
      }

      console.log(`?? Bucket: ${bucketKey}, Object: ${objectKey}`);

      console.log(`?? Requesting signed URL...`);
      console.log(`   URL: https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3download`);
      
      const signedResponse = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3download`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const signedUrl = signedResponse.data.signedUrl || signedResponse.data.url;

      if (!signedUrl) {
        throw new Error('Signed URL not found');
      }

      console.log(`?? Downloading from signed URL...`);
      const fileResponse = await axios.get(signedUrl, {
        responseType: 'arraybuffer',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 1800000
      });

      fs.writeFileSync(outputPath, Buffer.from(fileResponse.data));

      const fileSizeMB = (fileResponse.data.byteLength / 1024 / 1024).toFixed(2);
      console.log(`? File downloaded: ${fileSizeMB} MB`);

      return outputPath;
    } catch (error: any) {
      console.error('? Storage download failed:', error.response?.data || error.message);
      console.error('   Status:', error.response?.status);
      console.error('   Full error:', JSON.stringify(error.response?.data, null, 2));
      throw new Error(`Storage download failed: ${error.message}`);
    }
  }

  /**
   * Search for RVT files in a project
   */
  async searchRVTFiles(hubId: string, projectId: string, userToken?: string): Promise<any[]> {
    const token = userToken || await this.getAccessToken();

    try {
      console.log(`?? Searching for RVT files in project: ${projectId}`);

      const topFolders = await this.getProjectTopFolders(hubId, projectId, token);

      const rvtFiles: any[] = [];

      for (const folder of topFolders) {
        if (!folder.hidden) {
          await this.searchFolderForRVT(projectId, folder.id, rvtFiles, token);
        }
      }

      console.log(`? Found ${rvtFiles.length} RVT files`);
      return rvtFiles;
    } catch (error: any) {
      console.error('? Failed to search RVT files:', error.response?.data || error.message);
      throw new Error('Failed to search for RVT files');
    }
  }

  /**
   * Recursively search folder for RVT files
   */
  private async searchFolderForRVT(
    projectId: string,
    folderId: string,
    results: any[],
    token: string,
    depth: number = 0
  ): Promise<void> {
    if (depth > 10) return;

    try {
      // Fetch folder contents
      const contents = await this.getFolderContents(projectId, folderId, token);

      const rvtFiles = contents.files.filter((file: any) => file.isRevitFile || file.isIFCFile);
      results.push(...rvtFiles.map((file: any) => ({
        ...file,
        folderId
      })));

      for (const folder of contents.folders) {
        if (!folder.hidden) {
          await this.searchFolderForRVT(projectId, folder.id, results, token, depth + 1);
        }
      }
    } catch (error) {
      console.warn(`?? Failed to search folder ${folderId}:`, error);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(projectId: string, itemId: string, userToken?: string): Promise<any> {
    const token = userToken || await this.getAccessToken();

    try {
      console.log(`?? Fetching metadata for file: ${itemId}`);

      let versionId = itemId;
      let itemData = null;

      if (itemId.includes('dm.lineage:') || itemId.includes('dm.item:')) {
        console.log(`?? Item/Lineage URN detected`);

        const cleanItemId = itemId.split('?')[0];
        const encodedItemId = encodeURIComponent(cleanItemId);

        const response = await axios.get(
          `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${encodedItemId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        itemData = response.data.data;
        versionId = itemData.relationships?.tip?.data?.id;

        if (!versionId) {
          throw new Error('Tip version not found');
        }
      } else if (itemId.includes('fs.file:')) {
        console.log(`?? Version URN detected`);
        versionId = itemId;

        const cleanVersionId = versionId.split('?')[0];
        const encodedVersionId = encodeURIComponent(cleanVersionId);

        try {
          const versionResponse = await axios.get(
            `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodedVersionId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const version = versionResponse.data.data;

          return {
            id: itemId,
            versionId: versionId,
            name: version.attributes.displayName || version.attributes.name || 'Unknown.rvt',
            type: version.type,
            extension: version.attributes.extension?.type || 'rvt',
            fileType: version.attributes.fileType || 'rvt',
            size: version.attributes.storageSize || 0,
            createTime: version.attributes.createTime,
            createUserId: version.attributes.createUserId,
            lastModifiedTime: version.attributes.lastModifiedTime,
            lastModifiedUserId: version.attributes.lastModifiedUserId,
            versionNumber: version.attributes.versionNumber || '1'
          };
        } catch (versionError: any) {
          console.warn('??  Could not fetch version details');
          return {
            id: itemId,
            versionId: versionId,
            name: 'file.rvt',
            type: 'versions',
            extension: 'rvt',
            fileType: 'rvt',
            size: 0,
            createTime: new Date().toISOString(),
            createUserId: '',
            lastModifiedTime: new Date().toISOString(),
            lastModifiedUserId: '',
            versionNumber: '1'
          };
        }
      }

      const cleanVersionId = versionId.split('?')[0];
      const encodedVersionId = encodeURIComponent(cleanVersionId);

      const versionResponse = await axios.get(
        `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodedVersionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const version = versionResponse.data.data;
      const displayData = itemData || version;

      return {
        id: itemId,
        versionId: versionId,
        name: displayData.attributes.displayName || displayData.attributes.name,
        type: displayData.type,
        extension: displayData.attributes.extension?.type || '',
        fileType: displayData.attributes.fileType || '',
        size: version.attributes.storageSize || 0,
        createTime: displayData.attributes.createTime,
        createUserId: displayData.attributes.createUserId,
        lastModifiedTime: displayData.attributes.lastModifiedTime,
        lastModifiedUserId: displayData.attributes.lastModifiedUserId,
        versionNumber: displayData.attributes.extension?.version || version.attributes.versionNumber || '1'
      };
    } catch (error: any) {
      console.error('? Failed to get file metadata:', error.response?.data || error.message);
      throw new Error('Failed to fetch file metadata');
    }
  }
}

