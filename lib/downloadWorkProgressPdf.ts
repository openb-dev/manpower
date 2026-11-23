import { formatDateDmy } from "@/lib/applicantFormFields";
import {
  adjustRowLabel,
  buildProgressFooter,
  columnAmount,
  defaultRaBills,
  itemBalanceQty,
  itemRaQty,
  itemRate,
  moneyText,
  parseProgressItems,
  parseRaNotes,
} from "@/lib/workProgress";

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

function cell(pdf: any, x: number, y: number, w: number, h: number, text: string, opts?: { bold?: boolean; size?: number; align?: "left" | "center" | "right" }) {
  pdf.rect(x, y, w, h);
  pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
  pdf.setFontSize(opts?.size || 6);
  const lines = pdf.splitTextToSize(String(text || ""), Math.max(w - 1.2, 2));
  const align = opts?.align || "left";
  const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - 0.6 : x + 0.6;
  pdf.text(lines.slice(0, 6), tx, y + 2.1, { align });
}

export async function downloadWorkProgressPdf({
  companyName,
  rows,
}: {
  companyName: string;
  rows: any[];
}) {
  const jsPDF = await loadJsPdf();
  const pageW = 420;
  const pageH = 210;
  const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "landscape" });
  const list = rows.length ? rows : [];

  list.forEach((report, reportIndex) => {
    if (reportIndex) pdf.addPage([pageW, pageH], "landscape");
    const raBills = defaultRaBills(report.raBills);
    const items = parseProgressItems(report.items);
    const notes = parseRaNotes(report.raNotes);
    const footer = buildProgressFooter(items, report);
    const reportDate = report.reportDate ? formatDateDmy(report.reportDate, "") : "";
    const balanceDate = report.balanceDate ? formatDateDmy(report.balanceDate, "") : reportDate;
    const margin = 6;
    let y = 8;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(`Work Details Report as on ${reportDate || "……/……/……"}`, pageW / 2, y, { align: "center" });
    y += 5;
    pdf.setFontSize(8);
    const heads = [
      ["1 Name of work:", report.nameOfWork || ""],
      ["2 Department :", report.department || ""],
      ["3 Situation :", report.situation || ""],
      ["4 Stipulated date of start:", report.stipulatedStart ? formatDateDmy(report.stipulatedStart, "") : ""],
      ["5 Actual date of start:", report.actualStart ? formatDateDmy(report.actualStart, "") : ""],
      ["6 Stipulated date of completion:", report.stipulatedCompletion ? formatDateDmy(report.stipulatedCompletion, "") : ""],
      ["7 Actual date of completion :", report.actualCompletion ? formatDateDmy(report.actualCompletion, "") : ""],
      ["8 Work Status:", report.workStatus || ""],
      ["9 Name of Agency :", report.agencyName || ""],
    ];
    heads.forEach(([label, value]) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, y);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(String(value || ""), pageW - margin * 2 - 55);
      pdf.text(lines.slice(0, 2), margin + 55, y);
      y += Math.max(4, lines.slice(0, 2).length * 3.4);
    });
    y += 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(`WORK DETAILS REPORT AS ON DATE ${reportDate || "……/……/……"}`, pageW / 2, y, { align: "center" });
    y += 3;

    const innerW = pageW - margin * 2;
    const widths = [10, 62, 14, 12, 16, 18, ...raBills.flatMap(() => [14, 16, 18]), 14, 16, 18, 22];
    const totalW = widths.reduce((s, w) => s + w, 0);
    const scaled = widths.map((w) => (w / totalW) * innerW);
    const rowH = 7.2;

    const drawRow = (values: string[], bold = false, height = rowH) => {
      if (y + height > pageH - margin) {
        pdf.addPage([pageW, pageH], "landscape");
        y = margin;
      }
      let x = margin;
      values.forEach((value, i) => {
        const w = scaled[i] || 12;
        const align = i === 1 || i === values.length - 1 || i === 0 || i === 3 ? (i === 0 || i === 3 ? "center" : "left") : "right";
        cell(pdf, x, y, w, height, value, { bold, size: 5.5, align: i === 1 ? "left" : align });
        x += w;
      });
      y += height;
    };

    const group = (label: string, span: number) => ({ label, span });
    const groups = [
      group("Sl. No.", 1),
      group("Particulars", 1),
      group("AS PER BOQ", 4),
      ...raBills.map((raNo) => group(`AS PER ${String(raNo).toUpperCase()} R.A. BILL${notes[raNo] ? `\n${notes[raNo]}` : ""}`, 3)),
      group(`BALANCE WORK AS ON DATE ${balanceDate || "…./…./……"}`, 3),
      group("Remarks", 1),
    ];
    if (y + 14 > pageH - margin) {
      pdf.addPage([pageW, pageH], "landscape");
      y = margin;
    }
    let x = margin;
    let idx = 0;
    groups.forEach((g) => {
      const w = scaled.slice(idx, idx + g.span).reduce((s, n) => s + n, 0);
      cell(pdf, x, y, w, 8, g.label, { bold: true, size: 5.5, align: "center" });
      x += w;
      idx += g.span;
    });
    y += 8;
    drawRow(
      ["", "", "Qty.", "Unit", "Rate (Rs.)", "Amount (Rs.)", ...raBills.flatMap(() => ["Qty.", "Rate (Rs.)", "Amount (Rs.)"]), "Qty.", "Rate (Rs.)", "Amount (Rs.)", ""],
      true,
      6.2,
    );

    const itemRow = (item: (typeof items)[number]) => [
      item.slNo,
      item.particulars,
      moneyText(item.boqQty) || String(item.boqQty || ""),
      item.unit,
      moneyText(item.boqRate) || String(item.boqRate || ""),
      moneyText(columnAmount(item, "boq", raBills)),
      ...raBills.flatMap((raNo) => [
        moneyText(itemRaQty(item, raNo)),
        moneyText(itemRate(item, raNo)),
        moneyText(columnAmount(item, raNo, raBills)),
      ]),
      moneyText(itemBalanceQty(item, raBills)),
      moneyText(itemRate(item)),
      moneyText(columnAmount(item, "balance", raBills)),
      item.remarks || "",
    ];

    const moneyRow = (label: string, values: Record<string, number>) => [
      "",
      label,
      "",
      "",
      "",
      moneyText(values.boq),
      ...raBills.flatMap((raNo) => ["", "", moneyText(values[raNo])]),
      "",
      "",
      moneyText(values.balance),
      "",
    ];

    items.filter((item) => item.kind !== "EXTRA").forEach((item) => drawRow(itemRow(item), false, Math.min(18, 6 + Math.ceil(String(item.particulars || "").length / 55) * 3)));
    drawRow(moneyRow("Total=", footer.total), true);
    drawRow(moneyRow(adjustRowLabel(footer.adjustKind, footer.lessPct), footer.less), true);
    drawRow(moneyRow("(A) Sub-Total=", footer.subA), true);
    const extras = items.filter((item) => item.kind === "EXTRA");
    if (extras.length) {
      drawRow(["", "Extra Items", "", "", "", "", ...raBills.flatMap(() => ["", "", ""]), "", "", "", ""], true);
      extras.forEach((item) => drawRow(itemRow(item), false, Math.min(18, 6 + Math.ceil(String(item.particulars || "").length / 55) * 3)));
    }
    drawRow(moneyRow("(B) Sub-Total=", footer.extra), true);
    drawRow(moneyRow("(A+B) Grand Total=", footer.grand), true);
    drawRow(["", "Recovery", "", "", "", "", ...raBills.flatMap(() => ["", "", ""]), "", "", "", ""], true);
    drawRow(moneyRow(`Security Deposit@${footer.sdPct}%=`, footer.sd), true);
    drawRow(moneyRow(`Income Tax@${footer.itPct}%=`, footer.it), true);
    drawRow(moneyRow(`GST@${footer.gstPct}%=`, footer.gst), true);
    drawRow(moneyRow(`Labour Cess@${footer.labourPct}%=`, footer.labour), true);
    drawRow(moneyRow("Total Recoveries=", footer.recoveries), true);
    drawRow(moneyRow("Net Payable Amount=", footer.net), true);
    if (report.note) {
      y += 3;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const noteLines = pdf.splitTextToSize(`Note:- ${report.note}`, innerW);
      pdf.text(noteLines, margin, y);
    }
  });

  saveBlob(pdf.output("blob"), `Work Progress Report ${companyName}.pdf`);
}
