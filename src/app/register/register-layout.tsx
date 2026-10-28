import type { ReactNode } from "react";
import Link from "next/link";
import { CareCircleMark, DoctorAvatar } from "@/components/brand";

export function RegisterLayout({ children, systemName }: { children: ReactNode; systemName: string }) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-brand-paper text-brand-ink lg:grid lg:grid-cols-2">
      <aside
        data-panel="brand"
        className="relative hidden h-full min-h-0 overflow-hidden bg-brand-navy px-10 py-8 text-white lg:flex lg:flex-col xl:px-14 xl:py-10"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-brand-teal/20" />
        <div aria-hidden="true" className="pointer-events-none absolute top-24 -right-8 h-40 w-40 rounded-full border border-white/15" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-white/5" />

        <Link
          href="/"
          className="relative flex w-fit shrink-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <CareCircleMark className="h-12 w-12 xl:h-14 xl:w-14" />
          <span className="text-lg font-semibold tracking-tight">{systemName}</span>
        </Link>

        <div className="relative mt-8 max-w-md shrink-0 xl:mt-10">
          <p className="text-3xl leading-tight font-semibold tracking-tight xl:text-4xl xl:leading-[1.15]">
            Your health journey starts here.
          </p>
          <p className="mt-4 text-base leading-7 text-white/80 xl:mt-5 xl:text-lg xl:leading-8">
            Create your secure account to connect with healthcare professionals and manage your care in one place.
          </p>
        </div>

        <div className="relative mt-6 flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div className="relative aspect-square h-full max-h-[22rem] max-w-full">
            <DoctorAvatar className="h-full w-full" />
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-8 lg:px-10 lg:py-8 xl:px-16">
        <Link
          href="/"
          className="mb-4 flex w-fit shrink-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal lg:hidden"
        >
          <CareCircleMark className="h-12 w-12" />
          <span className="text-base font-semibold tracking-tight text-brand-navy">{systemName}</span>
        </Link>
        <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden rounded-2xl border border-brand-line bg-white shadow-[0_16px_50px_rgba(11,31,58,0.08)]">
          <div data-panel="form" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-5 py-7 sm:px-8 sm:py-9">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
