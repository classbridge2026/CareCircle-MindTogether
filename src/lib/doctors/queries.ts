import type { Prisma, PrismaClient } from "@prisma/client";
import { DOCTOR_PAGE_SIZE } from "./constants";
import { isSchemaMismatch } from "./errors";

export type DoctorListFilters = {
  q?: string;
  verification?: string;
  account?: string;
  page?: number;
  pendingOnly?: boolean;
};

const credentialSelect = {
  id: true,
  type: true,
  status: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  issuedOn: true,
  expiresOn: true,
  reviewedAt: true,
  reviewNotes: true,
  archivedAt: true,
  createdAt: true,
} satisfies Prisma.DoctorCredentialSelect;

export async function loadDoctorOverview(db: PrismaClient) {
  try {
    const now = new Date();
    const visible = { user: { deletedAt: null } };
    const [total, grouped, approvedActive, suspended, invitationPending, rejected] = await Promise.all([
      db.doctorProfile.count({ where: visible }),
      db.doctorProfile.groupBy({ by: ["verificationStatus"], where: visible, _count: { _all: true } }),
      db.doctorProfile.count({ where: { verificationStatus: "APPROVED", user: { status: "ACTIVE", deletedAt: null } } }),
      db.doctorProfile.count({
        where: { user: { deletedAt: null }, OR: [{ verificationStatus: "SUSPENDED" }, { user: { status: "SUSPENDED" } }] },
      }),
      db.doctorInvitation.count({ where: { status: "PENDING", expiresAt: { gt: now }, doctor: { user: { deletedAt: null } } } }),
      db.doctorProfile.count({ where: { verificationStatus: "REJECTED", user: { deletedAt: null } } }),
    ]);
    const pendingVerification = grouped
      .filter((row) => row.verificationStatus === "SUBMITTED" || row.verificationStatus === "UNDER_REVIEW")
      .reduce((sum, row) => sum + row._count._all, 0);
    return {
      ok: true as const,
      counts: { total, pendingVerification, approvedActive, rejected, suspended, invitationPending },
      verification: grouped.map((row) => ({ status: row.verificationStatus, count: row._count._all })),
    };
  } catch (error) {
    if (isSchemaMismatch(error)) {
      return { ok: false as const, code: "SCHEMA" as const };
    }
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }
}

const VERIFICATION_VALUES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"] as const;
const ACCOUNT_VALUES = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "DISABLED"] as const;

function verificationFilter(value: string | undefined): Prisma.DoctorProfileWhereInput | null {
  if (!value || value === "ALL") return null;
  if (!VERIFICATION_VALUES.includes(value as (typeof VERIFICATION_VALUES)[number])) return null;
  return { verificationStatus: value as (typeof VERIFICATION_VALUES)[number] };
}

export async function loadDoctors(db: PrismaClient, filters: DoctorListFilters) {
  const page = filters.page && filters.page > 0 ? Math.floor(filters.page) : 1;
  const q = (filters.q ?? "").trim().slice(0, 80);
  const where: Prisma.DoctorProfileWhereInput = {};
  const and: Prisma.DoctorProfileWhereInput[] = [{ user: { deletedAt: null } }];
  if (q) {
    and.push({
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { user: { emailNormalized: { contains: q.toLowerCase() } } },
      ],
    });
  }
  if (filters.pendingOnly) {
    and.push({ verificationStatus: { in: ["SUBMITTED", "UNDER_REVIEW"] } });
  } else {
    const verification = verificationFilter(filters.verification);
    if (verification) and.push(verification);
  }
  if (ACCOUNT_VALUES.includes(filters.account as (typeof ACCOUNT_VALUES)[number])) {
    and.push({ user: { status: filters.account as (typeof ACCOUNT_VALUES)[number] } });
  }
  if (and.length) where.AND = and;

  try {
    const [total, rows] = await Promise.all([
      db.doctorProfile.count({ where }),
      db.doctorProfile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * DOCTOR_PAGE_SIZE,
        take: DOCTOR_PAGE_SIZE,
        select: {
          id: true,
          fullName: true,
          displayName: true,
          verificationStatus: true,
          createdAt: true,
          biography: true,
          qualificationTitle: true,
          yearsExperience: true,
          user: { select: { id: true, email: true, status: true, phoneE164: true, profileImageUpdatedAt: true } },
          specialties: { select: { isPrimary: true, claimStatus: true, specialty: { select: { name: true } } } },
        },
      }),
    ]);
    return { ok: true as const, rows, total, page, pageSize: DOCTOR_PAGE_SIZE, q };
  } catch (error) {
    if (isSchemaMismatch(error)) return { ok: false as const, code: "SCHEMA" as const };
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }
}

export async function loadDoctorDetail(db: PrismaClient, id: string) {
  try {
    const doctor = await db.doctorProfile.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        fullName: true,
        displayName: true,
        biography: true,
        yearsExperience: true,
        qualificationKind: true,
        qualificationTitle: true,
        qualificationInstitution: true,
        qualificationYear: true,
        licenseNumberNormalized: true,
        licenseJurisdiction: true,
        licenseExpiresOn: true,
        languages: true,
        consultationModes: true,
        verificationStatus: true,
        submittedAt: true,
        verifiedAt: true,
        rejectedAt: true,
        suspendedAt: true,
        rejectionReason: true,
        correctionNotes: true,
        returnedAt: true,
        suspensionReason: true,
        createdAt: true,
        user: { select: { id: true, email: true, phoneE164: true, status: true, emailVerifiedAt: true, createdAt: true, deletedAt: true, profileImageUpdatedAt: true } },
        specialties: {
          select: {
            id: true,
            isPrimary: true,
            claimStatus: true,
            verifiedAt: true,
            specialty: { select: { id: true, name: true, code: true, isActive: true } },
          },
        },
        credentials: { select: credentialSelect, orderBy: { createdAt: "desc" } },
        verificationEvents: { orderBy: { occurredAt: "desc" }, take: 30 },
        invitations: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            deliveryStatus: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!doctor) return { ok: false as const, code: "NOT_FOUND" as const };
    return { ok: true as const, doctor };
  } catch (error) {
    if (isSchemaMismatch(error)) return { ok: false as const, code: "SCHEMA" as const };
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }
}

export async function loadInvitations(db: PrismaClient) {
  try {
    const rows = await db.doctorInvitation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        emailNormalized: true,
        status: true,
        deliveryStatus: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        doctor: { select: { id: true, fullName: true } },
      },
    });
    return { ok: true as const, rows };
  } catch (error) {
    if (isSchemaMismatch(error)) return { ok: false as const, code: "SCHEMA" as const };
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }
}

export { loadSpecialties } from "@/lib/catalog/queries";

export async function loadOwnDoctor(db: PrismaClient, userId: string) {
  return db.doctorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      fullName: true,
      displayName: true,
      biography: true,
      yearsExperience: true,
      qualificationKind: true,
      qualificationTitle: true,
      qualificationInstitution: true,
      qualificationYear: true,
      licenseNumberNormalized: true,
      licenseJurisdiction: true,
      licenseExpiresOn: true,
      languages: true,
      consultationModes: true,
      verificationStatus: true,
      rejectionReason: true,
      correctionNotes: true,
      submittedAt: true,
      user: { select: { email: true, phoneE164: true, status: true, emailVerifiedAt: true } },
      specialties: {
        select: { specialtyId: true, isPrimary: true, claimStatus: true, specialty: { select: { name: true, isActive: true } } },
      },
      credentials: { select: credentialSelect, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function loadCredentialForReview(db: PrismaClient, credentialId: string) {
  return db.doctorCredential.findUnique({
    where: { id: credentialId },
    select: {
      ...credentialSelect,
      doctorProfileId: true,
      doctor: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          verificationStatus: true,
        },
      },
    },
  });
}
