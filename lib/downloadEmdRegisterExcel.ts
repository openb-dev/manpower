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

export function emdIssueFdNo(row: any) {
  return text(row.emdFdNo);
}

export function emdIssueDdNo(row: any) {
  return text(row.emdInstrumentNo);
}

export function emdMaturityFdNo(row: any) {
  return text(row.emdMaturityFdNo);
}

export function emdMaturityDdNo(row: any) {
  return text(row.emdMaturityInstrumentNo);
}

export function emdReleaseFdNo(row: any) {
  return text(row.emdReleaseFdNo);
}

export function emdReleaseDdNo(row: any) {
  return text(row.emdRefundRef);
}

export async function downloadEmdRegisterExcel({
  companyName,
  rows,
}: {
  companyName: string;
  rows: any[];
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("EMD Register", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });

  sheet.mergeCells("A1:X1");
  const title = sheet.getCell("A1");
  title.value = `EMD Register ( ${companyName} )`;
  title.font = { name: "Arial", size: 14, bold: true };
  title.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 22;

  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9E2F3" },
  };
  const thin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  sheet.mergeCells("A2:A3");
  sheet.mergeCells("B2:B3");
  sheet.mergeCells("C2:C3");
  sheet.mergeCells("D2:D3");
  sheet.mergeCells("E2:E3");
  sheet.mergeCells("F2:F3");
  sheet.mergeCells("G2:G3");
  sheet.mergeCells("H2:H3");
  sheet.mergeCells("I2:M2");
  sheet.mergeCells("N2:Q2");
  sheet.mergeCells("R2:U2");
  sheet.mergeCells("V2:V3");
  sheet.mergeCells("W2:W3");
  sheet.mergeCells("X2:X3");

  const topHeaders: Array<[string, string]> = [
    ["A2", "SL NO."],
    ["B2", "Reg Sl No"],
    ["C2", "Department / Division"],
    ["D2", "NIT No."],
    ["E2", "Name of Work"],
    ["F2", "Estimate Cost"],
    ["G2", "Tender Amount"],
    ["H2", "Favouring"],
    ["I2", "EMD issue Details"],
    ["N2", "EMD Maturity details\n(As per Agreement)"],
    ["R2", "EMD Release details\n(As per Actual)"],
    ["V2", "Make Agency"],
    ["W2", "Applicant Agency"],
    ["X2", "Remark/Status"],
  ];
  for (const [cell, value] of topHeaders) {
    sheet.getCell(cell).value = value;
  }

  sheet.getCell("I3").value = "FD No.";
  sheet.getCell("J3").value = "DD No.";
  sheet.getCell("K3").value = "Date";
  sheet.getCell("L3").value = "Amount";
  sheet.getCell("M3").value = "Bank Name";
  sheet.getCell("N3").value = "FD No.";
  sheet.getCell("O3").value = "DD No.";
  sheet.getCell("P3").value = "Date";
  sheet.getCell("Q3").value = "Amount";
  sheet.getCell("R3").value = "FD No.";
  sheet.getCell("S3").value = "DD No.";
  sheet.getCell("T3").value = "Date";
  sheet.getCell("U3").value = "Amount";

  for (const row of [2, 3]) {
    sheet.getRow(row).eachCell((cell) => {
      cell.font = { name: "Arial", size: 8, bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = headerFill;
      cell.border = thin as ExcelJS.Borders;
    });
  }
  sheet.getRow(2).height = 28;
  sheet.getRow(3).height = 18;

  sheet.columns = [
    { width: 7 },
    { width: 10 },
    { width: 16 },
    { width: 16 },
    { width: 36 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
  ];

  rows.forEach((row, index) => {
    const excelRow = sheet.addRow([
      index + 1,
      text(row.emdRegdSerialNo),
      text(row.departmentName),
      text(row.tenderNo),
      text(row.workName),
      money(row.estimateCost),
      money(row.tenderAmount),
      text(row.favouring),
      emdIssueFdNo(row),
      emdIssueDdNo(row),
      row.emdDate ? formatDateDmy(row.emdDate) : "",
      money(row.emdAmount),
      text(row.emdBankName),
      emdMaturityFdNo(row),
      emdMaturityDdNo(row),
      row.emdMaturityDate ? formatDateDmy(row.emdMaturityDate) : "",
      money(row.emdMaturityAmount),
      emdReleaseFdNo(row),
      emdReleaseDdNo(row),
      row.emdRefundDate ? formatDateDmy(row.emdRefundDate) : "",
      money(row.emdReleaseAmount),
      text(row.makeAgency || row.agencyName),
      text(row.applicantAgency || row.applicantAccount),
      text(row.emdRemark || row.remarks || row.emdStatus),
    ]);
    excelRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 8 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thin as ExcelJS.Borders;
    });
    excelRow.height = 28;
  });

  const total = rows.reduce((sum, row) => sum + Number(row.emdAmount || 0), 0);
  const totalRow = sheet.addRow([
    "", "", "", "", "Total Amount =", "", "", "", "", "", "", total, "", "", "", "", "", "", "", "", "", "", "", "",
  ]);
  totalRow.font = { name: "Arial", size: 8, bold: true };
  totalRow.eachCell((cell) => {
    cell.border = thin as ExcelJS.Borders;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `EMD register ${companyName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
