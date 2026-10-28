import type { Metadata } from "next";
import Link from "next/link";
import { CatalogPager, catalogQuery } from "@/components/admin/catalog-ui";
import { RecordTable, TableCell } from "@/components/admin/portal-ui";
import { LiveQueryForm } from "@/components/live-query";
import { textInputClass } from "@/components/form-classes";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { loadAppointments } from "@/lib/admin/directories";
import { appointmentStatusLabel, appointmentStatusTone, formatPlatformWhen } from "@/lib/admin/labels";
import { readPage, readParam } from "@/lib/catalog/queries";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const params = await searchParams;
  const q = readParam(params.q);
  const status = readParam(params.status);
  const mode = readParam(params.mode);
  const date = readParam(params.date);
  const when = readParam(params.when);
  const patient = readParam(params.patient);
  const page = readPage(params.page);
  const result = await loadAppointments(prisma, { q, status, mode, date, when, patientId: patient, page });
  if (!result.ok) return <RecordsUnavailable code={result.code} />;
  return (
    <main className="grid gap-6">
      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <Link className="text-brand-teal" href="/admin/appointments?status=PENDING_PAYMENT">Pending payment holds</Link>
        <Link className="text-brand-teal" href="/admin/appointments?status=EXPIRED_UNPAID">Expired unpaid bookings</Link>
      </div>
      <LiveQueryForm
        pathname="/admin/appointments"
        className="grid gap-3 rounded-2xl border border-brand-line bg-white p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_11rem_10rem_11rem] xl:items-end"
        fields={[
          { name: "q", label: "Patient, doctor, location, or appointment", kind: "text", value: q, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
          { name: "status", label: "Status", kind: "select", value: status || "ALL", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1`, options: [
            { value: "ALL", label: "All statuses" },
            { value: "PENDING_APPROVAL", label: "Pending approval" },
            { value: "PENDING_PAYMENT", label: "Pending payment" },
            { value: "EXPIRED_UNPAID", label: "Expired unpaid" },
            { value: "CONFIRMED", label: "Confirmed" },
            { value: "CHECKED_IN", label: "Checked in" },
            { value: "IN_PROGRESS", label: "In progress" },
            { value: "COMPLETED", label: "Completed" },
            { value: "CANCELLED", label: "Cancelled" },
            { value: "NO_SHOW", label: "No show" },
            { value: "RESCHEDULED", label: "Rescheduled" },
          ] },
          { name: "mode", label: "Mode", kind: "select", value: mode || "ALL", labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1`, options: [
            { value: "ALL", label: "All modes" },
            { value: "ONLINE", label: "Online" },
            { value: "IN_PERSON", label: "In person" },
          ] },
          { name: "date", label: "Date", kind: "date", value: date, labelClassName: "text-sm font-medium", inputClassName: `${textInputClass} mt-1` },
        ]}
      />
      <RecordTable
        title="Appointments"
        caption="Appointments"
        empty={result.appointments.length === 0 ? "No appointments match these filters." : undefined}
        columns={
          <colgroup>
            <col className="appt-col-when" />
            <col className="appt-col-who" />
            <col className="appt-col-who" />
            <col className="appt-col-mode" />
            <col className="appt-col-fee" />
            <col className="appt-col-status" />
          </colgroup>
        }
        head={
          <>
            <th>When</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th>Mode</th>
            <th>Fee</th>
            <th>Status</th>
          </>
        }
        rows={result.appointments.map((row) => (
          <tr key={row.id}>
            <TableCell label="When">
              <Link className="users-email" href={`/admin/appointments/${row.id}`}>
                {formatPlatformWhen(new Date(row.startsAt))}
              </Link>
            </TableCell>
            <TableCell label="Patient">{row.patient}</TableCell>
            <TableCell label="Doctor">{row.doctor}</TableCell>
            <TableCell label="Mode">{row.mode === "ONLINE" ? "Online" : "In person"}</TableCell>
            <TableCell label="Fee">{row.fee}</TableCell>
            <TableCell label="Status">
              <StatusBadge tone={appointmentStatusTone(row.status)}>{appointmentStatusLabel(row.status)}</StatusBadge>
            </TableCell>
          </tr>
        ))}
      />
      <CatalogPager page={result.page} pageSize={result.pageSize} total={result.total} query={catalogQuery("/admin/appointments", { q, status, mode, date, when, patient })} label="appointment" />
    </main>
  );
}
