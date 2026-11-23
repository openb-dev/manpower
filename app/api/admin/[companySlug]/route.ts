import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { addApplicantRemark, listApplicants, saveOfficeApplicantId, softDeleteApplicant, updateApplicantStatus } from "@/modules/applicants/services";
import { approveApplicantAndCreateEmployee, assignEmployeeSite, listEmployees, softDeleteEmployee } from "@/modules/employees/services";
import { bulkMarkAttendance, getMonthlyAttendanceSummary, lockMonthAttendance } from "@/modules/attendance/services";
import { publicCatchMessage } from "@/lib/publicErrors";
import { parseDateValue } from "@/lib/applicantFormFields";
import {
  deleteWorkProgressReport,
  listWorkProgressReports,
  saveWorkProgressReport,
} from "@/modules/workProgress/services";

async function verifyTenantSession(companySlug: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized: Sign in required.");
  }

  const user = session.user as any;
  const company = await prisma.company.findUnique({
    where: { slug: companySlug },
  });
  if (!company) throw new Error("Company not found.");

  // Multi-tenancy rule: SUPER_ADMIN can view all, COMPANY_ADMIN only their company
  if (user.role !== Role.SUPER_ADMIN && user.companyId !== company.id) {
    throw new Error("Forbidden: You do not have access to this company's books.");
  }

  return { user, company };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;
    const { company } = await verifyTenantSession(companySlug);

    const { searchParams } = new URL(request.url);
    const module = searchParams.get("module") || "applicants";

    if (module === "applicants") {
      const status = searchParams.get("status") as any;
      const search = searchParams.get("search") || undefined;
      const page = Number(searchParams.get("page")) || 1;
      const data = await listApplicants({
        companyId: company.id,
        status,
        search,
        page,
      });
      return NextResponse.json(data);
    }

    if (module === "employees") {
      const search = searchParams.get("search") || undefined;
      const siteId = searchParams.get("siteId") || undefined;
      const page = Number(searchParams.get("page")) || 1;
      const data = await listEmployees({
        companyId: company.id,
        siteId,
        search,
        page,
      });
      return NextResponse.json(data);
    }

    if (module === "attendance") {
      const monthKey = searchParams.get("monthKey") || new Date().toISOString().slice(0, 7);
      const siteId = searchParams.get("siteId") || undefined;
      const data = await getMonthlyAttendanceSummary({
        companyId: company.id,
        monthKey,
        siteId,
      });
      return NextResponse.json(data);
    }

    if (module === "progress") {
      const reports = await listWorkProgressReports(company.id);
      return NextResponse.json({ reports });
    }

    if (module === "crm") {
      const contracts = await prisma.contract.findMany({
        where: { companyId: company.id, deletedAt: null },
        include: { _count: { select: { invoices: true, purchases: true } } },
        orderBy: { createdAt: "desc" },
      });
      const sites = await prisma.site.findMany({
        where: { companyId: company.id, active: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ contracts, sites });
    }

    if (module === "accounts") {
      const invoices = await prisma.invoice.findMany({
        where: { companyId: company.id, deletedAt: null },
        include: { contract: true, lines: true },
        orderBy: { createdAt: "desc" },
      });
      const contracts = await prisma.contract.findMany({
        where: { companyId: company.id, deletedAt: null },
        select: { id: true, clientName: true, agreementNo: true, workName: true },
        orderBy: { clientName: "asc" },
      });
      return NextResponse.json({ invoices, contracts });
    }

    if (module === "procurement") {
      const purchases = await prisma.purchase.findMany({
        where: { companyId: company.id, deletedAt: null },
        include: { contract: true },
        orderBy: { purchaseDate: "desc" },
      });
      const contracts = await prisma.contract.findMany({
        where: { companyId: company.id, deletedAt: null },
        select: { id: true, clientName: true, workName: true },
      });
      return NextResponse.json({ purchases, contracts });
    }

    if (module === "finance") {
      const entries = await prisma.ledgerEntry.findMany({
        where: { companyId: company.id },
        orderBy: { entryDate: "desc" },
      });
      const totalCredit = entries.reduce((acc, curr) => acc + Number(curr.creditAmount), 0);
      const totalDebit = entries.reduce((acc, curr) => acc + Number(curr.debitAmount), 0);
      return NextResponse.json({ entries, totalCredit, totalDebit, balance: totalCredit - totalDebit });
    }

    return NextResponse.json({ error: "Invalid module." }, { status: 400 });
  } catch (error: any) {
    const message = String(error?.message || "");
    const status = message.includes("Unauthorized") ? 401 : message.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: publicCatchMessage(error) }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companySlug: string }> }
) {
  try {
    const { companySlug } = await params;
    const { user, company } = await verifyTenantSession(companySlug);
    const body = await request.json();

    if (body.action === "SAVE_OFFICE_ID") {
      const data = await saveOfficeApplicantId({
        companyId: company.id,
        applicantId: body.applicantId,
        officeApplicantId: String(body.officeApplicantId || ""),
      });
      return NextResponse.json(data);
    }

    if (body.action === "ADD_REMARK") {
      const data = await addApplicantRemark({
        companyId: company.id,
        userId: user.id,
        applicantId: body.applicantId,
        remark: body.remark,
      });
      return NextResponse.json(data);
    }

    if (body.action === "UPDATE_STATUS") {
      const data = await updateApplicantStatus({
        companyId: company.id,
        userId: user.id,
        applicantId: body.applicantId,
        newStatus: body.newStatus,
        remark: body.remark,
        siteId: body.siteId,
        temporaryId: body.temporaryId,
        otherSiteName: body.otherSiteName,
      });
      return NextResponse.json(data);
    }

    if (body.action === "APPROVE_CONVERT") {
      const data = await approveApplicantAndCreateEmployee({
        companyId: company.id,
        userId: user.id,
        applicantId: body.applicantId,
        siteId: body.siteId,
        basicRate: Number(body.basicRate),
        divisorDays: Number(body.divisorDays) || 26,
        uan: body.uan,
        esicNo: body.esicNo,
        bankName: body.bankName,
        accountNo: body.accountNo,
        ifsc: body.ifsc,
        branchName: body.branchName,
        securityMoney: body.securityMoney,
        remark: body.remark,
        officeApplicantId: body.officeApplicantId,
        employeeKind: body.employeeKind,
      });
      return NextResponse.json(data);
    }

    if (body.action === "ASSIGN_SITE") {
      const data = await assignEmployeeSite({
        companyId: company.id,
        userId: user.id,
        employeeId: body.employeeId,
        siteId: body.siteId,
      });
      return NextResponse.json(data);
    }

    if (body.action === "DELETE_APPLICANT") {
      const data = await softDeleteApplicant({
        companyId: company.id,
        userId: user.id,
        applicantId: body.applicantId,
      });
      return NextResponse.json(data);
    }

    if (body.action === "SOFT_DELETE_EMPLOYEE") {
      const data = await softDeleteEmployee({
        companyId: company.id,
        userId: user.id,
        employeeId: body.employeeId,
        reason: body.reason || "Terminated by admin",
      });
      return NextResponse.json(data);
    }

    if (body.action === "BULK_ATTENDANCE") {
      const data = await bulkMarkAttendance({
        companyId: company.id,
        markedBy: user.name || user.email,
        entries: body.entries,
      });
      return NextResponse.json(data);
    }

    if (body.action === "LOCK_MONTH") {
      const data = await lockMonthAttendance({
        companyId: company.id,
        monthKey: body.monthKey,
        lockedBy: user.name || user.email,
      });
      return NextResponse.json(data);
    }

    if (body.action === "CREATE_CONTRACT") {
      const contract = await prisma.contract.create({
        data: {
          companyId: company.id,
          clientName: body.clientName || "",
          workLocation: body.workLocation || null,
          departmentName: body.departmentName || null,
          contractType: body.contractType || "A",
          workName: body.workName || null,
          agreementNo: body.agreementNo || null,

          // Tender & EMD Breakdown
          tenderNo: body.tenderNo || null,
          tenderOpening: parseDateValue(body.tenderOpening),
          estimateCost: body.estimateCost ? Number(body.estimateCost) : null,
          tenderAmount: body.tenderAmount ? Number(body.tenderAmount) : null,

          emdAmount: body.emdAmount ? Number(body.emdAmount) : null,
          emdPercent: body.emdPercent ? Number(body.emdPercent) : null,
          emdMode: body.emdMode || null,
          emdInstrumentNo: body.emdInstrumentNo || null,
          emdFdNo: body.emdFdNo || null,
          emdDate: parseDateValue(body.emdDate),
          emdBankName: body.emdBankName || null,
          emdStatus: body.emdStatus || "SUBMITTED",
          emdRefundDate: parseDateValue(body.emdRefundDate),
          emdRefundRef: body.emdRefundRef || null,
          emdRegdSerialNo: body.emdRegdSerialNo || null,
          favouring: body.favouring || null,
          emdMaturityDate: parseDateValue(body.emdMaturityDate),
          emdMaturityInstrumentNo: body.emdMaturityInstrumentNo || null,
          emdMaturityFdNo: body.emdMaturityFdNo || null,
          emdMaturityAmount: body.emdMaturityAmount ? Number(body.emdMaturityAmount) : null,
          emdReleaseFdNo: body.emdReleaseFdNo || null,
          emdReleaseAmount: body.emdReleaseAmount ? Number(body.emdReleaseAmount) : null,
          emdEstimateDetails: body.emdEstimateDetails || null,
          agencyName: body.agencyName || null,
          applicantAccount: body.applicantAccount || null,
          makeAgency: body.makeAgency || null,
          applicantAgency: body.applicantAgency || null,
          emdRemark: body.emdRemark || null,
          pgRemark: body.pgRemark || null,
          pgTenderDetails: body.pgTenderDetails || null,

          // PG Breakdown
          pgAmount: body.pgAmount ? Number(body.pgAmount) : null,
          pgPercent: body.pgPercent ? Number(body.pgPercent) : null,
          pgMode: body.pgMode || null,
          pgInstrumentNo: body.pgInstrumentNo || null,
          pgBankName: body.pgBankName || null,
          pgDate: parseDateValue(body.pgDate),
          pgExpiryDate: parseDateValue(body.pgExpiryDate),
          pgClaimDate: parseDateValue(body.pgClaimDate),
          pgStatus: body.pgStatus || "SUBMITTED",
          pgReleaseDate: parseDateValue(body.pgReleaseDate),
          pgReleaseRef: body.pgReleaseRef || null,
          pgRegdSerialNo: body.pgRegdSerialNo || null,
          pgMaturityInstrumentNo: body.pgMaturityInstrumentNo || null,
          pgMaturityAmount: body.pgMaturityAmount ? Number(body.pgMaturityAmount) : null,
          pgReleaseAmount: body.pgReleaseAmount ? Number(body.pgReleaseAmount) : null,
          pgFdNo: body.pgFdNo || null,
          pgBgNo: body.pgBgNo || null,
          pgMaturityFdNo: body.pgMaturityFdNo || null,
          pgMaturityBgNo: body.pgMaturityBgNo || null,
          pgReleaseFdNo: body.pgReleaseFdNo || null,
          pgReleaseBgNo: body.pgReleaseBgNo || null,
          regRef: body.regRef || null,
          workingDays: body.workingDays || null,
          awardedDate: parseDateValue(body.awardedDate),
          pgLetterStatus: body.pgLetterStatus || null,
          workOrderStatus: body.workOrderStatus || null,
          workPayments: Array.isArray(body.workPayments) ? body.workPayments : undefined,

          // Execution & Register Reference
          measurementBookNo: body.measurementBookNo || null,
          lccNo: body.lccNo || null,
          startAgreement: parseDateValue(body.startAgreement),
          startActual: parseDateValue(body.startActual),
          completionAgreement: parseDateValue(body.completionAgreement),
          completionActual: parseDateValue(body.completionActual),
          workStatus: body.workStatus || "IN_PROGRESS",

          // Billing, Deductions & Recoveries Breakdown
          billNumber: body.billNumber || null,
          billDate: parseDateValue(body.billDate),
          grossAmount: body.grossAmount ? Number(body.grossAmount) : null,
          securityDeposit: body.securityDeposit ? Number(body.securityDeposit) : null,
          incomeTaxTds: body.incomeTaxTds ? Number(body.incomeTaxTds) : null,
          gstRecovery: body.gstRecovery ? Number(body.gstRecovery) : null,
          labourCess: body.labourCess ? Number(body.labourCess) : null,
          waterCharge: body.waterCharge ? Number(body.waterCharge) : null,
          esiPfDeduction: body.esiPfDeduction ? Number(body.esiPfDeduction) : null,
          withheldAmount: body.withheldAmount ? Number(body.withheldAmount) : null,
          otherRecovery: body.otherRecovery ? Number(body.otherRecovery) : null,
          totalDeductions: body.totalDeductions ? Number(body.totalDeductions) : null,
          netAmount: body.netAmount ? Number(body.netAmount) : null,

          // Payment & Vouchers
          voucherNumber: body.voucherNumber || null,
          bankReceivedDate: parseDateValue(body.bankReceivedDate),
          reimburseDate: parseDateValue(body.reimburseDate),
          otherDetails: body.otherDetails || null,
          remarks: body.remarks || null,
        },
      });
      return NextResponse.json(contract);
    }

    if (body.action === "UPDATE_CONTRACT") {
      const contract = await prisma.contract.update({
        where: { id: body.id, companyId: company.id },
        data: {
          clientName: body.clientName || "",
          workLocation: body.workLocation || null,
          departmentName: body.departmentName || null,
          contractType: body.contractType || "A",
          workName: body.workName || null,
          agreementNo: body.agreementNo || null,

          // Tender & EMD Breakdown
          tenderNo: body.tenderNo || null,
          tenderOpening: parseDateValue(body.tenderOpening),
          estimateCost: body.estimateCost ? Number(body.estimateCost) : null,
          tenderAmount: body.tenderAmount ? Number(body.tenderAmount) : null,

          emdAmount: body.emdAmount ? Number(body.emdAmount) : null,
          emdPercent: body.emdPercent ? Number(body.emdPercent) : null,
          emdMode: body.emdMode || null,
          emdInstrumentNo: body.emdInstrumentNo || null,
          emdFdNo: body.emdFdNo || null,
          emdDate: parseDateValue(body.emdDate),
          emdBankName: body.emdBankName || null,
          emdStatus: body.emdStatus || "SUBMITTED",
          emdRefundDate: parseDateValue(body.emdRefundDate),
          emdRefundRef: body.emdRefundRef || null,
          emdRegdSerialNo: body.emdRegdSerialNo || null,
          favouring: body.favouring || null,
          emdMaturityDate: parseDateValue(body.emdMaturityDate),
          emdMaturityInstrumentNo: body.emdMaturityInstrumentNo || null,
          emdMaturityFdNo: body.emdMaturityFdNo || null,
          emdMaturityAmount: body.emdMaturityAmount ? Number(body.emdMaturityAmount) : null,
          emdReleaseFdNo: body.emdReleaseFdNo || null,
          emdReleaseAmount: body.emdReleaseAmount ? Number(body.emdReleaseAmount) : null,
          emdEstimateDetails: body.emdEstimateDetails || null,
          agencyName: body.agencyName || null,
          applicantAccount: body.applicantAccount || null,
          makeAgency: body.makeAgency || null,
          applicantAgency: body.applicantAgency || null,
          emdRemark: body.emdRemark || null,
          pgRemark: body.pgRemark || null,
          pgTenderDetails: body.pgTenderDetails || null,

          // PG Breakdown
          pgAmount: body.pgAmount ? Number(body.pgAmount) : null,
          pgPercent: body.pgPercent ? Number(body.pgPercent) : null,
          pgMode: body.pgMode || null,
          pgInstrumentNo: body.pgInstrumentNo || null,
          pgBankName: body.pgBankName || null,
          pgDate: parseDateValue(body.pgDate),
          pgExpiryDate: parseDateValue(body.pgExpiryDate),
          pgClaimDate: parseDateValue(body.pgClaimDate),
          pgStatus: body.pgStatus || "SUBMITTED",
          pgReleaseDate: parseDateValue(body.pgReleaseDate),
          pgReleaseRef: body.pgReleaseRef || null,
          pgRegdSerialNo: body.pgRegdSerialNo || null,
          pgMaturityInstrumentNo: body.pgMaturityInstrumentNo || null,
          pgMaturityAmount: body.pgMaturityAmount ? Number(body.pgMaturityAmount) : null,
          pgReleaseAmount: body.pgReleaseAmount ? Number(body.pgReleaseAmount) : null,
          pgFdNo: body.pgFdNo || null,
          pgBgNo: body.pgBgNo || null,
          pgMaturityFdNo: body.pgMaturityFdNo || null,
          pgMaturityBgNo: body.pgMaturityBgNo || null,
          pgReleaseFdNo: body.pgReleaseFdNo || null,
          pgReleaseBgNo: body.pgReleaseBgNo || null,
          regRef: body.regRef || null,
          workingDays: body.workingDays || null,
          awardedDate: parseDateValue(body.awardedDate),
          pgLetterStatus: body.pgLetterStatus || null,
          workOrderStatus: body.workOrderStatus || null,
          workPayments: Array.isArray(body.workPayments) ? body.workPayments : undefined,

          // Execution & Register Reference
          measurementBookNo: body.measurementBookNo || null,
          lccNo: body.lccNo || null,
          startAgreement: parseDateValue(body.startAgreement),
          startActual: parseDateValue(body.startActual),
          completionAgreement: parseDateValue(body.completionAgreement),
          completionActual: parseDateValue(body.completionActual),
          workStatus: body.workStatus || "IN_PROGRESS",

          // Billing, Deductions & Recoveries Breakdown
          billNumber: body.billNumber || null,
          billDate: parseDateValue(body.billDate),
          grossAmount: body.grossAmount ? Number(body.grossAmount) : null,
          securityDeposit: body.securityDeposit ? Number(body.securityDeposit) : null,
          incomeTaxTds: body.incomeTaxTds ? Number(body.incomeTaxTds) : null,
          gstRecovery: body.gstRecovery ? Number(body.gstRecovery) : null,
          labourCess: body.labourCess ? Number(body.labourCess) : null,
          waterCharge: body.waterCharge ? Number(body.waterCharge) : null,
          esiPfDeduction: body.esiPfDeduction ? Number(body.esiPfDeduction) : null,
          withheldAmount: body.withheldAmount ? Number(body.withheldAmount) : null,
          otherRecovery: body.otherRecovery ? Number(body.otherRecovery) : null,
          totalDeductions: body.totalDeductions ? Number(body.totalDeductions) : null,
          netAmount: body.netAmount ? Number(body.netAmount) : null,

          // Payment & Vouchers
          voucherNumber: body.voucherNumber || null,
          bankReceivedDate: parseDateValue(body.bankReceivedDate),
          reimburseDate: parseDateValue(body.reimburseDate),
          otherDetails: body.otherDetails || null,
          remarks: body.remarks || null,
        },
      });
      return NextResponse.json(contract);
    }

    if (body.action === "DELETE_CONTRACT") {
      await prisma.contract.update({
        where: { id: body.id, companyId: company.id },
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === "CREATE_PROGRESS_REPORT" || body.action === "UPDATE_PROGRESS_REPORT") {
      const report = await saveWorkProgressReport(company.id, {
        id: body.action === "UPDATE_PROGRESS_REPORT" ? body.id : undefined,
        nameOfWork: body.nameOfWork || "",
        department: body.department || "",
        situation: body.situation || "",
        stipulatedStart: parseDateValue(body.stipulatedStart),
        actualStart: parseDateValue(body.actualStart),
        stipulatedCompletion: parseDateValue(body.stipulatedCompletion),
        actualCompletion: parseDateValue(body.actualCompletion),
        workStatus: body.workStatus || "Under progress",
        agencyName: body.agencyName || "",
        reportDate: parseDateValue(body.reportDate),
        balanceDate: parseDateValue(body.balanceDate),
        lessPercent: body.lessPercent === "" || body.lessPercent == null ? 0.96 : Number(body.lessPercent),
        adjustKind: String(body.adjustKind || "LESS").toUpperCase() === "ADD" ? "ADD" : "LESS",
        sdPercent: body.sdPercent === "" || body.sdPercent == null ? 2.5 : Number(body.sdPercent),
        itPercent: body.itPercent === "" || body.itPercent == null ? 2 : Number(body.itPercent),
        gstPercent: body.gstPercent === "" || body.gstPercent == null ? 2 : Number(body.gstPercent),
        labourCessPercent: body.labourCessPercent === "" || body.labourCessPercent == null ? 1 : Number(body.labourCessPercent),
        raBills: Array.isArray(body.raBills) ? body.raBills.filter(Boolean) : [],
        raNotes: body.raNotes && typeof body.raNotes === "object" ? body.raNotes : {},
        items: Array.isArray(body.items) ? body.items : [],
        note: body.note || null,
      });
      return NextResponse.json(report);
    }

    if (body.action === "DELETE_PROGRESS_REPORT") {
      await deleteWorkProgressReport(company.id, body.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === "CREATE_INVOICE") {
      const { createWageInvoice } = await import("@/modules/invoices/services");
      const invoice = await createWageInvoice(company.id, body);
      return NextResponse.json(invoice);
    }

    if (body.action === "CREATE_PURCHASE") {
      const purchase = await prisma.purchase.create({
        data: {
          companyId: company.id,
          contractId: body.contractId || null,
          itemName: body.itemName,
          vendorName: body.vendorName,
          amount: Number(body.amount),
          invoiceNo: body.invoiceNo || null,
          purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : new Date(),
        },
      });
      return NextResponse.json(purchase);
    }

    if (body.action === "CREATE_LEDGER_ENTRY") {
      const paymentMode = String(body.paymentMode || "CASH").toUpperCase();
      const chequeNo = String(body.chequeNo || "").trim();
      if (!["CASH", "ONLINE", "BANK_TRANSFER", "CHEQUE"].includes(paymentMode)) {
        return NextResponse.json({ error: "Choose how the money was paid." }, { status: 400 });
      }
      if (paymentMode === "CHEQUE" && !chequeNo) {
        return NextResponse.json({ error: "Cheque number is required." }, { status: 400 });
      }
      const entryId = crypto.randomUUID();
      const entryDate = body.entryDate ? new Date(body.entryDate) : new Date();
      await prisma.$executeRaw`
        INSERT INTO ledger_entries (
          id, company_id, entry_date, narration, voucher_number,
          debit_amount, credit_amount, category, payment_mode, cheque_no, created_at
        ) VALUES (
          ${entryId}, ${company.id}, ${entryDate}, ${String(body.narration || "")},
          ${body.voucherNumber || null}, ${Number(body.debitAmount || 0)},
          ${Number(body.creditAmount || 0)}, ${body.category || "GENERAL"},
          ${paymentMode}, ${paymentMode === "CHEQUE" ? chequeNo : null}, NOW()
        )
      `;
      return NextResponse.json({ id: entryId, paymentMode, chequeNo: paymentMode === "CHEQUE" ? chequeNo : null });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    const message = String(error?.message || "");
    const status = message.includes("Unauthorized") ? 401 : message.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: publicCatchMessage(error) }, { status });
  }
}
