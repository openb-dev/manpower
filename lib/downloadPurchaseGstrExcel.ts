import ExcelJS from "exceljs";
import { formatDateDmy } from "@/lib/applicantFormFields";
import {
  buildTaxPayableSummary,
  moneyText,
  type PurchaseGstrRow,
} from "@/lib/purchaseGstr";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadPurchaseGstrExcel({
  companyName,
  companyAddress,
  monthLabel,
  fromDate,
  toDate,
  rows,
}: {
  companyName: string;
  companyAddress?: string;
  monthLabel: string;
  fromDate?: string;
  toDate?: string;
  rows: PurchaseGstrRow[];
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("GSTR-2B", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  sheet.mergeCells("A1:K1");
  sheet.getCell("A1").value = companyName;
  sheet.getCell("A1").font = { bold: true, size: 14, name: "Calibri" };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  if (companyAddress) {
    sheet.mergeCells("A2:K2");
    sheet.getCell("A2").value = companyAddress;
    sheet.getCell("A2").alignment = { horizontal: "center", wrapText: true };
    sheet.getCell("A2").font = { size: 9, name: "Calibri" };
  }

  sheet.mergeCells("A3:K3");
  sheet.getCell("A3").value = "Purchase Register ( GSTR-2B )";
  sheet.getCell("A3").font = { bold: true, size: 12, name: "Calibri" };
  sheet.getCell("A3").alignment = { horizontal: "center" };

  sheet.mergeCells("A4:K4");
  sheet.getCell("A4").value = `for the month of ${monthLabel} (From ${fromDate || "……"} To ${toDate || "……"})`;
  sheet.getCell("A4").alignment = { horizontal: "center" };
  sheet.getCell("A4").font = { size: 10, name: "Calibri" };

  sheet.mergeCells("A5:K5");
  sheet.getCell("A5").value = "Taxable inward supplies received from registered Persons";
  sheet.getCell("A5").font = { italic: true, size: 10, name: "Calibri" };

  const headers = [
    "Sl No",
    "GSTIN of Supplier",
    "Trade / Legal Name",
    "Invoice Number",
    "Invoice Date",
    "Invoice Value",
    "Taxable Amount",
    "Integrated Tax",
    "Central Tax",
    "State/UT Tax",
    "Remarks",
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 9, name: "Calibri" };
    cell.alignment = { horizontal: "center", wrapText: true, vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 28;

  rows.forEach((row, i) => {
    const r = sheet.addRow([
      i + 1,
      row.supplierGstin || "",
      row.vendorName || "",
      row.invoiceNo || "",
      formatDateDmy(row.purchaseDate as string, ""),
      Number(row.amount || 0),
      Number(row.taxableAmount ?? row.amount ?? 0),
      Number(row.igst || 0),
      Number(row.cgst || 0),
      Number(row.sgst || 0),
      row.remarks || row.itemName || "",
    ]);
    r.eachCell((cell, col) => {
      cell.font = { size: 9, name: "Calibri" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (col >= 6 && col <= 10) {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  const summary = buildTaxPayableSummary(rows);
  sheet.addRow([]);
  sheet.addRow(["TOTAL ITC TAKEN", "", "", "", "", "", "", summary.igst, summary.cgst, summary.sgst, ""]);
  sheet.addRow(["TAX PAYABLE SUMMARY"]);
  sheet.addRow(["OUTPUT TAX", summary.outputTax]);
  sheet.addRow(["LESS INPUT", summary.inputTax]);
  sheet.addRow(["LESS TDS", summary.tds]);
  sheet.addRow(["ADD LATE FEES", summary.lateFees]);
  sheet.addRow(["TOTAL PAYABLE", summary.totalPayable]);

  [8, 22, 28, 14, 12, 12, 12, 12, 12, 12, 18].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const buf = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Purchase_Register_GSTR-2B_${monthLabel.replace(/\s+/g, "_")}.xlsx`,
  );
  void moneyText;
}
