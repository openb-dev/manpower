import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { AlignmentType, Document, Packer, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

const NAVY = "1F3A5F";
const TRADE = "E7EEF6";
const TOTAL = "EEF3F9";

export async function renderDocument(document, format) {
  if (format === "pdf") {
    return { buffer: await toPdf(document), type: "application/pdf", name: fileName(document.title, "pdf") };
  }
  if (format === "word") {
    return {
      buffer: await toWord(document),
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: fileName(document.title, "docx"),
    };
  }
  if (format === "excel") {
    return {
      buffer: Buffer.from(await toExcel(document)),
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      name: fileName(document.title, "xlsx"),
    };
  }
  return null;
}

export async function renderAttendance(sheet, format) {
  return renderDocument(attendanceDocument(sheet), format);
}

export function attendanceDocument(sheet) {
  const title = sheet.sheet_name || "Attendance";
  const info = [
    sheet.company_name,
    sheet.work_name,
    [`Work order no. ${sheet.work_order_no || ""}`, sheet.work_order_date ? `Date ${displayDate(sheet.work_order_date)}` : ""].filter(Boolean).join("    "),
    [`Working period ${displayDate(sheet.period_from)} to ${displayDate(sheet.period_to)}`, sheet.period_note ? `(${sheet.period_note})` : ""].filter(Boolean).join(" "),
  ].map((line) => String(line || "").trim()).filter(Boolean);

  if (sheet.wageLines?.length) return wageDocument(title, info, sheet);
  if (sheet.extraPayments?.length) return extraDocument(title, info, sheet);
  return dayDocument(title, info, sheet);
}

function dayDocument(title, info, sheet) {
  const days = markSpan(sheet);
  const columns = ["Sl. No.", "Trade", "Name of workman", ...Array.from({ length: days }, (_, index) => String(index + 1)), "Total days", "Bill Sl. No."];
  const rows = (sheet.rows || []).map((row) => {
    const marks = Array.from({ length: days }, (_, index) => {
      const day = String(index + 1);
      return row.marks?.[day] || row.marks?.[index + 1] || "";
    });
    if (row.row_kind === "trade") {
      return { kind: "trade", cells: ["", row.trade || "", row.trade || "", ...marks, "", ""] };
    }
    return {
      kind: row.row_kind === "workman" ? "line" : "total",
      cells: [row.sl_no || "", row.trade || "", row.workman_name || "", ...marks, numberOrBlank(row.total_days), row.bill_sl_no || ""],
    };
  });
  return { title, info, columns, rows, notes: [] };
}

function wageDocument(title, info, sheet) {
  const columns = [
    "Sl. No.", "Employees name", "EPFO no.", "ESIC no.", "Designation", "Days worked", "Daily rate",
    "Basic", "DA", "Gross", "PF @12%", "ESIC @0.75%", "P. Tax", "Other deduction", "Net amount",
    "PF @13%", "ESI @3.25%", "Admin charge", "Employer total",
  ];
  const rows = sheet.wageLines.map((line) => ({
    kind: line.row_kind === "total" ? "total" : "line",
    cells: [
      line.sl_no || "",
      line.employee_name || "",
      line.epfo_no || "",
      line.esic_no || "",
      line.designation || "",
      numberOrBlank(line.days_worked),
      numberOrBlank(line.daily_rate),
      numberOrBlank(line.basic),
      numberOrBlank(line.da),
      numberOrBlank(line.gross),
      numberOrBlank(line.pf),
      numberOrBlank(line.esic),
      numberOrBlank(line.professional_tax),
      numberOrBlank(line.other_deduction),
      numberOrBlank(line.net_amount),
      numberOrBlank(line.employer_pf),
      numberOrBlank(line.employer_esi),
      line.admin_charge || "",
      numberOrBlank(line.employer_total),
    ],
  }));
  const notes = (sheet.wageNotes || []).map((note) => ({
    kind: "note",
    cells: [note.note || "", note.month_label || "", note.amount === null || note.amount === undefined ? "" : Number(note.amount)],
  }));
  return { title, info, columns, rows, notes };
}

function extraDocument(title, info, sheet) {
  const columns = ["Sl. No.", "Employees name", "Days worked", "Daily rate", "Total amount payable"];
  const rows = sheet.extraPayments.map((line) => ({
    kind: line.row_kind === "total" ? "total" : "line",
    cells: [line.sl_no || "", line.employee_name || "", numberOrBlank(line.days_worked), numberOrBlank(line.daily_rate), numberOrBlank(line.amount)],
  }));
  return { title, info, columns, rows, notes: [] };
}

function markSpan(sheet) {
  let count = dayCount(sheet.period_from, sheet.period_to);
  for (const row of sheet.rows || []) {
    for (const key of Object.keys(row.marks || {})) {
      const day = Number(key);
      if (day > count && day <= 31) count = day;
    }
  }
  return count;
}

function dayCount(from, to) {
  if (!from || !to) return 28;
  const start = new Date(`${String(from).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(to).slice(0, 10)}T00:00:00`);
  const count = Math.round((end - start) / 86400000) + 1;
  if (!Number.isFinite(count) || count < 1 || count > 31) return 28;
  return count;
}

function numberOrBlank(value) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : "";
}

function displayDate(value) {
  const text = String(value || "").slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : text;
}

function fileName(title, extension) {
  const safe = String(title).replace(/[^\w()]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "attendance";
  return `${safe}.${extension}`;
}

function show(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function columnWeights(columns) {
  return columns.map((label) => {
    if (/^\d+$/.test(label)) return 1;
    if (label === "Sl. No." || label === "Bill Sl. No.") return 1.5;
    if (label.includes("Name") || label === "Trade" || label.includes("EPFO") || label.includes("ESIC no")) return 3.4;
    return 2;
  });
}

function toPdf(document) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A3", layout: "landscape", margin: 24 });
    const chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    const margin = 24;
    const weights = columnWeights(document.columns);
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const usable = pdf.page.width - margin * 2;
    const widths = weights.map((weight) => (usable * weight) / weightSum);
    let y = margin;

    pdf.font("Helvetica-Bold").fontSize(12).fillColor("#1f3a5f").text(document.title, margin, y, { width: usable });
    y = pdf.y + 4;
    pdf.font("Helvetica").fontSize(8).fillColor("#222");
    for (const line of document.info) {
      pdf.text(line, margin, y, { width: usable });
      y = pdf.y + 1;
    }
    y += 6;

    const drawHeader = () => {
      const height = 16;
      let x = margin;
      document.columns.forEach((label, index) => {
        pdf.rect(x, y, widths[index], height).fillAndStroke("#1f3a5f", "#d5dbe3");
        pdf.fillColor("#fff").font("Helvetica-Bold").fontSize(6).text(label, x + 1, y + 4, { width: widths[index] - 2, height: 10, ellipsis: true, lineBreak: false });
        x += widths[index];
      });
      y += height;
    };

    drawHeader();
    const paint = (row) => {
      const height = 12;
      if (y + height > pdf.page.height - margin) {
        pdf.addPage();
        y = margin;
        drawHeader();
      }
      const fill = row.kind === "trade" ? "#e7eef6" : row.kind === "total" ? "#eef3f9" : "#ffffff";
      let x = margin;
      row.cells.forEach((cell, index) => {
        pdf.rect(x, y, widths[index], height).fillAndStroke(fill, "#d5dbe3");
        pdf.fillColor("#222").font(row.kind === "line" ? "Helvetica" : "Helvetica-Bold").fontSize(6);
        pdf.text(show(cell), x + 1, y + 3, { width: widths[index] - 2, height: 8, ellipsis: true, lineBreak: false });
        x += widths[index];
      });
      y += height;
    };
    for (const row of document.rows) paint(row);
    if (document.notes.length) {
      y += 10;
      pdf.font("Helvetica-Bold").fontSize(9).fillColor("#1f3a5f").text("Notes", margin, y);
      y = pdf.y + 4;
      for (const note of document.notes) {
        pdf.font("Helvetica").fontSize(8).fillColor("#222").text(note.cells.map(show).filter(Boolean).join("    "), margin, y, { width: usable });
        y = pdf.y + 2;
      }
    }
    pdf.end();
  });
}

async function toWord(document) {
  const contentWidth = 23000;
  const weights = columnWeights(document.columns);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map((weight) => Math.floor((contentWidth * weight) / weightSum));
  const header = new TableRow({
    tableHeader: true,
    children: document.columns.map((label, index) => wordCell(label, widths[index], "head")),
  });
  const body = document.rows.map((row) => new TableRow({
    children: pad(row.cells, document.columns.length).map((cell, index) => wordCell(show(cell), widths[index], row.kind)),
  }));
  const noteRows = document.notes.map((note) => new Paragraph({
    spacing: { before: 40 },
    children: [new TextRun({ text: note.cells.map(show).filter(Boolean).join("    "), size: 16, font: "Calibri" })],
  }));
  const file = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE, width: 23814, height: 16838 },
          margin: { top: 400, bottom: 400, left: 400, right: 400 },
        },
      },
      children: [
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: document.title, bold: true, size: 28, font: "Calibri", color: NAVY })],
        }),
        ...document.info.map((line) => new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: line, size: 16, font: "Calibri" })],
        })),
        new Table({ width: { size: contentWidth, type: WidthType.DXA }, rows: [header, ...body] }),
        ...(document.notes.length ? [new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Notes", bold: true, size: 20, font: "Calibri", color: NAVY })] }), ...noteRows] : []),
      ],
    }],
  });
  return Packer.toBuffer(file);
}

function wordCell(text, width, kind) {
  const fill = kind === "head" ? NAVY : kind === "trade" ? TRADE : kind === "total" ? TOTAL : "FFFFFF";
  const color = kind === "head" ? "FFFFFF" : "222222";
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 20, bottom: 20, left: 30, right: 30 },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: text || " ", bold: kind !== "line", size: 12, font: "Calibri", color })],
    })],
  });
}

function pad(cells, length) {
  const copy = cells.slice(0, length);
  while (copy.length < length) copy.push("");
  return copy;
}

async function toExcel(document) {
  const workbook = new ExcelJS.Workbook();
  const sheetName = document.title.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Sheet";
  const sheet = workbook.addWorksheet(sheetName);
  const widthCount = document.columns.length;
  const title = sheet.addRow([document.title]);
  sheet.mergeCells(1, 1, 1, widthCount);
  title.font = { bold: true, size: 14, color: { argb: `FF${NAVY}` } };
  for (const line of document.info) {
    const row = sheet.addRow([line]);
    sheet.mergeCells(row.number, 1, row.number, widthCount);
  }
  sheet.addRow([]);
  const header = sheet.addRow(document.columns);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${NAVY}` } };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: header.number }];
  for (const item of document.rows) {
    const row = sheet.addRow(item.cells.map((cell) => (cell === "" ? null : cell)));
    if (item.kind !== "line") {
      row.font = { bold: true };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.kind === "trade" ? `FF${TRADE}` : `FF${TOTAL}` } };
    }
  }
  if (document.notes.length) {
    sheet.addRow([]);
    const label = sheet.addRow(["Notes"]);
    label.font = { bold: true, color: { argb: `FF${NAVY}` } };
    for (const note of document.notes) sheet.addRow(note.cells);
  }
  const weights = columnWeights(document.columns);
  sheet.columns.forEach((column, index) => {
    column.width = Math.max(4, weights[index] * 6);
  });
  return workbook.xlsx.writeBuffer();
}
