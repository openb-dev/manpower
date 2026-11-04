import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import test from "node:test";
import ExcelJS from "exceljs";
import { attendanceDocument, renderAttendance } from "../server/attendanceExport.js";

function docxText(buffer) {
  let offset = 0;
  while (offset + 30 < buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressed = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    const data = buffer.subarray(start, start + compressed);
    if (name === "word/document.xml") return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    offset = start + compressed;
  }
  return "";
}

const sheet = {
  sheet_name: "Attendance Sheet(Actual)",
  company_name: "M/s. N.K. Enterprise",
  work_name: "ARMO labour at 29 SCG NSG Kolkata",
  work_order_no: "GEMC-511687725998138",
  work_order_date: "2025-11-15",
  period_from: "2026-02-01",
  period_to: "2026-02-28",
  period_note: "Act",
  rows: [
    { row_kind: "trade", trade: "Plumber", workman_name: "Plumber", marks: {}, total_days: null, sl_no: "", bill_sl_no: "" },
    { row_kind: "workman", trade: "Plumber", workman_name: "Sukhen Mondal", sl_no: "1", bill_sl_no: "1", total_days: 22, marks: { 1: "P", 3: "L", 31: "L" } },
  ],
  wageLines: [],
  extraPayments: [],
};

test("attendance document keeps day marks through day 31", () => {
  const document = attendanceDocument(sheet);
  const sukhen = document.rows[1];
  assert.equal(sukhen.cells[2], "Sukhen Mondal");
  assert.equal(sukhen.cells[3], "P");
  assert.equal(sukhen.cells[5], "L");
  assert.equal(sukhen.cells[33], "L");
  assert.equal(sukhen.cells[34], 22);
});

test("attendance export writes pdf, word, and excel", async () => {
  const pdf = await renderAttendance(sheet, "pdf");
  const word = await renderAttendance(sheet, "word");
  const excel = await renderAttendance(sheet, "excel");
  assert.equal(pdf.buffer.subarray(0, 4).toString(), "%PDF");
  assert.equal(word.buffer.subarray(0, 2).toString(), "PK");
  assert.equal(excel.buffer.subarray(0, 2).toString(), "PK");
  assert.match(docxText(word.buffer), /Sukhen Mondal/);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(excel.buffer);
  const values = book.worksheets[0].getSheetValues().flat().map((cell) => (cell && cell.text ? cell.text : cell)).join(" ");
  assert.match(values, /Sukhen Mondal/);
  assert.match(values, /GEMC-511687725998138/);
});
