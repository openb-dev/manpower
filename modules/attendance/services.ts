import { prisma, getTenantPrisma } from "../../lib/db/index.ts";
import { AttendanceStatus, Prisma, ShiftType } from "@prisma/client";

export interface AttendanceEntry {
  employeeId: string;
  siteId: string;
  nominalDate: string; // YYYY-MM-DD
  status: AttendanceStatus;
  shift?: ShiftType;
  overtimeHours?: number;
}

export async function bulkMarkAttendance({
  companyId,
  markedBy,
  entries,
}: {
  companyId: string;
  markedBy: string;
  entries: AttendanceEntry[];
}) {
  const tenantDb = getTenantPrisma(companyId);

  const monthKeys = [...new Set(entries.map((entry) => entry.nominalDate.slice(0, 7)))];
  for (const monthKey of monthKeys) {
    const isLocked = await tenantDb.monthLock.findUnique({
      where: { companyId_monthKey: { companyId, monthKey } },
    });
    if (isLocked) {
      throw new Error(`Month ${monthKey} is locked. Attendance cannot be modified.`);
    }
  }

  // Atomic batch upsert
  const results = await prisma.$transaction(
    entries.map((entry) => {
      const dateObj = new Date(`${entry.nominalDate}T00:00:00.000Z`);
      return prisma.attendance.upsert({
        where: {
          companyId_employeeId_nominalDate: {
            companyId,
            employeeId: entry.employeeId,
            nominalDate: dateObj,
          },
        },
        update: {
          siteId: entry.siteId,
          status: entry.status,
          shift: entry.shift || ShiftType.DAY_8H,
          overtimeHours: new Prisma.Decimal(entry.overtimeHours || 0),
          markedBy,
          updatedAt: new Date(),
        },
        create: {
          companyId,
          employeeId: entry.employeeId,
          siteId: entry.siteId,
          nominalDate: dateObj,
          status: entry.status,
          shift: entry.shift || ShiftType.DAY_8H,
          overtimeHours: new Prisma.Decimal(entry.overtimeHours || 0),
          markedBy,
        },
      });
    })
  );

  return { success: true, recordsUpdated: results.length };
}

export async function getMonthlyAttendanceSummary({
  companyId,
  monthKey, // "YYYY-MM"
  siteId,
}: {
  companyId: string;
  monthKey: string;
  siteId?: string;
}) {
  const tenantDb = getTenantPrisma(companyId);

  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const where: any = {
    deletedAt: null,
  };
  if (siteId) where.siteId = siteId;

  const employees = await tenantDb.employee.findMany({
    where,
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      siteId: true,
      divisorDays: true,
      basicRate: true,
      site: { select: { name: true } },
      jobRole: { select: { name: true } },
      attendances: {
        where: {
          nominalDate: { gte: startDate, lt: endDate },
        },
        select: { status: true, overtimeHours: true, nominalDate: true },
      },
    },
    orderBy: { employeeCode: "asc" },
  });

  const summary = employees.map((emp) => {
    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let weekOffDays = 0;
    let totalOvertimeHours = 0;

    for (const att of emp.attendances) {
      if (att.status === AttendanceStatus.PRESENT) presentDays++;
      else if (att.status === AttendanceStatus.HALF_DAY) halfDays += 0.5;
      else if (att.status === AttendanceStatus.LEAVE) leaveDays++;
      else if (att.status === AttendanceStatus.WEEK_OFF) weekOffDays++;
      totalOvertimeHours += Number(att.overtimeHours || 0);
    }

    const payableDays = presentDays + halfDays + leaveDays + weekOffDays;
    const divisor = emp.divisorDays || 26;
    const ratePerDay = emp.basicRate ? Number(emp.basicRate) / divisor : 0;
    const grossWages = Math.round(payableDays * ratePerDay);
    const marks: Record<string, AttendanceStatus> = {};
    for (const att of emp.attendances) {
      const day = new Date(att.nominalDate).getUTCDate();
      marks[String(day)] = att.status;
    }

    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      siteId: emp.siteId,
      siteName: emp.site?.name || "Unassigned",
      jobRole: emp.jobRole.name,
      presentDays,
      halfDays,
      absentDays: emp.attendances.filter((att) => att.status === AttendanceStatus.ABSENT).length,
      leaveDays,
      weekOffDays,
      payableDays,
      totalOvertimeHours,
      divisorDays: divisor,
      basicRate: emp.basicRate ? Number(emp.basicRate) : null,
      ratePerDay: Number(ratePerDay.toFixed(2)),
      estimatedGrossWages: grossWages,
      marks,
    };
  });

  const lock = await tenantDb.monthLock.findUnique({
    where: { companyId_monthKey: { companyId, monthKey } },
  });

  return {
    monthKey,
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    locked: Boolean(lock),
    rows: summary,
  };
}

export async function setAttendanceDay({
  companyId,
  markedBy,
  employeeId,
  siteId,
  nominalDate,
  status,
}: {
  companyId: string;
  markedBy: string;
  employeeId: string;
  siteId?: string | null;
  nominalDate: string;
  status: AttendanceStatus | null;
}) {
  const monthKey = nominalDate.slice(0, 7);
  const locked = await prisma.monthLock.findUnique({
    where: { companyId_monthKey: { companyId, monthKey } },
  });
  if (locked) throw new Error(`Month ${monthKey} is locked. Attendance cannot be modified.`);

  const dateObj = new Date(`${nominalDate}T00:00:00.000Z`);
  let resolvedSiteId = siteId || null;
  if (!resolvedSiteId) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { siteId: true },
    });
    if (!employee) throw new Error("Employee not found in this company.");
    resolvedSiteId = employee.siteId;
  }
  if (!resolvedSiteId) throw new Error("Assign a site before marking attendance.");

  if (!status) {
    await prisma.attendance.deleteMany({
      where: { companyId, employeeId, nominalDate: dateObj },
    });
    return { success: true, cleared: true };
  }

  await prisma.attendance.upsert({
    where: {
      companyId_employeeId_nominalDate: { companyId, employeeId, nominalDate: dateObj },
    },
    update: {
      siteId: resolvedSiteId,
      status,
      markedBy,
    },
    create: {
      companyId,
      employeeId,
      siteId: resolvedSiteId,
      nominalDate: dateObj,
      status,
      markedBy,
    },
  });

  return { success: true, cleared: false };
}

export async function fillWorkingDays({
  companyId,
  markedBy,
  monthKey,
  throughDay,
}: {
  companyId: string;
  markedBy: string;
  monthKey: string;
  throughDay?: number;
}) {
  const locked = await prisma.monthLock.findUnique({
    where: { companyId_monthKey: { companyId, monthKey } },
  });
  if (locked) throw new Error(`Month ${monthKey} is locked. Attendance cannot be modified.`);

  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endDay = Math.min(throughDay || lastDay, lastDay);
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, siteId: { not: null } },
    select: { id: true, siteId: true },
  });

  const entries: AttendanceEntry[] = [];
  for (const employee of employees) {
    for (let day = 1; day <= endDay; day += 1) {
      const date = `${monthKey}-${String(day).padStart(2, "0")}`;
      const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
      entries.push({
        employeeId: employee.id,
        siteId: employee.siteId as string,
        nominalDate: date,
        status: weekday === 0 ? AttendanceStatus.WEEK_OFF : AttendanceStatus.PRESENT,
      });
    }
  }

  if (entries.length === 0) throw new Error("No site-assigned employees to fill.");
  return bulkMarkAttendance({ companyId, markedBy, entries });
}

export async function lockMonthAttendance({
  companyId,
  monthKey,
  lockedBy,
}: {
  companyId: string;
  monthKey: string;
  lockedBy: string;
}) {
  const tenantDb = getTenantPrisma(companyId);

  const existing = await tenantDb.monthLock.findUnique({
    where: { companyId_monthKey: { companyId, monthKey } },
  });
  if (existing) throw new Error(`Month ${monthKey} is already locked.`);

  const lock = await prisma.monthLock.create({
    data: {
      companyId,
      monthKey,
      lockedBy,
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId,
      entityType: "MONTH_LOCK",
      entityId: lock.id,
      action: "LOCK_MONTH",
      newValue: { monthKey, lockedBy },
    },
  });

  return lock;
}
