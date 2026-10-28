import { describe, expect, it } from "vitest";
import { TrackSource } from "livekit-server-sdk";
import { liveKitHttpHost, readLiveKitConfig } from "./config";
import { participantGrants, signRoomToken } from "./server";

describe("LiveKit configuration", () => {
  it("derives an https host from a wss url and ignores public secret names", () => {
    expect(liveKitHttpHost("wss://carecircle.livekit.cloud")).toBe("https://carecircle.livekit.cloud");
    expect(liveKitHttpHost("https://carecircle.livekit.cloud")).toBeNull();
    const missing = readLiveKitConfig({
      NEXT_PUBLIC_LIVEKIT_API_SECRET: "do-not-read",
      LIVEKIT_URL: "",
      LIVEKIT_API_KEY: "",
      LIVEKIT_API_SECRET: "",
    } as unknown as NodeJS.ProcessEnv);
    expect(missing).toEqual({ ok: false, code: "NOT_CONFIGURED" });
    const production = readLiveKitConfig({
      NODE_ENV: "production",
      LIVEKIT_URL: "ws://127.0.0.1:7880",
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
    } as unknown as NodeJS.ProcessEnv);
    expect(production).toEqual({ ok: false, code: "INVALID" });
  });

  it("signs a short-lived token for one room without recording or admin grants", async () => {
    const token = await signRoomToken(
      { apiKey: "api-key", apiSecret: "super-secret-value" },
      {
        identity: "user:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        roomName: "cc-apt-cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        role: "patient",
        audioOnly: false,
        ttlSeconds: 600,
      },
    );
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as {
      sub: string;
      name: string;
      exp: number;
      video: {
        room: string;
        roomJoin: boolean;
        roomAdmin?: boolean;
        roomCreate?: boolean;
        roomRecord?: boolean;
        canPublishSources?: string[];
      };
    };
    expect(payload.sub).toBe("user:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(payload.name).toBe("Patient");
    expect(payload.video.room).toBe("cc-apt-cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(payload.video.roomJoin).toBe(true);
    expect(payload.video.roomAdmin).not.toBe(true);
    expect(payload.video.roomCreate).not.toBe(true);
    expect(payload.video.roomRecord).not.toBe(true);
    expect(payload.video.canPublishSources).toEqual(["camera", "microphone"]);
    expect(payload.video.canPublishSources).not.toContain("screen_share");
    expect(payload.video.canPublishSources).not.toContain("screen_share_audio");
    expect(payload.exp).toBeLessThan(Math.floor(Date.now() / 1000) + 700);
    expect(token).not.toContain("super-secret-value");
    expect(participantGrants({ roomName: "cc-apt-room", audioOnly: true }).canPublishSources).toEqual([TrackSource.MICROPHONE]);
    expect(participantGrants({ roomName: "cc-apt-room", audioOnly: true }).roomRecord).toBe(false);
  });
});
