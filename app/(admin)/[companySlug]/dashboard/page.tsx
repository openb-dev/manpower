"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  CalendarCheck,
  Briefcase,
  Receipt,
  ShoppingBag,
  Wallet,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { loadDashboard } from "../actions";
import { statusLabel } from "@/components/admin/SimpleGuide";

function money(value: unknown) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function dateText(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function DashboardPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadDashboard(companySlug)
      .then((payload) => {
        setData(payload);
        setError("");
      })
      .catch((err) => {
        setData(null);
        setError(err.message || "Dashboard could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, [companySlug]);

  const summary = data?.summary;
  const peopleLinks = [
    { href: `/${companySlug}/applicants`, label: "New applicant", note: "Forms, shortlist, reject, make employee", icon: ClipboardList },
    { href: `/${companySlug}/employees`, label: "Employees", note: "People who already joined", icon: Users },
    { href: `/${companySlug}/attendance`, label: "Attendance", note: "Daily muster and wages", icon: CalendarCheck },
  ];
  const officeLinks = [
    { href: `/${companySlug}/crm`, label: "Work & sites", note: "Tender, EMD, PG, work register", icon: Briefcase },
    { href: `/${companySlug}/accounts`, label: "Bills", note: "GeM tax invoice / wage bill", icon: Receipt },
    { href: `/${companySlug}/procurement`, label: "Purchases", note: "Materials bought for work", icon: ShoppingBag },
    { href: `/${companySlug}/finance`, label: "Money", note: "Cash, online, bank, cheque ledger", icon: Wallet },
    { href: `/${companySlug}/reports`, label: "Reports", note: "Lists and applicant paper form", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
          <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Dashboard
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">
          {data?.company?.legalName || "Office home"}
        </h1>
        <p className="text-sm text-slate-500">People, work, and money for this company.</p>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
          Loading office numbers...
        </div>
      ) : error ? (
        <div className="p-6 text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Kpi icon={ClipboardList} title="New applicant" value={String(summary.applicants.total)} note={`${summary.applicants.SHORTLISTED} shortlisted · ${summary.applicants.APPROVED} approved`} />
            <Kpi icon={Users} title="Employees working" value={String(summary.employees.ACTIVE)} note={`${summary.employees.total} total employees`} />
            <Kpi icon={Briefcase} title="Works" value={String(summary.contracts)} note={`${summary.emd.count} EMD · ${summary.pg.count} PG`} />
            <Kpi icon={Receipt} title="Bills given" value={money(summary.invoices.billed)} note={`${summary.invoices.count} bills`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 mb-3">People</h2>
              <div className="space-y-2">
                {peopleLinks.map((link) => (
                  <DashLink key={link.href} {...link} />
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-900 mb-3">Office work</h2>
              <div className="space-y-2">
                {officeLinks.map((link) => (
                  <DashLink key={link.href} {...link} />
                ))}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Latest forms</h2>
                <Link href={`/${companySlug}/applicants`} className="text-xs font-bold text-blue-700">
                  Open list
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {(data.applicants || []).slice(0, 5).map((row: any) => (
                  <div key={row.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{row.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {row.jobRole?.name || "—"} · {dateText(row.createdAt)}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded shrink-0">
                      {statusLabel(row.status)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Latest works</h2>
                <Link href={`/${companySlug}/crm`} className="text-xs font-bold text-blue-700">
                  Open list
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {(data.contracts || []).slice(0, 5).map((row: any) => (
                  <div key={row.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{row.clientName}</div>
                      <div className="text-xs text-slate-500 truncate">{row.workName || row.agreementNo}</div>
                    </div>
                    <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded shrink-0">
                      {row.workStatus}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  title,
  value,
  note,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] uppercase font-bold tracking-wider text-slate-400">{title}</div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{note}</div>
    </div>
  );
}

function DashLink({
  href,
  label,
  note,
  icon: Icon,
}: {
  href: string;
  label: string;
  note: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shrink-0">
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">{label}</div>
          <div className="text-xs text-slate-500">{note}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-blue-700 shrink-0" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}
