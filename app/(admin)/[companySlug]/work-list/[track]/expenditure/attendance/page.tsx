"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";
import {
  loadAttendanceBook,
  loadCrmBook,
  saveAttendanceDay,
} from "../../../../actions";
import { friendlyPublicError } from "@/lib/publicErrors";
import { isWorkListTrack, workListTrackLabel, type WorkListTrack } from "@/lib/workList";
import {
  LABOUR_MARK_OPTIONS,
  dayUnitsForAttendance,
  markStyle,
  markToStatusAndUnits,
  statusToLabourMark,
} from "@/lib/attendanceMarks";

type SheetRow = {
  rowKey: string;
  employeeId: string;
  siteId: string;
  fullName: string;
  designation: string;
  markCodes: Record<string, string>;
  presentDays: number;
  absentDays: number;
  payableDays: number;
  totalWorkingDay: number;
  totalPresent: number;
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function newEmptyRow(): SheetRow {
  return {
    rowKey: `row-${crypto.randomUUID()}`,
    employeeId: "",
    siteId: "",
    fullName: "",
    designation: "",
    markCodes: {},
    presentDays: 0,
    absentDays: 0,
    payableDays: 0,
    totalWorkingDay: 0,
    totalPresent: 0,
  };
}

function totalsFromMarks(markCodes: Record<string, string>) {
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
    totalWorkingDay: presentDays + absentDays,
    totalPresent: presentDays,
  };
}

function recomputeMarks(row: SheetRow, day: number, mark: string): SheetRow {
  const markCodes = { ...row.markCodes };
  if (mark) markCodes[String(day)] = mark;
  else delete markCodes[String(day)];
  return { ...row, markCodes, ...totalsFromMarks(markCodes) };
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
  const [employees, setEmployees] = useState<any[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([newEmptyRow()]);
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [companyName, setCompanyName] = useState("M/s. N.K. Enterprise");

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

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
        const catalog = attendance.rows || [];
        setEmployees(catalog);
        setDaysInMonth(attendance.daysInMonth || 31);
        setLocked(Boolean(attendance.locked));
        if (attendance.companyName) setCompanyName(attendance.companyName);
        setContracts(crm?.contracts || []);

        // Keep sheet blank for typing — only restore rows that already have marks this month
        const withMarks = catalog
          .filter((row: any) => Object.keys(row.marks || row.markCodes || {}).length > 0)
          .map((row: any) => {
            const markCodes: Record<string, string> = { ...(row.markCodes || {}) };
            if (!row.markCodes) {
              for (const [day, status] of Object.entries(row.marks || {})) {
                markCodes[day] = statusToLabourMark(status as string, 0);
              }
            }
            return {
              rowKey: `emp-${row.employeeId}`,
              employeeId: row.employeeId,
              siteId: row.siteId || "",
              // Restored from saved marks — new Add row lines stay blank for typing
              fullName: row.fullName || "",
              designation: row.designation || row.jobRole || "",
              markCodes,
              ...totalsFromMarks(markCodes),
            } satisfies SheetRow;
          });

        setRows(withMarks.length ? withMarks : [newEmptyRow()]);
        setError("");
      })
      .catch((err: any) => {
        setEmployees([]);
        setRows([newEmptyRow()]);
        setError(friendlyPublicError(err.message || "Attendance could not be loaded."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBook();
  }, [companySlug, monthKey]);

  function patchRow(rowKey: string, patch: Partial<SheetRow>) {
    setRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  }

  function onNameChange(row: SheetRow, value: string) {
    const match = employees.find(
      (e) => String(e.fullName || "").trim().toLowerCase() === value.trim().toLowerCase(),
    );
    patchRow(row.rowKey, {
      fullName: value,
      employeeId: match?.employeeId || "",
      siteId: match?.siteId || "",
      // Designation stays whatever user typed — do not auto-fill
    });
  }

  function addRow() {
    setRows((prev) => [...prev, newEmptyRow()]);
  }

  function removeRow(rowKey: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.rowKey !== rowKey);
      return next.length ? next : [newEmptyRow()];
    });
  }

  async function onMarkChange(row: SheetRow, day: number, mark: string) {
    if (locked) return;
    if (!row.fullName.trim()) {
      setError("Enter the employee name first.");
      return;
    }
    if (!row.employeeId || !row.siteId) {
      setError(
        `"${row.fullName.trim()}" is not in Employees yet, or has no duty site. Pick a name from the list (or add them under Employees first).`,
      );
      return;
    }

    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    setRows((prev) => prev.map((r) => (r.rowKey === row.rowKey ? recomputeMarks(r, day, mark) : r)));
    setBusy(`${row.rowKey}-${day}`);
    try {
      await saveAttendanceDay(companySlug, {
        employeeId: row.employeeId,
        siteId: row.siteId,
        nominalDate: date,
        mark: mark || null,
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
      (acc, row) => {
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
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
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add row
        </button>
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
        <label className="text-xs font-bold text-slate-700 block">
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

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
        <span className="font-bold uppercase tracking-wider text-slate-500">Marks</span>
        {LABOUR_MARK_OPTIONS.filter((o) => o.value).map((o) => (
          <span
            key={o.value}
            className={`inline-flex items-center px-2 py-0.5 rounded border border-slate-200 font-bold ${markStyle(o.value)}`}
          >
            {o.label}
          </span>
        ))}
        <p className="text-slate-500 sm:ml-auto">
          Type Name / Designation, then choose a mark in each day box. Use Add row for more people.
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
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[160px]">
                  Name
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[130px]">
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
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[44px]">
                 {" "}
                </th>
              </tr>
              <tr className="bg-slate-50">
                {days.map((day) => (
                  <th key={day} className="border border-slate-400 p-1 text-center min-w-[52px] font-mono">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.rowKey} className="hover:bg-emerald-50/30">
                  <td className="border border-slate-400 p-1 text-center">{i + 1}</td>
                  <td className="border border-slate-400 p-0.5">
                    <input
                      list="employee-names"
                      value={row.fullName}
                      onChange={(e) => onNameChange(row, e.target.value)}
                      placeholder="Employee name"
                      className="w-full min-w-[140px] px-1.5 py-1 border-0 bg-transparent text-[10px] font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded"
                    />
                  </td>
                  <td className="border border-slate-400 p-0.5">
                    <input
                      value={row.designation}
                      onChange={(e) => patchRow(row.rowKey, { designation: e.target.value })}
                      placeholder="Designation"
                      className="w-full min-w-[110px] px-1.5 py-1 border-0 bg-transparent text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded"
                    />
                  </td>
                  {days.map((day) => {
                    const mark = row.markCodes?.[String(day)] || "";
                    const cellBusy = busy === `${row.rowKey}-${day}`;
                    return (
                      <td key={day} className="border border-slate-400 p-0.5 text-center">
                        <select
                          value={mark}
                          disabled={locked || cellBusy}
                          onChange={(e) => void onMarkChange(row, day, e.target.value)}
                          className={`w-full min-w-[48px] h-7 rounded text-[10px] font-bold border border-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 ${markStyle(mark)}`}
                          aria-label={`Day ${day}`}
                        >
                          {LABOUR_MARK_OPTIONS.map((opt) => (
                            <option key={opt.value || "empty"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
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
                  <td className="border border-slate-400 p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.rowKey)}
                      className="inline-flex text-rose-600 hover:text-rose-800"
                      aria-label="Remove row"
                      title="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-emerald-50 font-bold">
                <td className="border border-slate-400 p-1.5 text-right" colSpan={3 + days.length}>
                  Total =
                </td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.days}</td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.working}</td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.present}</td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.absent}</td>
                <td className="border border-slate-400 p-1.5" />
              </tr>
            </tbody>
          </table>
          <datalist id="employee-names">
            {employees.map((e) => (
              <option key={e.employeeId} value={e.fullName || ""} />
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}
