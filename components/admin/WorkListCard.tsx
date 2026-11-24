import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export default function WorkListCard({
  href,
  title,
  note,
  icon: Icon,
  accent = "blue",
}: {
  href: string;
  title: string;
  note: string;
  icon: LucideIcon;
  accent?: "blue" | "teal" | "amber" | "slate";
}) {
  const accents = {
    blue: {
      wrap: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/40",
      icon: "bg-blue-600 text-white",
      arrow: "text-blue-700",
    },
    teal: {
      wrap: "border-teal-200 hover:border-teal-400 hover:bg-teal-50/40",
      icon: "bg-teal-700 text-white",
      arrow: "text-teal-800",
    },
    amber: {
      wrap: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/40",
      icon: "bg-amber-700 text-white",
      arrow: "text-amber-800",
    },
    slate: {
      wrap: "border-slate-200 hover:border-slate-400 hover:bg-slate-50",
      icon: "bg-slate-700 text-white",
      arrow: "text-slate-700",
    },
  }[accent];

  return (
    <Link
      href={href}
      className={`group flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-sm transition ${accents.wrap}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accents.icon}`}>
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-base font-bold text-slate-900">{title}</span>
          <ArrowRight className={`h-4 w-4 shrink-0 opacity-60 group-hover:opacity-100 ${accents.arrow}`} aria-hidden />
        </span>
        <span className="mt-1 block text-sm text-slate-500">{note}</span>
      </span>
    </Link>
  );
}
