import { prisma } from "@/lib/db";
import { isManpowerRole, isSecurityGuardRole } from "@/lib/gem";

const GUARD_CATEGORIES = [
  { code: "CIVILIAN", name: "Civilian" },
  { code: "BSF_EX", name: "Ex-serviceman" },
  { code: "LADY", name: "Lady Guard" },
  { code: "GUNMAN", name: "Gunman" },
  { code: "OTHERS", name: "Others" },
] as const;

function sortGuardCategories<T extends { code?: string; name?: string }>(categories: T[]) {
  const order = new Map(GUARD_CATEGORIES.map((item, index) => [item.code, index]));
  return [...categories].sort((a, b) => {
    const left = order.get(String(a.code || "").toUpperCase()) ?? 99;
    const right = order.get(String(b.code || "").toUpperCase()) ?? 99;
    if (left !== right) return left - right;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

export async function ensureApplyRoles(companyId: string) {
  const guard = await prisma.jobRole.upsert({
    where: { companyId_code: { companyId, code: "SEC-GUARD" } },
    update: { name: "Security Guard", active: true },
    create: { companyId, name: "Security Guard", code: "SEC-GUARD", active: true },
  });

  for (const cat of GUARD_CATEGORIES) {
    await prisma.roleCategory.upsert({
      where: { jobRoleId_code: { jobRoleId: guard.id, code: cat.code } },
      update: { name: cat.name, active: true },
      create: {
        companyId,
        jobRoleId: guard.id,
        name: cat.name,
        code: cat.code,
        active: true,
      },
    });
  }

  const manpower = await prisma.jobRole.upsert({
    where: { companyId_code: { companyId, code: "MANPOWER" } },
    update: { name: "Manpower", active: true },
    create: { companyId, name: "Manpower", code: "MANPOWER", active: true },
  });

  await prisma.roleCategory.upsert({
    where: { jobRoleId_code: { jobRoleId: manpower.id, code: "OTHERS" } },
    update: { name: "Others", active: true },
    create: {
      companyId,
      jobRoleId: manpower.id,
      name: "Others",
      code: "OTHERS",
      active: true,
    },
  });

  await prisma.jobRole.updateMany({
    where: { companyId, code: { in: ["SWEEPER", "HOUSEKEEPER"] } },
    data: { active: false },
  });
}

export function applyRolesForForm<
  T extends { code?: string; name?: string; categories?: Array<{ code?: string; name?: string }> },
>(roles: T[]) {
  const visible = roles.filter((role) => isSecurityGuardRole(role) || isManpowerRole(role));
  return visible
    .sort((a, b) => Number(isManpowerRole(a)) - Number(isManpowerRole(b)))
    .map((role) =>
      isSecurityGuardRole(role) ? { ...role, categories: sortGuardCategories(role.categories || []) } : role,
    );
}
