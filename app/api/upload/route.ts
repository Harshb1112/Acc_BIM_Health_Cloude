import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { RevitProcessor } from '@/lib/services/revitProcessor';
import crypto from 'crypto';
import { requireActiveSubscription } from '@/lib/subscription-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes (Vercel Hobby plan max is 300s)

const reportCache = new Map<string, unknown>();

export async function POST(request: NextRequest) {
  try {
    const accessError = await requireActiveSubscription(request);
    if (accessError) return accessError;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('clientId') as string;
    const clientSecret = formData.get('clientSecret') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads', 'RVT');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file
    const fileName = file.name;
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    console.log(`📁 Processing RVT file: ${fileName}`);
    console.log(`📊 File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🔑 Using user credentials: ${clientId.substring(0, 10)}...`);

    // Process RVT file with user's credentials
    const revitProcessor = new RevitProcessor(clientId, clientSecret);
    const reportData = await revitProcessor.processRVTFile(filePath, fileName);

    console.log(`✅ Report generated successfully`);

    // Generate unique report ID
    const reportId = crypto.randomBytes(16).toString('hex');

    // Save report data to session storage (in-memory for now)
    // In production, you'd save this to a database
    reportCache.set(reportId, reportData);

    // Cleanup file after processing
    setTimeout(async () => {
      try {
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
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process RVT file',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
