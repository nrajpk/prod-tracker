import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, authenticate, createSessionToken, getPermissions } from '@/lib/auth';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;

  const session = authenticate(body?.username || '', body?.password || '');

  if (!session) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }

  const response = NextResponse.json({
    session,
    permissions: getPermissions(session.role),
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: createSessionToken(session),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return response;
}
