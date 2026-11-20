"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { loadCrmBook } from "../actions";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";
import { formatDateDmy, maskDmyInput } from "@/lib/applicantFormFields";
import {
  downloadEmdRegisterExcel,
  emdIssueDdNo as emdDdOf,
  emdIssueFdNo as emdFdOf,
  emdMaturityDdNo as emdMatDdOf,
  emdMaturityFdNo as emdMatFdOf,
  emdReleaseDdNo as emdRelDdOf,
  emdReleaseFdNo as emdRelFdOf,
} from "@/lib/downloadEmdRegisterExcel";
import {
  downloadPgRegisterExcel,
  pgIssueBgNo as issueBgNoOf,
  pgIssueFdNo as issueFdNoOf,
  pgMaturityBgNo as maturityBgNoOf,
  pgMaturityFdNo as maturityFdNoOf,
  pgReleaseBgNo as releaseBgNoOf,
  pgReleaseFdNo as releaseFdNoOf,
} from "@/lib/downloadPgRegisterExcel";
import {
  downloadWorkRegisterExcel,
  emptyWorkPayment,
  nextRaBillNo,
  paymentLineHasValue,
  raBillDropdownOptions,
  workPaymentLines,
  type WorkPaymentLine,
} from "@/lib/downloadWorkRegisterExcel";
import {
  downloadEmdRegisterPdf,
  downloadPgRegisterPdf,
  downloadWorkRegisterPdf,
} from "@/lib/downloadRegisterPdf";
import {
  FileSpreadsheet,
  Landmark,
  Shield,
  ClipboardList,
  Search,
  X,
  Printer,
  Pencil,
} from "lucide-react";

function workKindLabel(type?: string | null) {
  if (type === "B") return "B · Building / electrical work";
  if (type === "C") return "C · Office / service";
  return "A · Supply people";
}

function moneyCell(value: unknown) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function emptyPayment(raBillNo = ""): WorkPaymentLine {
  return emptyWorkPayment(raBillNo);
}

function defaultRaRows(): WorkPaymentLine[] {
  return [emptyPayment("")];
}

const BILL_LINE_FIELDS: Array<{ no: number; key: keyof WorkPaymentLine; label: string; type: "text" | "number" | "date" | "select" }> = [
  { no: 18, key: "raBillNo", label: "Running Account Bill (R.A. Bill) No.", type: "select" },
  { no: 19, key: "mbNo", label: "M.B. No.", type: "text" },
  { no: 20, key: "billNumber", label: "Bill No.", type: "text" },
  { no: 21, key: "billDate", label: "Bill Date", type: "date" },
  { no: 22, key: "grossAmount", label: "Gross / Bill Amount", type: "number" },
  { no: 23, key: "taxableAmount", label: "Taxable Amount (Without GST)", type: "number" },
  { no: 24, key: "gstAmountOfBill", label: "Total GST Amount of Bill", type: "number" },
  { no: 25, key: "sdAmount", label: "Security Deposit (S.D.)", type: "number" },
  { no: 26, key: "itAmount", label: "Income Tax @ 1% or 2% (TDS IT)", type: "number" },
  { no: 27, key: "gstAmount", label: "GST @2% (TDS GST)", type: "number" },
  { no: 28, key: "labourCess", label: "Labour welfare Cess", type: "number" },
  { no: 29, key: "eduCess", label: "Edu. Cess", type: "number" },
  { no: 30, key: "waterCharge", label: "Water Charge", type: "number" },
  { no: 31, key: "withheldAmount", label: "Withheld Amount", type: "number" },
  { no: 32, key: "withheldReason", label: "withheld reason", type: "text" },
  { no: 33, key: "netAmount", label: "Net Amount", type: "number" },
  { no: 34, key: "voucherNo", label: "Voucher No.", type: "text" },
  { no: 35, key: "voucherDate", label: "Date", type: "date" },
  { no: 36, key: "epfo", label: "EPFO", type: "number" },
  { no: 37, key: "esic", label: "ESIC", type: "number" },
  { no: 38, key: "reimburseAmount", label: "Amount", type: "number" },
  { no: 39, key: "dateOfPayment", label: "Date of payment", type: "date" },
  { no: 40, key: "bankReceivedDate", label: "Bank Recived Date", type: "date" },
];

const WORK_HEADER_FIELDS: Array<{ no: number; label: string; key: string; type: "text" | "number" | "date" }> = [
  { no: 2, label: "Reg. Ref.", key: "regRef", type: "text" },
  { no: 3, label: "Department/ Division", key: "departmentName", type: "text" },
  { no: 4, label: "Name of work", key: "workName", type: "text" },
  { no: 5, label: "Agmt./W.O. No.", key: "agreementNo", type: "text" },
  { no: 6, label: "Awarded Date", key: "awardedDate", type: "date" },
  { no: 7, label: "Working Period", key: "workingDays", type: "text" },
  { no: 8, label: "Tender Amount", key: "tenderAmount", type: "number" },
  { no: 9, label: "Estimate Cost", key: "estimateCost", type: "number" },
  { no: 10, label: "EMD Amount", key: "emdAmount", type: "number" },
  { no: 11, label: "EMD Date", key: "emdDate", type: "date" },
  { no: 12, label: "P.G. Amount", key: "pgAmount", type: "number" },
  { no: 13, label: "P.G. Date", key: "pgDate", type: "date" },
  { no: 14, label: "As Per Agmt.", key: "startAgreement", type: "date" },
  { no: 15, label: "As Per Actual", key: "startActual", type: "date" },
  { no: 16, label: "As Per Agmt.", key: "completionAgreement", type: "date" },
  { no: 17, label: "As Per Actual", key: "completionActual", type: "date" },
];

const SHEET_INPUT =
  "w-full min-w-[76px] h-8 px-1 border-0 bg-transparent text-[11px] focus:outline-none focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-500";

function moveSheetFocus(root: HTMLElement | null, from: EventTarget | null, dir: 1 | -1) {
  if (!root || !(from instanceof HTMLElement)) return;
  const fields = Array.from(
    root.querySelectorAll<HTMLElement>("input:not([disabled]):not([tabindex='-1']), select:not([disabled]), textarea:not([disabled])"),
  );
  const index = fields.indexOf(from);
  const next = fields[index + dir];
  if (!next) return;
  next.focus();
  next.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (next instanceof HTMLInputElement && next.type !== "date") {
    try {
      next.select();
    } catch {
      /* ignore */
    }
  }
}

function onSheetKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Enter") return;
  const target = e.target as HTMLElement;
  if (!["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    if (target instanceof HTMLInputElement && (target.type === "text" || target.type === "number" || target.type === "")) {
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      if (start !== end) return;
      if (e.key === "ArrowLeft" && start > 0) return;
      if (e.key === "ArrowRight" && start < String(target.value || "").length) return;
    }
  }
  e.preventDefault();
  moveSheetFocus(e.currentTarget, target, e.key === "ArrowLeft" ? -1 : 1);
}

type ModalSection = "PRE" | "GENERAL" | "EMD" | "PG";
const REGISTER_STEPS: ModalSection[] = ["PRE", "GENERAL", "EMD", "PG"];

function DateTextInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
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
    />
  );
}

function RegisterField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  mono,
  area,
  star,
  no,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  mono?: boolean;
  area?: boolean;
  star?: boolean;
  no?: number | string;
}) {
  const cls = `w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white ${mono ? "font-mono" : ""}`;
  return (
    <div>
      <label className="text-xs font-bold text-slate-700 block mb-1">
        {no != null ? <span className="text-slate-400 mr-1">{no}.</span> : null}
        {label}
        {star ? <span className="text-red-600"> *</span> : null}
      </label>
      {area ? (
        <textarea rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : type === "date" ? (
        <DateTextInput value={value} onChange={onChange} className={cls} />
      ) : (
        <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}

type Contract = {
  id: string;
  companyId: string;
  clientName: string;
  workLocation: string | null;
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
  emdFdNo: string | null;
  emdDate: string | null;
  emdBankName: string | null;
  emdStatus: string | null;
  emdRefundDate: string | null;
  emdRefundRef: string | null;
  emdRegdSerialNo: string | null;
  favouring: string | null;
  emdMaturityDate: string | null;
  emdMaturityInstrumentNo: string | null;
  emdMaturityFdNo: string | null;
  emdMaturityAmount: number | null;
  emdReleaseFdNo: string | null;
  emdReleaseAmount: number | null;
  emdEstimateDetails: string | null;
  agencyName: string | null;
  applicantAccount: string | null;
  makeAgency: string | null;
  applicantAgency: string | null;
  emdRemark: string | null;
  pgRemark: string | null;
  pgTenderDetails: string | null;

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
  pgRegdSerialNo: string | null;
  pgMaturityInstrumentNo: string | null;
  pgMaturityAmount: number | null;
  pgReleaseAmount: number | null;
  pgFdNo: string | null;
  pgBgNo: string | null;
  pgMaturityFdNo: string | null;
  pgMaturityBgNo: string | null;
  pgReleaseFdNo: string | null;
  pgReleaseBgNo: string | null;
  regRef: string | null;
  workingDays: string | null;
  awardedDate: string | null;
  pgLetterStatus: string | null;
  workOrderStatus: string | null;
  workPayments: WorkPaymentLine[] | null;

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
  otherDetails: string | null;
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // View / Print Modal
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalSection, setModalSection] = useState<ModalSection>("GENERAL");
  const [saving, setSaving] = useState(false);

  // Form States
  const [clientName, setClientName] = useState("");
  const [locationName, setLocationName] = useState("");
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
  const [emdFdNo, setEmdFdNo] = useState("");
  const [emdDate, setEmdDate] = useState("");
  const [emdBankName, setEmdBankName] = useState("");
  const [emdStatus, setEmdStatus] = useState("SUBMITTED");
  const [emdRefundDate, setEmdRefundDate] = useState("");
  const [emdRefundRef, setEmdRefundRef] = useState("");
  const [emdRegdSerialNo, setEmdRegdSerialNo] = useState("");
  const [favouring, setFavouring] = useState("");
  const [emdMaturityDate, setEmdMaturityDate] = useState("");
  const [emdMaturityInstrumentNo, setEmdMaturityInstrumentNo] = useState("");
  const [emdMaturityFdNo, setEmdMaturityFdNo] = useState("");
  const [emdMaturityAmount, setEmdMaturityAmount] = useState("");
  const [emdReleaseFdNo, setEmdReleaseFdNo] = useState("");
  const [emdReleaseAmount, setEmdReleaseAmount] = useState("");
  const [emdEstimateDetails, setEmdEstimateDetails] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [applicantAccount, setApplicantAccount] = useState("");
  const [makeAgency, setMakeAgency] = useState("");
  const [applicantAgency, setApplicantAgency] = useState("");
  const [emdRemark, setEmdRemark] = useState("");
  const [pgRemark, setPgRemark] = useState("");
  const [pgTenderDetails, setPgTenderDetails] = useState("");

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
  const [pgRegdSerialNo, setPgRegdSerialNo] = useState("");
  const [pgMaturityInstrumentNo, setPgMaturityInstrumentNo] = useState("");
  const [pgMaturityAmount, setPgMaturityAmount] = useState("");
  const [pgReleaseAmount, setPgReleaseAmount] = useState("");
  const [pgFdNo, setPgFdNo] = useState("");
  const [pgBgNo, setPgBgNo] = useState("");
  const [pgMaturityFdNo, setPgMaturityFdNo] = useState("");
  const [pgMaturityBgNo, setPgMaturityBgNo] = useState("");
  const [pgReleaseFdNo, setPgReleaseFdNo] = useState("");
  const [pgReleaseBgNo, setPgReleaseBgNo] = useState("");
  const [regRef, setRegRef] = useState("");
  const [workingDays, setWorkingDays] = useState("");
  const [awardedDate, setAwardedDate] = useState("");
  const [pgLetterStatus, setPgLetterStatus] = useState("");
  const [workOrderStatus, setWorkOrderStatus] = useState("");
  const [workPayments, setWorkPayments] = useState<WorkPaymentLine[]>(defaultRaRows());

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
  const [otherDetails, setOtherDetails] = useState("");
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
        setListError(friendlyPublicError(err.message || "Work register could not be loaded."));
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
    setModalSection("PRE");
    setClientName("");
    setLocationName("");
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
    setEmdFdNo("");
    setEmdDate("");
    setEmdBankName("");
    setEmdStatus("SUBMITTED");
    setEmdRefundDate("");
    setEmdRefundRef("");
    setEmdRegdSerialNo("");
    setFavouring("");
    setEmdMaturityDate("");
    setEmdMaturityInstrumentNo("");
    setEmdMaturityFdNo("");
    setEmdMaturityAmount("");
    setEmdReleaseFdNo("");
    setEmdReleaseAmount("");
    setEmdEstimateDetails("");
    setAgencyName("");
    setApplicantAccount("");
    setMakeAgency("");
    setApplicantAgency("");
    setEmdRemark("");
    setPgRemark("");
    setPgTenderDetails("");

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
    setPgRegdSerialNo("");
    setPgMaturityInstrumentNo("");
    setPgMaturityAmount("");
    setPgReleaseAmount("");
    setPgFdNo("");
    setPgBgNo("");
    setPgMaturityFdNo("");
    setPgMaturityBgNo("");
    setPgReleaseFdNo("");
    setPgReleaseBgNo("");
    setRegRef("");
    setWorkingDays("");
    setAwardedDate("");
    setPgLetterStatus("");
    setWorkOrderStatus("");
    setWorkPayments(defaultRaRows());

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
    setOtherDetails("");
    setRemarks("");

    setShowModal(true);
  }

  function setESI(val: string) {
    setEsiPfDeduction(val);
  }

  function formatDateInput(dateStr: string | null | undefined) {
    return formatDateDmy(dateStr, "");
  }

  function openEditModal(c: Contract) {
    setEditingId(c.id);
    setModalSection(activeTab === "EMD_REGISTER" ? "EMD" : activeTab === "PG_REGISTER" ? "PG" : "GENERAL");

    setClientName(c.clientName || "");
    setLocationName(c.workLocation || "");
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
    setEmdFdNo(c.emdFdNo || "");
    setEmdDate(formatDateInput(c.emdDate));
    setEmdBankName(c.emdBankName || "");
    setEmdStatus(c.emdStatus || "SUBMITTED");
    setEmdRefundDate(formatDateInput(c.emdRefundDate));
    setEmdRefundRef(c.emdRefundRef || "");
    setEmdRegdSerialNo(c.emdRegdSerialNo || "");
    setFavouring(c.favouring || "");
    setEmdMaturityDate(formatDateInput(c.emdMaturityDate));
    setEmdMaturityInstrumentNo(c.emdMaturityInstrumentNo || "");
    setEmdMaturityFdNo(c.emdMaturityFdNo || "");
    setEmdMaturityAmount(c.emdMaturityAmount != null ? String(c.emdMaturityAmount) : "");
    setEmdReleaseFdNo(c.emdReleaseFdNo || "");
    setEmdReleaseAmount(c.emdReleaseAmount != null ? String(c.emdReleaseAmount) : "");
    setEmdEstimateDetails(c.emdEstimateDetails || "");
    setAgencyName(c.agencyName || "");
    setApplicantAccount(c.applicantAccount || "");
    setMakeAgency(c.makeAgency || c.agencyName || "");
    setApplicantAgency(c.applicantAgency || c.applicantAccount || "");
    setEmdRemark(c.emdRemark || "");
    setPgRemark(c.pgRemark || "");
    setPgTenderDetails(c.pgTenderDetails || "");

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
    setPgRegdSerialNo(c.pgRegdSerialNo || "");
    setPgMaturityInstrumentNo(c.pgMaturityInstrumentNo || "");
    setPgMaturityAmount(c.pgMaturityAmount != null ? String(c.pgMaturityAmount) : "");
    setPgReleaseAmount(c.pgReleaseAmount != null ? String(c.pgReleaseAmount) : "");
    setPgFdNo(issueFdNoOf(c));
    setPgBgNo(issueBgNoOf(c));
    setPgMaturityFdNo(maturityFdNoOf(c));
    setPgMaturityBgNo(maturityBgNoOf(c));
    setPgReleaseFdNo(releaseFdNoOf(c));
    setPgReleaseBgNo(releaseBgNoOf(c));
    setRegRef(c.regRef || "");
    setWorkingDays(c.workingDays || "");
    setAwardedDate(formatDateInput(c.awardedDate));
    setPgLetterStatus(c.pgLetterStatus || "");
    setWorkOrderStatus(c.workOrderStatus || "");
    setWorkPayments(() => {
      const lines = workPaymentLines(c)
        .map((line) => ({
          ...emptyPayment(line.raBillNo || ""),
          ...line,
          billDate: formatDateInput(line.billDate as string | null | undefined),
          voucherDate: formatDateInput(line.voucherDate as string | null | undefined),
          dateOfPayment: formatDateInput(line.dateOfPayment as string | null | undefined),
          bankReceivedDate: formatDateInput(line.bankReceivedDate as string | null | undefined),
        }))
        .filter(paymentLineHasValue);
      return lines.length ? lines : defaultRaRows();
    });

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
    setOtherDetails(c.otherDetails || "");
    setRemarks(c.remarks || "");

    setShowModal(true);
  }

  async function handleSaveContract(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        action: editingId ? "UPDATE_CONTRACT" : "CREATE_CONTRACT",
        id: editingId,
        clientName: clientName || "",
        workLocation: locationName.trim() || null,
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
        emdFdNo,
        emdDate: emdDate || null,
        emdBankName,
        emdStatus,
        emdRefundDate: emdRefundDate || null,
        emdRefundRef,
        emdRegdSerialNo,
        favouring,
        emdMaturityDate: emdMaturityDate || null,
        emdMaturityInstrumentNo,
        emdMaturityFdNo,
        emdMaturityAmount: emdMaturityAmount || null,
        emdReleaseFdNo,
        emdReleaseAmount: emdReleaseAmount || null,
        emdEstimateDetails,
        agencyName,
        applicantAccount,
        makeAgency,
        applicantAgency,
        emdRemark,
        pgRemark,
        pgTenderDetails,

        // PG
        pgAmount: pgAmount || null,
        pgPercent: pgPercent || null,
        pgMode,
        pgInstrumentNo: pgBgNo || pgFdNo || pgInstrumentNo,
        pgFdNo,
        pgBgNo,
        pgBankName,
        pgDate: pgDate || null,
        pgExpiryDate: pgExpiryDate || null,
        pgClaimDate: pgClaimDate || null,
        pgStatus,
        pgReleaseDate: pgReleaseDate || null,
        pgReleaseRef: pgReleaseBgNo || pgReleaseFdNo || pgReleaseRef,
        pgRegdSerialNo,
        pgMaturityInstrumentNo: pgMaturityBgNo || pgMaturityFdNo || pgMaturityInstrumentNo,
        pgMaturityAmount: pgMaturityAmount || null,
        pgReleaseAmount: pgReleaseAmount || null,
        pgMaturityFdNo,
        pgMaturityBgNo,
        pgReleaseFdNo,
        pgReleaseBgNo,
        regRef,
        workingDays,
        awardedDate: awardedDate || null,
        pgLetterStatus,
        workOrderStatus,
        workPayments: workPayments.filter(paymentLineHasValue),

        // Execution & Dates
        measurementBookNo: workPayments.filter((line) => line.mbNo).at(-1)?.mbNo || measurementBookNo,
        lccNo,
        startAgreement: startAgreement || null,
        startActual: startActual || null,
        completionAgreement: completionAgreement || null,
        completionActual: completionActual || null,

        // Billing Breakdown
        billNumber: workPayments.filter((line) => line.billNumber || line.raBillNo).at(-1)?.billNumber
          || workPayments.filter((line) => line.raBillNo).at(-1)?.raBillNo
          || billNumber,
        billDate: workPayments.filter((line) => line.billDate).at(-1)?.billDate || billDate || null,
        grossAmount: workPayments.filter((line) => line.grossAmount).at(-1)?.grossAmount || grossAmount || null,
        securityDeposit: workPayments.filter((line) => line.sdAmount).at(-1)?.sdAmount || securityDeposit || null,
        incomeTaxTds: workPayments.filter((line) => line.itAmount).at(-1)?.itAmount || incomeTaxTds || null,
        gstRecovery: workPayments.filter((line) => line.gstAmount).at(-1)?.gstAmount || gstRecovery || null,
        labourCess: workPayments.filter((line) => line.labourCess).at(-1)?.labourCess || labourCess || null,
        waterCharge: workPayments.filter((line) => line.waterCharge).at(-1)?.waterCharge || waterCharge || null,
        esiPfDeduction: workPayments.filter((line) => line.epfo || line.esic).at(-1)
          ? Number(workPayments.filter((line) => line.epfo || line.esic).at(-1)?.epfo || 0)
            + Number(workPayments.filter((line) => line.epfo || line.esic).at(-1)?.esic || 0)
          : esiPfDeduction || null,
        withheldAmount: workPayments.filter((line) => line.withheldAmount).at(-1)?.withheldAmount || withheldAmount || null,
        otherRecovery: otherRecovery || null,
        totalDeductions: totalDeductions || null,
        netAmount: workPayments.filter((line) => line.netAmount).at(-1)?.netAmount || netAmount || null,

        // Payment & Vouchers
        voucherNumber: workPayments.filter((line) => line.voucherNo).at(-1)?.voucherNo || voucherNumber,
        bankReceivedDate: workPayments.filter((line) => line.bankReceivedDate).at(-1)?.bankReceivedDate || bankReceivedDate || null,
        reimburseDate: workPayments.filter((line) => line.dateOfPayment).at(-1)?.dateOfPayment || reimburseDate || null,
        otherDetails,
        remarks,
      };

      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "This work register entry could not be saved.");

      setShowModal(false);
      loadCrmData();
    } catch (err: any) {
      alert(friendlyPublicError(err.message || "This work register entry could not be saved."));
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
      if (!res.ok) throw new Error("This work register entry could not be deleted.");
      loadCrmData();
    } catch (err: any) {
      alert(friendlyPublicError(err.message || "This work register entry could not be deleted."));
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
        c.workLocation?.toLowerCase().includes(q) ||
        c.departmentName?.toLowerCase().includes(q) ||
        c.agreementNo?.toLowerCase().includes(q) ||
        c.workName?.toLowerCase().includes(q) ||
        c.tenderNo?.toLowerCase().includes(q) ||
        c.emdInstrumentNo?.toLowerCase().includes(q) ||
        c.emdFdNo?.toLowerCase().includes(q) ||
        c.favouring?.toLowerCase().includes(q) ||
        c.emdRegdSerialNo?.toLowerCase().includes(q) ||
        c.pgInstrumentNo?.toLowerCase().includes(q) ||
        c.regRef?.toLowerCase().includes(q) ||
        c.pgRegdSerialNo?.toLowerCase().includes(q);

      // Status
      const matchStatus = statusFilter === "ALL" || c.workStatus === statusFilter;

      // Type
      const matchType = typeFilter === "ALL" || c.contractType === typeFilter;

      return matchSearch && matchStatus && matchType;
    });
  }, [contracts, searchQuery, statusFilter, typeFilter]);

  const emdRows = useMemo(() => {
    return filteredContracts
      .filter((c) => c.emdAmount || c.tenderNo || c.emdInstrumentNo || c.emdFdNo)
      .slice()
      .sort((a, b) =>
        String(a.emdDate || a.createdAt || "").localeCompare(String(b.emdDate || b.createdAt || "")),
      );
  }, [filteredContracts]);

  const pgRows = useMemo(() => {
    return filteredContracts
      .filter((c) => c.pgAmount || c.pgInstrumentNo || c.pgFdNo || c.pgBgNo || c.pgMode)
      .slice()
      .sort((a, b) =>
        String(a.pgDate || a.createdAt || "").localeCompare(String(b.pgDate || b.createdAt || "")),
      );
  }, [filteredContracts]);

  const workRows = useMemo(() => {
    return filteredContracts.slice().sort((a, b) => {
      const client = String(a.clientName || "").localeCompare(String(b.clientName || ""));
      if (client) return client;
      const loc = String(a.workLocation || "").localeCompare(String(b.workLocation || ""));
      if (loc) return loc;
      return String(a.awardedDate || a.createdAt || "").localeCompare(String(b.awardedDate || b.createdAt || ""));
    });
  }, [filteredContracts]);

  const companyLabel = company?.legalName || company?.shortName || "M/s N.K. Enterprise";

  function downloadRows(rows: Contract[]) {
    const picked = rows.filter((row) => selectedIds.includes(row.id));
    return picked.length ? picked : rows;
  }

  function allRowsSelected(rows: Contract[]) {
    return rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  }

  function toggleRow(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((rowId) => rowId !== id) : [...ids, id]));
  }

  function toggleAllRows(rows: Contract[]) {
    const select = !allRowsSelected(rows);
    setSelectedIds((ids) => {
      const rest = ids.filter((id) => !rows.some((row) => row.id === id));
      return select ? [...rest, ...rows.map((row) => row.id)] : rest;
    });
  }

  function registerDownloadBar(
    rows: Contract[],
    onExcel: (picked: Contract[]) => void,
    onPdf: (picked: Contract[]) => void | Promise<void>,
  ) {
    const allOn = allRowsSelected(rows);
    const pickedCount = rows.filter((row) => selectedIds.includes(row.id)).length;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => toggleAllRows(rows)}
          disabled={!rows.length}
          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg disabled:opacity-50"
        >
          {allOn ? "Deselect all" : "Select all"}
        </button>
        <button
          type="button"
          onClick={() => onExcel(downloadRows(rows))}
          disabled={!rows.length}
          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
        >
          Download Excel
        </button>
        <button
          type="button"
          onClick={() => void onPdf(downloadRows(rows))}
          disabled={!rows.length}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
        >
          Download PDF
        </button>
        {pickedCount ? (
          <span className="text-[11px] font-semibold text-slate-500">{pickedCount} selected</span>
        ) : (
          <span className="text-[11px] text-slate-400">No row selected — downloads all</span>
        )}
      </div>
    );
  }

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
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-center sm:text-left text-slate-900">
                    Work Register ( {company?.legalName || company?.shortName || "M/s N.K. Enterprise"} )
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Same columns as the office Work Register. Tick rows, then download Excel or PDF.
                  </p>
                </div>
                {registerDownloadBar(
                  workRows,
                  (rows) => downloadWorkRegisterExcel({ companyName: companyLabel, rows }),
                  (rows) => downloadWorkRegisterPdf({ companyName: companyLabel, rows }),
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[3200px] w-full text-left text-[10px] text-slate-800 border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold">
                    <tr>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle w-8">
                        <input
                          type="checkbox"
                          checked={allRowsSelected(workRows)}
                          onChange={() => toggleAllRows(workRows)}
                          aria-label={allRowsSelected(workRows) ? "Deselect all" : "Select all"}
                        />
                      </th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle whitespace-nowrap">Sl. No.</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle whitespace-nowrap">Reg. Ref.</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle">Department/ Division</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle min-w-[160px]">Name of work</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle">Agmt./W.O. No.</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle whitespace-nowrap">Awarded Date</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle">Working Period</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle whitespace-nowrap">Tender Amount</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle whitespace-nowrap">Estimate Cost</th>
                      <th colSpan={2} className="border border-slate-300 p-1 text-center">Earnest Money Deposit</th>
                      <th colSpan={2} className="border border-slate-300 p-1 text-center">Performance Guarantee</th>
                      <th colSpan={2} className="border border-slate-300 p-1 text-center">Date of Start</th>
                      <th colSpan={2} className="border border-slate-300 p-1 text-center">Date Of Completion</th>
                      <th colSpan={7} className="border border-slate-300 p-1 text-center">Bill Details</th>
                      <th colSpan={9} className="border border-slate-300 p-1 text-center">Deduction of bill</th>
                      <th colSpan={2} className="border border-slate-300 p-1 text-center">Payment recerived details</th>
                      <th colSpan={5} className="border border-slate-300 p-1 text-center">Reimbursement Details</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle">Other</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle">Remarks</th>
                      <th rowSpan={2} className="border border-slate-300 p-1 text-center align-middle">Open</th>
                    </tr>
                    <tr>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">EMD Amount</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">EMD Date</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">P.G. Amount</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">P.G. Date</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">As Per Agmt.</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">As Per Actual</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">As Per Agmt.</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">As Per Actual</th>
                      <th className="border border-slate-300 p-1 text-center">Running Account Bill (R.A. Bill) No.</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">M.B. No.</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">Bill No.</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">Bill Date</th>
                      <th className="border border-slate-300 p-1 text-center">Gross / Bill Amount</th>
                      <th className="border border-slate-300 p-1 text-center">Taxable Amount (Without GST)</th>
                      <th className="border border-slate-300 p-1 text-center">Total GST Amount of Bill</th>
                      <th className="border border-slate-300 p-1 text-center">Security Deposit (S.D.)</th>
                      <th className="border border-slate-300 p-1 text-center">Income Tax @ 1% or 2% (TDS IT)</th>
                      <th className="border border-slate-300 p-1 text-center">GST @2% (TDS GST)</th>
                      <th className="border border-slate-300 p-1 text-center">Labour welfare Cess</th>
                      <th className="border border-slate-300 p-1 text-center">Edu. Cess</th>
                      <th className="border border-slate-300 p-1 text-center">Water Charge</th>
                      <th className="border border-slate-300 p-1 text-center">Withheld Amount</th>
                      <th className="border border-slate-300 p-1 text-center">withheld reason</th>
                      <th className="border border-slate-300 p-1 text-center">Net Amount</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">Voucher No.</th>
                      <th className="border border-slate-300 p-1 text-center">Date</th>
                      <th className="border border-slate-300 p-1 text-center">EPFO</th>
                      <th className="border border-slate-300 p-1 text-center">ESIC</th>
                      <th className="border border-slate-300 p-1 text-center">Amount</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">Date of payment</th>
                      <th className="border border-slate-300 p-1 text-center whitespace-nowrap">Bank Recived Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workRows.map((c, index) => {
                      const filled = workPaymentLines(c).filter(paymentLineHasValue);
                      const lines = filled.length ? filled : [emptyWorkPayment("")];
                      const prev = workRows[index - 1];
                      const showGroup =
                        !prev || prev.clientName !== c.clientName || prev.workLocation !== c.workLocation;
                      return (
                        <React.Fragment key={c.id}>
                          {showGroup ? (
                            <tr className="bg-indigo-50">
                              <td colSpan={44} className="border border-slate-300 p-1.5 font-black text-slate-900">
                                {[c.clientName, c.workLocation].filter(Boolean).join(" · ") || "Work"}
                              </td>
                            </tr>
                          ) : null}
                          {lines.map((line, lineIndex) => (
                        <tr key={`${c.id}-${lineIndex}`} className="hover:bg-indigo-50/40">
                          {lineIndex === 0 && (
                            <>
                              <td className="border border-slate-300 p-1 text-center align-top" rowSpan={lines.length}>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(c.id)}
                                  onChange={() => toggleRow(c.id)}
                                  aria-label={`Select ${c.workName || "work"}`}
                                />
                              </td>
                              <td className="border border-slate-300 p-1 text-center font-mono align-top" rowSpan={lines.length}>{index + 1}</td>
                              <td className="border border-slate-300 p-1 font-mono align-top" rowSpan={lines.length}>{c.regRef || "—"}</td>
                              <td className="border border-slate-300 p-1 align-top" rowSpan={lines.length}>{c.departmentName || "—"}</td>
                              <td className="border border-slate-300 p-1 min-w-[160px] align-top" rowSpan={lines.length}>{c.workName || "—"}</td>
                              <td className="border border-slate-300 p-1 font-mono align-top" rowSpan={lines.length}>{c.agreementNo || "—"}</td>
                              <td className="border border-slate-300 p-1 whitespace-nowrap align-top" rowSpan={lines.length}>{c.awardedDate ? formatDateDmy(c.awardedDate) : "—"}</td>
                              <td className="border border-slate-300 p-1 align-top" rowSpan={lines.length}>{c.workingDays || "—"}</td>
                              <td className="border border-slate-300 p-1 text-right font-mono align-top" rowSpan={lines.length}>{moneyCell(c.tenderAmount)}</td>
                              <td className="border border-slate-300 p-1 text-right font-mono align-top" rowSpan={lines.length}>{moneyCell(c.estimateCost)}</td>
                              <td className="border border-slate-300 p-1 text-right font-mono align-top" rowSpan={lines.length}>{moneyCell(c.emdAmount)}</td>
                              <td className="border border-slate-300 p-1 whitespace-nowrap align-top" rowSpan={lines.length}>{c.emdDate ? formatDateDmy(c.emdDate) : "—"}</td>
                              <td className="border border-slate-300 p-1 text-right font-mono align-top" rowSpan={lines.length}>{moneyCell(c.pgAmount)}</td>
                              <td className="border border-slate-300 p-1 whitespace-nowrap align-top" rowSpan={lines.length}>{c.pgDate ? formatDateDmy(c.pgDate) : "—"}</td>
                              <td className="border border-slate-300 p-1 whitespace-nowrap align-top" rowSpan={lines.length}>{c.startAgreement ? formatDateDmy(c.startAgreement) : "—"}</td>
                              <td className="border border-slate-300 p-1 whitespace-nowrap align-top" rowSpan={lines.length}>{c.startActual ? formatDateDmy(c.startActual) : "—"}</td>
                              <td className="border border-slate-300 p-1 whitespace-nowrap align-top" rowSpan={lines.length}>{c.completionAgreement ? formatDateDmy(c.completionAgreement) : "—"}</td>
                              <td className="border border-slate-300 p-1 whitespace-nowrap align-top" rowSpan={lines.length}>{c.completionActual ? formatDateDmy(c.completionActual) : "—"}</td>
                            </>
                          )}
                          <td className="border border-slate-300 p-1">{line.raBillNo || "—"}</td>
                          <td className="border border-slate-300 p-1 font-mono">{line.mbNo || "—"}</td>
                          <td className="border border-slate-300 p-1 font-mono">{line.billNumber || "—"}</td>
                          <td className="border border-slate-300 p-1 whitespace-nowrap">{line.billDate ? formatDateDmy(line.billDate) : "—"}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.grossAmount)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.taxableAmount)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.gstAmountOfBill)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.sdAmount)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.itAmount)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.gstAmount)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.labourCess)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.eduCess)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.waterCharge)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.withheldAmount)}</td>
                          <td className="border border-slate-300 p-1">{line.withheldReason || "—"}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.netAmount)}</td>
                          <td className="border border-slate-300 p-1 font-mono">{line.voucherNo || "—"}</td>
                          <td className="border border-slate-300 p-1 whitespace-nowrap">{line.voucherDate ? formatDateDmy(line.voucherDate) : "—"}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.epfo)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.esic)}</td>
                          <td className="border border-slate-300 p-1 text-right font-mono">{moneyCell(line.reimburseAmount)}</td>
                          <td className="border border-slate-300 p-1 whitespace-nowrap">{line.dateOfPayment ? formatDateDmy(line.dateOfPayment) : "—"}</td>
                          <td className="border border-slate-300 p-1 whitespace-nowrap">{line.bankReceivedDate ? formatDateDmy(line.bankReceivedDate) : "—"}</td>
                          {lineIndex === 0 && (
                            <>
                              <td className="border border-slate-300 p-1 align-top" rowSpan={lines.length}>{c.otherDetails || "—"}</td>
                              <td className="border border-slate-300 p-1 align-top" rowSpan={lines.length}>{c.remarks || "—"}</td>
                              <td className="border border-slate-300 p-1 text-center whitespace-nowrap align-top" rowSpan={lines.length}>
                                <button
                                  onClick={() => openEditModal(c)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteContract(c.id)}
                                  className="ml-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[11px] transition"
                                >
                                  Delete
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PRE-CONTRACT EMD REGISTER */}
          {activeTab === "EMD_REGISTER" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-amber-50/60 border-b border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-center sm:text-left text-slate-900">
                    EMD Register ( {company?.legalName || company?.shortName || "M/s N.K. Enterprise"} )
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    Same 24 columns as the office EMD Register: issue, maturity and release with FD No. and DD No.
                  </p>
                </div>
                {registerDownloadBar(
                  emdRows,
                  (rows) => downloadEmdRegisterExcel({ companyName: companyLabel, rows }),
                  (rows) => downloadEmdRegisterPdf({ companyName: companyLabel, rows }),
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1800px] w-full text-left text-[11px] text-slate-800 border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold">
                    <tr>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle w-8">
                        <input
                          type="checkbox"
                          checked={allRowsSelected(emdRows)}
                          onChange={() => toggleAllRows(emdRows)}
                          aria-label={allRowsSelected(emdRows) ? "Deselect all" : "Select all"}
                        />
                      </th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle whitespace-nowrap">SL NO.</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle whitespace-nowrap">Reg Sl No</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Department / Division</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">NIT No.</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle min-w-[180px]">Name of Work</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Estimate Cost</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Tender Amount</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Favouring</th>
                      <th colSpan={5} className="border border-slate-300 p-1.5 text-center">EMD issue Details</th>
                      <th colSpan={4} className="border border-slate-300 p-1.5 text-center">EMD Maturity details<br />(As per Agreement)</th>
                      <th colSpan={4} className="border border-slate-300 p-1.5 text-center">EMD Release details<br />(As per Actual)</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Make Agency</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Applicant Agency</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Remark/Status</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Open</th>
                    </tr>
                    <tr>
                      <th className="border border-slate-300 p-1.5 text-center">FD No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">DD No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">Date</th>
                      <th className="border border-slate-300 p-1.5 text-center">Amount</th>
                      <th className="border border-slate-300 p-1.5 text-center">Bank Name</th>
                      <th className="border border-slate-300 p-1.5 text-center">FD No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">DD No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">Date</th>
                      <th className="border border-slate-300 p-1.5 text-center">Amount</th>
                      <th className="border border-slate-300 p-1.5 text-center">FD No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">DD No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">Date</th>
                      <th className="border border-slate-300 p-1.5 text-center">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emdRows.map((c, index) => (
                      <tr key={c.id} className="hover:bg-amber-50/40">
                        <td className="border border-slate-300 p-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => toggleRow(c.id)}
                            aria-label={`Select ${c.workName || "EMD"}`}
                          />
                        </td>
                        <td className="border border-slate-300 p-1.5 text-center font-mono">{index + 1}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-mono">{c.emdRegdSerialNo || "—"}</td>
                        <td className="border border-slate-300 p-1.5">{c.departmentName || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{c.tenderNo || "—"}</td>
                        <td className="border border-slate-300 p-1.5 min-w-[180px]">{c.workName || "—"}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(c.estimateCost)}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(c.tenderAmount)}</td>
                        <td className="border border-slate-300 p-1.5">{c.favouring || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{emdFdOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{emdDdOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 whitespace-nowrap">{c.emdDate ? formatDateDmy(c.emdDate) : "—"}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(c.emdAmount)}</td>
                        <td className="border border-slate-300 p-1.5">{c.emdBankName || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{emdMatFdOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{emdMatDdOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 whitespace-nowrap">{c.emdMaturityDate ? formatDateDmy(c.emdMaturityDate) : "—"}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(c.emdMaturityAmount)}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{emdRelFdOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{emdRelDdOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 whitespace-nowrap">{c.emdRefundDate ? formatDateDmy(c.emdRefundDate) : "—"}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(c.emdReleaseAmount)}</td>
                        <td className="border border-slate-300 p-1.5">{c.makeAgency || c.agencyName || "—"}</td>
                        <td className="border border-slate-300 p-1.5">{c.applicantAgency || c.applicantAccount || "—"}</td>
                        <td className="border border-slate-300 p-1.5">
                          {c.emdRemark || c.remarks || (c.emdStatus ? c.emdStatus.replace(/_/g, " ") : "—")}
                        </td>
                        <td className="border border-slate-300 p-1.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => openEditModal(c)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(() => {
                      const total = emdRows.reduce((sum, c) => sum + Number(c.emdAmount || 0), 0);
                      return (
                        <tr className="bg-slate-50 font-bold">
                          <td className="border border-slate-300 p-1.5" colSpan={12}>
                            Total Amount =
                          </td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(total)}</td>
                          <td className="border border-slate-300 p-1.5" colSpan={13} />
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: POST-AWARD PG REGISTER */}
          {activeTab === "PG_REGISTER" && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-purple-50/60 border-b border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-center sm:text-left text-slate-900">
                    Performance Guarantee(P.G.) Register ( {company?.legalName || company?.shortName || "M/s N.K. Enterprise"} )
                  </h3>
                  <p className="text-[11px] text-purple-800">
                    Same columns as the office PG register: FD No. and BG No. together.
                  </p>
                </div>
                {registerDownloadBar(
                  pgRows,
                  (rows) => downloadPgRegisterExcel({ companyName: companyLabel, rows }),
                  (rows) => downloadPgRegisterPdf({ companyName: companyLabel, rows }),
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1800px] w-full text-left text-[11px] text-slate-800 border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold">
                    <tr>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle w-8">
                        <input
                          type="checkbox"
                          checked={allRowsSelected(pgRows)}
                          onChange={() => toggleAllRows(pgRows)}
                          aria-label={allRowsSelected(pgRows) ? "Deselect all" : "Select all"}
                        />
                      </th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle whitespace-nowrap">SL NO.</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle whitespace-nowrap">Reg Sl No</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Department / Division</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">NIT No.</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle min-w-[180px]">Name of Work</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Estimate Cost</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Contract Amount</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Favouring</th>
                      <th colSpan={5} className="border border-slate-300 p-1.5 text-center">P.G. issue Details</th>
                      <th colSpan={4} className="border border-slate-300 p-1.5 text-center">P.G. Maturity details<br />(As per Agreement)</th>
                      <th colSpan={4} className="border border-slate-300 p-1.5 text-center">P.G. Release details<br />(As per Actual)</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Make Agency</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Applicant Agency</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Remark/Status</th>
                      <th rowSpan={2} className="border border-slate-300 p-1.5 text-center align-middle">Open</th>
                    </tr>
                    <tr>
                      <th className="border border-slate-300 p-1.5 text-center">FD No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">BG No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">Date</th>
                      <th className="border border-slate-300 p-1.5 text-center">Amount</th>
                      <th className="border border-slate-300 p-1.5 text-center">Bank Name</th>
                      <th className="border border-slate-300 p-1.5 text-center">FD No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">BG No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">Date</th>
                      <th className="border border-slate-300 p-1.5 text-center">Amount</th>
                      <th className="border border-slate-300 p-1.5 text-center">FD No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">BG No.</th>
                      <th className="border border-slate-300 p-1.5 text-center">Date</th>
                      <th className="border border-slate-300 p-1.5 text-center">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pgRows.map((c, index) => (
                      <tr key={c.id} className="hover:bg-purple-50/40">
                        <td className="border border-slate-300 p-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => toggleRow(c.id)}
                            aria-label={`Select ${c.workName || "PG"}`}
                          />
                        </td>
                        <td className="border border-slate-300 p-1.5 text-center font-mono">{index + 1}</td>
                        <td className="border border-slate-300 p-1.5 text-center font-mono">{c.pgRegdSerialNo || c.emdRegdSerialNo || "—"}</td>
                        <td className="border border-slate-300 p-1.5">{c.departmentName || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{c.tenderNo || "—"}</td>
                        <td className="border border-slate-300 p-1.5 min-w-[180px]">{c.workName || "—"}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{c.estimateCost != null ? moneyCell(c.estimateCost) : (c.emdEstimateDetails || "—")}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(c.tenderAmount)}</td>
                        <td className="border border-slate-300 p-1.5">{c.favouring || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{issueFdNoOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{issueBgNoOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 whitespace-nowrap">{c.pgDate ? formatDateDmy(c.pgDate) : "—"}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(c.pgAmount)}</td>
                        <td className="border border-slate-300 p-1.5">{c.pgBankName || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{maturityFdNoOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{maturityBgNoOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 whitespace-nowrap">{c.pgExpiryDate ? formatDateDmy(c.pgExpiryDate) : "—"}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(c.pgMaturityAmount)}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{releaseFdNoOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 font-mono">{releaseBgNoOf(c) || "—"}</td>
                        <td className="border border-slate-300 p-1.5 whitespace-nowrap">{c.pgReleaseDate ? formatDateDmy(c.pgReleaseDate) : "—"}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono">{moneyCell(c.pgReleaseAmount)}</td>
                        <td className="border border-slate-300 p-1.5">{c.makeAgency || c.agencyName || "—"}</td>
                        <td className="border border-slate-300 p-1.5">{c.applicantAgency || "—"}</td>
                        <td className="border border-slate-300 p-1.5">{c.pgRemark || c.remarks || (c.pgStatus ? c.pgStatus.replace(/_/g, " ") : "—")}</td>
                        <td className="border border-slate-300 p-1.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => openEditModal(c)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] transition"
                          >
                            Edit
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
          <div className="bg-white rounded-2xl max-w-[98vw] w-full my-6 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden border border-slate-200">
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
                onClick={() => setModalSection("PRE")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  modalSection === "PRE" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
                }`}
              >
                1. Client & Location
              </button>
              <button
                type="button"
                onClick={() => setModalSection("GENERAL")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  modalSection === "GENERAL" ? "bg-white text-indigo-700 shadow-sm" : "hover:text-slate-900"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  2. <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> Work Register
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
                  3. <Landmark className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> EMD Register
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
                  4. <Shield className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden /> PG Register
                </span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form noValidate onSubmit={handleSaveContract} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6">
              {modalSection === "PRE" && (
                <div className="space-y-4 max-w-xl">
                  <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-sm font-bold text-slate-800">Before the Work Register</h3>
                    <p className="text-xs text-slate-500">Fill client name and location first. These stay off the Excel sheet.</p>
                  </div>
                  <RegisterField label="Client name" value={clientName} onChange={setClientName} placeholder="e.g. K. Das & Co." />
                  <RegisterField label="Location" value={locationName} onChange={setLocationName} placeholder="e.g. Kolkata / site name" />
                </div>
              )}

              {/* SECTION 1: WORK REGISTER */}
              {modalSection === "GENERAL" && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">WORK REGISTER</h3>
                      <p className="text-xs text-slate-500">
                        Scroll sideways like Excel. Tab or the right arrow moves to the next field. R.A. bill is a dropdown.
                      </p>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {[clientName, locationName].filter(Boolean).join(" · ") || "Client & location not filled yet"}
                    </div>
                  </div>

                  {(() => {
                    const headerValues: Record<string, string> = {
                      regRef,
                      departmentName,
                      workName,
                      agreementNo,
                      awardedDate,
                      workingDays,
                      tenderAmount,
                      estimateCost,
                      emdAmount,
                      emdDate,
                      pgAmount,
                      pgDate,
                      startAgreement,
                      startActual,
                      completionAgreement,
                      completionActual,
                    };
                    const headerSetters: Record<string, (value: string) => void> = {
                      regRef: setRegRef,
                      departmentName: setDepartmentName,
                      workName: setWorkName,
                      agreementNo: setAgreementNo,
                      awardedDate: setAwardedDate,
                      workingDays: setWorkingDays,
                      tenderAmount: setTenderAmount,
                      estimateCost: setEstimateCost,
                      emdAmount: setEmdAmount,
                      emdDate: setEmdDate,
                      pgAmount: setPgAmount,
                      pgDate: setPgDate,
                      startAgreement: setStartAgreement,
                      startActual: setStartActual,
                      completionAgreement: setCompletionAgreement,
                      completionActual: setCompletionActual,
                    };
                    return (
                      <div onKeyDown={onSheetKeyDown} className="overflow-x-auto border border-slate-400 bg-white">
                        <table className="min-w-[3200px] w-max text-[10px] text-slate-800 border-collapse">
                          <thead className="bg-slate-100 font-bold">
                            <tr>
                              <th rowSpan={2} className="border border-slate-400 p-1 text-center align-middle w-10">
                                <div>1</div>
                                <div>Sl. No.</div>
                              </th>
                              {WORK_HEADER_FIELDS.slice(0, 8).map((field) => (
                                <th key={field.key} rowSpan={2} className="border border-slate-400 p-1 text-center align-middle min-w-[88px]">
                                  <div>{field.no}</div>
                                  <div>{field.label}</div>
                                </th>
                              ))}
                              <th colSpan={2} className="border border-slate-400 p-1 text-center">Earnest Money Deposit</th>
                              <th colSpan={2} className="border border-slate-400 p-1 text-center">Performance Guarantee</th>
                              <th colSpan={2} className="border border-slate-400 p-1 text-center">Date of Start</th>
                              <th colSpan={2} className="border border-slate-400 p-1 text-center">Date Of Completion</th>
                              <th colSpan={7} className="border border-slate-400 p-1 text-center">Bill Details</th>
                              <th colSpan={9} className="border border-slate-400 p-1 text-center">Deduction of bill</th>
                              <th colSpan={2} className="border border-slate-400 p-1 text-center">Payment recerived details</th>
                              <th colSpan={5} className="border border-slate-400 p-1 text-center">Reimbursement Details</th>
                              <th rowSpan={2} className="border border-slate-400 p-1 text-center align-middle">
                                <div>41</div>
                                <div>Other</div>
                              </th>
                              <th rowSpan={2} className="border border-slate-400 p-1 text-center align-middle">
                                <div>42</div>
                                <div>Remarks</div>
                              </th>
                              <th rowSpan={2} className="border border-slate-400 p-1 w-8" />
                            </tr>
                            <tr>
                              {WORK_HEADER_FIELDS.slice(8).map((field) => (
                                <th key={field.key} className="border border-slate-400 p-1 text-center min-w-[88px]">
                                  <div>{field.no}</div>
                                  <div>{field.label}</div>
                                </th>
                              ))}
                              {BILL_LINE_FIELDS.map((field) => (
                                <th key={field.key} className="border border-slate-400 p-1 text-center min-w-[88px]">
                                  <div>{field.no}</div>
                                  <div>{field.label}</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {workPayments.map((line, index) => (
                              <tr key={index} className="hover:bg-indigo-50/40">
                                {index === 0 && (
                                  <>
                                    <td className="border border-slate-400 p-0 text-center font-mono bg-slate-50" rowSpan={workPayments.length}>
                                      {editingId ? "—" : ""}
                                    </td>
                                    {WORK_HEADER_FIELDS.map((field) => (
                                      <td key={field.key} className="border border-slate-400 p-0" rowSpan={workPayments.length}>
                                        {field.type === "date" ? (
                                          <DateTextInput
                                            value={headerValues[field.key] || ""}
                                            onChange={headerSetters[field.key]}
                                            className={SHEET_INPUT}
                                          />
                                        ) : (
                                          <input
                                            type={field.type}
                                            value={headerValues[field.key] || ""}
                                            onChange={(e) => headerSetters[field.key](e.target.value)}
                                            className={SHEET_INPUT}
                                          />
                                        )}
                                      </td>
                                    ))}
                                  </>
                                )}
                                {BILL_LINE_FIELDS.map((field) => (
                                  <td key={field.key} className="border border-slate-400 p-0">
                                    {field.type === "select" ? (
                                      <select
                                        value={String(line[field.key] ?? "")}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          if (value === "Add") {
                                            setWorkPayments((rows) => [...rows, emptyPayment(nextRaBillNo(rows))]);
                                            return;
                                          }
                                          setWorkPayments((rows) =>
                                            rows.map((row, i) => (i === index ? { ...row, [field.key]: value } : row)),
                                          );
                                        }}
                                        className={`${SHEET_INPUT} bg-white`}
                                      >
                                        <option value="">Select</option>
                                        {raBillDropdownOptions(workPayments).map((no) => (
                                          <option key={no} value={no}>{no}</option>
                                        ))}
                                        <option value="Add">Add</option>
                                      </select>
                                    ) : field.type === "date" ? (
                                      <DateTextInput
                                        value={String(line[field.key] ?? "")}
                                        onChange={(value) =>
                                          setWorkPayments((rows) =>
                                            rows.map((row, i) => (i === index ? { ...row, [field.key]: value } : row)),
                                          )
                                        }
                                        className={SHEET_INPUT}
                                      />
                                    ) : (
                                      <input
                                        type={field.type}
                                        value={String(line[field.key] ?? "")}
                                        onChange={(e) =>
                                          setWorkPayments((rows) =>
                                            rows.map((row, i) => (i === index ? { ...row, [field.key]: e.target.value } : row)),
                                          )
                                        }
                                        className={SHEET_INPUT}
                                      />
                                    )}
                                  </td>
                                ))}
                                {index === 0 && (
                                  <>
                                    <td className="border border-slate-400 p-0" rowSpan={workPayments.length}>
                                      <input type="text" value={otherDetails} onChange={(e) => setOtherDetails(e.target.value)} className={SHEET_INPUT} />
                                    </td>
                                    <td className="border border-slate-400 p-0" rowSpan={workPayments.length}>
                                      <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} className={SHEET_INPUT} />
                                    </td>
                                  </>
                                )}
                                <td className="border border-slate-400 p-0 text-center">
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() =>
                                      setWorkPayments((rows) =>
                                        rows.length === 1 ? [emptyPayment()] : rows.filter((_, i) => i !== index),
                                      )
                                    }
                                    className="text-rose-600 font-bold px-1"
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SECTION 2: EMD REGISTER */}
              {modalSection === "EMD" && (
                <div className="space-y-4">
                  <div className="border-b border-amber-100 pb-2">
                    <h3 className="text-sm font-bold text-amber-900">EMD Register</h3>
                    <p className="text-xs text-amber-700">Same fields as the office EMD Register sheet.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <RegisterField label="Reg Sl No" value={emdRegdSerialNo} onChange={setEmdRegdSerialNo} placeholder="e.g. 20" mono />
                    <RegisterField label="Department / Division" value={departmentName} onChange={setDepartmentName} placeholder="Department / Division" />
                    <RegisterField label="NIT No." value={tenderNo} onChange={setTenderNo} placeholder="Tender / NIT number" mono />
                    <RegisterField label="Favouring" value={favouring} onChange={setFavouring} placeholder="Favouring" />
                    <div className="md:col-span-4">
                      <RegisterField label="Name of Work" value={workName} onChange={setWorkName} placeholder="Name of work" area />
                    </div>
                    <RegisterField label="Estimate Cost" value={estimateCost} onChange={setEstimateCost} type="number" />
                    <RegisterField label="Tender Amount" value={tenderAmount} onChange={setTenderAmount} type="number" />
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                    <div className="text-xs font-black text-amber-900">EMD issue Details</div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <RegisterField label="FD No." value={emdFdNo} onChange={setEmdFdNo} placeholder="Fixed deposit number" mono />
                      <RegisterField label="DD No." value={emdInstrumentNo} onChange={setEmdInstrumentNo} placeholder="Demand draft number" mono />
                      <RegisterField label="Date" value={emdDate} onChange={setEmdDate} type="date" />
                      <RegisterField label="Amount" value={emdAmount} onChange={setEmdAmount} type="number" />
                      <RegisterField label="Bank Name" value={emdBankName} onChange={setEmdBankName} placeholder="Issuing bank" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="text-xs font-black text-slate-800">EMD Maturity details (As per Agreement)</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <RegisterField label="FD No." value={emdMaturityFdNo} onChange={setEmdMaturityFdNo} mono />
                      <RegisterField label="DD No." value={emdMaturityInstrumentNo} onChange={setEmdMaturityInstrumentNo} mono />
                      <RegisterField label="Date" value={emdMaturityDate} onChange={setEmdMaturityDate} type="date" />
                      <RegisterField label="Amount" value={emdMaturityAmount} onChange={setEmdMaturityAmount} type="number" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="text-xs font-black text-slate-800">EMD Release details (As per Actual)</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <RegisterField label="FD No." value={emdReleaseFdNo} onChange={setEmdReleaseFdNo} mono />
                      <RegisterField label="DD No." value={emdRefundRef} onChange={setEmdRefundRef} placeholder="Release DD No." mono />
                      <RegisterField label="Date" value={emdRefundDate} onChange={setEmdRefundDate} type="date" />
                      <RegisterField label="Amount" value={emdReleaseAmount} onChange={setEmdReleaseAmount} type="number" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <RegisterField label="Make Agency" value={makeAgency} onChange={setMakeAgency} placeholder="e.g. N.K. Ent." />
                    <RegisterField label="Applicant Agency" value={applicantAgency} onChange={setApplicantAgency} />
                    <div className="md:col-span-2">
                      <RegisterField label="Remark/Status" value={emdRemark} onChange={setEmdRemark} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">EMD Current Status</label>
                      <select value={emdStatus} onChange={(e) => setEmdStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white">
                        <option value="SUBMITTED">Submitted with Bid</option>
                        <option value="ACTIVE">Active / Under Evaluation</option>
                        <option value="REFUNDED">Refunded to Firm</option>
                        <option value="ADJUSTED_TO_PG">Adjusted towards PG</option>
                        <option value="ADJUSTED_TO_SD">Adjusted towards SD</option>
                        <option value="FORFEITED">Forfeited</option>
                      </select>
                    </div>
                    <RegisterField label="Tender Opening Date" value={tenderOpening} onChange={setTenderOpening} type="date" />
                    <RegisterField label="EMD % of Tender" value={emdPercent} onChange={handleEmdPercentChange} type="number" />
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">EMD Mode</label>
                      <select value={emdMode} onChange={(e) => setEmdMode(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white">
                        <option value="DEMAND_DRAFT">Demand Draft (DD)</option>
                        <option value="FDR">Fixed Deposit Receipt (FDR)</option>
                        <option value="BANK_GUARANTEE">Bank Guarantee (BG)</option>
                        <option value="ONLINE">Online / RTGS / NEFT</option>
                        <option value="CHALLAN">Treasury Challan</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: PG REGISTER */}
              {modalSection === "PG" && (
                <div className="space-y-4">
                  <div className="border-b border-purple-100 pb-2">
                    <h3 className="text-sm font-bold text-purple-900">Performance Guarantee(P.G.) Register</h3>
                    <p className="text-xs text-purple-700">Same fields as the office PG register.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <RegisterField label="Reg Sl No" value={pgRegdSerialNo} onChange={setPgRegdSerialNo} placeholder="e.g. 10" mono />
                    <RegisterField label="Department / Division" value={departmentName} onChange={setDepartmentName} />
                    <RegisterField label="NIT No." value={tenderNo} onChange={setTenderNo} mono />
                    <RegisterField label="Favouring" value={favouring} onChange={setFavouring} />
                    <div className="md:col-span-2">
                      <RegisterField label="Name of Work" value={workName} onChange={setWorkName} area />
                    </div>
                    <RegisterField label="Estimate Cost" value={estimateCost} onChange={setEstimateCost} type="number" />
                    <RegisterField label="Contract Amount" value={tenderAmount} onChange={setTenderAmount} type="number" />
                  </div>

                  <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 space-y-3">
                    <div className="text-xs font-black text-purple-900">P.G. Issue Details</div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <RegisterField label="FD No." value={pgFdNo} onChange={setPgFdNo} mono />
                      <RegisterField label="BG No." value={pgBgNo} onChange={setPgBgNo} mono />
                      <RegisterField label="Date" value={pgDate} onChange={setPgDate} type="date" />
                      <RegisterField label="Amount" value={pgAmount} onChange={setPgAmount} type="number" />
                      <RegisterField label="Bank Name" value={pgBankName} onChange={setPgBankName} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="text-xs font-black text-slate-800">P.G. Maturity details (As per Agreement)</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <RegisterField label="FD No." value={pgMaturityFdNo} onChange={setPgMaturityFdNo} mono />
                      <RegisterField label="BG No." value={pgMaturityBgNo} onChange={setPgMaturityBgNo} mono />
                      <RegisterField label="Date" value={pgExpiryDate} onChange={setPgExpiryDate} type="date" />
                      <RegisterField label="Amount" value={pgMaturityAmount} onChange={setPgMaturityAmount} type="number" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="text-xs font-black text-slate-800">P.G. Release details (As per Actual)</div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <RegisterField label="FD No." value={pgReleaseFdNo} onChange={setPgReleaseFdNo} mono />
                      <RegisterField label="BG No." value={pgReleaseBgNo} onChange={setPgReleaseBgNo} mono />
                      <RegisterField label="Date" value={pgReleaseDate} onChange={setPgReleaseDate} type="date" />
                      <RegisterField label="Amount" value={pgReleaseAmount} onChange={setPgReleaseAmount} type="number" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <RegisterField label="Make Agency" value={makeAgency} onChange={setMakeAgency} placeholder="e.g. N.K. Ent." />
                    <RegisterField label="Applicant Agency" value={applicantAgency} onChange={setApplicantAgency} />
                    <div className="md:col-span-2">
                      <RegisterField label="Remark/Status" value={pgRemark} onChange={setPgRemark} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">PG Current Status</label>
                      <select value={pgStatus} onChange={(e) => setPgStatus(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white">
                        <option value="SUBMITTED">Submitted to Client</option>
                        <option value="ACTIVE">Active & Verified</option>
                        <option value="RELEASED">Released / Discharged</option>
                        <option value="INVOKED">Invoked / Encashment</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">PG Instrument Mode</label>
                      <select value={pgMode} onChange={(e) => setPgMode(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white">
                        <option value="BANK_GUARANTEE">Bank Guarantee (BG)</option>
                        <option value="FDR">Fixed Deposit Receipt (FDR)</option>
                        <option value="DEMAND_DRAFT">Demand Draft (DD)</option>
                        <option value="CASH_DEPOSIT">Cash Deposit / Treasury</option>
                      </select>
                    </div>
                    <RegisterField label="PG % of Contract Value" value={pgPercent} onChange={handlePgPercentChange} type="number" />
                    <RegisterField label="Claim Period Expiry Date" value={pgClaimDate} onChange={setPgClaimDate} type="date" />
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="flex items-center gap-1.5">
                  {modalSection !== "PRE" && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = REGISTER_STEPS.indexOf(modalSection);
                        if (idx > 0) setModalSection(REGISTER_STEPS[idx - 1]);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      ← Back
                    </button>
                  )}
                  {modalSection !== "PG" && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = REGISTER_STEPS.indexOf(modalSection);
                        if (idx < REGISTER_STEPS.length - 1) setModalSection(REGISTER_STEPS[idx + 1]);
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
                        {formatDateDmy(viewingContract.tenderOpening)}
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
                        Refunded: {formatDateDmy(viewingContract.emdRefundDate)} ({viewingContract.emdRefundRef})
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
                        {formatDateDmy(viewingContract.pgExpiryDate)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Issuing Bank & Branch:</span>
                      <span className="text-slate-800">{viewingContract.pgBankName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Issue Date:</span>
                      <span className="text-slate-800">
                        {formatDateDmy(viewingContract.pgDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Claim Expiry:</span>
                      <span className="text-slate-800">
                        {formatDateDmy(viewingContract.pgClaimDate)}
                      </span>
                    </div>
                    {viewingContract.pgReleaseDate && (
                      <div className="col-span-2 pt-1 border-t border-purple-200/60 text-emerald-800">
                        Released: {formatDateDmy(viewingContract.pgReleaseDate)} ({viewingContract.pgReleaseRef})
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
                      {formatDateDmy(viewingContract.startAgreement)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Stipulated Completion:</span>
                    <span className="font-medium text-slate-800">
                      {formatDateDmy(viewingContract.completionAgreement)}
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
                            {formatDateDmy(viewingContract.billDate)}
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
                              Recd: {formatDateDmy(viewingContract.bankReceivedDate)}
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
