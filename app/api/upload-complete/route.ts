import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { RevitProcessor } from '@/lib/services/revitProcessor';
import crypto from 'crypto';
import { requireActiveSubscription } from '@/lib/subscription-auth';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 1800; // 30 minutes (changed from 60 minutes)

const reportCache = new Map<string, unknown>();

export async function POST(request: NextRequest) {
  try {
    const accessError = await requireActiveSubscription(request);
    if (accessError) return accessError;

    const body = await request.json();
    const { fileName, totalChunks, clientId, clientSecret } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    // Validate file type
    if (!fileName.toLowerCase().endsWith('.rvt')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .rvt files are supported.' },
        { status: 400 }
      );
    }

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: 'Autodesk credentials required',
          message: 'Please configure your Autodesk Client ID and Client Secret in Settings',
        },
        { status: 400 }
      );
    }

    console.log(`🔧 Completing chunked upload: ${fileName}`);
    console.log(`📊 Total chunks: ${totalChunks}`);

    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads', 'RVT');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const chunksDir = path.join(uploadsDir, 'chunks');
    const filePath = path.join(uploadsDir, fileName);

    // Combine all chunks into final file
    const chunks: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunksDir, `${fileName}.part${i}`);
      if (!existsSync(chunkPath)) {
        return NextResponse.json(
          { error: `Missing chunk ${i}` },
          { status: 400 }
        );
      }
      const chunkData = await readFile(chunkPath);
      chunks.push(chunkData);
    }

    // Write complete file
    const completeBuffer = Buffer.concat(chunks);
    await writeFile(filePath, completeBuffer);

    console.log(`📁 Processing RVT file: ${fileName}`);
    console.log(`📊 File size: ${(completeBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🔑 Using user credentials: ${clientId.substring(0, 10)}...`);

    // Process RVT file with user's credentials
    const revitProcessor = new RevitProcessor(clientId, clientSecret);
    const reportData = await revitProcessor.processRVTFile(filePath, fileName);

    console.log(`✅ Report generated successfully`);

    // Generate unique report ID
    const reportId = crypto.randomBytes(16).toString('hex');

    // Get user ID from token
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Save report to database
    try {
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
      console.log(`💾 Report saved to database with ID: ${reportId}`);
    } catch (dbError) {
      console.error('❌ Database save error:', dbError);
      // Continue even if DB save fails - report is in cache
    }

    // Also save to cache for immediate access
    reportCache.set(reportId, reportData);

    // Cleanup chunks and file after processing
    setTimeout(async () => {
      try {
        // Delete chunks
        for (let i = 0; i < totalChunks; i++) {
          const chunkPath = path.join(chunksDir, `${fileName}.part${i}`);
          if (existsSync(chunkPath)) {
            await unlink(chunkPath);
          }
        }
        console.log(`🗑️  Deleted ${totalChunks} chunks`);

        // Delete complete file
        if (existsSync(filePath)) {
          await unlink(filePath);
          console.log(`🗑️  Deleted RVT file: ${fileName}`);
        }
      } catch (cleanupError) {
        console.error('⚠️  Cleanup error:', cleanupError);
      }
    }, 5000);

    return NextResponse.json({
      success: true,
      message: 'RVT file processed successfully',
      reportId,
      reportData,
      data: reportData,
    });
  } catch (error: any) {
    console.error('❌ Upload complete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process RVT file',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
