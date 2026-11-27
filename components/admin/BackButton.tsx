"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ companySlug }: { companySlug?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // Dashboard is the home — no back needed there
  const isDashboard = Boolean(pathname?.match(/\/[^/]+\/dashboard\/?$/));
  if (isDashboard) return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    if (companySlug) {
      router.push(`/${companySlug}/dashboard`);
      return;
    }
    router.push("/");
  }

  return (
    <div className="no-print mb-3 sm:mb-4">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 min-h-9"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
        Back
      </button>
    </div>
  );
}
