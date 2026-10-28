import Image from "next/image";
import Link from "next/link";
import type { PublicContact, PublicLanding, PublicOffering, PublicService, PublicSpecialty } from "@/lib/public/landing";
import { CareCircleMark } from "@/components/brand";
import { LandingIcon } from "./icons";
import { DoctorCarousel } from "./doctor-carousel";
import { LandingScroll } from "./landing-scroll";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { btnOnNavy, btnOnNavyGhost, btnOnNavyOutline, btnPrimary, btnSecondary, focusRing } from "./styles";

const steps = [
  {
    title: "Create Your Account",
    body: "Register as a patient. Public registration creates a patient account only.",
    icon: "account" as const,
  },
  {
    title: "Find Your Care",
    body: "Explore the doctors and consultation services that are approved and currently available.",
    icon: "search" as const,
  },
  {
    title: "Choose a Time",
    body: "View published appointment times and select a suitable slot. Times are shown in Africa/Freetown.",
    icon: "calendar" as const,
  },
  {
    title: "Get Care",
    body: "Attend in the way recorded on the booking. An online visit opens a waiting room. You join the video or audio call when the doctor is ready.",
    icon: "care" as const,
  },
];

const benefits = [
  {
    title: "Patient-Centred Care",
    body: "A welcoming experience designed around patient needs.",
    icon: "care" as const,
  },
  {
    title: "Convenient Access",
    body: "Discover available services and appointment options in one place.",
    icon: "access" as const,
  },
  {
    title: "Privacy and Trust",
    body: "Patient information is meant to be kept confidential. This is a privacy principle, not a security certification.",
    icon: "shield" as const,
  },
  {
    title: "A Growing Healthcare Network",
    body: "Mental health comes first, on a platform shaped for future specialties.",
    icon: "network" as const,
  },
];

function modeLabel(mode: "ONLINE" | "IN_PERSON") {
  return mode === "ONLINE" ? "Online appointment" : "In-person appointment";
}

function UnavailableNotice() {
  return (
    <p className="rounded-2xl border border-brand-line bg-white p-5 text-sm leading-6 text-brand-muted" role="status">
      Live listings could not be loaded just now. You can still create a patient account, and the doctor directory will show what is available when you sign in.
    </p>
  );
}

function SpecialtyCard({ specialty, systemName }: { specialty: PublicSpecialty; systemName: string }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-brand-navy">{specialty.name}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${specialty.bookable ? "bg-brand-mist text-brand-teal" : "bg-brand-ice text-brand-muted"}`}
        >
          {specialty.bookable ? "Open for booking" : "Not open for booking"}
        </span>
      </div>
      <p className="mt-3 flex-1 text-sm leading-6 text-brand-muted">
        {specialty.description ??
          (specialty.lead ? `The first specialty on ${systemName}.` : "An active specialty on the platform.")}
      </p>
      {specialty.bookable ? (
        <Link href={`/patient/find?specialty=${specialty.id}`} className={`${btnPrimary} mt-5 w-fit`}>
          Find a doctor
        </Link>
      ) : (
        <p className="mt-5 text-sm font-medium text-brand-navy">Appointments are not available for this specialty yet.</p>
      )}
    </article>
  );
}

function OfferingCard({ offering }: { offering: PublicOffering }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-brand-navy">{offering.serviceName}</h3>
        <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-teal">Open for booking</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-brand-ink">
        {offering.doctorName}
        <span className="text-brand-muted"> · {offering.specialtyName}</span>
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        <li className="rounded-full bg-brand-ice px-3 py-1 text-xs font-semibold text-brand-navy">{modeLabel(offering.mode)}</li>
        <li className="rounded-full bg-brand-ice px-3 py-1 text-xs font-semibold text-brand-navy">{offering.durationMinutes} min</li>
        {offering.fee ? <li className="rounded-full bg-brand-ice px-3 py-1 text-xs font-semibold text-brand-navy">{offering.fee}</li> : null}
      </ul>
      <Link href={`/patient/doctors/${offering.doctorId}`} className={`${btnPrimary} mt-5 w-fit`}>
        Book with this doctor
      </Link>
    </article>
  );
}

function ServiceCard({ service }: { service: PublicService }) {
  return (
    <article className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-brand-navy">{service.name}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${service.bookable ? "bg-brand-mist text-brand-teal" : "bg-brand-ice text-brand-muted"}`}>
          {service.bookable ? "Open for booking" : "Not open for booking"}
        </span>
      </div>
      {service.description ? <p className="mt-3 text-sm leading-6 text-brand-muted">{service.description}</p> : null}
      {service.modes.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {service.modes.map((mode) => (
            <li key={mode} className="rounded-full bg-brand-ice px-3 py-1 text-xs font-semibold text-brand-navy">
              {modeLabel(mode)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-brand-muted">This service is published, and it is not available to book yet.</p>
      )}
      {service.bookable ? (
        <Link href={`/patient/find?service=${service.id}`} className={`${btnPrimary} mt-5 w-fit`}>
          Book this service
        </Link>
      ) : null}
    </article>
  );
}

function DoctorsSection({ content }: { content: PublicLanding }) {
  return (
    <section id="doctors" aria-labelledby="doctors-heading" className="scroll-mt-24 bg-[#f3f8fb]">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="doctors-heading" className="text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
              Meet Our Doctors
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-brand-muted">
              Approved doctors with a verified specialty. A consultation service appears here when an administrator assigns it. Sign in to choose a time.
            </p>
          </div>
          <Link href="/patient/find" className={`shrink-0 text-sm font-semibold text-brand-navy underline-offset-4 hover:underline ${focusRing}`}>
            View all doctors
          </Link>
        </div>
        <div className="mt-8">
          {!content.ok ? (
            <UnavailableNotice />
          ) : content.doctors.length === 0 ? (
            <p className="rounded-2xl border border-brand-line bg-white p-6 text-sm leading-6 text-brand-muted">
              No approved doctors are available to feature yet. Please check again as the healthcare network grows.
            </p>
          ) : (
            <DoctorCarousel doctors={content.doctors} />
          )}
        </div>
      </div>
    </section>
  );
}

function ServicesSection({ content, systemName }: { content: PublicLanding; systemName: string }) {
  const others = content.specialties.filter((specialty) => !specialty.lead);
  return (
    <section id="services" aria-labelledby="services-heading" className="scroll-mt-24 bg-brand-ice">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <p className="text-sm font-semibold tracking-[0.14em] text-brand-teal uppercase">Services</p>
        <h2 id="services-heading" className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
          Care for Your Health, Every Step of the Way.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-brand-muted">
          {systemName} is launching with mental health and is designed to expand into other medical specialties. A specialty appears here only when it is an active record. It can be booked only when an approved doctor has an active consultation service.
        </p>
        <div className="mt-8">
          {!content.ok ? (
            <UnavailableNotice />
          ) : (
            <div className="grid gap-8">
              {content.specialties.length > 0 ? (
                <ul className="grid gap-4 md:grid-cols-2">
                  {content.specialties.map((specialty) => (
                    <li key={specialty.id}>
                      <SpecialtyCard specialty={specialty} systemName={systemName} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-brand-line bg-white p-5 text-sm leading-6 text-brand-muted">
                  Mental Health is the first specialty this platform is preparing to offer. It is not open for booking until an active specialty and consultation service are published.
                </p>
              )}
              {others.length === 0 ? (
                <p className="text-sm leading-6 text-brand-muted">More healthcare specialties are planned for future expansion.</p>
              ) : null}
              <div>
                <h3 className="text-xl font-semibold text-brand-navy">Open offerings</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
                  An offering is a consultation service an administrator has assigned to an approved doctor. It appears here while that assignment stays active.
                </p>
                {content.offerings.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-brand-line bg-white p-5 text-sm leading-6 text-brand-muted">
                    No doctor offering is open for booking yet.
                  </p>
                ) : (
                  <ul className="mt-4 grid gap-4 md:grid-cols-2">
                    {content.offerings.map((offering) => (
                      <li key={offering.id}>
                        <OfferingCard offering={offering} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-brand-navy">Consultation services</h3>
                {content.services.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-brand-line bg-white p-5 text-sm leading-6 text-brand-muted">
                    No consultation services are available to book yet.
                  </p>
                ) : (
                  <ul className="mt-4 grid gap-4 md:grid-cols-2">
                    {content.services.map((service) => (
                      <li key={service.id}>
                        <ServiceCard service={service} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactSection({ contact }: { contact: PublicContact }) {
  const hasContact = Boolean(contact.email || contact.phone || contact.address);
  return (
    <section id="contact" aria-labelledby="contact-heading" className="scroll-mt-24 bg-brand-ice">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-8">
        <div>
          <p className="text-sm font-semibold tracking-[0.14em] text-brand-teal uppercase">Contact</p>
          <h2 id="contact-heading" className="mt-3 text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
            Talk with the platform team
          </h2>
          <p className="mt-4 text-base leading-7 text-brand-muted">
            For help signing in or recovering a password, use the account support page. This page does not collect messages.
          </p>
          <Link href="/support" className={`${btnSecondary} mt-6`}>
            Account support
          </Link>
        </div>
        <div className="rounded-2xl border border-brand-line bg-white p-6 shadow-sm">
          {hasContact ? (
            <ul className="grid gap-4 text-sm leading-6 text-brand-ink">
              {contact.email ? (
                <li>
                  <p className="font-semibold text-brand-navy">Email</p>
                  <a className={`text-brand-teal underline-offset-4 hover:underline ${focusRing}`} href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.phone ? (
                <li>
                  <p className="font-semibold text-brand-navy">Phone</p>
                  <a className={`text-brand-teal underline-offset-4 hover:underline ${focusRing}`} href={`tel:${contact.phone.replace(/\s+/g, "")}`}>
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.address ? (
                <li>
                  <p className="font-semibold text-brand-navy">Address</p>
                  <p>{contact.address}</p>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm leading-6 text-brand-muted">
              Public contact details have not been configured yet. An administrator can add them before launch. No telephone number, email address, or location is shown until then.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function LandingView({ content, year, systemName }: { content: PublicLanding; year: number; systemName: string }) {
  return (
    <div id="top" className="min-h-dvh bg-white text-brand-ink">
      <LandingScroll />
      <a
        href="#main"
        className={`sr-only z-50 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-brand-navy focus:not-sr-only focus:fixed focus:top-3 focus:left-3 ${focusRing}`}
      >
        Skip to content
      </a>
      <SiteHeader systemName={systemName} />
      <main id="main">
        <section aria-labelledby="hero-heading" className="bg-brand-navy text-white">
          <div className="grid lg:grid-cols-2">
            <div className="order-2 flex flex-col justify-center px-4 py-10 sm:px-8 sm:py-14 lg:order-1 lg:px-12 lg:py-16 xl:px-16">
              <div className="flex items-center gap-3">
                <CareCircleMark className="h-14 w-14 sm:h-16 sm:w-16" />
                <p className="text-sm font-semibold tracking-[0.14em] text-white/80 uppercase">{systemName}</p>
              </div>
              <h1 id="hero-heading" className="mt-6 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
                Healthcare That Puts You First.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
                Connect with qualified healthcare professionals, explore available services, and access care that fits your needs. {systemName} is building a more connected healthcare experience for Sierra Leone.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/patient/find" className={`${btnOnNavy} w-full sm:w-auto`}>
                  Find a Doctor
                </Link>
                <Link href="/#how-it-works" className={`${btnOnNavyOutline} w-full sm:w-auto`}>
                  How It Works
                </Link>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/75">Your care. Your privacy. Your journey.</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                Browsing the directory and booking an appointment continue after you sign in with a patient account.
              </p>
            </div>
            <figure className="relative order-1 h-full min-h-64 sm:min-h-80 md:min-h-96 lg:order-2 lg:min-h-[40rem]">
              <Image
                src="/hero-consultation.jpg"
                alt="A physician in a white coat listens to a patient during a clinic consultation."
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover object-[center_22%]"
              />
            </figure>
          </div>
        </section>

        <ServicesSection content={content} systemName={systemName} />

        <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-24 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <p className="text-sm font-semibold tracking-[0.14em] text-brand-teal uppercase">How it works</p>
            <h2 id="how-heading" className="mt-3 text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
              Four steps to a booked visit
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-mist text-brand-teal">
                      <LandingIcon name={step.icon} className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-brand-teal">{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-brand-navy">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">{step.body}</p>
                </li>
              ))}
            </ol>
            <Link href="/patient/find" className={`${btnPrimary} mt-8`}>
              Start booking
            </Link>
          </div>
        </section>

        <section aria-labelledby="why-heading" className="bg-brand-mist">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <h2 id="why-heading" className="max-w-3xl text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
              Why choose {systemName}?
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <li key={benefit.title} className="rounded-2xl border border-brand-line bg-white p-5 shadow-sm">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-ice text-brand-navy">
                    <LandingIcon name={benefit.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-brand-navy">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-brand-muted">{benefit.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <DoctorsSection content={content} />

        <section aria-labelledby="next-heading" className="bg-brand-navy text-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <h2 id="next-heading" className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Your Next Step Towards Better Care Starts Here.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/80">
              Create a patient account, or sign in to look through available doctors and choose a published appointment time.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/patient/find" className={btnOnNavy}>
                Find a Doctor
              </Link>
              <Link href="/register" className={btnOnNavyOutline}>
                Create a Patient Account
              </Link>
              <Link href="/login" className={btnOnNavyGhost}>
                Log In
              </Link>
            </div>
          </div>
        </section>

        <section id="about" aria-labelledby="about-heading" className="scroll-mt-24 bg-white">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:px-8">
            <div>
              <p className="text-sm font-semibold tracking-[0.14em] text-brand-teal uppercase">About us</p>
              <h2 id="about-heading" className="mt-3 text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
                Care that can grow with the people who need it
              </h2>
              <p className="mt-4 text-base leading-7 text-brand-muted">
                {systemName} connects patients with healthcare professionals and is being built to expand access to care. Mental health is the first specialty. Other specialties can be introduced as real services are ready, rather than promised in advance.
              </p>
            </div>
            <div className="rounded-2xl border border-brand-line bg-brand-paper p-6">
              <h3 className="text-lg font-semibold text-brand-navy">What you can do today</h3>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-brand-muted">
                <li>Create a patient account and sign in.</li>
                <li>Review specialties and consultation services that have been published.</li>
                <li>Choose a time when an approved doctor has an open appointment.</li>
              </ul>
            </div>
          </div>
        </section>

        <ContactSection contact={content.contact} />
      </main>
      <SiteFooter year={year} contact={content.contact} systemName={systemName} />
    </div>
  );
}
