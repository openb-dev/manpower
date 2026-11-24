"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { Banknote, Download } from "lucide-react";
import { loadAttendanceBook } from "../../../../actions";
import { friendlyPublicError } from "@/lib/publicErrors";
import { downloadSalarySummaryExcel } from "@/lib/downloadSalarySummaryExcel";
import { buildSalarySummary, moneyText } from "@/lib/salarySummary";
import { isWorkListTrack, workListTrackLabel, type WorkListTrack } from "@/lib/workList";

export default function LabourPaymentPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;
  const trackParam = params?.track as string;
  if (!isWorkListTrack(trackParam)) notFound();
  const track = trackParam as WorkListTrack;

  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [department, setDepartment] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState("M/s. N.K. Enterprise");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ptaxDefault, setPtaxDefault] = useState("150");

  function loadData() {
    setLoading(true);
    loadAttendanceBook(companySlug, monthKey)
      .then((data) => {
        setRows(data.rows || []);
        if (data.companyName) setCompanyName(data.companyName);
        setError("");
      })
      .catch((err) => {
        setRows([]);
        setError(friendlyPublicError(err.message || "Salary summary could not be loaded."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [companySlug, monthKey]);

  const monthLabel = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  }, [monthKey]);

  const summary = useMemo(() => {
    const pt = Number(ptaxDefault) || 0;
    return buildSalarySummary(
      (rows || [])
        .filter((row) => Number(row.payableDays || 0) > 0)
        .map((row) => ({
          employeeId: row.employeeId,
          fullName: row.fullName,
          designation: row.designation || row.jobRole || "",
          uan: row.uan,
          esicNo: row.esicNo,
          workingDays: Number(row.payableDays || 0),
          dailyWage: Number(row.ratePerDay || 0),
          professionalTax: pt,
        })),
    );
  }, [rows, ptaxDefault]);

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
          <span className="font-bold text-slate-700">Labour Payment</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
          <Banknote className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Salary Calculation Summary
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Labour Payment</h1>
        <p className="text-sm text-slate-500">
          Built from attendance and daily wages — EPF / ESI employee and employer share like the office summary sheet.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-semibold text-slate-700 block">
            Month
            <input
              type="month"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="mt-1 block px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 block">
            Department
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 block px-2 py-1.5 border border-slate-300 rounded-lg text-sm min-w-[180px]"
              placeholder="Optional"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 block">
            Default P. Tax
            <input
              type="number"
              value={ptaxDefault}
              onChange={(e) => setPtaxDefault(e.target.value)}
              className="mt-1 block px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-24"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() =>
            void downloadSalarySummaryExcel({
              companyName,
              monthLabel,
              department,
              lines: summary.lines,
              totals: summary.totals,
            })
          }
          disabled={!summary.lines.length}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Download Excel
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">Loading attendance wages...</div>
      ) : error ? (
        <div className="p-6 text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>
      ) : (
        <>
          <div className="overflow-x-auto border border-slate-400 bg-white rounded-lg shadow-sm">
            <table className="min-w-[2200px] w-max text-[10px] text-slate-800 border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[44px]">
                    SL No
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[160px]">
                    Employees Name
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[120px]">
                    Designation
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[100px]">
                    UAN No
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[100px]">
                    ESIC No
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[72px]">
                    Working day&apos;s
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[88px]">
                    Minimum Wages Per Day
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[96px]">
                    Gross Basic
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[100px]">
                    Earning as per Daily Work Basis
                  </th>
                  <th colSpan={7} className="border border-slate-400 p-1.5 text-center">
                    Employee Share
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[96px]">
                    Net Amount
                  </th>
                  <th colSpan={3} className="border border-slate-400 p-1.5 text-center">
                    EMPLOYER&apos;S CONTRIBUTION
                  </th>
                </tr>
                <tr className="bg-slate-50">
                  <th className="border border-slate-400 p-1 text-center min-w-[80px]">EPF @12%</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[80px]">ESIC @0.75%</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[64px]">P. Tax</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[72px]">Allowances 1</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[72px]">Allowances 2</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[64px]">Others</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[64px]">Bonus</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[88px]">EPF @13%</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[88px]">ESI @3.25%</th>
                  <th className="border border-slate-400 p-1 text-center min-w-[110px]">Total Contribution of ESIC &amp; EPF</th>
                </tr>
              </thead>
              <tbody>
                {summary.lines.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="border border-slate-400 p-8 text-center text-slate-400">
                      No payable attendance days in this month. Mark attendance first.
                    </td>
                  </tr>
                ) : (
                  summary.lines.map((row, i) => (
                    <tr key={row.employeeId} className="hover:bg-emerald-50/40">
                      <td className="border border-slate-400 p-1.5 text-center">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5 font-semibold whitespace-nowrap">{row.fullName}</td>
                      <td className="border border-slate-400 p-1.5 whitespace-nowrap">{row.designation}</td>
                      <td className="border border-slate-400 p-1.5 font-mono whitespace-nowrap">{row.uan || "—"}</td>
                      <td className="border border-slate-400 p-1.5 font-mono whitespace-nowrap">{row.esicNo || "—"}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{row.workingDays}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.dailyWage)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.grossBasic)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.earningDaily)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.epfEmployee)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.esicEmployee)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.professionalTax)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.allowance1)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.allowance2)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.others)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.bonus)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">{moneyText(row.netAmount)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.epfEmployer)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(row.esiEmployer)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">{moneyText(row.employerTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {summary.lines.length ? (
                <tfoot>
                  <tr className="bg-emerald-50 font-bold">
                    <td className="border border-slate-400 p-1.5 text-right" colSpan={5}>
                      Total= · {summary.totals.employees} employees
                    </td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{summary.totals.workingDays}</td>
                    <td className="border border-slate-400 p-1.5" />
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.grossBasic)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.earningDaily)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.epfEmployee)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.esicEmployee)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.professionalTax)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.allowance1)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.allowance2)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.others)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.bonus)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.netAmount)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.epfEmployer)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.esiEmployer)}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(summary.totals.employerTotal)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl text-sm">
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="text-xs text-slate-500">Total employees</div>
              <div className="text-lg font-bold">{summary.totals.employees}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="text-xs text-slate-500">Total wages (gross)</div>
              <div className="text-lg font-bold font-mono">₹{moneyText(summary.totals.grossBasic)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="text-xs text-slate-500">Total contribution ESIC & EPF (employer)</div>
              <div className="text-lg font-bold font-mono">₹{moneyText(summary.totals.employerTotal)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
