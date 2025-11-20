import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

// Force Node.js runtime instead of Edge runtime
export const runtime = 'nodejs';

export function middleware(request) {
  const token = request.cookies.get('auth-token')?.value;
  const { pathname } = request.nextUrl;

  console.log('Middleware:', { pathname, hasToken: !!token });

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // If accessing a public path, allow access
  if (isPublicPath) {
    console.log('Middleware: Public path, allowing access');
    // If logged in and trying to access login, redirect to dashboard
    if (token && pathname === '/login') {
      console.log('Middleware: User logged in, redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // For protected paths, verify token
  if (!token) {
    console.log('Middleware: No token, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const user = verifyToken(token);
  console.log('Middleware: Token verification result:', user ? 'valid' : 'invalid');

  if (!user) {
    console.log('Middleware: Invalid token, deleting cookie and redirecting to login');
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth-token');
    return response;
  }

  console.log('Middleware: Token valid, allowing access to', pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
