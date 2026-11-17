"use client";

import { OTHER_SITE_VALUE } from "@/lib/nkSiteList";

type SiteOption = { id: string; name: string };

export { OTHER_SITE_VALUE };

export function siteChoiceReady(siteId: string, otherName: string) {
  if (!siteId) return false;
  if (siteId === OTHER_SITE_VALUE) return Boolean(String(otherName || "").trim());
  return true;
}

export function DutySiteSelect({
  sites,
  value,
  otherName,
  onValueChange,
  onOtherNameChange,
  required,
  selectClassName,
  emptyLabel = "Select duty site",
}: {
  sites: SiteOption[];
  value: string;
  otherName: string;
  onValueChange: (value: string) => void;
  onOtherNameChange: (value: string) => void;
  required?: boolean;
  selectClassName?: string;
  emptyLabel?: string;
}) {
  const showOther = value === OTHER_SITE_VALUE;
  return (
    <div className="space-y-2">
      <select
        required={required}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onValueChange(next);
          if (next !== OTHER_SITE_VALUE) onOtherNameChange("");
        }}
        className={selectClassName}
      >
        <option value="">{emptyLabel}</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
        <option value={OTHER_SITE_VALUE}>Other</option>
      </select>
      {showOther ? (
        <input
          type="text"
          required={required}
          autoFocus
          value={otherName}
          onChange={(e) => onOtherNameChange(e.target.value)}
          placeholder="Enter site name"
          className={selectClassName}
        />
      ) : null}
    </div>
  );
}
