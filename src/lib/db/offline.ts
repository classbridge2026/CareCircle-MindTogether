export const RECORDS_OFFLINE_MESSAGE =
  "We can't load records right now. The connection to the care database is down. Wait a moment, then try again.";

export class RecordsOfflineError extends Error {
  constructor() {
    super(RECORDS_OFFLINE_MESSAGE);
    this.name = "RecordsOfflineError";
  }
}

const OFFLINE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

export function isRecordsOffline(error: unknown): boolean {
  if (error instanceof RecordsOfflineError) return true;
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  if (OFFLINE_CODES.has(code)) return true;
  const message = "message" in error ? String(error.message) : "";
  return /can't reach database server|server has closed the connection|timed out fetching a new connection|connection pool|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|Response from the Engine was empty|Engine is not yet connected/i.test(message);
}
