"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { installButtonBusy, notifyButtonBusyNavigation } from "@/lib/ui/button-busy";

function RouteWatch() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const skipRoute = useRef(true);

  useEffect(() => {
    if (skipRoute.current) {
      skipRoute.current = false;
      return;
    }
    notifyButtonBusyNavigation();
  }, [pathname, search]);

  return null;
}

export function ButtonBusy() {
  const [watchRoutes, setWatchRoutes] = useState(false);

  useEffect(() => installButtonBusy(), []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWatchRoutes(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return watchRoutes ? <RouteWatch /> : null;
}
