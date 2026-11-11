"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptText, formatAadhaar } from "@/lib/crypto";
import { ApplicantStatus, AttendanceStatus, Role } from "@prisma/client";
import { listApplicants } from "@/modules/applicants/services";
import { ensureApplicantNumbers } from "@/lib/applicationNumbers";
import { assignEmployeeSite, listEmployees } from "@/modules/employees/services";
import {
  fillWorkingDays,
  getMonthlyAttendanceSummary,
  lockMonthAttendance,
  setAttendanceDay,
} from "@/modules/attendance/services";

async function requireCompany(companySlug: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized: Sign in required.");

  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
  });
  if (!company) throw new Error("Company not found.");

  const user = session.user as any;
  if (user.role !== Role.SUPER_ADMIN && user.companyId !== company.id) {
    throw new Error("Forbidden: You do not have access to this company's books.");
  }

  return { user, company };
}

function convertForClient(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toNumber?: unknown }).toNumber === "function") {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : String(value);
  }
  if (Array.isArray(value)) return value.map(convertForClient);
  const out: Record<string, unknown> = {};
  for (const [key, current] of Object.entries(value as Record<string, unknown>)) {
    out[key] = convertForClient(current);
  }
  return out;
}

function toClientJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(convertForClient(value))) as T;
}

export async function loadApplicantBook(
  companySlug: string,
  opts: { search?: string; status?: string } = {},
) {
  try {
    const { company } = await requireCompany(companySlug);
    const status =
      opts.status && opts.status !== "ALL" ? (opts.status as ApplicantStatus) : undefined;
    const data = await listApplicants({
      companyId: company.id,
      search: opts.search?.trim() || undefined,
      status,
      limit: 50,
    });
    const sites = await prisma.site.findMany({
      where: { companyId: company.id, active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
    return toClientJson({ ...data, sites, error: "" });
  } catch (error) {
    console.error("[loadApplicantBook]", error);
    return {
      items: [],
      total: 0,
      sites: [],
      error: "The applicant book could not be loaded.",
    };
  }
}

export async function loadApplicantDetail(companySlug: string, applicantId: string) {
  const { company } = await requireCompany(companySlug);
  await ensureApplicantNumbers(company.id);
  const applicant = await prisma.applicant.findFirst({
    where: { id: applicantId, companyId: company.id, deletedAt: null },
    include: {
      jobRole: { select: { id: true, name: true, code: true } },
      roleCategory: { select: { id: true, name: true, code: true } },
      employee: { select: { id: true, employeeCode: true } },
      remarks: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!applicant) throw new Error("Applicant not found in this company.");
  const { aadhaarEncrypted, aadhaarHash: _aadhaarHash, ...safe } = applicant;
  const aadhaarDisplay = formatAadhaar(decryptText(aadhaarEncrypted) || applicant.aadhaarLast4);
  const formData = {
    ...((revealFormAadhaar(applicant.formData, aadhaarDisplay) as Record<string, unknown>) || {}),
    applicationNo: applicant.applicationNo || (applicant.formData as any)?.applicationNo || "",
  };
  return toClientJson({
    ...safe,
    applicationNo: applicant.applicationNo || formData.applicationNo || null,
    formData,
    aadhaarDisplay,
  });
}

export async function loadEmployeeBook(
  companySlug: string,
  opts: { search?: string } = {},
) {
  const { company } = await requireCompany(companySlug);
  const data = await listEmployees({
    companyId: company.id,
    search: opts.search?.trim() || undefined,
    limit: 50,
  });
  const sites = await prisma.site.findMany({
    where: { companyId: company.id, active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  return toClientJson({ ...data, sites });
}

export async function assignStaffSite(companySlug: string, employeeId: string, siteId: string) {
  const { user, company } = await requireCompany(companySlug);
  return assignEmployeeSite({
    companyId: company.id,
    userId: user.id,
    employeeId,
    siteId,
  });
}

export async function loadAccountsBook(companySlug: string) {
  const { company } = await requireCompany(companySlug);
  const invoices = await prisma.invoice.findMany({
    where: { companyId: company.id, deletedAt: null },
    include: { contract: true, lines: true },
    orderBy: { createdAt: "desc" },
  });
  const contracts = await prisma.contract.findMany({
    where: { companyId: company.id, deletedAt: null },
    select: {
      id: true,
      clientName: true,
      departmentName: true,
      agreementNo: true,
      workName: true,
      tenderNo: true,
    },
    orderBy: { clientName: "asc" },
  });
  return toClientJson({
    company: {
      slug: company.slug,
      legalName: company.legalName,
      shortName: company.shortName,
      gstin: company.gstin,
      stateName: company.stateName,
      stateCode: company.stateCode,
      sac: company.sac,
    },
    invoices,
    contracts,
  });
}

export async function loadProcurementBook(companySlug: string) {
  const { company } = await requireCompany(companySlug);
  const purchases = await prisma.purchase.findMany({
    where: { companyId: company.id, deletedAt: null },
    include: { contract: true },
    orderBy: { purchaseDate: "desc" },
  });
  const contracts = await prisma.contract.findMany({
    where: { companyId: company.id, deletedAt: null },
    select: { id: true, clientName: true, workName: true },
  });
  return toClientJson({ purchases, contracts });
}

export async function loadFinanceBook(companySlug: string) {
  const { company } = await requireCompany(companySlug);
  const entries = await prisma.$queryRaw<any[]>`
    SELECT id, company_id AS "companyId", entry_date AS "entryDate", narration,
           voucher_number AS "voucherNumber", debit_amount AS "debitAmount",
           credit_amount AS "creditAmount", category,
           payment_mode AS "paymentMode", cheque_no AS "chequeNo",
           created_at AS "createdAt"
    FROM ledger_entries
    WHERE company_id = ${company.id}
    ORDER BY entry_date DESC
  `;
  const totalCredit = entries.reduce((acc, curr) => acc + Number(curr.creditAmount), 0);
  const totalDebit = entries.reduce((acc, curr) => acc + Number(curr.debitAmount), 0);
  return toClientJson({
    entries,
    totalCredit,
    totalDebit,
    balance: totalCredit - totalDebit,
  });
}

export async function loadAttendanceBook(companySlug: string, monthKey: string) {
  const { company } = await requireCompany(companySlug);
  const [data, sites] = await Promise.all([
    getMonthlyAttendanceSummary({
      companyId: company.id,
      monthKey,
    }),
    prisma.site.findMany({
      where: { companyId: company.id, active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return toClientJson({ ...data, sites });
}

export async function saveAttendanceDay(
  companySlug: string,
  input: {
    employeeId: string;
    siteId?: string | null;
    nominalDate: string;
    status: AttendanceStatus | null;
  },
) {
  const { user, company } = await requireCompany(companySlug);
  return setAttendanceDay({
    companyId: company.id,
    markedBy: user.name || user.email || user.id,
    employeeId: input.employeeId,
    siteId: input.siteId,
    nominalDate: input.nominalDate,
    status: input.status,
  });
}

export async function fillAttendanceMonth(companySlug: string, monthKey: string, throughDay?: number) {
  const { user, company } = await requireCompany(companySlug);
  return fillWorkingDays({
    companyId: company.id,
    markedBy: user.name || user.email || user.id,
    monthKey,
    throughDay,
  });
}

export async function lockAttendanceMonth(companySlug: string, monthKey: string) {
  const { user, company } = await requireCompany(companySlug);
  return lockMonthAttendance({
    companyId: company.id,
    monthKey,
    lockedBy: user.name || user.email || user.id,
  });
}

export async function loadCrmBook(companySlug: string) {
  const { company } = await requireCompany(companySlug);
  const contracts = await prisma.contract.findMany({
    where: { companyId: company.id, deletedAt: null },
    include: { _count: { select: { invoices: true, purchases: true } } },
    orderBy: { createdAt: "desc" },
  });
  const sites = await prisma.site.findMany({
    where: { companyId: company.id, active: true },
    orderBy: { name: "asc" },
  });
  return toClientJson({
    company: { legalName: company.legalName, shortName: company.shortName, slug: company.slug },
    contracts,
    sites,
  });
}

export async function loadDashboard(companySlug: string) {
  const { company } = await requireCompany(companySlug);
  const [
    applicantGroups,
    employeeGroups,
    contractRows,
    invoiceAgg,
    purchaseAgg,
    ledgerRows,
    latestApplicants,
    latestContracts,
  ] = await Promise.all([
    prisma.applicant.groupBy({
      by: ["status"],
      where: { companyId: company.id, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["status"],
      where: { companyId: company.id, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.contract.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: { emdAmount: true, pgAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { companyId: company.id, deletedAt: null },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.purchase.aggregate({
      where: { companyId: company.id, deletedAt: null },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { companyId: company.id },
      select: { creditAmount: true, debitAmount: true },
    }),
    prisma.applicant.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        status: true,
        createdAt: true,
        jobRole: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.contract.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: { id: true, clientName: true, workName: true, agreementNo: true, workStatus: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const n = (v: unknown) => Number(v || 0);
  const applicantCounts = { total: 0, NEW: 0, SHORTLISTED: 0, APPROVED: 0, REJECTED: 0 };
  for (const row of applicantGroups) {
    applicantCounts.total += row._count._all;
    applicantCounts[row.status] = row._count._all;
  }
  const employeeCounts = { total: 0, ACTIVE: 0, TERMINATED: 0 };
  for (const row of employeeGroups) {
    employeeCounts.total += row._count._all;
    employeeCounts[row.status] = row._count._all;
  }
  const credit = ledgerRows.reduce((sum, e) => sum + n(e.creditAmount), 0);
  const debit = ledgerRows.reduce((sum, e) => sum + n(e.debitAmount), 0);

  return toClientJson({
    company: { shortName: company.shortName, legalName: company.legalName, slug: company.slug },
    summary: {
      applicants: applicantCounts,
      employees: employeeCounts,
      contracts: contractRows.length,
      emd: { count: contractRows.filter((c) => n(c.emdAmount) > 0).length, amount: contractRows.reduce((s, c) => s + n(c.emdAmount), 0) },
      pg: { count: contractRows.filter((c) => n(c.pgAmount) > 0).length, amount: contractRows.reduce((s, c) => s + n(c.pgAmount), 0) },
      invoices: { count: invoiceAgg._count._all, billed: n(invoiceAgg._sum.totalAmount) },
      purchases: { count: purchaseAgg._count._all, spent: n(purchaseAgg._sum.amount) },
      ledger: { credit, debit, balance: credit - debit },
    },
    applicants: latestApplicants,
    contracts: latestContracts,
  });
}

export async function loadCompanyReports(companySlug: string) {
  const { company } = await requireCompany(companySlug);

  const monthKey = new Date().toISOString().slice(0, 7);
  const [applicants, employees, contracts, invoices, purchases, ledger, attendance] = await Promise.all([
    prisma.applicant.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        mobile: true,
        status: true,
        createdAt: true,
        jobRole: { select: { name: true } },
        roleCategory: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.employee.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        mobile: true,
        status: true,
        basicRate: true,
        divisorDays: true,
        joiningDate: true,
        jobRole: { select: { name: true } },
        roleCategory: { select: { name: true } },
        site: { select: { name: true } },
      },
      orderBy: { employeeCode: "asc" },
      take: 500,
    }),
    prisma.contract.findMany({
      where: { companyId: company.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: { contract: { select: { clientName: true, agreementNo: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: { contract: { select: { clientName: true } } },
      orderBy: { purchaseDate: "desc" },
    }),
    prisma.$queryRaw<any[]>`
      SELECT id, entry_date AS "entryDate", narration, voucher_number AS "voucherNumber",
             debit_amount AS "debitAmount", credit_amount AS "creditAmount", category,
             payment_mode AS "paymentMode", cheque_no AS "chequeNo"
      FROM ledger_entries
      WHERE company_id = ${company.id}
      ORDER BY entry_date DESC
    `,
    getMonthlyAttendanceSummary({ companyId: company.id, monthKey }),
  ]);

  const n = (v: unknown) => Number(v || 0);
  const applicantCounts = {
    total: applicants.length,
    NEW: applicants.filter((a) => a.status === "NEW").length,
    SHORTLISTED: applicants.filter((a) => a.status === "SHORTLISTED").length,
    APPROVED: applicants.filter((a) => a.status === "APPROVED").length,
    REJECTED: applicants.filter((a) => a.status === "REJECTED").length,
  };
  const employeeCounts = {
    total: employees.length,
    ACTIVE: employees.filter((e) => e.status === "ACTIVE").length,
    TERMINATED: employees.filter((e) => e.status === "TERMINATED").length,
  };
  const emdAmount = contracts.reduce((sum, c) => sum + n(c.emdAmount), 0);
  const pgAmount = contracts.reduce((sum, c) => sum + n(c.pgAmount), 0);
  const billed = invoices.reduce((sum, inv) => sum + n(inv.totalAmount), 0);
  const spent = purchases.reduce((sum, p) => sum + n(p.amount), 0);
  const credit = ledger.reduce((sum, e) => sum + n(e.creditAmount), 0);
  const debit = ledger.reduce((sum, e) => sum + n(e.debitAmount), 0);

  return toClientJson({
    company: {
      shortName: company.shortName,
      legalName: company.legalName,
      slug: company.slug,
    },
    generatedAt: new Date().toISOString(),
    summary: {
      applicants: applicantCounts,
      employees: employeeCounts,
      contracts: contracts.length,
      emd: { count: contracts.filter((c) => n(c.emdAmount) > 0).length, amount: emdAmount },
      pg: { count: contracts.filter((c) => n(c.pgAmount) > 0).length, amount: pgAmount },
      invoices: { count: invoices.length, billed },
      purchases: { count: purchases.length, spent },
      ledger: { credit, debit, balance: credit - debit },
      attendance: {
        monthKey: attendance.monthKey,
        employees: attendance.rows.length,
        present: attendance.rows.reduce((sum, row) => sum + row.presentDays, 0),
        payable: attendance.rows.reduce((sum, row) => sum + row.payableDays, 0),
        wages: attendance.rows.reduce((sum, row) => sum + row.estimatedGrossWages, 0),
      },
    },
    applicants,
    employees,
    contracts,
    invoices,
    purchases,
    ledger,
    attendance,
  });
}

function revealFormAadhaar(formData: unknown, aadhaarDisplay: string) {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) return {};
  const copy = { ...(formData as Record<string, unknown>) };
  if (aadhaarDisplay) copy.aadhaar = aadhaarDisplay;
  return copy;
}

export async function loadReportPerson(
  companySlug: string,
  kind: "applicant" | "employee",
  id: string,
) {
  const { company } = await requireCompany(companySlug);

  if (kind === "applicant") {
    const applicant = await prisma.applicant.findFirst({
      where: { id, companyId: company.id, deletedAt: null },
      include: {
        jobRole: { select: { name: true } },
        roleCategory: { select: { name: true } },
        employee: { select: { id: true, employeeCode: true } },
      },
    });
    if (!applicant) throw new Error("Applicant not found in this company.");

    const { aadhaarEncrypted, aadhaarHash: _aadhaarHash, ...safe } = applicant;
    const aadhaarDisplay = formatAadhaar(decryptText(aadhaarEncrypted) || applicant.aadhaarLast4);
    return toClientJson({
      kind: "applicant" as const,
      ...safe,
      formData: revealFormAadhaar(applicant.formData, aadhaarDisplay),
      aadhaarDisplay,
    });
  }

  const employee = await prisma.employee.findFirst({
    where: { id, companyId: company.id, deletedAt: null },
    include: {
      jobRole: { select: { name: true } },
      roleCategory: { select: { name: true } },
      site: { select: { name: true } },
      documents: true,
      applicant: {
        select: {
          formData: true,
          documents: true,
          email: true,
          fatherOrHusband: true,
          dateOfBirth: true,
          gender: true,
          presentAddress: true,
          permanentAddress: true,
          armsLicenseNo: true,
          exServiceNo: true,
          pvcStatus: true,
        },
      },
    },
  });
  if (!employee) throw new Error("Employee not found in this company.");

  const { aadhaarEncrypted, aadhaarHash: _aadhaarHash, ...safe } = employee;
  const aadhaarDisplay = formatAadhaar(decryptText(aadhaarEncrypted) || employee.aadhaarLast4);
  return toClientJson({
    kind: "employee" as const,
    ...safe,
    email: employee.email || employee.applicant?.email,
    fatherOrHusband: employee.fatherOrHusband || employee.applicant?.fatherOrHusband,
    dateOfBirth: employee.dateOfBirth || employee.applicant?.dateOfBirth,
    gender: employee.gender || employee.applicant?.gender,
    presentAddress: employee.presentAddress || employee.applicant?.presentAddress,
    permanentAddress: employee.permanentAddress || employee.applicant?.permanentAddress,
    exServiceNo: employee.applicant?.exServiceNo,
    armsLicenseNo: employee.applicant?.armsLicenseNo,
    pvcStatus: employee.applicant?.pvcStatus,
    formData: revealFormAadhaar(employee.applicant?.formData, aadhaarDisplay),
    applicantDocuments: employee.applicant?.documents || [],
    aadhaarDisplay,
  });
}

export async function createClientInvoice(companySlug: string, body: any) {
  const { company } = await requireCompany(companySlug);
  const { createWageInvoice } = await import("@/modules/invoices/services");
  const invoice = await createWageInvoice(company.id, body);
  return toClientJson(invoice);
}
