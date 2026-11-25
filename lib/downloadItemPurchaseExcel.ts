import ExcelJS from "exceljs";
import { formatDateDmy } from "@/lib/applicantFormFields";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadItemPurchaseExcel({
  companyName,
  companyAddress,
  rows,
}: {
  companyName: string;
  companyAddress?: string;
  rows: any[];
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Items Purchase", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  sheet.mergeCells("A1:P1");
  sheet.getCell("A1").value = companyName;
  sheet.getCell("A1").font = { bold: true, size: 14, name: "Calibri" };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  if (companyAddress) {
    sheet.mergeCells("A2:P2");
    sheet.getCell("A2").value = companyAddress;
    sheet.getCell("A2").font = { size: 9, name: "Calibri" };
    sheet.getCell("A2").alignment = { horizontal: "center", wrapText: true };
  }

  const headers = [
    "SL No.",
    "Item / Description",
    "Quantity",
    "Unit",
    "Rate",
    "Amount",
    "Shop Name (Purchase From)",
    "Purchase Location",
    "Bill No",
    "Bill Date",
    "GST No. (If Any)",
    "Payment Through (Online/Cash/UPI)",
    "Payment made By (Name of Person)",
    "Delivery Place",
    "Delivery Date",
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
  headerRow.height = 30;

  let total = 0;
  rows.forEach((row, i) => {
    const amount = Number(row.amount || 0);
    total += amount;
    const r = sheet.addRow([
      i + 1,
      row.itemName || "",
      row.quantity == null ? "" : Number(row.quantity),
      row.unit || "",
      row.rate == null ? "" : Number(row.rate),
      amount,
      row.vendorName || "",
      row.purchaseLocation || "",
      row.invoiceNo || "",
      formatDateDmy(row.purchaseDate, ""),
      row.supplierGstin || "",
      row.paymentThrough || "",
      row.paymentMadeBy || "",
      row.deliveryPlace || "",
      formatDateDmy(row.deliveryDate, ""),
      row.remarks || "",
    ]);
    r.eachCell((cell, col) => {
      cell.font = { size: 9, name: "Calibri" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (col === 3 || col === 5 || col === 6) {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  const totalRow = sheet.addRow(["", "", "", "", "Total=", total, "", "", "", "", "", "", "", "", "", ""]);
  totalRow.eachCell((cell, col) => {
    cell.font = { bold: true, size: 9, name: "Calibri" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    if (col === 6) cell.numFmt = "#,##0.00";
  });

  [8, 28, 10, 8, 10, 12, 22, 16, 12, 12, 14, 16, 18, 14, 12, 18].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const buf = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "Item_Purchase_Work_Expenditure.xlsx",
  );
}
