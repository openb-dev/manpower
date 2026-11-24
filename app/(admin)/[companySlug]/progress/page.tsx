"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { loadProgressBook } from "../actions";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";
import { formatDateDmy, maskDmyInput, parseDateValue } from "@/lib/applicantFormFields";
import { isWorkListTrack, workListTrackLabel } from "@/lib/workList";
import { downloadWorkProgressExcel } from "@/lib/downloadWorkProgressExcel";
import { downloadWorkProgressPdf } from "@/lib/downloadWorkProgressPdf";
import {
  adjustKindOf,
  buildProgressFooter,
  columnAmount,
  defaultRaBills,
  emptyProgressItem,
  itemBalanceQty,
  itemRate,
  moneyText,
  labelProgressRa,
  nextBoqSl,
  nextExtraSl,
  nextProgressRa,
  renumberProgressItems,
  sortProgressRa,
  parseProgressItems,
  parseRaNotes,
  type ProgressItem,
} from "@/lib/workProgress";
import { FileSpreadsheet, Pencil, X } from "lucide-react";

const SHEET =
  "w-full min-w-[64px] h-8 px-1 border-0 bg-transparent text-[11px] focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-500";
const FIELD =
  "w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white";

function DateTextInput({
  value,
  onChange,
  className = FIELD,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/yyyy"
      value={value}
      onChange={(e) => onChange(maskDmyInput(e.target.value))}
      className={className}
      aria-required={required || undefined}
    />
  );
}

function Field({
  no,
  label,
  children,
  required = false,
}: {
  no?: number;
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-700 block mb-1">
        {no != null ? <span className="text-slate-400 mr-1">{no}.</span> : null}
        {label}
        {required ? <span className="text-rose-600 ml-0.5">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function isCompleteDate(value: string) {
  return Boolean(parseDateValue(value));
}

type Report = any;

export default function WorkProgressPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const companySlug = params?.companySlug as string;
  const workTrack = searchParams?.get("track");
  const trackLabel = isWorkListTrack(workTrack) ? workListTrackLabel(workTrack) : null;
  const [company, setCompany] = useState<any>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editingId, setEditingId] = useState("");
  const editingIdRef = useRef("");
  const lastSavedFingerprintRef = useRef("");
  const skipAutosaveRef = useRef(true);
  const savingRef = useRef(false);

  const [nameOfWork, setNameOfWork] = useState("");
  const [workOrderNo, setWorkOrderNo] = useState("");
  const [workOrderDate, setWorkOrderDate] = useState("");
  const [period, setPeriod] = useState("");
  const [department, setDepartment] = useState("");
  const [situation, setSituation] = useState("");
  const [stipulatedStart, setStipulatedStart] = useState("");
  const [actualStart, setActualStart] = useState("");
  const [stipulatedCompletion, setStipulatedCompletion] = useState("");
  const [actualCompletion, setActualCompletion] = useState("");
  const [workStatus, setWorkStatus] = useState("Under progress");
  const [agencyName, setAgencyName] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [balanceDate, setBalanceDate] = useState("");
  const [lessPercent, setLessPercent] = useState("0.96");
  const [adjustKind, setAdjustKind] = useState<"LESS" | "ADD">("LESS");
  const [sdPercent, setSdPercent] = useState("2.5");
  const [itPercent, setItPercent] = useState("2");
  const [gstPercent, setGstPercent] = useState("2");
  const [labourCessPercent, setLabourCessPercent] = useState("1");
  const [raBills, setRaBills] = useState<string[]>([]);
  const [newRaBill, setNewRaBill] = useState("");
  const [raNotes, setRaNotes] = useState<Record<string, string>>({});
  const [items, setItems] = useState<ProgressItem[]>([emptyProgressItem()]);
  const [note, setNote] = useState("");

  const companyLabel = company?.legalName || company?.shortName || "M/s N.K. Enterprise";

  function loadData() {
    setLoading(true);
    loadProgressBook(companySlug)
      .then((data) => {
        setCompany(data.company || null);
        setReports(data.reports || []);
        setError("");
      })
      .catch((err) => {
        setReports([]);
        setError(friendlyPublicError(err.message || "The work progress report could not be loaded."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (companySlug) loadData();
  }, [companySlug]);

  function rememberEditingId(id: string) {
    editingIdRef.current = id;
    setEditingId(id);
  }

  function resetForm() {
    rememberEditingId("");
    lastSavedFingerprintRef.current = "";
    skipAutosaveRef.current = true;
    setSaveStatus("idle");
    setNameOfWork("");
    setWorkOrderNo("");
    setWorkOrderDate("");
    setPeriod("");
    setDepartment("");
    setSituation("");
    setStipulatedStart("");
    setActualStart("");
    setStipulatedCompletion("");
    setActualCompletion("");
    setWorkStatus("Under progress");
    setAgencyName(company?.legalName || "M/s. N.K. Enterprise");
    setReportDate("");
    setBalanceDate("");
    setLessPercent("0.96");
    setAdjustKind("LESS");
    setSdPercent("2.5");
    setItPercent("2");
    setGstPercent("2");
    setLabourCessPercent("1");
    setRaBills([]);
    setNewRaBill("");
    setRaNotes({});
    setItems([emptyProgressItem("BOQ", "1")]);
    setNote("");
  }

  function openNew() {
    resetForm();
    setShowModal(true);
  }

  function dateIn(value: unknown) {
    return formatDateDmy(value as string, "");
  }

  function openEdit(row: Report) {
    skipAutosaveRef.current = true;
    rememberEditingId(row.id);
    setSaveStatus("idle");
    setNameOfWork(row.nameOfWork || "");
    setWorkOrderNo(row.workOrderNo || "");
    setWorkOrderDate(dateIn(row.workOrderDate));
    setPeriod(row.period || "");
    setDepartment(row.department || "");
    setSituation(row.situation || "");
    setStipulatedStart(dateIn(row.stipulatedStart));
    setActualStart(dateIn(row.actualStart));
    setStipulatedCompletion(dateIn(row.stipulatedCompletion));
    setActualCompletion(dateIn(row.actualCompletion));
    setWorkStatus(row.workStatus || "Under progress");
    setAgencyName(row.agencyName || "");
    setReportDate(dateIn(row.reportDate));
    setBalanceDate(dateIn(row.balanceDate));
    setLessPercent(row.lessPercent == null ? "0.96" : String(row.lessPercent));
    setAdjustKind(adjustKindOf(row.adjustKind));
    setSdPercent(row.sdPercent == null ? "2.5" : String(row.sdPercent));
    setItPercent(row.itPercent == null ? "2" : String(row.itPercent));
    setGstPercent(row.gstPercent == null ? "2" : String(row.gstPercent));
    setLabourCessPercent(row.labourCessPercent == null ? "1" : String(row.labourCessPercent));
    setRaBills(sortProgressRa(defaultRaBills(row.raBills)));
    setNewRaBill("");
    setRaNotes(parseRaNotes(row.raNotes));
    setItems(renumberProgressItems(parseProgressItems(row.items)));
    setNote(row.note || "");
    setShowModal(true);
  }

  const formSnapshot = useMemo(
    () => ({
      nameOfWork,
      workOrderNo,
      workOrderDate,
      period,
      department,
      situation,
      stipulatedStart,
      actualStart,
      stipulatedCompletion,
      actualCompletion,
      workStatus,
      agencyName,
      reportDate,
      balanceDate,
      lessPercent,
      adjustKind,
      sdPercent,
      itPercent,
      gstPercent,
      labourCessPercent,
      raBills,
      raNotes,
      items,
      note,
    }),
    [
      nameOfWork,
      workOrderNo,
      workOrderDate,
      period,
      department,
      situation,
      stipulatedStart,
      actualStart,
      stipulatedCompletion,
      actualCompletion,
      workStatus,
      agencyName,
      reportDate,
      balanceDate,
      lessPercent,
      adjustKind,
      sdPercent,
      itPercent,
      gstPercent,
      labourCessPercent,
      raBills,
      raNotes,
      items,
      note,
    ],
  );

  const payload = (id = editingIdRef.current) => ({
    id: id || undefined,
    ...formSnapshot,
    items: renumberProgressItems(items),
  });

  function missingRequiredDates() {
    const checks: { label: string; value: string }[] = [
      { label: "Work Order / Agreement date", value: workOrderDate },
      { label: "Stipulated date of start", value: stipulatedStart },
      { label: "Actual date of start", value: actualStart },
      { label: "Stipulated date of completion", value: stipulatedCompletion },
      { label: "Report as on date", value: reportDate },
      { label: "Balance work as on date", value: balanceDate },
    ];
    return checks.filter((row) => !isCompleteDate(row.value)).map((row) => row.label);
  }

  function hasAutosaveContent() {
    if (editingIdRef.current) return true;
    if (nameOfWork.trim() || workOrderNo.trim() || period.trim() || department.trim() || situation.trim()) return true;
    if (workOrderDate || stipulatedStart || actualStart || stipulatedCompletion || actualCompletion || reportDate || balanceDate) {
      return true;
    }
    if (note.trim()) return true;
    return items.some((row) => String(row.particulars || "").trim() || String(row.boqQty || "").trim());
  }

  async function persistReport(opts: { silent?: boolean; close?: boolean } = {}) {
    const { silent = false, close = false } = opts;
    if (savingRef.current) {
      if (silent) return false;
      for (let i = 0; i < 25 && savingRef.current; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      if (savingRef.current) return false;
    }
    const fingerprint = JSON.stringify(formSnapshot);
    if (silent && fingerprint === lastSavedFingerprintRef.current && editingIdRef.current) {
      setSaveStatus("saved");
      return true;
    }
    if (silent && !hasAutosaveContent()) return false;

    if (!silent) {
      const missing = missingRequiredDates();
      if (missing.length) {
        alert(`Please fill these dates before saving:\n• ${missing.join("\n• ")}`);
        return false;
      }
      if (actualCompletion.trim() && !isCompleteDate(actualCompletion)) {
        alert("Please enter Actual date of completion as dd/mm/yyyy, or leave it blank.");
        return false;
      }
    }

    savingRef.current = true;
    if (!silent) setSaving(true);
    setSaveStatus("saving");
    try {
      const currentId = editingIdRef.current;
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentId ? "UPDATE_PROGRESS_REPORT" : "CREATE_PROGRESS_REPORT",
          ...payload(currentId),
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data?.error || "Could not save the report.");
      if (data?.id) rememberEditingId(data.id);
      lastSavedFingerprintRef.current = fingerprint;
      setSaveStatus("saved");
      if (close) {
        setShowModal(false);
        loadData();
      } else if (!silent) {
        loadData();
      } else if (data) {
        setReports((rows) => {
          const mapped = rows.filter((row) => row.id !== data.id);
          return [data, ...mapped];
        });
      }
      return true;
    } catch (err: any) {
      setSaveStatus("error");
      if (!silent) alert(friendlyPublicError(err.message || "Could not save the report."));
      return false;
    } finally {
      savingRef.current = false;
      if (!silent) setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await persistReport({ close: true });
  }

  useEffect(() => {
    if (!showModal) return;
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      lastSavedFingerprintRef.current = JSON.stringify(formSnapshot);
      return;
    }
    const timer = window.setTimeout(() => {
      void persistReport({ silent: true });
    }, 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autosave on form edits while modal open
  }, [showModal, formSnapshot]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this work progress report?")) return;
    const res = await fetch(`/api/admin/${companySlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_PROGRESS_REPORT", id }),
    });
    const data = await readApiJson(res);
    if (!res.ok) {
      alert(friendlyPublicError(data?.error || "Could not delete."));
      return;
    }
    loadData();
  }

  function downloadRows(rows: Report[]) {
    return rows.filter((row) => selectedIds.includes(row.id));
  }

  function requireSelectedRows(rows: Report[]) {
    const picked = downloadRows(rows);
    if (!picked.length) {
      alert("Please select at least one work progress report to download.");
      return null;
    }
    return picked;
  }

  function allRowsSelected(rows: Report[]) {
    return rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  }

  function toggleRow(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((rowId) => rowId !== id) : [...ids, id]));
  }

  function toggleAll(rows: Report[]) {
    const select = !allRowsSelected(rows);
    setSelectedIds(select ? rows.map((row) => row.id) : []);
  }

  function patchItem(index: number, patch: Partial<ProgressItem>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function patchRa(index: number, raNo: string, patch: { qty?: string; rate?: string }) {
    setItems((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, ra: { ...row.ra, [raNo]: { ...row.ra?.[raNo], ...patch } } } : row,
      ),
    );
  }

  const footer = useMemo(
    () =>
      buildProgressFooter(items, {
        raBills,
        lessPercent,
        adjustKind,
        sdPercent,
        itPercent,
        gstPercent,
        labourCessPercent,
      }),
    [items, raBills, lessPercent, adjustKind, sdPercent, itPercent, gstPercent, labourCessPercent],
  );

  const pickedCount = reports.filter((row) => selectedIds.includes(row.id)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {trackLabel ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
              <Link href={`/${companySlug}/work-list`} className="font-semibold text-blue-700 hover:underline">
                Work List
              </Link>
              <span>/</span>
              <Link href={`/${companySlug}/work-list/${workTrack}`} className="font-semibold text-blue-700 hover:underline">
                {trackLabel}
              </Link>
              <span>/</span>
              <span className="font-bold text-slate-700">Work Progress Report</span>
            </div>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Work progress report
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            Work Details Report{trackLabel ? ` — ${trackLabel}` : ""}
          </h1>
          <p className="text-sm text-slate-500">Same format as the office Excel: BOQ, R.A. bills, extra items, recoveries.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold rounded-lg"
        >
          New report
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">Loading reports...</div>
      ) : error ? (
        <div className="p-6 text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900">Work Progress Report ( {companyLabel} )</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAll(reports)}
                disabled={!reports.length}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg disabled:opacity-50"
              >
                {allRowsSelected(reports) ? "Deselect all" : "Select all"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const picked = requireSelectedRows(reports);
                  if (!picked) return;
                  void downloadWorkProgressExcel({ companyName: companyLabel, rows: picked });
                }}
                disabled={!pickedCount}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
              >
                Download Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  const picked = requireSelectedRows(reports);
                  if (!picked) return;
                  void downloadWorkProgressPdf({ companyName: companyLabel, rows: picked });
                }}
                disabled={!pickedCount}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
              >
                Download PDF
              </button>
              {pickedCount ? (
                <span className="text-[11px] font-semibold text-slate-500">{pickedCount} selected</span>
              ) : (
                <span className="text-[11px] text-slate-400">Select a report to download</span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px] text-slate-800">
              <thead className="bg-slate-100 text-slate-800 font-bold">
                <tr>
                  <th className="p-2 w-8">
                    <input
                      type="checkbox"
                      checked={allRowsSelected(reports)}
                      onChange={() => toggleAll(reports)}
                      aria-label={allRowsSelected(reports) ? "Deselect all" : "Select all"}
                    />
                  </th>
                  <th className="p-2">Name of work</th>
                  <th className="p-2">Department</th>
                  <th className="p-2">Situation</th>
                  <th className="p-2">Work Status</th>
                  <th className="p-2 whitespace-nowrap">Report date</th>
                  <th className="p-2">Agency</th>
                  <th className="p-2">Open</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200 hover:bg-indigo-50/40">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.nameOfWork || "report"}`}
                      />
                    </td>
                    <td className="p-2 min-w-[220px]">{row.nameOfWork || "—"}</td>
                    <td className="p-2">{row.department || "—"}</td>
                    <td className="p-2">{row.situation || "—"}</td>
                    <td className="p-2">{row.workStatus || "—"}</td>
                    <td className="p-2 whitespace-nowrap">{row.reportDate ? formatDateDmy(row.reportDate) : "—"}</td>
                    <td className="p-2">{row.agencyName || "—"}</td>
                    <td className="p-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px]"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Pencil className="h-3 w-3" /> Edit
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="ml-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[11px]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!reports.length ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No work progress report yet. Click New report.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal ? (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-[98vw] w-full my-6 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="text-[10px] uppercase font-mono font-bold text-indigo-300">Work Details Report</div>
                <h2 className="text-lg font-bold mt-1">{editingId ? "Update work progress report" : "New work progress report"}</h2>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form noValidate onSubmit={handleSave} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Field no={1} label="Name of work">
                    <textarea rows={2} value={nameOfWork} onChange={(e) => setNameOfWork(e.target.value)} className={FIELD} />
                  </Field>
                </div>
                <Field no={2} label="Work Order / Agreement No.">
                  <input value={workOrderNo} onChange={(e) => setWorkOrderNo(e.target.value)} className={FIELD} />
                </Field>
                <Field no={3} label="Work Order / Agreement date" required>
                  <DateTextInput value={workOrderDate} onChange={setWorkOrderDate} required />
                </Field>
                <Field no={4} label="Period">
                  <input value={period} onChange={(e) => setPeriod(e.target.value)} className={FIELD} placeholder="e.g. 6 Month 5 Days" />
                </Field>
                <Field no={5} label="Department">
                  <input value={department} onChange={(e) => setDepartment(e.target.value)} className={FIELD} />
                </Field>
                <Field no={6} label="Situation">
                  <input value={situation} onChange={(e) => setSituation(e.target.value)} className={FIELD} />
                </Field>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field no={7} label="Stipulated date of start" required>
                    <DateTextInput value={stipulatedStart} onChange={setStipulatedStart} required />
                  </Field>
                  <Field no={8} label="Actual date of start" required>
                    <DateTextInput value={actualStart} onChange={setActualStart} required />
                  </Field>
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field no={9} label="Stipulated date of completion" required>
                    <DateTextInput value={stipulatedCompletion} onChange={setStipulatedCompletion} required />
                  </Field>
                  <Field no={10} label="Actual date of completion">
                    <DateTextInput value={actualCompletion} onChange={setActualCompletion} />
                  </Field>
                </div>
                <Field no={11} label="Work Status">
                  <input value={workStatus} onChange={(e) => setWorkStatus(e.target.value)} className={FIELD} placeholder="Under progress" />
                </Field>
                <Field no={12} label="Name of Agency">
                  <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className={FIELD} />
                </Field>
                <Field label="Report as on date" required>
                  <DateTextInput value={reportDate} onChange={setReportDate} required />
                </Field>
                <Field label="Balance work as on date" required>
                  <DateTextInput value={balanceDate} onChange={setBalanceDate} required />
                </Field>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                {raBills.map((raNo) => (
                  <div key={raNo} className="min-w-[160px]">
                    <label className="text-xs font-bold text-slate-700 block mb-1">AS PER {raNo.toUpperCase()} R.A. BILL note</label>
                    <div className="flex gap-1">
                      <input
                        value={raNotes[raNo] || ""}
                        onChange={(e) => setRaNotes((notes) => ({ ...notes, [raNo]: e.target.value }))}
                        placeholder="e.g. CP No. 547"
                        className={FIELD}
                      />
                      <button
                        type="button"
                        onClick={() => setRaBills((rows) => rows.filter((value) => value !== raNo))}
                        className="px-2 text-rose-600 font-bold"
                        aria-label={`Remove ${raNo} R.A. bill`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                <div className="min-w-[140px]">
                  <label className="text-xs font-bold text-slate-700 block mb-1">R.A. bill no.</label>
                  <input
                    value={newRaBill}
                    onChange={(e) => setNewRaBill(e.target.value)}
                    placeholder="e.g. 1st, 14th"
                    className={FIELD}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRaBills((rows) => {
                      const choice = labelProgressRa(newRaBill) || nextProgressRa(rows);
                      if (rows.includes(choice)) return rows;
                      setNewRaBill("");
                      return sortProgressRa([...rows, choice]);
                    });
                  }}
                  className="px-2.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-bold rounded-lg"
                >
                  Add R.A. bill
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setItems((rows) => renumberProgressItems([...rows, emptyProgressItem("BOQ", nextBoqSl(rows))]))
                  }
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-lg"
                >
                  Add item
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setItems((rows) => renumberProgressItems([...rows, emptyProgressItem("EXTRA", nextExtraSl(rows))]))
                  }
                  className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold rounded-lg"
                >
                  Add extra item
                </button>
                <button
                  type="button"
                  onClick={() => setItems((rows) => renumberProgressItems(rows))}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-lg"
                >
                  Renumber 1, 2, 3…
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-400 bg-white">
                <table className="min-w-[2200px] w-max text-[10px] text-slate-800 border-collapse">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th rowSpan={2} className="border border-slate-400 p-1">Sl. No.</th>
                      <th rowSpan={2} className="border border-slate-400 p-1 min-w-[220px]">Particulars</th>
                      <th colSpan={4} className="border border-slate-400 p-1 text-center">AS PER BOQ</th>
                      {raBills.map((raNo) => (
                        <th key={raNo} colSpan={3} className="border border-slate-400 p-1 text-center">
                          AS PER {raNo.toUpperCase()} R.A. BILL
                          {raNotes[raNo] ? <div className="font-normal">{raNotes[raNo]}</div> : null}
                        </th>
                      ))}
                      <th colSpan={3} className="border border-slate-400 p-1 text-center">
                        BALANCE WORK AS ON DATE {balanceDate || "…./…./……"}
                      </th>
                      <th rowSpan={2} className="border border-slate-400 p-1">Remarks</th>
                      <th rowSpan={2} className="border border-slate-400 p-1 w-8" />
                    </tr>
                    <tr>
                      <th className="border border-slate-400 p-1">Qty.</th>
                      <th className="border border-slate-400 p-1">Unit</th>
                      <th className="border border-slate-400 p-1">Rate (Rs.)</th>
                      <th className="border border-slate-400 p-1">Amount (Rs.)</th>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <th className="border border-slate-400 p-1">Qty.</th>
                          <th className="border border-slate-400 p-1">Rate (Rs.)</th>
                          <th className="border border-slate-400 p-1">Amount (Rs.)</th>
                        </React.Fragment>
                      ))}
                      <th className="border border-slate-400 p-1">Qty.</th>
                      <th className="border border-slate-400 p-1">Rate (Rs.)</th>
                      <th className="border border-slate-400 p-1">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className={item.kind === "EXTRA" ? "bg-amber-50/50" : ""}>
                        <td className="border border-slate-400 p-0">
                          <input value={item.slNo} onChange={(e) => patchItem(index, { slNo: e.target.value })} className={SHEET} />
                        </td>
                        <td className="border border-slate-400 p-0 min-w-[220px]">
                          <textarea rows={2} value={item.particulars} onChange={(e) => patchItem(index, { particulars: e.target.value })} className={`${SHEET} h-auto py-1`} />
                        </td>
                        <td className="border border-slate-400 p-0">
                          <input value={item.boqQty} onChange={(e) => patchItem(index, { boqQty: e.target.value })} className={SHEET} />
                        </td>
                        <td className="border border-slate-400 p-0">
                          <input value={item.unit} onChange={(e) => patchItem(index, { unit: e.target.value })} className={SHEET} />
                        </td>
                        <td className="border border-slate-400 p-0">
                          <input value={item.boqRate} onChange={(e) => patchItem(index, { boqRate: e.target.value })} className={SHEET} />
                        </td>
                        <td className="border border-slate-400 p-1 text-right font-mono bg-slate-50">{moneyText(columnAmount(item, "boq", raBills))}</td>
                        {raBills.map((raNo) => (
                          <React.Fragment key={raNo}>
                            <td className="border border-slate-400 p-0">
                              <input value={item.ra?.[raNo]?.qty ?? ""} onChange={(e) => patchRa(index, raNo, { qty: e.target.value })} className={SHEET} />
                            </td>
                            <td className="border border-slate-400 p-0">
                              <input
                                value={item.ra?.[raNo]?.rate ?? ""}
                                placeholder={item.boqRate || ""}
                                onChange={(e) => patchRa(index, raNo, { rate: e.target.value })}
                                className={SHEET}
                              />
                            </td>
                            <td className="border border-slate-400 p-1 text-right font-mono bg-slate-50">{moneyText(columnAmount(item, raNo, raBills))}</td>
                          </React.Fragment>
                        ))}
                        <td className="border border-slate-400 p-0">
                          <input
                            value={item.balanceQty}
                            placeholder={String(itemBalanceQty({ ...item, balanceQty: "" }, raBills) || "")}
                            onChange={(e) => patchItem(index, { balanceQty: e.target.value })}
                            className={SHEET}
                          />
                        </td>
                        <td className="border border-slate-400 p-1 text-right font-mono bg-slate-50">{moneyText(itemRate(item))}</td>
                        <td className="border border-slate-400 p-1 text-right font-mono bg-slate-50">{moneyText(columnAmount(item, "balance", raBills))}</td>
                        <td className="border border-slate-400 p-0">
                          <input value={item.remarks} onChange={(e) => patchItem(index, { remarks: e.target.value })} className={SHEET} />
                        </td>
                        <td className="border border-slate-400 p-0 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setItems((rows) =>
                                renumberProgressItems(
                                  rows.length === 1 ? [emptyProgressItem()] : rows.filter((_, i) => i !== index),
                                ),
                              )
                            }
                            className="text-rose-600 font-bold px-1"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>Total=</td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.total.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.total[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.total.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr className="font-bold">
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <select
                            value={adjustKind}
                            onChange={(e) => setAdjustKind(e.target.value === "ADD" ? "ADD" : "LESS")}
                            className="px-1 py-0.5 border border-slate-300 rounded text-[11px] font-bold bg-white"
                          >
                            <option value="LESS">Less</option>
                            <option value="ADD">Add</option>
                          </select>
                          <span>(-</span>
                          <input
                            value={lessPercent}
                            onChange={(e) => setLessPercent(e.target.value)}
                            className="w-14 px-1 border border-slate-300 rounded text-[11px]"
                          />
                          <span>%)</span>
                        </div>
                      </td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.less.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.less[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.less.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>(A) Sub-Total=</td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.subA.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.subA[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.subA.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr className="bg-amber-50 font-bold">
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>(B) Sub-Total=</td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.extra.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.extra[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.extra.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr className="bg-slate-100 font-bold">
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>(A+B) Grand Total=</td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.grand.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.grand[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.grand.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr>
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>
                        Security Deposit@
                        <input value={sdPercent} onChange={(e) => setSdPercent(e.target.value)} className="w-12 px-1 border border-slate-300 rounded text-[11px]" />
                        %=
                      </td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.sd.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.sd[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.sd.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr>
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>
                        Income Tax@
                        <input value={itPercent} onChange={(e) => setItPercent(e.target.value)} className="w-12 px-1 border border-slate-300 rounded text-[11px]" />
                        %=
                      </td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.it.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.it[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.it.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr>
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>
                        GST@
                        <input value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} className="w-12 px-1 border border-slate-300 rounded text-[11px]" />
                        %=
                      </td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.gst.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.gst[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.gst.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr>
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>
                        Labour Cess@
                        <input value={labourCessPercent} onChange={(e) => setLabourCessPercent(e.target.value)} className="w-12 px-1 border border-slate-300 rounded text-[11px]" />
                        %=
                      </td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.labour.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.labour[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.labour.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr className="font-bold">
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>Total Recoveries=</td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.recoveries.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.recoveries[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.recoveries.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                    <tr className="bg-indigo-50 font-bold">
                      <td className="border border-slate-400 p-1 text-right" colSpan={5}>Net Payable Amount=</td>
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.net.boq)}</td>
                      {raBills.map((raNo) => (
                        <React.Fragment key={raNo}>
                          <td className="border border-slate-400 p-1" colSpan={2} />
                          <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.net[raNo])}</td>
                        </React.Fragment>
                      ))}
                      <td className="border border-slate-400 p-1" colSpan={2} />
                      <td className="border border-slate-400 p-1 text-right font-mono">{moneyText(footer.net.balance)}</td>
                      <td className="border border-slate-400 p-1" colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>

              <Field label="Note">
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} placeholder="The above list is prepared as on..." />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <p className="text-[11px] text-slate-500">
                  {saveStatus === "saving"
                    ? "Saving automatically..."
                    : saveStatus === "saved"
                      ? "Saved automatically. Fill all required dates (*) before Save report."
                      : saveStatus === "error"
                        ? "Could not auto-save. Check your connection and try again."
                        : "Dates marked * are required to save. Work is auto-saved as you type."}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold">
                    Close
                  </button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                    {saving ? "Saving..." : "Save report"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
