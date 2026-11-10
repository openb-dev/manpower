"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import HrmHeader from "@/components/admin/HrmHeader";
import { statusLabel } from "@/components/admin/SimpleGuide";
import { loadApplicantBook, loadApplicantDetail } from "../actions";
import { downloadPaperFormPdf, paperFormFileName, printPaperFormPdf } from "@/lib/downloadPaperFormPdf";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";
import { applicantPhotoUrl, filledByAdminInfo, indianAddressLine } from "@/lib/applicantFormFields";
import AttachedDocuments from "@/components/admin/AttachedDocuments";

const ApplicantPaperForm = dynamic(
  () => import("@/components/admin/ApplicantPaperForm").then((mod) => mod.ApplicantPaperForm),
  { ssr: false },
);

function HeaderPhoto({ person, alt }: { person: any; alt: string }) {
  const photo = applicantPhotoUrl(person);
  if (!photo) {
    return (
      <div className="w-14 h-16 sm:w-16 sm:h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs text-center p-1 shrink-0">
        No Photo
      </div>
    );
  }
  return (
    <img
      src={photo}
      alt={alt}
      className="w-14 h-16 sm:w-16 sm:h-20 object-cover rounded-lg border border-slate-300 shadow-xs shrink-0"
    />
  );
}

export default function ApplicantBookPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;

  const [applicants, setApplicants] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedApplicant, setSelectedApplicant] = useState<any | null>(null);
  const [listError, setListError] = useState("");

  // Approval modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [basicRate, setBasicRate] = useState("14000");
  const [divisorDays, setDivisorDays] = useState(26);
  const [approvalRemark, setApprovalRemark] = useState("");
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<"SHORTLISTED" | "REJECTED" | null>(null);
  const [statusRemark, setStatusRemark] = useState("");
  const [sites, setSites] = useState<any[]>([]);
  const [siteId, setSiteId] = useState("");
  const [joinBankName, setJoinBankName] = useState("");
  const [joinAccountNo, setJoinAccountNo] = useState("");
  const [joinIfsc, setJoinIfsc] = useState("");
  const [joinBranchName, setJoinBranchName] = useState("");
  const [joinSecurityMoney, setJoinSecurityMoney] = useState("");
  const [officeApplicantId, setOfficeApplicantId] = useState("");
  const [savingOfficeId, setSavingOfficeId] = useState(false);

  // Remark modal state
  const [newRemark, setNewRemark] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [printingForm, setPrintingForm] = useState(false);

  function loadApplicants() {
    setLoading(true);
    loadApplicantBook(companySlug, { search, status: statusFilter })
      .then((data) => {
        const items = data.items || [];
        setApplicants(items);
        setTotal(data.total || 0);
        setSites(data.sites || []);
        setSelectedIds((prev) => prev.filter((id) => items.some((row: any) => row.id === id)));
        if (!siteId && data.sites?.[0]?.id) setSiteId(data.sites[0].id);
        setListError("");
      })
      .catch((e: any) => {
        setApplicants([]);
        setTotal(0);
        setListError(e.message || "The applicant book could not be loaded.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadApplicants();
  }, [companySlug, statusFilter]);

  async function handleStatusChange(applicantId: string, newStatus: string, remark: string) {
    try {
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_STATUS",
          applicantId,
          newStatus,
          remark: remark || `Status marked as ${newStatus}`,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        alert(friendlyPublicError(data.error || "Status could not be updated."));
        return;
      }
      setPendingStatus(null);
      setStatusRemark("");
      const refreshed = await loadApplicantBook(companySlug, { search, status: statusFilter });
      setApplicants(refreshed.items || []);
      setTotal(refreshed.total || 0);
      try {
        const detail = await loadApplicantDetail(companySlug, applicantId);
        setSelectedApplicant(detail);
      } catch {
        setSelectedApplicant((prev: any) => (prev && prev.id === applicantId ? { ...prev, status: newStatus } : prev));
      }
    } catch (e: any) {
      alert(friendlyPublicError(e.message || "Status could not be updated."));
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAndConvert() {
    if (!selectedApplicant) return;
    setActionError("");

    if (!String(basicRate).trim() || !Number(basicRate)) {
      setActionError("Monthly basic rate is required.");
      return;
    }
    if (!divisorDays) {
      setActionError("Divisor days is required.");
      return;
    }
    if (!approvalRemark.trim()) {
      setActionError("Approval remark is required.");
      return;
    }
    if (!siteId) {
      setActionError("Select the duty site before making an employee.");
      return;
    }
    if (!joinBankName.trim() || !joinAccountNo.trim() || !joinIfsc.trim() || !joinBranchName.trim()) {
      setActionError("Bank details are required when making an employee.");
      return;
    }
    if (!String(joinSecurityMoney).trim()) {
      setActionError("Security deposit amount is required when making an employee.");
      return;
    }
    if (!officeApplicantId.trim()) {
      setActionError("Employee ID No. is required when making an employee.");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "APPROVE_CONVERT",
          applicantId: selectedApplicant.id,
          basicRate: Number(basicRate),
          divisorDays: Number(divisorDays),
          siteId,
          bankName: joinBankName.trim(),
          accountNo: joinAccountNo.trim(),
          ifsc: joinIfsc.trim().toUpperCase(),
          branchName: joinBranchName.trim(),
          securityMoney: String(joinSecurityMoney).trim(),
          officeApplicantId: officeApplicantId.trim(),
          uan: selectedApplicant.formData?.uan,
          esicNo: selectedApplicant.formData?.esiIp,
          remark: approvalRemark.trim(),
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "This person could not be made an employee.");

      alert(`Done. This person is now an employee. You can now enter the Employee ID No.`);
      setShowApproveModal(false);
      loadApplicants();
      try {
        const detail = await loadApplicantDetail(companySlug, selectedApplicant.id);
        setSelectedApplicant(detail);
        setOfficeApplicantId(detail.employee?.employeeCode || data.employeeCode || "");
      } catch {
        setSelectedApplicant((prev: any) => (prev ? { ...prev, status: "APPROVED" } : prev));
        setOfficeApplicantId(data.employeeCode || "");
      }
    } catch (e: any) {
      setActionError(friendlyPublicError(e.message || "This person could not be made an employee."));
    } finally {
      setProcessing(false);
    }
  }

  async function handleAddRemark() {
    if (!selectedApplicant || !newRemark.trim()) return;

    try {
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_REMARK",
          applicantId: selectedApplicant.id,
          remark: newRemark,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) alert(friendlyPublicError(data.error || "The note could not be saved."));
      else {
        setNewRemark("");
        // Reload applicant detail
        loadApplicants();
      }
    } catch (e: any) {
      alert(friendlyPublicError(e.message || "The note could not be saved."));
    }
  }

  async function handleSaveOfficeId() {
    if (!selectedApplicant) return;
    setSavingOfficeId(true);
    try {
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_OFFICE_ID",
          applicantId: selectedApplicant.id,
          officeApplicantId: officeApplicantId.trim(),
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "The employee ID number could not be saved.");
      const savedId = data.employeeCode || data.officeApplicantId || officeApplicantId.trim();
      setOfficeApplicantId(savedId);
      setSelectedApplicant((prev: any) =>
        prev
          ? {
              ...prev,
              formData: { ...(prev.formData || {}), officeApplicantId: savedId },
              employee: { ...(prev.employee || {}), employeeCode: savedId },
            }
          : prev,
      );
    } catch (e: any) {
      alert(friendlyPublicError(e.message || "The employee ID number could not be saved."));
    } finally {
      setSavingOfficeId(false);
    }
  }

  const allSelected = applicants.length > 0 && applicants.every((row) => selectedIds.includes(row.id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function selectAll() {
    setSelectedIds(applicants.map((row) => row.id));
  }

  function deselectAll() {
    setSelectedIds([]);
  }

  function toggleAll() {
    if (allSelected) deselectAll();
    else selectAll();
  }

  async function downloadSelectedForms() {
    const ids = selectedIds.filter((id) => applicants.some((row) => row.id === id));
    if (!ids.length) {
      alert("Tick the applicants whose forms you want to download.");
      return;
    }
    setDownloading(true);
    const failed: string[] = [];
    try {
      for (let i = 0; i < ids.length; i += 1) {
        const row = applicants.find((item) => item.id === ids[i]);
        setDownloadStatus(`Making PDF ${i + 1} of ${ids.length}...`);
        let detail: any;
        try {
          detail = await loadApplicantDetail(companySlug, ids[i]);
        } catch {
          failed.push(row?.fullName || ids[i]);
          continue;
        }
        try {
          await downloadPaperFormPdf(detail, paperFormFileName(detail, i), { slug: companySlug });
        } catch {
          failed.push(detail?.fullName || row?.fullName || ids[i]);
        }
      }
    } finally {
      setDownloading(false);
      setDownloadStatus("");
    }
    if (failed.length) {
      alert(`Could not download: ${failed.join(", ")}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className={selectedApplicant ? "print:hidden space-y-6" : "space-y-6"}>
      <HrmHeader companySlug={companySlug} activeTab="applicants" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New applicant</h1>
          <p className="text-sm text-slate-500">
            People who filled the job form. Tick one or more, then download each form as a separate PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Type name or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadApplicants()}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg w-full sm:w-64 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-10"
          />
          <button
            onClick={loadApplicants}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs transition"
          >
            Search
          </button>
          <a
            href={`/apply/${companySlug}?fill=admin`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition"
          >
            Fill form for a person
          </a>
          <button
            type="button"
            disabled={downloading || selectedIds.length === 0}
            onClick={downloadSelectedForms}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-xs transition"
          >
            {downloading
              ? downloadStatus || "Downloading..."
              : selectedIds.length
                ? `Download ${selectedIds.length} form${selectedIds.length === 1 ? "" : "s"}`
                : "Download forms"}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {["ALL", "NEW", "SHORTLISTED", "APPROVED", "REJECTED"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              statusFilter === st
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            {st === "ALL" ? "All" : statusLabel(st)}
          </button>
        ))}
      </div>

      {applicants.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={downloading || allSelected}
            onClick={selectAll}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Select all
          </button>
          <button
            type="button"
            disabled={downloading || selectedIds.length === 0}
            onClick={deselectAll}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Deselect all
          </button>
          <span className="text-xs text-slate-500 font-medium">
            {selectedIds.length
              ? `${selectedIds.length} selected`
              : "None selected"}
          </span>
        </div>
      ) : null}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading applicant records...</div>
        ) : applicants.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {listError || "No applicant records found for this filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4 w-12">
                    <label className="sr-only" htmlFor="select-all-applicants">
                      Select all applicants
                    </label>
                    <input
                      id="select-all-applicants"
                      type="checkbox"
                      checked={allSelected}
                      disabled={downloading}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded-full border-slate-400 text-blue-600 accent-blue-600"
                    />
                  </th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Application ID</th>
                  <th className="p-4">Job</th>
                  <th className="p-4">Mobile</th>
                  <th className="p-4">Aadhaar</th>
                  <th className="p-4">Stage</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applicants.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4">
                      <label className="sr-only" htmlFor={`select-applicant-${a.id}`}>
                        Select {a.fullName}
                      </label>
                      <input
                        id={`select-applicant-${a.id}`}
                        type="checkbox"
                        checked={selectedIds.includes(a.id)}
                        disabled={downloading}
                        onChange={() => toggleSelected(a.id)}
                        className="h-4 w-4 rounded-full border-slate-400 text-blue-600 accent-blue-600"
                      />
                    </td>
                    <td className="p-4 font-semibold text-slate-900">
                      {a.fullName}
                      {filledByAdminInfo(a) ? (
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-indigo-700 mt-0.5">
                          Form filled up by admin
                        </span>
                      ) : null}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-slate-700 break-all max-w-[11rem]">{a.id}</td>
                    <td className="p-4">
                      <span className="font-medium text-slate-800">{a.jobRole?.name}</span>
                      <span className="block text-xs text-slate-400">{a.roleCategory?.name}</span>
                    </td>
                    <td className="p-4 font-mono">{a.mobile}</td>
                    <td className="p-4 font-mono text-xs">{a.aadhaarDisplay}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          a.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : a.status === "SHORTLISTED"
                            ? "bg-blue-100 text-blue-800"
                            : a.status === "REJECTED"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {statusLabel(a.status)}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={async () => {
                          setPendingStatus(null);
                          setStatusRemark("");
                          setSelectedApplicant(a);
                          try {
                            const detail = await loadApplicantDetail(companySlug, a.id);
                            setSelectedApplicant(detail);
                            setOfficeApplicantId(
                              detail.employee?.employeeCode || detail.formData?.officeApplicantId || "",
                            );
                          } catch (err: any) {
                            alert(friendlyPublicError(err.message || "Could not open this form."));
                          }
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-md transition"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </div>

      {/* DETAIL MODAL */}
      {selectedApplicant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 print:static print:bg-white print:p-0 print:overflow-visible print:block">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:border-0 print:overflow-visible">
            {/* FIXED MODAL HEADER with Photo, Basic Info & Top Actions */}
            <div className="shrink-0 p-3 sm:p-4 border-b border-slate-200 bg-white flex items-start justify-between gap-3 no-print">
              <div className="flex items-center gap-4">
                <HeaderPhoto person={selectedApplicant} alt={selectedApplicant.fullName} />
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedApplicant.fullName}</h2>
                  <div className="text-[11px] font-mono text-slate-600 mt-0.5 break-all">
                    Application ID: {selectedApplicant.id}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                    {selectedApplicant.status === "APPROVED" &&
                    (selectedApplicant.employee?.employeeCode ||
                      selectedApplicant.formData?.officeApplicantId) ? (
                      <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                        Employee ID:{" "}
                        {selectedApplicant.employee?.employeeCode ||
                          selectedApplicant.formData?.officeApplicantId}
                      </span>
                    ) : null}
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                      {selectedApplicant.jobRole?.name} ({selectedApplicant.roleCategory?.name})
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold ${
                        selectedApplicant.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : selectedApplicant.status === "SHORTLISTED"
                          ? "bg-blue-100 text-blue-800"
                          : selectedApplicant.status === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {statusLabel(selectedApplicant.status)}
                    </span>
                    {filledByAdminInfo(selectedApplicant) ? (
                      <span className="px-2 py-0.5 rounded font-bold bg-indigo-100 text-indigo-800">
                        Form filled up by admin
                      </span>
                    ) : null}
                  </div>
                  {selectedApplicant.status === "APPROVED" ? (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Employee ID No.</label>
                      <input
                        type="text"
                        value={officeApplicantId}
                        onChange={(e) => setOfficeApplicantId(e.target.value)}
                        placeholder="Type employee ID"
                        className="px-2 py-1 border border-slate-300 rounded text-xs font-mono w-40"
                      />
                      <button
                        type="button"
                        onClick={handleSaveOfficeId}
                        disabled={savingOfficeId}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded disabled:opacity-50"
                      >
                        {savingOfficeId ? "Saving..." : "Save ID"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={printingForm}
                  onClick={async () => {
                    setPrintingForm(true);
                    try {
                      await printPaperFormPdf(selectedApplicant, { slug: companySlug });
                    } catch (err: any) {
                      alert(friendlyPublicError(err.message || "The paper form could not be printed."));
                    } finally {
                      setPrintingForm(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {printingForm ? "Opening print..." : "Print paper form"}
                </button>
                <button
                  onClick={() => {
                    setSelectedApplicant(null);
                    setPendingStatus(null);
                    setShowApproveModal(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-lg font-bold ml-1 transition self-start"
                  title="Close modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* SCROLLABLE BODY CONTENT */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-6 print:overflow-visible print:p-0">
              <ApplicantPaperForm person={selectedApplicant} company={{ slug: companySlug }} />
              {/* SECTION 1: PERSONAL & GENERAL DETAILS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 no-print">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  1. Application & Personal Particulars
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Father / Husband</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.fatherOrHusband || selectedApplicant.formData?.fatherOrHusband || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Date of Birth</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.dateOfBirth
                        ? new Date(selectedApplicant.dateOfBirth).toLocaleDateString()
                        : selectedApplicant.formData?.dateOfBirth || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Age</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.age ? `${selectedApplicant.formData.age} yrs` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Religion</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.religion || "—"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Present Address</span>
                    <span className="text-slate-700">
                      {indianAddressLine({
                        locality: selectedApplicant.formData?.presentAddress || selectedApplicant.presentAddress,
                        po: selectedApplicant.formData?.presentPO || selectedApplicant.formData?.localPO,
                        ps: selectedApplicant.formData?.presentPS || selectedApplicant.formData?.localPS,
                        district: selectedApplicant.formData?.presentDistrict || selectedApplicant.formData?.localDistrict,
                        state: selectedApplicant.formData?.presentState || selectedApplicant.formData?.localState,
                        pin: selectedApplicant.formData?.presentPin || selectedApplicant.formData?.localPin,
                      }) || selectedApplicant.presentAddress || "—"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Permanent Address</span>
                    <span className="text-slate-700">
                      {indianAddressLine({
                        locality: selectedApplicant.formData?.permanentAddress || selectedApplicant.permanentAddress,
                        po: selectedApplicant.formData?.permanentPO || selectedApplicant.formData?.villagePO,
                        ps: selectedApplicant.formData?.permanentPS || selectedApplicant.formData?.villagePS,
                        district: selectedApplicant.formData?.permanentDistrict || selectedApplicant.formData?.villageDistrict,
                        state: selectedApplicant.formData?.permanentState || selectedApplicant.formData?.villageState,
                        pin: selectedApplicant.formData?.permanentPin || selectedApplicant.formData?.villagePin,
                      }) || selectedApplicant.permanentAddress || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Qualification</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.qualification || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Work status</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.experienceType === "FRESHER"
                        ? "Fresher"
                        : selectedApplicant.formData?.experienceType === "EXPERIENCED"
                          ? "Experienced"
                          : selectedApplicant.formData?.experience || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Other qualification</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.otherQualification ||
                        selectedApplicant.formData?.characterCertificate ||
                        "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Identification Mark</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.identificationMark || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Reference (Name & Relation)</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.reference || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Known since (years)</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.referenceYears
                        ? `${selectedApplicant.formData.referenceYears} years`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Height / Weight</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.height ||
                        (selectedApplicant.formData?.heightCm
                          ? `${selectedApplicant.formData.heightCm} cm`
                          : "—")}{" "}
                      / {selectedApplicant.formData?.weight ? `${selectedApplicant.formData.weight}kg` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Nominee</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.nominee || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Relation</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.nomineeRelation || "—"}
                    </span>
                  </div>
                  {Array.isArray(selectedApplicant.formData?.workHistory) &&
                  selectedApplicant.formData.workHistory.length > 0 ? (
                    <div className="col-span-2">
                      <span className="text-slate-400 block font-semibold text-[10px] uppercase">Work experience</span>
                      <ul className="mt-1 space-y-1 text-slate-700">
                        {selectedApplicant.formData.workHistory.map((job: any, idx: number) => (
                          <li key={idx}>
                            {job.job || "Work"} at {job.employer || "—"}
                            {job.from || job.to ? ` (${job.from || "—"} to ${job.to || "—"})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* SECTION 2: EX-SERVICEMAN & GUN LICENCE */}
              {(selectedApplicant.exServiceNo ||
                selectedApplicant.formData?.exServiceNo !== "NA" ||
                selectedApplicant.armsLicenseNo ||
                selectedApplicant.formData?.gunLicence !== "NA") && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 no-print">
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-3">
                    2. Ex-Serviceman & Arms Credentials
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-amber-700 block font-semibold text-[10px] uppercase">Ex-Service No.</span>
                      <span className="font-semibold text-slate-800">
                        {selectedApplicant.exServiceNo || selectedApplicant.formData?.exServiceNo || "NA"}
                      </span>
                    </div>
                    <div>
                      <span className="text-amber-700 block font-semibold text-[10px] uppercase">Rank</span>
                      <span className="font-semibold text-slate-800">
                        {selectedApplicant.formData?.exRank || "NA"}
                      </span>
                    </div>
                    <div>
                      <span className="text-amber-700 block font-semibold text-[10px] uppercase">Discharge Date</span>
                      <span className="font-semibold text-slate-800">
                        {selectedApplicant.formData?.exDischargeDate || "NA"}
                      </span>
                    </div>
                    <div>
                      <span className="text-amber-700 block font-semibold text-[10px] uppercase">Discharge Book No.</span>
                      <span className="font-semibold text-slate-800">
                        {selectedApplicant.formData?.exDischargeBook || "NA"}
                      </span>
                    </div>
                    <div>
                      <span className="text-amber-700 block font-semibold text-[10px] uppercase">Gun Licence No.</span>
                      <span className="font-semibold text-slate-800">
                        {selectedApplicant.armsLicenseNo || selectedApplicant.formData?.gunLicence || "NA"}
                      </span>
                    </div>
                    <div>
                      <span className="text-amber-700 block font-semibold text-[10px] uppercase">Gun Serial No.</span>
                      <span className="font-semibold text-slate-800">
                        {selectedApplicant.formData?.gunNo || "NA"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: STATUTORY IDENTIFICATION & ADDRESS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 no-print">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  3. Statutory IDs & Address
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Mobile Number</span>
                    <span className="font-semibold font-mono text-emerald-800">{selectedApplicant.mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Aadhaar Number</span>
                    <span className="font-semibold font-mono text-slate-800">{selectedApplicant.aadhaarDisplay || selectedApplicant.formData?.aadhaar || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">PAN Card</span>
                    <span className="font-semibold font-mono text-slate-800">{selectedApplicant.pan || selectedApplicant.formData?.pan || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">UAN (PF Number)</span>
                    <span className="font-semibold font-mono text-slate-800">{selectedApplicant.formData?.uan || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">ESI IP Number</span>
                    <span className="font-semibold font-mono text-slate-800">{selectedApplicant.formData?.esiIp || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Preferred Dispensary</span>
                    <span className="font-semibold text-slate-800">{selectedApplicant.formData?.preferredDispensary || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Previous Employer</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicant.formData?.experienceType === "FRESHER"
                        ? "None"
                        : selectedApplicant.formData?.previousEmployer || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Police Verification</span>
                    <span className="font-semibold text-blue-700 capitalize">
                      {selectedApplicant.formData?.policeStatus || selectedApplicant.pvcStatus || "pending"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Police verification document</span>
                    <span className="font-semibold text-emerald-700">
                      {selectedApplicant.formData?.policeFileName
                        ? `✓ ${selectedApplicant.formData.policeFileName}`
                        : Array.isArray(selectedApplicant.documents) &&
                            selectedApplicant.documents.some((doc: any) => doc.docType === "POLICE_VERIFICATION")
                          ? "Attached"
                          : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 4: FAMILY MEMBERS TABLE */}
              <div className="border border-slate-200 rounded-xl overflow-hidden no-print">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    4. Family Members & Dependents
                  </h3>
                </div>
                {selectedApplicant.formData?.includeFamily === "NO" ||
                (!selectedApplicant.formData?.includeFamily &&
                  (!Array.isArray(selectedApplicant.formData?.family) ||
                    selectedApplicant.formData.family.length === 0)) ? (
                  <p className="px-4 py-3 text-xs text-slate-600">Family member details : No</p>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/50 text-[11px] font-bold text-slate-600 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2">#</th>
                        <th className="px-4 py-2">Member Name</th>
                        <th className="px-4 py-2">Relation</th>
                        <th className="px-4 py-2">Date of Birth</th>
                        <th className="px-4 py-2">Aadhaar No.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedApplicant.formData?.family || []).map((member: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-2 font-semibold text-slate-800">{member.name || "—"}</td>
                          <td className="px-4 py-2 text-slate-600">{member.relation || "—"}</td>
                          <td className="px-4 py-2 text-slate-600">{member.dateOfBirth || "—"}</td>
                          <td className="px-4 py-2 font-mono text-slate-600">{member.aadhaar || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SECTION 5: BANK & DEPOSIT */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 no-print">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  5. Bank Account & Security Deposit
                </h3>
                {selectedApplicant.formData?.uploadBankDetails === "YES" &&
                (selectedApplicant.formData?.bankName || selectedApplicant.formData?.accountNo) ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Willing to upload</span>
                    <span className="font-semibold text-slate-800">Yes</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Bank Name</span>
                    <span className="font-semibold text-slate-800">{selectedApplicant.formData?.bankName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Bank Account No.</span>
                    <span className="font-semibold font-mono text-slate-800">
                      {selectedApplicant.formData?.accountNo || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">IFSC Code</span>
                    <span className="font-semibold font-mono text-slate-800">{selectedApplicant.formData?.ifsc || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold text-[10px] uppercase">Branch name & address</span>
                    <span className="font-semibold text-slate-800">{selectedApplicant.formData?.branchName || "—"}</span>
                  </div>
                </div>
                ) : (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    The security deposit is collected only after you are selected. Bank details are filled only when this
                    person is made an employee
                    {selectedApplicant.formData?.uploadBankDetails === "NO" ? " (applicant chose No on the form)." : "."}
                  </p>
                )}
              </div>

              <AttachedDocuments person={selectedApplicant} title="6. Submitted documents" />
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 no-print">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Legal acceptance</h3>
                <p className="text-xs text-slate-700">
                  Joining terms {selectedApplicant.formData?.termsVersion || "nk-joining-1"} accepted.
                </p>
              </div>

            {/* Remarks History */}
            <div className="mb-6 border-t pt-4 no-print">
              <h3 className="text-sm font-bold text-slate-800 mb-2">Remarks & Audit Log</h3>
              <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                {selectedApplicant.remarks?.map((r: any) => (
                  <div key={r.id} className="text-xs p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="font-semibold text-slate-800">{r.user?.name}: </span>
                    <span className="text-slate-600">{r.remark}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="block text-xs font-semibold text-slate-700 mb-1">
                    Add note / remark <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Add note / remark..."
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 border rounded"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddRemark}
                  className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded"
                >
                  Post Note
                </button>
              </div>
            </div>
          </div>

          {/* FIXED MODAL FOOTER — company admin has the same decide actions as Super Admin */}
          <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50 space-y-3 no-print">
            {pendingStatus && selectedApplicant.status !== "APPROVED" ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="flex-1">
                  <span className="block text-xs font-semibold text-slate-700 mb-1">
                    {pendingStatus === "SHORTLISTED" ? "Why are you shortlisting this person?" : "Why are you rejecting this person?"}{" "}
                    <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={statusRemark}
                    onChange={(e) => setStatusRemark(e.target.value)}
                    placeholder={
                      pendingStatus === "SHORTLISTED"
                        ? "Remark for shortlist"
                        : "Reason for rejection"
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingStatus(null)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white rounded-lg border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!statusRemark.trim()) {
                        alert("Remark is required.");
                        return;
                      }
                      handleStatusChange(selectedApplicant.id, pendingStatus, statusRemark.trim());
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg text-white ${
                      pendingStatus === "REJECTED" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    Confirm {pendingStatus === "REJECTED" ? "reject" : "shortlist"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Stage: <strong className="text-slate-800">{statusLabel(selectedApplicant.status)}</strong>
                  </span>
                  {selectedApplicant.status !== "APPROVED" && selectedApplicant.status !== "SHORTLISTED" && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusRemark("");
                        setPendingStatus("SHORTLISTED");
                      }}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg"
                    >
                      Shortlist
                    </button>
                  )}
                  {selectedApplicant.status !== "APPROVED" && selectedApplicant.status !== "REJECTED" && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusRemark("");
                        setPendingStatus("REJECTED");
                      }}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg"
                    >
                      Reject
                    </button>
                  )}
                </div>

                {selectedApplicant.status !== "APPROVED" ? (
                  <button
                    type="button"
                    onClick={() => {
                      const fd = selectedApplicant.formData || {};
                      setJoinBankName(fd.bankName || "");
                      setJoinAccountNo(fd.accountNo || "");
                      setJoinIfsc(fd.ifsc || "");
                      setJoinBranchName(fd.branchName || "");
                      setJoinSecurityMoney(fd.securityMoney || "");
                      setActionError("");
                      setShowApproveModal(true);
                    }}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs"
                  >
                    Make employee
                  </button>
                ) : (
                  <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    Already employee
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* APPROVAL MODAL */}
      {showApproveModal && selectedApplicant && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Make this person an employee
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              After you save, they will get an employee number and move to the Employees page. Bank details and security deposit are required now.
            </p>

            {actionError && (
              <div className="mb-4 p-2.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                {actionError}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee ID No. <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={officeApplicantId}
                  onChange={(e) => setOfficeApplicantId(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-slate-900 font-mono"
                  placeholder="Type employee ID"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly salary (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={basicRate}
                  onChange={(e) => setBasicRate(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Divisor Days for Full Pay <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={divisorDays}
                  onChange={(e) => setDivisorDays(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border rounded text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Duty site <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded text-slate-900"
                >
                  <option value="">Select site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
                  Bank details <span className="text-red-600">*</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bank name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={joinBankName}
                      onChange={(e) => setJoinBankName(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded text-slate-900"
                      placeholder="e.g. State Bank of India"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Account number <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={joinAccountNo}
                      onChange={(e) => setJoinAccountNo(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded text-slate-900 font-mono"
                      placeholder="Account no."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      IFSC <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={joinIfsc}
                      onChange={(e) => setJoinIfsc(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 border rounded text-slate-900 font-mono"
                      placeholder="e.g. SBIN0001234"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Branch name &amp; address <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={joinBranchName}
                      onChange={(e) => setJoinBranchName(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded text-slate-900"
                      placeholder="Branch name and address"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Security deposit (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={joinSecurityMoney}
                  onChange={(e) => setJoinSecurityMoney(e.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full px-3 py-1.5 border rounded text-slate-900 font-mono"
                  placeholder="e.g. 2000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Write a short note <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={approvalRemark}
                  onChange={(e) => setApprovalRemark(e.target.value)}
                  placeholder="e.g. All documents physically verified."
                  className="w-full px-3 py-1.5 border rounded text-slate-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleApproveAndConvert}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded"
              >
                {processing ? "Please wait..." : "Save and make employee"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
