export const WORK_LIST_TRACKS = ["manpower", "construction"] as const;

export type WorkListTrack = (typeof WORK_LIST_TRACKS)[number];

export function isWorkListTrack(value: unknown): value is WorkListTrack {
  return value === "manpower" || value === "construction";
}

export function workListTrackLabel(track: WorkListTrack) {
  return track === "manpower" ? "Manpower" : "Construction";
}

export function workListTrackNote(track: WorkListTrack) {
  return track === "manpower"
    ? "Manpower works, registers, progress and expenditure"
    : "Construction works, registers, progress and expenditure";
}

/** Main items after opening Manpower or Construction */
export function workListTrackItems(companySlug: string, track: WorkListTrack) {
  const base = `/${companySlug}/work-list/${track}`;
  return [
    {
      id: "register",
      label: "Work Register",
      note: "Tender, EMD, PG and work register",
      href: `/${companySlug}/crm?track=${track}`,
    },
    {
      id: "progress",
      label: "Work Progress Report",
      note: "BOQ, R.A. bills and balance work",
      href: `/${companySlug}/progress?track=${track}`,
    },
    {
      id: "expenditure",
      label: "Work Expenditure",
      note: "Purchase, labour payment, attendance, petty cash",
      href: `${base}/expenditure`,
    },
  ] as const;
}

/** Sub-items under Work Expenditure */
export function workListExpenditureItems(companySlug: string, track: WorkListTrack) {
  const base = `/${companySlug}/work-list/${track}/expenditure`;
  const q = `track=${track}&from=work-list`;
  return [
    {
      id: "purchase",
      label: "Items Purchase",
      note: "Item, qty, shop, bill, payment and delivery — client sheet",
      href: `${base}/purchase`,
    },
    {
      id: "labour-payment",
      label: "Labour Payment",
      note: "Salary Calculation Summary — EPF / ESI sheet",
      href: `${base}/labour-payment`,
    },
    {
      id: "individual-payment",
      label: "Individual Payment",
      note: "One-person / single voucher payments",
      href: `/${companySlug}/finance?${q}&focus=individual`,
    },
    {
      id: "attendance",
      label: "Labour Attendance",
      note: "Work attendance sheet — Name of work, days P/H/A",
      href: `${base}/attendance`,
    },
    {
      id: "office-admin",
      label: "Office Administration",
      note: "Office admin costs for running the work",
      href: `/${companySlug}/finance?${q}&focus=office`,
    },
    {
      id: "received-expenses",
      label: "Received & Expenses",
      note: "Money received and money spent",
      href: `/${companySlug}/finance?${q}&focus=cash`,
    },
    {
      id: "petty-cash",
      label: "Total Expenditure (Petty Cash)",
      note: "Combined expenditure / petty cash total",
      href: `/${companySlug}/finance?${q}&focus=petty`,
    },
  ] as const;
}
