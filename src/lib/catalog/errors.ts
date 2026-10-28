import { isSchemaMismatch, isUniqueConflict } from "@/lib/doctors/errors";

export function catalogFailure(error: unknown, duplicateMessage: string): string {
  if (isSchemaMismatch(error)) {
    return "These records are not available until the latest database migration has been applied.";
  }
  if (isUniqueConflict(error)) {
    return duplicateMessage;
  }
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
  if (code === "P2003" || code === "P2014") {
    return "That change is linked to existing records, so it was not applied.";
  }
  if (code === "P2025") {
    return "That record was not found.";
  }
  return "The change could not be saved.";
}

export type CatalogResult = { ok: true; message: string } | { ok: false; message: string };
