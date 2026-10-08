import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDevelopment = process.env.NODE_ENV === 'development';
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${isDevelopment ? "'unsafe-eval' " : ''}https://checkout.razorpay.com https://www.paypal.com https://www.paypalobjects.com https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    'img-src \'self\' data: blob: https:',
    "font-src 'self' data:",
    "connect-src 'self' https://api.razorpay.com https://*.paypal.com https://api.stripe.com",
    'frame-src https://*.paypal.com https://*.razorpay.com https://js.stripe.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://developer.api.autodesk.com https://*.paypal.com https://api.razorpay.com",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);

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

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
