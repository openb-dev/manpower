import { AttendanceStatus } from "@prisma/client";

/** Labour Attendance dropdown marks (Leave / Off removed). */
export const LABOUR_MARK_OPTIONS = [
  { value: "", label: "—" },
  { value: "P", label: "P" },
  { value: "P/0.5", label: "P/0.5" },
  { value: "P/1.5", label: "P/1.5" },
  { value: "P/2", label: "P/2" },
  { value: "A", label: "A" },
] as const;

export type LabourMark = "P" | "P/0.5" | "P/1.5" | "P/2" | "A";

export function markToStatusAndUnits(mark: string | null | undefined): {
  status: AttendanceStatus | null;
  overtimeHours: number;
} {
  if (!mark) return { status: null, overtimeHours: 0 };
  switch (mark) {
    case "P":
      return { status: AttendanceStatus.PRESENT, overtimeHours: 0 };
    case "P/0.5":
      return { status: AttendanceStatus.HALF_DAY, overtimeHours: 0 };
    case "P/1.5":
      return { status: AttendanceStatus.PRESENT, overtimeHours: 1.5 };
    case "P/2":
      return { status: AttendanceStatus.PRESENT, overtimeHours: 2 };
    case "A":
      return { status: AttendanceStatus.ABSENT, overtimeHours: 0 };
    default:
      return { status: null, overtimeHours: 0 };
  }
}

export function statusToLabourMark(
  status: AttendanceStatus | string | null | undefined,
  overtimeHours: number | string | null | undefined = 0,
): string {
  if (!status) return "";
  const ot = Number(overtimeHours || 0);
  if (status === AttendanceStatus.ABSENT || status === "ABSENT") return "A";
  if (status === AttendanceStatus.HALF_DAY || status === "HALF_DAY") return "P/0.5";
  if (status === AttendanceStatus.PRESENT || status === "PRESENT") {
    if (ot === 1.5) return "P/1.5";
    if (ot === 2) return "P/2";
    if (ot > 0 && ot !== 1) {
      if (Math.abs(ot - 1.5) < 0.01) return "P/1.5";
      if (Math.abs(ot - 2) < 0.01) return "P/2";
    }
    return "P";
  }
  // Leave / Off no longer used on labour sheet — show blank so user can re-mark
  return "";
}

/** Payable / present day units for one attendance row. */
export function dayUnitsForAttendance(
  status: AttendanceStatus | string | null | undefined,
  overtimeHours: number | string | null | undefined = 0,
): number {
  if (!status) return 0;
  if (status === AttendanceStatus.ABSENT || status === "ABSENT") return 0;
  if (status === AttendanceStatus.HALF_DAY || status === "HALF_DAY") return 0.5;
  if (status === AttendanceStatus.LEAVE || status === "LEAVE") return 1;
  if (status === AttendanceStatus.WEEK_OFF || status === "WEEK_OFF") return 1;
  if (status === AttendanceStatus.PRESENT || status === "PRESENT") {
    const ot = Number(overtimeHours || 0);
    return ot > 0 ? ot : 1;
  }
  return 0;
}

export function markStyle(mark: string): string {
  if (mark === "A") return "bg-rose-100 text-rose-800";
  if (mark === "P/0.5") return "bg-amber-100 text-amber-800";
  if (mark === "P/1.5" || mark === "P/2") return "bg-emerald-200 text-emerald-900";
  if (mark === "P") return "bg-emerald-100 text-emerald-800";
  return "bg-white text-slate-400";
}
