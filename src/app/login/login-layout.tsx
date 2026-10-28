import type { ReactNode } from "react";
import Link from "next/link";
import { CareCircleMark, DoctorAvatar } from "@/components/brand";

export function LoginLayout({ children, systemName }: { children: ReactNode; systemName: string }) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-white text-brand-ink lg:grid lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <aside
        data-panel="brand"
        className="relative hidden h-dvh min-h-0 overflow-hidden bg-brand-navy px-8 py-8 text-white lg:flex lg:flex-col xl:px-14 xl:py-10"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-brand-teal/25" />
        <div aria-hidden="true" className="pointer-events-none absolute top-28 -right-6 h-44 w-44 rounded-full border border-white/15" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-16 h-56 w-56 rounded-full bg-white/5" />

        <Link
          href="/"
          className="relative flex w-fit shrink-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <CareCircleMark className="h-12 w-12 xl:h-14 xl:w-14" />
          <span className="text-lg font-semibold tracking-tight">{systemName}</span>
        </Link>

        <div className="relative mt-8 max-w-md shrink-0 xl:mt-10">
          <p className="text-3xl leading-tight font-semibold tracking-tight xl:text-4xl xl:leading-[1.15]">
            Better Health for a Brighter Tomorrow        </p>
          <p className="mt-4 text-base leading-7 text-white/80 xl:mt-5 xl:text-lg xl:leading-8">
            Access quality healthcare, book appointments, and consult with doctors online - anytime, anywhere.          </p>
        </div>

        <div className="relative mt-6 flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute aspect-square h-[min(100%,26rem)] max-h-full rounded-full bg-brand-teal/20" />
          <div className="relative aspect-square h-full max-h-[22rem] max-w-full">
            <DoctorAvatar className="h-full w-full" />
          </div>
        </div>
      </aside>

      <main className="lg:h-dvh lg:min-h-0 lg:overflow-y-auto">
        <div className="flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-8 lg:min-h-full lg:px-10 lg:py-10 xl:px-16">
          <div className="mx-auto w-full max-w-md">
            <Link
              href="/"
              className="mb-8 flex w-fit items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal lg:hidden"
            >
              <CareCircleMark className="h-12 w-12" />
              <span className="text-base font-semibold tracking-tight text-brand-navy">{systemName}</span>
            </Link>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
