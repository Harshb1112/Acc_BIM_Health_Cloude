import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(
  request: NextRequest,
  { params }: { params: { hubId: string; projectId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { hubId, projectId } = params;

    // Fetch top folders from Autodesk
    const response = await axios.get(
      `https://developer.api.autodesk.com/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const folders = response.data.data.map((folder: any) => ({
      id: folder.id,
      name: folder.attributes.displayName || folder.attributes.name,
      type: folder.type,
      hidden: folder.attributes.hidden || false
    }));

    return NextResponse.json({
      success: true,
      data: folders,
      count: folders.length
    });
  } catch (error: any) {
    console.error('Fetch folders error:', error.response?.data || error.message);
    
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
        error: 'Failed to fetch folders',
        details: error.response?.data?.detail || error.message
      },
      { status: 500 }
    );
  }
}
