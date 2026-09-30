import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const { code, clientId, clientSecret, redirectUri } = await request.json();

    if (!code || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      'https://developer.api.autodesk.com/authentication/v2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return NextResponse.json({
      success: true,
      access_token: tokenResponse.data.access_token,
      refresh_token: tokenResponse.data.refresh_token,
      expires_in: tokenResponse.data.expires_in
    });
  } catch (error: any) {
    console.error('Token exchange error:', error.response?.data || error.message);
    
    const errorData = error.response?.data;
    let errorMessage = 'Failed to exchange token';
    let statusCode = 500;
    
    if (errorData?.error === 'invalid_grant') {
      errorMessage = 'Authorization code is invalid or has expired. Please try logging in again.';
      statusCode = 401;
    } else if (errorData?.error === 'invalid_client') {
      errorMessage = 'Invalid Client ID or Client Secret. Please check your credentials.';
      statusCode = 401;
    } else if (errorData?.error_description) {
      errorMessage = errorData.error_description;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorData?.error_description || error.message,
        errorCode: errorData?.error
      },
      { status: statusCode }
    );
  }
}
