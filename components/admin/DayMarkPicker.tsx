"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LABOUR_MARK_OPTIONS, markStyle } from "@/lib/attendanceMarks";

function menuPosition(rect: DOMRect) {
  const menuW = 120;
  const menuH = 240;
  let left = rect.left;
  let top = rect.bottom + 4;
  if (left + menuW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menuW - 8);
  if (top + menuH > window.innerHeight - 8) top = Math.max(8, rect.top - menuH - 4);
  return { top, left };
}

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
  const openedAt = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      // Ignore the same gesture that opened the menu
      if (Date.now() - openedAt.current < 250) return;
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown, true);
      document.addEventListener("touchstart", onPointerDown, true);
    }, 0);

    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("touchstart", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openMenu(e: React.MouseEvent | React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos(menuPosition(rect));
    openedAt.current = Date.now();
    setOpen(true);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || "Attendance mark"}
        className={`w-full min-w-[48px] h-8 rounded text-[10px] font-bold border border-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed relative z-20 pointer-events-auto touch-manipulation ${markStyle(value)}`}
      >
        {value || "·"}
      </button>
      {mounted && open
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[10000] w-[7.5rem] rounded-lg border border-slate-300 bg-white shadow-xl py-1 pointer-events-auto"
              style={{ top: pos.top, left: pos.left }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {LABOUR_MARK_OPTIONS.map((opt) => (
                <button
                  key={opt.value || "empty"}
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  className={`w-full text-left px-3 py-2 text-[11px] font-bold hover:bg-emerald-50 touch-manipulation ${
                    value === opt.value ? "bg-emerald-100" : ""
                  } ${markStyle(opt.value)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
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
