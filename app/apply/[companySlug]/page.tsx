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
  formatDateDmy,
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
import ImageCropDialog from "@/components/ImageCropDialog";
import NkLogo from "@/components/NkLogo";
import { isNkCompany } from "@/lib/nkLogo";
import { NK_DUTY_SITE_OPTIONS, OTHER_SITE_VALUE, dutySiteNameFromChoice } from "@/lib/nkSiteList";
import { DutySiteSelect } from "@/components/admin/DutySiteSelect";

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
    DRAFT: "Draft",
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
  if (status === "DRAFT") return "bg-slate-200 text-slate-800";
  return "bg-amber-100 text-amber-800";
}

function blocksSameRole(status?: string) {
  return status === "NEW" || status === "SHORTLISTED" || status === "APPROVED";
}

function formatApplyDate(value?: string) {
  return formatDateDmy(value);
}

function CandidateApplicationsPanel({
  items,
  onContinueDraft,
}: {
  items: CandidateApplication[];
  onContinueDraft?: (app: CandidateApplication) => void;
}) {
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
              <th className="pb-2 font-semibold"> </th>
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
                  {app.status === "REJECTED" ? (
                    <div className="mt-1 text-[11px] text-slate-600">You can apply again for this role.</div>
                  ) : null}
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
                <td className="py-2">
                  {app.status === "DRAFT" && onContinueDraft ? (
                    <button
                      type="button"
                      onClick={() => onContinueDraft(app)}
                      className="text-[11px] font-bold text-blue-700 hover:underline"
                    >
                      Continue
                    </button>
                  ) : null}
                </td>
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
  contactNo: string;
}

function familyMemberFrom(member?: Partial<FamilyMember> | Record<string, any>): FamilyMember {
  return {
    name: String(member?.name || ""),
    relation: String(member?.relation || ""),
    dateOfBirth: String(member?.dateOfBirth || ""),
    aadhaar: String(member?.aadhaar || "").replace(/\D/g, "").slice(0, 12),
    contactNo: String(member?.contactNo || member?.mobile || member?.phone || "")
      .replace(/\D/g, "")
      .slice(-10),
  };
}

function blankFamily(): FamilyMember[] {
  return [familyMemberFrom()];
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
    preferredSiteCode: "",
    preferredSiteOther: "",
    preferredSiteName: "",
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
  next.family =
    Array.isArray(next.family) && next.family.length ? next.family.map(familyMemberFrom) : blankFamily();
  next.name = String(next.name || account?.fullName || "");
  next.mobile = String(next.mobile || account?.whatsappNo || "");
  next.email = String(account?.email || next.email || "");
  next.preferredSiteCode = String(next.preferredSiteCode || "");
  next.preferredSiteOther = String(next.preferredSiteOther || "");
  next.preferredSiteName = String(
    next.preferredSiteName || dutySiteNameFromChoice(next.preferredSiteCode, next.preferredSiteOther),
  );
  return next;
}

function personEditFrom(source: Record<string, any>) {
  const next: any = { ...initialForm(), ...source };
  next.workHistory = jobList(next.workHistory);
  next.family =
    Array.isArray(next.family) && next.family.length ? next.family.map(familyMemberFrom) : blankFamily();
  next.declarationAccepted = true;
  next.termsAccepted = true;
  return next;
}

function personResumeFrom(source: Record<string, any>, account?: CandidateSession | null) {
  const next: any = { ...initialForm(), ...source };
  next.workHistory = jobList(next.workHistory);
  next.family =
    Array.isArray(next.family) && next.family.length ? next.family.map(familyMemberFrom) : blankFamily();
  next.declarationAccepted = Boolean(source.declarationAccepted);
  next.termsAccepted = Boolean(source.termsAccepted);
  next.name = String(next.name || account?.fullName || "");
  next.mobile = String(next.mobile || account?.whatsappNo || "");
  next.email = String(account?.email || next.email || "");
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


const fieldCls =
  "w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600";

function FormSection({
  no,
  title,
  note,
  children,
  tone = "blue",
}: {
  no: string;
  title: string;
  note?: string;
  children: React.ReactNode;
  tone?: "blue" | "amber";
}) {
  const badge = tone === "amber" ? "bg-amber-600" : "bg-blue-700";
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)] overflow-hidden">
      <div className="flex items-start gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/40">
        <span
          className={`mt-0.5 w-8 h-8 rounded-full ${badge} text-white text-sm font-black flex items-center justify-center shadow-sm shrink-0`}
        >
          {no}
        </span>
        <div className="min-w-0">
          <h3 className="text-[13px] font-black tracking-wide text-slate-900 uppercase">{title}</h3>
          {note ? <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{note}</p> : null}
        </div>
      </div>
      <div className="p-4 sm:p-6 space-y-4">{children}</div>
    </section>
  );
}

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
      <div className="apply-yesno flex flex-wrap gap-2">
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
  const [imageCrop, setImageCrop] = useState<{
    src: string;
    file: File;
    dataKey:
      | "photo"
      | "aadhaarFile"
      | "panFile"
      | "passbookFile"
      | "educationFile"
      | "otherQualFile"
      | "policeFile";
    nameKey:
      | "photoName"
      | "aadhaarFileName"
      | "panFileName"
      | "passbookFileName"
      | "educationFileName"
      | "otherQualFileName"
      | "policeFileName";
    title: string;
    aspect: number;
    fit: "cover" | "contain";
    mode: "photo" | "document";
  } | null>(null);
  const [savedDraftId, setSavedDraftId] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftStatus, setDraftStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "unsaved">("idle");
  const handleSaveDraftRef = useRef<(silent?: boolean) => Promise<boolean>>(async () => false);
  const lastSavedFingerprintRef = useRef("");
  const pendingAutoSaveRef = useRef(false);
  const savedDraftIdRef = useRef("");
  const submittedLockRef = useRef(false);
  const draftSavePromiseRef = useRef<Promise<boolean> | null>(null);

  function rememberDraftId(id: string) {
    savedDraftIdRef.current = id;
    setSavedDraftId(id);
  }
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
        const officeRoles = [
          "SUPER_ADMIN",
          "COMPANY_ADMIN",
          "ACCOUNTS",
          "BACK_OFFICE",
          "SUPERVISOR",
          "GROUND_STAFF",
          "TECHNICAL_STAFF",
        ];
        if (!officeRoles.includes(role)) return;
        if (role !== "SUPER_ADMIN" && user.companySlug && user.companySlug !== companySlug) return;
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
        setForm(
          application.status === "DRAFT"
            ? personResumeFrom(application.prefill || {})
            : personEditFrom(application.prefill || {}),
        );
        rememberDraftId(application.status === "DRAFT" ? application.id : "");
        submittedLockRef.current = application.status !== "DRAFT";
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
    if (step !== "FORM") return;
    if (submittedLockRef.current) return;
    if (editApplicantId && !savedDraftId) return;
    if (!selectedRole?.id || !selectedCategory?.id) return;
    setDraftStatus((prev) => (prev === "saving" ? prev : "dirty"));
    const timer = window.setTimeout(() => {
      void handleSaveDraftRef.current(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [form, selectedRole?.id, selectedCategory?.id, adminFiller, step, editApplicantId, savedDraftId]);

  useEffect(() => {
    const saveNow = () => {
      void handleSaveDraftRef.current(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", saveNow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", saveNow);
    };
  }, []);

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
          email: candidate.email || prev.email || "",
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

    const targetIdentifier = regEmail.trim();
    if (!targetIdentifier || !targetIdentifier.includes("@")) {
      setError("Please enter a valid email address first.");
      return;
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
          channel: "EMAIL",
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
          `Code sent to ${regEmail}. Enter it below.`
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
      setError("Please enter a valid 10-digit mobile number.");
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
          otpChannel: "EMAIL",
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
        email: newSession.email,
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
    const isImage =
      String(file.type || "").startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name || "");
    if (!isPdf && isImage) {
      const src = URL.createObjectURL(file);
      setImageCrop((prev) => {
        if (prev?.src) URL.revokeObjectURL(prev.src);
        return {
          src,
          file,
          dataKey,
          nameKey,
          title: dataKey === "photo" ? "Crop passport photo" : "Crop document",
          aspect: dataKey === "photo" ? 3 / 4 : 0,
          fit: dataKey === "photo" ? "cover" : "contain",
          mode: dataKey === "photo" ? "photo" : "document",
        };
      });
      input.value = "";
      return;
    }
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

  function closeImageCrop() {
    if (imageCrop?.src) URL.revokeObjectURL(imageCrop.src);
    setImageCrop(null);
  }

  function saveCroppedImage(file: File) {
    if (!imageCrop) return;
    const { dataKey, nameKey, src } = imageCrop;
    setImageCrop(null);
    URL.revokeObjectURL(src);
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
        setError(err.message || "Could not save the cropped picture.");
      })
      .finally(() => setCompressingLabel(""));
  }

  function recropFromDataUrl(
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
    dataUrl: string,
    fileName: string,
  ) {
    if (!dataUrl || !dataUrl.startsWith("data:image")) {
      setError("Crop works on a photo. PDF cannot be cropped here.");
      return;
    }
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], fileName || "document.jpg", { type: blob.type || "image/jpeg" });
        const src = URL.createObjectURL(file);
        setImageCrop((prev) => {
          if (prev?.src) URL.revokeObjectURL(prev.src);
          return {
            src,
            file,
            dataKey,
            nameKey,
            title: dataKey === "photo" ? "Crop passport photo" : "Crop document",
            aspect: dataKey === "photo" ? 3 / 4 : 0,
            fit: dataKey === "photo" ? "cover" : "contain",
            mode: dataKey === "photo" ? "photo" : "document",
          };
        });
      })
      .catch(() => setError("Could not open that picture for crop."));
  }

  function useFullCropImage() {
    if (!imageCrop) return;
    const { dataKey, nameKey, src, file } = imageCrop;
    setImageCrop(null);
    URL.revokeObjectURL(src);
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
        setError(err.message || "Could not save that picture.");
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
        family: [...prev.family, familyMemberFrom()],
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
    if (submitting) return;
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
    const applicantEmail = String(candidate?.email || form.email || "").trim().toLowerCase();
    if (!applicantEmail.includes("@")) return setError("Please enter the applicant email address.");
    const preferredSiteName = dutySiteNameFromChoice(form.preferredSiteCode, form.preferredSiteOther);

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
        ? (form.family || [])
            .map((member) => familyMemberFrom(member))
            .filter((member) =>
              [member.name, member.relation, member.dateOfBirth, member.aadhaar, member.contactNo].some((part) =>
                String(part || "").trim(),
              ),
            )
        : [];
    if (form.includeFamily === "YES") {
      if (filledFamily.length === 0) return setError("Please add at least one family member, or select No.");
      const incompleteFamily = filledFamily.find(
        (member) =>
          !member.name.trim() ||
          !member.relation.trim() ||
          !member.dateOfBirth ||
          !member.aadhaar.trim() ||
          member.contactNo.length !== 10,
      );
      if (incompleteFamily) return setError("Please complete the family row you started, including contact no., or remove it.");
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

    if (draftSavePromiseRef.current) {
      await draftSavePromiseRef.current;
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
          preferredSiteCode: form.preferredSiteCode,
          preferredSiteOther: form.preferredSiteCode === OTHER_SITE_VALUE ? form.preferredSiteOther.trim() : "",
          preferredSiteName,
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
          action: editApplicantId && !savedDraftIdRef.current ? "UPDATE_APPLICATION" : "SUBMIT_APPLICATION",
          applicantId: editApplicantId || savedDraftIdRef.current || undefined,
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
      submittedLockRef.current = true;
      pendingAutoSaveRef.current = false;
      rememberDraftId("");
      setSubmittedRef(data.applicationNo || data.id);
      setSuccessMsg("");
      setError("");
      if (!officeAdmin) {
        prefillRef.current = personPrefillFrom(form, candidate);
        setMyApplications((prev) => {
          const rest = prev.filter((app) => {
            if (app.id === data.id) return false;
            if (app.status !== "DRAFT") return true;
            return app.jobRoleId !== selectedRole?.id || app.roleCategoryId !== selectedCategory?.id;
          });
          return [
            {
              id: data.id,
              applicationNo: data.applicationNo || "",
              status: data.status || "NEW",
              createdAt: new Date().toISOString(),
              jobRoleId: selectedRole?.id || "",
              roleCategoryId: selectedCategory?.id || "",
              role: selectedRole?.name || "",
              category: selectedCategory?.name || "",
              extra: form.otherCategory || form.gemProfile || "",
            },
            ...rest,
          ];
        });
      }
      setStep("SUCCESS");
    } catch (err: any) {
      setError(err.message || "The application could not be submitted. Please check the form and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function draftDocuments() {
    return [
      ...(form.photoName ? [{ docType: "PHOTO", fileName: form.photoName, fileData: form.photo }] : []),
      ...(form.aadhaarFileName ? [{ docType: "AADHAAR", fileName: form.aadhaarFileName, fileData: form.aadhaarFile }] : []),
      ...(form.panFileName ? [{ docType: "PAN", fileName: form.panFileName, fileData: form.panFile }] : []),
      ...(form.passbookFileName
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
  }

  async function handleSaveDraft(silent = false) {
    if (submittedLockRef.current) return false;
    if (editApplicantId && !savedDraftIdRef.current) return false;
    if (step !== "FORM") return false;
    if (savingDraft || submitting) {
      if (silent) pendingAutoSaveRef.current = true;
      return false;
    }
    if (!silent) setError("");
    if (compressingLabel) {
      if (!silent) setError("Please wait for the file to finish compressing.");
      if (silent) pendingAutoSaveRef.current = true;
      else setDraftStatus("unsaved");
      return false;
    }
    if (!officeAdmin && !candidate) {
      if (!silent) setError("Please sign in or register before saving a draft.");
      setDraftStatus("unsaved");
      return false;
    }
    if (!selectedRole?.id) {
      if (!silent) setError("Please select a trade first.");
      return false;
    }
    if (!selectedCategory?.id) {
      if (!silent) setError("Please select a job category first.");
      return false;
    }
    if (officeAdmin) {
      const fillerName = adminFiller.name.trim();
      const fillerPhone = adminFiller.phone.replace(/\D/g, "").slice(-10);
      if (!fillerName) {
        if (!silent) setError("Please enter the filling admin name first.");
        setDraftStatus("unsaved");
        return false;
      }
      if (fillerPhone.length !== 10) {
        if (!silent) setError("Please enter the filling admin 10-digit phone number first.");
        setDraftStatus("unsaved");
        return false;
      }
    }

    const fingerprint = JSON.stringify({
      ...formDataWithoutFiles(form),
      jobRoleId: selectedRole.id,
      roleCategoryId: selectedCategory.id,
      photoName: form.photoName,
      aadhaarFileName: form.aadhaarFileName,
      panFileName: form.panFileName,
      passbookFileName: form.passbookFileName,
      educationFileName: form.educationFileName,
      otherQualFileName: form.otherQualFileName,
      policeFileName: form.policeFileName,
    });
    if (silent && fingerprint === lastSavedFingerprintRef.current && savedDraftIdRef.current) {
      setDraftStatus("saved");
      return true;
    }

    setSavingDraft(true);
    setDraftStatus("saving");
    const run = (async () => {
      try {
      const documentsPayload = draftDocuments();
      const preferredSiteName = dutySiteNameFromChoice(form.preferredSiteCode, form.preferredSiteOther);
      const payload = {
        companySlug,
        jobRoleId: selectedRole.id,
        roleCategoryId: selectedCategory.id,
        fullName: form.name.trim(),
        mobile: form.mobile.replace(/\D/g, "").slice(-10),
        email: String(candidate?.email || form.email || "").trim().toLowerCase(),
        fatherOrHusband: form.fatherOrHusband.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender || "",
        presentAddress: form.presentAddress.trim(),
        permanentAddress: form.permanentAddress.trim(),
        aadhaarNumber: form.aadhaar.replace(/\D/g, ""),
        panNumber: form.pan.trim().toUpperCase(),
        exServiceNo: form.exServiceNo.trim(),
        armsLicenseNo: form.gunLicence.trim(),
        formData: {
          ...formDataWithoutFiles(form),
          preferredSiteCode: form.preferredSiteCode,
          preferredSiteOther: form.preferredSiteCode === OTHER_SITE_VALUE ? form.preferredSiteOther.trim() : "",
          preferredSiteName,
          skillCategory: form.skillCategory,
          gemProfile: form.gemProfile,
          gemExperience: form.gemExperience,
          otherCategory: form.otherCategory.trim(),
        },
        documents: documentsPayload.map(({ docType, fileName }) => ({ docType, fileName })),
      };
      const body = new FormData();
      body.append(
        "payload",
        JSON.stringify({
          action: "SAVE_DRAFT",
          applicantId: editApplicantId || savedDraftIdRef.current || undefined,
          data: payload,
          fillByAdmin: Boolean(officeAdmin),
          adminFillerName: officeAdmin ? adminFiller.name.trim() : undefined,
          adminFillerPhone: officeAdmin ? adminFiller.phone.replace(/\D/g, "").slice(-10) : undefined,
        }),
      );
      for (const doc of documentsPayload) {
        if (!doc.fileData) continue;
        body.append(`file:${doc.docType}`, dataUrlToBlob(doc.fileData), doc.fileName);
      }
      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        keepalive: silent,
        body,
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "The draft could not be saved.");
      if (data.status && data.status !== "DRAFT") {
        submittedLockRef.current = true;
        rememberDraftId("");
        setDraftStatus("idle");
        return true;
      }
      rememberDraftId(data.id);
      lastSavedFingerprintRef.current = fingerprint;
      setDraftStatus("saved");
      if (!silent) setSuccessMsg("Draft saved. You can continue this form later.");
      if (!officeAdmin) {
        setMyApplications((prev) => {
          const rest = prev.filter((app) => app.id !== data.id);
          return [
            {
              id: data.id,
              applicationNo: data.applicationNo || "",
              status: "DRAFT",
              createdAt: new Date().toISOString(),
              jobRoleId: selectedRole.id,
              roleCategoryId: selectedCategory.id,
              role: selectedRole.name,
              category: selectedCategory.name,
              extra: form.otherCategory || form.gemProfile || "",
            },
            ...rest,
          ];
        });
      }
      return true;
    } catch (err: any) {
      setDraftStatus("unsaved");
      if (!silent) setError(err.message || "The draft could not be saved.");
      return false;
    } finally {
      setSavingDraft(false);
      if (pendingAutoSaveRef.current && !submittedLockRef.current) {
        pendingAutoSaveRef.current = false;
        window.setTimeout(() => {
          void handleSaveDraftRef.current(true);
        }, 400);
      }
    }
    })();
    draftSavePromiseRef.current = run;
    return run;
  }
  handleSaveDraftRef.current = handleSaveDraft;

  async function resumeOwnApplication(app: CandidateApplication) {
    if (!company) return;
    setError("");
    try {
      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GET_OWN_APPLICATION", applicantId: app.id }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "This draft could not be opened.");
      const application = data.application;
      const role = (company.jobRoles || []).find((item: JobRole) => item.id === application.jobRoleId) || null;
      const category = role?.categories?.find((item) => item.id === application.roleCategoryId) || null;
      setSelectedRole(role);
      setSelectedCategory(category);
      setForm(personResumeFrom(application.prefill || {}, candidate));
      rememberDraftId(application.id);
      submittedLockRef.current = application.status !== "DRAFT";
      setStep("FORM");
    } catch (err: any) {
      setError(err.message || "This draft could not be opened.");
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
  const showGunSection = isGunRole || form.gunLicence !== "NA";
  const sectionNos = (() => {
    let n = 1;
    return {
      personal: String(n++),
      ex: isExServiceCategory ? String(n++) : "",
      gun: showGunSection ? String(n++) : "",
      exp: String(n++),
      contact: String(n++),
      family: String(n++),
      bank: String(n++),
      police: String(n++),
      docs: String(n++),
      legal: String(n++),
    };
  })();
  const guardRole = company?.jobRoles.find((role) => isSecurityGuardRole(role)) || null;
  const manpowerRole = company?.jobRoles.find((role) => isManpowerRole(role)) || null;
  const manpowerCategories = manpowerRole?.categories || [];
  const manpowerOthers =
    manpowerCategories.find((cat) => String(cat.code).toUpperCase() === "OTHERS") || manpowerCategories[0] || null;

  return (
    <div className="apply-shell min-h-screen text-slate-800 flex flex-col">
      {imageCrop ? (
        <ImageCropDialog
          src={imageCrop.src}
          title={imageCrop.title}
          aspect={imageCrop.aspect}
          fit={imageCrop.fit}
          mode={imageCrop.mode}
          allowUseFull={imageCrop.dataKey !== "photo"}
          hint={
            imageCrop.dataKey === "photo"
              ? "Pinch to zoom. Drag to move. Fit the face in the box, then tap Crop & use."
              : "Drag the four sides or corners to cut extra edges. Then tap Crop & use."
          }
          onCancel={closeImageCrop}
          onCrop={saveCroppedImage}
          onUseFull={useFullCropImage}
        />
      ) : null}
      {/* Brand & Auth Header */}
      <header className="bg-white/95 backdrop-blur border-b border-slate-200/80 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-[4.25rem] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isNkCompany(companySlug || company?.slug) ? (
              <NkLogo className="h-11 w-11 rounded-md object-contain bg-black shadow-xs shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center shadow-xs">
                {(company?.shortName || "NK").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "NK"}
              </div>
            )}
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
                    Register with your email. The verification code is sent to email only.
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
                        Mobile Number *
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

                {/* Send / Enter OTP Section */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Email verification code</div>
                      <div className="text-[11px] text-slate-500">
                        {otpSent
                          ? `Verification code sent to ${regEmail}`
                          : "Click Send OTP to receive your 6-digit code by email."}
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
                      <span className="text-sm">✉️</span>
                      <span>
                        A 6-digit verification code was sent to{" "}
                        <strong className="font-mono">{regEmail}</strong>
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
                  Form fill up by admin{adminFiller.name ? ` — ${adminFiller.name}` : ""}
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
          <div className={`overflow-visible ${step === "FORM" ? "" : "bg-white border border-slate-200 rounded-2xl shadow-sm"}`}>
            {/* Step 1: Role Selection */}
            {step === "ROLE" && (
              <div className="overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-blue-800 px-5 sm:px-8 py-5 text-white">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-blue-200 font-bold">
                    Step 1 of 2
                  </p>
                  <h2 className="text-xl sm:text-2xl font-black mt-1 leading-tight">Select trade / category</h2>
                  <p className="text-xs text-blue-100/90 mt-1.5">
                    Choose Security Guard or Manpower, then pick the category.
                  </p>
                </div>
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
                  {!officeAdmin ? (
                    <div className="mt-3">
                      <CandidateApplicationsPanel items={myApplications} onContinueDraft={resumeOwnApplication} />
                    </div>
                  ) : null}
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
                        blocksSameRole(app.status) &&
                        app.jobRoleId === selectedRole.id &&
                        (!nextCategory?.id || app.roleCategoryId === nextCategory.id) &&
                        String(app.extra || "").toLowerCase() === extra,
                    );
                    if (already) {
                      return setError(
                        "You already have an open application for this same trade and category. If it was not selected, you can apply again.",
                      );
                    }
                    setError("");
                    setStep("FORM");
                  }}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black py-3.5 rounded-xl shadow-md transition text-sm tracking-wide"
                >
                  Continue to application form →
                </button>
                </div>
              </div>
            )}

            {/* Step 2: The Complete Application Form with ALL Details */}
            {step === "FORM" && (
              <form onSubmit={handleSubmitApplication} className="apply-form space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)] overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-blue-800 px-5 sm:px-7 py-5 text-white">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-blue-200 font-bold">
                          Step 2 of 2 · Official application
                        </p>
                        <h2 className="text-xl sm:text-2xl font-black mt-1 leading-tight">Job application form</h2>
                        <p className="text-xs text-blue-100/90 mt-1.5 max-w-xl">
                          Fill each box carefully. Fields with <span className="text-red-300 font-bold">*</span> must be filled.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep("ROLE")}
                        className="self-start text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
                      >
                        ← Change trade / category
                      </button>
                    </div>
                    <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-semibold">
                      <span className="text-blue-200">Applying for</span>
                      <span className="truncate">
                        {selectedRole?.name}
                        {isManpowerRole(selectedRole)
                          ? ` / ${form.gemProfile === "Others" ? form.otherCategory.trim() || "Others" : form.gemProfile || selectedCategory?.name || "Others"}`
                          : selectedCategory?.name
                            ? ` (${isOthersChoice(selectedCategory) ? form.otherCategory.trim() || "Others" : selectedCategory.name})`
                            : ""}
                      </span>
                    </div>
                  </div>
                  {editApplicantId ? (
                    <div className="px-5 sm:px-7 py-3 bg-amber-50 border-b border-amber-200 text-amber-950">
                      <div className="text-[10px] font-bold uppercase tracking-wide">Editing saved application</div>
                      <div className="text-sm font-semibold mt-0.5 font-mono">
                        Application ID: {editingNo || editApplicantId}
                      </div>
                      <p className="text-xs mt-1">Save changes to update this same form. The Application ID will stay the same.</p>
                    </div>
                  ) : (
                    <div
                      className={`px-5 sm:px-7 py-2.5 border-b text-xs font-semibold ${
                        draftStatus === "unsaved"
                          ? "bg-red-50 border-red-200 text-red-800"
                          : draftStatus === "saving" || draftStatus === "dirty"
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-emerald-50 border-emerald-200 text-emerald-800"
                      }`}
                    >
                      {draftStatus === "saving"
                        ? "Saving..."
                        : draftStatus === "saved"
                          ? "Saved automatically. You can leave and continue later."
                          : draftStatus === "unsaved"
                            ? "Not saved. Check your internet, then wait a moment or tap Save now."
                            : "This form is saved automatically while you type."}
                    </div>
                  )}
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
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)] p-4 sm:p-5 grid gap-3 sm:grid-cols-3 text-xs">
                    <div>
                      <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wide">Registered name</span>
                      <span className="font-bold text-slate-900">{candidate?.fullName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wide">Account email</span>
                      <span className="font-medium text-slate-900 break-all">{candidate?.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block uppercase font-bold text-[10px] tracking-wide">Mobile number</span>
                      <span className="font-mono font-semibold text-emerald-700">+91 {candidate?.whatsappNo} ✓</span>
                    </div>
                  </div>
                )}

                <FormSection no={sectionNos.personal} title="Personal details" note="Name, address, photo and basic particulars.">

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[minmax(0,2.6fr)_minmax(9.2rem,0.72fr)_4.5rem_6.5rem]">
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

                    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="text-xs font-black uppercase tracking-wide text-slate-800">
                        Present address <span className="text-red-500">*</span>
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

                    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="text-xs font-black uppercase tracking-wide text-slate-800">
                        Permanent address <span className="text-red-500">*</span>
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
                      <p className="text-[11px] text-slate-500 mt-1">Photo: drag four sides to crop. PDF stays as it is.</p>
                      {form.educationFileName ? (
                        <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-2 flex-wrap">
                          <span className="truncate">{attachedNote(form.educationFileName, form.educationFile)}</span>
                          {String(form.educationFile || "").startsWith("data:image") ? (
                            <button
                              type="button"
                              className="text-blue-700 underline font-bold"
                              onClick={() =>
                                recropFromDataUrl("educationFile", "educationFileName", form.educationFile, form.educationFileName)
                              }
                            >
                              Crop
                            </button>
                          ) : null}
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
                        <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-2 flex-wrap">
                          <span className="truncate">{attachedNote(form.otherQualFileName, form.otherQualFile)}</span>
                          {String(form.otherQualFile || "").startsWith("data:image") ? (
                            <button
                              type="button"
                              className="text-blue-700 underline font-bold"
                              onClick={() =>
                                recropFromDataUrl("otherQualFile", "otherQualFileName", form.otherQualFile, form.otherQualFileName)
                              }
                            >
                              Crop
                            </button>
                          ) : null}
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

                    <div className="sm:col-span-2 p-4 bg-gradient-to-r from-slate-50 to-blue-50/50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-4">
                      {form.photo ? (
                        <img
                          src={form.photo}
                          alt="Applicant Passport Preview"
                          className="w-24 h-28 object-cover rounded-lg border-2 border-white shadow-md ring-1 ring-slate-200"
                        />
                      ) : (
                        <div className="w-24 h-28 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[11px] text-center p-2 bg-white">
                          Passport photo
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
                        <p className="text-[11px] text-slate-500 mt-1">
                          On phone: take or choose a photo, then crop the face.
                        </p>
                        {form.photoName && (
                          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                            {attachedNote(form.photoName, form.photo)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </FormSection>

                {isExServiceCategory ? (
                <FormSection no={sectionNos.ex} title="Ex-serviceman details" note="Service number, rank and discharge particulars.">

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
                </FormSection>
                ) : null}

                {showGunSection && (
                  <FormSection no={sectionNos.gun} title="Gun licence & arms" note="Licence and weapon serial number." tone="amber">

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
                  </FormSection>
                )}

                <FormSection no={sectionNos.exp} title="Experience, PF & ESI" note="Work history and statutory numbers. Use NA if not allotted.">

                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-4">
                    <div>
                      <p className="block text-xs font-bold text-slate-700 mb-2">
                        Experience, if any <span className="text-red-500">*</span>
                      </p>
                      <div className="apply-yesno flex flex-wrap gap-2">
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
                </FormSection>

                <FormSection no={sectionNos.contact} title="Contact, IDs & site" note="Mobile, email, emergency number, Aadhaar, PAN and preferred site.">

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
                        Email ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        value={candidate?.email || form.email}
                        readOnly={Boolean(candidate?.email)}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className={`w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white ${
                          candidate?.email ? "bg-slate-50 text-slate-700" : ""
                        }`}
                        placeholder="applicant@email.com"
                      />
                      {candidate?.email ? (
                        <span className="block text-[10px] text-slate-500 mt-1">Filled from your login / registration.</span>
                      ) : null}
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
                        Preferred site location
                      </label>
                      <DutySiteSelect
                        sites={NK_DUTY_SITE_OPTIONS}
                        value={form.preferredSiteCode}
                        otherName={form.preferredSiteOther}
                        onValueChange={(code) =>
                          setForm((prev) => ({
                            ...prev,
                            preferredSiteCode: code,
                            preferredSiteOther: code === OTHER_SITE_VALUE ? prev.preferredSiteOther : "",
                            preferredSiteName: dutySiteNameFromChoice(
                              code,
                              code === OTHER_SITE_VALUE ? prev.preferredSiteOther : "",
                            ),
                          }))
                        }
                        onOtherNameChange={(name) =>
                          setForm((prev) => ({
                            ...prev,
                            preferredSiteOther: name,
                            preferredSiteName: dutySiteNameFromChoice(prev.preferredSiteCode, name),
                          }))
                        }
                        emptyLabel="Select preferred site"
                        selectClassName="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
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
                </FormSection>

                <FormSection no={sectionNos.family} title="Family members" note="Optional. Add family only if you want them on the form.">

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
                          className="p-3.5 pr-16 bg-slate-50/70 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs relative"
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
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Contact no. <span className="text-red-500">*</span>
                            </label>
                            <input
                              required
                              type="tel"
                              maxLength={10}
                              placeholder="10-digit mobile"
                              value={member.contactNo || ""}
                              onChange={(e) =>
                                updateFamilyMember(idx, "contactNo", e.target.value.replace(/\D/g, "").slice(-10))
                              }
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {form.includeFamily === "YES" ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={addFamilyMember}
                        disabled={form.family.length >= 5}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40"
                      >
                        + Add member
                      </button>
                    </div>
                  ) : null}
                </FormSection>

                <FormSection no={sectionNos.bank} title="Bank account" note="You may fill this now, or after you are selected.">
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
                          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-2 flex-wrap">
                            <span className="truncate">{attachedNote(form.passbookFileName, form.passbookFile)}</span>
                            {String(form.passbookFile || "").startsWith("data:image") ? (
                              <button
                                type="button"
                                className="text-blue-700 underline font-bold"
                                onClick={() =>
                                  recropFromDataUrl("passbookFile", "passbookFileName", form.passbookFile, form.passbookFileName)
                                }
                              >
                                Crop
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : form.uploadBankDetails === "NO" ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      Bank details will be taken after you are selected and made an employee.
                    </div>
                  ) : null}
                </FormSection>

                <FormSection no={sectionNos.police} title="Police verification" note="Security deposit is taken only after selection.">

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
                            <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-2 flex-wrap">
                              <span className="truncate">{attachedNote(form.policeFileName, form.policeFile)}</span>
                              {String(form.policeFile || "").startsWith("data:image") ? (
                                <button
                                  type="button"
                                  className="text-blue-700 underline font-bold"
                                  onClick={() =>
                                    recropFromDataUrl("policeFile", "policeFileName", form.policeFile, form.policeFileName)
                                  }
                                >
                                  Crop
                                </button>
                              ) : null}
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
                </FormSection>

                <FormSection no={sectionNos.docs} title="Document uploads" note="Aadhaar and PAN copies. Photo or PDF.">

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
                      <p className="text-[11px] text-slate-500">Photo: drag four sides to crop. PDF stays as it is.</p>
                      {form.aadhaarFileName && (
                        <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-2 flex-wrap">
                          <span className="truncate">{attachedNote(form.aadhaarFileName, form.aadhaarFile)}</span>
                          {String(form.aadhaarFile || "").startsWith("data:image") ? (
                            <button
                              type="button"
                              className="text-blue-700 underline font-bold"
                              onClick={() =>
                                recropFromDataUrl("aadhaarFile", "aadhaarFileName", form.aadhaarFile, form.aadhaarFileName)
                              }
                            >
                              Crop
                            </button>
                          ) : null}
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
                      <p className="text-[11px] text-slate-500">Photo: drag four sides to crop. PDF stays as it is.</p>
                      {form.panFileName && (
                        <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-2 flex-wrap">
                          <span className="truncate">{attachedNote(form.panFileName, form.panFile)}</span>
                          {String(form.panFile || "").startsWith("data:image") ? (
                            <button
                              type="button"
                              className="text-blue-700 underline font-bold"
                              onClick={() => recropFromDataUrl("panFile", "panFileName", form.panFile, form.panFileName)}
                            >
                              Crop
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </FormSection>

                <FormSection no={sectionNos.legal} title="Declaration & terms" note="Read both boxes, then tick to accept.">

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
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-blue-300">
                      <input
                        type="checkbox"
                        required
                        checked={form.declarationAccepted}
                        onChange={(e) => setForm({ ...form, declarationAccepted: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
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
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-blue-300">
                      <input
                        type="checkbox"
                        required
                        checked={form.termsAccepted}
                        onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        I have read the terms and conditions and I accept them <span className="text-red-500">*</span>
                      </span>
                    </label>
                  </div>
                </FormSection>

                <div className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-[0_12px_30px_-12px_rgba(15,23,42,0.45)] p-3 sm:p-4 space-y-2">
                  {!editApplicantId || savedDraftId ? (
                    <>
                      <div
                        className={`text-xs font-semibold px-1 ${
                          draftStatus === "unsaved"
                            ? "text-red-700"
                            : draftStatus === "saved"
                              ? "text-emerald-700"
                              : "text-amber-800"
                        }`}
                      >
                        {draftStatus === "saving" || savingDraft
                          ? "Saving..."
                          : draftStatus === "saved"
                            ? "Saved automatically"
                            : draftStatus === "unsaved"
                              ? "Not saved"
                              : "Saving automatically..."}
                      </div>
                      {draftStatus === "unsaved" ? (
                        <button
                          type="button"
                          disabled={savingDraft || submitting || Boolean(compressingLabel)}
                          onClick={() => handleSaveDraft(false)}
                          className="w-full bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-bold py-3 rounded-xl border border-slate-300 transition text-sm"
                        >
                          Save now
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    type="submit"
                    disabled={submitting || savingDraft || Boolean(compressingLabel)}
                    className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-black py-3.5 rounded-xl shadow-md transition text-sm tracking-wide"
                  >
                    {submitting
                      ? editApplicantId && !savedDraftId
                        ? "Saving changes..."
                        : "Submitting application..."
                      : editApplicantId && !savedDraftId
                        ? "Save changes"
                        : "Submit application"}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Success Confirmation */}
            {step === "SUCCESS" && (
              <div className="p-8 text-center space-y-4 bg-white">
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
                      submittedLockRef.current = false;
                      rememberDraftId("");
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
