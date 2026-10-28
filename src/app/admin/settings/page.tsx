import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/catalog-ui";
import { Notice } from "@/components/admin/portal-ui";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { emailProviderConfigured } from "@/lib/auth/delivery";
import { loadPlatformSettings } from "@/lib/admin/directories";
import { formatPlatformWhen } from "@/lib/admin/labels";
import { prisma } from "@/lib/db/prisma";
import { CurrencySettingForm, HoldSettingForm, SystemNameForm } from "./settings-forms";

export const metadata: Metadata = { title: "Platform settings" };
export const dynamic = "force-dynamic";

const lockedNames: Record<string, string> = {
  MINOR_REGISTRATION_ENABLED: "Minor registration",
  MINOR_TREATMENT_ENABLED: "Minor treatment",
  DOCTOR_IDENTITY_DOCUMENT_REQUIRED: "Doctor identity document",
};

function storedValue(value: unknown) {
  if (value === true) return "Enabled";
  if (value === false) return "Disabled";
  if (value === null || value === undefined) return "Not stored";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "Stored structured value";
}

export default async function SettingsPage() {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const settings = await loadPlatformSettings(prisma);
  if (!settings.ok) return <RecordsUnavailable code={settings.code} />;
  const emailReady = emailProviderConfigured();
  return (
    <main className="grid gap-6">
      <PageHeader eyebrow="Platform" title="Platform settings" description="Only settings the application already reads can be changed. Environment secrets are not listed." />
      <section className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-navy">Identity</h2>
        <p className="text-sm leading-6 text-brand-muted">The current system name is {settings.systemName}.</p>
        <p className="text-sm leading-6 text-brand-muted">
          The screening support contact is the service name and phone number shown when a screen raises a safety flag. Set it on{" "}
          <Link className="font-semibold text-brand-teal" href="/admin/screening">Screening management</Link>.
        </p>
        <p className="text-sm leading-6 text-brand-muted">New accounts default to Africa/Freetown. Availability rules keep their own timezone. Existing schedules are not rewritten from this page.</p>
        <p className="text-sm leading-6 text-brand-muted">The default currency for new catalog prices is {settings.currency}. Booked appointments keep the fee they were given.</p>
      </section>
      <SystemNameForm systemName={settings.systemName} />
      <CurrencySettingForm currency={settings.currency} />
      {settings.holdMinutes === null ? <Notice>No payment-hold setting is stored. New bookings use 10 minutes until an administrator saves a value between 5 and 120.</Notice> : null}
      <HoldSettingForm minutes={settings.holdMinutes} />
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-brand-navy">Booking rules</h2>
        <Notice>
          A doctor cannot have two occupying appointments in the same time range. Occupying statuses are pending payment, confirmed, checked in, and in progress. That rule is enforced by the database and is not a setting.
        </Notice>
        <p className="text-sm leading-6 text-brand-muted">
          The payment hold above is the booking duration the application reads.{" "}
          <Link className="font-semibold text-brand-teal" href="/admin/configuration">
            Catalog status
          </Link>{" "}
          shows active specialties, services, and locations.
        </p>
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-brand-navy">Locked policy settings</h2>
        <p className="text-sm leading-6 text-brand-muted">Minor-care flags and the identity-document requirement are shown as stored. This portal does not change them.</p>
        <dl className="grid gap-3 sm:grid-cols-3">
          {settings.locked.map((setting) => (
            <div key={setting.key} className="rounded-2xl border border-brand-line bg-white px-4 py-4">
              <dt className="text-sm text-brand-muted">{lockedNames[setting.key] ?? setting.key}</dt>
              <dd className="mt-1 font-semibold text-brand-navy">{storedValue(setting.value)}</dd>
              <dd className="mt-1 text-xs text-brand-muted">{setting.updatedAt ? `Updated ${formatPlatformWhen(new Date(setting.updatedAt))}` : "No row stored"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-navy">Notifications and payments</h2>
        <p className="text-sm leading-6 text-brand-muted">
          {emailReady
            ? "Email delivery is configured with Gmail SMTP. A message is recorded as sent only after Gmail accepts it."
            : "Email delivery is not configured. Set the SMTP variables outside this page. Verification, invitation, and appointment email stay unsent until then."}
        </p>
        <p className="text-sm leading-6 text-brand-muted">No payment provider is integrated. Payments can be reviewed, and this page cannot mark one successful.</p>
      </section>
      {settings.other.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold text-brand-navy">Other stored settings</h2>
          <p className="text-sm text-brand-muted">These keys have no editor because this page only changes the system name, currency, and the payment hold.</p>
          <ul className="grid gap-2">
            {settings.other.map((setting) => (
              <li key={setting.key} className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm">
                <span className="font-semibold text-brand-navy">{setting.key}</span>
                <span className="text-brand-muted"> · {setting.value}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
