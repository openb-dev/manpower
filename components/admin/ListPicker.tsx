"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type ListPickerOption = { value: string; label: string };

/** Click → option sheet on document.body (not clipped by table overflow). */
export default function ListPicker({
  value,
  options,
  placeholder = "Select",
  disabled,
  onChange,
  className = "",
  buttonClassName = "",
  emptyHint,
}: {
  value: string;
  options: ListPickerOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const selected = options.find((o) => o.value === value || o.label === value);

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

  const sheet =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-end sm:items-center justify-center bg-black/55 p-3"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md max-h-[70vh] flex flex-col rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-900">
                {placeholder}
              </div>
              <div className="overflow-y-auto p-2">
                <button
                  type="button"
                  className="w-full text-left px-3 py-3 rounded-lg text-sm text-slate-500 hover:bg-slate-50"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  Clear
                </button>
                {options.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-amber-700">{emptyHint || "No options yet."}</div>
                ) : (
                  options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`w-full text-left px-3 py-3 rounded-lg text-sm hover:bg-emerald-50 ${
                        value === opt.value || value === opt.label
                          ? "bg-emerald-50 font-bold text-emerald-900"
                          : "text-slate-800"
                      }`}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-slate-200">
                <button
                  type="button"
                  className="w-full min-h-10 rounded-lg border border-slate-300 text-sm font-semibold"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setOpen(true);
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-left hover:border-slate-400 disabled:opacity-50 min-h-10 ${buttonClassName}`}
      >
        <span className={`truncate ${selected ? "text-slate-900 font-semibold" : "text-slate-400"}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      </button>
      {sheet}
    </div>
  );
}
