import { prisma, getTenantPrisma } from "../../lib/db/index.ts";
import { decryptText, encryptText, formatAadhaar, getAadhaarLast4, hashAadhaar, maskAadhaar } from "../../lib/crypto/index.ts";
import { ApplicantStatus, Role, VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { ApplicantSubmitSchema } from "./schema.ts";
import { formDataWithoutFiles } from "../../lib/applicantFormFields.ts";
import { firstZodMessage } from "../../lib/publicErrors.ts";
import type { OfficeAdmin } from "../../lib/officeAdmin.ts";

function scrubFormDataPii(form: Record<string, any>) {
  const next = { ...form };
  if (next.aadhaar) next.aadhaar = maskAadhaar(String(next.aadhaar));
  return next;
}

export async function submitApplicant(
  rawInput: z.infer<typeof ApplicantSubmitSchema>,
  officeAdmin?: OfficeAdmin | null,
) {
  const parsed = ApplicantSubmitSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error));
  const input = parsed.data;

  const company = await prisma.company.findUnique({
    where: { slug: input.companySlug },
  });
  if (!company) throw new Error("Company not found.");

  const fillerName = String(officeAdmin?.name || "").trim();
  const fillerPhone = String(officeAdmin?.phone || "").replace(/\D/g, "").slice(-10);
  if (officeAdmin) {
    if (fillerName.length < 2) throw new Error("Please enter the filling admin name.");
    if (fillerPhone.length !== 10) throw new Error("Please enter the filling admin 10-digit phone number.");
  }

  const filledByAdmin = officeAdmin
    ? {
        userId: officeAdmin.id,
        name: fillerName,
        phone: fillerPhone,
        email: officeAdmin.email,
        filledAt: new Date().toISOString(),
      }
    : null;

  // Candidate OTP is required unless an office admin is filling this form.
  let isVerified = Boolean(filledByAdmin);
  if (!isVerified && input.candidateAccountId) {
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

  // Same person may apply for more than one trade/category, but not the same post twice.
  const aadhaarHmac = hashAadhaar(input.aadhaarNumber);
  const incomingExtra = String(
    input.formData?.otherCategory || input.formData?.gemProfile || "",
  )
    .trim()
    .toLowerCase();
  const existingSameAadhaar = await prisma.applicant.findMany({
    where: {
      companyId: company.id,
      aadhaarHash: aadhaarHmac,
      deletedAt: null,
      status: { in: [ApplicantStatus.NEW, ApplicantStatus.SHORTLISTED, ApplicantStatus.APPROVED] },
    },
    select: { jobRoleId: true, roleCategoryId: true, formData: true },
  });
  const sameTradeAndCategory = existingSameAadhaar.some((row) => {
    if (row.jobRoleId !== input.jobRoleId || row.roleCategoryId !== input.roleCategoryId) return false;
    const fd = (row.formData || {}) as Record<string, any>;
    const extra = String(fd.otherCategory || fd.gemProfile || "").trim().toLowerCase();
    return extra === incomingExtra;
  });
  if (sameTradeAndCategory) {
    throw new Error(
      "You already have an application for this same trade and category. Please choose a different trade or category.",
    );
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
      formData: {
        ...scrubFormDataPii(formDataWithoutFiles(input.formData || {})),
        ...(filledByAdmin ? { filledByAdmin } : {}),
      },
      documents: input.documents,
      status: ApplicantStatus.NEW,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: filledByAdmin?.userId || null,
      entityType: "APPLICANT",
      entityId: applicant.id,
      action: filledByAdmin ? "SUBMIT_BY_ADMIN" : "SUBMIT",
      newValue: {
        fullName: applicant.fullName,
        status: applicant.status,
        ...(filledByAdmin ? { filledByAdmin } : {}),
      },
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
        pan: true,
        aadhaarEncrypted: true,
        aadhaarLast4: true,
        formData: true,
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

  const safeItems = items.map(({ aadhaarEncrypted, aadhaarLast4, formData, ...app }) => ({
    ...app,
    officeApplicantId: String((formData as any)?.officeApplicantId || ""),
    filledByAdmin: (formData as any)?.filledByAdmin || null,
    aadhaarDisplay: formatAadhaar(decryptText(aadhaarEncrypted) || aadhaarLast4),
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

export async function saveOfficeApplicantId({
  companyId,
  applicantId,
  officeApplicantId,
}: {
  companyId: string;
  applicantId: string;
  officeApplicantId: string;
}) {
  const applicant = await prisma.applicant.findFirst({
    where: { id: applicantId, companyId, deletedAt: null },
    include: { employee: { select: { id: true, employeeCode: true } } },
  });
  if (!applicant) throw new Error("Applicant not found in this company.");
  if (applicant.status !== ApplicantStatus.APPROVED) {
    throw new Error("Employee ID number can be entered only after the applicant is approved.");
  }

  const employeeIdNo = String(officeApplicantId || "").trim();
  if (!employeeIdNo) throw new Error("Please enter the employee ID number.");

  const formData = {
    ...((applicant.formData as Record<string, unknown>) || {}),
    officeApplicantId: employeeIdNo,
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.applicant.update({
        where: { id: applicantId },
        data: { formData },
      });
      if (applicant.employee?.id && applicant.employee.employeeCode !== employeeIdNo) {
        await tx.employee.update({
          where: { id: applicant.employee.id },
          data: { employeeCode: employeeIdNo },
        });
      }
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new Error("This employee ID number is already used.");
    }
    throw error;
  }

  return { officeApplicantId: employeeIdNo, employeeCode: employeeIdNo };
}
