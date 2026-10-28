import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { ALWAYS_REQUIRED_CREDENTIALS } from "./constants";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAdministrator(roleCodes: string[]): boolean {
  return roleCodes.includes(ADMIN_ROLE_CODE) || roleCodes.includes(SUPER_ADMIN_ROLE_CODE);
}

export type InvitationRecordState = {
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "SUPERSEDED";
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export type InvitationTokenState = "valid" | "expired" | "used" | "revoked" | "replaced" | "missing";

export function invitationTokenState(
  record: InvitationRecordState | null,
  now: Date,
): InvitationTokenState {
  if (!record) {
    return "missing";
  }
  if (record.status === "ACCEPTED" || record.acceptedAt) {
    return "used";
  }
  if (record.status === "REVOKED" || record.revokedAt) {
    return "revoked";
  }
  if (record.status === "SUPERSEDED") {
    return "replaced";
  }
  if (record.status !== "PENDING" || record.expiresAt <= now) {
    return record.expiresAt <= now ? "expired" : "missing";
  }
  return "valid";
}

export type ProfileFields = {
  fullName: string;
  displayName: string;
  phoneE164: string | null;
  email: string;
  biography: string | null;
  primarySpecialtyId: string | null;
  qualificationKind: string | null;
  qualificationTitle: string | null;
  qualificationInstitution: string | null;
  qualificationYear: number | null;
  licenseNumber: string | null;
  licenseAuthority: string | null;
  yearsExperience: number | null;
  languages: string[];
  consultationModes: string[];
};

export function profileFieldGaps(profile: ProfileFields): string[] {
  const gaps: string[] = [];
  if (profile.fullName.trim().length < 2) gaps.push("Enter the doctor's full name.");
  if (profile.displayName.trim().length < 2) gaps.push("Enter a professional display name.");
  if (!profile.phoneE164) gaps.push("Enter a phone number.");
  if (!profile.email.trim()) gaps.push("A professional email is required.");
  if (!profile.biography || profile.biography.trim().length < 40) {
    gaps.push("Enter a professional biography of at least 40 characters.");
  }
  if (!profile.primarySpecialtyId) gaps.push("Choose a primary specialty.");
  if (!profile.qualificationKind) gaps.push("Choose a qualification type.");
  if (!profile.qualificationTitle?.trim()) gaps.push("Enter the qualification.");
  if (!profile.qualificationInstitution?.trim()) gaps.push("Enter the institution that awarded the qualification.");
  if (
    profile.qualificationYear === null ||
    profile.qualificationYear < 1940 ||
    profile.qualificationYear > new Date().getUTCFullYear() + 1
  ) {
    gaps.push("Enter the qualification year.");
  }
  if (!profile.licenseNumber?.trim()) gaps.push("Enter the professional registration or licence number.");
  if (!profile.licenseAuthority?.trim()) gaps.push("Enter the licensing or registration authority.");
  if (profile.yearsExperience === null || profile.yearsExperience < 0 || profile.yearsExperience > 80) {
    gaps.push("Enter years of experience.");
  }
  if (profile.languages.length === 0) gaps.push("Enter at least one language.");
  if (profile.consultationModes.length === 0) gaps.push("Choose at least one consultation preference.");
  return gaps;
}

export type CredentialSnapshot = {
  type: string;
  status: string;
  archivedAt: Date | null;
};

function activeCredentials(credentials: CredentialSnapshot[]): CredentialSnapshot[] {
  return credentials.filter((item) => !item.archivedAt);
}

export function requiredCredentialTypes(identityRequired: boolean): string[] {
  return identityRequired
    ? [...ALWAYS_REQUIRED_CREDENTIALS, "IDENTITY_DOCUMENT"]
    : [...ALWAYS_REQUIRED_CREDENTIALS];
}

export function missingUploadedCredentials(
  credentials: CredentialSnapshot[],
  identityRequired: boolean,
): string[] {
  const active = activeCredentials(credentials);
  return requiredCredentialTypes(identityRequired).filter(
    (type) => !active.some((item) => item.type === type),
  );
}

export function missingVerifiedCredentials(
  credentials: CredentialSnapshot[],
  identityRequired: boolean,
): string[] {
  const active = activeCredentials(credentials);
  return requiredCredentialTypes(identityRequired).filter(
    (type) => !active.some((item) => item.type === type && item.status === "VERIFIED"),
  );
}

export function profileIsEditable(verificationStatus: string): boolean {
  return verificationStatus === "DRAFT" || verificationStatus === "REJECTED" || verificationStatus === "APPROVED";
}

/** Saving a draft never approves a doctor and never clears a rejection. */
export function statusAfterDraftSave(verificationStatus: string): string {
  return verificationStatus;
}

export function canSubmitProfile(verificationStatus: string): boolean {
  return verificationStatus === "DRAFT" || verificationStatus === "REJECTED" || verificationStatus === "APPROVED";
}

export type ApprovalInput = {
  actorUserId: string;
  actorRoles: string[];
  doctorUserId: string;
  verificationStatus: string;
  profile: ProfileFields;
  credentials: CredentialSnapshot[];
  identityRequired: boolean;
  primaryClaim: string | null;
};

export function approvalBlockers(input: ApprovalInput): string[] {
  const blockers: string[] = [];
  if (!isAdministrator(input.actorRoles)) {
    blockers.push("Only an administrator can approve a doctor.");
  }
  if (input.actorUserId === input.doctorUserId) {
    blockers.push("A doctor cannot approve their own profile.");
  }
  if (input.verificationStatus !== "SUBMITTED" && input.verificationStatus !== "UNDER_REVIEW") {
    blockers.push("Only a submitted application can be approved.");
  }
  blockers.push(...profileFieldGaps(input.profile));
  for (const type of missingVerifiedCredentials(input.credentials, input.identityRequired)) {
    blockers.push(`The ${credentialLabel(type).toLowerCase()} must be reviewed and verified.`);
  }
  if (input.primaryClaim !== "VERIFIED") {
    blockers.push("The primary specialty must be verified after credential review.");
  }
  return blockers;
}

export function credentialLabel(type: string): string {
  switch (type) {
    case "LICENSE":
      return "Professional licence or registration certificate";
    case "DEGREE":
      return "Medical or professional qualification certificate";
    case "SPECIALTY_CERTIFICATE":
      return "Specialist qualification certificate";
    case "IDENTITY_DOCUMENT":
      return "Identity document";
    default:
      return "Supporting professional document";
  }
}

export function canReceiveNewAppointment(input: {
  verificationStatus: string | null;
  userStatus: string | null;
  deletedAt: Date | null;
  specialtyClaim: string | null;
  specialtyActive: boolean;
}): boolean {
  if (!input.verificationStatus || !input.userStatus || input.deletedAt) {
    return false;
  }
  if (input.userStatus !== "ACTIVE") {
    return false;
  }
  if (input.verificationStatus !== "APPROVED") {
    return false;
  }
  if (input.specialtyClaim !== "VERIFIED" || !input.specialtyActive) {
    return false;
  }
  return true;
}

export function credentialDownloadDecision(input: {
  actorUserId: string | null;
  actorStatus: string | null;
  actorRoles: string[];
  doctorUserId: string;
}): "allow" | "unauthenticated" | "forbidden" {
  if (!input.actorUserId || !input.actorStatus) {
    return "unauthenticated";
  }
  if (input.actorStatus === "DISABLED") {
    return "forbidden";
  }
  if (input.actorUserId === input.doctorUserId) {
    return "allow";
  }
  if (input.actorStatus === "ACTIVE" && isAdministrator(input.actorRoles)) {
    return "allow";
  }
  return "forbidden";
}

export function canManageSpecialties(roleCodes: string[]): boolean {
  return isAdministrator(roleCodes);
}

export function specialtyDeleteDecision(counts: {
  doctors: number;
  offerings: number;
  appointments: number;
}): { allowed: boolean; message: string } {
  if (counts.doctors + counts.offerings + counts.appointments > 0) {
    return {
      allowed: false,
      message:
        "This specialty is already used by doctor profiles, services, or appointments. Deactivate it instead of deleting it.",
    };
  }
  return { allowed: true, message: "" };
}

export function credentialStorageKey(doctorProfileId: string, credentialId: string): string {
  if (!UUID_PATTERN.test(doctorProfileId) || !UUID_PATTERN.test(credentialId)) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  return `doctor-credentials/${doctorProfileId}/${credentialId}`;
}

export function invitationOutcomeMessage(input: {
  delivered: boolean;
  reason: "sent" | "not_configured" | "provider_failed";
  baseUrlMissing: boolean;
}): { emailSent: boolean; message: string } {
  if (input.delivered) {
    return {
      emailSent: true,
      message: "The doctor account was created and the invitation email was sent.",
    };
  }
  if (input.baseUrlMissing) {
    return {
      emailSent: false,
      message:
        "The doctor account was created, but the invitation email was not sent because APP_BASE_URL is not configured. Resend the invitation after setting it.",
    };
  }
  if (input.reason === "provider_failed") {
    return {
      emailSent: false,
      message:
        "The doctor account was created, but the invitation email was not sent because the email provider did not accept it. Resend the invitation from Invitation Management.",
    };
  }
  return {
    emailSent: false,
    message:
      "The doctor account was created, but the invitation email was not sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM, then resend the invitation from Invitation Management.",
  };
}

export function resendOutcomeMessage(input: {
  delivered: boolean;
  reason: "sent" | "not_configured" | "provider_failed";
  baseUrlMissing: boolean;
}): string {
  if (input.delivered) {
    return "A new invitation email was sent. The previous link no longer works.";
  }
  if (input.baseUrlMissing) {
    return "A new invitation was not sent because APP_BASE_URL is not configured.";
  }
  if (input.reason === "provider_failed") {
    return "A new invitation was not sent because the email provider did not accept it. The previous link no longer works.";
  }
  return "A new invitation was not sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM, then try again. The previous link no longer works.";
}

export function credentialUploadFailureMessage(reason: "not_configured" | "provider_failed" | "invalid"): string {
  if (reason === "not_configured") {
    return "The document was not stored. Private storage is not configured. Set STORAGE_PROVIDER and the matching storage settings, then upload again.";
  }
  if (reason === "provider_failed") {
    return "The document was not stored because private storage did not accept it. Nothing was marked as uploaded.";
  }
  return "The document was not stored.";
}

export function onboardingSteps(input: {
  accountActive: boolean;
  profileComplete: boolean;
  credentialsReady: boolean;
  submitted: boolean;
}): Array<{ id: string; label: string; complete: boolean }> {
  return [
    { id: "account", label: "Accept invitation and set a password", complete: input.accountActive },
    { id: "profile", label: "Complete the professional profile", complete: input.profileComplete },
    { id: "credentials", label: "Upload required credentials", complete: input.credentialsReady },
    { id: "review", label: "Submit for administrator review", complete: input.submitted },
  ];
}

const EDITABLE_CREDENTIAL_STATUSES = new Set(["DRAFT", "REJECTED", "APPROVED"]);

export function credentialMutationAllowed(verificationStatus: string): boolean {
  return EDITABLE_CREDENTIAL_STATUSES.has(verificationStatus);
}

export function canDeleteCredential(input: {
  owner: boolean;
  status: string;
  reviewedAt: Date | null;
  archivedAt: Date | null;
}): { allowed: boolean; message: string } {
  if (!input.owner) {
    return { allowed: false, message: "You can only remove your own documents." };
  }
  if (input.archivedAt) {
    return { allowed: false, message: "This document is already archived." };
  }
  if (input.reviewedAt || input.status !== "PENDING") {
    return {
      allowed: false,
      message: "A reviewed document stays on the record. Upload a replacement if you need to provide another file.",
    };
  }
  return { allowed: true, message: "" };
}

export function canVerifySpecialty(input: {
  actorUserId: string;
  actorRoles: string[];
  doctorUserId: string;
  verifiedCredentialCount: number;
}): string | null {
  if (!isAdministrator(input.actorRoles)) {
    return "Only an administrator can verify a specialty.";
  }
  if (input.actorUserId === input.doctorUserId) {
    return "A doctor cannot verify their own specialty.";
  }
  if (input.verifiedCredentialCount < 1) {
    return "Verify a qualification or licence before marking a specialty as verified.";
  }
  return null;
}
