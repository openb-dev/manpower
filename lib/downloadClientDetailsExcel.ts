import ExcelJS from "exceljs";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadClientDetailsExcel({
  companyName,
  rows,
}: {
  companyName: string;
  rows: any[];
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Clients Details", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  sheet.mergeCells("A1:M1");
  sheet.getCell("A1").value = companyName;
  sheet.getCell("A1").font = { bold: true, size: 14, name: "Calibri" };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:M2");
  sheet.getCell("A2").value = "CLIENTS DETAILS";
  sheet.getCell("A2").font = { bold: true, size: 12, name: "Calibri" };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  const headers = [
    "Sl. No.",
    "Department Name",
    "Officer Name",
    "Designation",
    "Contract Number (Official)",
    "Contract Number (Personal)",
    "WhatsApp Number",
    "Email ID (Official)",
    "Email ID (Personal)",
    "Website Link",
    "Office address",
    "Location / City / Town",
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
  headerRow.height = 32;

  rows.forEach((row, i) => {
    const r = sheet.addRow([
      i + 1,
      row.departmentName || "",
      row.officerName || "",
      row.designation || "",
      row.contactOfficial || "",
      row.contactPersonal || "",
      row.whatsappNumber || "",
      row.emailOfficial || "",
      row.emailPersonal || "",
      row.websiteLink || "",
      row.officeAddress || "",
      row.location || "",
      row.remarks || "",
    ]);
    r.eachCell((cell) => {
      cell.font = { size: 9, name: "Calibri" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });

  [8, 18, 16, 14, 16, 16, 14, 20, 20, 18, 28, 16, 18].forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  const buf = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "Clients_Details.xlsx",
  );
}
