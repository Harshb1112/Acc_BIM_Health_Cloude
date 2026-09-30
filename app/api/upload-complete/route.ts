import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink, mkdir, rmdir } from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { RevitProcessor } from '@/lib/services/revitProcessor';
import crypto from 'crypto';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Complete upload and process
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uploadId, fileName, totalChunks, clientId, clientSecret } = body;

    if (!uploadId || !fileName || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!fileName.toLowerCase().endsWith('.rvt')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .rvt files are supported.' },
        { status: 400 }
      );
    }

    console.log(`📦 Merging ${totalChunks} chunks for ${fileName}...`);

    const tempDir = path.join(process.cwd(), 'uploads', 'temp', uploadId);
    const finalDir = path.join(process.cwd(), 'uploads', 'RVT');
    
    if (!existsSync(finalDir)) {
      await mkdir(finalDir, { recursive: true });
    }

    const finalPath = path.join(finalDir, fileName);
    
    // Merge chunks
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(tempDir, `chunk-${i}`);
      if (!existsSync(chunkPath)) {
        throw new Error(`Missing chunk ${i}`);
      }
      const chunkBuffer = await readFile(chunkPath);
      chunks.push(chunkBuffer);
    }

    const finalBuffer = Buffer.concat(chunks);
    await writeFile(finalPath, finalBuffer);

    console.log(`✅ File merged: ${(finalBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Cleanup chunks
    try {
      const chunkFiles = readdirSync(tempDir);
      for (const file of chunkFiles) {
        await unlink(path.join(tempDir, file));
      }
      await rmdir(tempDir);
    } catch (err) {
      console.warn('⚠️ Cleanup warning:', err);
    }

    // Process file
    console.log(`🔧 Processing RVT file...`);
    const revitProcessor = new RevitProcessor(clientId, clientSecret);
    const reportData = await revitProcessor.processRVTFile(finalPath, fileName);

    const reportId = crypto.randomBytes(16).toString('hex');
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await prisma.report.create({
      data: {
        id: reportId,
        userId: payload.userId,
        projectName: reportData.projectName || fileName.replace('.rvt', ''),
        fileName: fileName,
        reportData: reportData as any,
        overallGrade: reportData.overallGrade || null,
        totalElements: reportData.statistics?.totalElements || 0,
        uploadedAt: new Date(),
      },
    });

    // Cleanup file
    try {
      await unlink(finalPath);
    } catch (err) {
      console.warn('⚠️ File cleanup warning:', err);
    }

    return NextResponse.json({
      success: true,
      reportId,
      message: 'Report generated successfully',
    });

  } catch (error: any) {
    console.error('❌ Upload complete error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload', details: error.message },
      { status: 500 }
    );
  }
}
