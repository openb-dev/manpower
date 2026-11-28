import type { LabourAttendanceExportRow } from "@/lib/downloadLabourAttendanceExcel";
import { labourAttendanceFileStem } from "@/lib/downloadLabourAttendanceExcel";

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

function buildPdf({
  companyName,
  monthLabel,
  fromTo,
  nameOfWork,
  department,
  location,
  daysInMonth,
  rows,
}: {
  companyName: string;
  monthLabel: string;
  fromTo: { from: string; to: string };
  nameOfWork?: string;
  department?: string;
  location?: string;
  daysInMonth: number;
  rows: LabourAttendanceExportRow[];
}) {
  return loadJsPdf().then((jsPDF) => {
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 6;
    let y = 8;

    const meta = [
      nameOfWork ? `Name of Work: ${nameOfWork}` : "",
      department ? `Department: ${department}` : "",
      location ? `Location: ${location}` : "",
    ]
      .filter(Boolean)
      .join("   |   ");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(companyName, pageW / 2, y, { align: "center" });
    y += 5;
    pdf.setFontSize(10);
    pdf.text(`Attendance sheet for the month of ${monthLabel} (From ${fromTo.from} To ${fromTo.to})`, pageW / 2, y, {
      align: "center",
    });
    y += 4;
    if (meta) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(meta, pageW / 2, y, { align: "center" });
      y += 4;
    }

    const fixed = [8, 28, 22, 14, 24];
    const summary = [12, 12, 12, 14];
    const fixedW = fixed.reduce((a, b) => a + b, 0) + summary.reduce((a, b) => a + b, 0);
    const dayW = Math.max(4.2, (pageW - margin * 2 - fixedW) / days.length);
    const widths = [...fixed, ...days.map(() => dayW), ...summary];

    const headers = [
      "Sl",
      "Name",
      "Designation",
      "Wage",
      "Job Desc.",
      ...days.map(String),
      "Days",
      "Present",
      "Absent",
      "Working",
    ];

    const drawRow = (cells: string[], height: number, bold: boolean) => {
      if (y + height > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
      let x = margin;
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(5.5);
      cells.forEach((cell, i) => {
        const w = widths[i] || 8;
        pdf.rect(x, y, w, height);
        const lines = pdf.splitTextToSize(String(cell || ""), Math.max(w - 1, 2));
        pdf.text(lines.slice(0, 2), x + 0.4, y + 2);
        x += w;
      });
      y += height;
    };

    drawRow(headers, 7, true);

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalWorking = 0;
    let totalDaysSum = 0;

    rows.forEach((row, i) => {
      totalPresent += Number(row.totalPresent || 0);
      totalAbsent += Number(row.totalAbsent || 0);
      totalWorking += Number(row.totalWorkingDay || 0);
      totalDaysSum += Number(row.totalDays || daysInMonth);
      drawRow(
        [
          String(i + 1),
          row.fullName || "",
          row.designation || "",
          row.wagePerDay == null || row.wagePerDay === "" ? "" : String(row.wagePerDay),
          row.jobDescription || "",
          ...days.map((d) => row.markCodes?.[String(d)] || ""),
          String(row.totalDays || daysInMonth),
          String(row.totalPresent || 0),
          String(row.totalAbsent || 0),
          String(row.totalWorkingDay || 0),
        ],
        6.2,
        false,
      );
    });

    drawRow(
      [
        "",
        "",
        "",
        "",
        "Total =",
        ...days.map(() => ""),
        String(totalDaysSum),
        String(totalPresent),
        String(totalAbsent),
        String(totalWorking),
      ],
      6.5,
      true,
    );

    return pdf;
  });
}

export async function downloadLabourAttendancePdf(opts: {
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
  const pdf = await buildPdf(opts);
  const blob = pdf.output("blob");
  saveBlob(blob, opts.filename || `${labourAttendanceFileStem(opts.monthLabel, opts.rows)}.pdf`);
}

export async function printLabourAttendancePdf(opts: {
  companyName: string;
  monthLabel: string;
  fromTo: { from: string; to: string };
  nameOfWork?: string;
  department?: string;
  location?: string;
  daysInMonth: number;
  rows: LabourAttendanceExportRow[];
}) {
  const pdf = await buildPdf(opts);
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  document.body.appendChild(frame);
  await new Promise<void>((resolve) => {
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        setTimeout(() => {
          URL.revokeObjectURL(url);
          frame.remove();
          resolve();
        }, 1000);
      }
    };
  });
}
