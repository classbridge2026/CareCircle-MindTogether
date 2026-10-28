import Link from "next/link";

export type ClinicPlace = {
  name: string;
  address: string;
  phone: string | null;
  instructions: string | null;
};

export function ConsultationFacts({
  mode,
  canJoin,
  joinHref,
  message,
  when,
  counterpartLabel,
  counterpart,
  specialty,
  service,
  preparation,
  place,
  actionLabel = "Join consultation",
}: {
  mode: "ONLINE" | "IN_PERSON";
  canJoin: boolean;
  joinHref: string | null;
  message: string;
  when: string;
  counterpartLabel: string;
  counterpart: string;
  specialty: string;
  service: string;
  preparation: string | null;
  place: ClinicPlace | null;
  actionLabel?: string;
}) {
  const online = mode === "ONLINE";
  return (
    <section className="grid gap-3 rounded-2xl border border-[#d7e3ee] bg-white p-5 text-sm leading-6 text-[#10233c]">
      <h2 className="text-lg font-semibold text-[#0C2B45]">{online ? "Online consultation" : "Clinic visit"}</h2>
      <p>{service} · {specialty}</p>
      <p>{counterpartLabel}: {counterpart}</p>
      <p>When: {when} (Africa/Freetown)</p>
      <p>{message}</p>
      {online && preparation ? <p>Preparation: {preparation}</p> : null}
      {online && canJoin && joinHref ? (
        <Link className="inline-flex h-11 w-fit items-center justify-center rounded-lg bg-[#0F766E] px-4 text-sm font-semibold text-white" href={joinHref}>
          {actionLabel}
        </Link>
      ) : null}
      {online ? <p>Do not share this page. Sign in is required, and this is not a public meeting link.</p> : null}
      {!online && place ? (
        <div>
          <p className="font-semibold text-[#0C2B45]">{place.name}</p>
          <p>{place.address}</p>
          {place.phone ? <p>Clinic phone: {place.phone}</p> : null}
          <p>{place.instructions ? `Arrival: ${place.instructions}` : "No arrival instructions have been added."}</p>
        </div>
      ) : null}
      {!online && !place ? <p>Location details have not been provided yet.</p> : null}
    </section>
  );
}
