import { NextRequest, NextResponse } from 'next/server';
import redirects from './redirects.json';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Find matching redirect
  const redirect = redirects.find((r) => {
    const source = r.source.replace('(/?)', '');
    return pathname === source || pathname === source + '/';
  });

  if (redirect) {
    return NextResponse.redirect(new URL(redirect.destination, request.url), 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
