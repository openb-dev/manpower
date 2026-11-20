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

function isBg(row: any) {
  const mode = String(row.pgMode || "").toUpperCase();
  return mode.includes("BG") || mode.includes("GUARANTEE");
}

export function pgIssueFdNo(row: any) {
  return text(row.pgFdNo) || (!isBg(row) ? text(row.pgInstrumentNo) : "");
}

export function pgIssueBgNo(row: any) {
  return text(row.pgBgNo) || (isBg(row) ? text(row.pgInstrumentNo) : "");
}

export function pgMaturityFdNo(row: any) {
  return text(row.pgMaturityFdNo) || (!isBg(row) ? text(row.pgMaturityInstrumentNo) : "");
}

export function pgMaturityBgNo(row: any) {
  return text(row.pgMaturityBgNo) || (isBg(row) ? text(row.pgMaturityInstrumentNo) : "");
}

export function pgReleaseFdNo(row: any) {
  return text(row.pgReleaseFdNo) || (!isBg(row) ? text(row.pgReleaseRef) : "");
}

export function pgReleaseBgNo(row: any) {
  return text(row.pgReleaseBgNo) || (isBg(row) ? text(row.pgReleaseRef) : "");
}

export async function downloadPgRegisterExcel({
  companyName,
  rows,
}: {
  companyName: string;
  rows: any[];
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("PG Register", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });
  const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2D5F1" } };
  const thin: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };

  sheet.mergeCells("A1:X1");
  sheet.getCell("A1").value = `Performance Guarantee(P.G.) Register ( ${companyName} )`;
  sheet.getCell("A1").font = { name: "Arial", size: 13, bold: true };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 22;

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

  sheet.getCell("A2").value = "SL NO.";
  sheet.getCell("B2").value = "Reg Sl No";
  sheet.getCell("C2").value = "Department / Division";
  sheet.getCell("D2").value = "NIT No.";
  sheet.getCell("E2").value = "Name of Work";
  sheet.getCell("F2").value = "Estimate Cost";
  sheet.getCell("G2").value = "Contract Amount";
  sheet.getCell("H2").value = "Favouring";
  sheet.getCell("I2").value = "P.G. issue Details";
  sheet.getCell("N2").value = "P.G. Maturity details\n(As per Agreement)";
  sheet.getCell("R2").value = "P.G. Release details\n(As per Actual)";
  sheet.getCell("V2").value = "Make Agency";
  sheet.getCell("W2").value = "Applicant Agency";
  sheet.getCell("X2").value = "Remark/Status";
  sheet.getCell("I3").value = "FD No.";
  sheet.getCell("J3").value = "BG No.";
  sheet.getCell("K3").value = "Date";
  sheet.getCell("L3").value = "Amount";
  sheet.getCell("M3").value = "Bank Name";
  sheet.getCell("N3").value = "FD No.";
  sheet.getCell("O3").value = "BG No.";
  sheet.getCell("P3").value = "Date";
  sheet.getCell("Q3").value = "Amount";
  sheet.getCell("R3").value = "FD No.";
  sheet.getCell("S3").value = "BG No.";
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
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 18;
  sheet.columns = [
    { width: 7 }, { width: 10 }, { width: 16 }, { width: 16 }, { width: 36 },
    { width: 12 }, { width: 12 }, { width: 14 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 14 }, { width: 14 }, { width: 16 },
  ];

  rows.forEach((row, index) => {
    const excelRow = sheet.addRow([
      index + 1,
      text(row.pgRegdSerialNo || row.emdRegdSerialNo),
      text(row.departmentName),
      text(row.tenderNo),
      text(row.workName),
      money(row.estimateCost) || text(row.emdEstimateDetails),
      money(row.tenderAmount),
      text(row.favouring),
      pgIssueFdNo(row),
      pgIssueBgNo(row),
      row.pgDate ? formatDateDmy(row.pgDate) : "",
      money(row.pgAmount),
      text(row.pgBankName),
      pgMaturityFdNo(row),
      pgMaturityBgNo(row),
      row.pgExpiryDate ? formatDateDmy(row.pgExpiryDate) : "",
      money(row.pgMaturityAmount),
      pgReleaseFdNo(row),
      pgReleaseBgNo(row),
      row.pgReleaseDate ? formatDateDmy(row.pgReleaseDate) : "",
      money(row.pgReleaseAmount),
      text(row.makeAgency || row.agencyName),
      text(row.applicantAgency),
      text(row.pgRemark || row.remarks || row.pgStatus),
    ]);
    excelRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 8 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = thin as ExcelJS.Borders;
    });
    excelRow.height = 28;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `PG register ${companyName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
