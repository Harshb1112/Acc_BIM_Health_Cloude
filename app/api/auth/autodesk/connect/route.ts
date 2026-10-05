import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Step 1: Redirect user to Autodesk login
 * This initiates the 3-legged OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from cookie (set by frontend before redirect)
    const cookieToken = request.cookies.get('accessToken')?.value;
    
    console.log('🔍 Checking authentication...');
    console.log(`   Cookie token: ${cookieToken ? 'Present' : 'Missing'}`);
    
    if (!cookieToken) {
      console.error('❌ No authentication token in cookie');
      const baseUrl = `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
      return NextResponse.redirect(
        `${baseUrl}/settings?error=not_authenticated&tab=forge`
      );
    }

    const payload = verifyToken(cookieToken);
    if (!payload) {
      console.error('❌ Invalid or expired token');
      const baseUrl = `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
      return NextResponse.redirect(
        `${baseUrl}/settings?error=invalid_token&tab=forge`
      );
    }
    
    console.log('✅ User authenticated:', payload.userId);

    console.log('✅ User authenticated:', payload.userId);

    // Bimboss APS credentials
    const clientId = process.env.FORGE_CLIENT_ID;
    
    // Auto-detect callback URL based on request
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const callbackUrl = process.env.FORGE_CALLBACK_URL || `${baseUrl}/api/auth/autodesk/callback`;

    if (!clientId) {
      console.error('❌ Forge credentials not configured');
      return NextResponse.redirect(
        `${baseUrl}/settings?error=autodesk_not_configured&tab=forge`
      );
    }

    console.log('🔐 Autodesk OAuth Configuration:');
    console.log(`   Client ID: ${clientId.substring(0, 10)}...`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Callback URL: ${callbackUrl}`);

    // Scopes for ACC/BIM 360 access
    const scopes = [
      'data:read',      // Read files from ACC
      'data:write',     // Write files to ACC
      'data:create',    // Create new files
      'bucket:read',    // Read OSS buckets
      'bucket:create',  // Create OSS buckets
      'code:all',       // Design Automation API
      'account:read'    // Read account and hub information
    ].join(' ');

    // State contains userId for callback verification
    const state = Buffer.from(JSON.stringify({ 
      userId: payload.userId,
      timestamp: Date.now()
    })).toString('base64');

    // Build Autodesk authorization URL
    const authUrl = new URL('https://developer.api.autodesk.com/authentication/v2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);

    console.log('🔐 Redirecting to Autodesk login...');
    console.log(`   User ID: ${payload.userId}`);
    console.log(`   Callback: ${callbackUrl}`);

    // Redirect to Autodesk login
    return NextResponse.redirect(authUrl.toString());

  } catch (error: any) {
    console.error('❌ Connect error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Autodesk', details: error.message },
      { status: 500 }
    );
  }
}
