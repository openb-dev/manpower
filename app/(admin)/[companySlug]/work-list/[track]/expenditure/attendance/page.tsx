"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { CalendarCheck, Download, Eye, FileSpreadsheet, FileText, Plus, Printer, Trash2 } from "lucide-react";
import {
  loadCrmBook,
  loadLabourAttendanceBook,
  removeLabourAttendanceRow,
  saveLabourAttendanceDay,
  saveLabourAttendancePerson,
} from "../../../../actions";
import { friendlyPublicError } from "@/lib/publicErrors";
import { isWorkListTrack, workListTrackLabel, type WorkListTrack } from "@/lib/workList";
import {
  LABOUR_MARK_OPTIONS,
  dayUnitsForAttendance,
  markStyle,
  markToStatusAndUnits,
} from "@/lib/attendanceMarks";
import {
  downloadLabourAttendanceExcel,
  type LabourAttendanceExportRow,
} from "@/lib/downloadLabourAttendanceExcel";
import {
  downloadLabourAttendancePdf,
  printLabourAttendancePdf,
} from "@/lib/downloadLabourAttendancePdf";
import DayMarkPicker from "@/components/admin/DayMarkPicker";
import ListPicker from "@/components/admin/ListPicker";

type SheetRow = {
  rowKey: string;
  id: string;
  fullName: string;
  designation: string;
  wagePerDay: string;
  jobDescription: string;
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
    id: "",
    fullName: "",
    designation: "",
    wagePerDay: "",
    jobDescription: "",
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
    totalWorkingDay: presentDays,
    totalPresent: presentDays,
  };
}

function recomputeMarks(row: SheetRow, day: number, mark: string): SheetRow {
  const markCodes = { ...row.markCodes };
  if (mark) markCodes[String(day)] = mark;
  else delete markCodes[String(day)];
  return { ...row, markCodes, ...totalsFromMarks(markCodes) };
}

function wagePayload(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toExportRow(row: SheetRow, daysInMonth: number): LabourAttendanceExportRow {
  return {
    fullName: row.fullName,
    designation: row.designation,
    wagePerDay: row.wagePerDay,
    jobDescription: row.jobDescription,
    markCodes: row.markCodes,
    totalDays: daysInMonth,
    totalPresent: row.totalPresent || 0,
    totalAbsent: row.absentDays || 0,
    totalWorkingDay: row.totalWorkingDay || 0,
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
  const [rows, setRows] = useState<SheetRow[]>([newEmptyRow()]);
  const [daysInMonth, setDaysInMonth] = useState(31);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [exportBusy, setExportBusy] = useState("");
  const [companyName, setCompanyName] = useState("M/s. N.K. Enterprise");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewRowKey, setViewRowKey] = useState<string | null>(null);
  const [rowMenuKey, setRowMenuKey] = useState<string | null>(null);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const workOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string; department?: string; location?: string }[] = [];
    for (const c of contracts) {
      const label = String(c.workName || c.clientName || "").trim();
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      opts.push({
        value: label,
        label,
        department: c.departmentName || "",
        location: c.workLocation || c.location || "",
      });
    }
    return opts;
  }, [contracts]);

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
    Promise.all([
      loadLabourAttendanceBook(companySlug, monthKey, track, nameOfWork || undefined),
      loadCrmBook(companySlug).catch(() => null),
    ])
      .then(([attendance, crm]) => {
        setDaysInMonth(attendance.daysInMonth || 31);
        if (attendance.companyName) setCompanyName(attendance.companyName);
        setContracts(crm?.contracts || []);

        const loaded = (attendance.rows || []).map((row: any) => ({
          rowKey: `lab-${row.id}`,
          id: row.id,
          fullName: row.fullName || "",
          designation: row.designation || "",
          wagePerDay: row.wagePerDay == null || row.wagePerDay === "" ? "" : String(row.wagePerDay),
          jobDescription: row.jobDescription || "",
          markCodes: { ...(row.markCodes || {}) },
          presentDays: Number(row.presentDays || 0),
          absentDays: Number(row.absentDays || 0),
          payableDays: Number(row.payableDays || 0),
          totalWorkingDay: Number(row.totalWorkingDay ?? row.presentDays ?? 0),
          totalPresent: Number(row.totalPresent ?? row.presentDays ?? 0),
        })) as SheetRow[];

        setRows(loaded.length ? loaded : [newEmptyRow()]);
        setSelected(new Set());
        setError("");
      })
      .catch((err: any) => {
        setRows([newEmptyRow()]);
        setError(friendlyPublicError(err.message || "Attendance could not be loaded."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySlug, monthKey, track, nameOfWork]);

  function patchRow(rowKey: string, patch: Partial<SheetRow>) {
    setRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  }

  function onWorkPick(value: string) {
    setNameOfWork(value);
    const match = workOptions.find((o) => o.value === value);
    if (match?.department) setDepartment(match.department);
    if (match?.location) setLocation(match.location);
  }

  function addRow() {
    setRows((prev) => [...prev, newEmptyRow()]);
  }

  async function persistPerson(rowKey: string, patch: Partial<SheetRow> = {}) {
    let next: SheetRow | undefined;
    setRows((prev) => {
      const current = prev.find((r) => r.rowKey === rowKey);
      if (!current) return prev;
      next = { ...current, ...patch };
      return prev.map((r) => (r.rowKey === rowKey ? next! : r));
    });
    if (!next?.fullName.trim()) return;
    try {
      const saved = await saveLabourAttendancePerson(companySlug, {
        rowId: next.id || null,
        track,
        monthKey,
        nameOfWork,
        departmentName: department,
        location,
        fullName: next.fullName.trim(),
        designation: next.designation,
        wagePerDay: wagePayload(next.wagePerDay),
        jobDescription: next.jobDescription,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? {
                ...r,
                id: saved.id,
                jobDescription: saved.jobDescription || r.jobDescription,
                wagePerDay: saved.wagePerDay == null ? r.wagePerDay : String(saved.wagePerDay),
                designation: saved.designation || r.designation,
              }
            : r,
        ),
      );
      setError("");
    } catch (err: any) {
      setError(friendlyPublicError(err.message || "Person details could not be saved."));
    }
  }

  async function removeRow(rowKey: string) {
    const row = rows.find((r) => r.rowKey === rowKey);
    const label = row?.fullName?.trim() || "this row";
    const ok = window.confirm(`Delete ${label} from this attendance sheet? This cannot be undone.`);
    if (!ok) return;

    setRows((prev) => {
      const next = prev.filter((r) => r.rowKey !== rowKey);
      return next.length ? next : [newEmptyRow()];
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(rowKey);
      return next;
    });
    if (row?.id) {
      try {
        await removeLabourAttendanceRow(companySlug, row.id);
      } catch (err: any) {
        setError(friendlyPublicError(err.message || "Row could not be removed."));
        loadBook();
      }
    }
  }

  async function onMarkChange(row: SheetRow, day: number, mark: string, jobDescription?: string) {
    if (!row.fullName.trim()) {
      setError("Enter the employee name first.");
      return;
    }

    const nextJob = jobDescription !== undefined ? jobDescription : row.jobDescription;
    setRows((prev) =>
      prev.map((r) =>
        r.rowKey === row.rowKey
          ? { ...recomputeMarks(r, day, mark), jobDescription: nextJob }
          : r,
      ),
    );
    setBusy(`${row.rowKey}-${day}`);
    try {
      const saved = await saveLabourAttendanceDay(companySlug, {
        rowId: row.id || null,
        track,
        monthKey,
        nameOfWork,
        departmentName: department,
        location,
        jobDescription: nextJob,
        fullName: row.fullName.trim(),
        designation: row.designation,
        wagePerDay: wagePayload(row.wagePerDay),
        day,
        mark: mark || null,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === row.rowKey
            ? {
                ...r,
                id: saved.id,
                jobDescription: saved.jobDescription || nextJob,
                wagePerDay: saved.wagePerDay == null ? r.wagePerDay : String(saved.wagePerDay),
                markCodes: { ...(saved.markCodes || {}) },
                ...totalsFromMarks(saved.markCodes || {}),
              }
            : r,
        ),
      );
      setError("");
    } catch (err: any) {
      setError(friendlyPublicError(err.message || "Attendance could not be saved."));
      loadBook();
    } finally {
      setBusy("");
    }
  }

  const filledRows = useMemo(
    () => rows.filter((r) => r.fullName.trim() || Object.keys(r.markCodes).length > 0 || r.id),
    [rows],
  );

  const selectableKeys = useMemo(() => filledRows.map((r) => r.rowKey), [filledRows]);
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((k) => selected.has(k));

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.rowKey) && r.fullName.trim()),
    [rows, selected],
  );

  const viewRow = useMemo(() => rows.find((r) => r.rowKey === viewRowKey) || null, [rows, viewRowKey]);

  const totals = useMemo(() => {
    return filledRows.reduce(
      (acc, row) => {
        acc.days += daysInMonth;
        acc.present += Number(row.totalPresent || 0);
        acc.absent += Number(row.absentDays || 0);
        acc.working += Number(row.totalWorkingDay || 0);
        return acc;
      },
      { days: 0, present: 0, absent: 0, working: 0 },
    );
  }, [filledRows, daysInMonth]);

  const exportMeta = useMemo(
    () => ({
      companyName,
      monthLabel,
      fromTo,
      nameOfWork,
      department,
      location,
      daysInMonth,
    }),
    [companyName, monthLabel, fromTo, nameOfWork, department, location, daysInMonth],
  );

  function toggleSelect(rowKey: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableKeys));
  }

  function rowsForExport(scope: "all" | "selected" | SheetRow[]) {
    if (Array.isArray(scope)) return scope.filter((r) => r.fullName.trim()).map((r) => toExportRow(r, daysInMonth));
    if (scope === "selected") {
      const list = selectedRows.length ? selectedRows : filledRows;
      return list.map((r) => toExportRow(r, daysInMonth));
    }
    return filledRows.map((r) => toExportRow(r, daysInMonth));
  }

  async function runExport(
    kind: "excel" | "pdf" | "print",
    scope: "all" | "selected" | SheetRow[],
  ) {
    const exportRows = rowsForExport(scope);
    if (!exportRows.length) {
      setError("No persons to export. Add names first, or select rows.");
      return;
    }
    setExportBusy(`${kind}-${Array.isArray(scope) ? "row" : scope}`);
    setRowMenuKey(null);
    try {
      if (kind === "excel") await downloadLabourAttendanceExcel({ ...exportMeta, rows: exportRows });
      else if (kind === "pdf") await downloadLabourAttendancePdf({ ...exportMeta, rows: exportRows });
      else await printLabourAttendancePdf({ ...exportMeta, rows: exportRows });
      setError("");
    } catch (err: any) {
      setError(friendlyPublicError(err.message || "Export failed."));
    } finally {
      setExportBusy("");
    }
  }

  const cellInput =
    "w-full px-1.5 py-1 border-0 bg-transparent text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded";
  const toolBtn =
    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-bold disabled:opacity-50";

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={Boolean(exportBusy) || filledRows.length === 0}
            onClick={() => void runExport("excel", "all")}
            className={`${toolBtn} border-emerald-300 bg-emerald-50 text-emerald-900`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            Download all Excel
          </button>
          <button
            type="button"
            disabled={Boolean(exportBusy) || filledRows.length === 0}
            onClick={() => void runExport("pdf", "all")}
            className={`${toolBtn} border-rose-300 bg-rose-50 text-rose-900`}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Download all PDF
          </button>
          <button
            type="button"
            disabled={Boolean(exportBusy) || filledRows.length === 0}
            onClick={() => void runExport("print", "all")}
            className={`${toolBtn} border-slate-300 bg-white text-slate-800`}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Print
          </button>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add row
          </button>
        </div>
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
          <div className="mt-1">
            <ListPicker
              value={nameOfWork}
              options={workOptions}
              placeholder="Select name of work"
              onChange={onWorkPick}
              emptyHint="No works yet — add in Work Register."
            />
          </div>
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
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <span className="text-slate-500">{selected.size} selected</span>
          <button
            type="button"
            disabled={Boolean(exportBusy) || selectedRows.length === 0}
            onClick={() => void runExport("excel", "selected")}
            className={`${toolBtn} border-emerald-200 bg-white text-emerald-800 py-1.5`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Excel selected
          </button>
          <button
            type="button"
            disabled={Boolean(exportBusy) || selectedRows.length === 0}
            onClick={() => void runExport("pdf", "selected")}
            className={`${toolBtn} border-rose-200 bg-white text-rose-800 py-1.5`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            PDF selected
          </button>
          <button
            type="button"
            disabled={Boolean(exportBusy) || selectedRows.length === 0}
            onClick={() => void runExport("print", "selected")}
            className={`${toolBtn} border-slate-200 bg-white text-slate-700 py-1.5`}
          >
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Print selected
          </button>
        </div>
      </div>

      {error ? <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div> : null}

      {loading ? (
        <div className="p-10 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">Loading...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-400 bg-white rounded-lg shadow-sm">
          <table className="min-w-[2100px] w-max text-[10px] text-slate-800 border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[36px]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[48px]">
                  Sl No.
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[160px]">
                  Name
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[120px]">
                  Designation
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[88px]">
                  Wage / Day
                </th>
                <th colSpan={days.length} className="border border-slate-400 p-1.5 text-center">
                  Date
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[64px]">
                  Total Days
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[64px]">
                  Total Present
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[64px]">
                  Total Absent
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[72px]">
                  Total Working Day
                </th>
                <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[120px]">
                  Actions
                </th>
              </tr>
              <tr className="bg-slate-50">
                {days.map((day) => (
                  <th key={day} className="border border-slate-400 p-1 text-center min-w-[48px] font-mono">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.rowKey} className="hover:bg-emerald-50/30">
                  <td className="border border-slate-400 p-1 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(row.rowKey)}
                      onChange={() => toggleSelect(row.rowKey)}
                      disabled={!row.fullName.trim() && !row.id}
                      aria-label={`Select ${row.fullName || `row ${i + 1}`}`}
                    />
                  </td>
                  <td className="border border-slate-400 p-1 text-center">{i + 1}</td>
                  <td className="border border-slate-400 p-0.5 min-w-[160px]">
                    <input
                      value={row.fullName}
                      onChange={(e) => patchRow(row.rowKey, { fullName: e.target.value })}
                      onBlur={() => void persistPerson(row.rowKey)}
                      placeholder="Name"
                      className={`${cellInput} min-w-[140px]`}
                    />
                  </td>
                  <td className="border border-slate-400 p-0.5">
                    <input
                      value={row.designation}
                      onChange={(e) => patchRow(row.rowKey, { designation: e.target.value })}
                      onBlur={() => void persistPerson(row.rowKey)}
                      placeholder="Designation"
                      className={`${cellInput} min-w-[100px]`}
                    />
                  </td>
                  <td className="border border-slate-400 p-0.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={row.wagePerDay}
                      onChange={(e) => patchRow(row.rowKey, { wagePerDay: e.target.value })}
                      onBlur={() => void persistPerson(row.rowKey)}
                      placeholder="0"
                      className={`${cellInput} min-w-[72px] text-right font-mono`}
                    />
                  </td>
                  {days.map((day) => {
                    const mark = row.markCodes?.[String(day)] || "";
                    const cellBusy = busy === `${row.rowKey}-${day}`;
                    return (
                      <td key={day} className="border border-slate-400 p-0.5 text-center">
                        <DayMarkPicker
                          value={mark}
                          jobDescription={row.jobDescription}
                          disabled={cellBusy}
                          ariaLabel={`Day ${day}`}
                          onChange={(next, job) => void onMarkChange(row, day, next, job)}
                        />
                      </td>
                    );
                  })}
                  <td className="border border-slate-400 p-1 text-center font-mono font-bold">{daysInMonth}</td>
                  <td className="border border-slate-400 p-1 text-center font-mono text-emerald-700">
                    {row.totalPresent || 0}
                  </td>
                  <td className="border border-slate-400 p-1 text-center font-mono text-rose-700">
                    {row.absentDays || 0}
                  </td>
                  <td className="border border-slate-400 p-1 text-center font-mono font-bold">
                    {row.totalWorkingDay || 0}
                  </td>
                  <td className="border border-slate-400 p-1 text-center relative">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!row.fullName.trim()}
                        onClick={() => setViewRowKey(row.rowKey)}
                        className="inline-flex text-blue-700 hover:text-blue-900 disabled:opacity-40"
                        title="View"
                        aria-label="View"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          disabled={!row.fullName.trim() || Boolean(exportBusy)}
                          onClick={() => setRowMenuKey((k) => (k === row.rowKey ? null : row.rowKey))}
                          className="inline-flex text-emerald-700 hover:text-emerald-900 disabled:opacity-40"
                          title="Download"
                          aria-label="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {rowMenuKey === row.rowKey ? (
                          <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border border-slate-200 bg-white shadow-lg p-1 text-left">
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1.5 rounded text-[10px] font-semibold hover:bg-emerald-50"
                              onClick={() => void runExport("excel", [row])}
                            >
                              Excel
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1.5 rounded text-[10px] font-semibold hover:bg-rose-50"
                              onClick={() => void runExport("pdf", [row])}
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1.5 rounded text-[10px] font-semibold hover:bg-slate-50"
                              onClick={() => void runExport("print", [row])}
                            >
                              Print
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeRow(row.rowKey)}
                        className="inline-flex text-rose-600 hover:text-rose-800"
                        aria-label="Remove row"
                        title="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-emerald-50 font-bold">
                <td className="border border-slate-400 p-1.5 text-right" colSpan={5 + days.length}>
                  Total =
                </td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.days}</td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.present}</td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.absent}</td>
                <td className="border border-slate-400 p-1.5 text-center font-mono">{totals.working}</td>
                <td className="border border-slate-400 p-1.5" />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {viewRow ? (
        <div
          className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/55 p-4"
          role="presentation"
          onClick={() => setViewRowKey(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`View ${viewRow.fullName}`}
            className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{viewRow.fullName || "Person"}</h2>
                <p className="text-sm text-slate-500">
                  {viewRow.designation || "—"}
                  {viewRow.wagePerDay ? ` · Wage/day ₹${viewRow.wagePerDay}` : ""}
                </p>
                {viewRow.jobDescription ? (
                  <p className="text-xs text-slate-600 mt-1">Job: {viewRow.jobDescription}</p>
                ) : null}
                <p className="text-xs text-slate-500 mt-1">
                  {monthLabel} · {fromTo.from} – {fromTo.to}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${toolBtn} border-emerald-300 bg-emerald-50 text-emerald-900`}
                  onClick={() => void runExport("excel", [viewRow])}
                >
                  Excel
                </button>
                <button
                  type="button"
                  className={`${toolBtn} border-rose-300 bg-rose-50 text-rose-900`}
                  onClick={() => void runExport("pdf", [viewRow])}
                >
                  PDF
                </button>
                <button
                  type="button"
                  className={`${toolBtn} border-slate-300 bg-white text-slate-800`}
                  onClick={() => void runExport("print", [viewRow])}
                >
                  Print
                </button>
                <button
                  type="button"
                  className={`${toolBtn} border-slate-300 bg-white`}
                  onClick={() => setViewRowKey(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="min-w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    {days.map((day) => (
                      <th key={day} className="border border-slate-300 p-1 font-mono">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {days.map((day) => {
                      const mark = viewRow.markCodes?.[String(day)] || "";
                      return (
                        <td
                          key={day}
                          className={`border border-slate-300 p-1 text-center font-bold ${mark ? markStyle(mark) : ""}`}
                        >
                          {mark || "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Total Days</div>
                <div className="font-mono font-bold text-lg">{daysInMonth}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Present</div>
                <div className="font-mono font-bold text-lg text-emerald-700">{viewRow.totalPresent || 0}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Absent</div>
                <div className="font-mono font-bold text-lg text-rose-700">{viewRow.absentDays || 0}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-[10px] uppercase text-slate-500 font-bold">Working Day</div>
                <div className="font-mono font-bold text-lg">{viewRow.totalWorkingDay || 0}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
