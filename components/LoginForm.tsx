'use client';

import { FormEvent, useState } from 'react';

const demoUsers = [
  { username: 'meva', password: '54321', label: 'MEVA operations' },
  { username: 'alpine', password: '12345', label: 'Alpine client team' },
  { username: 'guest', password: '23456', label: 'Read-only guest' },
];

export default function LoginForm() {
  const [username, setUsername] = useState('meva');
  const [password, setPassword] = useState('54321');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || 'Login failed');
      setIsSubmitting(false);
      return;
    }

    window.location.reload();
  }

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Controlled Access
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          Enterprise Production Tracker
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
          Login gives each team the right view. MEVA can update vehicles, Alpine can raise
          issues, and guest users can only view the tracker.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {demoUsers.map((user) => (
            <button
              key={user.username}
              type="button"
              className="rounded-lg border border-slate-200 bg-white p-3 text-left text-sm hover:border-slate-400"
              onClick={() => {
                setUsername(user.username);
                setPassword(user.password);
              }}
            >
              <div className="font-semibold text-slate-950">{user.username}</div>
              <div className="mt-1 text-xs text-slate-500">{user.label}</div>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Sign in</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Username
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-600"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-600"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
        </div>
        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          className="mt-5 min-h-11 w-full rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
