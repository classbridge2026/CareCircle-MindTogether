"use client";

import { useEffect, useState } from "react";
import { DashIcon } from "@/components/doctor/dash-icons";

const ZONE = "Africa/Freetown";

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: ZONE,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: ZONE,
  }).format(value);
}

export function HeroClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!now) {
    return <p className="doc-clock">Loading time…</p>;
  }

  return (
    <p className="doc-clock">
      <span className="doc-clock-time">
        <DashIcon name="clock" />
        <strong>{formatTime(now)}</strong>
      </span>
      <span className="doc-clock-date">{formatDate(now)}</span>
    </p>
  );
}
