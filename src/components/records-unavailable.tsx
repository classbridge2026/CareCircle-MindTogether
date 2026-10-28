export function RecordsUnavailable({ code }: { code: "SCHEMA" | "UNAVAILABLE" | "NOT_FOUND" }) {
  const message =
    code === "SCHEMA"
      ? "These records are not available until the latest database migration has been applied."
      : code === "NOT_FOUND"
        ? "That record was not found."
        : "These records could not be loaded.";
  return (
    <p role="alert" className="rounded-2xl border border-brand-line bg-white px-4 py-4 text-sm leading-6 text-brand-ink">
      {message}
    </p>
  );
}
