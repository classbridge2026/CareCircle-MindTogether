import Link from "next/link";
import type { ReactNode } from "react";
import { RecordTable, TableCell } from "@/components/admin/portal-ui";
import { StatusBadge, accountBadge, verificationBadge } from "@/components/status-badge";
import { formatWhen } from "@/lib/doctors/invitation-email";

export type DoctorListRow = {
  id: string;
  fullName: string;
  displayName: string;
  verificationStatus: string;
  createdAt: Date;
  user: { email: string; status: string };
  specialties: Array<{ isPrimary: boolean; claimStatus: string; specialty: { name: string } }>;
};

export function DoctorList({
  title,
  description,
  rows,
  total,
  page,
  pageSize,
  query,
  filters,
}: {
  title: string;
  description: string;
  rows: DoctorListRow[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  filters?: ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <section>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">{title}</h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-brand-muted">{description}</p>
      </header>
      {filters}
      <div className="mt-6">
        <RecordTable
          title="Doctors"
          caption={title}
          wide
          empty={rows.length === 0 ? "No doctors match these filters." : undefined}
          columns={
            <colgroup>
              <col className="pending-col-name" />
              <col className="pending-col-email" />
              <col className="pending-col-spec" />
              <col className="pending-col-verify" />
              <col className="pending-col-account" />
              <col className="pending-col-added" />
            </colgroup>
          }
          head={
            <>
              <th>Name</th>
              <th>Email</th>
              <th>Specialties</th>
              <th>Verification</th>
              <th>Account</th>
              <th>Added</th>
            </>
          }
          rows={rows.map((doctor) => {
            const verification = verificationBadge(doctor.verificationStatus);
            const account = accountBadge(doctor.user.status);
            return (
              <tr key={doctor.id}>
                <TableCell label="Name">
                  <Link href={`/admin/doctors/${doctor.id}`} className="users-email">
                    {doctor.fullName}
                  </Link>
                  <span className="users-sub">{doctor.displayName}</span>
                </TableCell>
                <TableCell label="Email">{doctor.user.email}</TableCell>
                <TableCell label="Specialties">
                  {doctor.specialties.length === 0
                    ? "None declared"
                    : doctor.specialties
                        .map((item) => `${item.specialty.name}${item.claimStatus === "VERIFIED" ? " (verified)" : " (declared)"}`)
                        .join(", ")}
                </TableCell>
                <TableCell label="Verification">
                  <StatusBadge tone={verification.tone}>{verification.label}</StatusBadge>
                </TableCell>
                <TableCell label="Account">
                  <StatusBadge tone={account.tone}>{account.label}</StatusBadge>
                </TableCell>
                <TableCell label="Added">{formatWhen(doctor.createdAt)}</TableCell>
              </tr>
            );
          })}
        />
      </div>
      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <p className="text-brand-muted">
            Page {page} of {pages}
          </p>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link className="font-semibold text-brand-teal" href={`${query}${query.includes("?") ? "&" : "?"}page=${page - 1}`}>
                Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link className="font-semibold text-brand-teal" href={`${query}${query.includes("?") ? "&" : "?"}page=${page + 1}`}>
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
      <p className="mt-3 text-sm text-brand-muted">{total} doctor{total === 1 ? "" : "s"}</p>
    </section>
  );
}
