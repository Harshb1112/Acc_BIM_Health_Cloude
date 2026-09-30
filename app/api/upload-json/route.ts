import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Helper function to convert PascalCase to camelCase
const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item));
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc: any, key: string) => {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name;
    console.log(`📊 Processing JSON file: ${fileName}`);

    // Read JSON content
    const text = await file.text();

    // Parse and validate JSON
    let reportData;
    try {
      reportData = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json(
        {
          error: 'Invalid JSON file',
          details: 'The uploaded file is not a valid JSON format',
        },
        { status: 400 }
      );
    }

    // DEBUG: Log issues count BEFORE camelCase conversion
    console.log(
      `🔍 JSON UPLOAD (BEFORE) - Issues found: ${
        reportData.Issues?.length || reportData.issues?.length || 0
      }`
    );

    // Convert PascalCase keys to camelCase for frontend compatibility
    reportData = toCamelCase(reportData);

    // Add metadata
    reportData.uploadedAt = new Date().toISOString();
    reportData.source = 'JSON Upload';

    // DEBUG: Log issues count AFTER camelCase conversion
    console.log(
      `🔍 JSON UPLOAD (AFTER) - Issues found: ${reportData.issues?.length || 0}`
    );

    console.log(`✅ JSON report imported successfully`);

    // Generate unique report ID
    const reportId = crypto.randomBytes(16).toString('hex');

    // Save report data to session storage (in-memory for now)
    (global as any).reportCache = (global as any).reportCache || new Map();
    (global as any).reportCache.set(reportId, reportData);

    return NextResponse.json({
      success: true,
      message: 'JSON file imported successfully',
      reportId,
      reportData,
      data: reportData,
    });
  } catch (error: any) {
    console.error('❌ JSON upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process JSON file',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
