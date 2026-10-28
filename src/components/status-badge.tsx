import type { ReactNode } from "react";

const tones = {
  teal: "bg-[#e5f4f2] text-[#0b5f59]",
  amber: "bg-[#fff6e8] text-[#8a5a10]",
  red: "bg-[#fdecee] text-[#9b2330]",
  navy: "bg-[#e7eef6] text-[#12304a]",
  slate: "bg-[#eef2f6] text-[#3a4a60]",
} as const;

export function StatusBadge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function verificationBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return { label: "Approved", tone: "teal" as const };
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return { label: status === "UNDER_REVIEW" ? "Under review" : "Verification pending", tone: "amber" as const };
    case "REJECTED":
      return { label: "Rejected", tone: "red" as const };
    case "SUSPENDED":
      return { label: "Suspended", tone: "navy" as const };
    default:
      return { label: "Profile incomplete", tone: "slate" as const };
  }
}

export function accountBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", tone: "teal" as const };
    case "PENDING_VERIFICATION":
      return { label: "Invitation pending", tone: "amber" as const };
    case "SUSPENDED":
      return { label: "Suspended", tone: "navy" as const };
    default:
      return { label: "Disabled", tone: "red" as const };
  }
}

export function invitationBadge(status: string, expiresAt: Date, now = new Date()) {
  if (status === "PENDING" && expiresAt <= now) {
    return { label: "Expired", tone: "red" as const };
  }
  switch (status) {
    case "PENDING":
      return { label: "Pending", tone: "amber" as const };
    case "ACCEPTED":
      return { label: "Accepted", tone: "teal" as const };
    case "REVOKED":
      return { label: "Revoked", tone: "navy" as const };
    default:
      return { label: "Replaced", tone: "slate" as const };
  }
}

export function deliveryBadge(status: string) {
  switch (status) {
    case "SENT":
      return { label: "Sent", tone: "teal" as const };
    case "FAILED":
      return { label: "Failed", tone: "red" as const };
    default:
      return { label: "Not sent", tone: "amber" as const };
  }
}
