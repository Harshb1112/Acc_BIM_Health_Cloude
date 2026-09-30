import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; folderId: string } }
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
    const { projectId, folderId } = params;

    // Fetch folder contents from Autodesk
    const response = await axios.get(
      `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const folders: any[] = [];
    const files: any[] = [];

    response.data.data.forEach((item: any) => {
      if (item.type === 'folders') {
        folders.push({
          id: item.id,
          name: item.attributes.displayName || item.attributes.name,
          type: item.type,
          hidden: item.attributes.hidden || false
        });
      } else if (item.type === 'items') {
        const fileName = item.attributes.displayName || item.attributes.name || '';
        const isRevitFile = fileName.toLowerCase().endsWith('.rvt');
        
        files.push({
          id: item.id,
          name: fileName,
          type: item.type,
          size: item.attributes.storageSize || 0,
          isRevitFile,
          lastModifiedTime: item.attributes.lastModifiedTime,
          lineageId: item.id,
          tipVersionId: item.relationships?.tip?.data?.id
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        folders,
        files,
        total: folders.length + files.length
      }
    });
  } catch (error: any) {
    console.error('Fetch folder contents error:', error.response?.data || error.message);
    
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
        error: 'Failed to fetch folder contents',
        details: error.response?.data?.detail || error.message
      },
      { status: 500 }
    );
  }
}
