import { NextResponse } from 'next/server';
import { getUserById } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('auth-user')?.value;

    console.log('/api/auth/me called, userId exists:', !!userId);

    if (!userId) {
      console.log('No userId found in cookies');
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('UserId found, fetching user...');
    const user = await getUserById(userId);
    console.log('User fetch result:', user ? 'valid' : 'invalid');

    if (!user) {
      console.log('User not found');
      return NextResponse.json(
        { success: false, error: 'User not found' },
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
