import { NextResponse } from 'next/server';

export async function POST(request) {
  const response = NextResponse.json({ success: true });

  response.cookies.delete('auth-user');

  return response;
}
