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
