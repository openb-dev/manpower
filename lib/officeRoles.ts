import { Role } from "@prisma/client";

/** Office staff roles Super Admin can create (not Super Admin itself). */
export const ASSIGNABLE_OFFICE_ROLES = [
  Role.COMPANY_ADMIN,
  Role.ACCOUNTS,
  Role.BACK_OFFICE,
  Role.SUPERVISOR,
  Role.GROUND_STAFF,
  Role.TECHNICAL_STAFF,
] as const;

export type AssignableOfficeRole = (typeof ASSIGNABLE_OFFICE_ROLES)[number];

export type OfficeModule =
  | "dashboard"
  | "applicants"
  | "employees"
  | "attendance"
  | "work-list"
  | "accounts"
  | "procurement"
  | "finance"
  | "reports";

const ALL_MODULES: OfficeModule[] = [
  "dashboard",
  "applicants",
  "employees",
  "attendance",
  "work-list",
  "accounts",
  "procurement",
  "finance",
  "reports",
];

export function officeRoleLabel(role: string) {
  switch (role) {
    case Role.SUPER_ADMIN:
      return "Super Admin";
    case Role.COMPANY_ADMIN:
      return "Company Admin (full)";
    case Role.ACCOUNTS:
      return "Accounts";
    case Role.BACK_OFFICE:
      return "Back Office";
    case Role.SUPERVISOR:
      return "Supervisor";
    case Role.GROUND_STAFF:
      return "Ground Staff";
    case Role.TECHNICAL_STAFF:
      return "Technical Staff";
    default:
      return role;
  }
}

export function officeRoleNote(role: string) {
  switch (role) {
    case Role.COMPANY_ADMIN:
      return "Full access for this company";
    case Role.ACCOUNTS:
      return "Billing, ledger, invoices, payments";
    case Role.BACK_OFFICE:
      return "Applications, employees, registers, paperwork";
    case Role.SUPERVISOR:
      return "Site oversight, attendance, progress follow-up";
    case Role.GROUND_STAFF:
      return "On-site attendance and simple progress entry";
    case Role.TECHNICAL_STAFF:
      return "BOQ / work progress and technical notes";
    default:
      return "";
  }
}

/** Modules each role may open (from client hierarchy). */
export function modulesForRole(role: string): OfficeModule[] {
  switch (role) {
    case Role.SUPER_ADMIN:
    case Role.COMPANY_ADMIN:
      return [...ALL_MODULES];
    case Role.ACCOUNTS:
      return ["dashboard", "accounts", "finance", "reports"];
    case Role.BACK_OFFICE:
      return ["dashboard", "applicants", "employees", "work-list", "reports"];
    case Role.SUPERVISOR:
      return ["dashboard", "employees", "attendance", "work-list"];
    case Role.GROUND_STAFF:
      return ["dashboard", "attendance", "work-list"];
    case Role.TECHNICAL_STAFF:
      return ["dashboard", "work-list", "procurement", "reports"];
    default:
      return ["dashboard"];
  }
}

export function canAccessModule(role: string, module: OfficeModule) {
  return modulesForRole(role).includes(module);
}

export function isSuperAdminRole(role: string | null | undefined) {
  return role === Role.SUPER_ADMIN || role === "SUPER_ADMIN";
}

/** Any login that may enter a company office (not Super Admin picker). */
export function isCompanyOfficeRole(role: string | null | undefined) {
  if (!role) return false;
  return ASSIGNABLE_OFFICE_ROLES.includes(role as AssignableOfficeRole);
}

export function isAssignableOfficeRole(role: string): role is AssignableOfficeRole {
  return ASSIGNABLE_OFFICE_ROLES.includes(role as AssignableOfficeRole);
}
