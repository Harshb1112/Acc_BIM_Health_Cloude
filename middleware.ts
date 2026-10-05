import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // For Autodesk OAuth flow, ensure token is in cookies
  if (request.nextUrl.pathname.startsWith('/api/auth/autodesk/connect')) {
    // Get token from localStorage (sent via client)
    const authHeader = request.headers.get('authorization');
    
    // If no auth header but there's a token in query, redirect with error
    if (!authHeader && !request.cookies.get('accessToken')) {
      const url = request.nextUrl.clone();
      url.pathname = '/settings';
      url.search = '?error=not_authenticated';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/auth/autodesk/:path*',
  ],
};
