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
    width = 2340,
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
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text, bold, size, font: "Calibri", color })],
      }),
    ],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0, line: 276 },
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
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, font: "Calibri", color: NAVY })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 21, font: "Calibri", color: "1E293B" })],
  });
}

function step(text) {
  return new Paragraph({
    numbering: { reference: "steps", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 21, font: "Calibri", color: "1E293B" })],
  });
}

function boxRow(label, detail, fill) {
  return new TableRow({
    children: [
      cell(label, { bold: true, fill, width: 2800, center: true, color: WHITE, size: 20 }),
      cell(detail, { fill: LIGHT, width: 6560, size: 20 }),
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
        ],
      },
      {
        reference: "steps",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({ text: "N.K. ENTERPRISE", bold: true, size: 36, font: "Calibri", color: NAVY }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Manpower Architecture — Access & Role Hierarchy",
              bold: true,
              size: 26,
              font: "Calibri",
              color: BLUE,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 280 },
          children: [
            new TextRun({
              text: "Project design note  |  Role → Project → Employee",
              size: 20,
              font: "Calibri",
              color: "64748B",
              italics: true,
            }),
          ],
        }),

        h1("1. Purpose"),
        p(
          "This document defines how system access is organised: who can do what, how roles are created, how projects are assigned, and how that finally maps to each employee.",
        ),

        h1("2. Overall hierarchy"),
        p("Access is layered from the top of the organisation down to the individual employee.", {
          after: 120,
        }),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [9360],
          rows: [
            new TableRow({
              children: [
                cell("SUPER ADMIN  —  All access", {
                  bold: true,
                  fill: NAVY,
                  width: 9360,
                  center: true,
                  color: WHITE,
                  size: 22,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell("↓  Creates roles  ·  Assigns projects  ·  Full system control", {
                  fill: LIGHT,
                  width: 9360,
                  center: true,
                  size: 18,
                  color: "334155",
                }),
              ],
            }),
            new TableRow({
              children: [
                cell("ADMIN ROLES  (office / field staff with limited modules)", {
                  bold: true,
                  fill: BLUE,
                  width: 9360,
                  center: true,
                  color: WHITE,
                  size: 22,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell(
                  "Accounts  ·  Back Office  ·  Supervisor  ·  Ground Staff  ·  Technical Staff",
                  {
                    fill: LIGHT,
                    width: 9360,
                    center: true,
                    size: 18,
                    color: "334155",
                  },
                ),
              ],
            }),
            new TableRow({
              children: [
                cell("↓  Role is then made PROJECT-SPECIFIC", {
                  fill: "FEF3C7",
                  width: 9360,
                  center: true,
                  size: 18,
                  color: AMBER,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell("PROJECT ASSIGNMENT  —  which site / contract / work the role can see", {
                  bold: true,
                  fill: GREEN,
                  width: 9360,
                  center: true,
                  color: WHITE,
                  size: 22,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell("↓  Within that project, rights apply to the linked person", {
                  fill: "DCFCE7",
                  width: 9360,
                  center: true,
                  size: 18,
                  color: GREEN,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell(
                  "EMPLOYEE-SPECIFIC  —  one named person holds that role on that project",
                  {
                    bold: true,
                    fill: TEAL,
                    width: 9360,
                    center: true,
                    color: WHITE,
                    size: 22,
                  },
                ),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 200, after: 80 }, children: [] }),
        p("Rule in one line: Role → Project-specific → Employee-specific.", {
          bold: true,
          size: 22,
        }),

        h1("3. Level 1 — Super Admin"),
        p("The Super Admin has unrestricted access across companies and modules."),
        bullet("Full access to every module (HRM, CRM, Finance, Progress, Attendance, Reports, etc.)."),
        bullet("Can add / edit / remove Admin roles."),
        bullet("Can assign a role to one or more projects (sites / contracts)."),
        bullet("Can map a role + project combination to a specific employee (login user)."),
        bullet("Can create and manage companies and company admins when needed."),

        h1("4. Level 2 — Admin roles"),
        p(
          "These are the standard admin types under Super Admin. Each role opens only the modules needed for that job.",
        ),
        new Paragraph({ spacing: { after: 120 }, children: [] }),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2400, 3480, 3480],
          rows: [
            new TableRow({
              children: [
                cell("Admin role", {
                  bold: true,
                  fill: NAVY,
                  width: 2400,
                  center: true,
                  color: WHITE,
                }),
                cell("Typical work", {
                  bold: true,
                  fill: NAVY,
                  width: 3480,
                  center: true,
                  color: WHITE,
                }),
                cell("Suggested access (modules)", {
                  bold: true,
                  fill: NAVY,
                  width: 3480,
                  center: true,
                  color: WHITE,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell("Accounts", { bold: true, fill: LIGHT, width: 2400 }),
                cell("Billing, recoveries, ledger, invoices, payments", {
                  fill: WHITE,
                  width: 3480,
                }),
                cell("Accounts, Finance, Reports (money)", { fill: WHITE, width: 3480 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Back Office", { bold: true, fill: LIGHT, width: 2400 }),
                cell(
                  "Applications, employee records, office registers, CRM paperwork",
                  { fill: WHITE, width: 3480 },
                ),
                cell("Applicants, Employees, CRM, Reports", { fill: WHITE, width: 3480 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Supervisor", { bold: true, fill: LIGHT, width: 2400 }),
                cell(
                  "Day-to-day site oversight, attendance, progress follow-up",
                  { fill: WHITE, width: 3480 },
                ),
                cell("Attendance, Progress, Employees (view), Dashboard", {
                  fill: WHITE,
                  width: 3480,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell("Ground Staff", { bold: true, fill: LIGHT, width: 2400 }),
                cell(
                  "On-site execution entry — attendance / simple site updates",
                  { fill: WHITE, width: 3480 },
                ),
                cell("Attendance (own site), limited Progress entry", {
                  fill: WHITE,
                  width: 3480,
                }),
              ],
            }),
            new TableRow({
              children: [
                cell("Technical Staff", { bold: true, fill: LIGHT, width: 2400 }),
                cell(
                  "Technical measurements, BOQ / work progress, site technical notes",
                  { fill: WHITE, width: 3480 },
                ),
                cell("Progress, Procurement (as needed), Reports", {
                  fill: WHITE,
                  width: 3480,
                }),
              ],
            }),
          ],
        }),

        h1("5. Level 3 — Project-specific"),
        p("A role alone is not enough. The same role can be limited to selected projects."),
        bullet('Example: Supervisor A is assigned only to Project "Bank Site - Howrah".'),
        bullet("Example: Accounts B can see billing only for Projects X and Y."),
        bullet("Super Admin chooses which project(s) each admin user may open."),
        bullet("Data outside the assigned project list stays hidden."),

        h1("6. Level 4 — Employee-specific"),
        p("After role + project, access is tied to one employee (named user)."),
        bullet("Each login belongs to one person."),
        bullet(
          "That person holds one primary admin role (or a defined set) for the assigned project(s).",
        ),
        bullet(
          "If the employee leaves or is moved, Super Admin reassigns or revokes the project link.",
        ),
        bullet("History of who held which role on which project should remain auditable."),

        h1("7. Assignment flow (how Super Admin sets it up)"),
        step(
          "Create or confirm the Admin role (Accounts / Back Office / Supervisor / Ground Staff / Technical Staff).",
        ),
        step("Select the project(s) this role may access."),
        step("Select the employee (user) who will hold that role on those projects."),
        step(
          "Save — the employee can now log in and only see allowed modules for allowed projects.",
        ),

        h1("8. Worked example"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 6560],
          rows: [
            boxRow("Role", "Supervisor", NAVY),
            boxRow("Project", "GEM Site - Salt Lake (Contract #...)", BLUE),
            boxRow("Employee", "Ramesh Das (mobile / login ID)", GREEN),
            boxRow(
              "Result",
              "Ramesh opens only Supervisor modules for that Salt Lake project.",
              TEAL,
            ),
          ],
        }),

        h1("9. Summary tree"),
        p("Super Admin (all access)", { bold: true }),
        bullet("Can add roles"),
        bullet("Can assign projects"),
        bullet("Admin roles"),
        bullet("Accounts", 1),
        bullet("Back Office", 1),
        bullet("Supervisor", 1),
        bullet("Ground Staff", 1),
        bullet("Technical Staff", 1),
        bullet("Each admin role → Project-specific scope"),
        bullet("Each project scope → Employee-specific assignment"),

        new Paragraph({ spacing: { before: 360 }, children: [] }),
        p("End of document — N.K. Enterprise Manpower Architecture", {
          center: true,
          italics: true,
          size: 18,
          color: "64748B",
        }),
      ],
    },
  ],
});

const outDir = path.join(process.cwd(), "docs");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "NK_Access_Role_Hierarchy.docx");
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(out, buf);
console.log(`Wrote ${out} (${buf.length} bytes)`);
