import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { AdminIcon, type AdminIconName } from "./admin-icons";

const statTones = {
  teal: "#0f766e",
  navy: "#12304a",
  amber: "#d97706",
  rose: "#be123c",
  sky: "#0369a1",
  green: "#15803d",
} as const;

export type StatTone = keyof typeof statTones;

export function MetricLink({
  href,
  label,
  value,
  icon,
  note,
  tone = "teal",
}: {
  href: string;
  label: string;
  value: number;
  icon: AdminIconName;
  note?: string;
  tone?: StatTone;
}) {
  return (
    <Link href={href} className="stat-card" style={{ "--stat": statTones[tone] } as CSSProperties}>
      <span className="stat-card-icon">
        <AdminIcon name={icon} />
      </span>
      <span className="stat-card-copy">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
        {note ? <span className="stat-card-note">{note}</span> : null}
      </span>
    </Link>
  );
}

export function QuickActions({
  items,
  mobileTiles = false,
}: {
  items: Array<{ href: string; label: string; detail: string; icon: AdminIconName }>;
  mobileTiles?: boolean;
}) {
  return (
    <section className={mobileTiles ? "qa-card qa-card-tiles" : "qa-card"} aria-labelledby="quick-actions-title">
      <header className="qa-head">
        <h2 id="quick-actions-title">
          <AdminIcon name="bolt" />
          Quick actions
        </h2>
      </header>
      <ul className="qa-list">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="qa-item">
              <span className="qa-icon">
                <AdminIcon name={item.icon} />
              </span>
              <span className="qa-copy">
                <span className="qa-label">{item.label}</span>
                <span className="qa-detail">{item.detail}</span>
              </span>
              <AdminIcon name="arrow" className="qa-arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StatusBars({ title, rows }: { title: string; rows: Array<{ key: string; label: string; count: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="admin-status">
      <header className="admin-status-head">
        <h2>{title}</h2>
      </header>
      <div className="admin-status-body">
        {total === 0 ? (
          <p className="admin-status-empty">No records are stored for this summary.</p>
        ) : (
          <ul className="admin-status-list">
            {rows.map((row) => (
              <li key={row.key}>
                <div className="admin-status-row">
                  <span>{row.label}</span>
                  <strong>{row.count}</strong>
                </div>
                <div className="admin-status-track" role="img" aria-label={`${row.label}: ${row.count} of ${total}`}>
                  <div className="admin-status-fill" style={{ width: `${Math.round((row.count / total) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-brand-line bg-[#f3f7fb] px-4 py-3 text-sm leading-6 text-brand-ink">{children}</p>;
}

export function RecordTable({
  caption,
  title,
  action,
  head,
  rows,
  columns,
  empty,
  wide = false,
}: {
  caption: string;
  title?: string;
  action?: ReactNode;
  head: ReactNode;
  rows?: ReactNode;
  columns?: ReactNode;
  empty?: string;
  wide?: boolean;
}) {
  return (
    <section className="users-card">
      {title || action ? (
        <header className="users-card-head">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      {empty ? (
        <p className="users-empty">{empty}</p>
      ) : (
        <div className="users-table-wrap">
          <table className={wide ? "users-table users-table-wide" : "users-table"}>
            <caption className="sr-only">{caption}</caption>
            {columns}
            <thead>
              <tr>{head}</tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function TableCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <td data-label={label}>
      <span className="users-cell">{children}</span>
    </td>
  );
}
