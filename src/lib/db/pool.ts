/** Pool defaults for the Neon pooler. A limit of 3 stalls when several admin pages run at once. */
export function withPoolSettings(raw: string, nodeEnv: string | undefined = process.env.NODE_ENV) {
  const queryIndex = raw.indexOf("?");
  const base = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? "" : raw.slice(queryIndex + 1));
  const pooled = base.includes("-pooler.");
  if (pooled) params.set("pgbouncer", "true");
  if (!params.has("connection_limit")) {
    // Each Vercel instance should open one pooled connection. A limit of 10
    // exhausts Neon and makes every page wait for a free connection.
    params.set("connection_limit", nodeEnv === "production" ? "1" : "15");
  }
  if (!params.has("pool_timeout")) params.set("pool_timeout", nodeEnv === "production" ? "10" : "20");
  if (!params.has("connect_timeout")) params.set("connect_timeout", nodeEnv === "production" ? "10" : "30");
  // Neon closes idle connections. Drop them before the next read waits on a dead one.
  if (!params.has("max_idle_connection_lifetime")) params.set("max_idle_connection_lifetime", "20");
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function poolTag(url: string) {
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  return `${params.get("connection_limit") ?? ""}/${params.get("pool_timeout") ?? ""}/${params.get("connect_timeout") ?? ""}/${params.get("max_idle_connection_lifetime") ?? ""}`;
}
