"use client";

import React from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import {
  Banknote,
  CalendarCheck,
  Building2,
  ArrowLeftRight,
  CircleDollarSign,
  ShoppingBag,
  UserRound,
  WalletCards,
} from "lucide-react";
import WorkListCard from "@/components/admin/WorkListCard";
import {
  isWorkListTrack,
  workListExpenditureItems,
  workListTrackLabel,
  type WorkListTrack,
} from "@/lib/workList";

const ICONS = {
  purchase: ShoppingBag,
  "labour-payment": Banknote,
  "individual-payment": UserRound,
  attendance: CalendarCheck,
  "office-admin": Building2,
  "received-expenses": ArrowLeftRight,
  "petty-cash": CircleDollarSign,
} as const;

export default function WorkListExpenditurePage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;
  const trackParam = params?.track as string;

  if (!isWorkListTrack(trackParam)) notFound();
  const track = trackParam as WorkListTrack;
  const items = workListExpenditureItems(companySlug, track);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
          <Link href={`/${companySlug}/work-list`} className="font-semibold text-blue-700 hover:underline">
            Work List
          </Link>
          <span>/</span>
          <Link
            href={`/${companySlug}/work-list/${track}`}
            className="font-semibold text-blue-700 hover:underline"
          >
            {workListTrackLabel(track)}
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-700">Work Expenditure</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
          <WalletCards className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Work expenditure
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">
          Work Expenditure — {workListTrackLabel(track)}
        </h1>
        <p className="text-sm text-slate-500">
          Purchase, labour payment, attendance, office admin, and petty cash total.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <WorkListCard
            key={item.id}
            href={item.href}
            title={item.label}
            note={item.note}
            icon={ICONS[item.id]}
            accent={item.id === "petty-cash" ? "amber" : "slate"}
          />
        ))}
      </div>
    </div>
  );
}
