export class DoctorFlowError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "DoctorFlowError";
    this.code = code;
  }
}

export function isUniqueConflict(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}

export function isSchemaMismatch(error: unknown): boolean {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : "";
  return code === "P2021" || code === "P2022";
}
