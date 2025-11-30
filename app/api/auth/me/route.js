import { NextResponse } from 'next/server';
import { getUserById } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('auth-user')?.value;
    const userType = cookieStore.get('auth-type')?.value;

    console.log('/api/auth/me called - userId:', userId, 'userType:', userType);

    if (!userId || !userType) {
      console.log('No userId or userType found in cookies');
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('Fetching user with type:', userType);
    const user = await getUserById(userId, userType);
    console.log('User fetch result:', user ? 'valid' : 'invalid');

    if (!user) {
      console.log('User not found');
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    console.log('User authenticated successfully:', user.username, 'type:', user.userType);
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred' },
      { status: 500 }
    );
  }
}
