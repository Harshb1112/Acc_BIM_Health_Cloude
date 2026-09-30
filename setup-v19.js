import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '.env') });

const CLIENT_ID = process.env.FORGE_CLIENT_ID;
const CLIENT_SECRET = process.env.FORGE_CLIENT_SECRET;

console.log('🚀 Setting up Multi-Version Support (2023-2027)');
console.log('📦 This will upload all available bundles to Forge');

// Define all Revit versions to support (2023-2027)
const REVIT_VERSIONS = [
  { year: '2023', engine: 'Autodesk.Revit+2023' },
  { year: '2024', engine: 'Autodesk.Revit+2024' },
  { year: '2025', engine: 'Autodesk.Revit+2025' },
  { year: '2026', engine: 'Autodesk.Revit+2026' },
  { year: '2027', engine: 'Autodesk.Revit+2027' }
];

async function getToken() {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('grant_type', 'client_credentials');
  params.append('scope', 'code:all');

  const response = await axios.post(
    'https://developer.api.autodesk.com/authentication/v2/token',
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data.access_token;
}

async function setupVersion(token, version) {
  const appBundleId = `BIMHealthReportActivity${version.year}`;
  const activityId = `BIMHealthReportActivity${version.year}`;
  
  console.log(`\n========================================`);
  console.log(`📦 Setting up Revit ${version.year}`);
  console.log(`========================================`);
  
  try {
    // Check if bundle ZIP exists
    const zipPath = path.join(__dirname, `BIMHealthReportActivity-${version.year}.zip`);
    
    if (!fs.existsSync(zipPath)) {
      console.log(`⚠️  Bundle not found: BIMHealthReportActivity-${version.year}.zip`);
      console.log(`   Skipping Revit ${version.year}`);
      return false;
    }

    const zipStats = fs.statSync(zipPath);
    console.log(`📦 Found bundle: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Create AppBundle
    console.log('📦 Creating AppBundle...');
    let createResponse;
    try {
      createResponse = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/appbundles',
        {
          id: appBundleId,
          engine: version.engine,
          description: `BIM Health Report for Revit ${version.year}`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`✅ AppBundle created: version ${createResponse.data.version}`);
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('ℹ️  AppBundle exists, creating new version...');
        createResponse = await axios.post(
          `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${appBundleId}/versions`,
          {
            engine: version.engine,
            description: `BIM Health Report for Revit ${version.year} (Updated)`
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`✅ New version: ${createResponse.data.version}`);
      } else {
        throw error;
      }
    }

    // Upload ZIP
    console.log('📤 Uploading bundle...');
    const uploadUrl = createResponse.data.uploadParameters.endpointURL;
    const formData = createResponse.data.uploadParameters.formData;
    
    const form = new FormData();
    Object.keys(formData).forEach(key => form.append(key, formData[key]));
    form.append('file', fs.createReadStream(zipPath));
    
    await axios.post(uploadUrl, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    console.log('✅ Bundle uploaded');

    // Create/Update AppBundle Alias
    console.log('🏷️  Creating AppBundle alias...');
    try {
      await axios.post(
        `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${appBundleId}/aliases`,
        { id: 'prod', version: createResponse.data.version },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      if (error.response?.status === 409) {
        await axios.patch(
          `https://developer.api.autodesk.com/da/us-east/v3/appbundles/${appBundleId}/aliases/prod`,
          { version: createResponse.data.version },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    }
    console.log('✅ Alias created');

    // Create Activity
    console.log('⚙️  Creating Activity...');
    let activityVersion = 1;
    try {
      const activityResponse = await axios.post(
        'https://developer.api.autodesk.com/da/us-east/v3/activities',
        {
          id: activityId,
          commandLine: [
            `$(engine.path)\\revitcoreconsole.exe /i "$(args[rvtFile].path)" /al "$(appbundles[${appBundleId}].path)"`
          ],
          engine: version.engine,
          appbundles: [`${CLIENT_ID}.${appBundleId}+prod`],
          parameters: {
            rvtFile: { verb: 'get', description: 'Input Revit file', localName: 'input.rvt', required: true },
            result: { verb: 'put', description: 'Output JSON report', localName: 'report.json', required: true }
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      activityVersion = activityResponse.data.version;
      console.log(`✅ Activity created: version ${activityVersion}`);
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('ℹ️  Activity exists, creating new version...');
        const versionResponse = await axios.post(
          `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}/versions`,
          {
            commandLine: [`$(engine.path)\\revitcoreconsole.exe /i "$(args[rvtFile].path)" /al "$(appbundles[${appBundleId}].path)"`],
            engine: version.engine,
            appbundles: [`${CLIENT_ID}.${appBundleId}+prod`],
            parameters: {
              rvtFile: { verb: 'get', description: 'Input Revit file', localName: 'input.rvt', required: true },
              result: { verb: 'put', description: 'Output JSON report', localName: 'report.json', required: true }
            }
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        activityVersion = versionResponse.data.version;
        console.log(`✅ New activity version: ${activityVersion}`);
      } else {
        throw error;
      }
    }

    // Create/Update Activity Alias
    console.log('🏷️  Creating Activity alias...');
    try {
      await axios.post(
        `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}/aliases`,
        { id: 'prod', version: activityVersion },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      if (error.response?.status === 409) {
        await axios.patch(
          `https://developer.api.autodesk.com/da/us-east/v3/activities/${activityId}/aliases/prod`,
          { version: activityVersion },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    }
    console.log('✅ Activity alias created');

    console.log(`✅ Revit ${version.year} setup complete!`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error setting up Revit ${version.year}:`, error.response?.data || error.message);
    return false;
  }
}

async function setupAll() {
  try {
    console.log('\n🔑 Getting authentication token...');
    const token = await getToken();
    console.log('✅ Token obtained\n');
    
    console.log('📋 Checking available bundles...');
    const availableBundles = [];
    
    for (const version of REVIT_VERSIONS) {
      const zipPath = path.join(__dirname, `BIMHealthReportActivity-${version.year}.zip`);
      if (fs.existsSync(zipPath)) {
        availableBundles.push(version);
        const zipStats = fs.statSync(zipPath);
        console.log(`✅ Found: BIMHealthReportActivity-${version.year}.zip (${(zipStats.size / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        console.log(`⚠️  Missing: BIMHealthReportActivity-${version.year}.zip`);
      }
    }
    
    if (availableBundles.length === 0) {
      console.log('\n❌ No bundles found!');
      console.log('\nTo create bundles:');
      console.log('1. Go to local_plugin folder');
      console.log('2. Run appropriate CREATE_BUNDLE_*.bat files');
      console.log('3. Copy ZIP files to this server folder');
      return;
    }
    
    console.log(`\n🚀 Setting up ${availableBundles.length} Revit version(s)...\n`);
    
    let successCount = 0;
    const results = [];
    
    for (const version of availableBundles) {
      const success = await setupVersion(token, version);
      if (success) {
        successCount++;
        results.push({ version: version.year, status: '✅ Success' });
      } else {
        results.push({ version: version.year, status: '❌ Failed' });
      }
    }
    
    console.log('\n========================================');
    console.log('📊 SETUP SUMMARY');
    console.log('========================================');
    console.log(`Total: ${availableBundles.length} | Success: ${successCount} | Failed: ${availableBundles.length - successCount}`);
    console.log('');
    
    results.forEach(r => {
      console.log(`  Revit ${r.version}: ${r.status}`);
    });
    
    if (successCount > 0) {
      console.log('\n========================================');
      console.log('✅ ACTIVITIES CREATED');
      console.log('========================================');
      results.filter(r => r.status.includes('Success')).forEach(r => {
        console.log(`  - BIMHealthReportActivity${r.version}`);
      });
      console.log('\n✨ All activities are ready to use!');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

setupAll();
