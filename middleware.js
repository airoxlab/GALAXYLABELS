import { NextResponse } from 'next/server';

export function middleware(request) {
  const userId = request.cookies.get('auth-user')?.value;
  const userType = request.cookies.get('auth-type')?.value;
  const { pathname } = request.nextUrl;

  console.log('Middleware:', { pathname, hasUserId: !!userId, hasUserType: !!userType });

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/api/auth/login', '/api/auth/logout'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // If accessing a public path, allow access
  if (isPublicPath) {
    console.log('Middleware: Public path, allowing access');
    // If logged in and trying to access login, redirect to dashboard
    if (userId && userType && pathname === '/login') {
      console.log('Middleware: User logged in, redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // For protected paths, check if BOTH userId and userType exist
  if (!userId || !userType) {
    console.log('Middleware: Missing auth cookies, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  console.log('Middleware: Auth cookies valid, allowing access to', pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
