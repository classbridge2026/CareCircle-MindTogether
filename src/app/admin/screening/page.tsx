import type { Metadata } from "next";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { AdminIcon, type AdminIconName } from "@/components/admin/admin-icons";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { formatPlatformWhen } from "@/lib/admin/labels";
import { prisma } from "@/lib/db/prisma";
import { SCREENING_CANDIDATES } from "@/lib/screening/catalog";
import { SCREENING_SAFETY_SETTING, governanceChangeAllowed, parseSafetyContacts } from "@/lib/screening/rules";
import { listAdminRegistry } from "@/lib/screening/service";
import { ScreeningTable } from "./screening-table";
import { SupportContactForm } from "./support-contact-form";

export const metadata: Metadata = { title: "Screening management" };
export const dynamic = "force-dynamic";

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function chipClass(value: string) {
  if (value === "ACTIVE" || value === "CLINICALLY_APPROVED" || value === "CLEARED_FOR_CLINICAL_USE") {
    return "bg-[#e7f6f4] text-[#0f766e]";
  }
  if (value === "RETIRED" || value === "REJECTED" || value === "PROHIBITED") {
    return "bg-[#fdecec] text-[#9b2330]";
  }
  return "bg-[#fff6e8] text-[#9a6700]";
}

const headCell = "bg-[#0C2B45] px-4 py-3 text-left text-[0.68rem] font-semibold tracking-[0.06em] text-white uppercase";
const bodyCell = "px-4 py-3 text-brand-ink";

export default async function AdminScreeningPage() {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  const registry = await listAdminRegistry(prisma);
  const contactRow = await prisma.platformSetting.findUnique({ where: { key: SCREENING_SAFETY_SETTING }, select: { valueJson: true } }).catch(() => null);
  const contact = parseSafetyContacts(contactRow?.valueJson ?? null);
  const supportLine = contact?.lines[0];
  if (!registry.ok && registry.code !== "SCHEMA") return <RecordsUnavailable code="UNAVAILABLE" />;
  const tools = registry.ok
    ? registry.tools.map((tool) => {
        const version = tool.versions[0];
        return {
          id: tool.id,
          name: tool.name,
          abbreviation: tool.abbreviation,
          category: tool.category,
          purpose: tool.purpose,
          language: tool.language,
          expectedMinutes: tool.expectedMinutes,
          intendedPopulation: tool.intendedPopulation,
          instructions: tool.instructions,
          sourceReference: tool.sourceReference,
          safetyProtocolRequired: tool.safetyProtocolRequired,
          safetyProtocolApproved: tool.safetyProtocolApproved,
          contactsConfigured: registry.contactsConfigured,
          availability: tool.availability,
          approvalState: tool.approvalState,
          licenseStatus: tool.licenseStatus,
          version: version?.version ?? "—",
          versionWhen: version ? formatPlatformWhen(version.createdAt) : "Not recorded",
          scoringAlgorithmVersion: version?.scoringAlgorithmVersion ?? null,
          blockers: tool.blockers,
        };
      })
    : [];

  return (
    <section className="grid gap-5">
      <header>
        <h1 className="text-2xl font-semibold text-brand-navy">Screening management</h1>
      </header>
      <SupportContactForm region={contact?.region ?? ""} serviceName={supportLine?.label ?? ""} phone={supportLine?.value ?? ""} />
      {registry.ok ? (
        <section className="screen-stats" aria-label="Screening totals">
          <Stat tone="#12304a" icon="screening" label="Instruments" value={registry.stats.instruments} note="Full registry" />
          <Stat tone="#0f766e" icon="check" label="Available to patients" value={registry.stats.active} note="Open to start" />
          <Stat tone="#1d4ed8" icon="audit" label="Assessments completed" value={registry.stats.submitted} note="Submitted screens" />
          <Stat tone="#9a6700" icon="clock" label="Pending clinical review" value={registry.stats.pendingReview} note="Waiting for a clinician" />
        </section>
      ) : (
        <p className="rounded-2xl border border-brand-line bg-white p-4 text-sm" role="status">The screening registry migration has not been applied, so instruments cannot be activated.</p>
      )}
      {registry.ok ? (
        <ScreeningTable tools={tools} canGovern={governanceChangeAllowed(user.roleCodes)} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-line bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  {["Name", "Category", "Version", "Approval", "License", "Status", "Actions"].map((heading) => (
                    <th key={heading} className={headCell} scope="col">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCREENING_CANDIDATES.map((tool) => (
                  <tr key={tool.code} className="hover:bg-[#f3f8fc]">
                    <td className={`${bodyCell} border-t border-brand-line font-semibold text-brand-navy`}>{tool.title}<div className="font-normal text-brand-muted">{tool.abbreviation}</div></td>
                    <td className={`${bodyCell} border-t border-brand-line`}>{label(tool.category)}</td>
                    <td className={`${bodyCell} border-t border-brand-line`}>—</td>
                    <td className={`${bodyCell} border-t border-brand-line`}><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass("PENDING_CLINICAL_REVIEW")}`}>pending clinical review</span></td>
                    <td className={`${bodyCell} border-t border-brand-line`}><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass("NOT_REVIEWED")}`}>not reviewed</span></td>
                    <td className={`${bodyCell} border-t border-brand-line`}><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass("INACTIVE")}`}>inactive</span></td>
                    <td className={`${bodyCell} border-t border-brand-line text-brand-muted`}>Unavailable</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ tone, icon, label, value, note }: { tone: string; icon: AdminIconName; label: string; value: number; note: string }) {
  return (
    <article className="stat-card screen-stat" style={{ ["--stat" as string]: tone }}>
      <span className="stat-card-icon">
        <AdminIcon name={icon} />
      </span>
      <span className="stat-card-copy">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
        <span className="stat-card-note">{note}</span>
      </span>
    </article>
  );
}
