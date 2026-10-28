import { beforeEach, describe, expect, it } from "vitest";
import { beginDoctorCall, declineDoctorCall, endDoctorCall, notePatientLeft, readCallNotice, readDoctorCall, recallDoctorCall, refreshDoctorCall, resetDoctorCallsForTests } from "./calling";

const APPOINTMENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("consultation call signals", () => {
  beforeEach(() => {
    resetDoctorCallsForTests();
  });

  it("stops the ring after a decline until the doctor calls again", () => {
    const callId = beginDoctorCall(APPOINTMENT, 1_000);
    expect(declineDoctorCall(APPOINTMENT, callId, 2_000)).toBe(true);
    expect(declineDoctorCall(APPOINTMENT, callId, 2_100)).toBe(false);
    expect(readDoctorCall(APPOINTMENT, 2_000)).toBeNull();
    expect(refreshDoctorCall(APPOINTMENT, 50_000)).toBeNull();
    expect(readCallNotice(APPOINTMENT)?.kind).toBe("declined");
    const next = recallDoctorCall(APPOINTMENT, 60_000);
    expect(next).not.toBe(callId);
    expect(readDoctorCall(APPOINTMENT, 60_000)).toBe(next);
    expect(readCallNotice(APPOINTMENT)).toBeNull();
  });

  it("tells the doctor the patient left and does not start a new ring on its own", () => {
    beginDoctorCall(APPOINTMENT, 1_000);
    notePatientLeft(APPOINTMENT, 2_000);
    expect(readCallNotice(APPOINTMENT)?.kind).toBe("left");
    expect(refreshDoctorCall(APPOINTMENT, 50_000)).toBeNull();
  });

  it("keeps an ended call ended when the patient is removed from the room", () => {
    beginDoctorCall(APPOINTMENT, 1_000);
    endDoctorCall(APPOINTMENT, 2_000);
    notePatientLeft(APPOINTMENT, 3_000);
    expect(readCallNotice(APPOINTMENT)?.kind).toBe("ended");
    expect(refreshDoctorCall(APPOINTMENT, 50_000)).toBeNull();
    const next = beginDoctorCall(APPOINTMENT, 60_000);
    expect(readDoctorCall(APPOINTMENT, 60_000)).toBe(next);
    expect(readCallNotice(APPOINTMENT)).toBeNull();
  });
});
