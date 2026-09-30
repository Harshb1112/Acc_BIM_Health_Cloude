// Full chunked upload test - All 24 chunks
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const FILE_PATH = 'G:\\PROJECT-HB\\ACC bim health chekup report\\cloude_plugin\\uploads\\RVT\\Snowdon Towers Sample Architectural.rvt';
const API_BASE = 'https://bim-health-report.vercel.app';
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB

// Add your credentials here (optional for chunk upload, required for complete)
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN';

async function testFullUpload() {
  console.log('🚀 Starting full chunked upload test...\n');
  console.log('📂 File:', FILE_PATH);
  
  const fileBuffer = fs.readFileSync(FILE_PATH);
  const fileName = path.basename(FILE_PATH);
  const fileSize = fileBuffer.length;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const uploadId = `full-test-${Date.now()}`;

  console.log(`📊 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🔢 Total chunks: ${totalChunks}`);
  console.log(`🆔 Upload ID: ${uploadId}`);
  console.log('\n' + '='.repeat(60) + '\n');

  // Upload all chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunk = fileBuffer.slice(start, end);
    const chunkSize = (chunk.length / 1024 / 1024).toFixed(2);

    process.stdout.write(`📤 Uploading chunk ${i + 1}/${totalChunks} (${chunkSize} MB)... `);

    const formData = new FormData();
    formData.append('chunk', chunk, { filename: `chunk-${i}` });
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('fileName', fileName);
    formData.append('uploadId', uploadId);

    try {
      const response = await axios.post(`${API_BASE}/api/upload-chunk`, formData, {
        headers: {
          ...formData.getHeaders(),
          // 'Authorization': `Bearer ${AUTH_TOKEN}`, // Uncomment if needed
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      if (response.data.success) {
        console.log('✅');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.log('❌');
      console.error('Error:', error.response?.data || error.message);
      console.log('\n⚠️ Upload stopped at chunk', i + 1);
      return;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All chunks uploaded successfully!');
  console.log('📊 Total uploaded:', (fileSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('\n🎉 TEST PASSED! Chunked upload working perfectly!\n');

  // Note about completion
  console.log('📝 Note: To test full processing with Autodesk Forge:');
  console.log('   1. Add your CLIENT_ID and CLIENT_SECRET above');
  console.log('   2. Add your AUTH_TOKEN above');
  console.log('   3. Uncomment the completion test below\n');
  
  /* Uncomment to test complete processing:
  
  console.log('🔧 Testing upload completion and processing...\n');
  
  try {
    const response = await axios.post(
      `${API_BASE}/api/upload-complete`,
      {
        uploadId,
        fileName,
        totalChunks,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
      }
    );

    console.log('✅ Processing complete!');
    console.log('📊 Report ID:', response.data.reportId);
    console.log('🔗 View at:', `${API_BASE}/report/${response.data.reportId}`);
  } catch (error) {
    console.error('❌ Processing failed:', error.response?.data || error.message);
  }
  
  */
}

// Run test
testFullUpload().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
