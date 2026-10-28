"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markViewedNotificationsAction } from "./actions";

const attempted = new Set<string>();

/** Marks the notices on screen as read, then refreshes the bell count. */
export function MarkViewedNotifications({ ids }: { ids: string[] }) {
  const router = useRouter();
  const key = ids.join("\n");

  useEffect(() => {
    if (!key || attempted.has(key)) return;
    attempted.add(key);
    void markViewedNotificationsAction(ids).then((result) => {
      if (result.ok) router.refresh();
    });
  }, [ids, key, router]);

  return null;
}
