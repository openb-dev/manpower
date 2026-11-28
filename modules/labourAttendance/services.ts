import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  dayUnitsForAttendance,
  markToStatusAndUnits,
} from "@/lib/attendanceMarks";

export type LabourMarks = Record<string, string>;

function asMarks(value: unknown): LabourMarks {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: LabourMarks = {};
  for (const [day, mark] of Object.entries(value as Record<string, unknown>)) {
    if (typeof mark === "string" && mark) out[day] = mark;
  }
  return out;
}

function parseWage(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function totalsFromMarks(markCodes: LabourMarks) {
  let presentDays = 0;
  let absentDays = 0;
  let payableDays = 0;
  for (const code of Object.values(markCodes)) {
    const mapped = markToStatusAndUnits(code);
    const units = dayUnitsForAttendance(mapped.status, mapped.overtimeHours);
    if (code === "A") {
      absentDays += 1;
      continue;
    }
    presentDays += units;
    payableDays += units;
  }
  return {
    presentDays,
    absentDays,
    payableDays,
    totalWorkingDay: presentDays,
    totalPresent: presentDays,
  };
}

function mapRow(row: {
  id: string;
  companyId: string;
  track: string;
  monthKey: string;
  nameOfWork: string;
  departmentName: string;
  location: string;
  fullName: string;
  designation: string;
  wagePerDay?: unknown;
  jobDescription?: string | null;
  marks: unknown;
  sortOrder: number;
}) {
  const markCodes = asMarks(row.marks);
  const wage = parseWage(row.wagePerDay);
  return {
    id: row.id,
    companyId: row.companyId,
    track: row.track,
    monthKey: row.monthKey,
    nameOfWork: row.nameOfWork || "",
    departmentName: row.departmentName || "",
    location: row.location || "",
    fullName: row.fullName || "",
    designation: row.designation || "",
    wagePerDay: wage,
    jobDescription: row.jobDescription || "",
    markCodes,
    sortOrder: row.sortOrder || 0,
    ...totalsFromMarks(markCodes),
  };
}

function daysInMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function rowFields(input: {
  track: string;
  monthKey: string;
  nameOfWork?: string;
  departmentName?: string;
  location?: string;
  fullName: string;
  designation?: string;
  wagePerDay?: number | string | null;
  jobDescription?: string;
}) {
  const wage = parseWage(input.wagePerDay);
  return {
    track: input.track,
    monthKey: input.monthKey,
    nameOfWork: String(input.nameOfWork || "").trim(),
    departmentName: String(input.departmentName || "").trim(),
    location: String(input.location || "").trim(),
    fullName: String(input.fullName || "").trim(),
    designation: String(input.designation || "").trim(),
    wagePerDay: wage == null ? null : new Prisma.Decimal(wage),
    jobDescription: String(input.jobDescription || "").trim(),
  };
}

export async function listLabourAttendance({
  companyId,
  track,
  monthKey,
  nameOfWork,
}: {
  companyId: string;
  track: string;
  monthKey: string;
  nameOfWork?: string;
}) {
  const where: {
    companyId: string;
    track: string;
    monthKey: string;
    deletedAt: null;
    nameOfWork?: string;
  } = {
    companyId,
    track,
    monthKey,
    deletedAt: null,
  };
  const work = String(nameOfWork || "").trim();
  if (work) where.nameOfWork = work;

  const rows = await prisma.labourAttendanceRow.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    monthKey,
    daysInMonth: daysInMonthKey(monthKey),
    locked: false,
    rows: rows.map(mapRow),
  };
}

export async function saveLabourAttendanceMark({
  companyId,
  rowId,
  track,
  monthKey,
  nameOfWork,
  departmentName,
  location,
  jobDescription,
  fullName,
  designation,
  wagePerDay,
  day,
  mark,
  sortOrder,
}: {
  companyId: string;
  rowId?: string | null;
  track: string;
  monthKey: string;
  nameOfWork?: string;
  departmentName?: string;
  location?: string;
  jobDescription?: string;
  fullName: string;
  designation?: string;
  wagePerDay?: number | string | null;
  day: number;
  mark: string | null;
  sortOrder?: number;
}) {
  const name = String(fullName || "").trim();
  if (!name) throw new Error("Enter the employee name first.");
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("Choose a valid month.");
  }
  const dayNum = Number(day);
  const maxDay = daysInMonthKey(monthKey);
  if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > maxDay) {
    throw new Error("Invalid day for this month.");
  }

  const dayKey = String(dayNum);
  const nextMark = String(mark || "").trim();
  const fields = rowFields({
    track,
    monthKey,
    nameOfWork,
    departmentName,
    location,
    fullName: name,
    designation,
    wagePerDay,
    jobDescription,
  });

  if (rowId) {
    const existing = await prisma.labourAttendanceRow.findFirst({
      where: { id: rowId, companyId, deletedAt: null },
    });
    if (!existing) throw new Error("Attendance row not found.");

    const markCodes = asMarks(existing.marks);
    if (nextMark) markCodes[dayKey] = nextMark;
    else delete markCodes[dayKey];

    const row = await prisma.labourAttendanceRow.update({
      where: { id: rowId },
      data: {
        ...fields,
        marks: markCodes,
        sortOrder: sortOrder ?? existing.sortOrder,
      },
    });
    return mapRow(row);
  }

  const markCodes: LabourMarks = {};
  if (nextMark) markCodes[dayKey] = nextMark;

  const count = await prisma.labourAttendanceRow.count({
    where: { companyId, track, monthKey, deletedAt: null },
  });

  const row = await prisma.labourAttendanceRow.create({
    data: {
      companyId,
      ...fields,
      marks: markCodes,
      sortOrder: sortOrder ?? count,
    },
  });
  return mapRow(row);
}

export async function saveLabourAttendanceRowMeta({
  companyId,
  rowId,
  track,
  monthKey,
  nameOfWork,
  departmentName,
  location,
  jobDescription,
  fullName,
  designation,
  wagePerDay,
  sortOrder,
}: {
  companyId: string;
  rowId?: string | null;
  track: string;
  monthKey: string;
  nameOfWork?: string;
  departmentName?: string;
  location?: string;
  jobDescription?: string;
  fullName: string;
  designation?: string;
  wagePerDay?: number | string | null;
  sortOrder?: number;
}) {
  const name = String(fullName || "").trim();
  if (!name) throw new Error("Enter the employee name first.");

  const fields = rowFields({
    track,
    monthKey,
    nameOfWork,
    departmentName,
    location,
    fullName: name,
    designation,
    wagePerDay,
    jobDescription,
  });

  if (rowId) {
    const existing = await prisma.labourAttendanceRow.findFirst({
      where: { id: rowId, companyId, deletedAt: null },
    });
    if (!existing) throw new Error("Attendance row not found.");
    const row = await prisma.labourAttendanceRow.update({
      where: { id: rowId },
      data: {
        ...fields,
        sortOrder: sortOrder ?? existing.sortOrder,
      },
    });
    return mapRow(row);
  }

  const count = await prisma.labourAttendanceRow.count({
    where: { companyId, track, monthKey, deletedAt: null },
  });
  const row = await prisma.labourAttendanceRow.create({
    data: {
      companyId,
      ...fields,
      marks: {},
      sortOrder: sortOrder ?? count,
    },
  });
  return mapRow(row);
}

export async function deleteLabourAttendanceRow({
  companyId,
  rowId,
}: {
  companyId: string;
  rowId: string;
}) {
  const existing = await prisma.labourAttendanceRow.findFirst({
    where: { id: rowId, companyId, deletedAt: null },
  });
  if (!existing) return { success: true };
  await prisma.labourAttendanceRow.update({
    where: { id: rowId },
    data: { deletedAt: new Date() },
  });
  return { success: true };
}
