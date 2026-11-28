import ExcelJS from "exceljs";

export type LabourAttendanceExportRow = {
  fullName: string;
  designation: string;
  wagePerDay?: string | number | null;
  jobDescription?: string;
  markCodes: Record<string, string>;
  totalDays: number;
  totalPresent: number;
  totalAbsent: number;
  totalWorkingDay: number;
};

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function labourAttendanceFileStem(monthLabel: string, rows: LabourAttendanceExportRow[]) {
  const month = String(monthLabel || "month").replace(/[^\w\-]+/g, "_");
  if (rows.length === 1) {
    const person = String(rows[0].fullName || "person").replace(/[^\w\-]+/g, "_");
    return `Labour_Attendance_${month}_${person}`.slice(0, 80);
  }
  return `Labour_Attendance_${month}`.slice(0, 80);
}

export async function downloadLabourAttendanceExcel({
  companyName,
  monthLabel,
  fromTo,
  nameOfWork,
  department,
  location,
  daysInMonth,
  rows,
  filename,
}: {
  companyName: string;
  monthLabel: string;
  fromTo: { from: string; to: string };
  nameOfWork?: string;
  department?: string;
  location?: string;
  daysInMonth: number;
  rows: LabourAttendanceExportRow[];
  filename?: string;
}) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Labour Attendance", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const colCount = 5 + days.length + 4;
  const title = (row: number, text: string, bold = false, size = 11) => {
    sheet.mergeCells(row, 1, row, colCount);
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    cell.font = { bold, size, name: "Calibri" };
    cell.alignment = { horizontal: "center", wrapText: true };
  };

  title(1, companyName, true, 14);
  title(2, `Attendance sheet for the month of ${monthLabel} (From ${fromTo.from} To ${fromTo.to})`, true, 11);
  title(
    3,
    [
      nameOfWork ? `Name of Work: ${nameOfWork}` : "",
      department ? `Department: ${department}` : "",
      location ? `Location: ${location}` : "",
    ]
      .filter(Boolean)
      .join("   |   ") || "Labour Attendance",
    false,
    9,
  );

  const headers = [
    "Sl No.",
    "Name",
    "Designation",
    "Wage / Day",
    "Job Description",
    ...days.map((d) => String(d)),
    "Total Days",
    "Total Present",
    "Total Absent",
    "Total Working Day",
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 8, name: "Calibri" };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 22;

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalWorking = 0;
  let totalDaysSum = 0;

  rows.forEach((row, i) => {
    const excelRow = sheet.addRow([
      i + 1,
      row.fullName || "",
      row.designation || "",
      row.wagePerDay == null || row.wagePerDay === "" ? "" : Number(row.wagePerDay),
      row.jobDescription || "",
      ...days.map((d) => row.markCodes?.[String(d)] || ""),
      row.totalDays || daysInMonth,
      row.totalPresent || 0,
      row.totalAbsent || 0,
      row.totalWorkingDay || 0,
    ]);
    totalPresent += Number(row.totalPresent || 0);
    totalAbsent += Number(row.totalAbsent || 0);
    totalWorking += Number(row.totalWorkingDay || 0);
    totalDaysSum += Number(row.totalDays || daysInMonth);
    excelRow.eachCell((cell, col) => {
      cell.font = { size: 8, name: "Calibri" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = {
        horizontal: col === 2 || col === 3 || col === 5 ? "left" : "center",
        vertical: "middle",
        wrapText: true,
      };
    });
  });

  const footer = sheet.addRow([
    "",
    "",
    "",
    "",
    "Total =",
    ...days.map(() => ""),
    totalDaysSum,
    totalPresent,
    totalAbsent,
    totalWorking,
  ]);
  footer.eachCell((cell) => {
    cell.font = { bold: true, size: 8, name: "Calibri" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
  });

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 10;
  sheet.getColumn(5).width = 18;
  days.forEach((_, i) => {
    sheet.getColumn(6 + i).width = 5;
  });
  sheet.getColumn(6 + days.length).width = 9;
  sheet.getColumn(7 + days.length).width = 10;
  sheet.getColumn(8 + days.length).width = 10;
  sheet.getColumn(9 + days.length).width = 12;

  const buf = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename || `${labourAttendanceFileStem(monthLabel, rows)}.xlsx`,
  );
}
