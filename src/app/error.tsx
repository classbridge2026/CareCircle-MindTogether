"use client";

import { RECORDS_OFFLINE_MESSAGE } from "@/lib/db/offline";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-[#0C2B45]">This page could not be loaded</h1>
      <p role="alert" className="text-base leading-7 text-[#3a4a60]">
        {RECORDS_OFFLINE_MESSAGE}
      </p>
      <button
        type="button"
        className="inline-flex w-fit items-center rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  );
}
