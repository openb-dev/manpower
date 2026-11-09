"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { LayoutDashboard, Mail, Lock } from "lucide-react";
import { friendlyPublicError } from "@/lib/publicErrors";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Email or password is wrong. Try again.");
        setLoading(false);
        return;
      }

      window.location.replace("/");
    } catch (err: any) {
      setError(friendlyPublicError(err.message || "Could not sign in. Please try again."));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4 overflow-x-hidden">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-5 sm:p-8 border border-slate-200/80">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <LayoutDashboard className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </div>
          <span className="text-xs uppercase tracking-widest text-blue-600 font-bold block mb-1">
            Office software
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Manpower Management System</h1>
          <p className="text-sm text-slate-500 mt-1">Enter your email and password to start work.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.75} aria-hidden />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@manpower.com"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" strokeWidth={1.75} aria-hidden />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-sm disabled:opacity-50 transition"
          >
            {loading ? "Please wait..." : "Start work"}
          </button>
        </form>
      </div>
    </div>
  );
}
