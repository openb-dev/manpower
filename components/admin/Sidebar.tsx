"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  ExternalLink,
  Menu,
  X,
  LogOut,
  Building2,
} from "lucide-react";

interface CompanyInfo {
  id: string;
  shortName: string;
  legalName: string;
  slug: string;
  prefix: string;
}

interface UserInfo {
  name?: string | null;
  email?: string | null;
  role: string;
}

interface SidebarProps {
  company: CompanyInfo;
  user: UserInfo;
}

export default function Sidebar({ company, user }: SidebarProps) {
  const pathname = usePathname();
  const slug = company.slug;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const homeLinks = [{ href: `/${slug}/dashboard`, label: "Dashboard", icon: LayoutDashboard }];

  const hrmLinks = [
    { href: `/${slug}/applicants`, label: "New applicant", icon: ClipboardList },
    { href: `/${slug}/employees`, label: "Employees", icon: Users },
    { href: `/${slug}/attendance`, label: "Attendance", icon: CalendarCheck },
  ];

  const businessLinks = [
    { href: `/${slug}/crm`, label: "Work & sites", icon: Briefcase },
    { href: `/${slug}/accounts`, label: "Bills", icon: Receipt },
    { href: `/${slug}/procurement`, label: "Purchases", icon: ShoppingBag },
    { href: `/${slug}/finance`, label: "Money", icon: Wallet },
    { href: `/${slug}/reports`, label: "Reports", icon: BarChart3 },
  ];

  function navLink(link: { href: string; label: string; icon: LucideIcon }) {
    const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
    const Icon = link.icon;
    return (
      <Link
        key={link.href}
        href={link.href}
        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition text-sm font-medium min-h-10 ${
          active
            ? "bg-blue-50 text-blue-800 font-bold border border-blue-200"
            : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
        }`}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
            active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="truncate">{link.label}</span>
      </Link>
    );
  }

  return (
    <>
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-3 py-2 bg-white border-b border-slate-200 no-print">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white min-h-10"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Menu
        </button>
        <div className="min-w-0 text-right">
          <div className="text-sm font-bold text-slate-900 truncate">{company.shortName}</div>
          <div className="text-[11px] text-slate-500 truncate">{company.prefix}</div>
        </div>
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      ) : null}

      <aside
        className={`no-print fixed md:sticky top-0 left-0 z-50 md:z-10 h-dvh w-[min(18rem,88vw)] bg-white text-slate-700 flex flex-col border-r border-slate-200 shadow-sm select-none transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:w-64 md:h-screen`}
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 shrink-0 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-blue-700 font-extrabold">
                <Building2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {company.shortName}
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-mono font-bold px-2 py-0.5 rounded border border-blue-200">
                {company.prefix}
              </span>
            </div>
            <span className="text-xs text-slate-500 block truncate mt-1 font-medium">{company.legalName}</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden p-1.5 text-slate-500 rounded-md hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto min-h-0 p-3 space-y-4 text-xs font-medium">
          <div className="space-y-0.5">{homeLinks.map(navLink)}</div>
          <div>
            <div className="flex items-center justify-between px-2 pb-1.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                PEOPLE
              </span>
            </div>
            <div className="space-y-0.5 mt-1 pl-1 border-l-2 border-blue-200 ml-2">{hrmLinks.map(navLink)}</div>
          </div>

          <div>
            <div className="px-2 pb-1.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
              OFFICE WORK
            </div>
            <div className="space-y-0.5 mt-1">{businessLinks.map(navLink)}</div>
          </div>

          <div>
            <div className="px-2 pb-1 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
              JOB FORM
            </div>
            <Link
              href={`/apply/${slug}`}
              target="_blank"
              className="flex items-center justify-between px-2.5 py-2.5 rounded-lg text-sm text-blue-700 bg-blue-50/60 hover:bg-blue-100/70 border border-blue-200/80 font-semibold min-h-10"
            >
              <span>Open job form</span>
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        </nav>

        <div className="p-3.5 border-t border-slate-200 bg-slate-50/80 text-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 border border-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
              {user.name ? user.name.slice(0, 2).toUpperCase() : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-slate-900 font-bold truncate leading-tight">{user.name || "Office user"}</div>
              <div className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">{user.email}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                  {user.role === "SUPER_ADMIN" ? "All companies" : "This company"}
                </span>
                <a href="/logout" className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-semibold hover:underline">
                  <LogOut className="h-3 w-3" strokeWidth={2} aria-hidden />
                  Log out
                </a>
              </div>
              {user.role === "SUPER_ADMIN" ? (
                <Link href="/companies" className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-indigo-700 hover:underline">
                  <Building2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  Change company
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
