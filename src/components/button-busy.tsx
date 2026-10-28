"use client";

import { useEffect } from "react";
import { installButtonBusy, notifyButtonBusyNavigation } from "@/lib/ui/button-busy";

export function ButtonBusy() {
  useEffect(() => {
    const uninstall = installButtonBusy();
    let last = `${window.location.pathname}${window.location.search}`;
    const timer = window.setInterval(() => {
      const next = `${window.location.pathname}${window.location.search}`;
      if (next === last) return;
      last = next;
      notifyButtonBusyNavigation();
    }, 100);
    return () => {
      window.clearInterval(timer);
      uninstall();
    };
  }, []);
  return null;
}
