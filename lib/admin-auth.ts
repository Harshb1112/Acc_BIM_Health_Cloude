import { NextRequest } from 'next/server';

export function isAdmin(req: NextRequest): boolean {
  const configuredToken = process.env.ADMIN_SECRET_TOKEN;
  if (!configuredToken) return false;

  const providedToken = req.headers.get('x-admin-token') || req.nextUrl.searchParams.get('token');
  return providedToken === configuredToken;
}