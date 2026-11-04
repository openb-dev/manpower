"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { loadCrmBook } from "../actions";
import {
  FileSpreadsheet,
  Landmark,
  Shield,
  ClipboardList,
  CalendarRange,
  BarChart3,
  Search,
  X,
  Printer,
  Pencil,
  Trash2,
} from "lucide-react";

function workKindLabel(type?: string | null) {
  if (type === "B") return "B · Building / electrical work";
  if (type === "C") return "C · Office / service";
  return "A · Supply people";
}

type Contract = {
  id: string;
  companyId: string;
  clientName: string;
  departmentName: string | null;
  contractType: string;
  workName: string | null;
  agreementNo: string | null;

  // Tender & EMD
  tenderNo: string | null;
  tenderOpening: string | null;
  estimateCost: number | null;
  tenderAmount: number | null;
  emdAmount: number | null;
  emdPercent: number | null;
  emdMode: string | null;
  emdInstrumentNo: string | null;
  emdDate: string | null;
  emdBankName: string | null;
  emdStatus: string | null;
  emdRefundDate: string | null;
  emdRefundRef: string | null;

  // PG
  pgAmount: number | null;
  pgPercent: number | null;
  pgMode: string | null;
  pgInstrumentNo: string | null;
  pgBankName: string | null;
  pgDate: string | null;
  pgExpiryDate: string | null;
  pgClaimDate: string | null;
  pgStatus: string | null;
  pgReleaseDate: string | null;
  pgReleaseRef: string | null;

  // Execution & Dates
  measurementBookNo: string | null;
  lccNo: string | null;
  startAgreement: string | null;
  startActual: string | null;
  completionAgreement: string | null;
  completionActual: string | null;
  workStatus: string;

  // Bill & Deductions Breakdown
  billNumber: string | null;
  billDate: string | null;
  grossAmount: number | null;
  securityDeposit: number | null;
  incomeTaxTds: number | null;
  gstRecovery: number | null;
  labourCess: number | null;
  waterCharge: number | null;
  esiPfDeduction: number | null;
  withheldAmount: number | null;
  otherRecovery: number | null;
  totalDeductions: number | null;
  netAmount: number | null;

  // Payment & Vouchers
  voucherNumber: string | null;
  bankReceivedDate: string | null;
  reimburseDate: string | null;
  remarks: string | null;

  _count?: { invoices: number; purchases: number };
  createdAt?: string;
  updatedAt?: string;
};

export default function CrmPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(true);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<"WORK_REGISTER" | "EMD_REGISTER" | "PG_REGISTER">("WORK_REGISTER");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // View / Print Modal
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalSection, setModalSection] = useState<"GENERAL" | "EMD" | "PG" | "EXECUTION" | "BILLING" | "PAYMENT">("GENERAL");
  const [saving, setSaving] = useState(false);

  // Form States
  const [clientName, setClientName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [contractType, setContractType] = useState("A");
  const [workName, setWorkName] = useState("");
  const [agreementNo, setAgreementNo] = useState("");
  const [workStatus, setWorkStatus] = useState("IN_PROGRESS");

  // EMD Fields
  const [tenderNo, setTenderNo] = useState("");
  const [tenderOpening, setTenderOpening] = useState("");
  const [estimateCost, setEstimateCost] = useState("");
  const [tenderAmount, setTenderAmount] = useState("");
  const [emdAmount, setEmdAmount] = useState("");
  const [emdPercent, setEmdPercent] = useState("");
  const [emdMode, setEmdMode] = useState("DEMAND_DRAFT");
  const [emdInstrumentNo, setEmdInstrumentNo] = useState("");
  const [emdDate, setEmdDate] = useState("");
  const [emdBankName, setEmdBankName] = useState("");
  const [emdStatus, setEmdStatus] = useState("SUBMITTED");
  const [emdRefundDate, setEmdRefundDate] = useState("");
  const [emdRefundRef, setEmdRefundRef] = useState("");

  // PG Fields
  const [pgAmount, setPgAmount] = useState("");
  const [pgPercent, setPgPercent] = useState("");
  const [pgMode, setPgMode] = useState("BANK_GUARANTEE");
  const [pgInstrumentNo, setPgInstrumentNo] = useState("");
  const [pgBankName, setPgBankName] = useState("");
  const [pgDate, setPgDate] = useState("");
  const [pgExpiryDate, setPgExpiryDate] = useState("");
  const [pgClaimDate, setPgClaimDate] = useState("");
  const [pgStatus, setPgStatus] = useState("SUBMITTED");
  const [pgReleaseDate, setPgReleaseDate] = useState("");
  const [pgReleaseRef, setPgReleaseRef] = useState("");

  // Execution & Dates
  const [measurementBookNo, setMeasurementBookNo] = useState("");
  const [lccNo, setLccNo] = useState("");
  const [startAgreement, setStartAgreement] = useState("");
  const [startActual, setStartActual] = useState("");
  const [completionAgreement, setCompletionAgreement] = useState("");
  const [completionActual, setCompletionActual] = useState("");

  // Bill & Deductions Breakdown
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [incomeTaxTds, setIncomeTaxTds] = useState("");
  const [gstRecovery, setGstRecovery] = useState("");
  const [labourCess, setLabourCess] = useState("");
  const [waterCharge, setWaterCharge] = useState("");
  const [esiPfDeduction, setEsiPfDeduction] = useState("");
  const [withheldAmount, setWithheldAmount] = useState("");
  const [otherRecovery, setOtherRecovery] = useState("");
  const [totalDeductions, setTotalDeductions] = useState("");
  const [netAmount, setNetAmount] = useState("");

  // Payment & Vouchers
  const [voucherNumber, setVoucherNumber] = useState("");
  const [bankReceivedDate, setBankReceivedDate] = useState("");
  const [reimburseDate, setReimburseDate] = useState("");
  const [remarks, setRemarks] = useState("");

  function loadCrmData() {
    setLoading(true);
    loadCrmBook(companySlug)
      .then((data) => {
        setContracts(data.contracts || []);
        setSites(data.sites || []);
        setCompany(data.company || null);
        setListError("");
      })
      .catch((err) => {
        setContracts([]);
        setSites([]);
        setListError(err.message || "Work register could not be loaded.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCrmData();
  }, [companySlug]);

  // Recalculate live total deductions & net amount whenever individual deductions or gross amount change
  useEffect(() => {
    const gross = parseFloat(grossAmount) || 0;
    const sd = parseFloat(securityDeposit) || 0;
    const it = parseFloat(incomeTaxTds) || 0;
    const gst = parseFloat(gstRecovery) || 0;
    const cess = parseFloat(labourCess) || 0;
    const water = parseFloat(waterCharge) || 0;
    const esipf = parseFloat(esiPfDeduction) || 0;
    const withheld = parseFloat(withheldAmount) || 0;
    const other = parseFloat(otherRecovery) || 0;

    const sumDeductions = sd + it + gst + cess + water + esipf + withheld + other;
    const computedNet = gross - sumDeductions;

    if (sumDeductions > 0 || gross > 0) {
      setTotalDeductions(sumDeductions ? sumDeductions.toFixed(2).replace(/\.00$/, "") : "0");
      setNetAmount(computedNet ? computedNet.toFixed(2).replace(/\.00$/, "") : "0");
    }
  }, [
    grossAmount,
    securityDeposit,
    incomeTaxTds,
    gstRecovery,
    labourCess,
    waterCharge,
    esiPfDeduction,
    withheldAmount,
    otherRecovery,
  ]);

  // Auto-calculate EMD amount from Tender Amount and EMD %
  function handleEmdPercentChange(pct: string) {
    setEmdPercent(pct);
    const tVal = parseFloat(tenderAmount) || parseFloat(estimateCost) || 0;
    const pVal = parseFloat(pct) || 0;
    if (tVal > 0 && pVal > 0) {
      setEmdAmount(Math.round((tVal * pVal) / 100).toString());
    }
  }

  // Auto-calculate PG amount from Tender Amount and PG %
  function handlePgPercentChange(pct: string) {
    setPgPercent(pct);
    const tVal = parseFloat(tenderAmount) || 0;
    const pVal = parseFloat(pct) || 0;
    if (tVal > 0 && pVal > 0) {
      setPgAmount(Math.round((tVal * pVal) / 100).toString());
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setModalSection("GENERAL");
    setClientName("");
    setDepartmentName("");
    setContractType("A");
    setWorkName("");
    setAgreementNo("");
    setWorkStatus("IN_PROGRESS");

    setTenderNo("");
    setTenderOpening("");
    setEstimateCost("");
    setTenderAmount("");
    setEmdAmount("");
    setEmdPercent("2");
    setEmdMode("DEMAND_DRAFT");
    setEmdInstrumentNo("");
    setEmdDate("");
    setEmdBankName("");
    setEmdStatus("SUBMITTED");
    setEmdRefundDate("");
    setEmdRefundRef("");

    setPgAmount("");
    setPgPercent("5");
    setPgMode("BANK_GUARANTEE");
    setPgInstrumentNo("");
    setPgBankName("");
    setPgDate("");
    setPgExpiryDate("");
    setPgClaimDate("");
    setPgStatus("SUBMITTED");
    setPgReleaseDate("");
    setPgReleaseRef("");

    setMeasurementBookNo("");
    setLccNo("");
    setStartAgreement("");
    setStartActual("");
    setCompletionAgreement("");
    setCompletionActual("");

    setBillNumber("");
    setBillDate("");
    setGrossAmount("");
    setSecurityDeposit("");
    setIncomeTaxTds("");
    setGstRecovery("");
    setLabourCess("");
    setWaterCharge("");
    setESI("");
    setWithheldAmount("");
    setOtherRecovery("");
    setTotalDeductions("");
    setNetAmount("");

    setVoucherNumber("");
    setBankReceivedDate("");
    setReimburseDate("");
    setRemarks("");

    setShowModal(true);
  }

  function setESI(val: string) {
    setEsiPfDeduction(val);
  }

  function formatDateInput(dateStr: string | null | undefined) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toISOString().split("T")[0];
    } catch {
      return "";
    }
  }

  function openEditModal(c: Contract) {
    setEditingId(c.id);
    setModalSection("GENERAL");

    setClientName(c.clientName || "");
    setDepartmentName(c.departmentName || "");
    setContractType(c.contractType || "A");
    setWorkName(c.workName || "");
    setAgreementNo(c.agreementNo || "");
    setWorkStatus(c.workStatus || "IN_PROGRESS");

    setTenderNo(c.tenderNo || "");
    setTenderOpening(formatDateInput(c.tenderOpening));
    setEstimateCost(c.estimateCost ? c.estimateCost.toString() : "");
    setTenderAmount(c.tenderAmount ? c.tenderAmount.toString() : "");
    setEmdAmount(c.emdAmount ? c.emdAmount.toString() : "");
    setEmdPercent(c.emdPercent ? c.emdPercent.toString() : "");
    setEmdMode(c.emdMode || "DEMAND_DRAFT");
    setEmdInstrumentNo(c.emdInstrumentNo || "");
    setEmdDate(formatDateInput(c.emdDate));
    setEmdBankName(c.emdBankName || "");
    setEmdStatus(c.emdStatus || "SUBMITTED");
    setEmdRefundDate(formatDateInput(c.emdRefundDate));
    setEmdRefundRef(c.emdRefundRef || "");

    setPgAmount(c.pgAmount ? c.pgAmount.toString() : "");
    setPgPercent(c.pgPercent ? c.pgPercent.toString() : "");
    setPgMode(c.pgMode || "BANK_GUARANTEE");
    setPgInstrumentNo(c.pgInstrumentNo || "");
    setPgBankName(c.pgBankName || "");
    setPgDate(formatDateInput(c.pgDate));
    setPgExpiryDate(formatDateInput(c.pgExpiryDate));
    setPgClaimDate(formatDateInput(c.pgClaimDate));
    setPgStatus(c.pgStatus || "SUBMITTED");
    setPgReleaseDate(formatDateInput(c.pgReleaseDate));
    setPgReleaseRef(c.pgReleaseRef || "");

    setMeasurementBookNo(c.measurementBookNo || "");
    setLccNo(c.lccNo || "");
    setStartAgreement(formatDateInput(c.startAgreement));
    setStartActual(formatDateInput(c.startActual));
    setCompletionAgreement(formatDateInput(c.completionAgreement));
    setCompletionActual(formatDateInput(c.completionActual));

    setBillNumber(c.billNumber || "");
    setBillDate(formatDateInput(c.billDate));
    setGrossAmount(c.grossAmount != null ? String(c.grossAmount) : "");
    setSecurityDeposit(c.securityDeposit != null ? String(c.securityDeposit) : "");
    setIncomeTaxTds(c.incomeTaxTds != null ? String(c.incomeTaxTds) : "");
    setGstRecovery(c.gstRecovery != null ? String(c.gstRecovery) : "");
    setLabourCess(c.labourCess != null ? String(c.labourCess) : "");
    setWaterCharge(c.waterCharge != null ? String(c.waterCharge) : "");
    setEsiPfDeduction(c.esiPfDeduction != null ? String(c.esiPfDeduction) : "");
    setWithheldAmount(c.withheldAmount != null ? String(c.withheldAmount) : "");
    setOtherRecovery(c.otherRecovery != null ? String(c.otherRecovery) : "");
    setTotalDeductions(c.totalDeductions != null ? String(c.totalDeductions) : "");
    setNetAmount(c.netAmount != null ? String(c.netAmount) : "");

    setVoucherNumber(c.voucherNumber || "");
    setBankReceivedDate(formatDateInput(c.bankReceivedDate));
    setReimburseDate(formatDateInput(c.reimburseDate));
    setRemarks(c.remarks || "");

    setShowModal(true);
  }

  async function handleSaveContract(e: React.FormEvent) {
    e.preventDefault();
    const later = workStatus === "AWARDED_PG" || workStatus === "IN_PROGRESS";
    const emdClosed = String(emdStatus || "").toUpperCase() === "REFUNDED";
    const pgReleased = String(pgStatus || "").toUpperCase() === "RELEASED";
    const requiredEntries: Array<[string, string]> = [
      ["Client / Organization Name", clientName],
      ["Full Work Name / Description", workName],
      ["Current Work Stage", workStatus],
      ["Tender / NIT No", tenderNo],
      ["Quoted / Tender Amount", tenderAmount],
      ["Earnest Money Deposit (EMD)", emdAmount],
      ["EMD Current Status", emdStatus],
    ];
    if (later) {
      requiredEntries.push(["Performance Guarantee Amount", pgAmount], ["PG Current Status", pgStatus]);
    }
    if (emdClosed) {
      requiredEntries.push(["EMD Refund / Adjustment Date", emdRefundDate]);
    }
    if (pgReleased) {
      requiredEntries.push(["PG Release Date", pgReleaseDate]);
    }
    if (billNumber.trim()) {
      requiredEntries.push(["Bill Date", billDate], ["Gross Amount", grossAmount]);
    }
    const missing = requiredEntries.find(([, value]) => !String(value ?? "").trim());
    if (missing) {
      alert(`${missing[0]} is required.`);
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        action: editingId ? "UPDATE_CONTRACT" : "CREATE_CONTRACT",
        id: editingId,
        clientName,
        departmentName,
        contractType,
        workName,
        agreementNo,
        workStatus,

        // EMD
        tenderNo,
        tenderOpening: tenderOpening || null,
        estimateCost: estimateCost || null,
        tenderAmount: tenderAmount || null,
        emdAmount: emdAmount || null,
        emdPercent: emdPercent || null,
        emdMode,
        emdInstrumentNo,
        emdDate: emdDate || null,
        emdBankName,
        emdStatus,
        emdRefundDate: emdRefundDate || null,
        emdRefundRef,

        // PG
        pgAmount: pgAmount || null,
        pgPercent: pgPercent || null,
        pgMode,
        pgInstrumentNo,
        pgBankName,
        pgDate: pgDate || null,
        pgExpiryDate: pgExpiryDate || null,
        pgClaimDate: pgClaimDate || null,
        pgStatus,
        pgReleaseDate: pgReleaseDate || null,
        pgReleaseRef,

        // Execution & Dates
        measurementBookNo,
        lccNo,
        startAgreement: startAgreement || null,
        startActual: startActual || null,
        completionAgreement: completionAgreement || null,
        completionActual: completionActual || null,

        // Billing Breakdown
        billNumber,
        billDate: billDate || null,
        grossAmount: grossAmount || null,
        securityDeposit: securityDeposit || null,
        incomeTaxTds: incomeTaxTds || null,
        gstRecovery: gstRecovery || null,
        labourCess: labourCess || null,
        waterCharge: waterCharge || null,
        esiPfDeduction: esiPfDeduction || null,
        withheldAmount: withheldAmount || null,
        otherRecovery: otherRecovery || null,
        totalDeductions: totalDeductions || null,
        netAmount: netAmount || null,

        // Payment & Vouchers
        voucherNumber,
        bankReceivedDate: bankReceivedDate || null,
        reimburseDate: reimburseDate || null,
        remarks,
      };

      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save contract entry");

      setShowModal(false);
      loadCrmData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteContract(id: string) {
    if (!confirm("Are you sure you want to delete this contract / work register entry?")) return;
    try {
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_CONTRACT", id }),
      });
      if (!res.ok) throw new Error("Failed to delete entry");
      loadCrmData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      // Search text
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.clientName?.toLowerCase().includes(q) ||
        c.departmentName?.toLowerCase().includes(q) ||
        c.agreementNo?.toLowerCase().includes(q) ||
        c.workName?.toLowerCase().includes(q) ||
        c.tenderNo?.toLowerCase().includes(q) ||
        c.emdInstrumentNo?.toLowerCase().includes(q) ||
        c.pgInstrumentNo?.toLowerCase().includes(q);

      // Status
      const matchStatus = statusFilter === "ALL" || c.workStatus === statusFilter;

      // Type
      const matchType = typeFilter === "ALL" || c.contractType === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [contracts, searchQuery, statusFilter, typeFilter]);

  // Totals for KPIs
  const totalTenderValue = contracts.reduce((acc, c) => acc + Number(c.tenderAmount || 0), 0);
  const totalEmdLocked = contracts
    .filter((c) => c.emdStatus === "ACTIVE" || c.emdStatus === "SUBMITTED")
    .reduce((acc, c) => acc + Number(c.emdAmount || 0), 0);
  const totalPgActive = contracts
    .filter((c) => c.pgStatus === "ACTIVE" || c.pgStatus === "SUBMITTED")
    .reduce((acc, c) => acc + Number(c.pgAmount || 0), 0);
  const totalGrossBilled = contracts.reduce((acc, c) => acc + Number(c.grossAmount || 0), 0);
  const totalDeductionsAll = contracts.reduce((acc, c) => acc + Number(c.totalDeductions || 0), 0);
  const totalNetRealized = contracts.reduce((acc, c) => acc + Number(c.netAmount || 0), 0);

  // Status helper badges
  function renderWorkStatusBadge(st: string) {
    switch (st) {
      case "TENDER_EMD":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">Tender / EMD Stage</span>;
      case "AWARDED_PG":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800">Awarded / PG Stage</span>;
      case "IN_PROGRESS":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">In Progress</span>;
      case "COMPLETED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">Completed</span>;
      case "CLOSED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">Closed</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">{st}</span>;
    }
  }

  function renderEmdStatusBadge(st: string | null) {
    if (!st) return <span className="text-slate-400 text-xs">—</span>;
    switch (st) {
      case "SUBMITTED":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-700 border border-amber-200">EMD Submitted</span>;
      case "ACTIVE":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">EMD Active</span>;
      case "REFUNDED":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">EMD Refunded</span>;
      case "ADJUSTED_TO_PG":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-700 border border-purple-200">Adjusted to PG</span>;
      case "ADJUSTED_TO_SD":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Adjusted to SD</span>;
      case "FORFEITED":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-50 text-red-700 border border-red-200">Forfeited</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600">{st}</span>;
    }
  }

  function renderPgStatusBadge(st: string | null) {
    if (!st) return <span className="text-slate-400 text-xs">—</span>;
    switch (st) {
      case "SUBMITTED":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-700 border border-amber-200">PG Submitted</span>;
      case "ACTIVE":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">PG Active</span>;
      case "RELEASED":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">PG Released</span>;
      case "INVOKED":
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-50 text-red-700 border border-red-200">PG Invoked</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600">{st}</span>;
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className={viewingContract ? "print:hidden space-y-6" : "space-y-6"}>
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md border border-indigo-100">
              Work & sites
            </span>
            <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md border border-emerald-100">
              Work list
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
            Work, sites and deposits
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Add a work here. Tender money is the amount you give when applying. Bank guarantee is the amount you give after winning.
          </p>
          {sites.length > 0 ? (
            <p className="text-xs text-slate-500 mt-2">
              Duty sites: {sites.map((site) => site.name).join(", ")}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2"
          >
            <span className="text-base leading-none">+</span>
            <span>New Work Register Entry</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Works</div>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{contracts.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">Contracts & Tenders</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Tender Value</div>
          <div className="text-xl font-black text-indigo-700 mt-0.5">
            ₹{totalTenderValue.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Sanctioned allocation</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">EMD Locked</div>
          <div className="text-xl font-black text-amber-700 mt-0.5">
            ₹{totalEmdLocked.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Pre-contract bids</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600">PG Active</div>
          <div className="text-xl font-black text-purple-700 mt-0.5">
            ₹{totalPgActive.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Bank Guarantees held</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Deductions</div>
          <div className="text-xl font-black text-rose-700 mt-0.5">
            ₹{totalDeductionsAll.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">SD, TDS, GST, Cess</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Net Realized</div>
          <div className="text-xl font-black text-emerald-700 mt-0.5">
            ₹{totalNetRealized.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Net bank credit</div>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Main Stage Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("WORK_REGISTER")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "WORK_REGISTER"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              <span>Full Work Register & Ledger</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold">
                {contracts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("EMD_REGISTER")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "EMD_REGISTER"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Landmark className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              <span>Pre-Contract: EMD Register</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 font-mono font-bold">
                {contracts.filter((c) => c.emdAmount || c.tenderNo).length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("PG_REGISTER")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "PG_REGISTER"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Shield className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              <span>Post-Award: PG Register</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 font-mono font-bold">
                {contracts.filter((c) => c.pgAmount || c.pgInstrumentNo).length}
              </span>
            </button>
          </div>

          {/* Type quick filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Kind of work:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All kinds</option>
              <option value="A">A · Supply people</option>
              <option value="B">B · Building / electrical work</option>
              <option value="C">C · Office / service</option>
            </select>
          </div>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Search by client, agreement no, tender no, work name, or instrument no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} aria-hidden />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Work Stages</option>
              <option value="TENDER_EMD">Pre-Contract (Tender / EMD)</option>
              <option value="AWARDED_PG">Awarded (PG Submitted)</option>
              <option value="IN_PROGRESS">In Progress (Execution)</option>
              <option value="COMPLETED">Completed</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {listError ? (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{listError}</div>
      ) : null}

      {/* Main Content Area Based on Active Tab */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-medium text-sm animate-pulse">
          Loading Government Work Register data...
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <ClipboardList className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="text-base font-bold text-slate-800">No Work Register Entries Found</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL"
              ? "No records matched your search and filter criteria. Try resetting filters."
              : "No contract or tender records have been registered yet. Click '+ New Work Register Entry' to record your first contract."}
          </p>
          {(searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
                setTypeFilter("ALL");
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* TAB 1: FULL WORK REGISTER TABLE */}
          {activeTab === "WORK_REGISTER" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Government Work Register & Billing Ledger
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Official CPWD / Public Works multi-column register with Gross, Deductions (SD, TDS, GST, Cess), and Net realization.
                  </p>
                </div>
                <div className="text-[11px] font-bold text-slate-500">
                  Showing {filteredContracts.length} records
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5 whitespace-nowrap">Agreement / Tender No</th>
                      <th className="p-3.5">Client & Work Details</th>
                      <th className="p-3.5 text-center">Kind of work</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Tender Value (₹)</th>
                      <th className="p-3.5 text-center">EMD / PG Status</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Gross Billed (₹)</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Deductions (₹)</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Net Realized (₹)</th>
                      <th className="p-3.5 text-center">Work Status</th>
                      <th className="p-3.5 text-center whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredContracts.map((c) => (
                      <tr key={c.id} className="hover:bg-indigo-50/40 transition">
                        {/* Agreement & Tender */}
                        <td className="p-3.5 font-mono">
                          <div className="font-bold text-slate-900 text-xs">
                            {c.agreementNo && c.agreementNo !== "PENDING_AWARD" ? c.agreementNo : "Award Pending"}
                          </div>
                          {c.tenderNo && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={c.tenderNo}>
                              NIT: {c.tenderNo}
                            </div>
                          )}
                          {c.measurementBookNo && (
                            <div className="text-[10px] text-indigo-600 font-semibold truncate max-w-[140px]" title={c.measurementBookNo}>
                              MB: {c.measurementBookNo}
                            </div>
                          )}
                        </td>

                        {/* Client & Work */}
                        <td className="p-3.5 max-w-xs">
                          <div className="font-bold text-slate-900 text-xs">{c.clientName}</div>
                          <div className="text-[11px] text-slate-500">{c.departmentName || "General Division"}</div>
                          <div className="text-[11px] text-slate-700 truncate mt-0.5" title={c.workName || ""}>
                            {c.workName || "Manpower Supply & Service"}
                          </div>
                        </td>

                        {/* Contract Type */}
                        <td className="p-3.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.contractType === "A"
                              ? "bg-blue-100 text-blue-800"
                              : c.contractType === "B"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-purple-100 text-purple-800"
                          }`}>
                            {workKindLabel(c.contractType)}
                          </span>
                        </td>

                        {/* Tender Value */}
                        <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                          {c.tenderAmount ? `₹${Number(c.tenderAmount).toLocaleString("en-IN")}` : "—"}
                        </td>

                        {/* EMD & PG status badges */}
                        <td className="p-3.5 text-center space-y-1">
                          <div>{renderEmdStatusBadge(c.emdStatus)}</div>
                          <div>{renderPgStatusBadge(c.pgStatus)}</div>
                        </td>

                        {/* Gross Amount */}
                        <td className="p-3.5 text-right font-mono text-slate-800">
                          {c.grossAmount ? `₹${Number(c.grossAmount).toLocaleString("en-IN")}` : "—"}
                          {c.billNumber && (
                            <div className="text-[10px] text-slate-400 font-sans">{c.billNumber}</div>
                          )}
                        </td>

                        {/* Total Deductions */}
                        <td className="p-3.5 text-right font-mono text-rose-700">
                          {c.totalDeductions ? `₹${Number(c.totalDeductions).toLocaleString("en-IN")}` : "—"}
                          {c.totalDeductions ? (
                            <div className="text-[9px] text-slate-400 font-sans">
                              SD+TDS+GST
                            </div>
                          ) : null}
                        </td>

                        {/* Net Amount */}
                        <td className="p-3.5 text-right font-mono font-black text-emerald-700 text-xs">
                          {c.netAmount ? `₹${Number(c.netAmount).toLocaleString("en-IN")}` : "—"}
                          {c.bankReceivedDate && (
                            <div className="text-[9px] text-slate-400 font-sans">
                              Paid {new Date(c.bankReceivedDate).toLocaleDateString("en-IN")}
                            </div>
                          )}
                        </td>

                        {/* Work Status */}
                        <td className="p-3.5 text-center">
                          {renderWorkStatusBadge(c.workStatus)}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewingContract(c)}
                              title="View Official Government Register Sheet"
                              className="px-2 py-1 bg-slate-100 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[11px] transition"
                            >
                              View Sheet
                            </button>
                            <button
                              onClick={() => openEditModal(c)}
                              title="Edit Entry"
                              className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100 transition"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            </button>
                            <button
                              onClick={() => handleDeleteContract(c.id)}
                              title="Delete Entry"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PRE-CONTRACT EMD REGISTER */}
          {activeTab === "EMD_REGISTER" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Pre-Contract Earnest Money Deposit (EMD) Register
                  </h3>
                  <p className="text-[11px] text-amber-700">
                    Track all tender submissions, EMD deposits (DD/FDR/BG/Online), bank receipts, and refund/adjustment before contract award.
                  </p>
                </div>
                <div className="text-[11px] font-bold text-amber-900">
                  Active Bids: {filteredContracts.filter((c) => c.emdStatus === "ACTIVE" || c.emdStatus === "SUBMITTED").length}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Tender / NIT No</th>
                      <th className="p-3.5">Client & Work</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Estimate / Quoted (₹)</th>
                      <th className="p-3.5 text-right whitespace-nowrap">EMD Amount (₹)</th>
                      <th className="p-3.5 text-center">EMD Mode</th>
                      <th className="p-3.5">Instrument / Ref No</th>
                      <th className="p-3.5">Bank & Date</th>
                      <th className="p-3.5 text-center">EMD Status</th>
                      <th className="p-3.5">Refund / Adjustment</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredContracts.map((c) => (
                      <tr key={c.id} className="hover:bg-amber-50/30 transition">
                        <td className="p-3.5 font-mono">
                          <div className="font-bold text-slate-900 text-xs">{c.tenderNo || "—"}</div>
                          {c.tenderOpening && (
                            <div className="text-[10px] text-slate-500 font-sans">
                              Opens: {new Date(c.tenderOpening).toLocaleDateString("en-IN")}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 max-w-xs">
                          <div className="font-bold text-slate-900 text-xs">{c.clientName}</div>
                          <div className="text-[11px] text-slate-500">{c.departmentName}</div>
                          <div className="text-[11px] text-slate-700 truncate" title={c.workName || ""}>
                            {c.workName}
                          </div>
                        </td>

                        <td className="p-3.5 text-right font-mono">
                          <div className="font-bold text-slate-900">
                            {c.tenderAmount ? `₹${Number(c.tenderAmount).toLocaleString("en-IN")}` : "—"}
                          </div>
                          {c.estimateCost && (
                            <div className="text-[10px] text-slate-400">
                              Est: ₹{Number(c.estimateCost).toLocaleString("en-IN")}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 text-right font-mono font-black text-amber-800 text-xs">
                          {c.emdAmount ? `₹${Number(c.emdAmount).toLocaleString("en-IN")}` : "—"}
                          {c.emdPercent && (
                            <div className="text-[10px] text-slate-400 font-sans font-normal">
                              ({c.emdPercent}%)
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {c.emdMode ? c.emdMode.replace(/_/g, " ") : "—"}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono text-xs text-slate-800">
                          {c.emdInstrumentNo || "—"}
                        </td>

                        <td className="p-3.5">
                          <div className="text-slate-800 font-medium text-[11px]">{c.emdBankName || "—"}</div>
                          {c.emdDate && (
                            <div className="text-[10px] text-slate-400">
                              {new Date(c.emdDate).toLocaleDateString("en-IN")}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          {renderEmdStatusBadge(c.emdStatus)}
                        </td>

                        <td className="p-3.5 text-xs">
                          {c.emdRefundDate ? (
                            <div>
                              <span className="font-semibold text-emerald-700">
                                {new Date(c.emdRefundDate).toLocaleDateString("en-IN")}
                              </span>
                              {c.emdRefundRef && (
                                <div className="text-[10px] text-slate-400 font-mono">{c.emdRefundRef}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => openEditModal(c)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition"
                          >
                            Edit EMD
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: POST-AWARD PG REGISTER */}
          {activeTab === "PG_REGISTER" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-purple-50/60 border-b border-purple-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-purple-900">
                    Post-Award Performance Guarantee (PG) Register
                  </h3>
                  <p className="text-[11px] text-purple-700">
                    Track Performance Guarantees submitted after contract award / LOA and before commencing work on site.
                  </p>
                </div>
                <div className="text-[11px] font-bold text-purple-900">
                  Active PG Total: ₹{totalPgActive.toLocaleString("en-IN")}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Agreement / Work Order</th>
                      <th className="p-3.5">Client & Work</th>
                      <th className="p-3.5 text-right whitespace-nowrap">Contract Value (₹)</th>
                      <th className="p-3.5 text-right whitespace-nowrap">PG Amount (₹)</th>
                      <th className="p-3.5 text-center">PG Mode</th>
                      <th className="p-3.5">BG / Instrument No</th>
                      <th className="p-3.5">Issuing Bank & Branch</th>
                      <th className="p-3.5 whitespace-nowrap">Validity / Expiry</th>
                      <th className="p-3.5 text-center">PG Status</th>
                      <th className="p-3.5">Release Details</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredContracts.map((c) => (
                      <tr key={c.id} className="hover:bg-purple-50/30 transition">
                        <td className="p-3.5 font-mono">
                          <div className="font-bold text-slate-900 text-xs">{c.agreementNo || "—"}</div>
                          <div className="text-[10px] text-slate-500">{renderWorkStatusBadge(c.workStatus)}</div>
                        </td>

                        <td className="p-3.5 max-w-xs">
                          <div className="font-bold text-slate-900 text-xs">{c.clientName}</div>
                          <div className="text-[11px] text-slate-500">{c.departmentName}</div>
                          <div className="text-[11px] text-slate-700 truncate" title={c.workName || ""}>
                            {c.workName}
                          </div>
                        </td>

                        <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                          {c.tenderAmount ? `₹${Number(c.tenderAmount).toLocaleString("en-IN")}` : "—"}
                        </td>

                        <td className="p-3.5 text-right font-mono font-black text-purple-800 text-xs">
                          {c.pgAmount ? `₹${Number(c.pgAmount).toLocaleString("en-IN")}` : "—"}
                          {c.pgPercent && (
                            <div className="text-[10px] text-slate-400 font-sans font-normal">
                              ({c.pgPercent}%)
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            {c.pgMode ? c.pgMode.replace(/_/g, " ") : "—"}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono text-xs text-slate-800">
                          {c.pgInstrumentNo || "—"}
                        </td>

                        <td className="p-3.5">
                          <div className="text-slate-800 font-medium text-[11px]">{c.pgBankName || "—"}</div>
                          {c.pgDate && (
                            <div className="text-[10px] text-slate-400">
                              Issued: {new Date(c.pgDate).toLocaleDateString("en-IN")}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 text-xs">
                          {c.pgExpiryDate ? (
                            <div>
                              <span className="font-semibold text-slate-800">
                                {new Date(c.pgExpiryDate).toLocaleDateString("en-IN")}
                              </span>
                              {c.pgClaimDate && (
                                <div className="text-[10px] text-slate-400">
                                  Claim: {new Date(c.pgClaimDate).toLocaleDateString("en-IN")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          {renderPgStatusBadge(c.pgStatus)}
                        </td>

                        <td className="p-3.5 text-xs">
                          {c.pgReleaseDate ? (
                            <div>
                              <span className="font-semibold text-emerald-700">
                                {new Date(c.pgReleaseDate).toLocaleDateString("en-IN")}
                              </span>
                              {c.pgReleaseRef && (
                                <div className="text-[10px] text-slate-400 font-mono">{c.pgReleaseRef}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => openEditModal(c)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition"
                          >
                            Edit PG
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: CREATE / EDIT WORK REGISTER ENTRY */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full my-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-400/30">
                    {editingId ? "Edit Register Entry" : "New Contract & Register Entry"}
                  </span>
                  <span className="text-xs text-slate-400">CPWD / Public Works Format</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  {editingId ? `Update: ${clientName || "Contract Record"}` : "Create Work Register Record"}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Modal Section Nav Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto px-6 py-2.5 bg-slate-100 border-b border-slate-200 shrink-0 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setModalSection("GENERAL")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  modalSection === "GENERAL" ? "bg-white text-indigo-700 shadow-sm" : "hover:text-slate-900"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  1. <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> General Details
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModalSection("EMD")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  modalSection === "EMD" ? "bg-white text-amber-700 shadow-sm" : "hover:text-slate-900"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  2. <Landmark className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Pre-Contract (EMD)
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModalSection("PG")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  modalSection === "PG" ? "bg-white text-purple-700 shadow-sm" : "hover:text-slate-900"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  3. <Shield className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Post-Award (PG)
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModalSection("EXECUTION")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  modalSection === "EXECUTION" ? "bg-white text-blue-700 shadow-sm" : "hover:text-slate-900"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  4. <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> MB & Dates
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModalSection("BILLING")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  modalSection === "BILLING" ? "bg-white text-rose-700 shadow-sm" : "hover:text-slate-900"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  5. <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Billing & Deductions
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModalSection("PAYMENT")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  modalSection === "PAYMENT" ? "bg-white text-emerald-700 shadow-sm" : "hover:text-slate-900"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  6. <Landmark className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Bank & Vouchers
                </span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form noValidate onSubmit={handleSaveContract} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* SECTION 1: GENERAL & WORK DETAILS */}
              {modalSection === "GENERAL" && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-800">Client & Agreement Identification</h3>
                    <p className="text-xs text-slate-500">
                      Enter the government or corporate client, agreement number, work name, and classification.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Client / Organization Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. West Bengal State Electricity (WBSEDCL)"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Department / Division / Office <span className="text-red-600">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Kolkata North Substation Division"
                        value={departmentName}
                        onChange={(e) => setDepartmentName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Agreement / Work Order No <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. NK/AGR/WBSEDCL/2026/089"
                        value={agreementNo}
                        onChange={(e) => setAgreementNo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">What kind of work? <span className="text-red-600">*</span></label>
                      <select
                        required
                        value={contractType}
                        onChange={(e) => setContractType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="A">A · Supply people (guards, helpers, cleaners)</option>
                        <option value="B">B · Building / electrical / civil work</option>
                        <option value="C">C · Office / housekeeping / other service</option>
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1">A = send employees. B = construction work. C = office work.</p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Current Work Stage <span className="text-red-600">*</span></label>
                      <select
                        required
                        value={workStatus}
                        onChange={(e) => setWorkStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="TENDER_EMD">Pre-Contract: Tender / EMD Stage</option>
                        <option value="AWARDED_PG">Awarded: Performance Guarantee (PG) Stage</option>
                        <option value="IN_PROGRESS">Execution: In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CLOSED">Closed / Archived</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Full Work Name / Description <span className="text-red-600">*</span></label>
                    <textarea
                      required
                      rows={2}
                      placeholder="e.g. Round-the-clock Security Guard & Supervisor Deployment at 33/11kV Substation"
                      value={workName}
                      onChange={(e) => setWorkName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SECTION 2: PRE-CONTRACT TENDER & EMD BREAKDOWN */}
              {modalSection === "EMD" && (
                <div className="space-y-4">
                  <div className="border-b border-amber-100 pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-amber-900">Pre-Contract: Tender & EMD Breakdown</h3>
                        <p className="text-xs text-amber-700">
                          Details prior to getting the contract: Tender/NIT number, earnest money deposit, bank instrument, and refund/adjustment.
                        </p>
                      </div>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md">
                        Pre-Award Phase
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Tender / NIT No <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. NIT/WBSEDCL/SEC/2025/112"
                        value={tenderNo}
                        onChange={(e) => setTenderNo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Tender Opening Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={tenderOpening}
                        onChange={(e) => setTenderOpening(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Estimated Department Cost (₹) <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="number"
                        placeholder="₹"
                        value={estimateCost}
                        onChange={(e) => setEstimateCost(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-200">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">
                        Quoted / Tender Amount (₹)
 <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="number"
                        placeholder="₹ Total quoted value"
                        value={tenderAmount}
                        onChange={(e) => setTenderAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">EMD % of Tender <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="number"
                        step="0.1"
                        placeholder="Usually 2%"
                        value={emdPercent}
                        onChange={(e) => handleEmdPercentChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">
                        Earnest Money Deposit (EMD) (₹)
 <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="number"
                        placeholder="₹ EMD value"
                        value={emdAmount}
                        onChange={(e) => setEmdAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-mono font-bold text-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">EMD Mode <span className="text-red-600">*</span></label>
                      <select
                        required
                        value={emdMode}
                        onChange={(e) => setEmdMode(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      >
                        <option value="DEMAND_DRAFT">Demand Draft (DD)</option>
                        <option value="FDR">Fixed Deposit Receipt (FDR)</option>
                        <option value="BANK_GUARANTEE">Bank Guarantee (BG)</option>
                        <option value="ONLINE">Online / RTGS / NEFT</option>
                        <option value="CHALLAN">Treasury Challan</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">EMD Instrument / DD / FDR No <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. FDR/SBI/782190"
                        value={emdInstrumentNo}
                        onChange={(e) => setEmdInstrumentNo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">EMD Issue Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={emdDate}
                        onChange={(e) => setEmdDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1">Issuing Bank & Branch <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. State Bank of India, Dalhousie Branch, Kolkata"
                        value={emdBankName}
                        onChange={(e) => setEmdBankName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">EMD Current Status <span className="text-red-600">*</span></label>
                      <select
                        required
                        value={emdStatus}
                        onChange={(e) => setEmdStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      >
                        <option value="SUBMITTED">Submitted with Bid</option>
                        <option value="ACTIVE">Active / Under Evaluation</option>
                        <option value="REFUNDED">Refunded to Firm</option>
                        <option value="ADJUSTED_TO_PG">Adjusted towards PG</option>
                        <option value="ADJUSTED_TO_SD">Adjusted towards SD</option>
                        <option value="FORFEITED">Forfeited</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">EMD Refund / Adjustment Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={emdRefundDate}
                        onChange={(e) => setEmdRefundDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Refund / Adjustment Voucher Ref <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. VCH-REF-2026/012 or Letter No"
                        value={emdRefundRef}
                        onChange={(e) => setEmdRefundRef(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: POST-AWARD / PRE-WORK PERFORMANCE GUARANTEE (PG) */}
              {modalSection === "PG" && (
                <div className="space-y-4">
                  <div className="border-b border-purple-100 pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-purple-900">Post-Award: Performance Guarantee (PG) Breakdown</h3>
                        <p className="text-xs text-purple-700">
                          Required after getting contract/LOA, before starting work on site. Track Bank Guarantee details, validity, and release.
                        </p>
                      </div>
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-md">
                        Pre-Work Security
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-purple-50/50 p-4 rounded-xl border border-purple-200">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">PG % of Contract Value <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="number"
                        step="0.1"
                        placeholder="Usually 3% to 5%"
                        value={pgPercent}
                        onChange={(e) => handlePgPercentChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">
                        Performance Guarantee Amount (₹)
 <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="number"
                        placeholder="₹ PG value"
                        value={pgAmount}
                        onChange={(e) => setPgAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-purple-300 rounded-xl text-xs font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-1">PG Instrument Mode <span className="text-red-600">*</span></label>
                      <select
                        required
                        value={pgMode}
                        onChange={(e) => setPgMode(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      >
                        <option value="BANK_GUARANTEE">Bank Guarantee (BG)</option>
                        <option value="FDR">Fixed Deposit Receipt (FDR)</option>
                        <option value="DEMAND_DRAFT">Demand Draft (DD)</option>
                        <option value="CASH_DEPOSIT">Cash Deposit / Treasury</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">PG / BG Instrument Number <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. BG/PNB/2026/4412"
                        value={pgInstrumentNo}
                        onChange={(e) => setPgInstrumentNo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Issuing Bank & Branch <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Punjab National Bank, Burrabazar Branch"
                        value={pgBankName}
                        onChange={(e) => setPgBankName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">PG Issue Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={pgDate}
                        onChange={(e) => setPgDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Validity / Expiry Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="date"
                        value={pgExpiryDate}
                        onChange={(e) => setPgExpiryDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Claim Period Expiry Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={pgClaimDate}
                        onChange={(e) => setPgClaimDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">PG Current Status <span className="text-red-600">*</span></label>
                      <select
                        required
                        value={pgStatus}
                        onChange={(e) => setPgStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      >
                        <option value="SUBMITTED">Submitted to Client</option>
                        <option value="ACTIVE">Active & Verified</option>
                        <option value="RELEASED">Released / Discharged</option>
                        <option value="INVOKED">Invoked / Encashment</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">PG Release Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={pgReleaseDate}
                        onChange={(e) => setPgReleaseDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Release Letter / Voucher Ref <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. REL-BG/2027/99"
                        value={pgReleaseRef}
                        onChange={(e) => setPgReleaseRef(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4: EXECUTION & MEASUREMENT (MB, LCC, DATES) */}
              {modalSection === "EXECUTION" && (
                <div className="space-y-4">
                  <div className="border-b border-blue-100 pb-2">
                    <h3 className="text-sm font-bold text-blue-900">Execution, Measurement & Time Schedule</h3>
                    <p className="text-xs text-blue-700">
                      Measurement Book (MB) volume, Labour Contractor Certificate (LCC), and stipulated vs actual work dates.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Measurement Book (MB) Reference <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. MB-2026/104, Page 12 to 28"
                        value={measurementBookNo}
                        onChange={(e) => setMeasurementBookNo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Labour Contractor Certificate (LCC) No <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. LCC/WB/KOL/0942"
                        value={lccNo}
                        onChange={(e) => setLccNo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Stipulated Start Date (Agreement) <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={startAgreement}
                        onChange={(e) => setStartAgreement(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Actual Start Date (On Site) <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={startActual}
                        onChange={(e) => setStartActual(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Stipulated Completion Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={completionAgreement}
                        onChange={(e) => setCompletionAgreement(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Actual Completion Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={completionActual}
                        onChange={(e) => setCompletionActual(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 5: BILLING, DEDUCTIONS & RECOVERIES BREAKDOWN */}
              {modalSection === "BILLING" && (
                <div className="space-y-4">
                  <div className="border-b border-rose-100 pb-2">
                    <h3 className="text-sm font-bold text-rose-900">
                      Running Bill & Statutory Deductions Breakdown
                    </h3>
                    <p className="text-xs text-rose-700">
                      Official CPWD / Public Works breakdown: Security Deposit, TDS u/s 194C, GST TDS, Labour Cess, and Withheld amounts.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Running Bill Number <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. RA-04 / Final Bill"
                        value={billNumber}
                        onChange={(e) => setBillNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Bill Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={billDate}
                        onChange={(e) => setBillDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-900 block mb-1">
                        Gross Bill Amount (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="number"
                        placeholder="₹ Gross amount"
                        value={grossAmount}
                        onChange={(e) => setGrossAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-rose-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none bg-rose-50/20"
                      />
                    </div>
                  </div>

                  {/* Deduction Breakdown Grid */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Recoveries & Deductions Breakdown (₹)
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Security Deposit (SD)
 <span className="text-red-600">*</span></label>
                        <input
                          required
                          type="number"
                          placeholder="₹ SD (5%/10%)"
                          value={securityDeposit}
                          onChange={(e) => setSecurityDeposit(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Income Tax TDS (194C)
 <span className="text-red-600">*</span></label>
                        <input
                          required
                          type="number"
                          placeholder="₹ IT TDS (1%/2%)"
                          value={incomeTaxTds}
                          onChange={(e) => setIncomeTaxTds(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          GST Recovery / TDS
 <span className="text-red-600">*</span></label>
                        <input
                          required
                          type="number"
                          placeholder="₹ GST TDS (2%)"
                          value={gstRecovery}
                          onChange={(e) => setGstRecovery(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Labour Welfare Cess (1%)
 <span className="text-red-600">*</span></label>
                        <input
                          required
                          type="number"
                          placeholder="₹ Cess (1%)"
                          value={labourCess}
                          onChange={(e) => setLabourCess(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Water Charges <span className="text-red-600">*</span></label>
                        <input
                          required
                          type="number"
                          placeholder="₹ Water charges"
                          value={waterCharge}
                          onChange={(e) => setWaterCharge(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">ESI / PF Withheld <span className="text-red-600">*</span></label>
                        <input
                          required
                          type="number"
                          placeholder="₹ ESI / PF deduction"
                          value={esiPfDeduction}
                          onChange={(e) => setEsiPfDeduction(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Other Withheld <span className="text-red-600">*</span></label>
                        <input
                          required
                          type="number"
                          placeholder="₹ Retention withheld"
                          value={withheldAmount}
                          onChange={(e) => setWithheldAmount(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Other Recovery / Fine <span className="text-red-600">*</span></label>
                        <input
                          required
                          type="number"
                          placeholder="₹ Other penalty"
                          value={otherRecovery}
                          onChange={(e) => setOtherRecovery(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Computed Summary Banner */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
                    <div>
                      <div className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                        Total Deductions & Recoveries
                      </div>
                      <div className="text-xl font-mono font-black text-rose-700 mt-1">
                        ₹{totalDeductions ? Number(totalDeductions).toLocaleString("en-IN") : "0"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Auto-calculated sum of all deductions</div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        Net Realizable / Passed Amount
                      </div>
                      <div className="text-2xl font-mono font-black text-emerald-700 mt-1">
                        ₹{netAmount ? Number(netAmount).toLocaleString("en-IN") : "0"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Gross Bill Amount − Total Deductions</div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 6: PAYMENT REALIZATION & VOUCHERS */}
              {modalSection === "PAYMENT" && (
                <div className="space-y-4">
                  <div className="border-b border-emerald-100 pb-2">
                    <h3 className="text-sm font-bold text-emerald-900">Payment Realization & Bank Settlement</h3>
                    <p className="text-xs text-emerald-700">
                      Record when net funds hit your bank account, voucher numbers, and SD reimbursement dates.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Passed Voucher Number <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. VCH-2026-0914"
                        value={voucherNumber}
                        onChange={(e) => setVoucherNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Bank Received / Credit Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={bankReceivedDate}
                        onChange={(e) => setBankReceivedDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Reimburse / SD Release Date <span className="text-red-600">*</span></label>
                      <input
                        required
                        type="date"
                        value={reimburseDate}
                        onChange={(e) => setReimburseDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Remarks / Bank Account Details <span className="text-red-600">*</span></label>
                    <textarea
                      required
                      rows={3}
                      placeholder="e.g. Bill passed and credited to SBI Current A/c. Labour compliance verified."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="flex items-center gap-1.5">
                  {modalSection !== "GENERAL" && (
                    <button
                      type="button"
                      onClick={() => {
                        const sections: Array<"GENERAL" | "EMD" | "PG" | "EXECUTION" | "BILLING" | "PAYMENT"> = [
                          "GENERAL",
                          "EMD",
                          "PG",
                          "EXECUTION",
                          "BILLING",
                          "PAYMENT",
                        ];
                        const idx = sections.indexOf(modalSection);
                        if (idx > 0) setModalSection(sections[idx - 1]);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      ← Back
                    </button>
                  )}
                  {modalSection !== "PAYMENT" && (
                    <button
                      type="button"
                      onClick={() => {
                        const sections: Array<"GENERAL" | "EMD" | "PG" | "EXECUTION" | "BILLING" | "PAYMENT"> = [
                          "GENERAL",
                          "EMD",
                          "PG",
                          "EXECUTION",
                          "BILLING",
                          "PAYMENT",
                        ];
                        const idx = sections.indexOf(modalSection);
                        if (idx < sections.length - 1) setModalSection(sections[idx + 1]);
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
                    >
                      Next Step →
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    {saving ? "Saving Record..." : editingId ? "Update Register Record" : "Save Contract Entry"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* MODAL: OFFICIAL PRINTABLE GOVERNMENT WORK REGISTER SHEET */}
      {viewingContract && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:bg-white print:p-0 print:overflow-visible print:block">
          <div className="bg-white rounded-2xl max-w-4xl w-full my-6 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden border border-slate-300 print:max-w-none print:shadow-none print:rounded-none print:border-0 print:max-h-none print:overflow-visible print:my-0">
            {/* Action Bar */}
            <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Government Work Register Sheet
                </span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs font-mono text-slate-300">
                  {viewingContract.agreementNo || "PENDING"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition"
                >
                  <Printer className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  <span>Print Register</span>
                </button>
                <button
                  onClick={() => {
                    const c = viewingContract;
                    setViewingContract(null);
                    openEditModal(c);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    Edit
                  </span>
                </button>
                <button
                  onClick={() => setViewingContract(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800 print:p-0">
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                  FORM OF GOVERNMENT CONTRACT WORK REGISTER & RECOVERIES LEDGER
                </div>
                <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                  {viewingContract.clientName}
                </h1>
                <div className="text-xs font-semibold text-slate-700">
                  {viewingContract.departmentName || "Works & Maintenance Division"}
                </div>
                <div className="inline-block px-3 py-0.5 mt-1 bg-slate-100 rounded text-xs font-mono font-bold text-slate-800">
                  Agreement / Order No: {viewingContract.agreementNo || "Pending Formal Award"}
                </div>
              </div>

              {/* Work Summary Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Name of Work</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {viewingContract.workName || "Comprehensive Services"}
                  </div>
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Contractor / Firm</div>
                  <div className="font-bold text-slate-800">
                    {company?.legalName || "M/s. N.K. Enterprise"} (Registration / MSME Certified)
                  </div>
                </div>

                <div className="space-y-1 md:text-right">
                  <div>
                    <span className="text-slate-500">Classification: </span>
                    <span className="font-bold">{workKindLabel(viewingContract.contractType)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Work Status: </span>
                    <span className="font-bold">{viewingContract.workStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tender Sanctioned: </span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{viewingContract.tenderAmount ? Number(viewingContract.tenderAmount).toLocaleString("en-IN") : "—"}
                    </span>
                  </div>
                  {viewingContract.estimateCost && (
                    <div>
                      <span className="text-slate-500">Estimated Cost: </span>
                      <span className="font-mono">₹{Number(viewingContract.estimateCost).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Two-Column Stage Cards: EMD vs PG */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* EMD Stage Card */}
                <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                    <span className="font-black text-amber-900 uppercase tracking-wider text-[11px]">
                      Stage I: Pre-Contract EMD
                    </span>
                    {renderEmdStatusBadge(viewingContract.emdStatus)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Tender / NIT No:</span>
                      <span className="font-mono font-bold text-slate-800">{viewingContract.tenderNo || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Opening Date:</span>
                      <span className="font-medium text-slate-800">
                        {viewingContract.tenderOpening ? new Date(viewingContract.tenderOpening).toLocaleDateString("en-IN") : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">EMD Amount:</span>
                      <span className="font-mono font-black text-amber-900 text-sm">
                        ₹{viewingContract.emdAmount ? Number(viewingContract.emdAmount).toLocaleString("en-IN") : "—"}
                        {viewingContract.emdPercent && ` (${viewingContract.emdPercent}%)`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">EMD Mode:</span>
                      <span className="font-semibold text-slate-800">{viewingContract.emdMode || "—"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Instrument / DD No:</span>
                      <span className="font-mono text-slate-800">{viewingContract.emdInstrumentNo || "—"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Bank & Branch:</span>
                      <span className="text-slate-800">{viewingContract.emdBankName || "—"}</span>
                    </div>
                    {viewingContract.emdRefundDate && (
                      <div className="col-span-2 pt-1 border-t border-amber-200/60 text-emerald-800">
                        Refunded: {new Date(viewingContract.emdRefundDate).toLocaleDateString("en-IN")} ({viewingContract.emdRefundRef})
                      </div>
                    )}
                  </div>
                </div>

                {/* PG Stage Card */}
                <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-purple-200 pb-1.5">
                    <span className="font-black text-purple-900 uppercase tracking-wider text-[11px]">
                      Stage II: Performance Guarantee (PG)
                    </span>
                    {renderPgStatusBadge(viewingContract.pgStatus)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">PG Amount:</span>
                      <span className="font-mono font-black text-purple-900 text-sm">
                        ₹{viewingContract.pgAmount ? Number(viewingContract.pgAmount).toLocaleString("en-IN") : "—"}
                        {viewingContract.pgPercent && ` (${viewingContract.pgPercent}%)`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Instrument Mode:</span>
                      <span className="font-semibold text-slate-800">{viewingContract.pgMode || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">BG / Ref No:</span>
                      <span className="font-mono font-bold text-slate-800">{viewingContract.pgInstrumentNo || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Validity Expiry:</span>
                      <span className="font-semibold text-slate-800">
                        {viewingContract.pgExpiryDate ? new Date(viewingContract.pgExpiryDate).toLocaleDateString("en-IN") : "—"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Issuing Bank & Branch:</span>
                      <span className="text-slate-800">{viewingContract.pgBankName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Issue Date:</span>
                      <span className="text-slate-800">
                        {viewingContract.pgDate ? new Date(viewingContract.pgDate).toLocaleDateString("en-IN") : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Claim Expiry:</span>
                      <span className="text-slate-800">
                        {viewingContract.pgClaimDate ? new Date(viewingContract.pgClaimDate).toLocaleDateString("en-IN") : "—"}
                      </span>
                    </div>
                    {viewingContract.pgReleaseDate && (
                      <div className="col-span-2 pt-1 border-t border-purple-200/60 text-emerald-800">
                        Released: {new Date(viewingContract.pgReleaseDate).toLocaleDateString("en-IN")} ({viewingContract.pgReleaseRef})
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Execution & Measurement References */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                  Measurement Book & Schedule Tracking
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Measurement Book No:</span>
                    <span className="font-mono font-bold text-slate-800">{viewingContract.measurementBookNo || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">LCC No:</span>
                    <span className="font-mono font-bold text-slate-800">{viewingContract.lccNo || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Stipulated Start:</span>
                    <span className="font-medium text-slate-800">
                      {viewingContract.startAgreement ? new Date(viewingContract.startAgreement).toLocaleDateString("en-IN") : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Stipulated Completion:</span>
                    <span className="font-medium text-slate-800">
                      {viewingContract.completionAgreement ? new Date(viewingContract.completionAgreement).toLocaleDateString("en-IN") : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Column Billing & Deductions Breakdown Ledger */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Running Bill & Statutory Deductions Ledger
                </div>

                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="p-2 border-r border-slate-300">Bill No & Date</th>
                        <th className="p-2 border-r border-slate-300 text-right">Gross (₹)</th>
                        <th className="p-2 border-r border-slate-300 text-right">SD (₹)</th>
                        <th className="p-2 border-r border-slate-300 text-right">IT TDS (₹)</th>
                        <th className="p-2 border-r border-slate-300 text-right">GST TDS (₹)</th>
                        <th className="p-2 border-r border-slate-300 text-right">Cess (₹)</th>
                        <th className="p-2 border-r border-slate-300 text-right">Withheld (₹)</th>
                        <th className="p-2 border-r border-slate-300 text-right">Total Ded (₹)</th>
                        <th className="p-2 border-r border-slate-300 text-right bg-emerald-50 text-emerald-900">Net Realized (₹)</th>
                        <th className="p-2">Voucher & Bank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-2 border-r border-slate-300 font-mono text-[11px]">
                          <div className="font-bold text-slate-900">{viewingContract.billNumber || "RA Bill"}</div>
                          <div className="text-[10px] text-slate-400">
                            {viewingContract.billDate ? new Date(viewingContract.billDate).toLocaleDateString("en-IN") : "—"}
                          </div>
                        </td>

                        <td className="p-2 border-r border-slate-300 font-mono text-right font-bold text-slate-900">
                          {viewingContract.grossAmount ? `₹${Number(viewingContract.grossAmount).toLocaleString("en-IN")}` : "—"}
                        </td>

                        <td className="p-2 border-r border-slate-300 font-mono text-right text-rose-700">
                          {viewingContract.securityDeposit ? `₹${Number(viewingContract.securityDeposit).toLocaleString("en-IN")}` : "0"}
                        </td>

                        <td className="p-2 border-r border-slate-300 font-mono text-right text-rose-700">
                          {viewingContract.incomeTaxTds ? `₹${Number(viewingContract.incomeTaxTds).toLocaleString("en-IN")}` : "0"}
                        </td>

                        <td className="p-2 border-r border-slate-300 font-mono text-right text-rose-700">
                          {viewingContract.gstRecovery ? `₹${Number(viewingContract.gstRecovery).toLocaleString("en-IN")}` : "0"}
                        </td>

                        <td className="p-2 border-r border-slate-300 font-mono text-right text-rose-700">
                          {viewingContract.labourCess ? `₹${Number(viewingContract.labourCess).toLocaleString("en-IN")}` : "0"}
                        </td>

                        <td className="p-2 border-r border-slate-300 font-mono text-right text-rose-700">
                          {viewingContract.withheldAmount ? `₹${Number(viewingContract.withheldAmount).toLocaleString("en-IN")}` : "0"}
                        </td>

                        <td className="p-2 border-r border-slate-300 font-mono text-right font-bold text-rose-800">
                          {viewingContract.totalDeductions ? `₹${Number(viewingContract.totalDeductions).toLocaleString("en-IN")}` : "—"}
                        </td>

                        <td className="p-2 border-r border-slate-300 font-mono text-right font-black text-emerald-800 bg-emerald-50/50">
                          {viewingContract.netAmount ? `₹${Number(viewingContract.netAmount).toLocaleString("en-IN")}` : "—"}
                        </td>

                        <td className="p-2 text-[11px]">
                          <div className="font-mono font-bold text-slate-800">{viewingContract.voucherNumber || "—"}</div>
                          {viewingContract.bankReceivedDate && (
                            <div className="text-[10px] text-emerald-700 font-semibold">
                              Recd: {new Date(viewingContract.bankReceivedDate).toLocaleDateString("en-IN")}
                            </div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              {viewingContract.remarks && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700">Remarks / Ledger Notes: </span>
                  <span className="text-slate-600">{viewingContract.remarks}</span>
                </div>
              )}

              {/* Official Signatures Block */}
              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs border-t border-slate-200">
                <div>
                  <div className="h-10 border-b border-dashed border-slate-400 mb-2"></div>
                  <div className="font-bold text-slate-800">Prepared by</div>
                  <div className="text-[10px] text-slate-500">Accounts & Billing Officer</div>
                </div>
                <div>
                  <div className="h-10 border-b border-dashed border-slate-400 mb-2"></div>
                  <div className="font-bold text-slate-800">Checked & Verified</div>
                  <div className="text-[10px] text-slate-500">Divisional Accountant</div>
                </div>
                <div>
                  <div className="h-10 border-b border-dashed border-slate-400 mb-2"></div>
                  <div className="font-bold text-slate-800">Executive Engineer / Director</div>
                  <div className="text-[10px] text-slate-500">Authorised Signatory</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
