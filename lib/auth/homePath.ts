import { Role } from "@prisma/client";
import { prisma } from "../db/index.ts";

export async function homePathForUser(user: {
  role?: string | null;
  companySlug?: string | null;
  companyId?: string | null;
}) {
  if (user?.role === Role.SUPER_ADMIN || user?.role === "SUPER_ADMIN") {
    return "/companies";
  }

  if (user?.companySlug) {
    return `/${user.companySlug}/dashboard`;
  }

  if (user?.companyId) {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { slug: true },
    });
    if (company?.slug) return `/${company.slug}/dashboard`;
  }

  return "/login";
}
