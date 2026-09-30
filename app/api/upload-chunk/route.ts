import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Handle individual chunk upload
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const fileName = formData.get('fileName') as string;
    const uploadId = formData.get('uploadId') as string;

    if (!chunk || fileName === null || uploadId === null) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create temp directory for chunks
    const tempDir = path.join(process.cwd(), 'uploads', 'temp', uploadId);
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Save chunk
    const chunkPath = path.join(tempDir, `chunk-${chunkIndex}`);
    const bytes = await chunk.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(chunkPath, buffer);

    console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} saved`);

    return NextResponse.json({
      success: true,
      chunkIndex,
      totalChunks,
      uploadId,
    });
  } catch (error: any) {
    console.error('❌ Chunk upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload chunk', details: error.message },
      { status: 500 }
    );
  }
}
