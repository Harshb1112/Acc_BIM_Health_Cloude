import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const WORK_ITEM_ID = process.argv[2] || 'ec3584f5d3c643f487110557b8e82147';
const CLIENT_ID = process.env.FORGE_CLIENT_ID;
const CLIENT_SECRET = process.env.FORGE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set FORGE_CLIENT_ID and FORGE_CLIENT_SECRET in .env before running this script.');
  process.exit(1);
}

async function getAccessToken() {
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

async function checkWorkItemStatus(workItemId) {
  console.log(`\n🔍 Checking work item: ${workItemId}\n`);

  const token = await getAccessToken();

  try {
    const response = await axios.get(
      `https://developer.api.autodesk.com/da/us-east/v3/workitems/${workItemId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = response.data;
    
    console.log('📊 Work Item Status:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Status:      ${data.status}`);
    console.log(`ID:          ${data.id}`);
    console.log(`Progress:    ${data.progress || 'N/A'}`);
    
    if (data.stats) {
      console.log(`\n⏱️  Timing:`);
      if (data.stats.timeQueued) {
        console.log(`  Created:   ${new Date(data.stats.timeQueued).toLocaleString()}`);
      }
      if (data.stats.timeInstructionsStarted) {
        console.log(`  Started:   ${new Date(data.stats.timeInstructionsStarted).toLocaleString()}`);
      }
      if (data.stats.timeInstructionsEnded) {
        console.log(`  Ended:     ${new Date(data.stats.timeInstructionsEnded).toLocaleString()}`);
        const duration = new Date(data.stats.timeInstructionsEnded) - new Date(data.stats.timeInstructionsStarted);
        console.log(`  Duration:  ${Math.round(duration / 1000)}s`);
      }
    }

    if (data.reportUrl) {
      console.log(`\n📄 Report URL:`);
      console.log(`  ${data.reportUrl}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // If failed, try to get error details
    if (data.status.includes('failed') || data.status === 'cancelled') {
      console.log('❌ Work item failed. Fetching error report...\n');
      
      try {
        const reportResponse = await axios.get(data.reportUrl);
        console.log('========== ERROR REPORT ==========');
        console.log(reportResponse.data);
        console.log('==================================\n');
      } catch (reportError) {
        console.log('⚠️  Could not fetch error report:', reportError.message);
      }
    } else if (data.status === 'success') {
      console.log('✅ Work item completed successfully!');
      console.log('   Output should be available at the specified location.\n');
    } else if (data.status === 'pending' || data.status === 'inprogress') {
      console.log('⏳ Work item is still processing...');
      console.log('   Run this script again in a few seconds.\n');
    }

    return data;

  } catch (error) {
    if (error.response?.status === 404) {
      console.error('❌ Work item not found.\n');
    } else {
      console.error('❌ Error:', error.response?.data || error.message);
    }
    throw error;
  }
}

checkWorkItemStatus(WORK_ITEM_ID)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
