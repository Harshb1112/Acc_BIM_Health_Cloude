/**
 * List all activities and appbundles
 */

import axios from 'axios';

const clientId = process.argv[2];
const clientSecret = process.argv[3];

if (!clientId || !clientSecret) {
  console.error('❌ Usage: node list-all-activities.js <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

try {
  // Get token
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'code:all'
  });

  const tokenResponse = await axios.post(
    'https://developer.api.autodesk.com/authentication/v2/token',
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const token = tokenResponse.data.access_token;
  console.log('✅ Token obtained\n');

  // List all activities
  console.log('📋 ALL ACTIVITIES:\n');
  const activitiesResponse = await axios.get(
    `https://developer.api.autodesk.com/da/us-east/v3/activities`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  for (const activity of (activitiesResponse.data.data || [])) {
    console.log(`  - ${activity}`);
    
    // Get details
    try {
      const detailResponse = await axios.get(
        `https://developer.api.autodesk.com/da/us-east/v3/activities/${activity}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`    Engine: ${detailResponse.data.engine}`);
      console.log(`    Version: ${detailResponse.data.version}`);
    } catch (e) {
      console.log(`    (Could not get details)`);
    }
  }

  // List all appbundles
  console.log('\n📦 ALL APPBUNDLES:\n');
  const appbundlesResponse = await axios.get(
    `https://developer.api.autodesk.com/da/us-east/v3/appbundles`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  for (const appbundle of (appbundlesResponse.data.data || [])) {
    console.log(`  - ${appbundle}`);
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.response?.data) {
    console.error('Details:', JSON.stringify(error.response.data, null, 2));
  }
}
