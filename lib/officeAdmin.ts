import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type OfficeAdmin = {
  id: string;
  name: string;
  email: string;
  phone?: string;
};

export async function currentOfficeAdmin(companySlug: string): Promise<OfficeAdmin | null> {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return null;
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.COMPANY_ADMIN) return null;

  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
    select: { id: true },
  });
  if (!company) return null;
  if (user.role !== Role.SUPER_ADMIN && user.companyId !== company.id) return null;

  return {
    id: String(user.id),
    name: String(user.name || "Admin"),
    email: String(user.email || ""),
  };
}
