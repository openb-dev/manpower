import ExcelJS from "exceljs";
import { formatDateDmy } from "@/lib/applicantFormFields";

function money(value: unknown) {
  const n = Number(value);
  if (!value && value !== 0) return "";
  if (Number.isNaN(n)) return "";
  return n;
}

function text(value: unknown) {
  return value == null || value === "" ? "" : String(value);
}

export const RA_BILL_NOS = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
] as const;

export type WorkPaymentLine = {
  raBillNo?: string;
  mbNo?: string;
  billNumber?: string;
  billDate?: string | null;
  grossAmount?: unknown;
  taxableAmount?: unknown;
  gstAmountOfBill?: unknown;
  sdAmount?: unknown;
  itAmount?: unknown;
  gstAmount?: unknown;
  labourCess?: unknown;
  eduCess?: unknown;
  waterCharge?: unknown;
  withheldAmount?: unknown;
  withheldReason?: string;
  netAmount?: unknown;
  voucherNo?: string;
  voucherDate?: string | null;
  epfo?: unknown;
  esic?: unknown;
  reimburseAmount?: unknown;
  dateOfPayment?: string | null;
  bankReceivedDate?: string | null;
  partOfPayment?: string;
  receiveDate?: string | null;
  extraCharge?: unknown;
  wbCess?: unknown;
  status?: string;
};

export function emptyWorkPayment(raBillNo = ""): WorkPaymentLine {
  return {
    raBillNo,
    mbNo: "",
    billNumber: "",
    billDate: "",
    grossAmount: "",
    taxableAmount: "",
    gstAmountOfBill: "",
    sdAmount: "",
    itAmount: "",
    gstAmount: "",
    labourCess: "",
    eduCess: "",
    waterCharge: "",
    withheldAmount: "",
    withheldReason: "",
    netAmount: "",
    voucherNo: "",
    voucherDate: "",
    epfo: "",
    esic: "",
    reimburseAmount: "",
    dateOfPayment: "",
    bankReceivedDate: "",
  };
}

function lineOf(raw: any): WorkPaymentLine {
  return {
    ...emptyWorkPayment(""),
    raBillNo: text(raw?.raBillNo || raw?.partOfPayment),
    mbNo: text(raw?.mbNo),
    billNumber: text(raw?.billNumber),
    billDate: raw?.billDate || "",
    grossAmount: raw?.grossAmount ?? "",
    taxableAmount: raw?.taxableAmount ?? "",
    gstAmountOfBill: raw?.gstAmountOfBill ?? "",
    sdAmount: raw?.sdAmount ?? "",
    itAmount: raw?.itAmount ?? "",
    gstAmount: raw?.gstAmount ?? "",
    labourCess: raw?.labourCess ?? "",
    eduCess: raw?.eduCess ?? raw?.extraCharge ?? "",
    waterCharge: raw?.waterCharge ?? "",
    withheldAmount: raw?.withheldAmount ?? "",
    withheldReason: text(raw?.withheldReason || raw?.status),
    netAmount: raw?.netAmount ?? "",
    voucherNo: text(raw?.voucherNo),
    voucherDate: raw?.voucherDate || "",
    epfo: raw?.epfo ?? "",
    esic: raw?.esic ?? "",
    reimburseAmount: raw?.reimburseAmount ?? "",
    dateOfPayment: raw?.dateOfPayment || "",
    bankReceivedDate: raw?.bankReceivedDate || raw?.receiveDate || "",
  };
}

export function workPaymentLines(row: any): WorkPaymentLine[] {
  const raw = row?.workPayments;
  if (Array.isArray(raw) && raw.length) return raw.map(lineOf);
  if (row?.grossAmount || row?.netAmount || row?.billNumber) {
    return [
      lineOf({
        raBillNo: row.billNumber,
        mbNo: row.measurementBookNo,
        billNumber: row.billNumber,
        billDate: row.billDate,
        grossAmount: row.grossAmount,
        sdAmount: row.securityDeposit,
        itAmount: row.incomeTaxTds,
        gstAmount: row.gstRecovery,
        labourCess: row.labourCess,
        waterCharge: row.waterCharge,
        withheldAmount: row.withheldAmount,
        netAmount: row.netAmount,
        voucherNo: row.voucherNumber,
        bankReceivedDate: row.bankReceivedDate,
        dateOfPayment: row.reimburseDate,
        epfo: row.esiPfDeduction,
      }),
    ];
  }
  return [emptyWorkPayment("")];
}

export function paymentLineHasValue(line: WorkPaymentLine) {
  return Object.values(line).some((value) => value != null && String(value).trim() !== "");
}

export function nextRaBillNo(lines: WorkPaymentLine[]) {
  const used = new Set(lines.map((line) => line.raBillNo));
  return RA_BILL_NOS.find((no) => !used.has(no)) || "";
}

export async function downloadWorkRegisterExcel({
  companyName,
  rows,
}: {
  companyName: string;
  rows: any[];
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Work Register", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });
  const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
  const thin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  sheet.mergeCells("A1:AP1");
  sheet.getCell("A1").value = "WORK REGISTER";
  sheet.getCell("A1").font = { name: "Calibri", size: 16, bold: true };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 22;

  const tallMerges = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "AO", "AP"];
  for (const col of tallMerges) {
    sheet.mergeCells(`${col}2:${col}3`);
  }
  sheet.mergeCells("J2:K2");
  sheet.mergeCells("L2:M2");
  sheet.mergeCells("N2:O2");
  sheet.mergeCells("P2:Q2");
  sheet.mergeCells("R2:X2");
  sheet.mergeCells("Y2:AG2");
  sheet.mergeCells("AH2:AI2");
  sheet.mergeCells("AJ2:AN2");

  const groupHeaders: Array<[string, string]> = [
    ["A2", "Sl. No."],
    ["B2", "Reg. Ref."],
    ["C2", "Department/ Division"],
    ["D2", "Name of work"],
    ["E2", "Agmt./W.O. No."],
    ["F2", "Awarded Date"],
    ["G2", "Working Period"],
    ["H2", "Tender Amount"],
    ["I2", "Estimate Cost"],
    ["J2", "Earnest Money Deposit"],
    ["L2", "Performance Guarantee"],
    ["N2", "Date of Start"],
    ["P2", "Date Of Completion"],
    ["R2", "Bill Details"],
    ["Y2", "Deduction of bill"],
    ["AH2", "Payment recerived details"],
    ["AJ2", "Reimbursement Details"],
    ["AO2", "Other"],
    ["AP2", "Remarks"],
  ];
  for (const [cell, value] of groupHeaders) {
    sheet.getCell(cell).value = value;
  }

  const subHeaders: Array<[string, string]> = [
    ["J3", "EMD Amount"],
    ["K3", "EMD Date"],
    ["L3", "P.G. Amount"],
    ["M3", "P.G. Date"],
    ["N3", "As Per Agmt."],
    ["O3", "As Per Actual"],
    ["P3", "As Per Agmt."],
    ["Q3", "As Per Actual"],
    ["R3", "Running Account Bill (R.A. Bill) No."],
    ["S3", "M.B. No."],
    ["T3", "Bill No."],
    ["U3", "Bill Date"],
    ["V3", "Gross / Bill Amount"],
    ["W3", "Taxable Amount (Without GST)"],
    ["X3", "Total GST Amount of Bill"],
    ["Y3", "Security Deposit (S.D.)"],
    ["Z3", "Income Tax @ 1% or 2% (TDS IT)"],
    ["AA3", "GST @2% (TDS GST)"],
    ["AB3", "Labour welfare Cess"],
    ["AC3", "Edu. Cess"],
    ["AD3", "Water Charge"],
    ["AE3", "Withheld Amount"],
    ["AF3", "withheld reason"],
    ["AG3", "Net Amount"],
    ["AH3", "Voucher No."],
    ["AI3", "Date"],
    ["AJ3", "EPFO"],
    ["AK3", "ESIC"],
    ["AL3", "Amount"],
    ["AM3", "Date of payment"],
    ["AN3", "Bank Recived Date"],
  ];
  for (const [cell, value] of subHeaders) {
    sheet.getCell(cell).value = value;
  }

  const numberRow = sheet.getRow(4);
  for (let i = 1; i <= 42; i++) numberRow.getCell(i).value = i;

  for (const row of [2, 3, 4]) {
    sheet.getRow(row).eachCell((cell) => {
      cell.font = { name: "Calibri", size: 8, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = headerFill;
      cell.border = thin as ExcelJS.Borders;
    });
  }
  sheet.getRow(2).height = 20;
  sheet.getRow(3).height = 36;
  sheet.getRow(4).height = 16;

  const widths = [
    8, 12, 16, 36, 16, 12, 14, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 14, 12, 12, 12, 14, 14, 14, 12, 12, 12, 12, 12,
    12, 12, 16, 12, 12, 12, 10, 10, 12, 12, 14, 12, 16,
  ];
  sheet.columns = widths.map((width) => ({ width }));

  let excelRowNo = 5;
  rows.forEach((row, index) => {
    const lines = workPaymentLines(row).filter(paymentLineHasValue);
    const billLines = lines.length ? lines : [emptyWorkPayment("")];
    const start = excelRowNo;
    billLines.forEach((line, lineIndex) => {
      const header = lineIndex === 0;
      const excelRow = sheet.addRow([
        header ? index + 1 : "",
        header ? text(row.regRef) : "",
        header ? text(row.departmentName) : "",
        header ? text(row.workName) : "",
        header ? text(row.agreementNo) : "",
        header && row.awardedDate ? formatDateDmy(row.awardedDate) : "",
        header ? text(row.workingDays) : "",
        header ? money(row.tenderAmount) : "",
        header ? money(row.estimateCost) : "",
        header ? money(row.emdAmount) : "",
        header && row.emdDate ? formatDateDmy(row.emdDate) : "",
        header ? money(row.pgAmount) : "",
        header && row.pgDate ? formatDateDmy(row.pgDate) : "",
        header && row.startAgreement ? formatDateDmy(row.startAgreement) : "",
        header && row.startActual ? formatDateDmy(row.startActual) : "",
        header && row.completionAgreement ? formatDateDmy(row.completionAgreement) : "",
        header && row.completionActual ? formatDateDmy(row.completionActual) : "",
        text(line.raBillNo),
        text(line.mbNo),
        text(line.billNumber),
        line.billDate ? formatDateDmy(line.billDate) : "",
        money(line.grossAmount),
        money(line.taxableAmount),
        money(line.gstAmountOfBill),
        money(line.sdAmount),
        money(line.itAmount),
        money(line.gstAmount),
        money(line.labourCess),
        money(line.eduCess),
        money(line.waterCharge),
        money(line.withheldAmount),
        text(line.withheldReason),
        money(line.netAmount),
        text(line.voucherNo),
        line.voucherDate ? formatDateDmy(line.voucherDate) : "",
        money(line.epfo),
        money(line.esic),
        money(line.reimburseAmount),
        line.dateOfPayment ? formatDateDmy(line.dateOfPayment) : "",
        line.bankReceivedDate ? formatDateDmy(line.bankReceivedDate) : "",
        header ? text(row.otherDetails) : "",
        header ? text(row.remarks) : "",
      ]);
      excelRow.eachCell((cell) => {
        cell.font = { name: "Calibri", size: 8 };
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = thin as ExcelJS.Borders;
      });
      excelRow.height = 20;
      excelRowNo += 1;
    });
    if (billLines.length > 1) {
      for (const col of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 41, 42]) {
        sheet.mergeCells(start, col, excelRowNo - 1, col);
      }
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Work Register ${companyName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
