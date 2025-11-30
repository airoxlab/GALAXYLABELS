import { NextResponse } from 'next/server';

export async function POST(request) {
  const response = NextResponse.json({ success: true });

  // Delete both auth cookies
  response.cookies.delete('auth-user');
  response.cookies.delete('auth-type');

  return response;
}
