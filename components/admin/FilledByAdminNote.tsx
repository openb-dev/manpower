import React from "react";
import { filledByAdminInfo, filledByAdminLine } from "@/lib/applicantFormFields";

export default function FilledByAdminNote({ person }: { person: any }) {
  const info = filledByAdminInfo(person);
  if (!info) return null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-950 no-print">
      <div className="text-[10px] font-bold uppercase tracking-wide">{filledByAdminLine(person)}</div>
      <div className="text-xs font-mono mt-1 space-y-0.5">
        <div>Phone: {info.phone || "—"}</div>
        <div>Email: {info.email || "—"}</div>
        <div>Admin ID: {info.userId || "—"}</div>
      </div>
    </div>
  );
}
