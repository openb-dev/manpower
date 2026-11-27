"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type MenuOption = { value: string; label: string };

function menuPosition(rect: DOMRect, minWidth: number) {
  const width = Math.max(rect.width, minWidth);
  let left = rect.left;
  let top = rect.bottom + 4;
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
  if (top + 280 > window.innerHeight - 8) top = Math.max(8, rect.top - 280 - 4);
  return { top, left, width };
}

export default function SimpleMenuSelect({
  value,
  options,
  placeholder = "Select",
  disabled,
  onChange,
  className = "",
  buttonClassName = "",
  allowClear = true,
}: {
  value: string;
  options: MenuOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);

  const selected = options.find((o) => o.value === value || o.label === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
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

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos(menuPosition(rect, 220));
    openedAt.current = Date.now();
    setOpen(true);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-left hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 touch-manipulation ${buttonClassName}`}
      >
        <span className={`truncate ${selected || value ? "text-slate-900" : "text-slate-400"}`}>
          {selected?.label || value || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      </button>
      {mounted && open
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[10000] max-h-72 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-xl py-1 pointer-events-auto"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {allowClear ? (
                <button
                  type="button"
                  role="option"
                  className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 touch-manipulation"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange("");
                    setOpen(false);
                  }}
                >
                  {placeholder}
                </button>
              ) : null}
              {options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-400">No options yet — add works in Work Register</div>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={value === opt.value || value === opt.label}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 touch-manipulation ${
                      value === opt.value || value === opt.label
                        ? "bg-emerald-50 font-semibold text-emerald-900"
                        : "text-slate-800"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
