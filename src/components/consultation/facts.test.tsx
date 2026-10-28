/** @vitest-environment happy-dom */
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsultationFacts } from "./facts";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const shared = {
  counterpart: "Dr. Kamara",
  counterpartLabel: "Doctor",
  service: "Review",
  specialty: "Psychiatry",
  when: "19 Oct 2026, 10:00",
  preparation: "Use a quiet room.",
};

afterEach(() => cleanup());

describe("consultation facts", () => {
  it("shows a join link only for an eligible online appointment", () => {
    render(
      <ConsultationFacts
        {...shared}
        canJoin
        joinHref="/patient/appointments/1/consultation"
        message="You can join this online consultation."
        mode="ONLINE"
        place={null}
      />,
    );
    expect(screen.getByRole("link", { name: "Join consultation" }).getAttribute("href")).toBe("/patient/appointments/1/consultation");
    expect(screen.getByText(/not a public meeting link/i)).toBeTruthy();
  });

  it("shows the clinic and no online controls for an in-person appointment", () => {
    const clinic = render(
      <ConsultationFacts
        {...shared}
        canJoin={false}
        joinHref={null}
        message="Attend this visit at the clinic."
        mode="IN_PERSON"
        place={{ name: "Congo Cross Clinic", address: "12 Wilkinson Road, Freetown", phone: "+23200000000", instructions: "Use the side entrance." }}
      />,
    );
    expect(clinic.container.querySelector("a")).toBeNull();
    expect(clinic.getByText("Congo Cross Clinic")).toBeTruthy();
    expect(clinic.getByText(/side entrance/i)).toBeTruthy();
    expect(clinic.queryByText(/camera/i)).toBeNull();
    clinic.unmount();

    const missing = render(
      <ConsultationFacts
        {...shared}
        canJoin={false}
        joinHref="/patient/appointments/1/consultation"
        message="Attend this visit at the clinic."
        mode="IN_PERSON"
        place={null}
      />,
    );
    expect(missing.getByText("Location details have not been provided yet.")).toBeTruthy();
    expect(missing.container.querySelector("a")).toBeNull();
  });

  it("explains a denied camera or microphone without claiming a connection", async () => {
    const { mediaAccessMessage, connectionFailureMessage, liveKitUnavailableMessage } = await import("@/lib/consultations/messages");
    expect(mediaAccessMessage("denied")).toMatch(/address bar/i);
    expect(connectionFailureMessage()).toMatch(/not completed/i);
    expect(liveKitUnavailableMessage()).toMatch(/not changed/i);
  });
});
