import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    console.log('Login attempt:', { username, password: '***' });

    if (!username || !password) {
      console.log('Missing username or password');
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const result = await loginUser(username, password);
    console.log('Login result:', { success: result.success, error: result.error });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    // Set cookies with user ID and userType
    const response = NextResponse.json({
      success: true,
      user: result.user,
    });

    console.log('Setting cookies - userId:', result.user.id, 'userType:', result.user.userType);

    // Store user ID
    response.cookies.set('auth-user', String(result.user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Store user type (superadmin or staff)
    response.cookies.set('auth-type', result.user.userType, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    console.log('Cookies set successfully');

    return response;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
