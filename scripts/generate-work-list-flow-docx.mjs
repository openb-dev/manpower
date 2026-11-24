import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  ShadingType,
  VerticalAlign,
} from "docx";
import fs from "fs";
import path from "path";

const NAVY = "0F2744";
const BLUE = "1E3A5F";
const LIGHT = "E8EEF5";
const WHITE = "FFFFFF";
const GREEN = "14532D";
const TEAL = "0F766E";
const AMBER_BG = "FEF3C7";
const AMBER = "78350F";

const thin = {
  top: { style: BorderStyle.SINGLE, size: 8, color: "CBD5E1" },
  bottom: { style: BorderStyle.SINGLE, size: 8, color: "CBD5E1" },
  left: { style: BorderStyle.SINGLE, size: 8, color: "CBD5E1" },
  right: { style: BorderStyle.SINGLE, size: 8, color: "CBD5E1" },
};

function cell(text, opts = {}) {
  const {
    bold = false,
    fill = WHITE,
    width = 4680,
    center = false,
    color = "0F172A",
    size = 20,
  } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill },
    borders: thin,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 70, after: 70 },
        children: [new TextRun({ text, bold, size, font: "Calibri", color })],
      }),
    ],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 140, before: opts.before ?? 0, line: 276 },
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        bold: Boolean(opts.bold),
        size: opts.size || 22,
        font: "Calibri",
        color: opts.color || "1E293B",
        italics: Boolean(opts.italics),
      }),
    ],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 260, after: 140 },
    children: [new TextRun({ text, bold: true, size: 28, font: "Calibri", color: NAVY })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Calibri", color: BLUE })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 70 },
    children: [new TextRun({ text, size: 21, font: "Calibri", color: "1E293B" })],
  });
}

function fullRow(text, fill, color = WHITE, size = 22) {
  return new TableRow({
    children: [
      cell(text, {
        bold: true,
        fill,
        width: 9360,
        center: true,
        color,
        size,
      }),
    ],
  });
}

function twoCol(left, right, opts = {}) {
  return new TableRow({
    children: [
      cell(left, { width: 4680, center: true, ...opts.left }),
      cell(right, { width: 4680, center: true, ...opts.right }),
    ],
  });
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: "o",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
          },
          {
            level: 2,
            format: LevelFormat.BULLET,
            text: "-",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({ text: "N.K. ENTERPRISE", bold: true, size: 36, font: "Calibri", color: NAVY }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: "Work List — Client Required Flow",
              bold: true,
              size: 26,
              font: "Calibri",
              color: BLUE,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: "Source: Client Work Expenditure / Work List PDF  |  Manpower & Construction",
              size: 19,
              font: "Calibri",
              color: "64748B",
              italics: true,
            }),
          ],
        }),

        h1("1. Purpose"),
        p(
          "Client wants office work organised under one Work List. The same structure applies to both Manpower and Construction tracks.",
        ),

        h1("2. Top-level flow (as given by client)"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [9360],
          rows: [
            fullRow("WORK LIST", NAVY, WHITE, 24),
            fullRow("↓  Two parallel tracks", LIGHT, "334155", 18),
          ],
        }),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4680, 4680],
          rows: [
            twoCol("MANPOWER", "CONSTRUCTION", {
              left: { bold: true, fill: BLUE, color: WHITE, size: 22 },
              right: { bold: true, fill: TEAL, color: WHITE, size: 22 },
            }),
            twoCol("Work Register", "Work Register", {
              left: { fill: LIGHT, bold: true },
              right: { fill: LIGHT, bold: true },
            }),
            twoCol("Work Progress Report", "Work Progress Report", {
              left: { fill: WHITE, bold: true },
              right: { fill: WHITE, bold: true },
            }),
            twoCol("Work Expenditure", "Work Expenditure", {
              left: { fill: AMBER_BG, bold: true, color: AMBER },
              right: { fill: AMBER_BG, bold: true, color: AMBER },
            }),
          ],
        }),

        h1("3. Work Expenditure break-up (same under both tracks)"),
        p("Under Work Expenditure, the client listed these items:"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3200, 6160],
          rows: [
            new TableRow({
              children: [
                cell("Item", { bold: true, fill: NAVY, width: 3200, center: true, color: WHITE }),
                cell("Meaning (office language)", {
                  bold: true,
                  fill: NAVY,
                  width: 6160,
                  center: true,
                  color: WHITE,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell("Items Purchase", { bold: true, fill: LIGHT, width: 3200 }),
                cell("Buy materials / store items for the work", { width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Labour Payment", { bold: true, fill: LIGHT, width: 3200 }),
                cell("Pay labour / wage bills linked to the work", { width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Individual Payment", { bold: true, fill: LIGHT, width: 3200 }),
                cell("Pay one person / one voucher separately", { width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Labour Attendance", { bold: true, fill: LIGHT, width: 3200 }),
                cell("Mark / use attendance that drives labour payment", { width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Office Administration", { bold: true, fill: LIGHT, width: 3200 }),
                cell("Office admin costs related to running the work", { width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Received & Expenses", { bold: true, fill: LIGHT, width: 3200 }),
                cell("Money received and money spent (cash movement)", { width: 6160 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Total Expenditure (Petty Cash)", {
                  bold: true,
                  fill: AMBER_BG,
                  width: 3200,
                  color: AMBER,
                }),
                cell("Final total of expenditure from petty cash / all expense heads", {
                  width: 6160,
                  fill: AMBER_BG,
                  color: AMBER,
                  bold: true,
                }),
              ],
            }),
          ],
        }),

        h1("4. Full hierarchy tree"),
        p("Work List", { bold: true }),
        bullet("Manpower"),
        bullet("Work Register", 1),
        bullet("Work Progress Report", 1),
        bullet("Work Expenditure", 1),
        bullet("Items Purchase", 2),
        bullet("Labour Payment", 2),
        bullet("Individual Payment", 2),
        bullet("Labour Attendance", 2),
        bullet("Office Administration", 2),
        bullet("Received & Expenses", 2),
        bullet("Total Expenditure (Petty Cash)", 2),
        bullet("Construction"),
        bullet("Work Register", 1),
        bullet("Work Progress Report", 1),
        bullet("Work Expenditure", 1),
        bullet("Items Purchase", 2),
        bullet("Labour Payment", 2),
        bullet("Individual Payment", 2),
        bullet("Labour Attendance", 2),
        bullet("Office Administration", 2),
        bullet("Received & Expenses", 2),
        bullet("Total Expenditure (Petty Cash)", 2),

        h1("5. How the flow should work for staff"),
        bullet("User opens Work List."),
        bullet("Chooses track: Manpower or Construction."),
        bullet("Then opens one of: Work Register, Work Progress Report, or Work Expenditure."),
        bullet("If Work Expenditure is opened, user works inside the sub-items listed above."),
        bullet("Petty Cash / Total Expenditure shows the combined spend picture."),

        h1("6. Link to access hierarchy"),
        p(
          "Super Admin can assign which track / which Work List items a role may open. Then that access is made project-specific and employee-specific (see NK_Access_Role_Hierarchy.docx).",
        ),
        bullet("Example: Technical Staff → Construction → Work Progress Report → assigned projects only."),
        bullet("Example: Accounts → Manpower → Work Expenditure (Labour Payment, Received & Expenses) → assigned projects only."),
        bullet("Example: Ground Staff → Manpower → Labour Attendance → own project only."),

        h2("Module mapping note (for build)"),
        bullet("Work Register — already in CRM / registers area."),
        bullet("Work Progress Report — already live under Progress."),
        bullet("Work Expenditure — new / to be grouped as one menu with the sub-items above."),
        bullet("Items Purchase — aligns with Procurement."),
        bullet("Labour Payment / Individual Payment — aligns with Finance / wage & voucher payments."),
        bullet("Labour Attendance — aligns with Attendance."),
        bullet("Office Administration / Received & Expenses / Petty Cash — cash book style expenditure total."),

        new Paragraph({ spacing: { before: 320 }, children: [] }),
        p("End of document — Client Work List flow for N.K. Enterprise", {
          center: true,
          italics: true,
          size: 18,
          color: "64748B",
        }),
      ],
    },
  ],
});

const outName = "NK_Work_List_Client_Flow.docx";
const projectDocs = path.join(process.cwd(), "docs");
const userDocs = path.join("C:", "Users", "ADMIN", "Documents");
fs.mkdirSync(projectDocs, { recursive: true });
fs.mkdirSync(userDocs, { recursive: true });

const buf = await Packer.toBuffer(doc);
const projectPath = path.join(projectDocs, outName);
const userPath = path.join(userDocs, outName);
fs.writeFileSync(projectPath, buf);
fs.writeFileSync(userPath, buf);
console.log(`Wrote ${projectPath}`);
console.log(`Wrote ${userPath}`);
console.log(`Bytes: ${buf.length}`);
