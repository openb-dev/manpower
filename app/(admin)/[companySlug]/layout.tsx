import React, { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import Sidebar from "@/components/admin/Sidebar";

const getCompanyBySlug = cache(async (slug: string) => {
  return prisma.company.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      shortName: true,
      legalName: true,
      sequence: { select: { prefix: true } },
    },
  });
});

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companySlug: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { companySlug } = await params;
  const company = await getCompanyBySlug(companySlug);

  if (!company) {
    redirect("/login");
  }

  const user = session.user as any;

  // Company admin has full in-company powers; only Super Admin may open another company.
  if (user.role !== Role.SUPER_ADMIN && user.companyId !== company.id) {
    const own = user.companySlug
      ? { slug: user.companySlug }
      : await prisma.company.findUnique({ where: { id: user.companyId }, select: { slug: true } });
    redirect(own?.slug ? `/${own.slug}/dashboard` : "/login");
  }

  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-[#f8fafc] text-slate-800 overflow-x-hidden print:overflow-visible print:block print:h-auto print:min-h-0">
      <Sidebar
        company={{
          id: company.id,
          shortName: company.shortName,
          legalName: company.legalName,
          slug: company.slug,
          prefix: company.sequence?.prefix || company.slug.toUpperCase(),
        }}
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
        }}
      />

      <main className="flex-1 min-w-0 p-3 sm:p-6 md:p-8 md:overflow-y-auto md:max-h-screen print:overflow-visible print:max-h-none print:p-0">
        {children}
      </main>
    </div>
  );
}
