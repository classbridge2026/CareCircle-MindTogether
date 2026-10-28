"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PublicDoctor } from "@/lib/public/landing";
import { profileImageSrc } from "@/components/profile-image-src";
import { focusRing } from "./styles";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "Dr";
}

function visitLabel(modes: PublicDoctor["consultationTypes"]): string | null {
  const online = modes.includes("ONLINE");
  const inPerson = modes.includes("IN_PERSON");
  if (online && inPerson) return "Online & In-Person";
  if (online) return "Online";
  if (inPerson) return "In-Person";
  return null;
}

function DoctorCard({ doctor }: { doctor: PublicDoctor }) {
  const role = doctor.qualification ?? doctor.specialties[0] ?? "Clinician";
  const visits = visitLabel(doctor.consultationTypes);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#d7e6f2] bg-white shadow-[0_10px_30px_rgba(18,48,74,0.08)]">
      <div className="relative aspect-[4/3] bg-gradient-to-b from-[#e7f3f8] to-[#d5ebe8]">
        {doctor.photo ? (
          <img className="absolute inset-0 h-full w-full object-cover" src={profileImageSrc(doctor.photo.userId, doctor.photo.version)} alt="" />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center text-4xl font-semibold tracking-tight text-brand-navy" aria-hidden="true">
            {initials(doctor.displayName)}
          </p>
        )}
        <p className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#178a4a] shadow-sm">
          <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#178a4a] text-[10px] text-white">
            ✓
          </span>
          Verified
        </p>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-4 pb-4">
        <h3 className="text-base font-semibold break-words text-brand-navy">{doctor.displayName}</h3>
        <p className="mt-1 text-sm text-brand-muted">{role}</p>
        <ul className="mt-3 grid gap-1.5 text-sm text-brand-ink">
          {doctor.services.length > 0 ? <li>Services: {doctor.services.join(", ")}</li> : null}
          {doctor.languages.length > 0 ? <li>Languages: {doctor.languages.join(", ")}</li> : null}
          {visits ? <li>{visits}</li> : null}
          {doctor.sessionFee ? <li>{doctor.sessionFee}</li> : null}
        </ul>
        <Link
          href={`/patient/doctors/${doctor.id}`}
          className={`mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-navy text-sm font-semibold text-white hover:bg-[#0c2438] ${focusRing}`}
        >
          Book Appointment
        </Link>
      </div>
    </article>
  );
}

export function DoctorCarousel({ doctors }: { doctors: PublicDoctor[] }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const list = scroller.current;
    if (!list) return;
    function update() {
      if (!list) return;
      setAtStart(list.scrollLeft <= 4);
      setAtEnd(list.scrollLeft + list.clientWidth >= list.scrollWidth - 4);
    }
    update();
    list.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      list.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [doctors.length]);

  function move(direction: -1 | 1) {
    const list = scroller.current;
    const card = list?.querySelector("li");
    if (!list || !card) return;
    const gap = 16;
    list.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  }

  return (
    <div className="relative">
      <ul
        ref={scroller}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {doctors.map((doctor) => (
          <li key={doctor.id} className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.7rem)] xl:w-[calc(25%-0.75rem)]">
            <DoctorCard doctor={doctor} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`absolute top-1/3 -left-2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-white text-brand-navy shadow-md sm:-left-5 ${focusRing} disabled:pointer-events-none disabled:opacity-40`}
        aria-label="Previous doctors"
        disabled={atStart}
        onClick={() => move(-1)}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        className={`absolute top-1/3 -right-2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-white text-brand-navy shadow-md sm:-right-5 ${focusRing} disabled:pointer-events-none disabled:opacity-40`}
        aria-label="Next doctors"
        disabled={atEnd}
        onClick={() => move(1)}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
