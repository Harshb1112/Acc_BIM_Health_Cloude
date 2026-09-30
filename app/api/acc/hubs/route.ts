import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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

    // Fetch hubs from Autodesk
    const response = await axios.get('https://developer.api.autodesk.com/project/v1/hubs', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const hubs = response.data.data.map((hub: any) => ({
      id: hub.id,
      name: hub.attributes.name,
      type: hub.type,
      region: hub.attributes.region || 'US'
    }));

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
