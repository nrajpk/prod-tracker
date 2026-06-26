import { NextResponse } from 'next/server';
import { getCurrentSession, getPermissions } from '@/lib/auth';

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ session: null, permissions: null }, { status: 401 });
  }

  return NextResponse.json({
    session,
    permissions: getPermissions(session.role),
  });
}
