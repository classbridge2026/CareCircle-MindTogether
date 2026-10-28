import { redirect } from "next/navigation";

export default async function AllDoctorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const one = Array.isArray(value) ? value[0] : value;
    if (one) search.set(key, one);
  }
  const query = search.toString();
  redirect(query ? `/admin/doctors?${query}` : "/admin/doctors");
}
