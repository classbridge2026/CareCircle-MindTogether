import Link from "next/link";

export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <header>
      {eyebrow ? <p className="text-sm font-medium tracking-[0.16em] text-brand-teal uppercase">{eyebrow}</p> : null}
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-navy">{title}</h1>
      <p className="mt-2 max-w-3xl text-base leading-7 text-brand-muted">{description}</p>
    </header>
  );
}

export function catalogQuery(path: string, params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "ALL") search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function CatalogPager({ page, pageSize, total, query, label }: { page: number; pageSize: number; total: number; query: string; label: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (next: number) => `${query}${query.includes("?") ? "&" : "?"}page=${next}`;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-brand-muted">
        {total} {label}{total === 1 ? "" : "s"}
      </p>
      {pages > 1 ? (
        <nav className="flex items-center gap-3 text-sm" aria-label="Pagination">
          <span className="text-brand-muted">
            Page {page} of {pages}
          </span>
          {page > 1 ? (
            <Link className="font-semibold text-brand-teal" href={href(page - 1)}>
              Previous
            </Link>
          ) : null}
          {page < pages ? (
            <Link className="font-semibold text-brand-teal" href={href(page + 1)}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

export function EmptyCatalog({ children }: { children: string }) {
  return <p className="rounded-2xl border border-dashed border-brand-line bg-white px-4 py-8 text-sm text-brand-muted">{children}</p>;
}
