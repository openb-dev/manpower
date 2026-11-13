export const NK_LOGO_SRC = "/nk-logo.png";

export function isNkCompany(slug?: string | null) {
  return String(slug || "").toLowerCase() === "nk";
}
