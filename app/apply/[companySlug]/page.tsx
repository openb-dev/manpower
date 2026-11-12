"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DECLARATION, TERMS, JOINING_VERSION } from "@/server/data/joiningText.js";
import {
  DEFAULT_COUNTRY,
  DEFAULT_STATE,
  INDIAN_STATES,
  QUALIFICATION_OPTIONS,
  formDataWithoutFiles,
  indianAddressLine,
} from "@/lib/applicantFormFields";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";
import { dataUrlBytes, dataUrlToBlob, fileToCompressedUpload, prettyBytes } from "@/lib/compressUpload";
import {
  GEM_EXPERIENCE_BANDS,
  GEM_MANPOWER_PROFILES,
  GEM_SKILL_CATEGORIES,
  isManpowerRole,
  isSecurityGuardRole,
} from "@/lib/gem";
import { PasswordInput } from "@/components/PasswordInput";

interface JobRole {
  id: string;
  name: string;
  code: string;
  categories: {
    id: string;
    name: string;
    code: string;
    formDefinitions: { schema: any[]; version: number }[];
  }[];
}

interface CompanyData {
  id: string;
  slug: string;
  legalName: string;
  shortName: string;
  jobRoles: JobRole[];
}

interface CandidateSession {
  id: string;
  fullName: string;
  email: string;
  whatsappNo: string;
  otpVerifiedVia?: string;
  applicants?: any[];
}

type CandidateApplication = {
  id: string;
  applicationNo?: string;
  status: string;
  createdAt: string;
  jobRoleId: string;
  roleCategoryId: string;
  role: string;
  category: string;
  extra?: string;
  remarks?: { remark: string; createdAt: string }[];
};

function candidateStatusLabel(status?: string) {
  const map: Record<string, string> = {
    NEW: "Under review",
    SHORTLISTED: "Shortlisted",
    APPROVED: "Selected",
    REJECTED: "Not selected",
  };
  return status ? map[status] || status : "—";
}

function candidateStatusClass(status?: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  if (status === "SHORTLISTED") return "bg-blue-100 text-blue-800";
  if (status === "REJECTED") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function formatApplyDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function CandidateApplicationsPanel({ items }: { items: CandidateApplication[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Your applications</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-slate-500 text-left">
              <th className="pb-2 pr-3 font-semibold">Application ID</th>
              <th className="pb-2 pr-3 font-semibold">Role</th>
              <th className="pb-2 pr-3 font-semibold">Category</th>
              <th className="pb-2 pr-3 font-semibold">Status</th>
              <th className="pb-2 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((app) => (
              <tr key={app.id} className="border-t border-slate-200 align-top">
                <td className="py-2 pr-3 font-mono text-[11px] text-slate-800">{app.applicationNo || app.id}</td>
                <td className="py-2 pr-3 font-semibold text-slate-800">{app.role || "—"}</td>
                <td className="py-2 pr-3 text-slate-700">{app.category || "—"}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${candidateStatusClass(app.status)}`}>
                    {candidateStatusLabel(app.status)}
                  </span>
                  {app.remarks?.length ? (
                    <div className="mt-1.5 space-y-1 max-w-xs">
                      {app.remarks.map((note, idx) => (
                        <div key={`${app.id}-note-${idx}`} className="text-[11px] text-slate-700 leading-snug">
                          <div>
                            <span className="font-bold text-slate-800">Office note: </span>
                            {note.remark}
                          </div>
                          <div className="text-[10px] text-slate-500">{formatApplyDate(note.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td className="py-2 text-slate-700 whitespace-nowrap">{formatApplyDate(app.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface FamilyMember {
  name: string;
  relation: string;
  dateOfBirth: string;
  aadhaar: string;
}

function blankFamily(): FamilyMember[] {
  return [{ name: "", relation: "", dateOfBirth: "", aadhaar: "" }];
}

interface WorkJob {
  employer: string;
  job: string;
  from: string;
  to: string;
}

function blankJob(): WorkJob {
  return { employer: "", job: "", from: "", to: "" };
}

function jobList(history: unknown): WorkJob[] {
  if (!Array.isArray(history) || history.length === 0) return [blankJob()];
  return history.map((job: any) => ({
    employer: String(job?.employer || ""),
    job: String(job?.job || ""),
    from: String(job?.from || ""),
    to: String(job?.to || ""),
  }));
}

function copyPresentToPermanent<T extends Record<string, any>>(form: T): T {
  return {
    ...form,
    permanentAddress: form.presentAddress,
    permanentPO: form.presentPO,
    permanentPS: form.presentPS,
    permanentPin: form.presentPin,
    permanentDistrict: form.presentDistrict,
    permanentState: form.presentState,
    permanentCountry: form.presentCountry,
  };
}

function initialForm() {
  return {
    name: "",
    fatherOrHusband: "",
    dateOfBirth: "",
    age: "",
    gender: "MALE",
    qualification: "",
    qualificationOther: "",
    experienceType: "",
    experience: "",
    workHistory: [blankJob()],
    otherQualification: "",
    characterCertificate: "",
    identificationMark: "",
    nationality: "Indian",
    religion: "Hindu",
    reference: "",
    referenceYears: "",
    uploadBankDetails: "",
    skillCategory: "",
    gemProfile: "",
    gemExperience: "",
    otherCategory: "",
    height: "",
    heightUnit: "cm" as string,
    heightCm: "",
    heightFt: "",
    heightInch: "",
    weight: "",
    chest: "",
    nominee: "",
    nomineeRelation: "",
    photo: "",
    photoName: "",
    exServiceNo: "NA",
    exRank: "NA",
    exDischargeDate: "",
    exDischargeBook: "NA",
    gunLicence: "NA",
    gunNo: "NA",
    mobile: "",
    email: "",
    presentAddress: "",
    presentPO: "",
    presentPS: "",
    presentPin: "",
    presentDistrict: "",
    presentState: DEFAULT_STATE,
    presentCountry: DEFAULT_COUNTRY,
    emergencyContact: "",
    sameAsPresent: false,
    permanentAddress: "",
    permanentPO: "",
    permanentPS: "",
    permanentPin: "",
    permanentDistrict: "",
    permanentState: DEFAULT_STATE,
    permanentCountry: DEFAULT_COUNTRY,
    aadhaar: "",
    pan: "",
    previousEmployer: "None",
    uan: "",
    esiIp: "",
    preferredDispensary: "",
    includeFamily: "",
    family: blankFamily(),
    bankName: "",
    accountNo: "",
    ifsc: "",
    branchName: "",
    policeStatus: "pending",
    policeFile: "",
    policeFileName: "",
    securityMoney: "0",
    declarationAccepted: false,
    termsAccepted: false,
    aadhaarFile: "",
    aadhaarFileName: "",
    panFile: "",
    panFileName: "",
    passbookFile: "",
    passbookFileName: "",
    educationFile: "",
    educationFileName: "",
    otherQualFile: "",
    otherQualFileName: "",
  };
}

function personPrefillFrom(source: Record<string, any>, account?: CandidateSession | null) {
  const next: any = { ...initialForm(), ...source };
  next.skillCategory = "";
  next.gemProfile = "";
  next.gemExperience = "";
  next.otherCategory = "";
  next.declarationAccepted = false;
  next.termsAccepted = false;
  next.workHistory = jobList(next.workHistory);
  next.family = Array.isArray(next.family) && next.family.length ? next.family : blankFamily();
  next.name = String(next.name || account?.fullName || "");
  next.mobile = String(next.mobile || account?.whatsappNo || "");
  next.email = String(next.email || account?.email || "");
  return next;
}

function personEditFrom(source: Record<string, any>) {
  const next: any = { ...initialForm(), ...source };
  next.workHistory = jobList(next.workHistory);
  next.family = Array.isArray(next.family) && next.family.length ? next.family : blankFamily();
  next.declarationAccepted = true;
  next.termsAccepted = true;
  return next;
}

function isExServicemanCategory(role?: JobRole | null, category?: { code?: string; name?: string } | null) {
  const catCode = String(category?.code || "").toUpperCase();
  const catName = String(category?.name || "").toLowerCase();
  const isGuard = isSecurityGuardRole(role);
  const isExCat =
    catCode === "BSF_EX" ||
    catCode === "EX_SERVICE" ||
    catName === "ex-serviceman" ||
    catName.includes("ex-serviceman") ||
    catName.includes("ex serviceman");
  return isGuard && isExCat;
}

function isGunmanCategory(role?: JobRole | null, category?: { code?: string; name?: string } | null) {
  const text = `${role?.code || ""} ${role?.name || ""} ${category?.code || ""} ${category?.name || ""}`.toLowerCase();
  return text.includes("gunman") || text.includes("armed");
}

function isOthersChoice(value?: { code?: string; name?: string } | string | null) {
  const text = typeof value === "string" ? value : `${value?.code || ""} ${value?.name || ""}`;
  return text.trim().toUpperCase() === "OTHERS" || /(^|\s)others$/i.test(text.trim());
}

function heightText(form: ReturnType<typeof initialForm>) {
  if (form.heightUnit === "ft") {
    const ft = String(form.heightFt || "").trim();
    const inch = String(form.heightInch || "").trim();
    if (!ft && !inch) return "";
    return `${ft || "0"} ft ${inch || "0"} inch`;
  }
  const cm = String(form.heightCm || form.height || "").trim();
  return cm ? `${cm} cm` : "";
}

function qualificationShown(form: ReturnType<typeof initialForm>) {
  if (form.qualification === "Other") return form.qualificationOther.trim();
  return form.qualification.trim();
}

function attachedNote(name: string, dataUrl: string) {
  const size = dataUrl ? prettyBytes(dataUrlBytes(dataUrl)) : "";
  return size ? `✓ ${name} (${size})` : `✓ ${name}`;
}

function missingPlace(label: string, pin: string, district: string, state: string) {
  if (!pin.trim() || pin.replace(/\D/g, "").length !== 6) return `Please enter a 6-digit PIN for ${label}.`;
  if (!district.trim()) return `Please enter district for ${label}.`;
  if (!state.trim()) return `Please select state for ${label}.`;
  return "";
}


const fieldCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600";

function PlaceFields({
  pin,
  district,
  state,
  disabled = false,
  required = true,
  onPin,
  onDistrict,
  onState,
}: {
  pin: string;
  district: string;
  state: string;
  disabled?: boolean;
  required?: boolean;
  onPin: (value: string) => void;
  onDistrict: (value: string) => void;
  onState: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Dist. {required ? <span className="text-red-500">*</span> : null}
        </label>
        <input
          required={required}
          disabled={disabled}
          type="text"
          value={district}
          onChange={(e) => onDistrict(e.target.value)}
          className={fieldCls}
          placeholder="District"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          State {required ? <span className="text-red-500">*</span> : null}
        </label>
        <select
          required={required}
          disabled={disabled}
          value={state}
          onChange={(e) => onState(e.target.value)}
          className={fieldCls}
        >
          <option value="">Select state</option>
          {INDIAN_STATES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          PIN {required ? <span className="text-red-500">*</span> : null}
        </label>
        <input
          required={required}
          disabled={disabled}
          type="text"
          maxLength={6}
          value={pin}
          onChange={(e) => onPin(e.target.value.replace(/\D/g, ""))}
          className={`${fieldCls} font-mono`}
          placeholder="6-digit PIN"
        />
      </div>
    </div>
  );
}

function YesNoRadios({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: "YES" | "NO") => void;
}) {
  return (
    <div>
      <p className="block text-xs font-bold text-slate-700 mb-2">
        {label} <span className="text-red-500">*</span>
      </p>
      <div className="flex gap-8">
        {(["YES", "NO"] as const).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="w-4 h-4 border-slate-400 text-blue-600"
              required
            />
            {opt === "YES" ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </div>
  );
}

function AddressInput({
  label,
  value,
  onChange,
  placeholder,
  required = true,
  disabled = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-slate-700 mb-1">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      <input
        required={required}
        disabled={disabled}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldCls}
        placeholder={placeholder}
      />
    </div>
  );
}

function ApplyLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <p className="text-slate-600 font-medium animate-pulse">Loading recruitment portal...</p>
    </div>
  );
}

function ApplyPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const companySlug = params?.companySlug as string;
  const fillAsAdmin = searchParams.get("fill") === "admin";
  const editApplicantId = fillAsAdmin ? String(searchParams.get("edit") || "").trim() : "";

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  function setError(message: string) {
    setErrorState(message ? friendlyPublicError(message) : "");
    if (message) setSuccessMsg("");
  }

  // Candidate Authentication State
  const [candidate, setCandidate] = useState<CandidateSession | null>(null);
  const [officeAdmin, setOfficeAdmin] = useState<{ id: string; name: string; email: string } | null>(null);
  const [officeAdminChecked, setOfficeAdminChecked] = useState(false);
  const [adminFiller, setAdminFiller] = useState({ name: "", phone: "", confirmed: false });
  const [authTab, setAuthTab] = useState<"REGISTER" | "LOGIN" | "FORGOT">("REGISTER");

  // Registration Form State
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [otpChannel, setOtpChannel] = useState<"WHATSAPP" | "EMAIL">("EMAIL");
  const [regOtpCode, setRegOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [authLoading, setAuthLoading] = useState(false);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtpCode, setResetOtpCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);
  const [resetCodeStatus, setResetCodeStatus] = useState<"" | "checking" | "ok" | "bad">("");
  const resetVerifyLock = useRef("");

  // Application Steps
  const [step, setStep] = useState<"ROLE" | "FORM" | "SUCCESS">("ROLE");
  const [selectedRole, setSelectedRole] = useState<JobRole | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  // Complete Application Form State
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState("");
  const [editingNo, setEditingNo] = useState("");
  const [compressingLabel, setCompressingLabel] = useState("");
  const [myApplications, setMyApplications] = useState<CandidateApplication[]>([]);
  const prefillRef = useRef<ReturnType<typeof initialForm> | null>(null);

  useEffect(() => {
    if (fillAsAdmin) return;
    const controller = new AbortController();
    fetch(`/api/apply/${companySlug}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "GET_CANDIDATE_ME" }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await readApiJson(res);
        if (controller.signal.aborted) return;
        if (!data.candidate) return;
        setCandidate(data.candidate);
        loadPrefill(data.candidate);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
      });
    return () => {
      controller.abort();
    };
  }, [companySlug, fillAsAdmin]);

  async function loadPrefill(account?: CandidateSession | null) {
    try {
      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GET_CANDIDATE_PREFILL" }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.prefill) return;
      const next = personPrefillFrom(data.prefill, account);
      prefillRef.current = next;
      setForm((prev) => (prev.aadhaar || prev.fatherOrHusband || prev.presentAddress ? prev : next));
    } catch {
      /* first-time candidate has nothing to copy */
    }
  }

  async function loadMyApplications() {
    try {
      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GET_CANDIDATE_APPLICATIONS",
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        setMyApplications([]);
        return;
      }
      setMyApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch {
      /* keep last list */
    }
  }

  useEffect(() => {
    if (!candidate?.id || officeAdmin) {
      setMyApplications([]);
      return;
    }
    loadMyApplications();
  }, [candidate?.id, officeAdmin, companySlug, step]);

  useEffect(() => {
    if (!fillAsAdmin) {
      setOfficeAdmin(null);
      setOfficeAdminChecked(true);
      return;
    }

    fetch("/api/auth/session", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const user = data?.user;
        if (!user?.id) return;
        const role = String(user.role || "");
        const sameCompany = user.companySlug === companySlug || !user.companySlug;
        if (role !== "SUPER_ADMIN" && role !== "COMPANY_ADMIN") return;
        if (role === "COMPANY_ADMIN" && user.companySlug && user.companySlug !== companySlug) return;
        if (!sameCompany && role !== "SUPER_ADMIN") return;
        const adminName = String(user.name || "Admin");
        setOfficeAdmin({
          id: String(user.id),
          name: adminName,
          email: String(user.email || ""),
        });
        setCandidate(null);
        if (!editApplicantId) {
          setForm((prev) => ({
            ...prev,
            name: "",
            mobile: "",
            email: "",
          }));
        }
        setAdminFiller((prev) => ({
          ...prev,
          name: prev.name || adminName,
        }));
      })
      .catch(() => {})
      .finally(() => setOfficeAdminChecked(true));
  }, [companySlug, fillAsAdmin, editApplicantId]);

  // Fetch Company Data
  useEffect(() => {
    fetch(`/api/apply/${companySlug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not find company recruitment portal.");
        const data = await readApiJson(res);
        setCompany(data);
        if (!editApplicantId) {
          setSelectedRole(null);
          setSelectedCategory(null);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [companySlug, editApplicantId]);

  useEffect(() => {
    if (!editApplicantId || !officeAdmin || !company) return;
    let cancelled = false;
    fetch(`/api/apply/${companySlug}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "GET_ADMIN_APPLICATION", applicantId: editApplicantId }),
    })
      .then(async (res) => {
        const data = await readApiJson(res);
        if (!res.ok) throw new Error(data.error || "This application could not be opened for edit.");
        if (cancelled) return;
        const application = data.application;
        const role = (company.jobRoles || []).find((item: JobRole) => item.id === application.jobRoleId) || null;
        const category = role?.categories?.find((item) => item.id === application.roleCategoryId) || null;
        setSelectedRole(role);
        setSelectedCategory(category);
        setForm(personEditFrom(application.prefill || {}));
        setEditingNo(application.applicationNo || "");
        setStep("FORM");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "This application could not be opened for edit.");
      });
    return () => {
      cancelled = true;
    };
  }, [editApplicantId, officeAdmin, company, companySlug]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (!successMsg || step === "SUCCESS") return;
    const timer = setTimeout(() => setSuccessMsg(""), 4000);
    return () => clearTimeout(timer);
  }, [successMsg, step]);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => setOtpCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  useEffect(() => {
    if (resetCountdown <= 0) return;
    const timer = setInterval(() => setResetCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resetCountdown]);

  useEffect(() => {
    if (authTab !== "FORGOT") return;
    const email = resetEmail.trim().toLowerCase();
    const code = resetOtpCode;
    if (!resetOtpSent || code.length !== 6 || !email.includes("@")) {
      setResetCodeStatus("");
      return;
    }
    const key = `${email}:${code}`;
    if (resetVerifyLock.current === key) return;
    resetVerifyLock.current = key;
    let cancelled = false;
    setResetCodeStatus("checking");
    fetch(`/api/apply/${companySlug}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "VERIFY_OTP",
        identifier: email,
        code,
      }),
    })
      .then(async (res) => {
        const data = await readApiJson(res);
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "That code is not correct.");
        setResetCodeStatus("ok");
        setError("");
        setSuccessMsg("Code verified. Type your new password below.");
        window.setTimeout(() => document.getElementById("reset-new-password")?.focus(), 50);
      })
      .catch((err) => {
        if (cancelled) return;
        resetVerifyLock.current = "";
        setResetCodeStatus("bad");
        setError(err.message || "That code is not correct.");
        setSuccessMsg("");
      });
    return () => {
      cancelled = true;
    };
  }, [authTab, companySlug, resetEmail, resetOtpCode, resetOtpSent]);

  // When candidate logs in or updates, sync name & mobile
  useEffect(() => {
    if (candidate) {
        setForm((prev) => ({
          ...prev,
          name: prev.name || candidate.fullName || "",
          mobile: prev.mobile || candidate.whatsappNo || "",
          email: prev.email || candidate.email || "",
        }));
    }
  }, [candidate]);

  useEffect(() => {
    if (!error) return;
    document.getElementById("apply-error")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [error]);

  // Request OTP for candidate registration
  async function handleSendRegistrationOtp() {
    setError("");
    setSuccessMsg("");

    const targetIdentifier = otpChannel === "EMAIL" ? regEmail.trim() : regWhatsapp.trim().replace(/\D/g, "");

    if (otpChannel === "EMAIL") {
      if (!regEmail || !regEmail.includes("@")) {
        setError("Please enter a valid email address first.");
        return;
      }
    } else {
      if (!targetIdentifier || targetIdentifier.length !== 10) {
        setError("Please enter a valid 10-digit WhatsApp / mobile number.");
        return;
      }
    }

    setAuthLoading(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug,
          identifier: targetIdentifier,
          channel: otpChannel,
        }),
      });

      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Could not send the verification code. Please try again.");

      setOtpSent(true);
      setOtpCountdown(60);
      if (data.trialCode) {
        setRegOtpCode(data.trialCode);
        setSuccessMsg(
          `No SMS/email service is set on this computer. Test code: ${data.trialCode}`
        );
      } else if (data.delivered) {
        setSuccessMsg(
          `Code sent to ${otpChannel === "EMAIL" ? regEmail : `+91 ${regWhatsapp}`}. Enter it below.`
        );
      } else {
        setSuccessMsg("Enter the 6-digit code you received.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Complete Registration with OTP & Password
  async function handleCompleteRegistration(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!regFullName.trim()) {
      setError("Please provide your full name.");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    const cleanPhone = regWhatsapp.replace(/\D/g, "").slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit WhatsApp number.");
      return;
    }
    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!regOtpCode || regOtpCode.length !== 6) {
      setError("Please enter the 6-digit verification OTP code received.");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REGISTER_CANDIDATE",
          fullName: regFullName,
          email: regEmail,
          whatsappNo: cleanPhone,
          password: regPassword,
          otpChannel,
          otpCode: regOtpCode,
        }),
      });

      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Registration could not be completed. Please check the details and try again.");

      const newSession: CandidateSession = data.candidate;
      setCandidate(newSession);
      setForm((prev) => ({
        ...prev,
        name: newSession.fullName,
        mobile: newSession.whatsappNo,
      }));
      setSuccessMsg("Registration and OTP verification successful! You can now complete your application.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Candidate Login with Email & Password
  async function handleCandidateLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setAuthLoading(true);

    try {
      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LOGIN_CANDIDATE",
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Sign in failed. Please check email and password.");

      const session: CandidateSession = data.candidate;
      setCandidate(session);
      await loadPrefill(session);
      setSuccessMsg("Signed in successfully!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSendResetOtp() {
    setError("");
    setSuccessMsg("");
    const email = resetEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Please enter the email used to register.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REQUEST_PASSWORD_RESET",
          email,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Could not send the verification code. Please try again.");
      resetVerifyLock.current = "";
      setResetCodeStatus("");
      setResetOtpSent(true);
      setResetCountdown(60);
      if (data.trialCode) {
        setResetOtpCode(data.trialCode);
        setSuccessMsg(`No email service is set on this computer. Test code: ${data.trialCode}. Write it in the 6-digit box.`);
      } else if (data.delivered) {
        setSuccessMsg(`Code sent to ${email}. Open Gmail, copy the 6 digits, and write them in the box labelled “Write the 6-digit code here”. Also check Spam.`);
      } else {
        setSuccessMsg("Write the 6-digit code from Gmail in the box below.");
      }
      window.setTimeout(() => document.getElementById("reset-otp-code")?.focus(), 50);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    const email = resetEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Please enter the email used to register.");
      return;
    }
    if (!resetOtpSent) {
      setError("Please send the email verification code first.");
      return;
    }
    if (!resetOtpCode || resetOtpCode.length !== 6) {
      setError("Please enter the 6-digit code sent to your email.");
      return;
    }
    if (resetCodeStatus !== "ok") {
      setError("Please wait until the 6-digit code is verified.");
      return;
    }
    if (resetPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESET_CANDIDATE_PASSWORD",
          email,
          otpCode: resetOtpCode,
          password: resetPassword,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Password could not be changed. Please try again.");
      const session: CandidateSession = data.candidate;
      setCandidate(session);
      setLoginEmail(email);
      setLoginPassword("");
      setResetPassword("");
      setResetConfirmPassword("");
      setResetOtpCode("");
      setResetOtpSent(false);
      await loadPrefill(session);
      setSuccessMsg("Password updated. You are signed in.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Sign out candidate session
  async function handleSignOut() {
    try {
      await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "LOGOUT_CANDIDATE" }),
      });
    } catch {
      /* still clear the screen */
    }
    setCandidate(null);
    setMyApplications([]);
    setStep("ROLE");
    setSubmittedRef("");
    setSuccessMsg("Signed out of candidate portal.");
  }

  // Auto-calculate age from Date of Birth
  function handleDobChange(dobString: string) {
    let computedAge = form.age;
    if (dobString) {
      const birth = new Date(dobString);
      if (!isNaN(birth.getTime())) {
        const diff = Date.now() - birth.getTime();
        const ageNum = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        if (ageNum > 0 && ageNum < 120) {
          computedAge = String(ageNum);
        }
      }
    }
    setForm((prev) => ({ ...prev, dateOfBirth: dobString, age: computedAge }));
  }

  // Handle File Uploads with FileReader DataURL
  function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    dataKey:
      | "photo"
      | "aadhaarFile"
      | "panFile"
      | "passbookFile"
      | "educationFile"
      | "otherQualFile"
      | "policeFile",
    nameKey:
      | "photoName"
      | "aadhaarFileName"
      | "panFileName"
      | "passbookFileName"
      | "educationFileName"
      | "otherQualFileName"
      | "policeFileName",
  ) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const isPdf = /\.pdf$/i.test(String(file.name || "").trim()) || /pdf/i.test(file.type || "");
    if (dataKey === "photo" && isPdf) {
      setError("Passport photo must be a JPG or PNG picture, not a PDF.");
      input.value = "";
      return;
    }
    setError("");
    setCompressingLabel(file.name);
    fileToCompressedUpload(file, dataKey === "photo" ? "photo" : "document")
      .then(({ dataUrl, fileName }) => {
        setForm((prev) => ({
          ...prev,
          [dataKey]: dataUrl,
          [nameKey]: fileName || file.name,
        }));
      })
      .catch((err: any) => {
        setError(err.message || "Could not read that file.");
        input.value = "";
      })
      .finally(() => setCompressingLabel(""));
  }

  function updatePresent(
    field:
      | "presentAddress"
      | "presentPO"
      | "presentPS"
      | "presentPin"
      | "presentDistrict"
      | "presentState"
      | "presentCountry",
    value: string,
  ) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      return next.sameAsPresent ? copyPresentToPermanent(next) : next;
    });
  }

  // Update Family Member Row
  function updateFamilyMember(index: number, key: keyof FamilyMember, value: string) {
    setForm((prev) => {
      const updated = [...prev.family];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, family: updated };
    });
  }

  function addFamilyMember() {
    setForm((prev) => {
      if (prev.family.length >= 5) return prev;
      return {
        ...prev,
        family: [...prev.family, { name: "", relation: "", dateOfBirth: "", aadhaar: "" }],
      };
    });
  }

  function removeFamilyMember(index: number) {
    setForm((prev) => {
      if (prev.family.length <= 1) return prev;
      return { ...prev, family: prev.family.filter((_, idx) => idx !== index) };
    });
  }

  function updateWorkJob(index: number, key: keyof WorkJob, value: string) {
    setForm((prev) => {
      const updated = jobList(prev.workHistory);
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, workHistory: updated };
    });
  }

  function addWorkJob() {
    setForm((prev) => ({
      ...prev,
      workHistory: [...jobList(prev.workHistory), blankJob()],
    }));
  }

  function removeWorkJob(index: number) {
    setForm((prev) => {
      const current = jobList(prev.workHistory);
      if (current.length <= 1) return prev;
      return { ...prev, workHistory: current.filter((_, idx) => idx !== index) };
    });
  }

  // Submit Job Application
  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (compressingLabel) return setError("Please wait for the file to finish compressing.");
    if (!officeAdmin && !candidate) {
      setError("Please sign in or register before submitting your application.");
      return;
    }
    if (officeAdmin) {
      const fillerName = adminFiller.name.trim();
      const fillerPhone = adminFiller.phone.replace(/\D/g, "").slice(-10);
      if (!fillerName) return setError("Please enter the filling admin name first.");
      if (fillerPhone.length !== 10) return setError("Please enter the filling admin 10-digit phone number first.");
    }
    if (!selectedRole?.id) return setError("Please select a trade.");
    if (!selectedCategory?.id) return setError("Please select a job category.");

    // Validation checks
    if (!form.name.trim()) return setError("Please enter your full name.");
    if (!form.fatherOrHusband.trim()) return setError("Please enter your Father / Husband name.");
    if (!form.dateOfBirth) return setError("Please enter your date of birth.");
    if (!form.age) return setError("Please enter your age.");
    if (!form.gender) return setError("Please select gender.");
    if (!qualificationShown(form)) return setError("Please select your educational qualification.");
    if (form.qualification === "Other" && !form.qualificationOther.trim()) {
      return setError("Please enter your educational qualification.");
    }
    if (!form.educationFileName && !form.educationFile) {
      return setError("Please upload your education qualification certificate.");
    }
    if (!form.experienceType) return setError("Please select Fresher or Experienced.");
    const filledJobs = jobList(form.workHistory).filter((job) =>
      [job.employer, job.job, job.from, job.to].some((part) => String(part || "").trim())
    );
    if (form.experienceType === "EXPERIENCED") {
      if (!form.previousEmployer.trim() || form.previousEmployer.trim().toUpperCase() === "NONE") {
        return setError("Please enter previous employer name.");
      }
      if (filledJobs.length === 0) return setError("Please add at least one work experience.");
      const incompleteJob = filledJobs.find((job, idx) => {
        const employer = String(idx === 0 ? form.previousEmployer || job.employer : job.employer).trim();
        return !employer || !job.job.trim() || !job.from.trim() || !job.to.trim();
      });
      if (incompleteJob) return setError("Please complete every work experience row, or remove it.");
    }
    if (!form.identificationMark.trim()) return setError("Please enter your identification mark.");
    if (!form.nationality.trim()) return setError("Please enter your nationality.");
    if (!form.religion.trim()) return setError("Please select your religion.");
    if (!form.reference.trim()) return setError("Please provide a reference name and relation.");
    if (!String(form.referenceYears || "").trim()) {
      return setError("Please enter how many years the reference person has known you.");
    }
    const heightValue = heightText(form);
    if (!heightValue) return setError("Please enter your height.");
    if (!form.weight.trim()) return setError("Please specify weight.");
    if (!form.nominee.trim()) return setError("Please provide nominee name.");
    if (!form.nomineeRelation.trim()) return setError("Please enter nominee relation.");
    if (!form.photoName && !form.photo) return setError("Please upload a passport-size photo.");

    const cleanMobile = form.mobile.replace(/\D/g, "").slice(-10);
    if (cleanMobile.length !== 10) return setError("Please enter a valid 10-digit mobile number.");
    const cleanEmergency = form.emergencyContact.replace(/\D/g, "").slice(-10);
    if (cleanEmergency.length !== 10) return setError("Please enter a valid 10-digit emergency contact number.");
    const applicantEmail = String(form.email || candidate?.email || "").trim().toLowerCase();
    if (!applicantEmail.includes("@")) return setError("Please enter the applicant email address.");

    if (!form.presentAddress.trim()) return setError("Please enter Vill. / Locality for present address.");
    if (!form.presentPO.trim()) return setError("Please enter present P.O.");
    if (!form.presentPS.trim()) return setError("Please enter present P.S.");
    const presentPlaceErr = missingPlace(
      "present address",
      form.presentPin,
      form.presentDistrict,
      form.presentState,
    );
    if (presentPlaceErr) return setError(presentPlaceErr);
    const permanent = form.sameAsPresent
      ? {
          address: form.presentAddress,
          po: form.presentPO,
          ps: form.presentPS,
          pin: form.presentPin,
          district: form.presentDistrict,
          state: form.presentState,
          country: form.presentCountry,
        }
      : {
          address: form.permanentAddress,
          po: form.permanentPO,
          ps: form.permanentPS,
          pin: form.permanentPin,
          district: form.permanentDistrict,
          state: form.permanentState,
          country: form.permanentCountry,
        };
    if (!permanent.address.trim()) return setError("Please enter Vill. / Locality for permanent address.");
    if (!permanent.po.trim()) return setError("Please enter permanent P.O.");
    if (!permanent.ps.trim()) return setError("Please enter permanent P.S.");
    const permanentPlaceErr = missingPlace(
      "permanent address",
      permanent.pin,
      permanent.district,
      permanent.state,
    );
    if (permanentPlaceErr) return setError(permanentPlaceErr);

    const cleanAadhaar = form.aadhaar.replace(/\D/g, "");
    if (cleanAadhaar.length !== 12) return setError("Aadhaar number must be exactly 12 digits.");

    const cleanPan = form.pan.trim().toUpperCase();
    if (!cleanPan) return setError("Please enter your PAN card number.");
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      return setError("Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).");
    }

    const isExServiceman = isExServicemanCategory(selectedRole, selectedCategory);
    if (isExServiceman) {
      if (!form.exServiceNo.trim() || form.exServiceNo.trim().toUpperCase() === "NA") {
        return setError("Please enter Ex-Serviceman No.");
      }
      if (!form.exRank.trim() || form.exRank.trim().toUpperCase() === "NA") {
        return setError("Please enter Ex-Serviceman Rank.");
      }
      if (!form.exDischargeDate) return setError("Please enter Discharge Date.");
      if (!form.exDischargeBook.trim() || form.exDischargeBook.trim().toUpperCase() === "NA") {
        return setError("Please enter Discharge Book No.");
      }
    }
    if (!form.gunLicence.trim()) return setError("Please enter Gun Licence Number (use NA if not applicable).");
    if (!form.gunNo.trim()) return setError("Please enter Gun Serial Number (use NA if not applicable).");
    const experienceSummary =
      form.experienceType === "FRESHER"
        ? "Fresher"
        : filledJobs.map((job) => `${job.job} at ${job.employer} (${job.from} to ${job.to})`).join("; ");
    const previousEmployer =
      form.experienceType === "FRESHER" ? "None" : form.previousEmployer.trim() || filledJobs[0]?.employer || "None";
    if (!form.uan.trim()) return setError("Please enter PF UAN (use NA if not allotted).");
    if (!form.esiIp.trim()) return setError("Please enter ESI IP No. (use NA if not allotted).");
    if (!form.preferredDispensary.trim()) return setError("Please enter preferred ESI dispensary (use NA if not allotted).");
    if (!form.policeStatus) return setError("Please select police verification status.");
    if (form.policeStatus === "verified" && !form.policeFileName && !form.policeFile) {
      return setError("Please upload the police verification document.");
    }

    if (!form.includeFamily) return setError("Please select Yes or No for family member details.");
    const filledFamily =
      form.includeFamily === "YES"
        ? (form.family || []).filter((member) =>
            [member.name, member.relation, member.dateOfBirth, member.aadhaar].some((part) => String(part || "").trim()),
          )
        : [];
    if (form.includeFamily === "YES") {
      if (filledFamily.length === 0) return setError("Please add at least one family member, or select No.");
      const incompleteFamily = filledFamily.find(
        (member) => !member.name.trim() || !member.relation.trim() || !member.dateOfBirth || !member.aadhaar.trim(),
      );
      if (incompleteFamily) return setError("Please complete the family row you started, or remove it.");
    }

    if (!form.uploadBankDetails) return setError("Please select Yes or No for bank details.");
    const wantsBank = form.uploadBankDetails === "YES";
    if (wantsBank) {
      if (!form.bankName.trim()) return setError("Please enter bank name.");
      if (!form.accountNo.trim()) return setError("Please enter bank account number.");
      if (!form.ifsc.trim()) return setError("Please enter IFSC code.");
      if (!form.branchName.trim()) return setError("Please enter bank branch name and address.");
      if (!form.passbookFileName && !form.passbookFile) {
        return setError("Please upload the bank passbook or cancelled cheque.");
      }
    }

    if (!form.aadhaarFileName && !form.aadhaarFile) return setError("Please upload your Aadhaar document.");
    if (!form.panFileName && !form.panFile) return setError("Please upload your PAN card document.");

    if (!form.declarationAccepted) {
      return setError("You must read and accept the official Declaration.");
    }
    if (!form.termsAccepted) {
      return setError("You must read and accept the official Terms and Conditions.");
    }

    setSubmitting(true);

    try {
      const documentsPayload = [
        ...(form.photoName ? [{ docType: "PHOTO", fileName: form.photoName, fileData: form.photo }] : []),
        ...(form.aadhaarFileName ? [{ docType: "AADHAAR", fileName: form.aadhaarFileName, fileData: form.aadhaarFile }] : []),
        ...(form.panFileName ? [{ docType: "PAN", fileName: form.panFileName, fileData: form.panFile }] : []),
        ...(wantsBank && form.passbookFileName
          ? [{ docType: "PASSBOOK", fileName: form.passbookFileName, fileData: form.passbookFile }]
          : []),
        ...(form.educationFileName
          ? [{ docType: "EDUCATION", fileName: form.educationFileName, fileData: form.educationFile }]
          : []),
        ...(form.otherQualFileName
          ? [{ docType: "OTHER_QUALIFICATION", fileName: form.otherQualFileName, fileData: form.otherQualFile }]
          : []),
        ...(form.policeFileName
          ? [{ docType: "POLICE_VERIFICATION", fileName: form.policeFileName, fileData: form.policeFile }]
          : []),
      ];

      const payload = {
        companySlug,
        jobRoleId: selectedRole?.id,
        roleCategoryId: selectedCategory?.id,
        fullName: form.name.trim(),
        mobile: cleanMobile,
        email: applicantEmail,
        fatherOrHusband: form.fatherOrHusband.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender || "MALE",
        presentAddress: indianAddressLine({
          locality: form.presentAddress,
          po: form.presentPO,
          ps: form.presentPS,
          district: form.presentDistrict,
          state: form.presentState,
          pin: form.presentPin,
          country: form.presentCountry,
        }),
        permanentAddress: indianAddressLine({
          locality: permanent.address,
          po: permanent.po,
          ps: permanent.ps,
          district: permanent.district,
          state: permanent.state,
          pin: permanent.pin,
          country: permanent.country,
        }),
        aadhaarNumber: cleanAadhaar,
        panNumber: cleanPan,
        exServiceNo: isExServiceman ? form.exServiceNo.trim() : "NA",
        armsLicenseNo: form.gunLicence.trim(),
        formData: {
          ...formDataWithoutFiles(form),
          qualification: qualificationShown(form),
          permanentAddress: permanent.address,
          permanentPO: permanent.po,
          permanentPS: permanent.ps,
          permanentPin: permanent.pin,
          permanentDistrict: permanent.district,
          permanentState: permanent.state,
          permanentCountry: permanent.country,
          exServiceNo: isExServiceman ? form.exServiceNo.trim() : "NA",
          exRank: isExServiceman ? form.exRank.trim() : "NA",
          exDischargeDate: isExServiceman ? form.exDischargeDate : "",
          exDischargeBook: isExServiceman ? form.exDischargeBook.trim() : "NA",
          height: heightValue,
          experienceType: form.experienceType,
          experience: experienceSummary,
          workHistory: form.experienceType === "EXPERIENCED" ? filledJobs : [],
          previousEmployer,
          emergencyContact: cleanEmergency,
          uan: form.uan.trim(),
          esiIp: form.esiIp.trim(),
          preferredDispensary: form.preferredDispensary.trim(),
          nomineeRelation: form.nomineeRelation.trim(),
          otherQualification: form.otherQualification.trim(),
          characterCertificate: form.otherQualification.trim(),
          includeFamily: form.includeFamily,
          family: filledFamily,
          uploadBankDetails: form.uploadBankDetails,
          referenceYears: String(form.referenceYears || "").trim(),
          skillCategory: form.skillCategory,
          gemProfile: form.gemProfile === "Others" ? form.otherCategory.trim() || "Others" : form.gemProfile,
          gemExperience: form.gemExperience,
          otherCategory: form.otherCategory.trim(),
          bankName: wantsBank ? form.bankName.trim() : "",
          accountNo: wantsBank ? form.accountNo.trim() : "",
          ifsc: wantsBank ? form.ifsc.trim().toUpperCase() : "",
          branchName: wantsBank ? form.branchName.trim() : "",
          passbookFileName: wantsBank ? form.passbookFileName : "",
          joiningTerms: Boolean(form.declarationAccepted && form.termsAccepted),
          termsVersion: JOINING_VERSION,
          submittedAt: new Date().toISOString(),
        },
        documents: documentsPayload.map(({ docType, fileName }) => ({ docType, fileName })),
      };

      const submitBody = new FormData();
      submitBody.append(
        "payload",
        JSON.stringify({
          action: editApplicantId ? "UPDATE_APPLICATION" : "SUBMIT_APPLICATION",
          applicantId: editApplicantId || undefined,
          data: payload,
          fillByAdmin: Boolean(officeAdmin),
          adminFillerName: officeAdmin ? adminFiller.name.trim() : undefined,
          adminFillerPhone: officeAdmin ? adminFiller.phone.replace(/\D/g, "").slice(-10) : undefined,
        }),
      );
      for (const doc of documentsPayload) {
        if (!doc.fileData) continue;
        submitBody.append(`file:${doc.docType}`, dataUrlToBlob(doc.fileData), doc.fileName);
      }

      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        body: submitBody,
      });

      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "The application could not be submitted. Please check the form and try again.");
      setSubmittedRef(data.applicationNo || data.id);
      setSuccessMsg("");
      setError("");
      if (!officeAdmin) {
        prefillRef.current = personPrefillFrom(form, candidate);
      }
      setStep("SUCCESS");
    } catch (err: any) {
      setError(err.message || "The application could not be submitted. Please check the form and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !officeAdminChecked) {
    return <ApplyLoading />;
  }

  if (error && !company) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-slate-50">
        <div className="max-w-md w-full bg-white p-6 rounded-xl border border-red-200 text-center shadow-sm">
          <div className="text-red-500 text-3xl mb-2">⚠️</div>
          <h2 className="text-lg font-bold text-slate-800">Recruitment Portal Error</h2>
          <p className="text-xs text-slate-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const canFillForm = Boolean(officeAdmin || candidate);
  const isGunRole = isGunmanCategory(selectedRole, selectedCategory);
  const isExServiceCategory = isExServicemanCategory(selectedRole, selectedCategory);
  const guardRole = company?.jobRoles.find((role) => isSecurityGuardRole(role)) || null;
  const manpowerRole = company?.jobRoles.find((role) => isManpowerRole(role)) || null;
  const manpowerCategories = manpowerRole?.categories || [];
  const manpowerOthers =
    manpowerCategories.find((cat) => String(cat.code).toUpperCase() === "OTHERS") || manpowerCategories[0] || null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col">
      {/* Brand & Auth Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center shadow-xs">
              {(company?.shortName || "NK").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "NK"}
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                {company?.legalName || "N.K. Enterprise"}
              </h1>
              <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                Official Candidate Recruitment & Joining Portal
              </p>
            </div>
          </div>

          {officeAdmin ? (
            <div className="flex items-center gap-3 text-xs">
              <div className="hidden sm:block text-right">
                <div className="font-bold text-indigo-900">
                  Form fill up by admin — {adminFiller.confirmed ? adminFiller.name : officeAdmin.name}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {adminFiller.confirmed && adminFiller.phone
                    ? `+91 ${adminFiller.phone.replace(/\D/g, "").slice(-10)}`
                    : officeAdmin.email}
                </div>
              </div>
              <Link
                href={`/${companySlug}/applicants`}
                className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-xs transition"
              >
                Back to New applicant
              </Link>
            </div>
          ) : candidate ? (
            <div className="flex items-center gap-3 text-xs">
              <div className="hidden sm:block text-right">
                <div className="font-bold text-slate-900">{candidate.fullName}</div>
                <div className="text-[11px] text-emerald-700 font-mono font-semibold">
                  +91 {candidate.whatsappNo} ✓
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 font-semibold text-xs transition"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-medium">
              Candidate Portal
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Banner Messages */}
        {error && (
          <div
            id="apply-error"
            className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between"
          >
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")} className="text-red-500 hover:text-red-800 font-bold ml-2">✕</button>
          </div>
        )}
        {successMsg && step !== "SUCCESS" && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="text-emerald-500 hover:text-emerald-800 font-bold ml-2">✕</button>
          </div>
        )}
        {compressingLabel ? (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
            Compressing {compressingLabel} so it can be saved. Please wait…
          </div>
        ) : null}

        {/* =========================================================================
            STATE 1: NOT AUTHENTICATED -> CANDIDATE REGISTRATION / SIGN IN
            ========================================================================= */}
        {!canFillForm && (
          <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Tabs Header */}
            <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => {
                  setAuthTab("REGISTER");
                  setError("");
                }}
                className={`py-3.5 text-center transition border-b-2 ${
                  authTab === "REGISTER"
                    ? "border-blue-600 text-blue-700 bg-white"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                New Applicant Registration
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab("LOGIN");
                  setError("");
                }}
                className={`py-3.5 text-center transition border-b-2 ${
                  authTab === "LOGIN" || authTab === "FORGOT"
                    ? "border-blue-600 text-blue-700 bg-white"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                Registered Candidate Sign In
              </button>
            </div>

            {/* TAB CONTENT: REGISTRATION */}
            {authTab === "REGISTER" && (
              <form onSubmit={handleCompleteRegistration} className="p-6 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Create Candidate Account</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Register with your WhatsApp number or Email to verify OTP and submit your application.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Full Name *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Ramesh Kumar Das"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Email Address *
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="e.g. ramesh@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        WhatsApp / Mobile Number *
                      </label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-xs font-mono font-bold">
                          +91
                        </span>
                        <input
                          required
                          type="tel"
                          maxLength={10}
                          placeholder="9876543210"
                          value={regWhatsapp}
                          onChange={(e) => setRegWhatsapp(e.target.value.replace(/\D/g, ""))}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-r-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Account Password (min 6 chars) *
                      </label>
                      <PasswordInput
                        required
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Confirm Password *
                      </label>
                      <PasswordInput
                        required
                        placeholder="••••••••"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* OTP Channel Choice */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Receive Verification Code Via: <span className="text-red-600">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                        otpChannel === "WHATSAPP"
                          ? "border-emerald-600 bg-emerald-50/60 text-emerald-950 font-bold shadow-xs"
                          : "border-slate-300 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="otpChannel"
                        value="WHATSAPP"
                        checked={otpChannel === "WHATSAPP"}
                        onChange={() => setOtpChannel("WHATSAPP")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="text-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>💬</span>
                          <span>WhatsApp / SMS</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          To {regWhatsapp ? `+91 ${regWhatsapp}` : "your mobile"}
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                        otpChannel === "EMAIL"
                          ? "border-blue-600 bg-blue-50/60 text-blue-950 font-bold shadow-xs"
                          : "border-slate-300 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="otpChannel"
                        value="EMAIL"
                        checked={otpChannel === "EMAIL"}
                        onChange={() => setOtpChannel("EMAIL")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div className="text-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>✉️</span>
                          <span>Email Address</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          To {regEmail ? regEmail : "your email"}
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Send / Enter OTP Section */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-800">2-Factor OTP Authentication</div>
                      <div className="text-[11px] text-slate-500">
                        {otpSent
                          ? `Verification code dispatched to ${otpChannel === "EMAIL" ? regEmail : `+91 ${regWhatsapp}`}`
                          : `Click Send OTP to receive your 6-digit code via ${otpChannel === "EMAIL" ? "Email" : "WhatsApp"}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={authLoading || otpCountdown > 0}
                      onClick={handleSendRegistrationOtp}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs whitespace-nowrap transition"
                    >
                      {authLoading
                        ? "Sending..."
                        : otpCountdown > 0
                        ? `Resend in ${otpCountdown}s`
                        : otpSent
                        ? "Resend OTP"
                        : "Send Verification OTP"}
                    </button>
                  </div>

                  {otpSent && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-center gap-2">
                      <span className="text-sm">📲</span>
                      <span>
                        A 6-digit verification code was sent to{" "}
                        <strong className="font-mono">
                          {otpChannel === "EMAIL" ? regEmail : `+91 ${regWhatsapp}`}
                        </strong>
                        . Please enter it below.
                      </span>
                    </div>
                  )}

                  {otpSent && (
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Enter 6-Digit OTP Code *
                      </label>
                      <input
                        required
                        type="text"
                        maxLength={6}
                        placeholder="• • • • • •"
                        value={regOtpCode}
                        onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, ""))}
                        className="w-full sm:w-48 px-3.5 py-2.5 border border-slate-300 rounded-lg text-lg text-center tracking-widest font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={authLoading || !otpSent}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
                >
                  <span>{authLoading ? "Verifying..." : "Verify OTP & Complete Candidate Registration"}</span>
                  <span>→</span>
                </button>
              </form>
            )}

            {/* TAB CONTENT: LOGIN */}
            {authTab === "LOGIN" && (
              <form onSubmit={handleCandidateLogin} className="p-6 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Sign In to Your Candidate Account</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter your registered email and password to track application status or apply for open vacancies.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Email Address *
                    </label>
                    <input
                      required
                      type="email"
                      placeholder="e.g. ramesh@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Password *
                    </label>
                    <PasswordInput
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab("FORGOT");
                          setResetEmail(loginEmail);
                          setResetOtpCode("");
                          setResetPassword("");
                          setResetConfirmPassword("");
                          setResetOtpSent(false);
                          setResetCodeStatus("");
                          resetVerifyLock.current = "";
                          setError("");
                          setSuccessMsg("");
                        }}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
                >
                  <span>{authLoading ? "Signing In..." : "Sign In & Proceed"}</span>
                  <span>→</span>
                </button>
              </form>
            )}

            {authTab === "FORGOT" && (
              <form onSubmit={handleResetPassword} className="p-6 sm:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Set a new password</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Use the same Gmail you registered with. The 6-digit code comes in that inbox. Write it in the box below, then type a new password.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    1. Registered Gmail *
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="e.g. ramesh@gmail.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-800">2. Send the Gmail code</div>
                      <div className="text-[11px] text-slate-600">
                        {resetOtpSent
                          ? `Code sent to ${resetEmail}. Open Gmail, then write the 6 digits in the box below. Also check Spam.`
                          : "Click Send code. Then open that Gmail inbox."}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={authLoading || resetCountdown > 0}
                      onClick={handleSendResetOtp}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs whitespace-nowrap transition"
                    >
                      {resetCountdown > 0
                        ? `Resend in ${resetCountdown}s`
                        : resetOtpSent
                        ? "Resend code"
                        : "Send code"}
                    </button>
                  </div>
                  <div>
                    <label htmlFor="reset-otp-code" className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                      3. Write the 6-digit code here *
                    </label>
                    <input
                      id="reset-otp-code"
                      required
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="123456"
                      value={resetOtpCode}
                      onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className={`w-full px-3.5 py-3 border-2 rounded-lg text-2xl text-center tracking-[0.4em] font-mono font-bold bg-white focus:outline-none focus:ring-2 ${
                        resetCodeStatus === "ok"
                          ? "border-emerald-500 focus:ring-emerald-500"
                          : resetCodeStatus === "bad"
                          ? "border-red-400 focus:ring-red-500"
                          : "border-blue-400 focus:ring-blue-500"
                      }`}
                    />
                    <p className="text-[11px] mt-1 font-semibold">
                      {resetCodeStatus === "checking"
                        ? "Checking the code..."
                        : resetCodeStatus === "ok"
                        ? "Code verified. You can set a new password now."
                        : resetCodeStatus === "bad"
                        ? "That code is not correct. Check Gmail and type it again."
                        : "Type all 6 digits. The code is checked automatically."}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    4. New password *
                  </label>
                  <PasswordInput
                    id="reset-new-password"
                    required
                    placeholder="At least 6 characters"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Confirm new password *
                  </label>
                  <PasswordInput
                    required
                    placeholder="Type the new password again"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading || resetCodeStatus !== "ok"}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
                >
                  <span>{authLoading && resetCodeStatus === "ok" ? "Saving..." : "Save new password"}</span>
                  <span>→</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("LOGIN");
                    setError("");
                    setSuccessMsg("");
                  }}
                  className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Back to sign in
                </button>
              </form>
            )}
          </div>
        )}

        {/* =========================================================================
            STATE 2: AUTHENTICATED CANDIDATE -> ROLE SELECTION & FULL APPLICATION FORM
            ========================================================================= */}
        {canFillForm && officeAdmin && !adminFiller.confirmed && (
          <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = adminFiller.name.trim();
                const phone = adminFiller.phone.replace(/\D/g, "").slice(-10);
                if (!name) return setError("Please enter the filling admin name.");
                if (phone.length !== 10) return setError("Please enter a valid 10-digit phone number.");
                setAdminFiller({ name, phone, confirmed: true });
                setError("");
                setStep("ROLE");
              }}
              className="p-6 sm:p-8 space-y-5"
            >
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-950">
                <div className="text-[10px] font-bold uppercase tracking-wide">
                  Form fill up by admin — {adminFiller.name || officeAdmin.name}
                </div>
                <div className="text-xs mt-1">Logged in as {officeAdmin.email || officeAdmin.name}</div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Filling admin details</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  First enter the name and phone number of the office person filling this form. These details will be
                  stamped on the application.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Admin name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={adminFiller.name}
                  onChange={(e) => setAdminFiller({ ...adminFiller, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Name of the person filling this form"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Admin phone no. <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-xs font-mono font-bold">
                    +91
                  </span>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={adminFiller.phone}
                    onChange={(e) =>
                      setAdminFiller({ ...adminFiller, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-r-lg text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
              >
                <span>Continue to application</span>
                <span>→</span>
              </button>
            </form>
          </div>
        )}

        {canFillForm && (!officeAdmin || adminFiller.confirmed) && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-visible">
            {/* Step 1: Role Selection */}
            {step === "ROLE" && (
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  {officeAdmin ? (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 mb-3 text-indigo-950">
                      <div className="text-[10px] font-bold uppercase tracking-wide">
                        Form fill up by admin — {adminFiller.name || officeAdmin.name}
                      </div>
                      <div className="text-sm font-semibold mt-0.5">{adminFiller.name || officeAdmin.name}</div>
                      <div className="text-xs font-mono mt-1">Phone: {adminFiller.phone || "—"}</div>
                      <div className="text-xs font-mono">Email: {officeAdmin.email || "—"}</div>
                      <div className="text-xs font-mono">Admin ID: {officeAdmin.id}</div>
                      <button
                        type="button"
                        onClick={() => setAdminFiller((prev) => ({ ...prev, confirmed: false }))}
                        className="mt-2 text-[11px] font-semibold text-indigo-700 hover:underline"
                      >
                        Change name / phone
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                      Candidate: {candidate?.fullName}
                    </span>
                  )}
                  {!officeAdmin ? <div className="mt-3"><CandidateApplicationsPanel items={myApplications} /></div> : null}
                  <div className="mt-2">
                    <h2 className="text-lg font-bold text-slate-900">Step 1: Select trade / category</h2>
                    <p className="text-xs text-slate-500">
                      Choose Security Guard or Manpower, then pick the category.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[guardRole, manpowerRole].filter(Boolean).map((role) => {
                    const selected = selectedRole?.id === role?.id;
                    return (
                      <button
                        key={role!.id}
                        type="button"
                        onClick={() => {
                          setSelectedRole(role);
                          setSelectedCategory(null);
                          setForm((prev) => ({
                            ...prev,
                            gemProfile: "",
                            skillCategory: "",
                            gemExperience: "",
                            otherCategory: "",
                          }));
                        }}
                        className={`text-left rounded-2xl border-2 p-5 transition ${
                          selected
                            ? "border-blue-600 bg-blue-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-blue-300"
                        }`}
                      >
                        <div className="text-sm font-bold text-slate-900">{role!.name}</div>
                        <p className="text-xs text-slate-500 mt-1">
                          {isSecurityGuardRole(role)
                            ? "Civilian, Ex-serviceman, Lady Guard, Gunman, Others"
                            : "Office, trades, helpers and other manpower work"}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {isSecurityGuardRole(selectedRole) ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Security Guard category <span className="text-red-600">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(selectedRole?.categories || []).map((cat) => {
                        const active = selectedCategory?.id === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(cat);
                              setForm((prev) => ({
                                ...prev,
                                otherCategory: isOthersChoice(cat) ? prev.otherCategory : "",
                              }));
                            }}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                              active
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                            }`}
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                    {isOthersChoice(selectedCategory) ? (
                      <div className="mt-3">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Specify category <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.otherCategory}
                          onChange={(e) => setForm({ ...form, otherCategory: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="Type the category"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isManpowerRole(selectedRole) ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Skill category <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={form.skillCategory}
                        onChange={(e) => setForm({ ...form, skillCategory: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                      >
                        <option value="">Select skill</option>
                        {GEM_SKILL_CATEGORIES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Manpower profile <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={form.gemProfile}
                        onChange={(e) => {
                          const gemProfile = e.target.value;
                          const match =
                            manpowerCategories.find((cat) => cat.name === gemProfile) ||
                            (gemProfile === "Others" ? manpowerOthers : null) ||
                            manpowerOthers;
                          setForm({
                            ...form,
                            gemProfile,
                            otherCategory: gemProfile === "Others" ? form.otherCategory : "",
                          });
                          setSelectedCategory(match || null);
                        }}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                      >
                        <option value="">Select profile</option>
                        {GEM_MANPOWER_PROFILES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      {form.gemProfile === "Others" ? (
                        <div className="mt-3">
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Specify category <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.otherCategory}
                            onChange={(e) => setForm({ ...form, otherCategory: e.target.value })}
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                            placeholder="Type the category"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Experience <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={form.gemExperience}
                        onChange={(e) => setForm({ ...form, gemExperience: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                      >
                        <option value="">Select experience</option>
                        {GEM_EXPERIENCE_BANDS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedRole) return setError("Please select Security Guard or Manpower.");
                    if (isSecurityGuardRole(selectedRole) && !selectedCategory) {
                      return setError("Please select a Security Guard category.");
                    }
                    if (isSecurityGuardRole(selectedRole) && isOthersChoice(selectedCategory) && !form.otherCategory.trim()) {
                      return setError("Please type the category for Others.");
                    }
                    let nextCategory = selectedCategory;
                    if (isManpowerRole(selectedRole)) {
                      if (!form.skillCategory) return setError("Please select skill category.");
                      if (!form.gemProfile) return setError("Please select a manpower profile.");
                      if (form.gemProfile === "Others" && !form.otherCategory.trim()) {
                        return setError("Please type the category for Others.");
                      }
                      if (!form.gemExperience) return setError("Please select experience.");
                      const category =
                        selectedCategory ||
                        manpowerCategories.find((cat) => cat.name === form.gemProfile) ||
                        manpowerOthers;
                      if (!category) return setError("Please select a manpower profile.");
                      nextCategory = category;
                      setSelectedCategory(category);
                    }
                    const extra = (
                      isManpowerRole(selectedRole)
                        ? form.gemProfile === "Others"
                          ? form.otherCategory
                          : form.gemProfile
                        : form.otherCategory
                    )
                      .trim()
                      .toLowerCase();
                    const already = myApplications.some(
                      (app) =>
                        app.jobRoleId === selectedRole.id &&
                        (!nextCategory?.id || app.roleCategoryId === nextCategory.id) &&
                        String(app.extra || "").toLowerCase() === extra,
                    );
                    if (already) {
                      return setError("You already applied for this same trade and category. Please choose a different one.");
                    }
                    setError("");
                    setStep("FORM");
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
                >
                  <span>Continue to Complete Application Form</span>
                  <span>→</span>
                </button>
              </div>
            )}

            {/* Step 2: The Complete Application Form with ALL Details */}
            {step === "FORM" && (
              <form onSubmit={handleSubmitApplication} className="p-6 sm:p-8 space-y-8">
                {editApplicantId ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                    <div className="text-[10px] font-bold uppercase tracking-wide">Editing saved application</div>
                    <div className="text-sm font-semibold mt-0.5 font-mono">
                      Application ID: {editingNo || editApplicantId}
                    </div>
                    <p className="text-xs mt-1">
                      Save changes to update this same form. The Application ID will stay the same.
                    </p>
                  </div>
                ) : null}
                {/* Header banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider bg-blue-100 text-blue-800 px-2.5 py-1 rounded">
                      Applying for: {selectedRole?.name}
                      {isManpowerRole(selectedRole)
                        ? ` / ${form.gemProfile === "Others" ? form.otherCategory.trim() || "Others" : form.gemProfile || selectedCategory?.name || "Others"}`
                        : selectedCategory?.name
                          ? ` (${isOthersChoice(selectedCategory) ? form.otherCategory.trim() || "Others" : selectedCategory.name})`
                          : ""}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">Official Job Application Form</h2>
                    <p className="text-xs text-slate-500">
                      Please fill every section with accurate legal details. Mandatory fields are marked with *.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("ROLE")}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    ← Change trade / category
                  </button>
                </div>

                {officeAdmin ? (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-950">
                    <div className="text-[10px] font-bold uppercase tracking-wide">
                      Form fill up by admin — {adminFiller.name || officeAdmin.name}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs mt-2">
                      <div>
                        <span className="block uppercase font-bold text-[10px] text-indigo-700">Admin name</span>
                        <span className="font-bold">{adminFiller.name || officeAdmin.name}</span>
                      </div>
                      <div>
                        <span className="block uppercase font-bold text-[10px] text-indigo-700">Admin phone</span>
                        <span className="font-mono">{adminFiller.phone || "—"}</span>
                      </div>
                      <div>
                        <span className="block uppercase font-bold text-[10px] text-indigo-700">Admin email</span>
                        <span className="font-mono">{officeAdmin.email || "—"}</span>
                      </div>
                      <div>
                        <span className="block uppercase font-bold text-[10px] text-indigo-700">Admin ID</span>
                        <span className="font-mono">{officeAdmin.id}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-3 text-xs">
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[10px]">Registered Name</span>
                      <span className="font-bold text-slate-900">{candidate?.fullName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[10px]">Account Email</span>
                      <span className="font-medium text-slate-900">{candidate?.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase font-bold text-[10px]">Verified Mobile</span>
                      <span className="font-mono font-semibold text-emerald-700">+91 {candidate?.whatsappNo} ✓</span>
                    </div>
                  </div>
                )}

                {/* SECTION 1: APPLICATION / PERSONAL DETAILS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Application & Personal Details
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_5.5rem_7rem]">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Date of Birth <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="date"
                          value={form.dateOfBirth}
                          onChange={(e) => handleDobChange(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Age <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.age}
                          onChange={(e) => setForm({ ...form, age: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="28"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Gender <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={form.gender}
                          onChange={(e) => setForm({ ...form, gender: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Father / Husband Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.fatherOrHusband}
                        onChange={(e) => setForm({ ...form, fatherOrHusband: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Father's or Husband's Full Name"
                      />
                    </div>

                    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-800">
                        Present Residential Address <span className="text-red-500">*</span>
                      </div>
                      <AddressInput
                        label="Vill. / Locality"
                        value={form.presentAddress}
                        onChange={(value) => updatePresent("presentAddress", value)}
                        placeholder="House / street / locality"
                      />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <AddressInput
                          label="P.O."
                          value={form.presentPO}
                          onChange={(value) => updatePresent("presentPO", value)}
                          placeholder="Post office"
                        />
                        <AddressInput
                          label="P.S."
                          value={form.presentPS}
                          onChange={(value) => updatePresent("presentPS", value)}
                          placeholder="Police station"
                        />
                      </div>
                      <PlaceFields
                        pin={form.presentPin}
                        district={form.presentDistrict}
                        state={form.presentState}
                        onPin={(value) => updatePresent("presentPin", value)}
                        onDistrict={(value) => updatePresent("presentDistrict", value)}
                        onState={(value) => updatePresent("presentState", value)}
                      />
                      <label className="flex items-center gap-2 pt-1 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(form.sameAsPresent)}
                          onChange={(e) => {
                            const sameAsPresent = e.target.checked;
                            setForm((prev) => {
                              const next = { ...prev, sameAsPresent };
                              return sameAsPresent ? copyPresentToPermanent(next) : next;
                            });
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600"
                        />
                        Permanent address same as present
                      </label>
                    </div>

                    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-800">
                        Permanent Residential Address <span className="text-red-500">*</span>
                      </div>
                      <AddressInput
                        label="Vill. / Locality"
                        value={form.permanentAddress}
                        onChange={(value) => setForm({ ...form, permanentAddress: value, sameAsPresent: false })}
                        placeholder="Village / town / locality"
                        required={!form.sameAsPresent}
                        disabled={form.sameAsPresent}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <AddressInput
                          label="P.O."
                          value={form.permanentPO}
                          onChange={(value) => setForm({ ...form, permanentPO: value, sameAsPresent: false })}
                          placeholder="Post office"
                          required={!form.sameAsPresent}
                          disabled={form.sameAsPresent}
                        />
                        <AddressInput
                          label="P.S."
                          value={form.permanentPS}
                          onChange={(value) => setForm({ ...form, permanentPS: value, sameAsPresent: false })}
                          placeholder="Police station"
                          required={!form.sameAsPresent}
                          disabled={form.sameAsPresent}
                        />
                      </div>
                      <PlaceFields
                        pin={form.permanentPin}
                        district={form.permanentDistrict}
                        state={form.permanentState}
                        required={!form.sameAsPresent}
                        disabled={form.sameAsPresent}
                        onPin={(value) => setForm({ ...form, permanentPin: value, sameAsPresent: false })}
                        onDistrict={(value) => setForm({ ...form, permanentDistrict: value, sameAsPresent: false })}
                        onState={(value) => setForm({ ...form, permanentState: value, sameAsPresent: false })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Educational Qualification <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={form.qualification}
                        onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select qualification</option>
                        {QUALIFICATION_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      {form.qualification === "Other" ? (
                        <input
                          required
                          type="text"
                          value={form.qualificationOther}
                          onChange={(e) => setForm({ ...form, qualificationOther: e.target.value })}
                          className="w-full mt-2 px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="Please enter qualification"
                        />
                      ) : null}
                      <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">
                        Education qualification certificate <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="file"
                        accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                        required={!form.educationFileName}
                        onChange={(e) => handleFileUpload(e, "educationFile", "educationFileName")}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                      />
                      {form.educationFileName ? (
                        <div className="text-[11px] text-emerald-700 font-semibold mt-1 truncate">
                          {attachedNote(form.educationFileName, form.educationFile)}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Other qualification
                      </label>
                      <input
                        type="text"
                        value={form.otherQualification}
                        onChange={(e) => setForm({ ...form, otherQualification: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Driving licence, computer course"
                      />
                      <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">
                        Other qualification certificate
                      </label>
                      <input
                        type="file"
                        accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                        onChange={(e) => handleFileUpload(e, "otherQualFile", "otherQualFileName")}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                      />
                      {form.otherQualFileName ? (
                        <div className="text-[11px] text-emerald-700 font-semibold mt-1 truncate">
                          {attachedNote(form.otherQualFileName, form.otherQualFile)}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Identification Mark <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.identificationMark}
                        onChange={(e) => setForm({ ...form, identificationMark: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Mole on left side of neck"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nationality <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.nationality}
                          onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Religion <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={form.religion}
                          onChange={(e) => setForm({ ...form, religion: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Religion</option>
                          <option value="Hindu">Hindu</option>
                          <option value="Muslim">Muslim</option>
                          <option value="Christian">Christian</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Reference (Name & Relation) <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.reference}
                          onChange={(e) => setForm({ ...form, reference: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. Kakoli Mondal, wife, 9876543210"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Known since (years) <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          inputMode="numeric"
                          value={form.referenceYears}
                          onChange={(e) =>
                            setForm({ ...form, referenceYears: e.target.value.replace(/\D/g, "").slice(0, 2) })
                          }
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. 8"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Height <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            required
                            value={form.heightUnit}
                            onChange={(e) => setForm({ ...form, heightUnit: e.target.value })}
                            className="px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          >
                            <option value="cm">cm</option>
                            <option value="ft">foot</option>
                          </select>
                          {form.heightUnit === "cm" ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                required
                                type="text"
                                inputMode="decimal"
                                value={form.heightCm}
                                onChange={(e) => setForm({ ...form, heightCm: e.target.value.replace(/[^\d.]/g, "") })}
                                className="w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                                placeholder="172"
                              />
                              <span className="text-xs font-semibold text-slate-600">cm</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <input
                                required
                                type="text"
                                inputMode="numeric"
                                value={form.heightFt}
                                onChange={(e) => setForm({ ...form, heightFt: e.target.value.replace(/\D/g, "") })}
                                className="w-14 px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                                placeholder="5"
                              />
                              <span className="text-xs font-semibold text-slate-600">ft</span>
                              <input
                                required
                                type="text"
                                inputMode="numeric"
                                value={form.heightInch}
                                onChange={(e) => setForm({ ...form, heightInch: e.target.value.replace(/\D/g, "") })}
                                className="w-14 px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                                placeholder="8"
                              />
                              <span className="text-xs font-semibold text-slate-600">inch</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Weight (kg) <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.weight}
                          onChange={(e) => setForm({ ...form, weight: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="e.g. 68"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nominee Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.nominee}
                          onChange={(e) => setForm({ ...form, nominee: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="Nominee name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Relation <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.nomineeRelation}
                          onChange={(e) => setForm({ ...form, nomineeRelation: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="e.g. Wife / Father / Son"
                        />
                      </div>
                    </div>

                    {/* Passport Photo Upload */}
                    <div className="sm:col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-4">
                      {form.photo ? (
                        <img
                          src={form.photo}
                          alt="Applicant Passport Preview"
                          className="w-20 h-24 object-cover rounded border border-slate-300 shadow-xs"
                        />
                      ) : (
                        <div className="w-20 h-24 rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs text-center p-1 bg-white">
                          Passport Photo
                        </div>
                      )}
                      <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Upload Passport-Size Photo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          required={!form.photoName}
                          onChange={(e) => handleFileUpload(e, "photo", "photoName")}
                          className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                        />
                        {form.photoName && (
                          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                            {attachedNote(form.photoName, form.photo)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: EX-SERVICEMAN — only for Security Guard / Ex-serviceman */}
                {isExServiceCategory ? (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Ex-serviceman details
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ex-Serviceman No. <span className="text-red-600">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.exServiceNo === "NA" ? "" : form.exServiceNo}
                        onChange={(e) => setForm({ ...form, exServiceNo: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        placeholder="e.g. 1482937-H"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Rank <span className="text-red-600">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.exRank === "NA" ? "" : form.exRank}
                        onChange={(e) => setForm({ ...form, exRank: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        placeholder="e.g. Havildar / Naik"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Discharge Date <span className="text-red-600">*</span>
                      </label>
                      <input
                        required
                        type="date"
                        value={form.exDischargeDate}
                        onChange={(e) => setForm({ ...form, exDischargeDate: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Discharge Book No. <span className="text-red-600">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.exDischargeBook === "NA" ? "" : form.exDischargeBook}
                        onChange={(e) => setForm({ ...form, exDischargeBook: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        placeholder="Discharge book number"
                      />
                    </div>
                  </div>
                </div>
                ) : null}

                {/* SECTION 3: GUN LICENCE (ARMED ROLES) */}
                {(isGunRole || form.gunLicence !== "NA") && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
                        3
                      </span>
                      <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
                        Gun Licence & Arms Information
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Gun Licence Number <span className="text-red-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.gunLicence}
                          onChange={(e) => setForm({ ...form, gunLicence: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="e.g. ARMS/WB/2021/829 or NA"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Gun Serial Number <span className="text-red-600">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.gunNo}
                          onChange={(e) => setForm({ ...form, gunNo: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="e.g. DBBL 12 BORE 92837 or NA"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 3: EXPERIENCE / PF / ESI */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Experience, PF & ESI
                    </h3>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-4">
                    <div>
                      <p className="block text-xs font-bold text-slate-700 mb-2">
                        Experience, if any <span className="text-red-500">*</span>
                      </p>
                      <div className="flex flex-wrap gap-8">
                        {(["FRESHER", "EXPERIENCED"] as const).map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                            <input
                              type="radio"
                              name="experienceType"
                              value={opt}
                              checked={form.experienceType === opt}
                              onChange={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  experienceType: opt,
                                  previousEmployer: opt === "FRESHER" ? "None" : prev.previousEmployer === "None" ? "" : prev.previousEmployer,
                                  workHistory: opt === "EXPERIENCED" ? jobList(prev.workHistory) : [blankJob()],
                                }))
                              }
                              className="w-4 h-4 border-slate-400 text-blue-600"
                              required
                            />
                            {opt === "FRESHER" ? "Fresher" : "Experienced"}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs font-bold uppercase tracking-wide text-slate-800">Previous Employees Details</div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        a) Name of Previous Employer <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.experienceType === "FRESHER" ? "None" : form.previousEmployer === "None" ? "" : form.previousEmployer}
                        readOnly={form.experienceType === "FRESHER"}
                        onChange={(e) => {
                          const previousEmployer = e.target.value;
                          setForm((prev) => {
                            const jobs = jobList(prev.workHistory);
                            const nextJobs = jobs.length ? [{ ...jobs[0], employer: previousEmployer }, ...jobs.slice(1)] : [{ ...blankJob(), employer: previousEmployer }];
                            return { ...prev, previousEmployer, workHistory: nextJobs };
                          });
                        }}
                        className={`w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm ${form.experienceType === "FRESHER" ? "bg-slate-50" : "bg-white"}`}
                        placeholder={form.experienceType === "FRESHER" ? "None" : "Company name"}
                      />
                    </div>

                    {form.experienceType === "EXPERIENCED" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <label className="block text-xs font-bold text-slate-700">
                            Work / post and period <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={addWorkJob}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800"
                          >
                            + Add more
                          </button>
                        </div>
                        {jobList(form.workHistory).map((job, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative"
                          >
                            {jobList(form.workHistory).length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeWorkJob(idx)}
                                className="absolute top-2 right-2 text-[11px] font-bold text-rose-600"
                              >
                                Remove
                              </button>
                            ) : null}
                            {idx > 0 ? (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                  Employer / company *
                                </label>
                                <input
                                  required
                                  type="text"
                                  value={job.employer}
                                  onChange={(e) => updateWorkJob(idx, "employer", e.target.value)}
                                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                                  placeholder="Company name"
                                />
                              </div>
                            ) : null}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Work / post *
                              </label>
                              <input
                                required
                                type="text"
                                value={job.job}
                                onChange={(e) => updateWorkJob(idx, "job", e.target.value)}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                                placeholder="e.g. Security Guard"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                From *
                              </label>
                              <input
                                required
                                type="month"
                                value={job.from}
                                onChange={(e) => updateWorkJob(idx, "from", e.target.value)}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                To *
                              </label>
                              <input
                                required
                                type="month"
                                value={job.to}
                                onChange={(e) => updateWorkJob(idx, "to", e.target.value)}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          b) UAN No. / PF (if allotted) <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.uan}
                          onChange={(e) => setForm({ ...form, uan: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="12-digit UAN or NA"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          c) ESI IP No. <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.esiIp}
                          onChange={(e) => setForm({ ...form, esiIp: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="ESI IP Number or NA"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Preferred ESI Dispensary <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.preferredDispensary}
                          onChange={(e) => setForm({ ...form, preferredDispensary: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="e.g. New Town / Barasat / Salt Lake, or NA"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 4: DECLARATION & STATUTORY DETAILS */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      4
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Statutory Identification
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contact Mobile <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="tel"
                        maxLength={10}
                        value={form.mobile}
                        onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white"
                        placeholder="10-digit mobile"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Emergency contact no. <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="tel"
                        maxLength={10}
                        value={form.emergencyContact}
                        onChange={(e) => setForm({ ...form, emergencyContact: e.target.value.replace(/\D/g, "") })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white"
                        placeholder="10-digit emergency number"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Applicant email <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        placeholder="applicant@email.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Aadhaar Number (12 Digits) <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        maxLength={12}
                        value={form.aadhaar}
                        onChange={(e) => setForm({ ...form, aadhaar: e.target.value.replace(/\D/g, "") })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white"
                        placeholder="12 digit Aadhaar"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        PAN Card Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        maxLength={10}
                        value={form.pan}
                        onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white"
                        placeholder="e.g. ABCDE1234F"
                      />
                    </div>

                  </div>
                </div>

                {/* SECTION 5: FAMILY MEMBERS */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                        5
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Family Member Details
                      </h3>
                    </div>
                    {form.includeFamily === "YES" ? (
                      <button
                        type="button"
                        onClick={addFamilyMember}
                        disabled={form.family.length >= 5}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 disabled:opacity-40"
                      >
                        + Add Member
                      </button>
                    ) : null}
                  </div>

                  <YesNoRadios
                    name="includeFamily"
                    label="Do you want to add family member details?"
                    value={form.includeFamily}
                    onChange={(includeFamily) =>
                      setForm((prev) => ({
                        ...prev,
                        includeFamily,
                        family: includeFamily === "YES" ? prev.family : blankFamily(),
                      }))
                    }
                  />

                  {form.includeFamily === "YES" ? (
                    <div className="space-y-3">
                      {form.family.map((member, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs relative"
                        >
                          {form.family.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeFamilyMember(idx)}
                              className="absolute top-2 right-2 text-[11px] font-bold text-rose-600"
                            >
                              Remove
                            </button>
                          ) : null}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              {idx + 1}. Member Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              required
                              type="text"
                              placeholder="Full Name"
                              value={member.name}
                              onChange={(e) => updateFamilyMember(idx, "name", e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Relation <span className="text-red-500">*</span>
                            </label>
                            <input
                              required
                              type="text"
                              placeholder="e.g. Father, Mother, Spouse, Son"
                              value={member.relation}
                              onChange={(e) => updateFamilyMember(idx, "relation", e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Date of Birth <span className="text-red-500">*</span>
                            </label>
                            <input
                              required
                              type="date"
                              value={member.dateOfBirth}
                              onChange={(e) => updateFamilyMember(idx, "dateOfBirth", e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Aadhaar No. <span className="text-red-500">*</span>
                            </label>
                            <input
                              required
                              type="text"
                              maxLength={12}
                              placeholder="12 digits"
                              value={member.aadhaar}
                              onChange={(e) => updateFamilyMember(idx, "aadhaar", e.target.value.replace(/\D/g, ""))}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* SECTION 6: BANK DETAILS — optional now, required after selection */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      6
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Bank Account Details (For Wage Credit)
                    </h3>
                  </div>
                  <YesNoRadios
                    name="uploadBankDetails"
                    label="Willing to upload bank details now?"
                    value={form.uploadBankDetails}
                    onChange={(uploadBankDetails) =>
                      setForm((prev) => ({
                        ...prev,
                        uploadBankDetails,
                        ...(uploadBankDetails === "NO"
                          ? {
                              bankName: "",
                              accountNo: "",
                              ifsc: "",
                              branchName: "",
                              passbookFile: "",
                              passbookFileName: "",
                            }
                          : {}),
                      }))
                    }
                  />
                  <p className="text-[11px] text-slate-500 -mt-2">
                    You may upload now, or wait until you are selected. Bank details are required only after approval.
                  </p>
                  {form.uploadBankDetails === "YES" ? (
                    <div className="grid gap-4 sm:grid-cols-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Bank name <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.bankName}
                          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="e.g. State Bank of India"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Account number <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.accountNo}
                          onChange={(e) => setForm({ ...form, accountNo: e.target.value.replace(/\D/g, "") })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white font-mono"
                          placeholder="Account number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          IFSC code <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.ifsc}
                          onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white font-mono"
                          placeholder="e.g. SBIN0001234"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Branch name &amp; address <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.branchName}
                          onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="e.g. Bowbazar Branch, 12 B.B. Ganguly Street, Kolkata"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Bank passbook / cancelled cheque <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="file"
                          accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                          required={!form.passbookFileName}
                          onChange={(e) => handleFileUpload(e, "passbookFile", "passbookFileName")}
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                        />
                        {form.passbookFileName ? (
                          <div className="text-[11px] text-emerald-700 font-semibold mt-1 truncate">
                            {attachedNote(form.passbookFileName, form.passbookFile)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : form.uploadBankDetails === "NO" ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      Bank details will be taken after you are selected and made an employee.
                    </div>
                  ) : null}
                </div>

                {/* SECTION 7: VERIFICATION & DEPOSIT */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      7
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Police Verification & Security Deposit
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Police Verification Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={form.policeStatus}
                        onChange={(e) => setForm({ ...form, policeStatus: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      {form.policeStatus === "verified" ? (
                        <div className="mt-3">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Police verification document <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="file"
                            accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                            required={!form.policeFileName}
                            onChange={(e) => handleFileUpload(e, "policeFile", "policeFileName")}
                            className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                          />
                          {form.policeFileName ? (
                            <div className="text-[11px] text-emerald-700 font-semibold mt-1 truncate">
                              {attachedNote(form.policeFileName, form.policeFile)}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Upload the police verification certificate or proof.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Security Money Deposit
                      </label>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950">
                        <p className="font-bold text-[11px] uppercase tracking-wide mb-0.5">Note</p>
                        <p>The security deposit is collected only after you are selected.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 8: DOCUMENTS UPLOAD */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      8
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Required Document Uploads
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-slate-800">
                        Aadhaar Card <span className="text-red-500">*</span>
                      </div>
                      <input
                        type="file"
                        accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                        required={!form.aadhaarFileName}
                        onChange={(e) => handleFileUpload(e, "aadhaarFile", "aadhaarFileName")}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                      />
                      {form.aadhaarFileName && (
                        <div className="text-[11px] text-emerald-700 font-semibold truncate">
                          {attachedNote(form.aadhaarFileName, form.aadhaarFile)}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-slate-800">
                        PAN Card <span className="text-red-500">*</span>
                      </div>
                      <input
                        type="file"
                        accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                        required={!form.panFileName}
                        onChange={(e) => handleFileUpload(e, "panFile", "panFileName")}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                      />
                      {form.panFileName && (
                        <div className="text-[11px] text-emerald-700 font-semibold truncate">
                          {attachedNote(form.panFileName, form.panFile)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION 9: LEGAL DECLARATIONS & TERMS ACCEPTANCE */}
                <div className="space-y-6 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      9
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Legal Undertaking & Joining Terms
                    </h3>
                  </div>

                  {/* Declaration Box */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {DECLARATION.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {DECLARATION.points.length} Clauses
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 italic">{DECLARATION.intro}</p>
                    <div className="max-h-48 overflow-y-auto text-xs text-slate-600 space-y-1.5 p-3 bg-white rounded-lg border border-slate-200 pr-2">
                      <ol className="list-decimal list-inside space-y-1">
                        {DECLARATION.points.map((point: string, i: number) => (
                          <li key={i} className="leading-relaxed">
                            {point}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={form.declarationAccepted}
                        onChange={(e) => setForm({ ...form, declarationAccepted: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        I have read the declaration and I accept it <span className="text-red-500">*</span>
                      </span>
                    </label>
                  </div>

                  {/* Terms and Conditions Box */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {TERMS.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {TERMS.points.length} Clauses
                      </span>
                    </div>
                    {TERMS.note && <p className="text-xs text-slate-600 italic">{TERMS.note}</p>}
                    <div className="max-h-48 overflow-y-auto text-xs text-slate-600 space-y-1.5 p-3 bg-white rounded-lg border border-slate-200 pr-2">
                      <ol className="list-decimal list-inside space-y-1">
                        {TERMS.points.map((point: string, i: number) => (
                          <li key={i} className="leading-relaxed">
                            {point}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={form.termsAccepted}
                        onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        I have read the terms and conditions and I accept them <span className="text-red-500">*</span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Submission Actions */}
                <div className="pt-4 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={submitting || Boolean(compressingLabel)}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
                  >
                    <span>
                      {submitting
                        ? editApplicantId
                          ? "Saving changes..."
                          : "Submitting Official Application..."
                        : editApplicantId
                          ? "Save changes"
                          : "Submit Official Application"}
                    </span>
                    <span>✓</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Success Confirmation */}
            {step === "SUCCESS" && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-black shadow-inner">
                  ✓
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {editApplicantId ? "Application updated" : "Application Successfully Submitted!"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {officeAdmin
                      ? editApplicantId
                        ? "The form was updated and saved in the Applicant Book."
                        : "This form was filled up by admin and saved in the Applicant Book."
                      : "Your candidate profile has been registered in the company's Applicant Book for review and verification."}
                  </p>
                </div>
                {officeAdmin ? (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-left text-xs space-y-1 max-w-sm w-full mx-auto">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                      Form filled up by admin — {adminFiller.name || officeAdmin.name}
                    </div>
                    <div className="font-semibold text-slate-900">{adminFiller.name || officeAdmin.name}</div>
                    <div className="font-mono text-slate-700">Phone: {adminFiller.phone || "—"}</div>
                    <div className="font-mono text-slate-700">Email: {officeAdmin.email || "—"}</div>
                    <div className="font-mono text-slate-700">Admin ID: {officeAdmin.id}</div>
                  </div>
                ) : null}

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl inline-block text-left text-xs space-y-1.5 max-w-sm w-full mx-auto font-mono">
                  <div>
                    <span className="text-slate-500 block">Application ID:</span>
                    <span className="font-bold text-slate-800 break-all">{submittedRef || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Company:</span>
                    <span className="font-bold text-blue-700">{company?.shortName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Role:</span>
                    <span className="font-bold text-slate-800">{selectedRole?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-bold text-amber-600">
                      {candidateStatusLabel(
                        myApplications.find((app) => app.applicationNo === submittedRef || app.id === submittedRef)
                          ?.status || "NEW",
                      )}
                    </span>
                  </div>
                  {(myApplications.find((app) => app.applicationNo === submittedRef || app.id === submittedRef)
                    ?.remarks || []
                  ).map((note, idx) => (
                    <div key={`success-note-${idx}`}>
                      <span className="text-slate-500 block">Office note:</span>
                      <span className="font-semibold text-slate-800 whitespace-pre-wrap">{note.remark}</span>
                    </div>
                  ))}
                </div>

                {!officeAdmin ? (
                  <div className="max-w-2xl w-full mx-auto text-left">
                    <CandidateApplicationsPanel items={myApplications} />
                  </div>
                ) : null}

                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      if (editApplicantId) {
                        window.location.href = `/apply/${companySlug}?fill=admin`;
                        return;
                      }
                      setAdminFiller((prev) => ({ ...prev, confirmed: false }));
                      setSelectedRole(null);
                      setSelectedCategory(null);
                      setStep("ROLE");
                      setSubmittedRef("");
                      setForm(
                        officeAdmin
                          ? initialForm()
                          : prefillRef.current || personPrefillFrom(form, candidate),
                      );
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    {officeAdmin ? "Fill another form" : "Apply for Another Role"}
                  </button>
                  {officeAdmin ? (
                    <Link
                      href={`/${companySlug}/applicants`}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-xs transition"
                    >
                      Back to New applicant
                    </Link>
                  ) : (
                    <button
                      onClick={handleSignOut}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-xs transition"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<ApplyLoading />}>
      <ApplyPageInner />
    </Suspense>
  );
}
