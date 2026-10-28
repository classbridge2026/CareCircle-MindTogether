import type { Metadata } from "next";
import Link from "next/link";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { PATIENT_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { prisma } from "@/lib/db/prisma";
import { listScreeningCatalogue } from "@/lib/screening/service";
import "./screening.css";

export const metadata: Metadata = { title: "Screening Centre" };
export const dynamic = "force-dynamic";

const marks: Record<string, { tone: ScreenTone; icon: GlyphName }> = {
  PHQ9: { tone: "teal", icon: "mood" },
  MDQ: { tone: "indigo", icon: "bipolar" },
  ASRM: { tone: "amber", icon: "sun" },
  GAD7: { tone: "sky", icon: "anxiety" },
  PSYCHOSIS: { tone: "lilac", icon: "puzzle" },
  AD8: { tone: "sage", icon: "mind" },
  ASSIST: { tone: "coral", icon: "alert" },
  OCIR: { tone: "cyan", icon: "loop" },
  PERSONALITY: { tone: "navy", icon: "person" },
};

export default async function ScreeningCentrePage() {
  await requireStoredRoles([PATIENT_ROLE_CODE]);
  const catalogue = await listScreeningCatalogue(prisma);
  if (!catalogue.ok) return <RecordsUnavailable code={catalogue.code === "SCHEMA" ? "SCHEMA" : "UNAVAILABLE"} />;

  return (
    <div className="screen-centre">
      <div className="screen-section-head">
        <h1>Mental Health Screening Centre</h1>
        <Link href="/patient/screening/history">Screening history</Link>
      </div>
      {catalogue.registry === "missing" ? (
        <p className="screen-panel" role="status">The screening registry is not installed on this database yet, so no instrument can be started.</p>
      ) : null}
      <div className="screen-grid">
        {catalogue.cards.map((card) => {
          const mark = marks[card.code] ?? { tone: "teal" as const, icon: "mood" as const };
          return (
            <article key={card.code} className={`screen-card ${mark.tone}`}>
              <div className="screen-card-top">
                <span className={`screen-icon ${mark.tone}`} aria-hidden="true">
                  <ScreenGlyph name={mark.icon} />
                </span>
                <div>
                  <h2>{card.title}</h2>
                  <p className="screen-abbr">{card.abbreviation}</p>
                </div>
              </div>
              <p className="screen-detail">{card.detail}</p>
              <Link className={card.open ? "action" : "action quiet"} href={`/patient/screening/${card.code}`}>
                {card.open ? "Start screening" : "View status"}
                <span aria-hidden="true">›</span>
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

type ScreenTone = "teal" | "indigo" | "amber" | "sky" | "lilac" | "sage" | "coral" | "cyan" | "navy";
type GlyphName = "mood" | "bipolar" | "sun" | "anxiety" | "puzzle" | "mind" | "alert" | "loop" | "person";

function ScreenGlyph({ name }: { name: GlyphName }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "mood") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 14.5c1.1-1.2 2.2-1.8 3.5-1.8s2.4.6 3.5 1.8" />
        <path d="M9 10h.01M15 10h.01" />
      </svg>
    );
  }
  if (name === "bipolar") {
    return (
      <svg {...common}>
        <path d="M7 15a5 5 0 1 1 2.2-9.5" />
        <path d="M17 9a5 5 0 1 1-2.2 9.5" />
        <path d="M8 8l2 2M16 16l-2-2" />
      </svg>
    );
  }
  if (name === "sun") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4" />
      </svg>
    );
  }
  if (name === "anxiety") {
    return (
      <svg {...common}>
        <path d="M8 14.5c0-3 1.6-5.5 4-5.5s4 2.5 4 5.5" />
        <path d="M9 9.5c.6-2 1.7-3.2 3-3.2s2.4 1.2 3 3.2" />
        <path d="M8.5 16.5h7" />
      </svg>
    );
  }
  if (name === "puzzle") {
    return (
      <svg {...common}>
        <path d="M8 8h3.2a1.6 1.6 0 1 0 0-3.2H8V8zM13 8h3v3.2a1.6 1.6 0 1 0 3.2 0V8" />
        <path d="M8 13v3h3.2a1.6 1.6 0 1 0 0-3.2" />
        <path d="M13 16h3v-3" />
      </svg>
    );
  }
  if (name === "mind") {
    return (
      <svg {...common}>
        <path d="M9 16.5V9.2A3.2 3.2 0 0 1 12.2 6 3.2 3.2 0 0 1 15.5 9.2c1.4.3 2.5 1.6 2.5 3.1 0 1.2-.7 2.2-1.7 2.7" />
        <path d="M9 12H7.8A2.3 2.3 0 0 0 6 14.5 2.3 2.3 0 0 0 8.2 16.5" />
        <path d="M12 9.5v4" />
      </svg>
    );
  }
  if (name === "alert") {
    return (
      <svg {...common}>
        <path d="M12 5.5 19 18H5L12 5.5z" />
        <path d="M12 10v4M12 16.5h.01" />
      </svg>
    );
  }
  if (name === "loop") {
    return (
      <svg {...common}>
        <path d="M16.5 8.5A5.5 5.5 0 1 0 17 14" />
        <path d="M16.5 5.5v3.2H13.3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="9" r="2.6" />
      <path d="M7.5 17.5c.6-2.4 2.3-3.6 4.5-3.6s3.9 1.2 4.5 3.6" />
    </svg>
  );
}
