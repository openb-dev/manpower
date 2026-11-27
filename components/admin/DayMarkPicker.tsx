"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LABOUR_MARK_OPTIONS, markStyle } from "@/lib/attendanceMarks";

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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function place() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuW = 112;
      const menuH = 220;
      let left = rect.left;
      let top = rect.bottom + 4;
      if (left + menuW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuW - 8);
      if (top + menuH > window.innerHeight - 8) top = Math.max(8, rect.top - menuH - 4);
      setPos({ top, left });
    }

    place();

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    function onReposition() {
      place();
    }

    function onScrollClose() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    // close on scroll of any ancestor so menu doesn't float wrongly
    window.addEventListener("scroll", onScrollClose, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onScrollClose, true);
    };
  }, [open]);

  function toggle() {
    if (disabled) return;
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || "Attendance mark"}
        className={`w-full min-w-[48px] h-7 rounded text-[10px] font-bold border border-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed relative z-10 pointer-events-auto ${markStyle(value)}`}
      >
        {value || "·"}
      </button>
      {mounted && open
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[9999] w-28 rounded-lg border border-slate-300 bg-white shadow-xl py-1 pointer-events-auto"
              style={{ top: pos.top, left: pos.left }}
            >
              {LABOUR_MARK_OPTIONS.map((opt) => (
                <button
                  key={opt.value || "empty"}
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-bold hover:bg-emerald-50 ${
                    value === opt.value ? "bg-emerald-100" : ""
                  } ${markStyle(opt.value)}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
