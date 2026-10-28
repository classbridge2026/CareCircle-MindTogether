export const DEFAULT_TOKEN_TTL_SECONDS = 600;
export const DEFAULT_JOIN_WINDOW_MINUTES = 15;
export const REJOIN_GRACE_MINUTES = 30;

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 900;
const MIN_JOIN_WINDOW_MINUTES = 5;
const MAX_JOIN_WINDOW_MINUTES = 120;

export type LiveKitConfig = {
  websocketUrl: string;
  httpHost: string;
  apiKey: string;
  apiSecret: string;
  tokenTtlSeconds: number;
  joinWindowMinutes: number;
  rejoinGraceMinutes: number;
};

export type LiveKitConfigResult =
  | { ok: true; config: LiveKitConfig }
  | { ok: false; code: "NOT_CONFIGURED" | "INVALID" };

export function liveKitHttpHost(websocketUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(websocketUrl);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol === "wss:") url.protocol = "https:";
  else if (url.protocol === "ws:") url.protocol = "http:";
  else return null;
  return url.origin;
}

function parseBounded(raw: string | undefined, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  if (value < min || value > max) return null;
  return value;
}

export function readLiveKitConfig(env: NodeJS.ProcessEnv = process.env): LiveKitConfigResult {
  const websocketUrl = env.LIVEKIT_URL?.trim() ?? "";
  const apiKey = env.LIVEKIT_API_KEY?.trim() ?? "";
  const apiSecret = env.LIVEKIT_API_SECRET?.trim() ?? "";
  if (!websocketUrl || !apiKey || !apiSecret) return { ok: false, code: "NOT_CONFIGURED" };
  const httpHost = liveKitHttpHost(websocketUrl);
  if (!httpHost) return { ok: false, code: "INVALID" };
  if (env.NODE_ENV === "production" && urlProtocol(websocketUrl) !== "wss:") return { ok: false, code: "INVALID" };
  const tokenTtlSeconds = parseBounded(env.LIVEKIT_TOKEN_TTL_SECONDS, DEFAULT_TOKEN_TTL_SECONDS, MIN_TTL_SECONDS, MAX_TTL_SECONDS);
  const joinWindowMinutes = parseBounded(env.LIVEKIT_JOIN_WINDOW_MINUTES, DEFAULT_JOIN_WINDOW_MINUTES, MIN_JOIN_WINDOW_MINUTES, MAX_JOIN_WINDOW_MINUTES);
  if (tokenTtlSeconds === null || joinWindowMinutes === null) return { ok: false, code: "INVALID" };
  return {
    ok: true,
    config: {
      websocketUrl,
      httpHost,
      apiKey,
      apiSecret,
      tokenTtlSeconds,
      joinWindowMinutes,
      rejoinGraceMinutes: REJOIN_GRACE_MINUTES,
    },
  };
}

function urlProtocol(value: string): string {
  try {
    return new URL(value).protocol;
  } catch {
    return "";
  }
}
