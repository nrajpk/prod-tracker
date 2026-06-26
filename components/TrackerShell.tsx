import Image from 'next/image';
import DashboardGrid from '@/components/DashboardGrid';
import LoginForm from '@/components/LoginForm';
import UserMenu from '@/components/UserMenu';
import { getCurrentSession } from '@/lib/auth';

export default async function TrackerShell() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 md:px-8 lg:px-10">
        <div className="mx-auto max-w-[1600px]">
          <Image
            src="/mevalogo.png"
            alt="MEVA"
            width={180}
            height={72}
            priority
            className="h-16 w-auto object-contain"
          />
          <LoginForm />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-300 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Image
              src="/mevalogo.png"
              alt="MEVA"
              width={180}
              height={72}
              priority
              className="mb-4 h-16 w-auto object-contain"
            />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Alpine Vehicle Program
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Vehicle Production Tracker
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Track every vehicle from planned shipment to MEVA, production, final shipment, and receipt.
            </p>
          </div>
          <UserMenu session={session} />
        </header>

        <section>
          <DashboardGrid session={session} />
        </section>
      </div>
    </main>
  );
}
