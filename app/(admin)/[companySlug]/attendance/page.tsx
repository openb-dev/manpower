"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import HrmHeader from "@/components/admin/HrmHeader";
import {
  assignStaffSite,
  fillAttendanceMonth,
  loadAttendanceBook,
  lockAttendanceMonth,
  saveAttendanceDay,
} from "../actions";

const CYCLE = [null, "PRESENT", "HALF_DAY", "ABSENT", "LEAVE", "WEEK_OFF"] as const;

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

function money(value: unknown) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function shortStatus(status?: string | null) {
  if (status === "PRESENT") return "P";
  if (status === "HALF_DAY") return "H";
  if (status === "ABSENT") return "A";
  if (status === "LEAVE") return "L";
  if (status === "WEEK_OFF") return "W";
  return "·";
}

function nextStatus(current?: string | null) {
  const index = CYCLE.indexOf((current as (typeof CYCLE)[number]) || null);
  return CYCLE[(index + 1) % CYCLE.length];
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
  for (const st of Object.values(marks)) {
    if (st === "PRESENT") presentDays += 1;
    else if (st === "HALF_DAY") halfDays += 0.5;
    else if (st === "ABSENT") absentDays += 1;
    else if (st === "LEAVE") leaveDays += 1;
    else if (st === "WEEK_OFF") weekOffDays += 1;
  }
  const payableDays = presentDays + halfDays + leaveDays + weekOffDays;
  const divisor = row.divisorDays || 26;
  const ratePerDay = row.basicRate ? Number(row.basicRate) / divisor : 0;
  return {
    ...row,
    marks,
    presentDays,
    halfDays,
    absentDays,
    leaveDays,
    weekOffDays,
    payableDays,
    estimatedGrossWages: Math.round(payableDays * ratePerDay),
  };
}

export default function AttendancePage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [view, setView] = useState<"MUSTER" | "WAGES">("MUSTER");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const sites = data?.sites || [];

  const rows = data?.rows || [];
  const days = Array.from({ length: data?.daysInMonth || 0 }, (_, i) => i + 1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row: any) =>
      [row.employeeCode, row.fullName, row.siteName, row.jobRole].join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  function loadBook() {
    setLoading(true);
    loadAttendanceBook(companySlug, monthKey)
      .then((payload) => {
        setData(payload);
        setError("");
      })
      .catch((err: any) => {
        setData(null);
        setError(err.message || "Attendance could not be loaded.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBook();
  }, [companySlug, monthKey]);

  async function cycleDay(row: any, day: number) {
    if (data?.locked) return;
    if (!row.siteId) {
      setError(`Set a duty site for ${row.fullName} before marking days.`);
      return;
    }
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    const status = nextStatus(row.marks?.[String(day)]);
    setData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: (prev.rows || []).map((item: any) =>
          item.employeeId === row.employeeId ? withMark(item, day, status) : item
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
      setError(err.message || "Attendance could not be saved.");
      loadBook();
    } finally {
      setBusy("");
    }
  }

  async function assignSite(employeeId: string, siteId: string) {
    if (!siteId) return;
    setBusy(`site-${employeeId}`);
    try {
      await assignStaffSite(companySlug, employeeId, siteId);
      setError("");
      loadBook();
    } catch (err: any) {
      setError(err.message || "Site could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function fillMonth() {
    if (data?.locked) return;
    const today = new Date();
    const throughDay =
      monthKey === currentMonthKey() ? today.getDate() : data?.daysInMonth;
    setBusy("fill");
    try {
      await fillAttendanceMonth(companySlug, monthKey, throughDay);
      loadBook();
    } catch (err: any) {
      setError(err.message || "Working days could not be filled.");
    } finally {
      setBusy("");
    }
  }

  async function lockMonth() {
    if (!confirm(`Close ${monthKey}? After this, nobody can change the attendance days for this month.`)) return;
    setBusy("lock");
    try {
      await lockAttendanceMonth(companySlug, monthKey);
      loadBook();
    } catch (err: any) {
      setError(err.message || "Month could not be locked.");
    } finally {
      setBusy("");
    }
  }

  const totals = {
    present: rows.reduce((sum: number, row: any) => sum + Number(row.presentDays || 0), 0),
    payable: rows.reduce((sum: number, row: any) => sum + Number(row.payableDays || 0), 0),
    wages: rows.reduce((sum: number, row: any) => sum + Number(row.estimatedGrossWages || 0), 0),
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <HrmHeader companySlug={companySlug} activeTab="attendance" />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500">
            Who came to work this month. Close this month only after you have checked the days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white min-h-10"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type employee name..."
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white w-full sm:w-48 min-h-10"
          />
          <button
            type="button"
            onClick={() => setView(view === "MUSTER" ? "WAGES" : "MUSTER")}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg min-h-10"
          >
            {view === "MUSTER" ? "See salary" : "See days"}
          </button>
          <button
            type="button"
            onClick={fillMonth}
            disabled={data?.locked || Boolean(busy)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg min-h-10"
          >
            {busy === "fill" ? "Please wait..." : "Mark all present"}
          </button>
          <button
            type="button"
            onClick={lockMonth}
            disabled={data?.locked || Boolean(busy)}
            className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg min-h-10 disabled:opacity-50"
            title="After you close the month, days cannot be changed."
          >
            {data?.locked ? "This month is closed" : "Close this month"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Kpi title="Employees" value={String(rows.length)} />
        <Kpi title="Days present" value={String(totals.present)} />
        <Kpi title="Days to pay" value={String(totals.payable)} />
        <Kpi title="Salary estimate" value={money(totals.wages)} />
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
        <Legend code="P" label="Came" className={STATUS_STYLE.PRESENT} />
        <Legend code="H" label="Half day" className={STATUS_STYLE.HALF_DAY} />
        <Legend code="A" label="Did not come" className={STATUS_STYLE.ABSENT} />
        <Legend code="L" label="Leave" className={STATUS_STYLE.LEAVE} />
        <Legend code="W" label="Holiday / off" className={STATUS_STYLE.WEEK_OFF} />
      </div>

      {error ? <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div> : null}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-w-0">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading attendance...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No employees found. Make someone an employee first.</div>
        ) : view === "WAGES" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 min-w-[720px]">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3">Employee no.</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Site</th>
                  <th className="p-3 text-center">Came</th>
                  <th className="p-3 text-center">Half</th>
                  <th className="p-3 text-center">Absent</th>
                  <th className="p-3 text-center">Leave</th>
                  <th className="p-3 text-center">Off</th>
                  <th className="p-3 text-center">Days to pay</th>
                  <th className="p-3">Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row: any) => (
                  <tr key={row.employeeId}>
                    <td className="p-3 font-mono font-bold text-blue-600">{row.employeeCode}</td>
                    <td className="p-3 font-semibold text-slate-900">{row.fullName}</td>
                    <td className="p-3 text-xs">{row.siteName}</td>
                    <td className="p-3 text-center font-mono text-emerald-700">{row.presentDays}</td>
                    <td className="p-3 text-center font-mono text-amber-700">{row.halfDays}</td>
                    <td className="p-3 text-center font-mono text-rose-700">{row.absentDays}</td>
                    <td className="p-3 text-center font-mono">{row.leaveDays}</td>
                    <td className="p-3 text-center font-mono text-sky-700">{row.weekOffDays}</td>
                    <td className="p-3 text-center font-mono font-bold">{row.payableDays}</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">{money(row.estimatedGrossWages)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[980px]">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2 sticky left-0 bg-slate-50 z-10 min-w-40">Name</th>
                  {days.map((day) => (
                    <th key={day} className="p-1 text-center w-8 font-mono">
                      {day}
                    </th>
                  ))}
                  <th className="p-2 text-center">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row: any) => (
                  <tr key={row.employeeId}>
                    <td className="p-2 sticky left-0 bg-white z-10 min-w-48">
                      <div className="font-semibold text-slate-900">{row.fullName}</div>
                      <div className="font-mono text-[10px] text-slate-500">{row.employeeCode}</div>
                      {row.siteId ? (
                        <div className="text-[10px] text-slate-500">{row.siteName}</div>
                      ) : (
                        <select
                          value=""
                          disabled={Boolean(busy)}
                          onChange={(e) => assignSite(row.employeeId, e.target.value)}
                          className="mt-1 w-full px-1.5 py-1 border border-amber-300 bg-amber-50 rounded text-[10px] font-bold text-amber-800"
                        >
                          <option value="">Set duty site first</option>
                          {sites.map((site: any) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    {days.map((day) => {
                      const status = row.marks?.[String(day)];
                      return (
                        <td key={day} className="p-0.5 text-center">
                          <button
                            type="button"
                            disabled={data?.locked || busy === `${row.employeeId}-${day}`}
                            onClick={() => cycleDay(row, day)}
                            className={`w-7 h-7 rounded text-[11px] font-bold ${
                              status ? STATUS_STYLE[status] : "bg-slate-50 text-slate-400"
                            } disabled:opacity-60`}
                            title={
                              status === "PRESENT"
                                ? "Came"
                                : status === "HALF_DAY"
                                ? "Half day"
                                : status === "ABSENT"
                                ? "Did not come"
                                : status === "LEAVE"
                                ? "Leave"
                                : status === "WEEK_OFF"
                                ? "Holiday / off"
                                : "Not marked. Click to change."
                            }
                          >
                            {shortStatus(status)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center font-mono font-bold">{row.payableDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100">
          {filtered.length} employees · {monthKey}
          {data?.locked ? " · this month is closed" : ""}
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</div>
      <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}

function Legend({ code, label, className }: { code: string; label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${className}`}>{code}</span>
      {label}
    </span>
  );
}
