import { formatDateDmy } from "@/lib/applicantFormFields";
import {
  emdIssueDdNo,
  emdIssueFdNo,
  emdMaturityDdNo,
  emdMaturityFdNo,
  emdReleaseDdNo,
  emdReleaseFdNo,
} from "@/lib/downloadEmdRegisterExcel";
import {
  pgIssueBgNo,
  pgIssueFdNo,
  pgMaturityBgNo,
  pgMaturityFdNo,
  pgReleaseBgNo,
  pgReleaseFdNo,
} from "@/lib/downloadPgRegisterExcel";
import {
  emptyWorkPayment,
  paymentLineHasValue,
  workPaymentLines,
} from "@/lib/downloadWorkRegisterExcel";

function money(value: unknown) {
  const n = Number(value);
  if (!value && value !== 0) return "";
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function text(value: unknown) {
  return value == null || value === "" ? "" : String(value);
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadJsPdf() {
  const jspdfMod: any = await import("jspdf");
  const jsPDF = jspdfMod.jsPDF ?? jspdfMod.default;
  if (!jsPDF) throw new Error("PDF library did not load.");
  return jsPDF;
}

function drawGrid(
  pdf: any,
  {
    title,
    pageW,
    pageH,
    colWidths,
    headerRows,
    bodyRows,
  }: {
    title: string;
    pageW: number;
    pageH: number;
    colWidths: number[];
    headerRows: string[][];
    bodyRows: string[][];
  },
) {
  const margin = 6;
  const innerW = pageW - margin * 2;
  const total = colWidths.reduce((sum, w) => sum + w, 0);
  const widths = colWidths.map((w) => (w / total) * innerW);
  const headerH = 7.2;
  const rowH = 6.4;
  let y = 8;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(title, pageW / 2, y, { align: "center" });
  y += 5;

  const drawRow = (cells: string[], height: number, bold: boolean, size: number) => {
    if (y + height > pageH - margin) {
      pdf.addPage([pageW, pageH], "landscape");
      y = margin;
    }
    let x = margin;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    cells.forEach((cell, i) => {
      const w = widths[i] || 8;
      pdf.rect(x, y, w, height);
      const lines = pdf.splitTextToSize(String(cell || ""), Math.max(w - 1, 2));
      pdf.text(lines.slice(0, 3), x + 0.5, y + 2.1);
      x += w;
    });
    y += height;
  };

  headerRows.forEach((row) => drawRow(row, headerH, true, 5));
  bodyRows.forEach((row) => drawRow(row, rowH, false, 5));
}

export async function downloadWorkRegisterPdf({
  companyName,
  rows,
}: {
  companyName: string;
  rows: any[];
}) {
  const jsPDF = await loadJsPdf();
  const pageW = 520;
  const pageH = 210;
  const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "landscape" });
  const header1 = [
    "1 Sl. No.",
    "2 Reg. Ref.",
    "3 Department/ Division",
    "4 Name of work",
    "5 Agmt./W.O. No.",
    "6 Awarded Date",
    "7 Working Period",
    "8 Tender Amount",
    "9 Estimate Cost",
    "10 EMD Amount",
    "11 EMD Date",
    "12 P.G. Amount",
    "13 P.G. Date",
    "14 Start Agmt.",
    "15 Start Actual",
    "16 Comp. Agmt.",
    "17 Comp. Actual",
    "18 R.A. Bill No.",
    "19 M.B. No.",
    "20 Bill No.",
    "21 Bill Date",
    "22 Gross / Bill Amount",
    "23 Taxable Amount",
    "24 GST of Bill",
    "25 S.D.",
    "26 TDS IT",
    "27 TDS GST",
    "28 Labour Cess",
    "29 Edu. Cess",
    "30 Water Charge",
    "31 Withheld Amount",
    "32 withheld reason",
    "33 Net Amount",
    "34 Voucher No.",
    "35 Date",
    "36 EPFO",
    "37 ESIC",
    "38 Amount",
    "39 Date of payment",
    "40 Bank Recived Date",
    "41 Other",
    "42 Remarks",
  ];
  const body: string[][] = [];
  rows.forEach((row, index) => {
    const lines = workPaymentLines(row).filter(paymentLineHasValue);
    const billLines = lines.length ? lines : [emptyWorkPayment("")];
    billLines.forEach((line, lineIndex) => {
      const header = lineIndex === 0;
      body.push([
        header ? String(index + 1) : "",
        header ? text(row.regRef) : "",
        header ? text(row.departmentName) : "",
        header ? text(row.workName) : "",
        header ? text(row.agreementNo) : "",
        header && row.awardedDate ? formatDateDmy(row.awardedDate, "") : "",
        header ? text(row.workingDays) : "",
        header ? String(money(row.tenderAmount)) : "",
        header ? String(money(row.estimateCost)) : "",
        header ? String(money(row.emdAmount)) : "",
        header && row.emdDate ? formatDateDmy(row.emdDate, "") : "",
        header ? String(money(row.pgAmount)) : "",
        header && row.pgDate ? formatDateDmy(row.pgDate, "") : "",
        header && row.startAgreement ? formatDateDmy(row.startAgreement, "") : "",
        header && row.startActual ? formatDateDmy(row.startActual, "") : "",
        header && row.completionAgreement ? formatDateDmy(row.completionAgreement, "") : "",
        header && row.completionActual ? formatDateDmy(row.completionActual, "") : "",
        text(line.raBillNo),
        text(line.mbNo),
        text(line.billNumber),
        line.billDate ? formatDateDmy(line.billDate, "") : "",
        String(money(line.grossAmount)),
        String(money(line.taxableAmount)),
        String(money(line.gstAmountOfBill)),
        String(money(line.sdAmount)),
        String(money(line.itAmount)),
        String(money(line.gstAmount)),
        String(money(line.labourCess)),
        String(money(line.eduCess)),
        String(money(line.waterCharge)),
        String(money(line.withheldAmount)),
        text(line.withheldReason),
        String(money(line.netAmount)),
        text(line.voucherNo),
        line.voucherDate ? formatDateDmy(line.voucherDate, "") : "",
        String(money(line.epfo)),
        String(money(line.esic)),
        String(money(line.reimburseAmount)),
        line.dateOfPayment ? formatDateDmy(line.dateOfPayment, "") : "",
        line.bankReceivedDate ? formatDateDmy(line.bankReceivedDate, "") : "",
        header ? text(row.otherDetails) : "",
        header ? text(row.remarks) : "",
      ]);
    });
  });
  drawGrid(pdf, {
    title: `WORK REGISTER ( ${companyName} )`,
    pageW,
    pageH,
    colWidths: [
      8, 12, 16, 28, 16, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 10, 10, 12, 12, 12, 12, 10, 10, 10, 10, 10,
      10, 10, 14, 12, 12, 12, 10, 10, 10, 12, 12, 12, 16,
    ],
    headerRows: [header1],
    bodyRows: body,
  });
  saveBlob(pdf.output("blob"), `Work Register ${companyName}.pdf`);
}

export async function downloadEmdRegisterPdf({
  companyName,
  rows,
}: {
  companyName: string;
  rows: any[];
}) {
  const jsPDF = await loadJsPdf();
  const pageW = 420;
  const pageH = 210;
  const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "landscape" });
  const body = rows.map((row, index) => [
    String(index + 1),
    text(row.emdRegdSerialNo),
    text(row.departmentName),
    text(row.tenderNo),
    text(row.workName),
    String(money(row.estimateCost)),
    String(money(row.tenderAmount)),
    text(row.favouring),
    emdIssueFdNo(row),
    emdIssueDdNo(row),
    row.emdDate ? formatDateDmy(row.emdDate, "") : "",
    String(money(row.emdAmount)),
    text(row.emdBankName),
    emdMaturityFdNo(row),
    emdMaturityDdNo(row),
    row.emdMaturityDate ? formatDateDmy(row.emdMaturityDate, "") : "",
    String(money(row.emdMaturityAmount)),
    emdReleaseFdNo(row),
    emdReleaseDdNo(row),
    row.emdRefundDate ? formatDateDmy(row.emdRefundDate, "") : "",
    String(money(row.emdReleaseAmount)),
    text(row.makeAgency || row.agencyName),
    text(row.applicantAgency || row.applicantAccount),
    text(row.emdRemark || row.remarks || row.emdStatus),
  ]);
  drawGrid(pdf, {
    title: `EMD Register ( ${companyName} )`,
    pageW,
    pageH,
    colWidths: [8, 10, 16, 16, 32, 12, 12, 14, 12, 12, 12, 12, 16, 12, 12, 12, 12, 12, 12, 12, 12, 14, 14, 16],
    headerRows: [
      [
        "SL NO.",
        "Reg Sl No",
        "Department / Division",
        "NIT No.",
        "Name of Work",
        "Estimate Cost",
        "Tender Amount",
        "Favouring",
        "Issue FD No.",
        "Issue DD No.",
        "Issue Date",
        "Issue Amount",
        "Bank Name",
        "Maturity FD No.",
        "Maturity DD No.",
        "Maturity Date",
        "Maturity Amount",
        "Release FD No.",
        "Release DD No.",
        "Release Date",
        "Release Amount",
        "Make Agency",
        "Applicant Agency",
        "Remark/Status",
      ],
    ],
    bodyRows: body,
  });
  saveBlob(pdf.output("blob"), `EMD register ${companyName}.pdf`);
}

export async function downloadPgRegisterPdf({
  companyName,
  rows,
}: {
  companyName: string;
  rows: any[];
}) {
  const jsPDF = await loadJsPdf();
  const pageW = 420;
  const pageH = 210;
  const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "landscape" });
  const body = rows.map((row, index) => [
    String(index + 1),
    text(row.pgRegdSerialNo || row.emdRegdSerialNo),
    text(row.departmentName),
    text(row.tenderNo),
    text(row.workName),
    String(money(row.estimateCost) || text(row.emdEstimateDetails)),
    String(money(row.tenderAmount)),
    text(row.favouring),
    pgIssueFdNo(row),
    pgIssueBgNo(row),
    row.pgDate ? formatDateDmy(row.pgDate, "") : "",
    String(money(row.pgAmount)),
    text(row.pgBankName),
    pgMaturityFdNo(row),
    pgMaturityBgNo(row),
    row.pgExpiryDate ? formatDateDmy(row.pgExpiryDate, "") : "",
    String(money(row.pgMaturityAmount)),
    pgReleaseFdNo(row),
    pgReleaseBgNo(row),
    row.pgReleaseDate ? formatDateDmy(row.pgReleaseDate, "") : "",
    String(money(row.pgReleaseAmount)),
    text(row.makeAgency || row.agencyName),
    text(row.applicantAgency),
    text(row.pgRemark || row.remarks || row.pgStatus),
  ]);
  drawGrid(pdf, {
    title: `Performance Guarantee(P.G.) Register ( ${companyName} )`,
    pageW,
    pageH,
    colWidths: [8, 10, 16, 16, 32, 12, 12, 14, 12, 12, 12, 12, 16, 12, 12, 12, 12, 12, 12, 12, 12, 14, 14, 16],
    headerRows: [
      [
        "SL NO.",
        "Reg Sl No",
        "Department / Division",
        "NIT No.",
        "Name of Work",
        "Estimate Cost",
        "Contract Amount",
        "Favouring",
        "Issue FD No.",
        "Issue BG No.",
        "Issue Date",
        "Issue Amount",
        "Bank Name",
        "Maturity FD No.",
        "Maturity BG No.",
        "Maturity Date",
        "Maturity Amount",
        "Release FD No.",
        "Release BG No.",
        "Release Date",
        "Release Amount",
        "Make Agency",
        "Applicant Agency",
        "Remark/Status",
      ],
    ],
    bodyRows: body,
  });
  saveBlob(pdf.output("blob"), `PG register ${companyName}.pdf`);
}
