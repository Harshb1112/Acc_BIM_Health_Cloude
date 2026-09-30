import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(
  request: NextRequest,
  { params }: { params: { hubId: string } }
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
    const { hubId } = params;

    // Fetch projects from Autodesk
    const response = await axios.get(
      `https://developer.api.autodesk.com/project/v1/hubs/${hubId}/projects`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const projects = response.data.data.map((project: any) => ({
      id: project.id,
      name: project.attributes.name,
      type: project.type,
      status: project.attributes.extension?.data?.projectStatus || 'active'
    }));

    return NextResponse.json({
      success: true,
      data: projects,
      count: projects.length
    });
  } catch (error: any) {
    console.error('Fetch projects error:', error.response?.data || error.message);
    
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
        error: 'Failed to fetch projects',
        details: error.response?.data?.detail || error.message
      },
      { status: 500 }
    );
  }
}
