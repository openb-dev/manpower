import { prisma, getTenantPrisma } from "../../lib/db/index.ts";
import { maskAadhaar } from "../../lib/crypto/index.ts";
import { ApplicantStatus, EmployeeStatus, Prisma } from "@prisma/client";

export async function approveApplicantAndCreateEmployee({
  companyId,
  userId,
  applicantId,
  siteId,
  basicRate,
  divisorDays = 26,
  uan,
  esicNo,
  bankName,
  accountNo,
  ifsc,
  branchName,
  securityMoney,
  remark,
}: {
  companyId: string;
  userId: string;
  applicantId: string;
  siteId?: string;
  basicRate: number;
  divisorDays?: number;
  uan?: string;
  esicNo?: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  branchName?: string;
  securityMoney?: string;
  remark?: string;
}) {
  const tenantDb = getTenantPrisma(companyId);

  // 1. Validate applicant under this company
  const applicant = await tenantDb.applicant.findFirst({
    where: { id: applicantId, deletedAt: null },
    include: { roleCategory: true },
  });

  if (!applicant) {
    throw new Error("Applicant not found in this company.");
  }

  if (applicant.status === ApplicantStatus.APPROVED) {
    throw new Error("Applicant is already approved.");
  }

  // 2. Perform conversion inside ONE atomic DB transaction
  const result = await prisma.$transaction(async (tx) => {
    // 2a. Atomic sequential employee code generation with row-level lock
    const seq = await tx.companySequence.findUnique({
      where: { companyId },
    });
    if (!seq) {
      throw new Error("Company sequence configuration missing.");
    }

    // Atomic increment
    const updatedSeq = await tx.companySequence.update({
      where: { companyId },
      data: { nextNumber: { increment: 1 } },
    });

    const currentNumber = updatedSeq.nextNumber - 1;
    const employeeCode = `${seq.prefix}-${String(currentNumber).padStart(4, "0")}`;

    // 2b. Bank details and security deposit are collected at approval time
    const formData = (applicant.formData as Record<string, any>) || {};
    const bankAccountNo = String(accountNo || formData.accountNo || "").trim();
    const bankIfsc = String(ifsc || formData.ifsc || "").trim();
    const bankBranch = String(branchName || formData.branchName || "").trim();
    const savedBankName = String(bankName || formData.bankName || "").trim();
    const savedSecurity = String(securityMoney ?? formData.securityMoney ?? "").trim();
    if (!savedBankName || !bankAccountNo || !bankIfsc || !bankBranch) {
      throw new Error("Bank details are required when making an employee.");
    }
    if (!savedSecurity) {
      throw new Error("Security deposit amount is required when making an employee.");
    }

    // 2c. Create Employee record copying applicant data
    const employee = await tx.employee.create({
      data: {
        companyId,
        employeeCode,
        applicantId: applicant.id,
        jobRoleId: applicant.jobRoleId,
        roleCategoryId: applicant.roleCategoryId,
        siteId: siteId || null,
        fullName: applicant.fullName,
        mobile: applicant.mobile,
        email: applicant.email,
        fatherOrHusband: applicant.fatherOrHusband,
        dateOfBirth: applicant.dateOfBirth,
        gender: applicant.gender,
        presentAddress: applicant.presentAddress,
        permanentAddress: applicant.permanentAddress,
        basicRate: new Prisma.Decimal(basicRate),
        divisorDays,
        bankAccountNo,
        bankIfsc,
        bankBranch,
        uan: uan?.trim() || formData.uan || null,
        esicNo: esicNo?.trim() || formData.esiIp || null,
        aadhaarLast4: applicant.aadhaarLast4,
        aadhaarHash: applicant.aadhaarHash,
        aadhaarEncrypted: applicant.aadhaarEncrypted,
        pan: applicant.pan,
        status: EmployeeStatus.ACTIVE,
      },
    });

    // 2d. Copy applicant documents to EmployeeDocument records
    const rawDocs = (applicant.documents as any[]) || [];
    for (const doc of rawDocs) {
      if (doc.fileKey) {
        await tx.employeeDocument.create({
          data: {
            employeeId: employee.id,
            docType: doc.docType || "OTHER",
            fileKey: doc.fileKey,
            fileName: doc.fileName || "document",
            mimeType: doc.mimeType || "application/octet-stream",
            fileSize: Number(doc.fileSize) || 0,
          },
        });
      }
    }

    // 2e. Update applicant status to APPROVED
    await tx.applicant.update({
      where: { id: applicant.id },
      data: {
        status: ApplicantStatus.APPROVED,
        formData: {
          ...formData,
          bankName: savedBankName,
          accountNo: bankAccountNo,
          ifsc: bankIfsc,
          branchName: bankBranch,
          securityMoney: savedSecurity,
        } as Prisma.InputJsonValue,
      },
    });

    // 2f. Add approval remark
    await tx.applicantRemark.create({
      data: {
        applicantId: applicant.id,
        userId,
        remark: remark || `Approved and converted to employee with code ${employeeCode}.`,
      },
    });

    // 2g. Audit log
    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        entityType: "EMPLOYEE",
        entityId: employee.id,
        action: "APPROVE_AND_CONVERT",
        oldValue: { applicantId: applicant.id, status: applicant.status },
        newValue: { employeeId: employee.id, employeeCode, siteId, basicRate },
      },
    });

    return employee;
  });

  return result;
}

export async function listEmployees({
  companyId,
  siteId,
  roleId,
  status,
  search,
  page = 1,
  limit = 20,
}: {
  companyId: string;
  siteId?: string;
  roleId?: string;
  status?: EmployeeStatus;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const tenantDb = getTenantPrisma(companyId);

  const where: any = {
    deletedAt: null,
  };

  if (siteId) where.siteId = siteId;
  if (roleId) where.jobRoleId = roleId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { employeeCode: { contains: search, mode: "insensitive" } },
      { mobile: { contains: search } },
      { aadhaarLast4: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    tenantDb.employee.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        mobile: true,
        status: true,
        siteId: true,
        basicRate: true,
        divisorDays: true,
        joiningDate: true,
        pan: true,
        uan: true,
        esicNo: true,
        bankAccountNo: true,
        bankIfsc: true,
        aadhaarLast4: true,
        jobRole: { select: { id: true, name: true, code: true } },
        roleCategory: { select: { id: true, name: true, code: true } },
        site: { select: { id: true, name: true, code: true } },
        documents: { select: { id: true, docType: true, fileName: true } },
      },
      orderBy: { employeeCode: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    tenantDb.employee.count({ where }),
  ]);

  const safeItems = items.map((emp) => ({
    ...emp,
    aadhaarEncrypted: undefined,
    aadhaarHash: undefined,
    aadhaarDisplay: maskAadhaar(emp.aadhaarLast4),
  }));

  return { items: safeItems, total, page, totalPages: Math.ceil(total / limit) };
}

export async function assignEmployeeSite({
  companyId,
  userId,
  employeeId,
  siteId,
}: {
  companyId: string;
  userId: string;
  employeeId: string;
  siteId: string;
}) {
  const site = await prisma.site.findFirst({
    where: { id: siteId, companyId, active: true },
  });
  if (!site) throw new Error("That duty site was not found for this company.");

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
  });
  if (!employee) throw new Error("Employee record not found.");

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { siteId },
    });
    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        entityType: "EMPLOYEE",
        entityId: employeeId,
        action: "ASSIGN_SITE",
        oldValue: { siteId: employee.siteId },
        newValue: { siteId, siteName: site.name },
      },
    });
  });

  return { success: true, siteId, siteName: site.name };
}

export async function softDeleteEmployee({
  companyId,
  userId,
  employeeId,
  reason,
}: {
  companyId: string;
  userId: string;
  employeeId: string;
  reason: string;
}) {
  const tenantDb = getTenantPrisma(companyId);

  const employee = await tenantDb.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
  });
  if (!employee) throw new Error("Employee not found in this company.");

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.employee.update({
      where: { id: employeeId },
      data: {
        deletedAt: new Date(),
        status: EmployeeStatus.TERMINATED,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        entityType: "EMPLOYEE",
        entityId: employeeId,
        action: "SOFT_DELETE",
        oldValue: { status: employee.status },
        newValue: { deletedAt: new Date(), reason },
      },
    });

    return res;
  });

  return updated;
}
