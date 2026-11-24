import { Role } from "@prisma/client";
import { isCompanyOfficeRole, isSuperAdminRole } from "@/lib/officeRoles";

/** User may enter this company's admin area. */
export function canEnterCompany(user: { role?: string | null; companyId?: string | null }, companyId: string) {
  if (!user?.role) return false;
  if (isSuperAdminRole(user.role)) return true;
  if (!isCompanyOfficeRole(user.role)) return false;
  return user.companyId === companyId;
}

/** Treat all office staff roles (incl. COMPANY_ADMIN) as office admins for form-fill etc. */
export function isOfficeStaffRole(role: string | null | undefined) {
  return isSuperAdminRole(role) || isCompanyOfficeRole(role);
}

export function roleAllowsCompanyScopedApi(role: string | null | undefined) {
  return isOfficeStaffRole(role);
}

/** Keep prisma Role enum usable where string comparisons still exist. */
export const LEGACY_COMPANY_ADMIN = Role.COMPANY_ADMIN;
