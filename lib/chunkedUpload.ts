// Chunked file upload for large files
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks

export interface UploadProgress {
  uploadedChunks: number;
  totalChunks: number;
  percentage: number;
}

export async function uploadFileInChunks(
  file: File,
  clientId: string,
  clientSecret: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ reportId: string; status?: string }> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  console.log(`📤 Starting chunked upload: ${file.name}`);
  console.log(`📊 File size: ${(file.size / 1024 / 1024).toFixed(2)} MB in ${totalChunks} chunks`);

  // Upload each chunk
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('fileName', file.name);
    formData.append('uploadId', uploadId);

    const token = localStorage.getItem('accessToken');
    const response = await fetch('/api/upload-chunk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload chunk');
    }

    if (onProgress) {
      onProgress({
        uploadedChunks: chunkIndex + 1,
        totalChunks,
        percentage: Math.round(((chunkIndex + 1) / totalChunks) * 100),
      });
    }

    console.log(`✅ Uploaded chunk ${chunkIndex + 1}/${totalChunks}`);
  }

  // Complete upload (triggers background processing)
  console.log(`🔧 Completing upload and triggering background processing...`);
  const token = localStorage.getItem('accessToken');
  const completeResponse = await fetch('/api/upload-complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      uploadId,
      fileName: file.name,
      totalChunks,
      clientId,
      clientSecret,
    }),
  });

  if (!completeResponse.ok) {
    const error = await completeResponse.json();
    throw new Error(error.error || 'Failed to complete upload');
  }

  const result = await completeResponse.json();
  console.log(`✅ Upload complete! Report ID: ${result.reportId}`);
  console.log(`⏳ Status: ${result.status} - Processing in background...`);
  
  return { 
    reportId: result.reportId,
    status: result.status // 'processing'
  };
}
