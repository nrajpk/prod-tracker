import Image from 'next/image';
import Link from 'next/link';

const clients = [
  {
    name: 'Alpine Armouring',
    description: 'Vehicle production tracker is ready.',
    href: '/clients/alpine-armouring',
    active: true,
  },
  {
    name: 'SUN Sprout',
    description: 'Not active yet.',
    active: false,
  },
  {
    name: 'UNOPS',
    description: 'Not active yet.',
    active: false,
  },
];

export default function ClientHome() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 md:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-slate-300 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Image
              src="/mevalogo.png"
              alt="MEVA"
              width={180}
              height={72}
              priority
              className="mb-5 h-16 w-auto object-contain"
            />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Client List
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Select a client
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Choose a client to open their tracker.
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {clients.map((client) =>
            client.active && client.href ? (
              <Link
                key={client.name}
                href={client.href}
                className="group rounded-lg border border-slate-300 bg-white p-5 shadow-sm transition hover:border-slate-500 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{client.name}</h2>
                    <p className="mt-2 text-sm text-slate-600">{client.description}</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="mt-8 text-sm font-semibold text-slate-700 group-hover:text-slate-950">
                  Open tracker
                </div>
              </Link>
            ) : (
              <div
                key={client.name}
                className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-slate-400"
                aria-disabled="true"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{client.name}</h2>
                    <p className="mt-2 text-sm">{client.description}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold">
                    Coming soon
                  </span>
                </div>
                <div className="mt-8 text-sm font-semibold">Not available</div>
              </div>
            ),
          )}
        </section>
      </div>
    </main>
  );
}
