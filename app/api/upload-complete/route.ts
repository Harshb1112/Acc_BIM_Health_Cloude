import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink, mkdir, rmdir } from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import { RevitProcessor } from '@/lib/services/revitProcessor';
import crypto from 'crypto';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; // 10 seconds - Vercel Hobby limit

// Complete upload and trigger async processing
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

    // Get user info
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log(`📦 Received upload completion request for ${fileName}`);
    console.log(`📊 Total chunks: ${totalChunks}, Upload ID: ${uploadId}`);

    // Generate report ID immediately
    const reportId = crypto.randomBytes(16).toString('hex');

    // Create pending report in database
    await prisma.report.create({
      data: {
        id: reportId,
        userId: payload.userId,
        projectName: fileName.replace('.rvt', ''),
        fileName: fileName,
        reportData: { status: 'processing', uploadId, totalChunks } as any,
        overallGrade: null,
        totalElements: 0,
        uploadedAt: new Date(),
      },
    });

    console.log(`✅ Created pending report: ${reportId}`);

    // Trigger background processing (fire and forget)
    // This runs asynchronously - user gets immediate response
    processFileInBackground(uploadId, fileName, totalChunks, clientId, clientSecret, reportId, payload.userId)
      .catch(err => console.error('Background processing error:', err));

    // Return immediately with report ID
    return NextResponse.json({
      success: true,
      reportId,
      message: 'File upload complete. Processing in background...',
      status: 'processing'
    });

  } catch (error: any) {
    console.error('❌ Upload complete error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload', details: error.message },
      { status: 500 }
    );
  }
}

// Background processing function
async function processFileInBackground(
  uploadId: string,
  fileName: string,
  totalChunks: number,
  clientId: string,
  clientSecret: string,
  reportId: string,
  userId: number
) {
  try {
    console.log(`🔄 Background processing started for report ${reportId}`);

    const tempDir = path.join('/tmp', 'uploads', 'temp', uploadId);
    const finalDir = path.join('/tmp', 'uploads', 'RVT');
    
    if (!existsSync(finalDir)) {
      await mkdir(finalDir, { recursive: true });
    }

    const finalPath = path.join(finalDir, fileName);
    
    // Merge chunks
    console.log(`📦 Merging ${totalChunks} chunks...`);
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

    // Process file with Forge
    console.log(`🔧 Processing RVT file with Forge...`);
    const revitProcessor = new RevitProcessor(clientId, clientSecret);
    const reportData = await revitProcessor.processRVTFile(finalPath, fileName);

    // Update report in database
    await prisma.report.update({
      where: { id: reportId },
      data: {
        projectName: reportData.projectName || fileName.replace('.rvt', ''),
        reportData: reportData as any,
        overallGrade: reportData.overallGrade || null,
        totalElements: reportData.statistics?.totalElements || 0,
      },
    });

    console.log(`✅ Report ${reportId} processed successfully!`);

    // Cleanup file
    try {
      await unlink(finalPath);
    } catch (err) {
      console.warn('⚠️ File cleanup warning:', err);
    }

  } catch (error: any) {
    console.error(`❌ Background processing failed for ${reportId}:`, error);
    
    // Update report with error status
    try {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          reportData: { 
            status: 'failed', 
            error: error.message 
          } as any,
        },
      });
    } catch (dbError) {
      console.error('Failed to update error status:', dbError);
    }
  }
}
