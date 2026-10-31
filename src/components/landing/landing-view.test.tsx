/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SYSTEM_NAME } from "@/lib/brand/system-name";
import type { PublicLanding } from "@/lib/public/landing";
import { LandingView } from "./landing-view";
import { SiteHeader } from "./site-header";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

const empty: PublicLanding = {
  ok: true,
  specialties: [],
  services: [],
  offerings: [],
  doctors: [],
  contact: { email: null, phone: null, address: null },
};

describe("public landing page", () => {
  it("renders the public story and empty states without invented care", () => {
    const { container } = render(<LandingView content={empty} year={2026} systemName={DEFAULT_SYSTEM_NAME} />);
    const markup = container.innerHTML;

    expect(screen.getByRole("heading", { level: 1, name: "Healthcare That Puts You First." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Consultation services" })).toBeTruthy();
    expect(markup).not.toContain("Open offerings");
    expect(markup).toContain("No consultation services are available to book yet.");
    expect(markup).toContain("No approved doctors are available to feature yet.");
    expect(markup).toContain("Public contact details have not been configured yet.");
    expect(markup).toContain("waiting room");
    expect(markup).toContain("mental health");
    expect(markup).not.toContain("does not yet include a live video room");
    expect(markup).toContain("© 2026 CareCircle MindTogether");
    expect(markup).not.toContain("24/7");
    expect(markup).not.toContain("/admin");
    expect(markup).not.toContain("tel:");
    expect(markup).not.toContain("mailto:");

    expect(screen.getAllByRole("link", { name: "Find a Doctor" }).some((link) => link.getAttribute("href") === "/patient/find")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Log In" }).every((link) => link.getAttribute("href") === "/login")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Create Patient Account" }).every((link) => link.getAttribute("href") === "/register")).toBe(true);
    expect(screen.getByRole("link", { name: "Privacy Notice" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/terms");
  });

  it("shows a real doctor and keeps private fields off the page", () => {
    render(
      <LandingView
        content={{
          ok: true,
          specialties: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Mental Health",
              description: null,
              bookable: true,
              lead: true,
            },
          ],
          services: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Initial consultation",
              description: "A first visit.",
              modes: ["IN_PERSON"],
              bookable: true,
              durationLabel: "45 min",
              fee: "SLL 450 / session",
            },
          ],
          offerings: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              doctorId: "33333333-3333-4333-8333-333333333333",
              doctorName: "Dr. Aminata Kamara",
              serviceName: "Initial consultation",
              specialtyName: "Mental Health",
              mode: "IN_PERSON",
              durationMinutes: 45,
              fee: "SLL 450 / session",
            },
          ],
          doctors: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              displayName: "Dr. Aminata Kamara",
              biography: "A published biography.",
              qualification: "MBChB",
              specialties: ["Mental Health"],
              languages: ["English"],
              consultationTypes: ["IN_PERSON", "ONLINE"],
              services: ["Initial consultation"],
              sessionFee: "SLL 450 / session",
              photo: null,
            },
          ],
          contact: { email: "care@example.com", phone: null, address: null },
        }}
        year={2026}
        systemName={DEFAULT_SYSTEM_NAME}
      />,
    );

    expect(screen.getByRole("heading", { name: "Dr. Aminata Kamara" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Book Appointment" }).getAttribute("href")).toBe(
      "/patient/doctors/33333333-3333-4333-8333-333333333333",
    );
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByText("Languages: English")).toBeTruthy();
    expect(screen.getByText("Services: Initial consultation")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Open offerings" })).toBeNull();
    expect(screen.queryByText("Mental Health")).toBeNull();
    expect(screen.queryByRole("link", { name: "Book with this doctor" })).toBeNull();
    expect(screen.getByText("45 min")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Book now" }).getAttribute("href")).toBe(
      "/patient/find?service=22222222-2222-4222-8222-222222222222",
    );
    expect(screen.getByText("Online & In-Person · SLL 450 / session")).toBeTruthy();
    expect(screen.queryByText(/reviews/i)).toBeNull();
    expect(screen.getAllByRole("link", { name: "care@example.com" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/licence/i)).toBeNull();
    expect(screen.queryByText(/license/i)).toBeNull();
  });
});

describe("landing header", () => {
  it("opens the mobile menu from the keyboard and closes it with Escape", async () => {
    render(<SiteHeader systemName={DEFAULT_SYSTEM_NAME} />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(button.getAttribute("aria-expanded")).toBe("false");

    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Find a Doctor" }).length).toBeGreaterThan(1);

    await user.keyboard("{Escape}");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
  });
});
