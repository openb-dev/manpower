import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "Client-Daily-Work-Tracker.xlsx");

const workbook = new ExcelJS.Workbook();
workbook.creator = "Devsupport";
workbook.created = new Date();
workbook.title = "Client Daily Work Tracker";

const navy = "1E3A5F";
const blue = "1D4ED8";
const light = "EFF6FF";
const grey = "F8FAFC";
const green = "065F46";
const greenBg = "ECFDF5";

function styleHeader(row, color = navy) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "CBD5E1" } },
    };
  });
}

function thinBorder(cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "E2E8F0" } },
    left: { style: "thin", color: { argb: "E2E8F0" } },
    bottom: { style: "thin", color: { argb: "E2E8F0" } },
    right: { style: "thin", color: { argb: "E2E8F0" } },
  };
}

function addDropdown(sheet, col, list) {
  sheet.dataValidations.add(`${col}2:${col}500`, {
    type: "list",
    allowBlank: true,
    formulae: [`"${list.join(",")}"`],
    showErrorMessage: true,
    errorTitle: "Pick from list",
    error: "Use one of the given options.",
  });
}

function paintRows(sheet, start, end, colCount) {
  for (let r = start; r <= end; r += 1) {
    for (let c = 1; c <= colCount; c += 1) {
      const cell = sheet.getCell(r, c);
      thinBorder(cell);
      cell.font = { name: "Calibri", size: 11, color: { argb: "0F172A" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (r % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: grey } };
      }
    }
  }
}

const daily = workbook.addWorksheet("Daily Work", {
  views: [{ state: "frozen", ySplit: 1, xSplit: 0 }],
});
daily.columns = [
  { header: "Date", key: "date", width: 13 },
  { header: "Hours", key: "hours", width: 10 },
  { header: "Module", key: "module", width: 16 },
  { header: "Work done (1–2 lines)", key: "work", width: 52 },
  { header: "Result", key: "result", width: 16 },
  { header: "Waiting on", key: "waiting", width: 16 },
  { header: "Proof / where to see", key: "proof", width: 28 },
];
styleHeader(daily.getRow(1));
daily.autoFilter = { from: "A1", to: "G1" };

const sampleWork = [
  {
    date: new Date(2026, 9, 28),
    hours: 6,
    module: "Apply form",
    work: "Client meeting changes: Full Name, job category dropdown, height unit, education certificate upload, ex-serviceman only for BSF category.",
    result: "Done",
    waiting: "—",
    proof: "Apply page /nk apply form",
  },
  {
    date: new Date(2026, 9, 29),
    hours: 5,
    module: "Apply form",
    work: "Address PO/PS, Fresher/Experienced with addable jobs, nominee + relation, same-as-present address. UAN/ESI only if Experienced. Bank and security deposit after selection.",
    result: "Done",
    waiting: "—",
    proof: "Apply form + Make employee popup",
  },
  {
    date: new Date(2026, 9, 30),
    hours: 4.5,
    module: "HRM",
    work: "Renamed New people → New applicant, Staff → Employees. Multi-select applicants, each form downloads as a separate PDF. Stages renamed Shortlisted / Approved / Rejected.",
    result: "Done",
    waiting: "—",
    proof: "New applicant page",
  },
  {
    date: new Date(2026, 9, 30),
    hours: 1,
    module: "Meeting",
    work: "Logged client and senior follow-up items. Prepared this daily tracker.",
    result: "Done",
    waiting: "—",
    proof: "This file",
  },
];
sampleWork.forEach((row) => daily.addRow(row));
daily.getColumn("date").numFmt = "DD-MMM-YYYY";
daily.getColumn("hours").numFmt = "0.0";
addDropdown(daily, "C", ["Apply form", "HRM", "Attendance", "CRM", "Bills", "Login", "Hosting", "Meeting", "Fix / bug", "Other"]);
addDropdown(daily, "E", ["Done", "In progress", "Waiting client", "Blocked"]);
addDropdown(daily, "F", ["—", "Client", "Me", "Senior", "Hosting", "Vendor"]);
paintRows(daily, 2, 80, 7);
for (let r = 5; r <= 80; r += 1) daily.getRow(r).height = 32;
for (let r = 2; r <= 4; r += 1) daily.getRow(r).height = 48;

const connect = workbook.addWorksheet("Client Connect", {
  views: [{ state: "frozen", ySplit: 1 }],
});
connect.columns = [
  { header: "Date", key: "date", width: 13 },
  { header: "Time", key: "time", width: 10 },
  { header: "Mode", key: "mode", width: 14 },
  { header: "Started by", key: "started", width: 12 },
  { header: "Who (client side)", key: "who", width: 22 },
  { header: "Minutes", key: "minutes", width: 10 },
  { header: "Topic", key: "topic", width: 36 },
  { header: "Outcome / decision", key: "outcome", width: 36 },
  { header: "Follow-up", key: "follow", width: 22 },
];
styleHeader(connect.getRow(1), blue);
connect.autoFilter = { from: "A1", to: "I1" };

const sampleConnect = [
  {
    date: new Date(2026, 9, 28),
    time: "11:00",
    mode: "Meeting",
    started: "Client",
    who: "Client (NK Enterprise)",
    minutes: 90,
    topic: "Application form field changes after yesterday's meeting",
    outcome: "List of form changes agreed. Education certificate mandatory. Ex-serviceman only for BSF.",
    follow: "Build same day",
  },
  {
    date: new Date(2026, 9, 29),
    time: "16:30",
    mode: "WhatsApp",
    started: "Client",
    who: "Client",
    minutes: 20,
    topic: "UAN/ESI, bank details, security deposit timing",
    outcome: "UAN/ESI only if previous employee. Bank + deposit only after approved.",
    follow: "Update form notes + Make employee popup",
  },
  {
    date: new Date(2026, 9, 30),
    time: "17:20",
    mode: "Call",
    started: "Me",
    who: "Senior",
    minutes: 15,
    topic: "Need day-to-day Excel of work and client contacts",
    outcome: "Start this tracker. Fill every working day.",
    follow: "Send weekly summary every Friday",
  },
];
sampleConnect.forEach((row) => connect.addRow(row));
connect.getColumn("date").numFmt = "DD-MMM-YYYY";
addDropdown(connect, "C", ["Call", "WhatsApp", "Email", "Meeting", "Office visit", "Screen share"]);
addDropdown(connect, "D", ["Client", "Me", "Senior"]);
paintRows(connect, 2, 80, 9);
for (let r = 2; r <= 80; r += 1) connect.getRow(r).height = 36;

const weekly = workbook.addWorksheet("Weekly Summary");
weekly.columns = [
  { header: "Item", key: "item", width: 38 },
  { header: "Value", key: "value", width: 18 },
  { header: "How to read it", key: "how", width: 52 },
];
styleHeader(weekly.getRow(1), green);

const summaryRows = [
  ["Total work entries", { formula: "COUNTA('Daily Work'!D2:D500)" }, "How many work rows you logged"],
  ["Total hours", { formula: "SUM('Daily Work'!B2:B500)" }, "Time spent on this client"],
  [
    "Days with work",
    {
      formula:
        "SUMPRODUCT(('Daily Work'!A2:A500<>\"\")*('Daily Work'!A2:A500<>0)*(MATCH('Daily Work'!A2:A500,'Daily Work'!A2:A500,0)=ROW('Daily Work'!A2:A500)-ROW('Daily Work'!A2)+1))",
    },
    "Unique dates you worked",
  ],
  ["Client contacts (all)", { formula: "COUNTA('Client Connect'!G2:G500)" }, "Every call / WhatsApp / meeting"],
  ["Started by client", { formula: "COUNTIF('Client Connect'!D2:D500,\"Client\")" }, "How often they reached you"],
  ["Started by me", { formula: "COUNTIF('Client Connect'!D2:D500,\"Me\")" }, "How often you reached them"],
  ["Minutes with client", { formula: "SUM('Client Connect'!F2:F500)" }, "Talk time, not coding time"],
  ["Waiting on client", { formula: "COUNTIF('Daily Work'!E2:E500,\"Waiting client\")" }, "Items stuck until they reply"],
];
summaryRows.forEach((row, i) => {
  const excelRow = weekly.addRow(row);
  excelRow.height = 24;
  excelRow.eachCell((cell) => {
    thinBorder(cell);
    cell.font = { name: "Calibri", size: 11 };
    cell.alignment = { vertical: "middle", wrapText: true };
    if (i % 2 === 1) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: greenBg } };
    }
  });
  weekly.getCell(excelRow.number, 2).font = { name: "Calibri", size: 12, bold: true, color: { argb: green } };
});

weekly.mergeCells("A11:C11");
weekly.getCell("A11").value = "Fill Daily Work and Client Connect every day. This sheet updates by itself. Send a screenshot of this sheet to your senior every Friday.";
weekly.getCell("A11").alignment = { wrapText: true, vertical: "middle" };
weekly.getCell("A11").font = { name: "Calibri", size: 11, italic: true, color: { argb: "334155" } };
weekly.getRow(11).height = 36;

const how = workbook.addWorksheet("How to fill");
how.columns = [{ width: 92 }];
how.mergeCells("A1:A1");
how.getCell("A1").value = "How to maintain this file (10 minutes a day)";
how.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: navy } };
how.getRow(1).height = 28;

const tips = [
  "1. Fill it the same day, before you close the laptop. Do not write from memory next morning.",
  "2. Daily Work = what you built or fixed. One row per task, not one giant row for the whole day.",
  "3. Client Connect = every time you spoke. If they WhatsApp 3 times on 3 topics, that is 3 rows.",
  "4. Write 1–2 lines in plain English. Your senior should understand without opening the code.",
  "5. Hours are honest. 8 hours of mixed work? Split: 3 HRM, 2 form, 1 meeting, 2 wait/debug.",
  "6. If you are stuck waiting for the client, mark Result = Waiting client. This shows delay is not yours.",
  "7. Never write passwords, OTPs, Aadhaar, or bank numbers in this file.",
  "8. Friday 10 minutes: open Weekly Summary, copy the numbers into a short message to your senior.",
  "9. If the client changes something already done, add a new work row: “Change request: …”. Scope stays visible.",
  "10. Keep this file only for this one client. Start a new file if you have another client.",
  "",
  "Friday message template (copy-paste):",
  "This week for NK Enterprise: X hours, Y work items, Z client contacts (A started by client). Done: … Still waiting on client: … Next week: …",
];
tips.forEach((line, i) => {
  const row = how.getRow(i + 3);
  row.getCell(1).value = line;
  row.getCell(1).font = {
    name: "Calibri",
    size: line.startsWith("Friday") ? 12 : 11,
    bold: line.startsWith("Friday"),
    color: { argb: "0F172A" },
  };
  row.getCell(1).alignment = { wrapText: true, vertical: "top" };
  row.height = line.startsWith("This week") ? 48 : 22;
});

await workbook.xlsx.writeFile(outPath);
console.log(outPath);
