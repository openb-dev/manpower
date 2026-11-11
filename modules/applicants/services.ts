import { prisma, getTenantPrisma } from "../../lib/db/index.ts";
import { decryptText, encryptText, formatAadhaar, getAadhaarLast4, hashAadhaar, maskAadhaar } from "../../lib/crypto/index.ts";
import { ApplicantStatus, Role, VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { ApplicantSubmitSchema } from "./schema.ts";
import { formDataWithoutFiles } from "../../lib/applicantFormFields.ts";
import { firstZodMessage } from "../../lib/publicErrors.ts";
import type { OfficeAdmin } from "../../lib/officeAdmin.ts";
import { formPrefillFromApplicant } from "../candidates/services.ts";

function scrubFormDataPii(form: Record<string, any>) {
  const next = { ...form };
  if (next.aadhaar) next.aadhaar = maskAadhaar(String(next.aadhaar));
  return next;
}

function extraPostKey(formData: unknown) {
  const fd = (formData || {}) as Record<string, any>;
  return String(fd.otherCategory || fd.gemProfile || "").trim().toLowerCase();
}

function mergeApplicantDocuments(existing: unknown, incoming: unknown) {
  const byType = new Map<string, any>();
  for (const doc of Array.isArray(existing) ? existing : []) {
    const type = String(doc?.docType || "").toUpperCase();
    if (type) byType.set(type, doc);
  }
  for (const doc of Array.isArray(incoming) ? incoming : []) {
    const type = String(doc?.docType || "").toUpperCase();
    if (!type) continue;
    if (doc?.fileData || doc?.fileName) byType.set(type, doc);
  }
  return [...byType.values()];
}

function applicantWriteFields(input: z.infer<typeof ApplicantSubmitSchema>, formData: Record<string, any>, pvcStatus: VerificationStatus) {
  return {
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
    aadhaarHash: hashAadhaar(input.aadhaarNumber),
    aadhaarEncrypted: encryptText(input.aadhaarNumber),
    pan: input.panNumber ? input.panNumber.trim().toUpperCase() : null,
    armsLicenseNo: input.armsLicenseNo?.trim() || null,
    armsExpiryDate: input.armsExpiryDate ? new Date(input.armsExpiryDate) : null,
    exServiceNo: input.exServiceNo?.trim() || null,
    pvcStatus,
    formData,
    documents: input.documents,
  };
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

  const seq = await prisma.companySequence.upsert({
    where: { companyId: company.id },
    update: { nextApplicantNumber: { increment: 1 } },
    create: {
      companyId: company.id,
      prefix: "NK",
      nextNumber: 1,
      nextApplicantNumber: 2,
    },
  });
  const prefix =
    company.slug === "nk"
      ? "NK"
      : String(seq.prefix || "NK").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "NK";
  const applicationNo = `${prefix}-${String(seq.nextApplicantNumber - 1).padStart(4, "0")}`;

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
      applicationNo,
      formData: {
        ...scrubFormDataPii(formDataWithoutFiles(input.formData || {})),
        ...(filledByAdmin ? { filledByAdmin } : {}),
        applicationNo,
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

  return { id: applicant.id, applicationNo, status: applicant.status };
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
      { applicationNo: { contains: search, mode: "insensitive" } },
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
        applicationNo: true,
        status: true,
        createdAt: true,
        jobRole: { select: { id: true, name: true, code: true } },
        roleCategory: { select: { id: true, name: true, code: true } },
        employee: { select: { id: true } },
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

export async function getApplicantForAdminEdit({
  companyId,
  applicantId,
}: {
  companyId: string;
  applicantId: string;
}) {
  if (!applicantId || !/^[0-9a-f-]{36}$/i.test(applicantId)) {
    throw new Error("Applicant not found in this company.");
  }
  const row = await prisma.applicant.findFirst({
    where: { id: applicantId, companyId, deletedAt: null },
    select: {
      id: true,
      applicationNo: true,
      status: true,
      jobRoleId: true,
      roleCategoryId: true,
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
  if (!row) throw new Error("Applicant not found in this company.");
  return {
    id: row.id,
    applicationNo: row.applicationNo,
    status: row.status,
    jobRoleId: row.jobRoleId,
    roleCategoryId: row.roleCategoryId,
    prefill: formPrefillFromApplicant(row),
  };
}

export async function updateApplicant(
  applicantId: string,
  rawInput: z.infer<typeof ApplicantSubmitSchema>,
  officeAdmin?: OfficeAdmin | null,
) {
  if (!officeAdmin) throw new Error("Only office admin can edit an application.");
  const parsed = ApplicantSubmitSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error(firstZodMessage(parsed.error));
  const input = parsed.data;

  const company = await prisma.company.findUnique({
    where: { slug: input.companySlug },
  });
  if (!company) throw new Error("Company not found.");

  const existing = await prisma.applicant.findFirst({
    where: { id: applicantId, companyId: company.id, deletedAt: null },
  });
  if (!existing) throw new Error("Applicant not found in this company.");

  const fillerName = String(officeAdmin.name || "").trim();
  const fillerPhone = String(officeAdmin.phone || "").replace(/\D/g, "").slice(-10);
  if (fillerName.length < 2) throw new Error("Please enter the filling admin name.");
  if (fillerPhone.length !== 10) throw new Error("Please enter the filling admin 10-digit phone number.");

  const aadhaarHmac = hashAadhaar(input.aadhaarNumber);
  const incomingExtra = extraPostKey(input.formData);
  const existingSameAadhaar = await prisma.applicant.findMany({
    where: {
      companyId: company.id,
      aadhaarHash: aadhaarHmac,
      deletedAt: null,
      status: { in: [ApplicantStatus.NEW, ApplicantStatus.SHORTLISTED, ApplicantStatus.APPROVED] },
      NOT: { id: applicantId },
    },
    select: { jobRoleId: true, roleCategoryId: true, formData: true },
  });
  const sameTradeAndCategory = existingSameAadhaar.some((row) => {
    if (row.jobRoleId !== input.jobRoleId || row.roleCategoryId !== input.roleCategoryId) return false;
    return extraPostKey(row.formData) === incomingExtra;
  });
  if (sameTradeAndCategory) {
    throw new Error(
      "You already have an application for this same trade and category. Please choose a different trade or category.",
    );
  }

  let pvcStatus: VerificationStatus = VerificationStatus.PENDING;
  const rawPolice = String(input.formData?.policeStatus || "").toLowerCase();
  if (rawPolice === "verified") pvcStatus = VerificationStatus.VERIFIED;
  else if (rawPolice === "rejected") pvcStatus = VerificationStatus.REJECTED;

  const existingForm = (existing.formData || {}) as Record<string, any>;
  const filledByAdmin = {
    userId: officeAdmin.id,
    name: fillerName,
    phone: fillerPhone,
    email: officeAdmin.email,
    filledAt: existingForm.filledByAdmin?.filledAt || new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
  };

  const applicant = await prisma.applicant.update({
    where: { id: applicantId },
    data: {
      ...applicantWriteFields(
        input,
        {
          ...scrubFormDataPii(formDataWithoutFiles(input.formData || {})),
          filledByAdmin,
          applicationNo: existing.applicationNo,
          officeApplicantId: existingForm.officeApplicantId || undefined,
        },
        pvcStatus,
      ),
      documents: mergeApplicantDocuments(existing.documents, input.documents),
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: officeAdmin.id,
      entityType: "APPLICANT",
      entityId: applicant.id,
      action: "EDIT_BY_ADMIN",
      newValue: {
        fullName: applicant.fullName,
        applicationNo: applicant.applicationNo,
        editedBy: fillerName,
      },
    },
  });

  return { id: applicant.id, applicationNo: applicant.applicationNo, status: applicant.status };
}

export async function softDeleteApplicant({
  companyId,
  userId,
  applicantId,
}: {
  companyId: string;
  userId: string;
  applicantId: string;
}) {
  const applicant = await prisma.applicant.findFirst({
    where: { id: applicantId, companyId, deletedAt: null },
    include: { employee: { select: { id: true } } },
  });
  if (!applicant) throw new Error("Applicant not found in this company.");

  await prisma.$transaction(async (tx) => {
    await tx.applicant.update({
      where: { id: applicantId },
      data: { deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        entityType: "APPLICANT",
        entityId: applicantId,
        action: "SOFT_DELETE",
        oldValue: { status: applicant.status, applicationNo: applicant.applicationNo },
        newValue: { deletedAt: new Date() },
      },
    });
  });

  return { success: true, hadEmployee: Boolean(applicant.employee) };
}
