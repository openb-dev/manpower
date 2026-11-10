import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";
import { addApplicantRemark, listApplicants, saveOfficeApplicantId, updateApplicantStatus } from "@/modules/applicants/services";
import { approveApplicantAndCreateEmployee, assignEmployeeSite, listEmployees, softDeleteEmployee } from "@/modules/employees/services";
import { bulkMarkAttendance, getMonthlyAttendanceSummary, lockMonthAttendance } from "@/modules/attendance/services";
import { publicCatchMessage } from "@/lib/publicErrors";

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
          clientName: body.clientName,
          departmentName: body.departmentName || null,
          contractType: body.contractType || "A",
          workName: body.workName || null,
          agreementNo: body.agreementNo || null,

          // Tender & EMD Breakdown
          tenderNo: body.tenderNo || null,
          tenderOpening: body.tenderOpening ? new Date(body.tenderOpening) : null,
          estimateCost: body.estimateCost ? Number(body.estimateCost) : null,
          tenderAmount: body.tenderAmount ? Number(body.tenderAmount) : null,

          emdAmount: body.emdAmount ? Number(body.emdAmount) : null,
          emdPercent: body.emdPercent ? Number(body.emdPercent) : null,
          emdMode: body.emdMode || null,
          emdInstrumentNo: body.emdInstrumentNo || null,
          emdDate: body.emdDate ? new Date(body.emdDate) : null,
          emdBankName: body.emdBankName || null,
          emdStatus: body.emdStatus || "SUBMITTED",
          emdRefundDate: body.emdRefundDate ? new Date(body.emdRefundDate) : null,
          emdRefundRef: body.emdRefundRef || null,

          // PG Breakdown
          pgAmount: body.pgAmount ? Number(body.pgAmount) : null,
          pgPercent: body.pgPercent ? Number(body.pgPercent) : null,
          pgMode: body.pgMode || null,
          pgInstrumentNo: body.pgInstrumentNo || null,
          pgBankName: body.pgBankName || null,
          pgDate: body.pgDate ? new Date(body.pgDate) : null,
          pgExpiryDate: body.pgExpiryDate ? new Date(body.pgExpiryDate) : null,
          pgClaimDate: body.pgClaimDate ? new Date(body.pgClaimDate) : null,
          pgStatus: body.pgStatus || "SUBMITTED",
          pgReleaseDate: body.pgReleaseDate ? new Date(body.pgReleaseDate) : null,
          pgReleaseRef: body.pgReleaseRef || null,

          // Execution & Register Reference
          measurementBookNo: body.measurementBookNo || null,
          lccNo: body.lccNo || null,
          startAgreement: body.startAgreement ? new Date(body.startAgreement) : null,
          startActual: body.startActual ? new Date(body.startActual) : null,
          completionAgreement: body.completionAgreement ? new Date(body.completionAgreement) : null,
          completionActual: body.completionActual ? new Date(body.completionActual) : null,
          workStatus: body.workStatus || "IN_PROGRESS",

          // Billing, Deductions & Recoveries Breakdown
          billNumber: body.billNumber || null,
          billDate: body.billDate ? new Date(body.billDate) : null,
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
          bankReceivedDate: body.bankReceivedDate ? new Date(body.bankReceivedDate) : null,
          reimburseDate: body.reimburseDate ? new Date(body.reimburseDate) : null,
          remarks: body.remarks || null,
        },
      });
      return NextResponse.json(contract);
    }

    if (body.action === "UPDATE_CONTRACT") {
      const contract = await prisma.contract.update({
        where: { id: body.id, companyId: company.id },
        data: {
          clientName: body.clientName,
          departmentName: body.departmentName || null,
          contractType: body.contractType || "A",
          workName: body.workName || null,
          agreementNo: body.agreementNo || null,

          // Tender & EMD Breakdown
          tenderNo: body.tenderNo || null,
          tenderOpening: body.tenderOpening ? new Date(body.tenderOpening) : null,
          estimateCost: body.estimateCost ? Number(body.estimateCost) : null,
          tenderAmount: body.tenderAmount ? Number(body.tenderAmount) : null,

          emdAmount: body.emdAmount ? Number(body.emdAmount) : null,
          emdPercent: body.emdPercent ? Number(body.emdPercent) : null,
          emdMode: body.emdMode || null,
          emdInstrumentNo: body.emdInstrumentNo || null,
          emdDate: body.emdDate ? new Date(body.emdDate) : null,
          emdBankName: body.emdBankName || null,
          emdStatus: body.emdStatus || "SUBMITTED",
          emdRefundDate: body.emdRefundDate ? new Date(body.emdRefundDate) : null,
          emdRefundRef: body.emdRefundRef || null,

          // PG Breakdown
          pgAmount: body.pgAmount ? Number(body.pgAmount) : null,
          pgPercent: body.pgPercent ? Number(body.pgPercent) : null,
          pgMode: body.pgMode || null,
          pgInstrumentNo: body.pgInstrumentNo || null,
          pgBankName: body.pgBankName || null,
          pgDate: body.pgDate ? new Date(body.pgDate) : null,
          pgExpiryDate: body.pgExpiryDate ? new Date(body.pgExpiryDate) : null,
          pgClaimDate: body.pgClaimDate ? new Date(body.pgClaimDate) : null,
          pgStatus: body.pgStatus || "SUBMITTED",
          pgReleaseDate: body.pgReleaseDate ? new Date(body.pgReleaseDate) : null,
          pgReleaseRef: body.pgReleaseRef || null,

          // Execution & Register Reference
          measurementBookNo: body.measurementBookNo || null,
          lccNo: body.lccNo || null,
          startAgreement: body.startAgreement ? new Date(body.startAgreement) : null,
          startActual: body.startActual ? new Date(body.startActual) : null,
          completionAgreement: body.completionAgreement ? new Date(body.completionAgreement) : null,
          completionActual: body.completionActual ? new Date(body.completionActual) : null,
          workStatus: body.workStatus || "IN_PROGRESS",

          // Billing, Deductions & Recoveries Breakdown
          billNumber: body.billNumber || null,
          billDate: body.billDate ? new Date(body.billDate) : null,
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
          bankReceivedDate: body.bankReceivedDate ? new Date(body.bankReceivedDate) : null,
          reimburseDate: body.reimburseDate ? new Date(body.reimburseDate) : null,
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
