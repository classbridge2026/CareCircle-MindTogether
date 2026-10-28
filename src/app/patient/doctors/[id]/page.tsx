import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfilePhoto } from "@/components/profile-photo";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { loadPublicDoctor } from "@/lib/appointments/queries";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await loadPublicDoctor(prisma, id);
  return { title: result.ok && result.doctor.bookable ? result.doctor.displayName : "Doctor" };
}

export default async function PublicDoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadPublicDoctor(prisma, id);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return <RecordsUnavailable code={result.code} />;
  }
  if (!result.doctor.bookable) notFound();
  const doctor = result.doctor;
  return (
    <div className="grid gap-6">
      <header className="flex items-center gap-4">
        <ProfilePhoto userId={doctor.userId} name={doctor.displayName} version={doctor.imageVersion} size={88} alt={`${doctor.displayName} profile photo`} />
        <div>
        <p className="text-sm font-medium text-brand-teal">Doctor profile</p>
        <h1 className="mt-2 text-3xl font-semibold text-brand-navy">{doctor.displayName}</h1>
        <p className="mt-2 text-sm text-brand-muted">
          {doctor.qualificationTitle ?? "Qualification on file"}
          {doctor.qualificationInstitution ? `, ${doctor.qualificationInstitution}` : ""}
          {doctor.qualificationYear ? ` (${doctor.qualificationYear})` : ""}
        </p>
        </div>
      </header>
      <section className="grid gap-3 rounded-2xl border border-brand-line bg-white p-5">
        <p>{doctor.biography ?? "No biography has been published."}</p>
        <p className="text-sm text-brand-muted">Approved specialties: {doctor.specialties.join(", ") || "None published"}</p>
        <p className="text-sm text-brand-muted">Languages: {doctor.languages.join(", ") || "Not recorded"}</p>
      </section>
      {doctor.offerings.length === 0 ? (
        <p className="rounded-2xl border border-brand-line bg-white p-5 text-sm text-brand-muted">This doctor has no bookable consultation at the moment.</p>
      ) : (
        <ul className="grid gap-3">
          {doctor.offerings.map((offering) => (
            <li key={offering.id} className="rounded-2xl border border-brand-line bg-white p-5">
              <h2 className="font-semibold text-brand-navy">{offering.service}</h2>
              <p className="mt-1 text-sm text-brand-muted">
                {offering.specialty} · {offering.mode === "ONLINE" ? "Online" : "In person"} · {offering.durationMinutes} minutes · {offering.fee}
              </p>
              {offering.description ? <p className="mt-2 text-sm">{offering.description}</p> : null}
              <Link href={`/patient/book/${offering.id}`} className="mt-3 inline-flex h-11 items-center rounded-xl bg-brand-teal px-4 text-sm font-semibold text-white">
                View available times
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
