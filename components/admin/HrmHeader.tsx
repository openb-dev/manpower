"use client";

import React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ClipboardList, Users, CalendarCheck } from "lucide-react";

interface HrmHeaderProps {
  companySlug: string;
  activeTab: "applicants" | "employees" | "attendance";
}

export default function HrmHeader({ companySlug, activeTab }: HrmHeaderProps) {
  const tabs: {
    id: "applicants" | "employees" | "attendance";
    label: string;
    icon: LucideIcon;
    href: string;
    desc: string;
  }[] = [
    {
      id: "applicants",
      label: "New applicant",
      icon: ClipboardList,
      href: `/${companySlug}/applicants`,
      desc: "See forms. Shortlist, reject, or make employee.",
    },
    {
      id: "employees",
      label: "Employees",
      icon: Users,
      href: `/${companySlug}/employees`,
      desc: "People who already joined work.",
    },
    {
      id: "attendance",
      label: "Attendance",
      icon: CalendarCheck,
      href: `/${companySlug}/attendance`,
      desc: "Mark who came to work each day.",
    },
  ];

  return (
    <div className="mb-4 sm:mb-6 bg-white border border-slate-200/90 rounded-2xl p-2 shadow-xs">
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2 px-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase font-extrabold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
            People
          </span>
          <span className="text-xs text-slate-500 font-medium">
            New forms, employee list, and daily attendance
          </span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center sm:items-start gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl border transition min-h-10 shrink-0 ${
                isActive
                  ? "bg-blue-50/80 border-blue-300 text-blue-900"
                  : "border-slate-200 sm:border-transparent bg-white hover:bg-slate-50 text-slate-700"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-bold leading-tight ${isActive ? "text-blue-900" : "text-slate-800"}`}>
                  {tab.label}
                </div>
                <div className="hidden sm:block text-[11px] text-slate-500 truncate mt-0.5">{tab.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
