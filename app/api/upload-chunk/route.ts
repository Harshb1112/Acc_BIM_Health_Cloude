import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { requireActiveSubscription } from '@/lib/subscription-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute per chunk

export async function POST(request: NextRequest) {
  try {
    const accessError = await requireActiveSubscription(request);
    if (accessError) return accessError;

    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const fileName = formData.get('fileName') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);

    if (!chunk || !fileName || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create chunks directory
    const uploadsDir = path.join(process.cwd(), 'uploads', 'RVT');
    const chunksDir = path.join(uploadsDir, 'chunks');
    
    if (!existsSync(chunksDir)) {
      await mkdir(chunksDir, { recursive: true });
    }

    // Save chunk
    const bytes = await chunk.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const chunkPath = path.join(chunksDir, `${fileName}.part${chunkIndex}`);
    
    await writeFile(chunkPath, buffer);
    
    console.log(`✅ Saved chunk ${chunkIndex + 1}/${totalChunks} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    return NextResponse.json({
      success: true,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`,
      chunkIndex,
      totalChunks,
    });
  } catch (error: any) {
    console.error('❌ Chunk upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload chunk',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
