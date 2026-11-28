"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { LABOUR_MARK_OPTIONS, markStyle } from "@/lib/attendanceMarks";

/**
 * Compact day mark dropdown (P, P/0.5, P/1.5, P/2, A)
 * with optional Job Description box.
 */
export default function DayMarkPicker({
  value,
  jobDescription = "",
  disabled,
  locked,
  onChange,
  ariaLabel,
}: {
  value: string;
  jobDescription?: string;
  disabled?: boolean;
  locked?: boolean;
  onChange: (mark: string, jobDescription: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [jobDraft, setJobDraft] = useState(jobDescription);
  const cannotSave = Boolean(disabled || locked);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setJobDraft(jobDescription || "");
  }, [open, jobDescription]);

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

  function pick(mark: string) {
    if (locked) return;
    if (disabled) return;
    onChange(mark, jobDraft.trim());
    setOpen(false);
  }

  const menu =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-3"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Choose attendance mark"
              className="w-full max-w-[16rem] rounded-lg bg-white shadow-xl p-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[11px] font-bold text-slate-800 mb-1.5 px-0.5">Mark</div>
              {locked ? (
                <div className="mb-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900">
                  Month closed — cannot save.
                </div>
              ) : null}

              <label className="block mb-2">
                <span className="text-[10px] font-bold text-slate-600 px-0.5">
                  Job Description <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <textarea
                  value={jobDraft}
                  disabled={cannotSave}
                  onChange={(e) => setJobDraft(e.target.value)}
                  rows={2}
                  placeholder="Job description"
                  className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-md text-[11px] resize-y min-h-[52px] disabled:opacity-60"
                />
              </label>

              <div className="flex flex-col gap-1">
                {LABOUR_MARK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value || "clear"}
                    type="button"
                    disabled={cannotSave}
                    className={`w-full min-h-8 rounded-md border text-[11px] font-bold disabled:opacity-60 ${
                      value === opt.value ? "border-emerald-600 ring-1 ring-emerald-200" : "border-slate-200"
                    } ${opt.value ? markStyle(opt.value) : "bg-slate-50 text-slate-600"}`}
                    onClick={() => pick(opt.value)}
                  >
                    {opt.value ? opt.label : "—"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-1.5 w-full min-h-7 rounded border border-slate-300 text-[10px] font-semibold text-slate-600"
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
        aria-label={ariaLabel || "Attendance mark"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`w-full min-w-[42px] max-w-[52px] h-6 mx-auto px-0.5 rounded text-[9px] font-bold border border-slate-300 bg-white cursor-pointer hover:border-emerald-500 inline-flex items-center justify-between gap-px ${
          value ? markStyle(value) : "text-slate-400"
        }`}
      >
        <span className="truncate flex-1 text-center leading-none">{value || "—"}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 text-slate-500" aria-hidden />
      </button>
      {menu}
    </>
  );
}
