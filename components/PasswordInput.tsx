"use client";

import { useState } from "react";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`pr-14 ${className}`.trim()}
      />
      <button
        type="button"
        onClick={() => setVisible((open) => !open)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-blue-700 hover:text-blue-900 px-1.5 py-1 rounded"
        aria-label={visible ? "Hide password" : "View password"}
      >
        {visible ? "Hide" : "View"}
      </button>
    </div>
  );
}
