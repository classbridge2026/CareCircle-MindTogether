import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import type { LiveKitConfig } from "./config";

export type ParticipantRole = "patient" | "doctor";

export type TokenGrantInput = {
  identity: string;
  roomName: string;
  role: ParticipantRole;
  audioOnly: boolean;
  ttlSeconds: number;
};

const CAMERA = TrackSource.CAMERA;
const MICROPHONE = TrackSource.MICROPHONE;

export function participantGrants(input: { roomName: string; audioOnly: boolean }) {
  return {
    roomJoin: true,
    room: input.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    roomAdmin: false,
    roomCreate: false,
    roomList: false,
    roomRecord: false,
    ingressAdmin: false,
    hidden: false,
    canPublishSources: input.audioOnly ? [MICROPHONE] : [CAMERA, MICROPHONE],
  };
}

export async function signRoomToken(
  config: Pick<LiveKitConfig, "apiKey" | "apiSecret">,
  input: TokenGrantInput,
): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: input.identity,
    ttl: input.ttlSeconds,
    name: input.role === "doctor" ? "Clinician" : "Patient",
    attributes: { role: input.role },
  });
  token.addGrant(participantGrants(input));
  return token.toJwt();
}

export function createRoomClient(config: Pick<LiveKitConfig, "httpHost" | "apiKey" | "apiSecret">) {
  return new RoomServiceClient(config.httpHost, config.apiKey, config.apiSecret);
}

export async function ensureConsultationRoom(config: LiveKitConfig, roomName: string): Promise<void> {
  const client = createRoomClient(config);
  await client.createRoom({
    name: roomName,
    emptyTimeout: 5 * 60,
    departureTimeout: 60,
    maxParticipants: 2,
  });
}

export async function closeConsultationRoom(config: LiveKitConfig, roomName: string): Promise<void> {
  const client = createRoomClient(config);
  await client.deleteRoom(roomName);
}

export type RoomParticipant = {
  sid: string;
  identity: string;
};

export async function listConsultationParticipants(config: LiveKitConfig, roomName: string): Promise<RoomParticipant[]> {
  const client = createRoomClient(config);
  const rows = await client.listParticipants(roomName);
  return rows.map((row) => ({ sid: row.sid, identity: row.identity }));
}

export type LiveKitOperations = {
  ensureRoom: (roomName: string) => Promise<void>;
  closeRoom: (roomName: string) => Promise<void>;
  signToken: (input: TokenGrantInput) => Promise<string>;
};

export function liveKitOperations(config: LiveKitConfig): LiveKitOperations {
  return {
    ensureRoom: (roomName) => ensureConsultationRoom(config, roomName),
    closeRoom: (roomName) => closeConsultationRoom(config, roomName),
    signToken: (input) => signRoomToken(config, input),
  };
}
