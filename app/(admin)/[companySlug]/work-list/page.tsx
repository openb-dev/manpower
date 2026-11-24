"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HardHat, ListTree, Users } from "lucide-react";
import WorkListCard from "@/components/admin/WorkListCard";

export default function WorkListPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
          <ListTree className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Work list
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Work List</h1>
        <p className="text-sm text-slate-500">
          Choose Manpower or Construction, then open Work Register, Progress, or Expenditure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <WorkListCard
          href={`/${companySlug}/work-list/manpower`}
          title="Manpower"
          note="Manpower works — register, progress report, and expenditure"
          icon={Users}
          accent="blue"
        />
        <WorkListCard
          href={`/${companySlug}/work-list/construction`}
          title="Construction"
          note="Construction works — register, progress report, and expenditure"
          icon={HardHat}
          accent="teal"
        />
      </div>

      <p className="text-xs text-slate-400">
        Bills, purchases and money tools stay under Office work.{" "}
        <Link href={`/${companySlug}/dashboard`} className="font-semibold text-blue-700 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
