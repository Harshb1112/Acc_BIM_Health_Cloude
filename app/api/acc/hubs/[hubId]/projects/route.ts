import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

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

    console.log('📊 Projects API - Total projects:', response.data.data.length);
    
    // Log first project structure to understand the data
    if (response.data.data.length > 0) {
      console.log('📋 Sample project structure:', JSON.stringify(response.data.data[0], null, 2));
    }

    const projects = response.data.data.map((project: any) => {
      // Extract region from project extension data
      const region = project.attributes.extension?.data?.region || 
                     project.attributes.extension?.data?.regionId || 
                     'UNKNOWN';
      
      console.log(`Project: ${project.attributes.name} | Region: ${region}`);
      
      return {
        id: project.id,
        name: project.attributes.name,
        type: project.type,
        status: project.attributes.extension?.data?.projectStatus || 'active',
        region: region
      };
    });

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
