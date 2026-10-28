import { cache } from "react";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const SYSTEM_NAME_SETTING_KEY = "SYSTEM_NAME";
export const DEFAULT_SYSTEM_NAME = "CareCircle MindTogether";
export const SYSTEM_NAME_MAX_LENGTH = 80;

const SYSTEM_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}&'.,\- ]*$/u;

export function parseSystemName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > SYSTEM_NAME_MAX_LENGTH) return null;
  if (!SYSTEM_NAME_PATTERN.test(name)) return null;
  return name;
}

export function readStoredSystemName(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_SYSTEM_NAME;
  return parseSystemName(value) ?? DEFAULT_SYSTEM_NAME;
}

export async function loadSystemName(db: Pick<PrismaClient, "platformSetting">): Promise<string> {
  try {
    const row = await db.platformSetting.findUnique({
      where: { key: SYSTEM_NAME_SETTING_KEY },
      select: { valueJson: true },
    });
    return readStoredSystemName(row?.valueJson);
  } catch {
    return DEFAULT_SYSTEM_NAME;
  }
}

/** Current name for pages and titles. Reads the database on each request. */
export const getSystemName = cache(async () => loadSystemName(prisma));
