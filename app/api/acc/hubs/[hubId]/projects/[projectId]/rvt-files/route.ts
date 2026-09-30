import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

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

    // Search for RVT files using Autodesk Search API
    const response = await axios.get(
      `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          'filter[extension.type]': 'items:autodesk.bim360:File',
          'filter[displayName]': '-rvt'
        }
      }
    );

    const rvtFiles = response.data.data
      .filter((item: any) => {
        const fileName = item.attributes.displayName || item.attributes.name || '';
        return fileName.toLowerCase().endsWith('.rvt');
      })
      .map((item: any) => ({
        id: item.id,
        name: item.attributes.displayName || item.attributes.name,
        type: item.type,
        size: item.attributes.storageSize || 0,
        isRevitFile: true,
        lastModifiedTime: item.attributes.lastModifiedTime,
        lineageId: item.id,
        tipVersionId: item.relationships?.tip?.data?.id
      }));

    return NextResponse.json({
      success: true,
      data: rvtFiles,
      count: rvtFiles.length
    });
  } catch (error: any) {
    console.error('Search RVT files error:', error.response?.data || error.message);
    
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
        error: 'Failed to search RVT files',
        details: error.response?.data?.detail || error.message
      },
      { status: 500 }
    );
  }
}
