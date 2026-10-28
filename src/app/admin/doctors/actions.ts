"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE } from "@/lib/auth/constants";
import { requireStoredRoles } from "@/lib/auth/require-role";
import { accountBadge, deliveryBadge, invitationBadge, verificationBadge } from "@/components/status-badge";
import { appointmentStatusLabel, formatPlatformWhen, type BadgeTone } from "@/lib/admin/labels";
import { prisma } from "@/lib/db/prisma";
import { closeDoctorRecord, updateDoctorRecord } from "@/lib/doctors/directory-records";
import { identityDocumentRequired } from "@/lib/doctors/profile";
import { loadDoctorDetail } from "@/lib/doctors/queries";
import { approvalBlockers, credentialLabel } from "@/lib/doctors/rules";
import {
  approveDoctor,
  completeDoctorProfile,
  listOpenAppointments,
  reactivateDoctor,
  rejectDoctor,
  returnDoctorForCorrections,
  reviewCredential,
  suspendDoctor,
  unverifyDoctorProfile,
  verifyDoctorSpecialty,
} from "@/lib/doctors/verification";
import { QUALIFICATION_LABELS } from "@/lib/validation/doctor";

export type AdminActionState = { message?: string; tone?: "ok" | "error" };

async function actor() {
  const user = await requireStoredRoles([ADMIN_ROLE_CODE, SUPER_ADMIN_ROLE_CODE]);
  return { userId: user.id, roleCodes: user.roleCodes };
}

function finish(doctorId: string, result: { ok: boolean; message: string }): AdminActionState {
  revalidatePath("/admin/doctors");
  revalidatePath("/admin/doctors/all");
  revalidatePath("/admin/doctors/pending");
  revalidatePath(`/admin/doctors/${doctorId}`);
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function approveDoctorAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorProfileId") ?? "");
  const result = await approveDoctor(doctorId, { db: prisma, actor: await actor(), now: new Date() });
  return finish(doctorId, result);
}

export async function rejectDoctorAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorProfileId") ?? "");
  const result = await rejectDoctor(doctorId, String(formData.get("reason") ?? ""), {
    db: prisma,
    actor: await actor(),
    now: new Date(),
  });
  return finish(doctorId, result);
}

export async function returnDoctorAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorProfileId") ?? "");
  const result = await returnDoctorForCorrections(doctorId, String(formData.get("notes") ?? ""), {
    db: prisma,
    actor: await actor(),
    now: new Date(),
  });
  return finish(doctorId, result);
}

export async function suspendDoctorAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorProfileId") ?? "");
  const result = await suspendDoctor(doctorId, String(formData.get("reason") ?? ""), {
    db: prisma,
    actor: await actor(),
    now: new Date(),
  });
  return finish(doctorId, result);
}

export async function reactivateDoctorAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorProfileId") ?? "");
  const result = await reactivateDoctor(doctorId, { db: prisma, actor: await actor(), now: new Date() });
  return finish(doctorId, result);
}

export async function completeDoctorAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorProfileId") ?? "");
  const result = await completeDoctorProfile(doctorId, String(formData.get("note") ?? ""), {
    db: prisma,
    actor: await actor(),
    now: new Date(),
  });
  return finish(doctorId, result);
}

export async function unverifyDoctorAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorProfileId") ?? "");
  const result = await unverifyDoctorProfile(doctorId, String(formData.get("note") ?? ""), {
    db: prisma,
    actor: await actor(),
    now: new Date(),
  });
  return finish(doctorId, result);
}

export async function verifySpecialtyAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorProfileId") ?? "");
  const result = await verifyDoctorSpecialty(String(formData.get("doctorSpecialtyId") ?? ""), {
    db: prisma,
    actor: await actor(),
    now: new Date(),
  });
  return finish(doctorId, result);
}

function saved(result: { ok: boolean; message: string }, doctorId: string): AdminActionState {
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath("/admin/doctors");
    revalidatePath("/admin/doctors/all");
    revalidatePath("/admin/doctors/pending");
    revalidatePath(`/admin/doctors/${doctorId}`);
  }
  return { message: result.message, tone: result.ok ? "ok" : "error" };
}

export async function updateDoctorAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorId") ?? "");
  const result = await updateDoctorRecord(
    {
      doctorId,
      fullName: String(formData.get("fullName") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      qualificationTitle: String(formData.get("qualificationTitle") ?? ""),
      yearsExperience: String(formData.get("yearsExperience") ?? ""),
      biography: String(formData.get("biography") ?? ""),
    },
    { db: prisma, actor: await actor() },
  );
  return saved(result, doctorId);
}

export async function deleteDoctorAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorId") ?? "");
  const result = await closeDoctorRecord({ doctorId }, { db: prisma, actor: await actor() });
  return saved(result, doctorId);
}

export type DoctorReviewView = {
  id: string;
  userId: string;
  imageVersion: string | null;
  fullName: string;
  displayName: string;
  email: string;
  phone: string | null;
  biography: string;
  qualificationTitle: string;
  yearsExperience: string;
  qualification: string;
  institution: string;
  qualificationYear: string;
  licenseNumber: string;
  licenseAuthority: string;
  licenseExpiry: string;
  experience: string;
  languages: string;
  consultation: string;
  verificationLabel: string;
  verificationTone: BadgeTone;
  accountLabel: string;
  accountTone: BadgeTone;
  reviewNote: string;
  rejectionReason: string | null;
  correctionNotes: string | null;
  suspensionReason: string | null;
  specialties: Array<{ id: string; name: string; claimLabel: string; claimTone: BadgeTone; primary: boolean; inactive: boolean }>;
  credentials: Array<{ id: string; label: string; detail: string }>;
  appointments: Array<{ id: string; label: string }>;
  events: Array<{ id: string; label: string; reason: string | null }>;
  invitations: Array<{ id: string; statusLabel: string; statusTone: BadgeTone; deliveryLabel: string; deliveryTone: BadgeTone; expiresLabel: string }>;
  canManage: boolean;
  decisions: {
    canDecide: boolean;
    canComplete: boolean;
    canUnverify: boolean;
    canSuspend: boolean;
    canReactivate: boolean;
    blockers: string[];
    specialties: Array<{ id: string; name: string; claimStatus: string }>;
  };
};

function when(value: Date | null): string {
  return value ? formatPlatformWhen(value) : "Not recorded";
}

export async function readDoctorReview(doctorId: string): Promise<{ ok: true; doctor: DoctorReviewView } | { ok: false; message: string }> {
  const current = await actor();
  const result = await loadDoctorDetail(prisma, doctorId);
  if (!result.ok) {
    return { ok: false, message: result.code === "NOT_FOUND" ? "This doctor is no longer available." : "Doctor details are unavailable right now." };
  }
  const doctor = result.doctor;
  if (doctor.user.deletedAt) return { ok: false, message: "This doctor is no longer available." };
  const verification = verificationBadge(doctor.verificationStatus);
  const account = accountBadge(doctor.user.status);
  const appointments = await listOpenAppointments(prisma, doctor.id);
  const canDecide = doctor.verificationStatus === "SUBMITTED" || doctor.verificationStatus === "UNDER_REVIEW";
  const canSuspend = doctor.verificationStatus === "APPROVED" && doctor.user.status === "ACTIVE";
  const canReactivate = doctor.verificationStatus === "SUSPENDED" && doctor.user.status === "SUSPENDED";
  const qualification =
    doctor.qualificationKind && doctor.qualificationKind in QUALIFICATION_LABELS
      ? QUALIFICATION_LABELS[doctor.qualificationKind as keyof typeof QUALIFICATION_LABELS]
      : "Not recorded";
  const primary = doctor.specialties.find((item) => item.isPrimary);
  const identityRequired = await identityDocumentRequired(prisma);
  const blockers = canDecide
    ? approvalBlockers({
        actorUserId: current.userId,
        actorRoles: current.roleCodes,
        doctorUserId: doctor.userId,
        verificationStatus: doctor.verificationStatus,
        profile: {
          fullName: doctor.fullName,
          displayName: doctor.displayName,
          phoneE164: doctor.user.phoneE164,
          email: doctor.user.email,
          biography: doctor.biography,
          primarySpecialtyId: primary?.specialty.id ?? null,
          qualificationKind: doctor.qualificationKind,
          qualificationTitle: doctor.qualificationTitle,
          qualificationInstitution: doctor.qualificationInstitution,
          qualificationYear: doctor.qualificationYear,
          licenseNumber: doctor.licenseNumberNormalized,
          licenseAuthority: doctor.licenseJurisdiction,
          yearsExperience: doctor.yearsExperience,
          languages: doctor.languages,
          consultationModes: doctor.consultationModes,
        },
        credentials: doctor.credentials,
        identityRequired,
        primaryClaim: primary?.claimStatus ?? null,
      }).filter((blocker) => blocker !== "Only an administrator can approve a doctor.")
    : [];
  const patientsCanView =
    doctor.verificationStatus === "APPROVED" &&
    doctor.user.status === "ACTIVE" &&
    doctor.specialties.some((item) => item.claimStatus === "VERIFIED" && item.specialty.isActive);
  const reviewNote = patientsCanView
    ? "Patients can open this profile from Find a doctor."
    : doctor.verificationStatus === "APPROVED"
      ? "This profile is approved. Patients can view it when the account is active and a specialty stays verified."
      : doctor.verificationStatus === "SUBMITTED" || doctor.verificationStatus === "UNDER_REVIEW"
        ? "This is the profile the doctor submitted. Approve it so patients can view the doctor, or decline it to keep the profile hidden."
        : doctor.verificationStatus === "REJECTED"
          ? "This profile was not approved. Patients cannot view this doctor."
          : doctor.verificationStatus === "SUSPENDED"
            ? "This doctor is suspended. Patients cannot view this profile."
            : "This profile is incomplete, so patients cannot see this doctor. Verify it with a review note to approve the profile and the primary specialty.";
  const consultation =
    doctor.consultationModes.map((mode) => (mode === "ONLINE" ? "Online" : mode === "IN_PERSON" ? "In person" : mode)).join(", ") || "Not recorded";
  return {
    ok: true,
    doctor: {
      id: doctor.id,
      userId: doctor.user.id,
      imageVersion: doctor.user.profileImageUpdatedAt?.toISOString() ?? null,
      fullName: doctor.fullName,
      displayName: doctor.displayName,
      email: doctor.user.email,
      phone: doctor.user.phoneE164,
      biography: doctor.biography ?? "",
      qualificationTitle: doctor.qualificationTitle ?? "",
      yearsExperience: doctor.yearsExperience === null ? "" : String(doctor.yearsExperience),
      qualification,
      institution: doctor.qualificationInstitution ?? "Not recorded",
      qualificationYear: doctor.qualificationYear ? String(doctor.qualificationYear) : "Not recorded",
      licenseNumber: doctor.licenseNumberNormalized ?? "Not recorded",
      licenseAuthority: doctor.licenseJurisdiction ?? "Not recorded",
      licenseExpiry: doctor.licenseExpiresOn ? doctor.licenseExpiresOn.toISOString().slice(0, 10) : "Not recorded",
      experience: doctor.yearsExperience === null ? "Not recorded" : String(doctor.yearsExperience),
      languages: doctor.languages.join(", ") || "Not recorded",
      consultation,
      verificationLabel: verification.label,
      verificationTone: verification.tone,
      accountLabel: account.label,
      accountTone: account.tone,
      reviewNote,
      rejectionReason: doctor.rejectionReason,
      correctionNotes: doctor.correctionNotes,
      suspensionReason: doctor.suspensionReason,
      specialties: doctor.specialties.map((item) => ({
        id: item.id,
        name: item.specialty.name,
        claimLabel: item.claimStatus === "VERIFIED" ? "Verified" : item.claimStatus === "REJECTED" ? "Rejected" : "Declared",
        claimTone: item.claimStatus === "VERIFIED" ? "teal" : item.claimStatus === "REJECTED" ? "red" : "slate",
        primary: item.isPrimary,
        inactive: !item.specialty.isActive,
      })),
      credentials: doctor.credentials.map((credential) => ({
        id: credential.id,
        label: credentialLabel(credential.type),
        detail: `${credential.originalFilename ?? "Document"} · ${credential.status}${credential.archivedAt ? " · Archived" : ""}`,
      })),
      appointments: appointments.map((appointment) => ({
        id: appointment.id,
        label: `${formatPlatformWhen(appointment.startsAt)} · ${appointment.mode === "ONLINE" ? "Online" : appointment.mode === "IN_PERSON" ? "In person" : appointment.mode} · ${appointmentStatusLabel(appointment.status)}`,
      })),
      events: doctor.verificationEvents.map((event) => ({
        id: event.id,
        label: `${event.action} · ${formatPlatformWhen(event.occurredAt)}`,
        reason: event.reason,
      })),
      invitations: doctor.invitations.map((invitation) => {
        const badge = invitationBadge(invitation.status, invitation.expiresAt);
        const delivery = deliveryBadge(invitation.deliveryStatus);
        return {
          id: invitation.id,
          statusLabel: badge.label,
          statusTone: badge.tone,
          deliveryLabel: delivery.label,
          deliveryTone: delivery.tone,
          expiresLabel: `Expires ${formatPlatformWhen(invitation.expiresAt)}`,
        };
      }),
      canManage: current.userId !== doctor.userId,
      decisions: {
        canDecide,
        canComplete: !patientsCanView && doctor.verificationStatus !== "SUSPENDED" && doctor.user.status !== "SUSPENDED" && doctor.user.status !== "DISABLED" && current.userId !== doctor.userId,
        canUnverify: doctor.verificationStatus === "APPROVED" && current.userId !== doctor.userId,
        canSuspend,
        canReactivate,
        blockers,
        specialties: doctor.specialties.map((item) => ({ id: item.id, name: item.specialty.name, claimStatus: item.claimStatus })),
      },
    },
  };
}

export async function reviewCredentialAction(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const doctorId = String(formData.get("doctorProfileId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "VERIFIED" && decision !== "REJECTED") {
    return { message: "Choose whether to verify or reject this document.", tone: "error" };
  }
  const result = await reviewCredential(String(formData.get("credentialId") ?? ""), decision, String(formData.get("notes") ?? ""), {
    db: prisma,
    actor: await actor(),
    now: new Date(),
  });
  revalidatePath(`/admin/doctors/${doctorId}/credentials/${String(formData.get("credentialId") ?? "")}`);
  return finish(doctorId, result);
}
