import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    forgeEnabled: process.env.ENABLE_FORGE_PROCESSING === 'true',
    forgeConfigured: !!(
      process.env.FORGE_CLIENT_ID && process.env.FORGE_CLIENT_SECRET
    ),
  });
}
