import { describe, expect, it } from "vitest";
import { answerPortalQuestion, chatWithPortal, topicForPath } from "./portal-guide";

const admin = { pathname: "/admin/notifications", superAdmin: true };

describe("portal guide", () => {
  it("knows the current sidebar tab", () => {
    expect(topicForPath("/admin/doctors/pending").title).toBe("Doctor verification");
    expect(topicForPath("/admin/doctors").title).toBe("Doctors");
    expect(topicForPath("/admin").title).toBe("Dashboard");
    const here = answerPortalQuestion({ ...admin, pathname: "/admin/locations", question: "What can I do here?" });
    expect(here.title).toBe("Locations");
    expect(here.steps.join(" ")).toMatch(/map/i);
  });

  it("explains a task and remembers the tab in a follow-up", () => {
    const first = answerPortalQuestion({ ...admin, pathname: "/admin", question: "How do I verify a clinic address?" });
    expect(first.topicId).toBe("locations");
    expect(first.steps.join(" ")).toMatch(/Verify address/);
    const next = answerPortalQuestion({
      ...admin,
      question: "Why is save disabled?",
      previousTopicId: first.topicId,
    });
    expect(next.topicId).toBe("locations");
    expect(next.steps.join(" ")).toMatch(/pin/i);
  });

  it("compares services with doctor offerings", () => {
    const reply = answerPortalQuestion({ ...admin, question: "What is the difference between services and offerings?" });
    expect(reply.links.map((link) => link.label).sort()).toEqual(["Consultation services", "Doctor offerings"]);
  });

  it("keeps the inbox and the delivery log on the notifications tab", () => {
    const reply = answerPortalQuestion({ ...admin, question: "What is the difference between the inbox and the delivery log?" });
    expect(reply.topicId).toBe("notifications");
    expect(reply.paragraphs.join(" ")).toMatch(/delivery log/i);
    expect(reply.links.map((link) => link.label)).toEqual(["Notifications"]);
  });

  it("keeps role and screening limits accurate", () => {
    const grant = answerPortalQuestion({ ...admin, superAdmin: false, question: "Who can grant an administrator?" });
    expect(grant.paragraphs.join(" ")).toMatch(/super administrator/i);
    const screen = answerPortalQuestion({ ...admin, superAdmin: false, question: "How do I activate a questionnaire?" });
    expect(screen.topicId).toBe("screening");
    expect(screen.paragraphs.join(" ")).toMatch(/super administrator/i);
    expect(screen.steps.join(" ")).toMatch(/clinical approval/i);
  });

  it("gives the sidebar and a setup path, and refuses questions outside the portal", () => {
    const menu = answerPortalQuestion({ ...admin, question: "What is in the sidebar?" });
    expect(menu.steps.join(" ")).toMatch(/Screening management/);
    expect(menu.steps.join(" ")).toMatch(/Payment reconciliation/);
    const start = answerPortalQuestion({ ...admin, question: "Where should I start?" });
    expect(start.steps[0]).toMatch(/Platform settings/);
    const added = chatWithPortal({ ...admin, question: "how an i add doctor?" });
    expect(added.text).toMatch(/Create doctor and send invitation/);
    expect(added.text).toMatch(/single-use invitation/);
    expect(added.link?.href).toBe("/admin/doctors");
    const counted = chatWithPortal({ ...admin, question: "how may patient is my the potal" });
    expect(counted.text).toMatch(/Total Patients/);
    expect(counted.text).not.toMatch(/^\d+\./m);
    const facts = {
      doctors: 1,
      approvedDoctors: 1,
      pendingDoctors: 0,
      patients: 2,
      patientsThisWeek: 0,
      todayAppointments: 3,
      todayConfirmed: 1,
      todayPending: 1,
      activeServices: 5,
      locations: 1,
    };
    const live = chatWithPortal({ ...admin, question: "how may patient is my the potal", facts });
    expect(live.text).toMatch(/2 patients/);
    expect(live.text).toMatch(/None joined this week/);
    const next = chatWithPortal({ ...admin, question: "yes what next", previousTopicId: added.topicId });
    expect(next.text).toMatch(/Doctor verification/);
    const waiting = chatWithPortal({ ...admin, question: "what should I do now", facts: { ...facts, pendingDoctors: 2 } });
    expect(waiting.text).toMatch(/2 doctors/);
    expect(waiting.link?.href).toBe("/admin/doctors/pending");
    const hello = chatWithPortal({ ...admin, question: "hello" });
    expect(hello.text).toMatch(/^Hello/);
    const outside = answerPortalQuestion({ ...admin, question: "What is the weather in Freetown?" });
    expect(outside.title).toMatch(/portal/i);
    expect(outside.paragraphs.join(" ")).toMatch(/cannot/i);
  });
});
