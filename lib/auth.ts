import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import type { AppSession, RolePermissions, UserRole } from '@/lib/types';

export const AUTH_COOKIE_NAME = 'meva_session';

const SESSION_TTL_SECONDS = 60 * 60 * 8;
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-only-hardcoded-meva-tracker-secret';

const users: Record<string, AppSession & { password: string }> = {
  alpine: {
    username: 'alpine',
    password: '12345',
    role: 'ALPINE',
    organization: 'Alpine',
    displayName: 'Alpine Team',
  },
  meva: {
    username: 'meva',
    password: '54321',
    role: 'MEVA',
    organization: 'MEVA',
    displayName: 'MEVA Team',
  },
  guest: {
    username: 'guest',
    password: '23456',
    role: 'GUEST',
    organization: 'Guest',
    displayName: 'Guest Viewer',
  },
};

export function authenticate(username: string, password: string) {
  const user = users[username.trim().toLowerCase()];

  if (!user || user.password !== password) {
    return null;
  }

  return {
    username: user.username,
    role: user.role,
    organization: user.organization,
    displayName: user.displayName,
  };
}

export function createSessionToken(session: AppSession) {
  const payload = encode({
    ...session,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token?: string) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split('.');

  if (!payload || !signature || !verify(payload, signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AppSession & {
      exp?: number;
    };

    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      username: parsed.username,
      role: parsed.role,
      organization: parsed.organization,
      displayName: parsed.displayName,
    } satisfies AppSession;
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return parseSessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export function getPermissions(role: UserRole): RolePermissions {
  return {
    canEditProduction: role !== 'GUEST',
    canViewInternalNotes: role === 'MEVA',
    canOpenDisputes: role === 'ALPINE',
    canRespondToDisputes: role === 'MEVA',
    canResolveDisputes: role === 'MEVA',
    canViewDisputes: role !== 'GUEST',
  };
}

export function requireSession(session: AppSession | null) {
  if (!session) {
    throw new AuthError('Unauthorized', 401);
  }

  return session;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(payload: string) {
  return createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
}

function verify(payload: string, signature: string) {
  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
