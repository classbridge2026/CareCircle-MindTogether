"use client";

import { useEffect, useState } from "react";

export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState("Checking the hold…");

  useEffect(() => {
    const expiry = new Date(expiresAt).getTime();
    const tick = () => {
      const remaining = expiry - Date.now();
      if (remaining <= 0) {
        setLabel("This hold may have expired. Refresh the page to see the saved status.");
        return;
      }
      const minutes = Math.floor(remaining / 60_000);
      const seconds = Math.floor((remaining % 60_000) / 1000);
      setLabel(`Payment hold: ${minutes}:${String(seconds).padStart(2, "0")} remaining.`);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return <p className="text-sm font-medium text-brand-navy">{label}</p>;
}
