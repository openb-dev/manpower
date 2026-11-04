import { prisma, getTenantPrisma } from "../../lib/db/index.ts";
import { encryptText, getAadhaarLast4, hashAadhaar, maskAadhaar } from "../../lib/crypto/index.ts";
import { ApplicantStatus, Role, VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { ApplicantSubmitSchema } from "./schema.ts";

export async function submitApplicant(rawInput: z.infer<typeof ApplicantSubmitSchema>) {
  const input = ApplicantSubmitSchema.parse(rawInput);

  const company = await prisma.company.findUnique({
    where: { slug: input.companySlug },
  });
  if (!company) throw new Error("Company not found.");

  // Ensure candidate account is verified OR OTP was verified within the last 60 minutes
  let isVerified = false;
  if (input.candidateAccountId) {
    const candidate = await prisma.candidateAccount.findUnique({
      where: { id: input.candidateAccountId },
    });
    if (candidate?.isVerified) {
      isVerified = true;
    }
  }

  if (!isVerified) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const identifiers = [input.mobile, input.email].filter(Boolean) as string[];
    const verifiedOtp = await prisma.applicantOtp.findFirst({
      where: {
        companyId: company.id,
        identifier: { in: identifiers },
        verifiedAt: { gte: oneHourAgo },
      },
      orderBy: { verifiedAt: "desc" },
    });

    if (!verifiedOtp) {
      throw new Error("OTP verification (via WhatsApp or Email) is required before submitting the application.");
    }
  }

  // Duplicate applicant prevention within the same company using Aadhaar HMAC
  const aadhaarHmac = hashAadhaar(input.aadhaarNumber);
  const existingApplicant = await prisma.applicant.findFirst({
    where: {
      companyId: company.id,
      aadhaarHash: aadhaarHmac,
      deletedAt: null,
      status: { in: [ApplicantStatus.NEW, ApplicantStatus.SHORTLISTED, ApplicantStatus.APPROVED] },
    },
  });

  if (existingApplicant) {
    throw new Error("An active application with this Aadhaar number already exists for this company.");
  }

  // Determine Police Verification Status
  let pvcStatus: VerificationStatus = VerificationStatus.PENDING;
  const rawPolice = String(input.formData?.policeStatus || "").toLowerCase();
  if (rawPolice === "verified") {
    pvcStatus = VerificationStatus.VERIFIED;
  } else if (rawPolice === "rejected") {
    pvcStatus = VerificationStatus.REJECTED;
  }

  const applicant = await prisma.applicant.create({
    data: {
      companyId: company.id,
      candidateAccountId: input.candidateAccountId || null,
      jobRoleId: input.jobRoleId,
      roleCategoryId: input.roleCategoryId,
      fullName: input.fullName.trim(),
      mobile: input.mobile.trim(),
      email: input.email ? input.email.trim().toLowerCase() : null,
      fatherOrHusband: input.fatherOrHusband?.trim() || null,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
      gender: input.gender || null,
      presentAddress: input.presentAddress.trim(),
      permanentAddress: input.permanentAddress?.trim() || null,
      aadhaarLast4: getAadhaarLast4(input.aadhaarNumber),
      aadhaarHash: aadhaarHmac,
      aadhaarEncrypted: encryptText(input.aadhaarNumber),
      pan: input.panNumber ? input.panNumber.trim().toUpperCase() : null,
      armsLicenseNo: input.armsLicenseNo?.trim() || null,
      armsExpiryDate: input.armsExpiryDate ? new Date(input.armsExpiryDate) : null,
      exServiceNo: input.exServiceNo?.trim() || null,
      pvcStatus,
      formData: input.formData,
      documents: input.documents,
      status: ApplicantStatus.NEW,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      entityType: "APPLICANT",
      entityId: applicant.id,
      action: "SUBMIT",
      newValue: { fullName: applicant.fullName, status: applicant.status },
    },
  });

  return { id: applicant.id, status: applicant.status };
}

export async function listApplicants({
  companyId,
  roleId,
  status,
  search,
  page = 1,
  limit = 20,
}: {
  companyId: string;
  roleId?: string;
  status?: ApplicantStatus;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const tenantDb = getTenantPrisma(companyId);

  const where: any = {
    deletedAt: null,
  };

  if (roleId) where.jobRoleId = roleId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { mobile: { contains: search } },
      { aadhaarLast4: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    tenantDb.applicant.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        mobile: true,
        email: true,
        status: true,
        createdAt: true,
        jobRole: { select: { id: true, name: true, code: true } },
        roleCategory: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    tenantDb.applicant.count({ where }),
  ]);

  // Strip sensitive columns from response, preserve masked presentation
  const safeItems = items.map((app) => ({
    ...app,
    aadhaarDisplay: "",
  }));

  return { items: safeItems, total, page, totalPages: Math.ceil(total / limit) };
}

export async function addApplicantRemark({
  companyId,
  userId,
  applicantId,
  remark,
}: {
  companyId: string;
  userId: string;
  applicantId: string;
  remark: string;
}) {
  const tenantDb = getTenantPrisma(companyId);

  const applicant = await tenantDb.applicant.findFirst({
    where: { id: applicantId, deletedAt: null },
  });
  if (!applicant) throw new Error("Applicant not found in this company.");

  const created = await prisma.applicantRemark.create({
    data: {
      applicantId,
      userId,
      remark: remark.trim(),
    },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId,
      userId,
      entityType: "APPLICANT",
      entityId: applicantId,
      action: "ADD_REMARK",
      newValue: { remark: remark.trim() },
    },
  });

  return created;
}

export async function updateApplicantStatus({
  companyId,
  userId,
  applicantId,
  newStatus,
  remark,
}: {
  companyId: string;
  userId: string;
  applicantId: string;
  newStatus: ApplicantStatus;
  remark: string;
}) {
  const tenantDb = getTenantPrisma(companyId);

  const applicant = await tenantDb.applicant.findFirst({
    where: { id: applicantId, deletedAt: null },
  });
  if (!applicant) throw new Error("Applicant not found in this company.");

  if (applicant.status === ApplicantStatus.APPROVED) {
    throw new Error("Cannot change status of an already approved applicant.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.applicant.update({
      where: { id: applicantId },
      data: { status: newStatus },
    });

    await tx.applicantRemark.create({
      data: {
        applicantId,
        userId,
        remark: `Status changed to ${newStatus}: ${remark.trim()}`,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        entityType: "APPLICANT",
        entityId: applicantId,
        action: `STATUS_${newStatus}`,
        oldValue: { status: applicant.status },
        newValue: { status: newStatus, remark },
      },
    });

    return res;
  });

  return updated;
}
