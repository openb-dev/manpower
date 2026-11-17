import { prisma } from "@/lib/db";
import { NK_DUTY_SITES, OTHER_SITE_VALUE } from "@/lib/nkSiteList";

export { NK_DUTY_SITES, OTHER_SITE_VALUE };

export function siteCodeFromName(name: string) {
  const code = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return code || "SITE";
}

export function sortDutySites<T extends { name?: string; code?: string }>(sites: T[]) {
  const order = NK_DUTY_SITES.map((site) => site.code);
  return [...sites].sort((a, b) => {
    const ia = order.indexOf(String(a.code || ""));
    const ib = order.indexOf(String(b.code || ""));
    if (ia === -1 && ib === -1) return String(a.name || "").localeCompare(String(b.name || ""));
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export async function ensureNkDutySites(companyId: string) {
  for (const site of NK_DUTY_SITES) {
    await prisma.site.upsert({
      where: { companyId_code: { companyId, code: site.code } },
      update: { name: site.name, active: true },
      create: {
        companyId,
        name: site.name,
        code: site.code,
        location: "West Bengal",
        active: true,
      },
    });
  }
}

export async function findOrCreateDutySite({
  companyId,
  siteId,
  otherName,
}: {
  companyId: string;
  siteId?: string;
  otherName?: string;
}) {
  const typedName = String(otherName || "").trim();
  const chosenId = String(siteId || "").trim();
  if (typedName && (!chosenId || chosenId === OTHER_SITE_VALUE)) {
    const existing = await prisma.site.findFirst({
      where: { companyId, active: true, name: { equals: typedName, mode: "insensitive" } },
      select: { id: true, name: true, code: true },
    });
    if (existing) return existing;

    let code = siteCodeFromName(typedName);
    let n = 1;
    while (await prisma.site.findUnique({ where: { companyId_code: { companyId, code } } })) {
      n += 1;
      code = `${siteCodeFromName(typedName).slice(0, 36)}-${n}`;
    }
    return prisma.site.create({
      data: {
        companyId,
        name: typedName,
        code,
        location: "West Bengal",
        active: true,
      },
      select: { id: true, name: true, code: true },
    });
  }

  if (!chosenId || chosenId === OTHER_SITE_VALUE) {
    throw new Error("Please select the duty site.");
  }
  const site = await prisma.site.findFirst({
    where: { id: chosenId, companyId, active: true },
    select: { id: true, name: true, code: true },
  });
  if (!site) throw new Error("Please select a valid duty site.");
  return site;
}
