"use client";

import { secondaryButtonClass } from "@/components/form-classes";
import { RECORDS_OFFLINE_MESSAGE } from "@/lib/db/offline";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white px-4 py-4">
      <p role="alert" className="text-sm leading-6 text-brand-ink">
        {RECORDS_OFFLINE_MESSAGE}
      </p>
      <button className={`${secondaryButtonClass} mt-4`} type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
