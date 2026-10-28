"use client";

import { RECORDS_OFFLINE_MESSAGE } from "@/lib/db/offline";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f3f8fc", color: "#0c2b45", fontFamily: "Arial, sans-serif" }}>
        <main style={{ maxWidth: "32rem", margin: "0 auto", padding: "4rem 1.5rem" }}>
          <h1 style={{ fontSize: "1.75rem" }}>This page could not be loaded</h1>
          <p role="alert" style={{ lineHeight: 1.6 }}>
            {RECORDS_OFFLINE_MESSAGE}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#0f766e", color: "#fff", border: 0, borderRadius: "0.75rem", padding: "0.7rem 1rem", fontWeight: 700 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
