import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const { clientId, clientSecret } = await request.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing clientId or clientSecret' },
        { status: 400 }
      );
    }

    const tests: any = {
      authentication: { passed: false, message: '' },
      tokenGeneration: { passed: false, message: '' },
      dataManagement: { passed: false, message: '' }
    };

    // Test 1: Authentication
    try {
      const authResponse = await axios.post(
        'https://developer.api.autodesk.com/authentication/v2/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'data:read data:write data:create bucket:read bucket:create'
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      if (authResponse.data.access_token) {
        tests.authentication.passed = true;
        tests.authentication.message = 'Successfully authenticated with Autodesk';
        
        const token = authResponse.data.access_token;

        // Test 2: Token Generation
        tests.tokenGeneration.passed = true;
        tests.tokenGeneration.message = `Token generated (expires in ${authResponse.data.expires_in}s)`;

        // Test 3: Data Management API
        try {
          await axios.get('https://developer.api.autodesk.com/project/v1/hubs', {
            headers: { Authorization: `Bearer ${token}` }
          });
          tests.dataManagement.passed = true;
          tests.dataManagement.message = 'Data Management API accessible';
        } catch (dmError: any) {
          tests.dataManagement.passed = false;
          tests.dataManagement.message = 'Data Management API not accessible (requires user token)';
        }
      }
    } catch (authError: any) {
      tests.authentication.passed = false;
      tests.authentication.message = authError.response?.data?.error_description || 'Authentication failed';
    }

    const allPassed = Object.values(tests).every((test: any) => test.passed);
    const recommendation = allPassed
      ? 'All tests passed! Your Forge configuration is ready.'
      : 'Some tests failed. Check your credentials and permissions.';

    return NextResponse.json({
      success: allPassed,
      tests,
      recommendation
    });
  } catch (error: any) {
    console.error('Test forge error:', error);
    return NextResponse.json(
      { error: 'Failed to test Forge configuration', details: error.message },
      { status: 500 }
    );
  }
}
