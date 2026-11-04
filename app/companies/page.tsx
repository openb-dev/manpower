import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import Link from "next/link";
import { Building2, ArrowRight, LogOut } from "lucide-react";

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  if (user.role !== Role.SUPER_ADMIN) {
    redirect(user.companySlug ? `/${user.companySlug}/dashboard` : "/login");
  }

  const companies = await prisma.company.findMany({
    where: { active: true },
    include: { sequence: true, _count: { select: { applicants: true, employees: true } } },
    orderBy: { shortName: "asc" },
  });

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <span className="text-[11px] uppercase font-extrabold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
              Super Admin
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">Choose a company</h1>
            <p className="text-sm text-slate-500 mt-1">Open the office you want to work in.</p>
          </div>
          <a href="/logout" className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline">
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Log out
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={`/${company.slug}/dashboard`}
              className="block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 shrink-0">
                    <Building2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="text-lg font-bold text-slate-900 truncate">{company.shortName}</div>
                </div>
                <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                  {company.sequence?.prefix || company.slug.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-slate-500 mt-1">{company.legalName}</div>
              <div className="text-xs text-slate-400 mt-3">
                {company._count.applicants} new applicants · {company._count.employees} employees
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700">
                Open office
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
