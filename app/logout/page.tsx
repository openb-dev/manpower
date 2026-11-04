"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-200/80 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <LogOut className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Log out?</h1>
        <p className="text-sm text-slate-500 mt-2">Do you want to close this office session?</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            No / Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              signOut({ callbackUrl: "/login" });
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Yes, log out"}
          </button>
        </div>
      </div>
    </div>
  );
}
