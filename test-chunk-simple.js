// Simple test - just test chunk upload endpoint
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const FILE_PATH = 'G:\\PROJECT-HB\\ACC bim health chekup report\\cloude_plugin\\uploads\\RVT\\Snowdon Towers Sample Architectural.rvt';
const API_BASE = 'https://bim-health-report.vercel.app';

async function testSingleChunk() {
  console.log('📂 Reading first 4MB of file...');
  
  const fileBuffer = fs.readFileSync(FILE_PATH);
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
  const firstChunk = fileBuffer.slice(0, CHUNK_SIZE);
  const uploadId = `test-${Date.now()}`;

  console.log(`📦 Chunk size: ${(firstChunk.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🆔 Upload ID: ${uploadId}`);
  console.log('');

  const formData = new FormData();
  formData.append('chunk', firstChunk, { filename: 'chunk-0' });
  formData.append('chunkIndex', '0');
  formData.append('totalChunks', '24');
  formData.append('fileName', 'Snowdon Towers Sample Architectural.rvt');
  formData.append('uploadId', uploadId);

  console.log('📤 Testing chunk upload endpoint...');
  
  try {
    const response = await axios.post(`${API_BASE}/api/upload-chunk`, formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    console.log('✅ SUCCESS! Chunk uploaded');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ FAILED!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testSingleChunk().catch(console.error);
