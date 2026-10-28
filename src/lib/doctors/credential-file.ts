import { createHash } from "node:crypto";
import { MAX_CREDENTIAL_BYTES } from "./constants";

type AllowedFile = {
  mime: string;
  extensions: string[];
  magic: number[];
};

const ALLOWED_FILES: AllowedFile[] = [
  { mime: "application/pdf", extensions: ["pdf"], magic: [0x25, 0x50, 0x44, 0x46] },
  { mime: "image/jpeg", extensions: ["jpg", "jpeg"], magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", extensions: ["png"], magic: [0x89, 0x50, 0x4e, 0x47] },
];

export type CredentialFileCheck =
  | {
      ok: true;
      mimeType: string;
      extension: string;
      sizeBytes: number;
      checksumSha256: string;
      originalFilename: string;
    }
  | { ok: false; message: string };

export function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const parts = base.toLowerCase().split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1] ?? "";
}

function magicMatches(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) {
    return false;
  }
  return magic.every((value, index) => bytes[index] === value);
}

export function safeDownloadName(filename: string | null, extension: string): string {
  const fallback = `credential.${extension || "bin"}`;
  const base = (filename ?? fallback).split(/[/\\]/).pop() ?? fallback;
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  return cleaned || fallback;
}

export function inspectCredentialFile(input: {
  filename: string;
  declaredMime: string;
  bytes: Uint8Array;
}): CredentialFileCheck {
  if (input.bytes.byteLength === 0) {
    return { ok: false, message: "Choose a document to upload." };
  }
  if (input.bytes.byteLength > MAX_CREDENTIAL_BYTES) {
    return { ok: false, message: "Documents must be 10 MB or smaller." };
  }

  const extension = extensionOf(input.filename);
  const declared = input.declaredMime.trim().toLowerCase();
  const match = ALLOWED_FILES.find(
    (entry) => entry.extensions.includes(extension) && entry.mime === declared && magicMatches(input.bytes, entry.magic),
  );
  if (!match) {
    return {
      ok: false,
      message: "Upload a PDF, JPEG, or PNG. The file type, extension, and contents must match.",
    };
  }

  const originalFilename = (input.filename.split(/[/\\]/).pop() ?? "document").slice(0, 180);
  return {
    ok: true,
    mimeType: match.mime,
    extension,
    sizeBytes: input.bytes.byteLength,
    checksumSha256: createHash("sha256").update(input.bytes).digest("hex"),
    originalFilename,
  };
}
