import ExcelJS from "exceljs";
import { formatDateDmy } from "@/lib/applicantFormFields";
import {
  adjustRowLabel,
  buildProgressFooter,
  columnAmount,
  defaultRaBills,
  itemBalanceQty,
  itemRaQty,
  itemRate,
  parseProgressItems,
  parseRaNotes,
  type ProgressItem,
  type ProgressReportInput,
} from "@/lib/workProgress";

const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

function colLetter(n: number) {
  let s = "";
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function fillHeader(cell: ExcelJS.Cell, value: string, fill = "FFD9E2F3") {
  cell.value = value;
  cell.font = { name: "Calibri", size: 9, bold: true };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  cell.border = thin;
}

function writeAmount(cell: ExcelJS.Cell, value: number, bold = false) {
  cell.value = value || 0;
  cell.numFmt = "#,##0.00";
  cell.font = { name: "Calibri", size: 9, bold };
  cell.alignment = { horizontal: "right", vertical: "middle" };
  cell.border = thin;
}

function writeText(cell: ExcelJS.Cell, value: unknown, opts?: { bold?: boolean; wrap?: boolean; align?: ExcelJS.Alignment["horizontal"] }) {
  cell.value = value == null || value === "" ? "" : value;
  cell.font = { name: "Calibri", size: 9, bold: Boolean(opts?.bold) };
  cell.alignment = { horizontal: opts?.align || "left", vertical: "middle", wrapText: Boolean(opts?.wrap) };
  cell.border = thin;
}

function raTitle(raNo: string, note?: string) {
  const base = `AS PER ${String(raNo).toUpperCase()} R.A. BILL`;
  return note ? `${base}\n${note}` : base;
}

function addReportSheet(workbook: ExcelJS.Workbook, report: any, index: number) {
  const raBills = defaultRaBills(report.raBills);
  const items = parseProgressItems(report.items);
  const notes = parseRaNotes(report.raNotes);
  const footer = buildProgressFooter(items, report as ProgressReportInput);
  const reportDate = report.reportDate ? formatDateDmy(report.reportDate, "") : "";
  const balanceDate = report.balanceDate ? formatDateDmy(report.balanceDate, "") : reportDate;
  const lastCol = 2 + 4 + raBills.length * 3 + 3 + 1;
  const last = colLetter(lastCol);
  const sheetName = `WPR ${index + 1}`.slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, paperSize: 9 },
  });

  sheet.mergeCells(`A1:${last}1`);
  sheet.getCell("A1").value = `Work Details Report as on ${reportDate || "……/……/……"}`;
  sheet.getCell("A1").font = { name: "Calibri", size: 14, bold: true };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 22;

  const headerLines: Array<[string, string]> = [
    ["1 Name of work:", report.nameOfWork || ""],
    ["2 Department :", report.department || ""],
    ["3 Situation :", report.situation || ""],
    ["4 Stipulated date of start:", report.stipulatedStart ? formatDateDmy(report.stipulatedStart, "") : ""],
    ["5 Actual date of start:", report.actualStart ? formatDateDmy(report.actualStart, "") : ""],
    ["6 Stipulated date of completion:", report.stipulatedCompletion ? formatDateDmy(report.stipulatedCompletion, "") : ""],
    ["7 Actual date of completion :", report.actualCompletion ? formatDateDmy(report.actualCompletion, "") : ""],
    ["8 Work Status:", report.workStatus || ""],
    ["9 Name of Agency :", report.agencyName || ""],
  ];
  headerLines.forEach(([label, value], i) => {
    const row = i + 2;
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`A${row}`).font = { name: "Calibri", size: 10, bold: true };
    sheet.mergeCells(`B${row}:${last}${row}`);
    sheet.getCell(`B${row}`).value = value;
    sheet.getCell(`B${row}`).font = { name: "Calibri", size: 10 };
    sheet.getCell(`B${row}`).alignment = { wrapText: true };
  });

  const titleRow = 12;
  sheet.mergeCells(`A${titleRow}:${last}${titleRow}`);
  sheet.getCell(`A${titleRow}`).value = `WORK DETAILS REPORT AS ON DATE ${reportDate || "……/……/……"}`;
  sheet.getCell(`A${titleRow}`).font = { name: "Calibri", size: 11, bold: true };
  sheet.getCell(`A${titleRow}`).alignment = { horizontal: "center" };

  const h1 = 13;
  const h2 = 14;
  fillHeader(sheet.getCell(`A${h1}`), "Sl. No.");
  fillHeader(sheet.getCell(`B${h1}`), "Particulars");
  sheet.mergeCells(`A${h1}:A${h2}`);
  sheet.mergeCells(`B${h1}:B${h2}`);

  let col = 3;
  sheet.mergeCells(h1, col, h1, col + 3);
  fillHeader(sheet.getCell(h1, col), "AS PER BOQ");
  ["Qty.", "Unit", "Rate (Rs.)", "Amount (Rs.)"].forEach((label, i) => fillHeader(sheet.getCell(h2, col + i), label));
  col += 4;

  raBills.forEach((raNo) => {
    sheet.mergeCells(h1, col, h1, col + 2);
    fillHeader(sheet.getCell(h1, col), raTitle(raNo, notes[raNo]));
    ["Qty.", "Rate (Rs.)", "Amount (Rs.)"].forEach((label, i) => fillHeader(sheet.getCell(h2, col + i), label));
    col += 3;
  });

  sheet.mergeCells(h1, col, h1, col + 2);
  fillHeader(sheet.getCell(h1, col), `BALANCE WORK AS ON\nDATE ${balanceDate || "…./…./……"}`);
  ["Qty.", "Rate (Rs.)", "Amount (Rs.)"].forEach((label, i) => fillHeader(sheet.getCell(h2, col + i), label));
  col += 3;
  fillHeader(sheet.getCell(h1, col), "Remarks");
  sheet.mergeCells(h1, col, h2, col);

  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 48;
  for (let i = 3; i <= lastCol; i++) sheet.getColumn(i).width = i === lastCol ? 16 : 12;
  sheet.getRow(h1).height = 28;
  sheet.getRow(h2).height = 18;

  const boqItems = items.filter((item) => item.kind !== "EXTRA");
  const extraItems = items.filter((item) => item.kind === "EXTRA");

  const writeItem = (item: ProgressItem, row: number) => {
    writeText(sheet.getCell(row, 1), item.slNo, { align: "center" });
    writeText(sheet.getCell(row, 2), item.particulars, { wrap: true });
    writeText(sheet.getCell(row, 3), item.boqQty === "" ? "" : numOrBlank(item.boqQty), { align: "right" });
    writeText(sheet.getCell(row, 4), item.unit, { align: "center" });
    writeText(sheet.getCell(row, 5), item.boqRate === "" ? "" : numOrBlank(item.boqRate), { align: "right" });
    writeAmount(sheet.getCell(row, 6), columnAmount(item, "boq", raBills));
    let c = 7;
    raBills.forEach((raNo) => {
      const qty = itemRaQty(item, raNo);
      writeText(sheet.getCell(row, c), item.ra?.[raNo]?.qty === "" || item.ra?.[raNo]?.qty == null ? (qty ? qty : 0) : qty, { align: "right" });
      writeText(sheet.getCell(row, c + 1), itemRate(item, raNo), { align: "right" });
      writeAmount(sheet.getCell(row, c + 2), columnAmount(item, raNo, raBills));
      c += 3;
    });
    writeText(sheet.getCell(row, c), itemBalanceQty(item, raBills), { align: "right" });
    writeText(sheet.getCell(row, c + 1), itemRate(item), { align: "right" });
    writeAmount(sheet.getCell(row, c + 2), columnAmount(item, "balance", raBills));
    writeText(sheet.getCell(row, c + 3), item.remarks, { wrap: true });
    sheet.getRow(row).height = Math.min(90, 18 + Math.ceil(String(item.particulars || "").length / 42) * 12);
  };

  function numOrBlank(value: unknown) {
    const n = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : "";
  }

  function writeFooterRow(row: number, label: string, values: Record<string, number>) {
    sheet.mergeCells(row, 1, row, 5);
    writeText(sheet.getCell(row, 1), label, { bold: true, align: "right" });
    writeAmount(sheet.getCell(row, 6), values.boq || 0, true);
    let c = 7;
    raBills.forEach((raNo) => {
      writeText(sheet.getCell(row, c), "", { bold: true });
      writeText(sheet.getCell(row, c + 1), "", { bold: true });
      writeAmount(sheet.getCell(row, c + 2), values[raNo] || 0, true);
      c += 3;
    });
    writeText(sheet.getCell(row, c), "");
    writeText(sheet.getCell(row, c + 1), "");
    writeAmount(sheet.getCell(row, c + 2), values.balance || 0, true);
    writeText(sheet.getCell(row, c + 3), "");
  }

  let row = 15;
  boqItems.forEach((item) => {
    writeItem(item, row);
    row += 1;
  });
  writeFooterRow(row, "Total=", footer.total);
  row += 1;
  writeFooterRow(row, adjustRowLabel(footer.adjustKind, footer.lessPct), footer.less);
  row += 1;
  writeFooterRow(row, "(A) Sub-Total=", footer.subA);
  row += 1;

  if (extraItems.length) {
    sheet.mergeCells(row, 1, row, lastCol);
    writeText(sheet.getCell(row, 1), "Extra Items", { bold: true });
    row += 1;
    extraItems.forEach((item) => {
      writeItem(item, row);
      row += 1;
    });
  }
  writeFooterRow(row, "(B) Sub-Total=", footer.extra);
  row += 1;
  writeFooterRow(row, "(A+B) Grand Total=", footer.grand);
  row += 1;
  sheet.mergeCells(row, 1, row, lastCol);
  writeText(sheet.getCell(row, 1), "Recovery", { bold: true });
  row += 1;
  writeFooterRow(row, `Security Deposit@${footer.sdPct}%=`, footer.sd);
  row += 1;
  writeFooterRow(row, `Income Tax@${footer.itPct}%=`, footer.it);
  row += 1;
  writeFooterRow(row, `GST@${footer.gstPct}%=`, footer.gst);
  row += 1;
  writeFooterRow(row, `Labour Cess@${footer.labourPct}%=`, footer.labour);
  row += 1;
  writeFooterRow(row, "Total Recoveries=", footer.recoveries);
  row += 1;
  writeFooterRow(row, "Net Payable Amount=", footer.net);
  row += 1;
  if (report.note) {
    sheet.mergeCells(row, 1, row, lastCol);
    writeText(sheet.getCell(row, 1), `Note:- ${report.note}`, { wrap: true });
    sheet.getRow(row).height = 24;
  }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadWorkProgressExcel({
  companyName,
  rows,
}: {
  companyName: string;
  rows: any[];
}) {
  const workbook = new ExcelJS.Workbook();
  const list = rows.length ? rows : [];
  if (!list.length) {
    workbook.addWorksheet("Work Progress Report");
  } else {
    list.forEach((row, index) => addReportSheet(workbook, row, index));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Work Progress Report ${companyName}.xlsx`);
}
