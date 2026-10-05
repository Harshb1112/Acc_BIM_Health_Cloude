import { prisma } from './prisma';
import axios from 'axios';

/**
 * Get valid Autodesk access token for a user
 * Automatically refreshes if expired
 */
export async function getAutodeskToken(userId: number): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        autodeskAccessToken: true,
        autodeskRefreshToken: true,
        autodeskTokenExpiry: true
      }
    });

    if (!user?.autodeskAccessToken || !user?.autodeskRefreshToken) {
      console.log('⚠️  User has not connected Autodesk account');
      return null;
    }

    // Check if token is still valid (with 5 minute buffer)
    const now = new Date();
    const expiry = user.autodeskTokenExpiry;
    
    if (expiry && expiry > new Date(now.getTime() + 5 * 60 * 1000)) {
      // Token is still valid
      return user.autodeskAccessToken;
    }

    // Token expired, refresh it
    console.log('🔄 Refreshing Autodesk access token...');
    return await refreshAutodeskToken(userId, user.autodeskRefreshToken);

  } catch (error: any) {
    console.error('❌ Error getting Autodesk token:', error.message);
    return null;
  }
}

/**
 * Refresh Autodesk access token using refresh token
 */
async function refreshAutodeskToken(userId: number, refreshToken: string): Promise<string> {
  const clientId = process.env.FORGE_CLIENT_ID;
  const clientSecret = process.env.FORGE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Autodesk credentials not configured');
  }

  try {
    const response = await axios.post(
      'https://developer.api.autodesk.com/authentication/v2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const {
      access_token,
      refresh_token: new_refresh_token,
      expires_in
    } = response.data;

    // Calculate new expiry
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // Update tokens in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        autodeskAccessToken: access_token,
        autodeskRefreshToken: new_refresh_token || refreshToken, // Use new refresh token if provided
        autodeskTokenExpiry: tokenExpiry
      }
    });

    console.log('✅ Autodesk token refreshed successfully');
    return access_token;

  } catch (error: any) {
    console.error('❌ Failed to refresh Autodesk token:', error.response?.data || error.message);
    
    // If refresh fails, clear tokens (user needs to reconnect)
    await prisma.user.update({
      where: { id: userId },
      data: {
        autodeskAccessToken: null,
        autodeskRefreshToken: null,
        autodeskTokenExpiry: null
      }
    });

    throw new Error('Autodesk token refresh failed. Please reconnect your account.');
  }
}

/**
 * Check if user has connected their Autodesk account
 */
export async function isAutodeskConnected(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      autodeskAccessToken: true,
      autodeskRefreshToken: true
    }
  });

  return !!(user?.autodeskAccessToken && user?.autodeskRefreshToken);
}
