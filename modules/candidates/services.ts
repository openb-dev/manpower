import { prisma } from "../../lib/db/index.ts";
import bcrypt from "bcryptjs";
import { normalizeOtpIdentifier } from "../../lib/otp/index.ts";
import { verifyApplicantOtp } from "../otp/services.ts";
import { decryptText } from "../../lib/crypto/index.ts";
import { ensureApplicantNumbers } from "../../lib/applicationNumbers.ts";

export interface RegisterCandidateParams {
  companySlug: string;
  fullName: string;
  email: string;
  whatsappNo: string;
  password: string;
  otpChannel: "EMAIL" | "WHATSAPP";
  otpCode: string;
}

export async function registerCandidate({
  companySlug,
  fullName,
  email,
  whatsappNo,
  password,
  otpChannel,
  otpCode,
}: RegisterCandidateParams) {
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
  });
  if (!company) throw new Error("Company not found.");

  const cleanEmail = normalizeOtpIdentifier(email, "EMAIL");
  const cleanPhone = normalizeOtpIdentifier(whatsappNo, "WHATSAPP");

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new Error("Please enter a valid 10-digit WhatsApp / mobile number.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  // Check if candidate already registered with this email for this company
  const existing = await prisma.candidateAccount.findUnique({
    where: {
      companyId_email: {
        companyId: company.id,
        email: cleanEmail,
      },
    },
  });

  if (existing) {
    throw new Error("An account with this email already exists for this company. Please sign in.");
  }

  // Verify OTP for the chosen channel
  const identifier = otpChannel === "EMAIL" ? cleanEmail : cleanPhone;
  await verifyApplicantOtp({
    companySlug,
    identifier,
    code: otpCode,
  });

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  const candidate = await prisma.candidateAccount.create({
    data: {
      companyId: company.id,
      fullName: fullName.trim(),
      email: cleanEmail,
      whatsappNo: cleanPhone,
      passwordHash,
      otpVerifiedVia: otpChannel,
      isVerified: true,
    },
    select: {
      id: true,
      companyId: true,
      fullName: true,
      email: true,
      whatsappNo: true,
      otpVerifiedVia: true,
      createdAt: true,
    },
  });

  return candidate;
}

export async function loginCandidate({
  companySlug,
  email,
  password,
}: {
  companySlug: string;
  email: string;
  password: string;
}) {
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
  });
  if (!company) throw new Error("Company not found.");

  const cleanEmail = email.trim().toLowerCase();
  const candidate = await prisma.candidateAccount.findUnique({
    where: {
      companyId_email: {
        companyId: company.id,
        email: cleanEmail,
      },
    },
    select: {
      id: true,
      companyId: true,
      fullName: true,
      email: true,
      whatsappNo: true,
      otpVerifiedVia: true,
      passwordHash: true,
    },
  });

  if (!candidate) {
    throw new Error("No candidate account found with this email for this company. Please register.");
  }

  const isPasswordValid = await bcrypt.compare(password, candidate.passwordHash);
  if (!isPasswordValid) {
    throw new Error("Invalid password. Please check and try again.");
  }

  return {
    id: candidate.id,
    companyId: candidate.companyId,
    fullName: candidate.fullName,
    email: candidate.email,
    whatsappNo: candidate.whatsappNo,
    otpVerifiedVia: candidate.otpVerifiedVia,
  };
}

export async function getCandidateApplications({
  companySlug,
  candidateId,
}: {
  companySlug: string;
  candidateId: string;
}) {
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
  });
  if (!company) throw new Error("Company not found.");
  await ensureApplicantNumbers(company.id);

  const applications = await prisma.applicant.findMany({
    where: {
      companyId: company.id,
      candidateAccountId: candidateId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      applicationNo: true,
      status: true,
      createdAt: true,
      jobRoleId: true,
      roleCategoryId: true,
      formData: true,
      jobRole: { select: { name: true } },
      roleCategory: { select: { name: true } },
    },
  });

  return applications.map((row) => {
    const fd = (row.formData || {}) as Record<string, any>;
    const extra = String(fd.otherCategory || fd.gemProfile || "").trim();
    return {
      id: row.id,
      applicationNo: row.applicationNo || String((row.formData as any)?.applicationNo || ""),
      status: row.status,
      createdAt: row.createdAt,
      jobRoleId: row.jobRoleId,
      roleCategoryId: row.roleCategoryId,
      role: row.jobRole?.name || "",
      category: extra || row.roleCategory?.name || "",
      extra: extra.toLowerCase(),
    };
  });
}

function isoDate(value: unknown) {
  if (!value) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${m}-${d}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function docOf(docs: any[], type: string) {
  const row = docs.find((item) => String(item?.docType || "").toUpperCase() === type);
  return {
    file: String(row?.fileData || row?.fileKey || row?.src || ""),
    name: String(row?.fileName || ""),
  };
}

export function formPrefillFromApplicant(row: {
  fullName?: string | null;
  mobile?: string | null;
  email?: string | null;
  fatherOrHusband?: string | null;
  dateOfBirth?: Date | string | null;
  gender?: string | null;
  pan?: string | null;
  aadhaarEncrypted?: string | null;
  exServiceNo?: string | null;
  armsLicenseNo?: string | null;
  formData?: unknown;
  documents?: unknown;
}) {
  const fd = (row.formData || {}) as Record<string, any>;
  const docs = Array.isArray(row.documents) ? row.documents : [];
  const photo = docOf(docs, "PHOTO");
  const aadhaarDoc = docOf(docs, "AADHAAR");
  const panDoc = docOf(docs, "PAN");
  const passbook = docOf(docs, "PASSBOOK");
  const education = docOf(docs, "EDUCATION");
  const otherQual = docOf(docs, "OTHER_QUALIFICATION");
  const police = docOf(docs, "POLICE_VERIFICATION");
  const aadhaar = digits(decryptText(row.aadhaarEncrypted));
  const dob = isoDate(row.dateOfBirth || fd.dateOfBirth);
  let age = String(fd.age || "").trim();
  if (!age && dob) {
    const birth = new Date(dob);
    if (!Number.isNaN(birth.getTime())) {
      const years = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      if (years > 0 && years < 120) age = String(years);
    }
  }

  return {
    name: row.fullName || fd.name || "",
    fatherOrHusband: row.fatherOrHusband || fd.fatherOrHusband || "",
    dateOfBirth: dob,
    age,
    gender: row.gender || fd.gender || "MALE",
    qualification: fd.qualification || "",
    qualificationOther: fd.qualificationOther || "",
    experienceType: fd.experienceType || "",
    experience: fd.experience || "",
    workHistory: Array.isArray(fd.workHistory) && fd.workHistory.length ? fd.workHistory : [{ employer: "", job: "", from: "", to: "" }],
    otherQualification: fd.otherQualification || fd.characterCertificate || "",
    identificationMark: fd.identificationMark || "",
    nationality: fd.nationality || "Indian",
    religion: fd.religion || "Hindu",
    reference: fd.reference || "",
    referenceYears: String(fd.referenceYears || ""),
    uploadBankDetails: fd.uploadBankDetails || "",
    skillCategory: fd.skillCategory || "",
    gemProfile: fd.gemProfile || "",
    gemExperience: fd.gemExperience || "",
    otherCategory: fd.otherCategory || "",
    height: fd.height || "",
    heightUnit: fd.heightUnit || "cm",
    heightCm: fd.heightCm || "",
    heightFt: fd.heightFt || "",
    heightInch: fd.heightInch || "",
    weight: fd.weight || "",
    chest: fd.chest || "",
    nominee: fd.nominee || "",
    nomineeRelation: fd.nomineeRelation || "",
    photo: photo.file || fd.photo || "",
    photoName: photo.name || fd.photoName || "",
    exServiceNo: fd.exServiceNo || row.exServiceNo || "NA",
    exRank: fd.exRank || "NA",
    exDischargeDate: isoDate(fd.exDischargeDate),
    exDischargeBook: fd.exDischargeBook || "NA",
    gunLicence: fd.gunLicence || row.armsLicenseNo || "NA",
    gunNo: fd.gunNo || "NA",
    mobile: row.mobile || fd.mobile || "",
    email: row.email || fd.email || "",
    presentAddress: fd.presentAddress || fd.localAddress || "",
    presentPO: fd.presentPO || fd.localPO || "",
    presentPS: fd.presentPS || fd.localPS || "",
    presentPin: fd.presentPin || fd.localPin || "",
    presentDistrict: fd.presentDistrict || fd.localDistrict || "",
    presentState: fd.presentState || fd.localState || "",
    presentCountry: fd.presentCountry || "India",
    emergencyContact: digits(fd.emergencyContact).slice(-10),
    sameAsPresent: Boolean(fd.sameAsPresent),
    permanentAddress: fd.permanentAddress || fd.villageAddress || "",
    permanentPO: fd.permanentPO || fd.villagePO || "",
    permanentPS: fd.permanentPS || fd.villagePS || "",
    permanentPin: fd.permanentPin || fd.villagePin || "",
    permanentDistrict: fd.permanentDistrict || fd.villageDistrict || "",
    permanentState: fd.permanentState || fd.villageState || "",
    permanentCountry: fd.permanentCountry || "India",
    aadhaar: aadhaar.length === 12 ? aadhaar : "",
    pan: row.pan || fd.pan || "",
    previousEmployer: fd.previousEmployer || "None",
    uan: fd.uan || "",
    esiIp: fd.esiIp || "",
    preferredDispensary: fd.preferredDispensary || "",
    includeFamily: fd.includeFamily || "",
    family: Array.isArray(fd.family) && fd.family.length ? fd.family : [{ name: "", relation: "", dateOfBirth: "", aadhaar: "" }],
    bankName: fd.bankName || "",
    accountNo: fd.accountNo || "",
    ifsc: fd.ifsc || "",
    branchName: fd.branchName || "",
    policeStatus: fd.policeStatus || "pending",
    policeFile: police.file || fd.policeFile || "",
    policeFileName: police.name || fd.policeFileName || "",
    aadhaarFile: aadhaarDoc.file || fd.aadhaarFile || "",
    aadhaarFileName: aadhaarDoc.name || fd.aadhaarFileName || "",
    panFile: panDoc.file || fd.panFile || "",
    panFileName: panDoc.name || fd.panFileName || "",
    passbookFile: passbook.file || fd.passbookFile || "",
    passbookFileName: passbook.name || fd.passbookFileName || "",
    educationFile: education.file || fd.educationFile || "",
    educationFileName: education.name || fd.educationFileName || "",
    otherQualFile: otherQual.file || fd.otherQualFile || "",
    otherQualFileName: otherQual.name || fd.otherQualFileName || "",
  };
}

export async function getCandidatePrefill({
  companySlug,
  candidateId,
}: {
  companySlug: string;
  candidateId: string;
}) {
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
    select: { id: true },
  });
  if (!company) throw new Error("Company not found.");

  const row = await prisma.applicant.findFirst({
    where: {
      companyId: company.id,
      candidateAccountId: candidateId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      fullName: true,
      mobile: true,
      email: true,
      fatherOrHusband: true,
      dateOfBirth: true,
      gender: true,
      pan: true,
      aadhaarEncrypted: true,
      exServiceNo: true,
      armsLicenseNo: true,
      formData: true,
      documents: true,
    },
  });
  if (!row) return null;
  return formPrefillFromApplicant(row);
}
