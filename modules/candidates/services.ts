import { prisma } from "../../lib/db/index.ts";
import bcrypt from "bcryptjs";
import { normalizeOtpIdentifier } from "../../lib/otp/index.ts";
import { verifyApplicantOtp } from "../otp/services.ts";

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
    include: {
      applicants: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          jobRole: { select: { name: true } },
          roleCategory: { select: { name: true } },
        },
      },
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
    applicants: candidate.applicants,
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

  const applications = await prisma.applicant.findMany({
    where: {
      companyId: company.id,
      candidateAccountId: candidateId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      fullName: true,
      mobile: true,
      createdAt: true,
      jobRole: { select: { name: true, code: true } },
      roleCategory: { select: { name: true, code: true } },
    },
  });

  return applications;
}
