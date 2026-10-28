export const COUNTRIES = [
  { code: "SL", name: "Sierra Leone" },
  { code: "GN", name: "Guinea" },
  { code: "LR", name: "Liberia" },
  { code: "GH", name: "Ghana" },
  { code: "NG", name: "Nigeria" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
] as const;

export function countryName(code: string): string {
  const match = COUNTRIES.find((country) => country.code === code.trim().toUpperCase());
  return match?.name ?? code.trim().toUpperCase();
}
