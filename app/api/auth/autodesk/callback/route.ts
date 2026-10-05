import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

export const dynamic = 'force-dynamic';

/**
 * Step 2: Handle Autodesk OAuth callback
 * Exchange authorization code for access token
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for authorization errors
    if (error) {
      console.error('❌ Autodesk authorization error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=autodesk_auth_failed&reason=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=missing_parameters`
      );
    }

    // Decode state to get userId
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const userId = stateData.userId;

    console.log('🔐 Processing Autodesk callback...');
    console.log(`   User ID: ${userId}`);
    console.log(`   Authorization code received`);

    // Bimboss APS credentials
    const clientId = process.env.FORGE_CLIENT_ID;
    const clientSecret = process.env.FORGE_CLIENT_SECRET;
    const callbackUrl = process.env.FORGE_CALLBACK_URL || 
                       `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/autodesk/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Autodesk credentials not configured');
    }

    // Exchange code for access token
    console.log('🔄 Exchanging code for access token...');
    
    const tokenResponse = await axios.post(
      'https://developer.api.autodesk.com/authentication/v2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const {
      access_token,
      refresh_token,
      expires_in
    } = tokenResponse.data;

    console.log('✅ Access token received');
    console.log(`   Expires in: ${expires_in} seconds`);

    // Get Autodesk user info
    console.log('👤 Fetching Autodesk user info...');
    const userInfoResponse = await axios.get(
      'https://api.userprofile.autodesk.com/userinfo',
      {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    );

    const autodeskUser = userInfoResponse.data;
    console.log(`✅ Autodesk user: ${autodeskUser.email || autodeskUser.name}`);

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // Update user in database with Autodesk tokens
    await prisma.user.update({
      where: { id: userId },
      data: {
        autodeskUserId: autodeskUser.sub || autodeskUser.userId,
        autodeskAccessToken: access_token,
        autodeskRefreshToken: refresh_token,
        autodeskTokenExpiry: tokenExpiry,
        autodeskConnectedAt: new Date()
      }
    });

    console.log('💾 User tokens saved to database');
    console.log('✅ Autodesk account connected successfully!');

    // Redirect back to settings page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=autodesk_connected`
    );

  } catch (error: any) {
    console.error('❌ Callback error:', error.response?.data || error.message);
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=autodesk_callback_failed&details=${encodeURIComponent(error.message)}`
    );
  }
}
