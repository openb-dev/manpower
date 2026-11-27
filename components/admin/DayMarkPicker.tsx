"use client";

import React, { useState } from "react";
import { LABOUR_MARK_OPTIONS, markStyle } from "@/lib/attendanceMarks";

/**
 * Day mark chooser: click the cell → full-screen option sheet.
 * Avoids native &lt;select&gt; / portal issues inside scroll tables on live.
 */
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || "Attendance mark"}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        className={`w-full min-w-[48px] h-8 rounded text-[11px] font-bold border border-slate-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? markStyle(value) : "bg-white text-slate-400"
        }`}
      >
        {value || "·"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[10050] flex items-end sm:items-center justify-center bg-black/50 p-3"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose attendance mark"
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-slate-900 mb-3">Choose mark</div>
            <div className="grid grid-cols-2 gap-2">
              {LABOUR_MARK_OPTIONS.map((opt) => (
                <button
                  key={opt.value || "clear"}
                  type="button"
                  className={`min-h-12 rounded-xl border-2 text-sm font-bold ${
                    value === opt.value ? "border-emerald-600 ring-2 ring-emerald-200" : "border-slate-200"
                  } ${opt.value ? markStyle(opt.value) : "bg-slate-50 text-slate-600"}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label === "—" ? "Clear" : opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 w-full min-h-10 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
