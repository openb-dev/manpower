"use client";

import React, { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Mail, Lock } from "lucide-react";
import NkLogo from "@/components/NkLogo";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";
import { PasswordInput } from "@/components/PasswordInput";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetOtpCode, setResetOtpCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);
  const [resetCodeStatus, setResetCodeStatus] = useState<"" | "checking" | "ok" | "bad">("");
  const resetVerifyLock = useRef("");

  useEffect(() => {
    if (resetCountdown <= 0) return;
    const timer = setInterval(() => setResetCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resetCountdown]);

  useEffect(() => {
    if (mode !== "forgot") return;
    const cleanEmail = resetEmail.trim().toLowerCase();
    const code = resetOtpCode;
    if (!resetOtpSent || code.length !== 6 || !cleanEmail.includes("@")) {
      setResetCodeStatus("");
      return;
    }
    const key = `${cleanEmail}:${code}`;
    if (resetVerifyLock.current === key) return;
    resetVerifyLock.current = key;
    let cancelled = false;
    setResetCodeStatus("checking");
    fetch("/api/office/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "VERIFY", email: cleanEmail, code }),
    })
      .then(async (res) => {
        const data = await readApiJson(res);
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "That code is not correct.");
        setResetCodeStatus("ok");
        setError("");
        setSuccessMsg("Code verified. Type your new password below.");
        window.setTimeout(() => document.getElementById("office-reset-password")?.focus(), 50);
      })
      .catch((err) => {
        if (cancelled) return;
        resetVerifyLock.current = "";
        setResetCodeStatus("bad");
        setError(err.message || "That code is not correct.");
        setSuccessMsg("");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, resetEmail, resetOtpCode, resetOtpSent]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

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

  function openForgot() {
    setMode("forgot");
    setResetEmail(email);
    setResetOtpCode("");
    setResetPassword("");
    setResetConfirmPassword("");
    setResetOtpSent(false);
    setResetCodeStatus("");
    resetVerifyLock.current = "";
    setError("");
    setSuccessMsg("");
  }

  async function handleSendResetOtp() {
    setError("");
    setSuccessMsg("");
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter the office email used to sign in.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/office/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REQUEST", email: cleanEmail }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Could not send the verification code. Please try again.");
      resetVerifyLock.current = "";
      setResetCodeStatus("");
      setResetOtpSent(true);
      setResetCountdown(60);
      if (data.trialCode) {
        setResetOtpCode(data.trialCode);
        setSuccessMsg(`No email service is set on this computer. Test code: ${data.trialCode}. Write it in the 6-digit box.`);
      } else if (data.delivered) {
        setSuccessMsg(`Code sent to ${cleanEmail}. Open Gmail, then write the 6 digits in the box. Also check Spam.`);
      } else {
        setSuccessMsg("Write the 6-digit code from Gmail in the box below.");
      }
      window.setTimeout(() => document.getElementById("office-reset-otp")?.focus(), 50);
    } catch (err: any) {
      setError(friendlyPublicError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter the office email used to sign in.");
      return;
    }
    if (resetCodeStatus !== "ok") {
      setError("Please wait until the 6-digit code is verified.");
      return;
    }
    if (resetPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/office/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESET",
          email: cleanEmail,
          otpCode: resetOtpCode,
          password: resetPassword,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Password could not be changed. Please try again.");

      const signed = await signIn("credentials", {
        email: cleanEmail,
        password: resetPassword,
        redirect: false,
      });
      if (signed?.error) {
        setMode("login");
        setEmail(cleanEmail);
        setPassword("");
        setSuccessMsg("Password updated. Please sign in with the new password.");
        return;
      }
      window.location.replace("/");
    } catch (err: any) {
      setError(friendlyPublicError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4 overflow-x-hidden">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-5 sm:p-8 border border-slate-200/80">
        <div className="text-center mb-6">
          <NkLogo className="mx-auto mb-4 h-20 w-20 rounded-2xl object-contain bg-black shadow-sm" />
          <span className="text-xs uppercase tracking-widest text-blue-600 font-bold block mb-1">
            Office software
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Manpower Management System</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "forgot"
              ? "We will send a 6-digit code to your office Gmail. Write it here, then set a new password."
              : "Enter your email and password to start work."}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-semibold">
            {successMsg}
          </div>
        )}

        {mode === "login" ? (
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" strokeWidth={1.75} aria-hidden />
                <PasswordInput
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-9 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  Forgot password?
                </button>
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
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1. Office email <span className="text-red-600">*</span>
              </label>
              <input
                required
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="e.g. admin@manpower.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-slate-800">2. Send the Gmail code</div>
                  <div className="text-[11px] text-slate-600">
                    {resetOtpSent
                      ? `Code sent to ${resetEmail}. Open Gmail, then write the 6 digits below.`
                      : "Click Send code. Then open that Gmail inbox."}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={loading || resetCountdown > 0}
                  onClick={handleSendResetOtp}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg whitespace-nowrap"
                >
                  {resetCountdown > 0 ? `Resend in ${resetCountdown}s` : resetOtpSent ? "Resend code" : "Send code"}
                </button>
              </div>
              <div>
                <label htmlFor="office-reset-otp" className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  3. Write the 6-digit code here *
                </label>
                <input
                  id="office-reset-otp"
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={resetOtpCode}
                  onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={`w-full px-3 py-3 border-2 rounded-lg text-2xl text-center tracking-[0.4em] font-mono font-bold bg-white focus:outline-none focus:ring-2 ${
                    resetCodeStatus === "ok"
                      ? "border-emerald-500 focus:ring-emerald-500"
                      : resetCodeStatus === "bad"
                      ? "border-red-400 focus:ring-red-500"
                      : "border-blue-400 focus:ring-blue-500"
                  }`}
                />
                <p className="text-[11px] mt-1 font-semibold">
                  {resetCodeStatus === "checking"
                    ? "Checking the code..."
                    : resetCodeStatus === "ok"
                    ? "Code verified. You can set a new password now."
                    : resetCodeStatus === "bad"
                    ? "That code is not correct. Check Gmail and type it again."
                    : "Type all 6 digits. The code is checked automatically."}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                4. New password <span className="text-red-600">*</span>
              </label>
              <PasswordInput
                id="office-reset-password"
                required
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm new password <span className="text-red-600">*</span>
              </label>
              <PasswordInput
                required
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                placeholder="Type the new password again"
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || resetCodeStatus !== "ok"}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm shadow-sm"
            >
              {loading && resetCodeStatus === "ok" ? "Saving..." : "Save new password"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setSuccessMsg("");
              }}
              className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
