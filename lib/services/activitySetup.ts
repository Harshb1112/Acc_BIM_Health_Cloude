import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

/**
 * Automatic Activity Setup Service
 * Sets up Design Automation activity for first-time users
 */
export class ActivitySetupService {
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async getToken(): Promise<string> {
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'code:all');

    const response = await axios.post(
      'https://developer.api.autodesk.com/authentication/v2/token',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return response.data.access_token;
  }

  /**
   * Check if user has activity set up for specific Revit version
   */
  async checkActivityExists(revitVersion: string = '2024'): Promise<boolean> {
    try {
      const token = await this.getToken();
      const activityId = `${this.clientId}.BIMHealthReportActivity${revitVersion}+prod`;

      await axios.get(
        `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return true;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Automatically set up activity for user for specific Revit version
   */
  async setupActivity(revitVersion: string = '2024'): Promise<void> {
    console.log(`🔧 Setting up activity for Revit ${revitVersion} for user: ${this.clientId.substring(0, 10)}...`);

    const token = await this.getToken();

    // Step 1: Upload AppBundle
    await this.uploadAppBundle(token, revitVersion);

    // Step 2: Delete old activity if exists (to fix dasOpenNetwork issue)
    await this.deleteOldActivity(token, revitVersion);

    // Step 3: Create Activity
    await this.createActivity(token, revitVersion);

    console.log(`✅ Activity setup complete for Revit ${revitVersion}!`);
  }

  /**
   * Delete old activity (if it has dasOpenNetwork issue)
   */
  private async deleteOldActivity(token: string, revitVersion: string): Promise<void> {
    const activityId = `${this.clientId}.BIMHealthReportActivityV2`;
    
    try {
      // First, try to delete all aliases
      console.log('  🗑️  Deleting activity aliases...');
      
      try {
        await axios.delete(
          `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}/aliases/prod`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('  ✅ Deleted prod alias');
      } catch (e) {
        // Alias might not exist
      }

      // Now delete the activity itself
      console.log('  🗑️  Deleting activity...');
      await axios.delete(
        `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('  ✅ Deleted old activity');
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('  ℹ️  No old activity to delete');
      } else if (error.response?.status === 400 && error.response?.data?.detail?.includes('alias')) {
        console.log('  ⚠️  Activity has aliases. Trying to delete them first...');
        
        // Try to get all aliases and delete them
        try {
          const aliasesResponse = await axios.get(
            `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}/aliases`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          for (const alias of aliasesResponse.data.data) {
            try {
              await axios.delete(
                `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}/aliases/${alias.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              console.log(`  ✅ Deleted alias: ${alias.id}`);
            } catch (e) {
              console.log(`  ⚠️  Could not delete alias ${alias.id}`);
            }
          }
          
          // Try deleting activity again
          await axios.delete(
            `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log('  ✅ Deleted old activity after removing aliases');
          
        } catch (e) {
          console.log('  ⚠️  Could not fully delete old activity. Manual cleanup may be needed.');
        }
      } else {
        console.log('  ⚠️  Could not delete old activity:', error.response?.data?.detail || error.message);
      }
    }
  }

  private async uploadAppBundle(token: string, revitVersion: string): Promise<void> {
    // Only two paths: bundle_upload folder and local_plugin bundle folder
    const possiblePaths = [
      path.join(process.cwd(), `bundle_upload/BIMHealthReportActivity-${revitVersion}.zip`), // Primary: cloude_plugin/bundle_upload
      path.join(process.cwd(), `../local_plugin/bundle/Design_Automation_bundle/zip/BIMHealthReportActivity-${revitVersion}.zip`), // Secondary: local_plugin bundle
    ];

    let zipPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        zipPath = p;
        console.log(`  ✅ Found ZIP at: ${p}`);
        break;
      }
    }

    if (!zipPath) {
      console.log(`  ❌ ZIP not found for Revit ${revitVersion}. Tried paths:`);
      possiblePaths.forEach(p => console.log(`     - ${p}`));
      throw new Error(`AppBundle ZIP not found for Revit ${revitVersion}. Please ensure BIMHealthReportActivity-${revitVersion}.zip exists in server folder.`);
    }

    console.log(`  📦 Using ZIP: ${path.basename(zipPath)} (${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB)`);

    const appBundleId = `BIMHealthReportActivity${revitVersion}`;

    try {
      // Try to create new appbundle version
      const createResponse = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/appbundles',
        {
          id: appBundleId,
          engine: `Autodesk.Revit+${revitVersion}`,
          description: `BIM Health Report Generator for Revit ${revitVersion}`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Upload ZIP
      const uploadUrl = createResponse.data.uploadParameters.endpointURL;
      const uploadParams = createResponse.data.uploadParameters.formData;

      const uploadForm = new FormData();
      Object.keys(uploadParams).forEach(key => {
        uploadForm.append(key, uploadParams[key]);
      });
      uploadForm.append('file', fs.createReadStream(zipPath));

      await axios.post(uploadUrl, uploadForm, {
        headers: uploadForm.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      // Create alias
      await axios.post(
        `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${appBundleId}/aliases`,
        { id: 'prod', version: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('  ✅ AppBundle uploaded');

    } catch (error: any) {
      if (error.response?.status === 409) {
        // AppBundle exists, create new version
        console.log('  ℹ️  AppBundle exists, creating new version...');
        
        try {
          // Create new version
          const versionResponse = await axios.post(
            'https://developer.api.autodesk.com/da/us-east/v3/appbundles',
            {
              id: appBundleId,
              engine: `Autodesk.Revit+${revitVersion}`,
              description: `BIM Health Report Generator for Revit ${revitVersion} (Updated)`
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Upload ZIP for new version
          const uploadUrl = versionResponse.data.uploadParameters.endpointURL;
          const uploadParams = versionResponse.data.uploadParameters.formData;

          const uploadForm = new FormData();
          Object.keys(uploadParams).forEach(key => {
            uploadForm.append(key, uploadParams[key]);
          });
          uploadForm.append('file', fs.createReadStream(zipPath));

          await axios.post(uploadUrl, uploadForm, {
            headers: uploadForm.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          });

          // Update prod alias to point to new version
          const newVersion = versionResponse.data.version;
          await axios.patch(
            `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${appBundleId}/aliases/prod`,
            { version: newVersion },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          console.log(`  ✅ AppBundle updated to version ${newVersion}`);
          
        } catch (updateError: any) {
          console.log('  ⚠️  Could not update appbundle:', updateError.response?.data || updateError.message);
          console.log('  ℹ️  Using existing appbundle');
        }
      } else {
        throw error;
      }
    }
  }

  private async createActivity(token: string, revitVersion: string): Promise<void> {
    const activityId = `BIMHealthReportActivity${revitVersion}`;

    const activitySpec = {
      id: activityId,
      commandLine: [
        `$(engine.path)\\revitcoreconsole.exe /i "$(args[rvtFile].path)" /al "$(appbundles[BIMHealthReportActivity${revitVersion}].path)"`
      ],
      engine: `Autodesk.Revit+${revitVersion}`,
      appbundles: [`${this.clientId}.BIMHealthReportActivity${revitVersion}+prod`],
      parameters: {
        rvtFile: {
          verb: 'get',
          description: 'Input Revit file',
          localName: 'input.rvt',
          required: true
        },
        result: {
          verb: 'put',
          description: 'Output JSON report',
          localName: 'report.json',
          required: true
        }
      }
      // Note: dasOpenNetwork is now deprecated and automatically enabled
      // No need to specify it in settings
    };

    try {
      await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/activities',
        activitySpec,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Create alias
      await axios.post(
        `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}/aliases`,
        { id: 'prod', version: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('  ✅ Activity created');

    } catch (error: any) {
      if (error.response?.status === 409) {
        // Activity exists, create new version and update alias
        console.log('  ℹ️  Activity exists, creating new version...');
        
        try {
          // Create new version
          const versionResponse = await axios.post(
            'https://developer.api.autodesk.com/da/us-east/v3/activities',
            activitySpec,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Update prod alias to point to new version
          const newVersion = versionResponse.data.version;
          await axios.patch(
            `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}/aliases/prod`,
            { version: newVersion },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          console.log(`  ✅ Activity updated to version ${newVersion}`);
          
        } catch (updateError: any) {
          console.log('  ⚠️  Could not update activity:', updateError.response?.data || updateError.message);
          console.log('  ℹ️  Using existing activity');
        }
      } else {
        console.error('  ❌ Failed to create activity:', error.response?.data);
        throw error;
      }
    }
  }

  /**
   * Check if user has IFC activity set up
   */
  async checkIFCActivityExists(): Promise<boolean> {
    try {
      const token = await this.getToken();
      const activityId = `${this.clientId}.BIMHealthIFCActivityV1+prod`;

      await axios.get(
        `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return true;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Automatically set up IFC activity for user
   */
  async setupIFCActivity(): Promise<void> {
    console.log(`🔧 Setting up IFC activity for user: ${this.clientId.substring(0, 10)}...`);

    const token = await this.getToken();

    // Step 1: Upload IFC AppBundle
    await this.uploadIFCAppBundle(token);

    // Step 2: Create IFC Activity
    await this.createIFCActivity(token);

    console.log('✅ IFC Activity setup complete!');
  }

  private async uploadIFCAppBundle(token: string): Promise<void> {
    // Only two paths for IFC: bundle_upload folder and local_plugin bundle folder
    const possiblePaths = [
      path.join(process.cwd(), 'bundle_upload/BIMHealthIFCActivity.zip'), // Primary: cloude_plugin/bundle_upload
      path.join(process.cwd(), '../local_plugin/bundle/Design_Automation_bundle/zip/BIMHealthIFCActivity.zip'), // Secondary: local_plugin bundle
    ];

    let zipPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        zipPath = p;
        console.log(`  ✅ Found AppBundle ZIP at: ${p}`);
        break;
      }
    }

    if (!zipPath) {
      console.log('  ❌ AppBundle ZIP not found. Tried paths:');
      possiblePaths.forEach(p => console.log(`     - ${p}`));
      throw new Error('AppBundle ZIP not found. Please ensure BIMHealthReportActivity.zip or BIMHealthIFCActivity.zip exists in server folder.');
    }

    console.log(`  📦 Using IFC ZIP: ${path.basename(zipPath)} (${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB)`);

    const appBundleId = 'BIMHealthIFCActivityV2'; // Changed from V1 to V2 for new bundle structure

    try {
      // Try to create new appbundle
      const createResponse = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/appbundles',
        {
          id: appBundleId,
          engine: 'Autodesk.Revit+2024',
          description: 'BIM Health IFC Report Generator'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Upload ZIP
      const uploadUrl = createResponse.data.uploadParameters.endpointURL;
      const uploadParams = createResponse.data.uploadParameters.formData;

      const uploadForm = new FormData();
      Object.keys(uploadParams).forEach(key => {
        uploadForm.append(key, uploadParams[key]);
      });
      uploadForm.append('file', fs.createReadStream(zipPath));

      await axios.post(uploadUrl, uploadForm, {
        headers: uploadForm.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      // Create alias
      await axios.post(
        `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${appBundleId}/aliases`,
        { id: 'prod', version: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('  ✅ IFC AppBundle uploaded');

    } catch (error: any) {
      if (error.response?.status === 409) {
        console.log('  ℹ️  IFC AppBundle exists, creating new version...');
        
        try {
          const versionResponse = await axios.post(
            'https://developer.api.autodesk.com/da/us-east/v3/appbundles',
            {
              id: appBundleId,
              engine: 'Autodesk.Revit+2023',
              description: 'BIM Health IFC Report Generator (Updated)'
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const uploadUrl = versionResponse.data.uploadParameters.endpointURL;
          const uploadParams = versionResponse.data.uploadParameters.formData;

          const uploadForm = new FormData();
          Object.keys(uploadParams).forEach(key => {
            uploadForm.append(key, uploadParams[key]);
          });
          uploadForm.append('file', fs.createReadStream(zipPath));

          await axios.post(uploadUrl, uploadForm, {
            headers: uploadForm.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          });

          const newVersion = versionResponse.data.version;
          await axios.patch(
            `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${appBundleId}/aliases/prod`,
            { version: newVersion },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          console.log(`  ✅ IFC AppBundle updated to version ${newVersion}`);
          
        } catch (updateError: any) {
          console.log('  ⚠️  Could not update IFC appbundle:', updateError.response?.data || updateError.message);
          console.log('  ℹ️  Using existing IFC appbundle');
        }
      } else {
        throw error;
      }
    }
  }

  private async createIFCActivity(token: string): Promise<void> {
    const activityId = 'BIMHealthIFCActivityV2'; // Changed from V1 to V2

    const activitySpec = {
      id: activityId,
      commandLine: [
        '$(engine.path)\\revitcoreconsole.exe /i "$(args[ifcFile].path)" /al "$(appbundles[BIMHealthIFCActivityV2].path)"'
      ],
      engine: 'Autodesk.Revit+2024',
      appbundles: [`${this.clientId}.BIMHealthIFCActivityV2+prod`],
      parameters: {
        ifcFile: {
          verb: 'get',
          description: 'Input IFC file',
          localName: 'input.ifc',
          required: true
        },
        result: {
          verb: 'put',
          description: 'Output JSON report',
          localName: 'report.json',
          required: true
        }
      }
    };

    try {
      await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/activities',
        activitySpec,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Create alias
      await axios.post(
        `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}/aliases`,
        { id: 'prod', version: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('  ✅ IFC Activity created');

    } catch (error: any) {
      if (error.response?.status === 409) {
        console.log('  ℹ️  IFC Activity already exists');
      } else {
        console.error('  ❌ Failed to create IFC activity:', error.response?.data);
        throw error;
      }
    }
  }
}
