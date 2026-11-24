import ExcelJS from "exceljs";
import { moneyText, type SalaryLine } from "@/lib/salarySummary";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadSalarySummaryExcel({
  companyName,
  companyAddress,
  monthLabel,
  department,
  lines,
  totals,
}: {
  companyName: string;
  companyAddress?: string;
  monthLabel: string;
  department?: string;
  lines: SalaryLine[];
  totals: ReturnType<typeof import("@/lib/salarySummary").buildSalarySummary>["totals"];
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Salary Summary", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  sheet.mergeCells("A1:R1");
  sheet.getCell("A1").value = companyName;
  sheet.getCell("A1").font = { bold: true, size: 14, name: "Calibri" };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  if (companyAddress) {
    sheet.mergeCells("A2:R2");
    sheet.getCell("A2").value = companyAddress;
    sheet.getCell("A2").font = { size: 9, name: "Calibri" };
    sheet.getCell("A2").alignment = { horizontal: "center", wrapText: true };
  }

  sheet.mergeCells("A3:R3");
  sheet.getCell("A3").value = `Salary Calculation Summary for the month of ${monthLabel}`;
  sheet.getCell("A3").font = { bold: true, size: 12, name: "Calibri" };
  sheet.getCell("A3").alignment = { horizontal: "center" };

  sheet.mergeCells("A4:R4");
  sheet.getCell("A4").value = `SUMMARY SHEET${department ? `  |  Name of the Department: ${department}` : ""}`;
  sheet.getCell("A4").font = { size: 10, name: "Calibri" };

  const headers = [
    "SL No",
    "Employees Name",
    "Designation",
    "UAN No",
    "ESIC No",
    "Working day's",
    "Minimum Wages Per Day",
    "Gross Basic",
    "Earning as per Daily Work Basis",
    "EPF @12%",
    "ESIC @0.75%",
    "P. Tax",
    "Allowances 1",
    "Allowances 2",
    "Others",
    "Bonus",
    "Net Amount",
    "EPF @13%",
    "ESI @3.25%",
    "Total Contribution of ESIC & EPF",
  ];

  // Trim to fit: use 18 cols matching client closely - combine last employer cols
  const h2 = [
    "SL No",
    "Employees Name",
    "Designation",
    "UAN No",
    "ESIC No",
    "Working day's",
    "Minimum Wages Per Day",
    "Gross Basic",
    "Earning Daily",
    "EPF @12%",
    "ESIC @0.75%",
    "P. Tax",
    "Allow. 1",
    "Allow. 2",
    "Others",
    "Bonus",
    "Net Amount",
    "Employer EPF 13%",
    "Employer ESI 3.25%",
    "Employer Total",
  ];
  void headers;

  const headerRow = sheet.addRow(h2);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 8, name: "Calibri" };
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

  lines.forEach((row, i) => {
    const r = sheet.addRow([
      i + 1,
      row.fullName,
      row.designation,
      row.uan || "",
      row.esicNo || "",
      row.workingDays,
      row.dailyWage,
      row.grossBasic,
      row.earningDaily,
      row.epfEmployee,
      row.esicEmployee,
      row.professionalTax,
      row.allowance1,
      row.allowance2,
      row.others,
      row.bonus,
      row.netAmount,
      row.epfEmployer,
      row.esiEmployer,
      row.employerTotal,
    ]);
    r.eachCell((cell, col) => {
      cell.font = { size: 8, name: "Calibri" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (col >= 6) {
        cell.numFmt = col === 6 ? "0.##" : "#,##0.00";
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  const totalRow = sheet.addRow([
    "",
    "Total=",
    "",
    "",
    `${totals.employees} employees`,
    totals.workingDays,
    "",
    totals.grossBasic,
    totals.earningDaily,
    totals.epfEmployee,
    totals.esicEmployee,
    totals.professionalTax,
    totals.allowance1,
    totals.allowance2,
    totals.others,
    totals.bonus,
    totals.netAmount,
    totals.epfEmployer,
    totals.esiEmployer,
    totals.employerTotal,
  ]);
  totalRow.eachCell((cell, col) => {
    cell.font = { bold: true, size: 8, name: "Calibri" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    if (col >= 6) cell.numFmt = "#,##0.00";
  });

  sheet.addRow([]);
  sheet.addRow(["TOTAL NO OF EMPLOYEE", totals.employees, "TOTAL WAGES", totals.grossBasic]);
  sheet.addRow(["EMPLOYER'S CONTRIBUTION EPF", totals.epfEmployer, "ESI", totals.esiEmployer]);
  sheet.addRow(["Total Contribution of ESIC & EPF", totals.employerTotal]);

  h2.forEach((_, i) => {
    sheet.getColumn(i + 1).width = i === 1 ? 22 : i <= 4 ? 12 : 11;
  });

  const buf = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Salary_Calculation_Summary_${monthLabel.replace(/\s+/g, "_")}.xlsx`,
  );
  void moneyText;
}
