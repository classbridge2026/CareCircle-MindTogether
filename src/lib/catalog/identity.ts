const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,40}$/;

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function codeFromSlug(slug: string): string {
  return slug.replace(/-/g, "_").toUpperCase();
}

export function nameKeyFrom(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveIdentity(input: {
  name: string;
  slug?: string;
  code?: string;
}): { ok: true; name: string; nameKey: string; slug: string; code: string } | { ok: false; message: string } {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    return { ok: false, message: "Enter a name between 2 and 80 characters." };
  }
  const requestedSlug = (input.slug ?? "").trim();
  const fromCode = (input.code ?? "").trim().replace(/_/g, "-");
  const slug = slugify(requestedSlug || fromCode || name);
  if (slug.length < 2 || !SLUG_PATTERN.test(slug)) {
    return { ok: false, message: "Use a slug made of lowercase letters, numbers, and hyphens." };
  }
  const requestedCode = (input.code ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  const code = requestedCode || codeFromSlug(slug);
  if (!CODE_PATTERN.test(code)) {
    return { ok: false, message: "Use a slug that can be stored as a stable code." };
  }
  return { ok: true, name, nameKey: nameKeyFrom(name), slug, code };
}

const SERVICE_GROUPS = [
  { code: "INITIAL", names: ["initial consultation", "initial"], slugs: ["initial", "initial-consultation"] },
  {
    code: "FOLLOW_UP",
    names: ["follow-up consultation", "follow up consultation", "follow-up", "follow up"],
    slugs: ["follow-up", "follow-up-consultation"],
  },
  { code: "ONLINE", names: ["online consultation", "online"], slugs: ["online", "online-consultation"] },
  {
    code: "IN_PERSON",
    names: ["in-person consultation", "in person consultation", "in-person"],
    slugs: ["in-person", "in-person-consultation"],
  },
] as const;

export function matchingServiceCodes(identity: { nameKey: string; slug: string; code: string }): string[] {
  return SERVICE_GROUPS.filter(
    (group) =>
      group.code === identity.code ||
      group.names.some((name) => name === identity.nameKey) ||
      group.slugs.some((slug) => slug === identity.slug),
  ).map((group) => group.code);
}
