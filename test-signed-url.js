import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.FORGE_CLIENT_ID;
const CLIENT_SECRET = process.env.FORGE_CLIENT_SECRET;
const BUCKET_KEY = `bim_health_${CLIENT_ID.toLowerCase()}`;

async function getToken() {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('grant_type', 'client_credentials');
  params.append('scope', 'data:read data:write data:create bucket:create bucket:read code:all');

  const response = await axios.post(
    'https://developer.api.autodesk.com/authentication/v2/token',
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data.access_token;
}

async function testSignedUrl() {
  try {
    console.log('🔑 Getting access token...');
    const token = await getToken();
    console.log('✅ Token obtained');
    console.log(`   Client ID: ${CLIENT_ID}\n`);

    // First check if bucket exists
    console.log(`📦 Checking bucket: ${BUCKET_KEY}`);
    try {
      const bucketResponse = await axios.get(
        `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/details`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      console.log('✅ Bucket exists\n');
    } catch (bucketError) {
      console.log('❌ Bucket check failed:', bucketError.response?.data || bucketError.message);
      console.log('   Trying to create bucket...\n');
      
      try {
        await axios.post(
          'https://developer.api.autodesk.com/oss/v2/buckets',
          {
            bucketKey: BUCKET_KEY,
            policyKey: 'transient'
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('✅ Bucket created\n');
      } catch (createError) {
        console.log('❌ Bucket creation failed:', createError.response?.data || createError.message);
      }
    }

    const objectKey = `test_${Date.now()}.json`;
    
    console.log(`📤 Testing signeds3upload for: ${objectKey}`);
    console.log(`   Full URL: https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload\n`);

    const response = await axios.get(
      `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          minutesExpiration: 60,
          firstPart: 1,
          parts: 1
        }
      }
    );

    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n🔗 First URL:');
    console.log(response.data.urls[0]);
    
    // Check if it's a real S3 URL
    if (response.data.urls[0].includes('s3.amazonaws.com') || response.data.urls[0].includes('s3-')) {
      console.log('\n✅ This is a DIRECT S3 URL - correct!');
    } else if (response.data.urls[0].includes('developer.api.autodesk.com')) {
      console.log('\n❌ This is still the OLD OSS proxy URL - problem!');
    } else {
      console.log('\n⚠️  Unknown URL format');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.statusText);
    console.error('   Details:', JSON.stringify(error.response?.data, null, 2));
  }
}

testSignedUrl();
