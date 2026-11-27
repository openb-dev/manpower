"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LABOUR_MARK_OPTIONS, markStyle } from "@/lib/attendanceMarks";

/**
 * Click day box → dropdown of markings (P, P/0.5, P/1.5, P/2, A).
 * Menu is portaled to document.body so table overflow cannot clip it.
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const menu =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/55 p-4"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Choose attendance mark"
              className="w-full max-w-xs rounded-2xl bg-white shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-base font-bold text-slate-900 mb-1">Select mark</div>
              <p className="text-xs text-slate-500 mb-3">P · P/0.5 · P/1.5 · P/2 · A</p>
              <div className="flex flex-col gap-2">
                {LABOUR_MARK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value || "clear"}
                    type="button"
                    className={`w-full min-h-12 rounded-xl border-2 text-base font-bold ${
                      value === opt.value ? "border-emerald-600 ring-2 ring-emerald-200" : "border-slate-200"
                    } ${opt.value ? markStyle(opt.value) : "bg-slate-50 text-slate-600"}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    {opt.value ? opt.label : "Clear (—)"}
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || "Attendance mark"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setOpen(true);
        }}
        className={`w-full min-w-[48px] h-8 rounded text-[11px] font-bold border-2 border-slate-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:border-emerald-500 ${
          value ? markStyle(value) : "bg-white text-slate-400"
        }`}
      >
        {value || "·"}
      </button>
      {menu}
    </>
  );
}
