import Link from "next/link";
import { CareCircleMark } from "@/components/brand";

export function AuthShell({
  children,
  systemName,
  wide = false,
}: {
  children: React.ReactNode;
  systemName: string;
  wide?: boolean;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <aside className="relative hidden overflow-hidden bg-care-deep text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full border border-white/15"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-8 -right-8 h-56 w-56 rounded-full border border-white/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-16 -left-20 h-64 w-64 rounded-full bg-white/5"
        />

        <Link
          href="/"
          className="relative w-fit rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="flex items-center gap-3">
            <CareCircleMark className="h-14 w-14" />
            <span className="text-2xl font-semibold tracking-tight">{systemName}</span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            Care, arranged in one place.
          </h2>
          <p className="mt-5 text-lg leading-8 text-white/80">
            {systemName} is being built for appointments and online consultations in Sierra Leone.
            Mental health is the first specialty.
          </p>
        </div>

        <p className="relative text-sm text-white/70">Platform operated by {systemName}.</p>
      </aside>

      <main className="flex min-h-dvh flex-col bg-care-paper px-4 py-6 sm:px-8 sm:py-10">
        <div
          className={`mx-auto flex w-full flex-1 flex-col justify-center ${wide ? "max-w-xl" : "max-w-md"}`}
        >
          <Link
            href="/"
            className="mb-8 w-fit rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-care-teal lg:hidden"
          >
            <span className="flex items-center gap-3">
              <CareCircleMark className="h-12 w-12" />
              <span className="text-lg font-semibold tracking-tight text-care-ink">{systemName}</span>
            </span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-care-line bg-care-card px-5 py-7 shadow-[0_1px_2px_rgba(20,36,33,0.04)] sm:px-8 sm:py-9">
      {children}
    </div>
  );
}
