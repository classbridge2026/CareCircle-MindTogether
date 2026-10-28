"use client";

import { useEffect, useState } from "react";
import { AdminIcon } from "@/components/admin/admin-icons";
import { primaryButtonClass, textInputClass } from "@/components/form-classes";
import { updateScreeningGovernanceAction } from "./actions";

export type ScreeningToolRow = {
  id: string;
  name: string;
  abbreviation: string;
  category: string;
  purpose: string;
  language: string;
  expectedMinutes: number | null;
  intendedPopulation: string;
  instructions: string;
  sourceReference: string;
  safetyProtocolRequired: boolean;
  safetyProtocolApproved: boolean;
  contactsConfigured: boolean;
  availability: string;
  approvalState: string;
  licenseStatus: string;
  version: string;
  versionWhen: string;
  scoringAlgorithmVersion: string | null;
  blockers: string[];
};

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

export function ScreeningTable({ tools, canGovern }: { tools: ScreeningToolRow[]; canGovern: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const tool = tools.find((item) => item.id === openId) ?? null;

  return (
    <>
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
              {tools.map((item) => (
                <tr key={item.id} className="hover:bg-[#f3f8fc]">
                  <td className={`${bodyCell} border-t border-brand-line font-semibold text-brand-navy`}>{item.name}<div className="font-normal text-brand-muted">{item.abbreviation}</div></td>
                  <td className={`${bodyCell} border-t border-brand-line`}>{label(item.category)}</td>
                  <td className={`${bodyCell} border-t border-brand-line`}>{item.version}</td>
                  <td className={`${bodyCell} border-t border-brand-line`}><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass(item.approvalState)}`}>{label(item.approvalState)}</span></td>
                  <td className={`${bodyCell} border-t border-brand-line`}><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass(item.licenseStatus)}`}>{label(item.licenseStatus)}</span></td>
                  <td className={`${bodyCell} border-t border-brand-line`}><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass(item.availability)}`}>{label(item.availability)}</span></td>
                  <td className={`${bodyCell} border-t border-brand-line`}>
                    <button type="button" className="font-semibold text-brand-teal" onClick={() => setOpenId(item.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {tool ? <ToolDialog tool={tool} canGovern={canGovern} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function ToolDialog({ tool, canGovern, onClose }: { tool: ScreeningToolRow; canGovern: boolean; onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="user-modal screen-dialog" role="dialog" aria-modal="true" aria-labelledby="screening-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="screen-dialog-head">
          <div>
            <p className="screen-dialog-kicker">{tool.abbreviation}</p>
            <h2 id="screening-dialog-title">{tool.name}</h2>
            <p className="screen-dialog-purpose">{tool.purpose}</p>
            <div className="screen-dialog-chips">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass(tool.approvalState)}`}>{label(tool.approvalState)}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass(tool.licenseStatus)}`}>{label(tool.licenseStatus)}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${chipClass(tool.availability)}`}>{label(tool.availability)}</span>
            </div>
          </div>
          <button type="button" className="screen-dialog-close" aria-label="Close" onClick={onClose}>
            <AdminIcon name="close" />
          </button>
        </header>
        <div className="screen-dialog-body">
          <dl className="screen-facts">
            <div className="screen-fact"><dt>Category</dt><dd className="capitalize">{label(tool.category)}</dd></div>
            <div className="screen-fact"><dt>Language</dt><dd>{tool.language}</dd></div>
            <div className="screen-fact"><dt>Expected time</dt><dd>{tool.expectedMinutes ? `${tool.expectedMinutes} minutes` : "Not recorded"}</dd></div>
            <div className="screen-fact"><dt>Current version</dt><dd>{tool.version} · {tool.versionWhen}</dd></div>
            <div className="screen-fact"><dt>Safety protocol required</dt><dd>{tool.safetyProtocolRequired ? "Yes" : "No"}</dd></div>
            <div className="screen-fact"><dt>Safety protocol approved</dt><dd>{tool.safetyProtocolApproved ? "Yes" : "No"}</dd></div>
            <div className="screen-fact"><dt>Support contacts</dt><dd>{tool.contactsConfigured ? "Configured" : "Not configured"}</dd></div>
            <div className="screen-fact"><dt>Scoring algorithm</dt><dd>{tool.scoringAlgorithmVersion ?? "Not recorded"}</dd></div>
            <div className="screen-fact wide"><dt>Intended population</dt><dd>{tool.intendedPopulation}</dd></div>
            <div className="screen-fact wide"><dt>Instructions</dt><dd>{tool.instructions}</dd></div>
            <div className="screen-fact wide"><dt>Source and licensing note</dt><dd>{tool.sourceReference}</dd></div>
          </dl>
          {canGovern ? (
            <form key={`${tool.id}:${tool.licenseStatus}:${tool.approvalState}`} action={updateScreeningGovernanceAction} className="screen-dialog-form">
              <h3>Clinical and licensing status</h3>
              <p>A super administrator can record approval status. That does not install questions or scoring rules, and it does not force the instrument active.</p>
              <input name="toolId" type="hidden" value={tool.id} />
              <div className="screen-dialog-fields">
                <label>
                  Licensing status
                  <select name="licenseStatus" defaultValue={tool.licenseStatus} className={textInputClass}>
                    <option value="NOT_REVIEWED">Not reviewed</option>
                    <option value="RESTRICTION_UNRESOLVED">Restriction unresolved</option>
                    <option value="CLEARED_FOR_CLINICAL_USE">Cleared for clinical use</option>
                    <option value="PROHIBITED">Prohibited</option>
                  </select>
                </label>
                <label>
                  Clinical approval
                  <select name="approvalState" defaultValue={tool.approvalState} className={textInputClass}>
                    <option value="PENDING_CLINICAL_REVIEW">Pending clinical review</option>
                    <option value="CLINICALLY_APPROVED">Clinically approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="RETIRED">Retired</option>
                  </select>
                </label>
              </div>
              <button className={`${primaryButtonClass} w-fit`} type="submit">Save status</button>
            </form>
          ) : (
            <p className="screen-dialog-note">Ordinary administrators can review this registry. Changing approval or licensing status requires a super administrator.</p>
          )}
        </div>
      </div>
    </div>
  );
}
