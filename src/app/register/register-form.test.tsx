/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SYSTEM_NAME } from "@/lib/brand/system-name";
import { RegisterForm } from "./register-form";
import { RegisterLayout } from "./register-layout";

vi.mock("./actions", () => ({
  registerPatientAction: vi.fn(),
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

describe("registration form", () => {
  it("exposes labelled fields, blocks an empty submit, and toggles password visibility", async () => {
    const { container } = render(
      <RegisterLayout systemName={DEFAULT_SYSTEM_NAME}>
        <RegisterForm systemName={DEFAULT_SYSTEM_NAME} />
      </RegisterLayout>,
    );
    const user = userEvent.setup();

    const markup = container.innerHTML;
    const brandPanel = container.querySelector("[data-panel='brand']");
    expect(brandPanel?.className).toContain("hidden");
    expect(brandPanel?.className).toContain("lg:flex");
    expect(brandPanel?.className).toContain("overflow-hidden");
    expect(brandPanel?.className).not.toContain("overflow-y-auto");
    const formPanel = container.querySelector("[data-panel='form']");
    expect(formPanel?.className).toContain("overflow-y-auto");
    expect(markup).toContain("lg:hidden");
    expect(markup).toContain("lg:grid-cols-2");
    expect(markup).toContain("px-4");
    expect(markup).toContain("sm:px-8");
    expect(markup).toContain("max-w-xl");
    expect(markup).toContain("sm:grid-cols-2");
    expect(markup).toContain("Your health journey starts here.");
    expect(markup).toContain("Date of birth");
    expect(markup).not.toContain("First name");
    expect(markup).not.toContain("Middle name");
    expect(markup).not.toContain("District");
    expect(markup).not.toContain("Emergency contact");

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Privacy Notice" }).getAttribute("href")).toBe("/privacy");

    for (const label of ["Full name", "Gender", "Date of birth", "Nationality", "Phone number", "Email address", "Confirm password"]) {
      expect(screen.getByLabelText(label, { exact: false })).toBeTruthy();
    }
    expect(screen.getByRole("textbox", { name: /^Address required$/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Male" }).getAttribute("value")).toBe("MALE");
    expect(screen.getByRole("option", { name: "Female" }).getAttribute("value")).toBe("FEMALE");
    expect(screen.queryByRole("option", { name: "Another identity" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Prefer not to say" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Create your account" }).className).toContain("text-center");
    expect((screen.getByLabelText("Nationality", { exact: false }) as HTMLSelectElement).value).toBe("Sierra Leone");
    expect((screen.getByLabelText("Country calling code", { exact: false }) as HTMLSelectElement).value).toBe("SL");

    const password = document.getElementById("password");
    if (!password) {
      throw new Error("Password field was not rendered.");
    }
    expect(password.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: /^Show password$/ }));
    expect(password.getAttribute("type")).toBe("text");

    await user.type(password, "CorrectHorse12");
    expect(screen.queryByText(/Needed:/)).toBeNull();

    await user.clear(password);
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Enter a full name.")).toBeTruthy();
    const { registerPatientAction } = await import("./actions");
    expect(registerPatientAction).not.toHaveBeenCalled();
  });
});
