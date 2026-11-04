import PDFDocument from "pdfkit";
import { monthLabel } from "./months.js";

export function payFigures(attendance, salary, divisor, deduct) {
  const salaryN = salary === null || salary === undefined ? null : Number(salary);
  const divisorN = Number(divisor);
  if (salaryN === null || !Number.isFinite(salaryN) || !Number.isFinite(divisorN) || divisorN <= 0) {
    return { rate: null, month: null, actual: null };
  }
  const rate = Math.round(salaryN / divisorN);
  const month = attendance === null || attendance === undefined ? null : Math.round(Number(attendance) * salaryN / divisorN);
  const actual = month === null ? null : month - Number(deduct || 0);
  return { rate, month, actual };
}

function line(doc, label, value) {
  doc.font("Helvetica").text(label, { continued: true });
  doc.font("Helvetica-Bold").text(`    ${value}`);
}

export function payslipPdf({ company, person, month }) {
  const figures = payFigures(person.attendance, person.salary, person.divisor, person.deduct);
  const money = (value) => (value === null || value === undefined || value === "" ? "—" : `Rs ${Number(value).toLocaleString("en-IN")}`);
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.font("Helvetica-Bold").fontSize(16).text(company || "NK Enterprise");
    doc.moveDown(0.4);
    doc.fontSize(13).text(`Payslip — ${monthLabel(month)}`);
    doc.moveDown();
    doc.fontSize(12);
    line(doc, "Name", person.name || "");
    line(doc, "Trade", person.trade || "—");
    line(doc, "Original salary", money(person.salary));
    line(doc, "Days for full pay", person.divisor ?? "—");
    line(doc, "Attendance", person.attendance ?? "—");
    line(doc, "Rate per day", money(figures.rate));
    line(doc, "Salary for this month", money(figures.month));
    line(doc, "Deduct this month", money(person.deduct || 0));
    line(doc, "Actual salary", money(figures.actual));
    line(doc, "Payment done", money(person.paymentDone));
    doc.end();
  });
}
