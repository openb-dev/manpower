"use client";

import React from "react";
import { LABOUR_MARK_OPTIONS, markStyle } from "@/lib/attendanceMarks";

/** Native select — OS dropdown always opens (no portal / z-index issues). */
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
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`w-full min-w-[56px] h-8 rounded text-[10px] font-bold border border-slate-400 cursor-pointer appearance-auto bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed relative z-20 pointer-events-auto touch-manipulation ${markStyle(value)}`}
    >
      {LABOUR_MARK_OPTIONS.map((opt) => (
        <option key={opt.value || "empty"} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
