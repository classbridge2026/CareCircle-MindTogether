"use client";

import { createContext, useContext } from "react";
import type { BellItem } from "@/components/notifications/bell";

export const AdminNoticesContext = createContext<{ unread: number; notices: BellItem[] } | null>(null);

export function useAdminNotices() {
  return useContext(AdminNoticesContext);
}
