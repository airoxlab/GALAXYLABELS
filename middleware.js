import { NextResponse } from 'next/server';

export function middleware(request) {
  const userId = request.cookies.get('auth-user')?.value;
  const { pathname } = request.nextUrl;

  console.log('Middleware:', { pathname, hasUserId: !!userId });

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // If accessing a public path, allow access
  if (isPublicPath) {
    console.log('Middleware: Public path, allowing access');
    // If logged in and trying to access login, redirect to dashboard
    if (userId && pathname === '/login') {
      console.log('Middleware: User logged in, redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // For protected paths, check if user ID exists
  if (!userId) {
    console.log('Middleware: No userId, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  console.log('Middleware: UserId valid, allowing access to', pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
