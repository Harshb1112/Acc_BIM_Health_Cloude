import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    console.log('🔍 Fetching hubs from Autodesk...');

    // Fetch hubs from Autodesk
    const response = await axios.get('https://developer.api.autodesk.com/project/v1/hubs', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('📊 Raw Autodesk response - Total hubs:', response.data.data.length);
    
    // Log first hub's full structure to understand the data
    if (response.data.data.length > 0) {
      console.log('📋 Sample hub structure:', JSON.stringify(response.data.data[0], null, 2));
    }

    const hubs = response.data.data.map((hub: any) => {
      // Extract region from hub.attributes.region or hub.id
      let region = hub.attributes.region || 'UNKNOWN';
      
      // If region is not set, try to extract from extension.data.region
      if (hub.attributes.extension?.data?.region) {
        region = hub.attributes.extension.data.region;
      }
      
      console.log(`Hub: ${hub.attributes.name} | Region from API: ${hub.attributes.region} | Using: ${region}`);
      
      return {
        id: hub.id,
        name: hub.attributes.name,
        type: hub.type,
        region: region
      };
    });

    console.log(`✅ Found ${hubs.length} hubs:`, hubs.map((h: any) => h.name).join(', '));

    return NextResponse.json({
      success: true,
      data: hubs,
      count: hubs.length
    });
  } catch (error: any) {
    console.error('Fetch hubs error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return NextResponse.json(
        { 
          error: 'Authentication failed',
          details: 'Your access token is invalid or expired. Please login again.'
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch hubs',
        details: error.response?.data?.detail || error.message
      },
      { status: 500 }
    );
  }
}
