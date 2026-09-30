// Test chunked upload API directly
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
const FILE_PATH = 'G:\\PROJECT-HB\\ACC bim health chekup report\\cloude_plugin\\uploads\\RVT\\Snowdon Towers Sample Architectural.rvt';
const API_BASE = 'http://localhost:3000'; // Change to production URL if needed

// Your credentials
const CLIENT_ID = 'YOUR_AUTODESK_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_AUTODESK_CLIENT_SECRET';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN'; // Get from localStorage after login

async function testChunkedUpload() {
  console.log('📂 Reading file:', FILE_PATH);
  
  const fileBuffer = fs.readFileSync(FILE_PATH);
  const fileName = path.basename(FILE_PATH);
  const fileSize = fileBuffer.length;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const uploadId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  console.log(`📊 File: ${fileName}`);
  console.log(`📦 Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🔢 Total chunks: ${totalChunks}`);
  console.log(`🆔 Upload ID: ${uploadId}`);
  console.log('');

  // Step 1: Upload chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunk = fileBuffer.slice(start, end);

    console.log(`📤 Uploading chunk ${i + 1}/${totalChunks} (${(chunk.length / 1024 / 1024).toFixed(2)} MB)...`);

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
          'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
      });

      if (response.data.success) {
        console.log(`✅ Chunk ${i + 1}/${totalChunks} uploaded successfully`);
      } else {
        throw new Error('Chunk upload failed');
      }
    } catch (error) {
      console.error(`❌ Failed to upload chunk ${i + 1}:`, error.response?.data || error.message);
      return;
    }
  }

  console.log('');
  console.log('🔧 All chunks uploaded! Completing upload and processing...');

  // Step 2: Complete upload
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

    if (response.data.success) {
      console.log('✅ Upload complete!');
      console.log(`📊 Report ID: ${response.data.reportId}`);
      console.log(`🔗 View report: ${API_BASE}/report/${response.data.reportId}`);
    } else {
      throw new Error('Upload completion failed');
    }
  } catch (error) {
    console.error('❌ Failed to complete upload:', error.response?.data || error.message);
  }
}

// Run test
console.log('🚀 Starting chunked upload test...');
console.log('');
testChunkedUpload().catch(console.error);
