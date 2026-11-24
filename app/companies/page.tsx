import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import SuperAdminClient from "./SuperAdminClient";

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  if (user.role !== Role.SUPER_ADMIN) {
    redirect(user.companySlug ? `/${user.companySlug}/dashboard` : "/login");
  }

  const companies = await prisma.company.findMany({
    where: { active: true },
    include: {
      sequence: true,
      _count: { select: { applicants: true, employees: true, contracts: true, users: true } },
      contracts: {
        where: { deletedAt: null },
        select: {
          id: true,
          workName: true,
          clientName: true,
          agreementNo: true,
          workStatus: true,
          contractType: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      employees: {
        where: { status: "ACTIVE" },
        select: { id: true, fullName: true, employeeCode: true, mobile: true },
        orderBy: { fullName: "asc" },
        take: 500,
      },
    },
    orderBy: { shortName: "asc" },
  });

  const initialCompanies = companies.map((c) => ({
    id: c.id,
    slug: c.slug,
    shortName: c.shortName,
    legalName: c.legalName,
    prefix: c.sequence?.prefix || c.slug.toUpperCase(),
    applicants: c._count.applicants,
    employees: c._count.employees,
    contracts: c._count.contracts,
    users: c._count.users,
    projects: c.contracts.map((p) => ({
      id: p.id,
      label: p.workName || p.clientName || p.agreementNo || "Project",
      clientName: p.clientName,
      agreementNo: p.agreementNo,
      workStatus: p.workStatus,
      contractType: p.contractType,
    })),
    employeeOptions: c.employees.map((e) => ({
      id: e.id,
      label: `${e.fullName} (${e.employeeCode})`,
      mobile: e.mobile,
    })),
  }));

  return <SuperAdminClient initialCompanies={initialCompanies} />;
}
