type IconName = "menu" | "close" | "account" | "search" | "calendar" | "care" | "shield" | "access" | "network" | "stethoscope";

const paths: Record<IconName, string> = {
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  account: "M16 19v-1.2A3.8 3.8 0 0 0 12.2 14H8.8A3.8 3.8 0 0 0 5 17.8V19M10.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 8v6M16 11h6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5",
  calendar: "M7 3v3M17 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  care: "M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9Z",
  shield: "M12 3 5 6v6.2c0 4.2 2.8 6.8 7 8.8 4.2-2 7-4.6 7-8.8V6l-7-3Z",
  access: "M4 12h16M14 6l6 6-6 6",
  network: "M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 8v4M6.8 16.2 10 13M17.2 16.2 14 13",
  stethoscope: "M6 4v6a4 4 0 0 0 8 0V4M8 4H4M14 4h4M10 14v1.5A4.5 4.5 0 0 0 14.5 20H16a3 3 0 1 0 0-6h-.5",
};

export function LandingIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={paths[name]} />
    </svg>
  );
}

const stepIconTone = {
  account: "bg-brand-navy",
  search: "bg-brand-teal",
  calendar: "bg-brand-navy-mid",
  care: "bg-brand-teal",
} as const;

export function StepAppIcon({ name }: { name: keyof typeof stepIconTone }) {
  return (
    <span className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm ${stepIconTone[name]}`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
        {name === "account" ? (
          <>
            <circle cx="12" cy="8" r="3.15" fill="currentColor" />
            <path fill="currentColor" d="M5.7 19c.55-3.2 3.05-5.1 6.3-5.1s5.75 1.9 6.3 5.1c.12.6-.36 1.15-1 1.15H6.7c-.64 0-1.12-.55-1-1.15Z" />
          </>
        ) : null}
        {name === "search" ? (
          <>
            <circle cx="10.5" cy="10.5" r="5.1" fill="none" stroke="currentColor" strokeWidth="2.25" />
            <path d="M14.5 14.5 19.2 19.2" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
          </>
        ) : null}
        {name === "calendar" ? (
          <>
            <rect x="4" y="5.4" width="16" height="14.4" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 10.2h16M8 3.4v3.4M16 3.4v3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="8.6" cy="13.6" r="1.05" fill="currentColor" />
            <circle cx="12" cy="13.6" r="1.05" fill="currentColor" />
            <circle cx="15.4" cy="13.6" r="1.05" fill="currentColor" />
          </>
        ) : null}
        {name === "care" ? (
          <>
            <rect x="3" y="6.5" width="12.2" height="11" rx="2.1" fill="currentColor" />
            <path fill="currentColor" d="M15.2 10.1 21 7.2v9.6l-5.8-2.9v-3.8Z" />
          </>
        ) : null}
      </svg>
    </span>
  );
}

const benefitIconTone = {
  care: "bg-brand-navy",
  access: "bg-brand-teal",
  shield: "bg-brand-navy-mid",
  network: "bg-brand-teal",
} as const;

export function BenefitAppIcon({ name }: { name: keyof typeof benefitIconTone }) {
  return (
    <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${benefitIconTone[name]}`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
        {name === "care" ? (
          <path fill="currentColor" d="M12 19.6c-.35 0-.68-.12-.95-.36-3.4-2.9-6.55-5.55-6.55-8.95A3.85 3.85 0 0 1 8.4 6.4c1.25 0 2.4.58 3.15 1.55A3.9 3.9 0 0 1 14.7 6.4a3.85 3.85 0 0 1 3.9 3.89c0 3.4-3.15 6.05-6.55 8.95-.27.24-.6.36-1.05.36Z" />
        ) : null}
        {name === "access" ? (
          <>
            <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8.4 12h6.3M12.1 8.7 15.4 12l-3.3 3.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
        {name === "shield" ? (
          <>
            <path d="M12 3.4 5.4 6.1v5.5c0 3.8 2.6 6.2 6.6 8 4-1.8 6.6-4.2 6.6-8V6.1L12 3.4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M8.8 12.1 11 14.3 15.3 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
        {name === "network" ? (
          <>
            <circle cx="12" cy="6" r="2.15" fill="currentColor" />
            <circle cx="6.2" cy="16.6" r="2.15" fill="currentColor" />
            <circle cx="17.8" cy="16.6" r="2.15" fill="currentColor" />
            <path d="M12 8.2v3.1M7.7 15.1l2.7-3.1M16.3 15.1l-2.7-3.1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </>
        ) : null}
      </svg>
    </span>
  );
}
