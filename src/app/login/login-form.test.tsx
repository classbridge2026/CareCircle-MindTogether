/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SYSTEM_NAME } from "@/lib/brand/system-name";
import { LoginForm } from "./login-form";
import { LoginLayout } from "./login-layout";

vi.mock("./actions", () => ({
  login: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("login form", () => {
  it("links to the real recovery and registration pages and blocks an empty submit", async () => {
    const { container } = render(
      <LoginLayout systemName={DEFAULT_SYSTEM_NAME}>
        <LoginForm />
      </LoginLayout>,
    );
    const user = userEvent.setup();
    const markup = container.innerHTML;

    expect(markup).toContain("lg:hidden");
    expect(markup).toContain("lg:grid-cols-2");
    expect(markup).toContain("Better Health for a Brighter Tomorrow");
    expect(markup).not.toContain("/clinician-avatar.png");
    expect(markup).not.toContain("Select your role");
    const brandPanel = container.querySelector("[data-panel='brand']");
    expect(brandPanel?.className).toContain("hidden");
    expect(brandPanel?.className).toContain("lg:flex");
    expect(brandPanel?.className).toContain("overflow-hidden");
    expect(brandPanel?.className).not.toContain("overflow-y-auto");
    expect(screen.getByRole("img", { name: "Illustrated clinician" })).toBeTruthy();

    expect(screen.getByRole("heading", { name: "Login" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/");
    expect(markup).toContain("border-solid");
    expect(markup).toContain("lg:border-0");
    expect(screen.getByLabelText("Email or Phone Number")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Remember me" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.getByRole("link", { name: "Create an Account" }).getAttribute("href")).toBe("/register");
    expect(screen.getByRole("link", { name: "Contact Support" }).getAttribute("href")).toBe("/support");

    const password = document.getElementById("password");
    if (!password) throw new Error("Password field was not rendered.");
    expect(password.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.getAttribute("type")).toBe("text");

    await user.click(screen.getByRole("button", { name: "Login →" }));
    expect(await screen.findByText("Enter an email address or phone number.")).toBeTruthy();
    const { login } = await import("./actions");
    expect(login).not.toHaveBeenCalled();
  });
});
