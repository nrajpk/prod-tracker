'use client';

import type { AppSession } from '@/lib/types';

export default function UserMenu({ session }: { session: AppSession }) {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm">
        <div className="font-semibold text-slate-950">{session.displayName}</div>
        <div className="text-xs text-slate-500">{session.role} access</div>
      </div>
      <button
        className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-500"
        onClick={logout}
      >
        Logout
      </button>
    </div>
  );
}
