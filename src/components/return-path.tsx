"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { safeReturnPath } from "@/lib/db/return-path";

const LAST_PATH_KEY = "carecircle:last-path";

export function RememberPath() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (!pathname || pathname === "/offline") return;
    const query = search.toString();
    sessionStorage.setItem(LAST_PATH_KEY, query ? `${pathname}?${query}` : pathname);
  }, [pathname, search]);
  return null;
}

export function TryAgain({ href }: { href: string | null }) {
  function retry() {
    const stored = safeReturnPath(sessionStorage.getItem(LAST_PATH_KEY));
    const target = href || stored;
    if (target) {
      window.location.assign(target);
      return;
    }
    window.history.back();
  }

  if (href) {
    return (
      <a href={href} className="inline-flex w-fit items-center rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white no-underline">
        Try again
      </a>
    );
  }

  return (
    <button type="button" className="inline-flex w-fit items-center rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white" onClick={retry}>
      Try again
    </button>
  );
}
