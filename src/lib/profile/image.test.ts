import { describe, expect, it } from "vitest";
import { inspectProfileImage, openProfileImage } from "./image";

describe("inspectProfileImage", () => {
  it("accepts a jpeg saved with the image/jpg type some phones send", () => {
    const result = inspectProfileImage({
      filename: "me.jpg",
      declaredMime: "image/jpg",
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a jpeg whose type and contents match", () => {
    const result = inspectProfileImage({
      filename: "me.jpg",
      declaredMime: "image/jpeg",
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a file whose extension does not match its contents", () => {
    const result = inspectProfileImage({
      filename: "me.png",
      declaredMime: "image/png",
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
    });
    expect(result).toEqual({ ok: false, message: "Upload a JPEG, PNG, or WebP photo. The file type and contents must match." });
  });

  it("does not open another patient's photo to a patient, a stranger, or a signed-out visitor", async () => {
    const patientA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const patientB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const doctor = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const db = {
      user: {
        findUnique: async () => ({
          id: patientA,
          status: "ACTIVE",
          deletedAt: null,
          profileImageBytes: Buffer.from([1, 2, 3]),
          profileImageType: "image/jpeg",
          patientProfile: { id: "profile-a" },
          doctorProfile: null,
        }),
      },
      appointment: { findFirst: async () => null },
    };
    expect(await openProfileImage(patientA, null, { db: db as never })).toEqual({ ok: false, status: 404 });
    expect(await openProfileImage(patientA, { id: patientB, roleCodes: ["PATIENT"] }, { db: db as never })).toEqual({ ok: false, status: 404 });
    expect(await openProfileImage(patientA, { id: doctor, roleCodes: ["DOCTOR"] }, { db: db as never })).toEqual({ ok: false, status: 404 });
    expect((await openProfileImage(patientA, { id: patientA, roleCodes: ["PATIENT"] }, { db: db as never })).ok).toBe(true);
    expect((await openProfileImage(patientA, { id: doctor, roleCodes: ["ADMIN"] }, { db: db as never })).ok).toBe(true);
  });

  it("rejects an empty selection", () => {
    expect(inspectProfileImage({ filename: "me.jpg", declaredMime: "image/jpeg", bytes: new Uint8Array() })).toEqual({
      ok: false,
      message: "Choose a photo to upload.",
    });
  });
});
