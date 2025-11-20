import { NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    console.log('/api/auth/me called, token exists:', !!token);

    if (!token) {
      console.log('No token found in cookies');
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('Token found, verifying...');
    const user = await getUserFromToken(token);
    console.log('User verification result:', user ? 'valid' : 'invalid');

    if (!user) {
      console.log('Invalid token or user not found');
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    console.log('User authenticated successfully:', user.username);
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
