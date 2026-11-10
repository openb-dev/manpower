"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { loadCompanyReports, loadReportPerson } from "../actions";
import { statusLabel } from "@/components/admin/SimpleGuide";
import { friendlyPublicError } from "@/lib/publicErrors";
import AttachedDocuments from "@/components/admin/AttachedDocuments";
import { printPaperFormPdf } from "@/lib/downloadPaperFormPdf";

const ApplicantPaperForm = dynamic(
  () => import("@/components/admin/ApplicantPaperForm").then((mod) => mod.ApplicantPaperForm),
  { ssr: false },
);

type ReportKey =
  | "OVERVIEW"
  | "APPLICANTS"
  | "EMPLOYEES"
  | "EMD"
  | "PG"
  | "WORK"
  | "INVOICES"
  | "PROCUREMENT"
  | "LEDGER"
  | "ATTENDANCE";

const TABS: { key: ReportKey; label: string }[] = [
  { key: "OVERVIEW", label: "Summary" },
  { key: "APPLICANTS", label: "New applicant" },
  { key: "EMPLOYEES", label: "Employees" },
  { key: "EMD", label: "Tender money" },
  { key: "PG", label: "Bank guarantee" },
  { key: "WORK", label: "Work list" },
  { key: "INVOICES", label: "Bills" },
  { key: "PROCUREMENT", label: "Purchases" },
  { key: "LEDGER", label: "Money in / out" },
  { key: "ATTENDANCE", label: "Attendance" },
];

function money(value: unknown) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString("en-IN")}`;
}

function dateText(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;
  const [tab, setTab] = useState<ReportKey>("OVERVIEW");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [person, setPerson] = useState<any>(null);
  const [personLoading, setPersonLoading] = useState(false);
  const [personError, setPersonError] = useState("");

  useEffect(() => {
    setLoading(true);
    loadCompanyReports(companySlug)
      .then((payload) => {
        setData(payload);
        setError("");
      })
      .catch((err) => {
        setData(null);
        setError(friendlyPublicError(err.message || "Reports could not be loaded."));
      })
      .finally(() => setLoading(false));
  }, [companySlug]);

  const q = search.trim().toLowerCase();

  const applicants = useMemo(() => {
    const rows = data?.applicants || [];
    if (!q) return rows;
    return rows.filter((row: any) =>
      [row.fullName, row.mobile, row.status, statusLabel(row.status), row.jobRole?.name, row.roleCategory?.name]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data, q]);

  const employees = useMemo(() => {
    const rows = data?.employees || [];
    if (!q) return rows;
    return rows.filter((row: any) =>
      [row.employeeCode, row.fullName, row.mobile, row.status, row.jobRole?.name, row.site?.name]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data, q]);

  const contracts = useMemo(() => {
    const rows = data?.contracts || [];
    if (!q) return rows;
    return rows.filter((row: any) =>
      [row.clientName, row.departmentName, row.workName, row.agreementNo, row.tenderNo, row.emdStatus, row.pgStatus]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data, q]);

  const invoices = useMemo(() => {
    const rows = data?.invoices || [];
    if (!q) return rows;
    return rows.filter((row: any) =>
      [row.billNo, row.status, row.contract?.clientName, row.contract?.agreementNo].join(" ").toLowerCase().includes(q)
    );
  }, [data, q]);

  const purchases = useMemo(() => {
    const rows = data?.purchases || [];
    if (!q) return rows;
    return rows.filter((row: any) =>
      [row.itemName, row.vendorName, row.invoiceNo, row.contract?.clientName].join(" ").toLowerCase().includes(q)
    );
  }, [data, q]);

  const attendanceRows = useMemo(() => {
    const rows = data?.attendance?.rows || [];
    if (!q) return rows;
    return rows.filter((row: any) =>
      [row.employeeCode, row.fullName, row.siteName, row.jobRole].join(" ").toLowerCase().includes(q)
    );
  }, [data, q]);

  const ledger = useMemo(() => {
    const rows = data?.ledger || [];
    if (!q) return rows;
    return rows.filter((row: any) =>
      [row.narration, row.voucherNumber, row.category, row.paymentMode, row.chequeNo].join(" ").toLowerCase().includes(q)
    );
  }, [data, q]);

  function exportCurrent() {
    const stamp = new Date().toISOString().slice(0, 10);
    const prefix = `${companySlug}-${tab.toLowerCase()}-${stamp}`;

    if (tab === "APPLICANTS") {
      downloadCsv(
        `${prefix}.csv`,
        ["Name", "Mobile", "Role", "Category", "Status", "Applied On"],
        applicants.map((row: any) => [
          row.fullName,
          row.mobile,
          row.jobRole?.name || "",
          row.roleCategory?.name || "",
          statusLabel(row.status),
          dateText(row.createdAt),
        ])
      );
      return;
    }
    if (tab === "EMPLOYEES") {
      downloadCsv(
        `${prefix}.csv`,
        ["Code", "Name", "Mobile", "Role", "Category", "Site", "Basic Rate", "Status", "Joining Date"],
        employees.map((row: any) => [
          row.employeeCode,
          row.fullName,
          row.mobile,
          row.jobRole?.name || "",
          row.roleCategory?.name || "",
          row.site?.name || "Unassigned",
          Number(row.basicRate || 0),
          row.status,
          dateText(row.joiningDate),
        ])
      );
      return;
    }
    if (tab === "EMD") {
      downloadCsv(
        `${prefix}.csv`,
        ["Client", "Tender No", "Tender Amount", "EMD Amount", "EMD %", "Mode", "Instrument", "Bank", "Status", "Issue Date", "Refund Date"],
        contracts.map((row: any) => [
          row.clientName,
          row.tenderNo || "",
          Number(row.tenderAmount || 0),
          Number(row.emdAmount || 0),
          Number(row.emdPercent || 0),
          row.emdMode || "",
          row.emdInstrumentNo || "",
          row.emdBankName || "",
          row.emdStatus || "",
          dateText(row.emdDate),
          dateText(row.emdRefundDate),
        ])
      );
      return;
    }
    if (tab === "PG") {
      downloadCsv(
        `${prefix}.csv`,
        ["Client", "Agreement No", "PG Amount", "PG %", "Mode", "Instrument", "Bank", "Status", "Issue Date", "Expiry Date", "Release Date"],
        contracts.map((row: any) => [
          row.clientName,
          row.agreementNo || "",
          Number(row.pgAmount || 0),
          Number(row.pgPercent || 0),
          row.pgMode || "",
          row.pgInstrumentNo || "",
          row.pgBankName || "",
          row.pgStatus || "",
          dateText(row.pgDate),
          dateText(row.pgExpiryDate),
          dateText(row.pgReleaseDate),
        ])
      );
      return;
    }
    if (tab === "WORK") {
      downloadCsv(
        `${prefix}.csv`,
        ["Client", "Agreement No", "Work Name", "Stage", "Gross", "Deductions", "Net", "Bill No"],
        contracts.map((row: any) => [
          row.clientName,
          row.agreementNo || "",
          row.workName || "",
          row.workStatus,
          Number(row.grossAmount || 0),
          Number(row.totalDeductions || 0),
          Number(row.netAmount || 0),
          row.billNumber || "",
        ])
      );
      return;
    }
    if (tab === "INVOICES") {
      downloadCsv(
        `${prefix}.csv`,
        ["Bill No", "Client", "Agreement", "Period From", "Period To", "Gross", "CGST", "SGST", "Total", "Status"],
        invoices.map((row: any) => [
          row.billNo,
          row.contract?.clientName || "",
          row.contract?.agreementNo || "",
          dateText(row.periodFrom),
          dateText(row.periodTo),
          Number(row.grossAmount || 0),
          Number(row.cgst || 0),
          Number(row.sgst || 0),
          Number(row.totalAmount || 0),
          row.status,
        ])
      );
      return;
    }
    if (tab === "PROCUREMENT") {
      downloadCsv(
        `${prefix}.csv`,
        ["Item", "Vendor", "Invoice No", "Contract", "Amount", "Purchase Date"],
        purchases.map((row: any) => [
          row.itemName,
          row.vendorName,
          row.invoiceNo || "",
          row.contract?.clientName || "General Stock",
          Number(row.amount || 0),
          dateText(row.purchaseDate),
        ])
      );
      return;
    }
    if (tab === "ATTENDANCE") {
      downloadCsv(
        `${prefix}.csv`,
        ["Code", "Name", "Site", "Present", "Half", "Absent", "Leave", "Week Off", "Payable", "Wages"],
        attendanceRows.map((row: any) => [
          row.employeeCode,
          row.fullName,
          row.siteName,
          row.presentDays,
          row.halfDays,
          row.absentDays,
          row.leaveDays,
          row.weekOffDays,
          row.payableDays,
          Number(row.estimatedGrossWages || 0),
        ])
      );
      return;
    }
    if (tab === "LEDGER") {
      downloadCsv(
        `${prefix}.csv`,
        ["Date", "Voucher", "Narration", "Paid by", "Cheque no", "What for", "Debit", "Credit"],
        ledger.map((row: any) => [
          dateText(row.entryDate),
          row.voucherNumber || "",
          row.narration,
          row.paymentMode || "",
          row.chequeNo || "",
          row.category,
          Number(row.debitAmount || 0),
          Number(row.creditAmount || 0),
        ])
      );
    }
  }

  async function openPerson(kind: "applicant" | "employee", id: string) {
    setPersonError("");
    setPersonLoading(true);
    setPerson({ kind });
    try {
      const payload = await loadReportPerson(companySlug, kind, id);
      setPerson(payload);
    } catch (err: any) {
      setPerson(null);
      setPersonError(friendlyPublicError(err.message || "This record could not be opened."));
    } finally {
      setPersonLoading(false);
    }
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className={(person || personLoading) ? "print:hidden space-y-6" : "space-y-6"}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 no-print">
        <div>
          <span className="text-[11px] uppercase font-extrabold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
            Reports
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">All lists</h1>
          <p className="text-sm text-slate-500">
            People, money, and work lists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab !== "OVERVIEW" ? (
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a name to find..."
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg w-full sm:w-56 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-10"
            />
          ) : null}
          {tab !== "OVERVIEW" ? (
            <button
              type="button"
              onClick={exportCurrent}
              disabled={!data}
              className="px-3 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Save Excel file
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
          >
            Print this page
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 no-print">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              setSearch("");
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              tab === item.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-200 bg-white border border-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-500 font-medium bg-white border border-slate-200 rounded-xl">
          Loading company reports...
        </div>
      ) : error ? (
        <div className="p-10 text-center text-red-600 bg-red-50 border border-red-200 rounded-xl">{error}</div>
      ) : (
        <div className={person || personLoading ? "no-print" : undefined}>
          <div className="hidden print:block mb-4">
            <h2 className="text-xl font-bold text-slate-900">{data.company.legalName}</h2>
            <p className="text-xs text-slate-500">
              {TABS.find((item) => item.key === tab)?.label} · Generated {dateText(data.generatedAt)}
            </p>
          </div>

          {tab === "OVERVIEW" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Kpi title="New applicant" value={String(summary.applicants.total)} note={`${summary.applicants.SHORTLISTED} shortlisted · ${summary.applicants.APPROVED} approved`} />
              <Kpi title="Employees working" value={String(summary.employees.ACTIVE)} note={`${summary.employees.total} total employees`} />
              <Kpi title="Tender money" value={money(summary.emd.amount)} note={`${summary.emd.count} tender records`} />
              <Kpi title="Bank guarantee" value={money(summary.pg.amount)} note={`${summary.pg.count} guarantees`} />
              <Kpi title="Bills given" value={money(summary.invoices.billed)} note={`${summary.invoices.count} bills`} />
              <Kpi title="Purchases" value={money(summary.purchases.spent)} note={`${summary.purchases.count} buy notes`} />
              <Kpi title="Money received" value={money(summary.ledger.credit)} note="Money that came in" />
              <Kpi title="Money left" value={money(summary.ledger.balance)} note={`Money paid out ${money(summary.ledger.debit)}`} />
              <Kpi
                title="Attendance this month"
                value={String(summary.attendance?.payable || 0)}
                note={`${summary.attendance?.present || 0} days people came · ${money(summary.attendance?.wages)} salary`}
              />
            </div>
          ) : null}

          {tab === "APPLICANTS" ? (
            <ReportTable
              empty="No new applicants found."
              columns={["Name", "Mobile", "Job", "Type", "Stage", "Form date"]}
              rows={applicants.map((row: any) => [
                <NameLink key={row.id} name={row.fullName} onClick={() => openPerson("applicant", row.id)} />,
                row.mobile,
                row.jobRole?.name || "—",
                row.roleCategory?.name || "—",
                statusLabel(row.status),
                dateText(row.createdAt),
              ])}
            />
          ) : null}

          {tab === "EMPLOYEES" ? (
            <ReportTable
              empty="No employees found."
              columns={["Code", "Name", "Role", "Site", "Monthly Rate", "Status", "Joining"]}
              rows={employees.map((row: any) => [
                row.employeeCode,
                <div key={row.id}>
                  <NameLink name={row.fullName} onClick={() => openPerson("employee", row.id)} />
                  <div className="text-[11px] text-slate-500">{row.mobile || ""}</div>
                </div>,
                `${row.jobRole?.name || "—"}\n${row.roleCategory?.name || ""}`,
                row.site?.name || "Unassigned",
                `${money(row.basicRate)} / ${row.divisorDays || 26} days`,
                row.status,
                dateText(row.joiningDate),
              ])}
            />
          ) : null}

          {tab === "EMD" ? (
            <ReportTable
              empty="No EMD / tender records."
              columns={["Client", "Tender No", "Tender Value", "EMD", "%", "Mode", "Instrument", "Status", "Issue"]}
              rows={contracts.map((row: any) => [
                row.clientName,
                row.tenderNo || "—",
                money(row.tenderAmount),
                money(row.emdAmount),
                row.emdPercent ? `${row.emdPercent}%` : "—",
                row.emdMode || "—",
                row.emdInstrumentNo || "—",
                row.emdStatus || "—",
                dateText(row.emdDate),
              ])}
            />
          ) : null}

          {tab === "PG" ? (
            <ReportTable
              empty="No PG / bank guarantee records."
              columns={["Client", "Agreement", "PG Amount", "%", "Mode", "Instrument", "Bank", "Status", "Expiry"]}
              rows={contracts.map((row: any) => [
                row.clientName,
                row.agreementNo || "—",
                money(row.pgAmount),
                row.pgPercent ? `${row.pgPercent}%` : "—",
                row.pgMode || "—",
                row.pgInstrumentNo || "—",
                row.pgBankName || "—",
                row.pgStatus || "—",
                dateText(row.pgExpiryDate),
              ])}
            />
          ) : null}

          {tab === "WORK" ? (
            <ReportTable
              empty="No work register records."
              columns={["Client", "Agreement", "Work", "Stage", "Gross", "Deductions", "Net"]}
              rows={contracts.map((row: any) => [
                row.clientName,
                row.agreementNo || "—",
                row.workName || "—",
                row.workStatus,
                money(row.grossAmount),
                money(row.totalDeductions),
                money(row.netAmount),
              ])}
            />
          ) : null}

          {tab === "INVOICES" ? (
            <ReportTable
              empty="No invoices."
              columns={["Bill No", "Client", "Period", "Gross", "GST", "Total", "Status"]}
              rows={invoices.map((row: any) => [
                row.billNo,
                row.contract?.clientName || "Direct",
                `${dateText(row.periodFrom)} – ${dateText(row.periodTo)}`,
                money(row.grossAmount),
                money(Number(row.cgst || 0) + Number(row.sgst || 0)),
                money(row.totalAmount),
                row.status,
              ])}
            />
          ) : null}

          {tab === "PROCUREMENT" ? (
            <ReportTable
              empty="No purchases."
              columns={["Item", "Vendor", "Invoice", "Contract", "Amount", "Date"]}
              rows={purchases.map((row: any) => [
                row.itemName,
                row.vendorName,
                row.invoiceNo || "—",
                row.contract?.clientName || "General Stock",
                money(row.amount),
                dateText(row.purchaseDate),
              ])}
            />
          ) : null}

          {tab === "ATTENDANCE" ? (
            <ReportTable
              empty="No attendance records for this month."
              columns={["Code", "Name", "Site", "Present", "Half", "Absent", "Leave", "Week Off", "Payable", "Wages"]}
              rows={attendanceRows.map((row: any) => [
                row.employeeCode,
                <NameLink key={row.employeeId} name={row.fullName} onClick={() => openPerson("employee", row.employeeId)} />,
                row.siteName,
                String(row.presentDays),
                String(row.halfDays),
                String(row.absentDays),
                String(row.leaveDays),
                String(row.weekOffDays),
                String(row.payableDays),
                money(row.estimatedGrossWages),
              ])}
            />
          ) : null}

          {tab === "LEDGER" ? (
            <ReportTable
              empty="No ledger entries."
              columns={["Date", "Voucher", "Narration", "Paid by", "Cheque no", "What for", "Debit", "Credit"]}
              rows={ledger.map((row: any) => [
                dateText(row.entryDate),
                row.voucherNumber || "—",
                row.narration,
                row.paymentMode || "CASH",
                row.chequeNo || "—",
                row.category,
                Number(row.debitAmount) > 0 ? money(row.debitAmount) : "—",
                Number(row.creditAmount) > 0 ? money(row.creditAmount) : "—",
              ])}
            />
          ) : null}
        </div>
      )}

      {personError ? (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg no-print">{personError}</div>
      ) : null}
      </div>

      {(person || personLoading) ? (
        <PersonReportModal
          person={person}
          company={data?.company}
          loading={personLoading}
          onClose={() => {
            setPerson(null);
            setPersonError("");
          }}
        />
      ) : null}
    </div>
  );
}

function Kpi({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</div>
      <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
      <div className="text-[11px] text-slate-500 mt-1">{note}</div>
    </div>
  );
}

function NameLink({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
    >
      {name}
    </button>
  );
}

function ReportTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <div className="p-10 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">{empty}</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
            <tr>
              {columns.map((col) => (
                <th key={col} className="p-3 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/80">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="p-3 align-top whitespace-pre-line">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100">{rows.length} row(s)</div>
    </div>
  );
}

function isViewable(src?: unknown) {
  return typeof src === "string" && (src.startsWith("data:") || src.startsWith("http") || src.startsWith("blob:"));
}

function PersonReportModal({
  person,
  company,
  loading,
  onClose,
}: {
  person: any;
  company?: { legalName?: string; shortName?: string; slug?: string } | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [printingForm, setPrintingForm] = useState(false);
  const fd = person?.formData || {};
  const title = person?.fullName || (person?.kind === "employee" ? "Employee" : "Applicant");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[80] flex items-center justify-center p-3 sm:p-6 print:static print:bg-white print:p-0 print:overflow-visible print:block">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[860px] w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:border-0 print:overflow-visible">
        <div className="shrink-0 p-5 sm:p-6 border-b border-slate-200 bg-white flex items-start justify-between gap-4 no-print">
          <div className="flex items-center gap-4">
            {isViewable(fd.photo) ? (
              <img
                src={fd.photo}
                alt={title}
                className="w-14 h-16 sm:w-16 sm:h-20 object-cover rounded-lg border border-slate-300 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-14 h-16 sm:w-16 sm:h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs text-center p-1 shrink-0">
                No Photo
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-900">{loading ? "Loading record..." : title}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                {person?.employeeCode ? (
                  <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    {person.employeeCode}
                  </span>
                ) : null}
                {person?.jobRole?.name ? (
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                    {person.jobRole.name}
                    {person.roleCategory?.name ? ` (${person.roleCategory.name})` : ""}
                  </span>
                ) : null}
                {person?.status ? (
                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800">{statusLabel(person.status)}</span>
                ) : null}
                <span className="uppercase tracking-wider text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                  {person?.kind === "employee" ? "Employee form" : "Applicant form"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!person) return;
                setPrintingForm(true);
                try {
                  await printPaperFormPdf(person, company || undefined);
                } catch (err: any) {
                  alert(friendlyPublicError(err.message || "The paper form could not be printed."));
                } finally {
                  setPrintingForm(false);
                }
              }}
              disabled={loading || !person || printingForm}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {printingForm ? "Opening print..." : "Print paper form"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-lg font-bold"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-6 print:overflow-visible print:p-0">
          {loading ? (
            <p className="text-sm text-slate-500 no-print">Loading full form details and documents...</p>
          ) : (
            <>
              <ApplicantPaperForm person={person} company={company} />
              <AttachedDocuments person={person} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
