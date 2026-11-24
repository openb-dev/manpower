"use client";

import React from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { Briefcase, FileSpreadsheet, ListTree, WalletCards } from "lucide-react";
import WorkListCard from "@/components/admin/WorkListCard";
import {
  isWorkListTrack,
  workListTrackItems,
  workListTrackLabel,
  workListTrackNote,
  type WorkListTrack,
} from "@/lib/workList";

const ICONS = {
  register: Briefcase,
  progress: FileSpreadsheet,
  expenditure: WalletCards,
} as const;

export default function WorkListTrackPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;
  const trackParam = params?.track as string;

  if (!isWorkListTrack(trackParam)) notFound();
  const track = trackParam as WorkListTrack;
  const items = workListTrackItems(companySlug, track);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
          <Link href={`/${companySlug}/work-list`} className="font-semibold text-blue-700 hover:underline">
            Work List
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-700">{workListTrackLabel(track)}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
          <ListTree className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {workListTrackLabel(track)}
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">{workListTrackLabel(track)}</h1>
        <p className="text-sm text-slate-500">{workListTrackNote(track)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl">
        {items.map((item) => (
          <WorkListCard
            key={item.id}
            href={item.href}
            title={item.label}
            note={item.note}
            icon={ICONS[item.id]}
            accent={item.id === "expenditure" ? "amber" : track === "manpower" ? "blue" : "teal"}
          />
        ))}
      </div>
    </div>
  );
}
