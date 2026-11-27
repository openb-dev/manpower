"use client";

import React from "react";

export type MenuOption = { value: string; label: string };

/** Native select — reliable on live (Chrome / mobile). */
export default function SimpleMenuSelect({
  value,
  options,
  placeholder = "Select",
  disabled,
  onChange,
  className = "",
  buttonClassName = "",
}: {
  value: string;
  options: MenuOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  /** Kept for call-site compatibility; applied to the select. */
  buttonClassName?: string;
  allowClear?: boolean;
}) {
  const matched = options.some((o) => o.value === value || o.label === value);
  const selectValue = matched
    ? options.find((o) => o.value === value || o.label === value)?.value || ""
    : "";

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectValue}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 cursor-pointer appearance-auto focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 touch-manipulation ${buttonClassName}`}
      >
        <option value="">{placeholder}</option>
        {options.length === 0 ? (
          <option value="" disabled>
            No options yet
          </option>
        ) : (
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        )}
      </select>
      {!options.length ? (
        <p className="mt-1 text-[10px] text-amber-700 font-medium">No list yet — add works in Work Register.</p>
      ) : null}
    </div>
  );
}
