"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DECLARATION, TERMS, JOINING_VERSION } from "@/server/data/joiningText.js";
import {
  DEFAULT_COUNTRY,
  DEFAULT_STATE,
  INDIAN_STATES,
  QUALIFICATION_OPTIONS,
  formDataWithoutFiles,
  joinAddressParts,
} from "@/lib/applicantFormFields";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";

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
    localAddress: "",
    localPO: "",
    localPS: "",
    localPin: "",
    localDistrict: "",
    localState: DEFAULT_STATE,
    localCountry: DEFAULT_COUNTRY,
    villageAddress: "",
    villagePO: "",
    villagePS: "",
    villagePin: "",
    villageDistrict: "",
    villageState: DEFAULT_STATE,
    villageCountry: DEFAULT_COUNTRY,
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
    presentAddress: "",
    presentPO: "",
    presentPS: "",
    presentPin: "",
    presentDistrict: "",
    presentState: DEFAULT_STATE,
    presentCountry: DEFAULT_COUNTRY,
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

function isBsfExServicemanCategory(role?: JobRole | null, category?: { code?: string; name?: string } | null) {
  const roleText = `${role?.code || ""} ${role?.name || ""}`.toLowerCase();
  const catCode = String(category?.code || "").toUpperCase();
  const catName = String(category?.name || "").toLowerCase();
  const isGuard = /sec-guard|security/.test(roleText);
  const isExCat =
    catCode === "BSF_EX" ||
    catName.includes("bsf") ||
    catName.includes("ex-serviceman") ||
    catName.includes("ex serviceman");
  return isGuard && isExCat;
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

function missingPlace(label: string, pin: string, district: string, state: string, country: string) {
  if (!pin.trim() || pin.replace(/\D/g, "").length !== 6) return `Please enter a 6-digit PIN for ${label}.`;
  if (!district.trim()) return `Please enter district for ${label}.`;
  if (!state.trim()) return `Please select state for ${label}.`;
  if (!country.trim()) return `Please enter country for ${label}.`;
  return "";
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

async function fileToUploadData(file: File) {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Please choose a file smaller than 8 MB.");
  }
  if (!file.type.startsWith("image/")) {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("PDF files must be smaller than 2 MB.");
    }
    return readAsDataUrl(file);
  }
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1280;
      let width = img.width;
      let height = img.height;
      if (width > max || height > max) {
        const scale = max / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        readAsDataUrl(file).then(resolve, reject);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      readAsDataUrl(file).then(resolve, reject);
    };
    img.src = url;
  });
}

const fieldCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600";

function PlaceFields({
  pin,
  district,
  state,
  country,
  disabled = false,
  required = true,
  onPin,
  onDistrict,
  onState,
  onCountry,
}: {
  pin: string;
  district: string;
  state: string;
  country: string;
  disabled?: boolean;
  required?: boolean;
  onPin: (value: string) => void;
  onDistrict: (value: string) => void;
  onState: (value: string) => void;
  onCountry: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
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
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          District {required ? <span className="text-red-500">*</span> : null}
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
          Country {required ? <span className="text-red-500">*</span> : null}
        </label>
        <input
          required={required}
          disabled={disabled}
          type="text"
          value={country}
          onChange={(e) => onCountry(e.target.value)}
          className={fieldCls}
          placeholder="Country"
        />
      </div>
    </div>
  );
}

export default function ApplyPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setErrorState] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  function setError(message: string) {
    setErrorState(message ? friendlyPublicError(message) : "");
  }

  // Candidate Authentication State
  const [candidate, setCandidate] = useState<CandidateSession | null>(null);
  const [authTab, setAuthTab] = useState<"REGISTER" | "LOGIN">("REGISTER");

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

  // Application Steps
  const [step, setStep] = useState<"ROLE" | "FORM" | "SUCCESS">("ROLE");
  const [selectedRole, setSelectedRole] = useState<JobRole | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  // Complete Application Form State
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState("");

  // Check for saved candidate session in localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`candidate_${companySlug}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCandidate(parsed);
        setForm((prev) => ({
          ...prev,
          name: prev.name || parsed.fullName || "",
          mobile: prev.mobile || parsed.whatsappNo || "",
        }));
      } catch (e) {
        localStorage.removeItem(`candidate_${companySlug}`);
      }
    }
  }, [companySlug]);

  // Fetch Company Data
  useEffect(() => {
    fetch(`/api/apply/${companySlug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not find company recruitment portal.");
        const data = await readApiJson(res);
        setCompany(data);
        if (data.jobRoles?.[0]) {
          setSelectedRole(data.jobRoles[0]);
          setSelectedCategory(data.jobRoles[0].categories?.[0] || null);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [companySlug]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => setOtpCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // When candidate logs in or updates, sync name & mobile
  useEffect(() => {
    if (candidate) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || candidate.fullName || "",
        mobile: prev.mobile || candidate.whatsappNo || "",
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
      localStorage.setItem(`candidate_${companySlug}`, JSON.stringify(newSession));
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
      localStorage.setItem(`candidate_${companySlug}`, JSON.stringify(session));
      setForm((prev) => ({
        ...prev,
        name: session.fullName,
        mobile: session.whatsappNo,
      }));
      setSuccessMsg("Signed in successfully!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Sign out candidate session
  function handleSignOut() {
    setCandidate(null);
    localStorage.removeItem(`candidate_${companySlug}`);
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
    fileToUploadData(file)
      .then((dataUrl) => {
        setError("");
        setForm((prev) => ({
          ...prev,
          [dataKey]: dataUrl,
          [nameKey]: file.name,
        }));
      })
      .catch((err: any) => {
        setError(err.message || "Could not read that file.");
        input.value = "";
      });
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

    if (!candidate) {
      setError("Please sign in or register before submitting your application.");
      return;
    }
    if (!selectedRole?.id) return setError("Please select a trade.");
    if (!selectedCategory?.id) return setError("Please select a job category.");

    // Validation checks
    if (!form.name.trim()) return setError("Please enter your full name.");
    if (!form.fatherOrHusband.trim()) return setError("Please enter your Father / Husband name.");
    if (!form.dateOfBirth) return setError("Please enter your date of birth.");
    if (!form.age) return setError("Please enter your age.");
    if (!form.gender) return setError("Please select gender.");
    if (!form.localAddress.trim()) return setError("Please enter your local address.");
    if (!form.localPO.trim()) return setError("Please enter local P.O.");
    if (!form.localPS.trim()) return setError("Please enter local P.S.");
    const localPlaceErr = missingPlace("local address", form.localPin, form.localDistrict, form.localState, form.localCountry);
    if (localPlaceErr) return setError(localPlaceErr);
    if (!form.villageAddress.trim()) return setError("Please enter your village address.");
    if (!form.villagePO.trim()) return setError("Please enter village P.O.");
    if (!form.villagePS.trim()) return setError("Please enter village P.S.");
    const villagePlaceErr = missingPlace(
      "village address",
      form.villagePin,
      form.villageDistrict,
      form.villageState,
      form.villageCountry,
    );
    if (villagePlaceErr) return setError(villagePlaceErr);
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
      if (filledJobs.length === 0) return setError("Please add at least one work experience.");
      const incompleteJob = filledJobs.find(
        (job) => !job.employer.trim() || !job.job.trim() || !job.from.trim() || !job.to.trim()
      );
      if (incompleteJob) return setError("Please complete every work experience row, or remove it.");
    }
    if (!form.identificationMark.trim()) return setError("Please enter your identification mark.");
    if (!form.nationality.trim()) return setError("Please enter your nationality.");
    if (!form.religion.trim()) return setError("Please select your religion.");
    if (!form.reference.trim()) return setError("Please provide a reference contact.");
    const heightValue = heightText(form);
    if (!heightValue) return setError("Please enter your height.");
    if (!form.weight.trim()) return setError("Please specify weight.");
    if (!form.nominee.trim()) return setError("Please provide nominee name.");
    if (!form.nomineeRelation.trim()) return setError("Please enter nominee relation.");
    if (!form.photoName && !form.photo) return setError("Please upload a passport-size photo.");

    const cleanMobile = form.mobile.replace(/\D/g, "").slice(-10);
    if (cleanMobile.length !== 10) return setError("Please enter a valid 10-digit mobile number.");

    if (!form.presentAddress.trim()) return setError("Please enter present address.");
    if (!form.presentPO.trim()) return setError("Please enter present P.O.");
    if (!form.presentPS.trim()) return setError("Please enter present P.S.");
    const presentPlaceErr = missingPlace(
      "present address",
      form.presentPin,
      form.presentDistrict,
      form.presentState,
      form.presentCountry,
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
    if (!permanent.address.trim()) return setError("Please enter permanent address.");
    if (!permanent.po.trim()) return setError("Please enter permanent P.O.");
    if (!permanent.ps.trim()) return setError("Please enter permanent P.S.");
    const permanentPlaceErr = missingPlace(
      "permanent address",
      permanent.pin,
      permanent.district,
      permanent.state,
      permanent.country,
    );
    if (permanentPlaceErr) return setError(permanentPlaceErr);

    const cleanAadhaar = form.aadhaar.replace(/\D/g, "");
    if (cleanAadhaar.length !== 12) return setError("Aadhaar number must be exactly 12 digits.");

    const cleanPan = form.pan.trim().toUpperCase();
    if (!cleanPan) return setError("Please enter your PAN card number.");
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      return setError("Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).");
    }

    const isExServiceman = isBsfExServicemanCategory(selectedRole, selectedCategory);
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
    const previousEmployer = form.experienceType === "FRESHER" ? "None" : filledJobs[0]?.employer || "None";
    const isPreviousEmployee = form.experienceType === "EXPERIENCED";
    if (isPreviousEmployee) {
      if (!form.uan.trim()) return setError("Please enter PF UAN (use NA if not allotted).");
      if (!form.esiIp.trim()) return setError("Please enter ESI IP No. (use NA if not allotted).");
      if (!form.preferredDispensary.trim()) return setError("Please enter preferred ESI dispensary.");
    }
    if (!form.policeStatus) return setError("Please select police verification status.");
    if (form.policeStatus === "verified" && !form.policeFileName && !form.policeFile) {
      return setError("Please upload the police verification document.");
    }

    const filledFamily = (form.family || []).filter((member) =>
      [member.name, member.relation, member.dateOfBirth, member.aadhaar].some((part) => String(part || "").trim())
    );
    const incompleteFamily = filledFamily.find(
      (member) => !member.name.trim() || !member.relation.trim() || !member.dateOfBirth || !member.aadhaar.trim()
    );
    if (incompleteFamily) return setError("Please complete the family row you started, or remove it.");

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
        ...(form.passbookFileName ? [{ docType: "PASSBOOK", fileName: form.passbookFileName, fileData: form.passbookFile }] : []),
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
        candidateAccountId: candidate.id,
        jobRoleId: selectedRole?.id,
        roleCategoryId: selectedCategory?.id,
        fullName: form.name.trim(),
        mobile: cleanMobile,
        email: candidate.email,
        fatherOrHusband: form.fatherOrHusband.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender || "MALE",
        presentAddress: joinAddressParts([
          form.presentAddress,
          form.presentPO ? `P.O. ${form.presentPO}` : "",
          form.presentPS ? `P.S. ${form.presentPS}` : "",
          form.presentPin ? `PIN ${form.presentPin}` : "",
          form.presentDistrict ? `Dist. ${form.presentDistrict}` : "",
          form.presentState,
          form.presentCountry,
        ]),
        permanentAddress: joinAddressParts([
          permanent.address,
          permanent.po ? `P.O. ${permanent.po}` : "",
          permanent.ps ? `P.S. ${permanent.ps}` : "",
          permanent.pin ? `PIN ${permanent.pin}` : "",
          permanent.district ? `Dist. ${permanent.district}` : "",
          permanent.state,
          permanent.country,
        ]),
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
          uan: isPreviousEmployee ? form.uan.trim() : "NA",
          esiIp: isPreviousEmployee ? form.esiIp.trim() : "NA",
          preferredDispensary: isPreviousEmployee ? form.preferredDispensary.trim() : "",
          nomineeRelation: form.nomineeRelation.trim(),
          otherQualification: form.otherQualification.trim(),
          characterCertificate: form.otherQualification.trim(),
          family: filledFamily,
          joiningTerms: Boolean(form.declarationAccepted && form.termsAccepted),
          termsVersion: JOINING_VERSION,
        },
        documents: documentsPayload,
      };

      const res = await fetch(`/api/apply/${companySlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT_APPLICATION", data: payload }),
      });

      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "The application could not be submitted. Please check the form and try again.");
      setSubmittedRef(data.id);
      setStep("SUCCESS");
    } catch (err: any) {
      setError(err.message || "The application could not be submitted. Please check the form and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <p className="text-slate-600 font-medium animate-pulse">Loading recruitment portal...</p>
      </div>
    );
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

  const isGunRole = Boolean(
    selectedRole?.code === "GUNMAN" ||
    selectedRole?.name?.toLowerCase().includes("gunman") ||
    selectedRole?.name?.toLowerCase().includes("armed")
  );
  const isExServiceCategory = isBsfExServicemanCategory(selectedRole, selectedCategory);

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

          {candidate ? (
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
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="text-emerald-500 hover:text-emerald-800 font-bold ml-2">✕</button>
          </div>
        )}

        {/* =========================================================================
            STATE 1: NOT AUTHENTICATED -> CANDIDATE REGISTRATION / SIGN IN
            ========================================================================= */}
        {!candidate && (
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
                  authTab === "LOGIN"
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
                      <input
                        required
                        type="password"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Confirm Password *
                      </label>
                      <input
                        required
                        type="password"
                        placeholder="••••••••"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
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
                    <input
                      required
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
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
          </div>
        )}

        {/* =========================================================================
            STATE 2: AUTHENTICATED CANDIDATE -> ROLE SELECTION & FULL APPLICATION FORM
            ========================================================================= */}
        {candidate && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Step 1: Role Selection */}
            {step === "ROLE" && (
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                    Candidate: {candidate.fullName}
                  </span>
                  <div className="mt-2">
                    <h2 className="text-lg font-bold text-slate-900">Step 1: Select trade / category</h2>
                    <p className="text-xs text-slate-500">
                      Choose the trade / category you want to apply for at {company?.shortName || "N.K. Enterprise"}.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Trade / category <span className="text-red-600">*</span>
                    </label>
                    <select
                      required
                      value={selectedRole?.id || ""}
                      onChange={(e) => {
                        const role = company?.jobRoles.find((item) => item.id === e.target.value) || null;
                        setSelectedRole(role);
                        setSelectedCategory(role?.categories?.[0] || null);
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select trade</option>
                      {company?.jobRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Job category <span className="text-red-600">*</span>
                    </label>
                    <select
                      required
                      value={selectedCategory?.id || ""}
                      onChange={(e) => {
                        const category =
                          selectedRole?.categories.find((item) => item.id === e.target.value) || null;
                        setSelectedCategory(category);
                      }}
                      disabled={!selectedRole}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                    >
                      <option value="">{selectedRole ? "Select category" : "Select trade first"}</option>
                      {selectedRole?.categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedRole || !selectedCategory}
                  onClick={() => setStep("FORM")}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
                >
                  <span>Continue to Complete Application Form</span>
                  <span>→</span>
                </button>
              </div>
            )}

            {/* Step 2: The Complete Application Form with ALL Details */}
            {step === "FORM" && (
              <form onSubmit={handleSubmitApplication} className="p-6 sm:p-8 space-y-8">
                {/* Header banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider bg-blue-100 text-blue-800 px-2.5 py-1 rounded">
                      Applying for: {selectedRole?.name} ({selectedCategory?.name})
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

                {/* Candidate Account Quick Summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid gap-3 sm:grid-cols-3 text-xs">
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Registered Name</span>
                    <span className="font-bold text-slate-900">{candidate.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Account Email</span>
                    <span className="font-medium text-slate-900">{candidate.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Verified Mobile</span>
                    <span className="font-mono font-semibold text-emerald-700">+91 {candidate.whatsappNo} ✓</span>
                  </div>
                </div>

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
                        Gender <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
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

                    <div className="grid grid-cols-2 gap-3">
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
                          Age (Years) <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          type="text"
                          value={form.age}
                          onChange={(e) => setForm({ ...form, age: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g. 28"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Local Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.localAddress}
                        onChange={(e) => setForm({ ...form, localAddress: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        placeholder="House / street / area"
                      />
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            P.O. <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            value={form.localPO}
                            onChange={(e) => setForm({ ...form, localPO: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                            placeholder="Post office"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            P.S. <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            value={form.localPS}
                            onChange={(e) => setForm({ ...form, localPS: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                            placeholder="Police station"
                          />
                        </div>
                      </div>
                      <PlaceFields
                        pin={form.localPin}
                        district={form.localDistrict}
                        state={form.localState}
                        country={form.localCountry}
                        onPin={(value) => setForm({ ...form, localPin: value })}
                        onDistrict={(value) => setForm({ ...form, localDistrict: value })}
                        onState={(value) => setForm({ ...form, localState: value })}
                        onCountry={(value) => setForm({ ...form, localCountry: value })}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Village Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.villageAddress}
                        onChange={(e) => setForm({ ...form, villageAddress: e.target.value })}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Village / home address"
                      />
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            P.O. <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            value={form.villagePO}
                            onChange={(e) => setForm({ ...form, villagePO: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                            placeholder="Post office"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            P.S. <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            value={form.villagePS}
                            onChange={(e) => setForm({ ...form, villagePS: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                            placeholder="Police station"
                          />
                        </div>
                      </div>
                      <PlaceFields
                        pin={form.villagePin}
                        district={form.villageDistrict}
                        state={form.villageState}
                        country={form.villageCountry}
                        onPin={(value) => setForm({ ...form, villagePin: value })}
                        onDistrict={(value) => setForm({ ...form, villageDistrict: value })}
                        onState={(value) => setForm({ ...form, villageState: value })}
                        onCountry={(value) => setForm({ ...form, villageCountry: value })}
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
                        accept="image/*,.pdf"
                        required={!form.educationFileName}
                        onChange={(e) => handleFileUpload(e, "educationFile", "educationFileName")}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                      />
                      {form.educationFileName ? (
                        <div className="text-[11px] text-emerald-700 font-semibold mt-1 truncate">
                          ✓ {form.educationFileName}
                        </div>
                      ) : null}
                    </div>

                    <div className="sm:col-span-2 space-y-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Fresher / Experienced <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={form.experienceType}
                        onChange={(e) => {
                          const experienceType = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            experienceType,
                            workHistory: experienceType === "EXPERIENCED" ? jobList(prev.workHistory) : [blankJob()],
                          }));
                        }}
                        className="w-full sm:w-64 px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select</option>
                        <option value="FRESHER">Fresher</option>
                        <option value="EXPERIENCED">Experienced</option>
                      </select>

                      {form.experienceType === "EXPERIENCED" ? (
                        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <label className="block text-xs font-bold text-slate-700">
                              Work experience <span className="text-red-500">*</span>
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
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileUpload(e, "otherQualFile", "otherQualFileName")}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                      />
                      {form.otherQualFileName ? (
                        <div className="text-[11px] text-emerald-700 font-semibold mt-1 truncate">
                          ✓ {form.otherQualFileName}
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

                    <div>
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
                            ✓ {form.photoName} attached
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: EX-SERVICEMAN — only for Security Guard / BSF-ex-serviceman */}
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

                {/* SECTION 4: DECLARATION & STATUTORY DETAILS */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      4
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Statutory Identification & Address Details
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

                    <div className="sm:col-span-2 space-y-3">
                      <label className="block text-xs font-bold text-slate-700">
                        Present Residential Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.presentAddress}
                        onChange={(e) => updatePresent("presentAddress", e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        placeholder="House/Flat No, Street"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            P.O. <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            value={form.presentPO}
                            onChange={(e) => updatePresent("presentPO", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                            placeholder="Post office"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            P.S. <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            type="text"
                            value={form.presentPS}
                            onChange={(e) => updatePresent("presentPS", e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                            placeholder="Police station"
                          />
                        </div>
                      </div>
                      <PlaceFields
                        pin={form.presentPin}
                        district={form.presentDistrict}
                        state={form.presentState}
                        country={form.presentCountry}
                        onPin={(value) => updatePresent("presentPin", value)}
                        onDistrict={(value) => updatePresent("presentDistrict", value)}
                        onState={(value) => updatePresent("presentState", value)}
                        onCountry={(value) => updatePresent("presentCountry", value)}
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
                        Same as present address
                      </label>
                    </div>

                    <div className="sm:col-span-2 space-y-3">
                      <label className="block text-xs font-bold text-slate-700">
                        Permanent Residential Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        required={!form.sameAsPresent}
                        type="text"
                        value={form.permanentAddress}
                        onChange={(e) => setForm({ ...form, permanentAddress: e.target.value, sameAsPresent: false })}
                        disabled={form.sameAsPresent}
                        className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600"
                        placeholder="Village/Town"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            P.O. <span className="text-red-500">*</span>
                          </label>
                          <input
                            required={!form.sameAsPresent}
                            type="text"
                            value={form.permanentPO}
                            onChange={(e) => setForm({ ...form, permanentPO: e.target.value, sameAsPresent: false })}
                            disabled={form.sameAsPresent}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600"
                            placeholder="Post office"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            P.S. <span className="text-red-500">*</span>
                          </label>
                          <input
                            required={!form.sameAsPresent}
                            type="text"
                            value={form.permanentPS}
                            onChange={(e) => setForm({ ...form, permanentPS: e.target.value, sameAsPresent: false })}
                            disabled={form.sameAsPresent}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white disabled:bg-slate-100 disabled:text-slate-600"
                            placeholder="Police station"
                          />
                        </div>
                      </div>
                      <PlaceFields
                        pin={form.permanentPin}
                        district={form.permanentDistrict}
                        state={form.permanentState}
                        country={form.permanentCountry}
                        required={!form.sameAsPresent}
                        disabled={form.sameAsPresent}
                        onPin={(value) => setForm({ ...form, permanentPin: value, sameAsPresent: false })}
                        onDistrict={(value) => setForm({ ...form, permanentDistrict: value, sameAsPresent: false })}
                        onState={(value) => setForm({ ...form, permanentState: value, sameAsPresent: false })}
                        onCountry={(value) => setForm({ ...form, permanentCountry: value, sameAsPresent: false })}
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

                    {form.experienceType === "EXPERIENCED" ? (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            PF Universal Account Number (UAN) <span className="text-red-500">*</span>
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
                            ESI Insurance IP No. <span className="text-red-500">*</span>
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
                            placeholder="e.g. New Town / Barasat / Salt Lake"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* SECTION 5: FAMILY MEMBERS TABLE (5 MEMBERS) */}
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
                    <button
                      type="button"
                      onClick={addFamilyMember}
                      disabled={form.family.length >= 5}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 disabled:opacity-40"
                    >
                      + Add Member
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 -mt-2">
                    Optional. Add family members only if you want to give their details.
                  </p>

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
                            {idx + 1}. Member Name
                          </label>
                          <input
                            type="text"
                            placeholder="Full Name"
                            value={member.name}
                            onChange={(e) => updateFamilyMember(idx, "name", e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Relation
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Father, Mother, Spouse, Son"
                            value={member.relation}
                            onChange={(e) => updateFamilyMember(idx, "relation", e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Date of Birth
                          </label>
                          <input
                            type="date"
                            value={member.dateOfBirth}
                            onChange={(e) => updateFamilyMember(idx, "dateOfBirth", e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Aadhaar No.
                          </label>
                          <input
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
                </div>

                {/* SECTION 6: BANK DETAILS — only after approval */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      6
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Bank Account Details (For Wage Credit)
                    </h3>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p className="font-bold text-xs uppercase tracking-wide mb-1">Note</p>
                    <p>
                      Bank details are needed only after you are selected and made an employee. You do not have to fill
                      bank name, account number, IFSC, or passbook now.
                    </p>
                  </div>
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
                            accept="image/*,.pdf"
                            required={!form.policeFileName}
                            onChange={(e) => handleFileUpload(e, "policeFile", "policeFileName")}
                            className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                          />
                          {form.policeFileName ? (
                            <div className="text-[11px] text-emerald-700 font-semibold mt-1 truncate">
                              ✓ {form.policeFileName}
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
                        <p>
                          Security deposit is taken only after you are selected. You do not have to fill or pay this
                          now.
                        </p>
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

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-slate-800">
                        Aadhaar Card <span className="text-red-500">*</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        required={!form.aadhaarFileName}
                        onChange={(e) => handleFileUpload(e, "aadhaarFile", "aadhaarFileName")}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                      />
                      {form.aadhaarFileName && (
                        <div className="text-[11px] text-emerald-700 font-semibold truncate">
                          ✓ {form.aadhaarFileName}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-slate-800">
                        PAN Card <span className="text-red-500">*</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        required={!form.panFileName}
                        onChange={(e) => handleFileUpload(e, "panFile", "panFileName")}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                      />
                      {form.panFileName && (
                        <div className="text-[11px] text-emerald-700 font-semibold truncate">
                          ✓ {form.panFileName}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <div className="text-xs font-bold text-slate-800">Bank Passbook / Cheque</div>
                      <p className="text-[11px] text-amber-950">
                        Needed only after you are selected. You may skip this now.
                      </p>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileUpload(e, "passbookFile", "passbookFileName")}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800"
                      />
                      {form.passbookFileName && (
                        <div className="text-[11px] text-emerald-700 font-semibold truncate">
                          ✓ {form.passbookFileName}
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
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-md transition text-sm flex items-center justify-center gap-2"
                  >
                    <span>{submitting ? "Submitting Official Application..." : "Submit Official Application"}</span>
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
                  <h2 className="text-xl font-bold text-slate-900">Application Successfully Submitted!</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Your candidate profile has been registered in the company&apos;s Applicant Book for review and verification.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl inline-block text-left text-xs space-y-1.5 max-w-sm w-full mx-auto font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Applicant ID:</span>
                    <span className="font-bold text-slate-800">{submittedRef.slice(0, 13)}...</span>
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
                    <span className="font-bold text-amber-600">NEW (Under Review)</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setStep("ROLE");
                      setSubmittedRef("");
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    Apply for Another Role
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-xs transition"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
