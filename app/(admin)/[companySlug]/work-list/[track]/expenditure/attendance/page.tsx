"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import {
  loadAttendanceBook,
  loadCrmBook,
  saveAttendanceDay,
} from "../../../../actions";
import { friendlyPublicError } from "@/lib/publicErrors";
import { isWorkListTrack, workListTrackLabel, type WorkListTrack } from "@/lib/workList";

const CYCLE = [null, "PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "WEEK_OFF"] as const;
type MarkStatus = (typeof CYCLE)[number];

const STATUS_STYLE: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800",
  HALF_DAY: "bg-amber-100 text-amber-800",
  ABSENT: "bg-rose-100 text-rose-800",
  LEAVE: "bg-slate-200 text-slate-700",
  WEEK_OFF: "bg-sky-100 text-sky-800",
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shortStatus(status?: string | null) {
  if (status === "PRESENT") return "P";
  if (status === "HALF_DAY") return "H";
  if (status === "ABSENT") return "A";
  if (status === "LEAVE") return "L";
  if (status === "WEEK_OFF") return "W";
  return "";
}

function withMark(row: any, day: number, status: string | null) {
  const marks = { ...(row.marks || {}) };
  if (status) marks[String(day)] = status;
  else delete marks[String(day)];
  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let weekOffDays = 0;
  for (const st of Object.values(marks) as string[]) {
    if (st === "PRESENT") presentDays += 1;
    else if (st === "HALF_DAY") halfDays += 0.5;
    else if (st === "ABSENT") absentDays += 1;
    else if (st === "LEAVE") leaveDays += 1;
    else if (st === "WEEK_OFF") weekOffDays += 1;
  }
  const totalWorkingDay = presentDays + halfDays + leaveDays + weekOffDays + absentDays;
  const totalPresent = presentDays + halfDays;
  const payableDays = presentDays + halfDays + leaveDays + weekOffDays;
  return {
    ...row,
    marks,
    presentDays,
    halfDays,
    absentDays,
    leaveDays,
    weekOffDays,
    totalWorkingDay,
    totalPresent,
    payableDays,
  };
}

export default function WorkExpenditureAttendancePage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;
  const trackParam = params?.track as string;
  if (!isWorkListTrack(trackParam)) notFound();
  const track = trackParam as WorkListTrack;

  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [nameOfWork, setNameOfWork] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [contracts, setContracts] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [paintStatus, setPaintStatus] = useState<Exclude<MarkStatus, null>>("PRESENT");
  const [companyName, setCompanyName] = useState("M/s. N.K. Enterprise");

  const days = Array.from({ length: data?.daysInMonth || 31 }, (_, i) => i + 1);
  const rows = data?.rows || [];

  const monthLabel = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  }, [monthKey]);

  const fromTo = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      from: `01/${pad(m)}/${y}`,
      to: `${pad(last)}/${pad(m)}/${y}`,
    };
  }, [monthKey]);

  function loadBook() {
    setLoading(true);
    Promise.all([loadAttendanceBook(companySlug, monthKey), loadCrmBook(companySlug).catch(() => null)])
      .then(([attendance, crm]) => {
        setData({
          ...attendance,
          rows: (attendance.rows || []).map((row: any) => {
            let presentDays = Number(row.presentDays || 0);
            let halfDays = Number(row.halfDays || 0);
            let absentDays = Number(row.absentDays || 0);
            let leaveDays = Number(row.leaveDays || 0);
            let weekOffDays = Number(row.weekOffDays || 0);
            return {
              ...row,
              totalWorkingDay: presentDays + halfDays + leaveDays + weekOffDays + absentDays,
              totalPresent: presentDays + halfDays,
            };
          }),
        });
        if (attendance.companyName) setCompanyName(attendance.companyName);
        setContracts(crm?.contracts || []);
        setError("");
      })
      .catch((err: any) => {
        setData(null);
        setError(friendlyPublicError(err.message || "Attendance could not be loaded."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBook();
  }, [companySlug, monthKey]);

  async function setDay(row: any, day: number, next: MarkStatus) {
    if (data?.locked) return;
    if (!row.siteId) {
      setError(`${row.fullName} has no duty site.`);
      return;
    }
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    const current = row.marks?.[String(day)] || null;
    const status: MarkStatus = current === next ? null : next;
    setData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: (prev.rows || []).map((item: any) =>
          item.employeeId === row.employeeId ? withMark(item, day, status) : item,
        ),
      };
    });
    setBusy(`${row.employeeId}-${day}`);
    try {
      await saveAttendanceDay(companySlug, {
        employeeId: row.employeeId,
        siteId: row.siteId,
        nominalDate: date,
        status,
      });
      setError("");
    } catch (err: any) {
      setError(friendlyPublicError(err.message || "Attendance could not be saved."));
      loadBook();
    } finally {
      setBusy("");
    }
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc: any, row: any) => {
        acc.working += Number(row.totalWorkingDay || 0);
        acc.present += Number(row.totalPresent || 0);
        acc.absent += Number(row.absentDays || 0);
        acc.days += Number(row.payableDays || 0);
        return acc;
      },
      { working: 0, present: 0, absent: 0, days: 0 },
    );
  }, [rows]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
          <Link href={`/${companySlug}/work-list`} className="font-semibold text-blue-700 hover:underline">
            Work List
          </Link>
          <span>/</span>
          <Link href={`/${companySlug}/work-list/${track}`} className="font-semibold text-blue-700 hover:underline">
            {workListTrackLabel(track)}
          </Link>
          <span>/</span>
          <Link
            href={`/${companySlug}/work-list/${track}/expenditure`}
            className="font-semibold text-blue-700 hover:underline"
          >
            Work Expenditure
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-700">Labour Attendance</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
          <CalendarCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Labour Attendance
        </span>
        <h1 className="text-xl font-bold text-slate-900 mt-2">{companyName}</h1>
        <p className="text-sm text-slate-500">
          Attendance sheet for the month of {monthLabel} (From {fromTo.from} To {fromTo.to})
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <label className="text-xs font-bold text-slate-700 block">
          Month
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-700 block md:col-span-1 xl:col-span-1">
          Name Of Work
          <input
            list="work-names"
            value={nameOfWork}
            onChange={(e) => setNameOfWork(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Select or type"
          />
          <datalist id="work-names">
            {contracts.map((c) => (
              <option key={c.id} value={c.workName || c.clientName || ""} />
            ))}
          </datalist>
        </label>
        <label className="text-xs font-bold text-slate-700 block">
          Department Name
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-700 block">
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mark with</div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["PRESENT", "P", "Came"],
              ["HALF_DAY", "H", "Half day"],
              ["ABSENT", "A", "Absent"],
              ["LEAVE", "L", "Leave"],
              ["WEEK_OFF", "W", "Off"],
            ] as const
          ).map(([status, code, label]) => (
            <button
              key={status}
              type="button"
              onClick={() => setPaintStatus(status)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] ${
                paintStatus === status
                  ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${STATUS_STYLE[status]}`}>
                {code}
              </span>
              <span className="font-semibold text-slate-700">{label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 sm:ml-auto">
          Click day boxes to fill <span className="font-bold">{shortStatus(paintStatus)}</span>. Same mark again clears.
        </p>
      </div>

      {error ? <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div> : null}

      {loading ? (
        <div className="p-10 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">Loading...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-400 bg-white rounded-lg shadow-sm">
          <table className="min-w-[1800px] w-max text-[10px] text-slate-800 border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[48px]">
                  Sl No.
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[150px]">
                  Name
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[120px]">
                  Designation
                </th>
                <th colSpan={days.length} className="border border-slate-400 p-1.5 text-center">
                  Date
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[64px]">
                  Total Days
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[72px]">
                  Total Working Day
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[64px]">
                  Total Present
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[64px]">
                  Total Absent
                </th>
              </tr>
              <tr className="bg-slate-50">
                {days.map((day) => (
                  <th key={day} className="border border-slate-400 p-1 text-center min-w-[28px] font-mono">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3 + days.length + 4} className="border border-slate-400 p-8 text-center text-slate-400">
                    No employees found.
                  </td>
                </tr>
              ) : (
                rows.map((row: any, i: number) => (
                  <tr key={row.employeeId} className="hover:bg-emerald-50/30">
                    <td className="border border-slate-400 p-1 text-center">{i + 1}</td>
                    <td className="border border-slate-400 p-1 font-semibold whitespace-nowrap">{row.fullName}</td>
                    <td className="border border-slate-400 p-1 whitespace-nowrap">
                      {row.designation || row.jobRole || "—"}
                    </td>
                    {days.map((day) => {
                      const status = row.marks?.[String(day)];
                      return (
                        <td key={day} className="border border-slate-400 p-0.5 text-center">
                          <button
                            type="button"
                            disabled={data?.locked || busy === `${row.employeeId}-${day}`}
                            onClick={() => void setDay(row, day, paintStatus)}
                            className={`w-6 h-6 rounded text-[10px] font-bold ${
                              status ? STATUS_STYLE[status] : "bg-white text-slate-300"
                            } disabled:opacity-50`}
                          >
                            {shortStatus(status) || "·"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="border border-slate-400 p-1 text-center font-mono font-bold">
                      {row.payableDays || 0}
                    </td>
                    <td className="border border-slate-400 p-1 text-center font-mono font-bold">
                      {row.totalWorkingDay || 0}
                    </td>
                    <td className="border border-slate-400 p-1 text-center font-mono text-emerald-700">
                      {row.totalPresent || 0}
                    </td>
                    <td className="border border-slate-400 p-1 text-center font-mono text-rose-700">
                      {row.absentDays || 0}
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-emerald-50 font-bold">
                <td className="border border-slate-400 p-1.5 text-right" colSpan={3 + days.length}>
                  Total =
                </td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.days}</td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.working}</td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.present}</td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.absent}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
