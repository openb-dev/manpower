"use client";

import React from "react";
import { LABOUR_MARK_OPTIONS, markStyle } from "@/lib/attendanceMarks";

/** Native OS dropdown in each day cell. */
export default function DayMarkPicker({
  value,
  disabled,
  onChange,
  ariaLabel,
}: {
  value: string;
  disabled?: boolean;
  onChange: (mark: string) => void;
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={ariaLabel || "Attendance mark"}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full min-w-[64px] h-8 rounded text-[10px] font-bold border border-slate-400 cursor-pointer bg-white disabled:opacity-50 disabled:cursor-not-allowed ${markStyle(value)}`}
      style={{ WebkitAppearance: "menulist", appearance: "menulist" }}
    >
      {LABOUR_MARK_OPTIONS.map((opt) => (
        <option key={opt.value || "empty"} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
