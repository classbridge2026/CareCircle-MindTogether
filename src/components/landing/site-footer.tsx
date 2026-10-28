import Link from "next/link";
import type { PublicContact } from "@/lib/public/landing";
import { BrandMark } from "./brand-mark";
import { focusRing } from "./styles";

const footerLink = `rounded-md text-sm text-white/85 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${focusRing}`;

export function SiteFooter({ year, contact, systemName }: { year: number; contact: PublicContact; systemName: string }) {
  const hasContact = Boolean(contact.email || contact.phone || contact.address);
  return (
    <footer className="bg-brand-navy text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-10 w-10" />
            <p className="text-base font-semibold tracking-tight">{systemName}</p>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">
            A healthcare platform for Sierra Leone, launching with mental health and built to grow into further specialties.
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-sm font-semibold">Explore</h2>
          <ul className="mt-4 grid gap-2">
            <li>
              <Link className={footerLink} href="/#services">
                Services
              </Link>
            </li>
            <li>
              <Link className={footerLink} href="/#how-it-works">
                How It Works
              </Link>
            </li>
            <li>
              <Link className={footerLink} href="/#about">
                About Us
              </Link>
            </li>
            <li>
              <Link className={footerLink} href="/patient/find">
                Find a Doctor
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="text-sm font-semibold">Account</h2>
          <ul className="mt-4 grid gap-2">
            <li>
              <Link className={footerLink} href="/login">
                Log In
              </Link>
            </li>
            <li>
              <Link className={footerLink} href="/register">
                Create Patient Account
              </Link>
            </li>
            <li>
              <Link className={footerLink} href="/patient/find">
                Book an Appointment
              </Link>
            </li>
            <li>
              <Link className={footerLink} href="/support">
                Account support
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold">Contact</h2>
          {hasContact ? (
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-white/85">
              {contact.email ? (
                <li>
                  <a className={footerLink} href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.phone ? (
                <li>
                  <a className={footerLink} href={`tel:${contact.phone.replace(/\s+/g, "")}`}>
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.address ? <li>{contact.address}</li> : null}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-white/75">+232 80 790065</p>
          )}
          <ul className="mt-4 grid gap-2">
            <li>
              <Link className={footerLink} href="/privacy">
                Privacy Notice
              </Link>
            </li>
            <li>
              <Link className={footerLink} href="/terms">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-white/70 sm:px-6 lg:px-8">Powered by Osman Tholley © {year} {systemName}</p>
      </div>
    </footer>
  );
}
