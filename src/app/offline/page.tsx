import type { Metadata } from "next";
import Link from "next/link";
import { RECORDS_OFFLINE_MESSAGE } from "@/lib/db/offline";

export const metadata: Metadata = { title: "Records unavailable" };
export const dynamic = "force-dynamic";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-semibold tracking-wide text-[#0F766E] uppercase">Care records</p>
      <h1 className="text-3xl font-semibold tracking-tight text-[#0C2B45]">We can&apos;t load records right now</h1>
      <p role="alert" className="text-base leading-7 text-[#3a4a60]">
        {RECORDS_OFFLINE_MESSAGE}
      </p>
      <Link
        href="/"
        className="inline-flex w-fit items-center rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Try again
      </Link>
    </main>
  );
}
