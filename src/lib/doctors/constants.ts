export const DOCTOR_INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const INVITATION_ACCEPT_RATE_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 };
export const INVITATION_RESEND_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

export const IDENTITY_DOCUMENT_SETTING = "DOCTOR_IDENTITY_DOCUMENT_REQUIRED";

export const MAX_CREDENTIAL_BYTES = 10 * 1024 * 1024;

export const ALWAYS_REQUIRED_CREDENTIALS = ["LICENSE", "DEGREE"] as const;

export const INVITE_INVALID = "This invitation link is not valid. Ask an administrator to send a new one.";

export const DOCTOR_PAGE_SIZE = 10;
