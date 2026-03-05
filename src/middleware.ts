import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files from auth check
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  // Skip login page
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Note: Full auth check requires DB access which isn't available in Edge middleware.
  // The auth check is done client-side and via API routes.
  // The middleware here handles subdomain routing.

  const hostname = request.headers.get('host') || '';

  // Check for subdomain routing
  // If hostname is like "myapp.localhost:4400", we need to proxy it
  // For Next.js middleware, we rewrite to a proxy route
  const baseDomainMatch = hostname.match(/^([a-z0-9-]+)\.(localhost|127\.0\.0\.1)(?::(\d+))?$/);
  if (baseDomainMatch) {
    const subdomain = baseDomainMatch[1];

    // devhub subdomain -> serve the UI normally
    if (subdomain === 'devhub') {
      return NextResponse.next();
    }

    // Other subdomains -> rewrite to proxy handler
    const url = request.nextUrl.clone();
    url.pathname = `/api/proxy/forward`;
    url.searchParams.set('subdomain', subdomain);
    url.searchParams.set('path', pathname);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
