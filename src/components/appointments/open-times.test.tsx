/** @vitest-environment happy-dom */
import type { ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenTimes } from "./open-times";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const slots = [
  { startsAt: "2026-10-23T12:00:00.000Z", label: "12:00 GMT", availability: "passed" as const },
  { startsAt: "2026-10-23T13:00:00.000Z", label: "13:00 GMT", availability: "open" as const },
  { startsAt: "2026-10-23T14:00:00.000Z", label: "14:00 GMT", availability: "booked" as const },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("open booking times", () => {
  it("removes a time once it passes, including one the patient had selected", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T12:30:00.000Z"));
    render(
      <OpenTimes basePath="/patient/book/offering" date="2026-10-23" selectedStart="2026-10-23T13:00:00.000Z" slots={slots}>
        <p>Review booking</p>
      </OpenTimes>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(screen.queryByText("12:00 GMT")).toBeNull();
    expect(screen.getByRole("link", { name: "13:00 GMT" })).toBeTruthy();
    expect(screen.getByText("14:00 GMT · Booked")).toBeTruthy();
    expect(screen.getByText("Review booking")).toBeTruthy();

    vi.setSystemTime(new Date("2026-10-23T13:00:01.000Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByText("13:00 GMT")).toBeNull();
    expect(screen.queryByText("Review booking")).toBeNull();
    expect(screen.getByText("14:00 GMT · Booked")).toBeTruthy();
    expect(replace).toHaveBeenCalledWith("/patient/book/offering?date=2026-10-23");
  });
});
