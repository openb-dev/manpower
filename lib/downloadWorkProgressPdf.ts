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

function dateDot(value: unknown) {
  const dmy = formatDateDmy(value as string, "");
  return dmy ? dmy.replace(/\//g, ".") : "";
}

function titleDash(value: unknown) {
  const dmy = formatDateDmy(value as string, "");
  return dmy ? dmy.replace(/\//g, "-") : "……/……/……";
}

function cell(
  pdf: any,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts?: { bold?: boolean; size?: number; align?: "left" | "center" | "right"; maxLines?: number },
) {
  pdf.rect(x, y, w, h);
  pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
  pdf.setFontSize(opts?.size || 6);
  const maxLines = opts?.maxLines ?? 8;
  const lines = pdf.splitTextToSize(String(text || ""), Math.max(w - 1.2, 2));
  const align = opts?.align || "left";
  const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - 0.6 : x + 0.6;
  pdf.text(lines.slice(0, maxLines), tx, y + 2.1, { align });
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
  const pageH = 297;
  const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: "landscape" });
  const list = rows.length ? rows : [];

  list.forEach((report, reportIndex) => {
    if (reportIndex) pdf.addPage([pageW, pageH], "landscape");
    const raBills = defaultRaBills(report.raBills);
    const items = parseProgressItems(report.items);
    const notes = parseRaNotes(report.raNotes);
    const footer = buildProgressFooter(items, report);
    const reportDate = report.reportDate ? titleDash(report.reportDate) : "……/……/……";
    const balanceDate = report.balanceDate
      ? formatDateDmy(report.balanceDate, "").replace(/\//g, ".")
      : "…./…./……";
    const margin = 6;
    let y = 8;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(`Work Details Report as on ${reportDate}`, pageW / 2, y, { align: "center" });
    y += 6;
    pdf.setFontSize(8);
    // Same value indent for every header line (incl. dates)
    const labelW = 62;
    const valueX = margin + labelW;
    const valueW = pageW - margin * 2 - labelW;
    const rightLabelX = valueX + 30;
    const rightValueX = rightLabelX + 58;

    const writeHeadLine = (label: string, value: string, wrapLines = 2) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, y);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(String(value || ""), valueW);
      const shown = lines.slice(0, wrapLines);
      pdf.text(shown, valueX, y);
      y += Math.max(4.4, shown.length * 3.5);
    };

    /** Both dates on one line; values share the same indent as other header fields. */
    const writeDatePair = (
      leftLabel: string,
      leftValue: string,
      rightLabel: string,
      rightValue: string,
    ) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(leftLabel, margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(leftValue || ""), valueX, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(rightLabel, rightLabelX, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(String(rightValue || ""), rightValueX, y);
      y += 4.6;
    };

    writeHeadLine("1 Name of work:", report.nameOfWork || "", 3);
    writeHeadLine("2 Work Order / Agreement No. :", report.workOrderNo || "");
    writeHeadLine("3 Work Order / Agreement date :", dateDot(report.workOrderDate));
    writeHeadLine("4 Period :", report.period || "");
    writeHeadLine("5 Department :", report.department || "");
    writeHeadLine("6 Situation :", report.situation || "");
    writeDatePair(
      "7 Stipulated date of start:",
      dateDot(report.stipulatedStart),
      "8 Actual date of start:",
      dateDot(report.actualStart),
    );
    writeDatePair(
      "9 Stipulated date of completion:",
      dateDot(report.stipulatedCompletion),
      "10 Actual date of completion :",
      dateDot(report.actualCompletion),
    );
    writeHeadLine("11 Work Status:", report.workStatus || "");
    writeHeadLine("12 Name of Agency :", report.agencyName || "");
    y += 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(`WORK DETAILS REPORT AS ON DATE ${reportDate}`, pageW / 2, y, { align: "center" });
    y += 4;

    const innerW = pageW - margin * 2;
    // Box proportions close to client sheet: narrow Sl, wide Particulars, compact money cols
    const widths = [8, 58, 12, 10, 14, 16, ...raBills.flatMap(() => [12, 14, 16]), 12, 14, 16, 18];
    const totalW = widths.reduce((s, w) => s + w, 0);
    const scaled = widths.map((w) => (w / totalW) * innerW);

    const drawRow = (values: string[], bold = false, height = 7.2, maxLines = 6) => {
      if (y + height > pageH - margin) {
        pdf.addPage([pageW, pageH], "landscape");
        y = margin;
      }
      let x = margin;
      values.forEach((value, i) => {
        const w = scaled[i] || 12;
        const align =
          i === 1 ? "left" : i === 0 || i === 3 ? "center" : i === values.length - 1 ? "left" : "right";
        cell(pdf, x, y, w, height, value, { bold, size: 5.4, align, maxLines });
        x += w;
      });
      y += height;
    };

    const groups = [
      { label: "Sl. No.", span: 1 },
      { label: "Particulars", span: 1 },
      { label: "AS PER BOQ", span: 4 },
      ...raBills.map((raNo) => ({
        label: `AS PER ${String(raNo).toUpperCase()} R.A. BILL${notes[raNo] ? `\n${notes[raNo]}` : ""}`,
        span: 3,
      })),
      { label: `BALANCE WORK AS ON\nDATE ${balanceDate}`, span: 3 },
      { label: "Remarks", span: 1 },
    ];
    if (y + 16 > pageH - margin) {
      pdf.addPage([pageW, pageH], "landscape");
      y = margin;
    }
    let x = margin;
    let idx = 0;
    groups.forEach((g) => {
      const w = scaled.slice(idx, idx + g.span).reduce((s, n) => s + n, 0);
      cell(pdf, x, y, w, 9, g.label, { bold: true, size: 5.4, align: "center", maxLines: 3 });
      x += w;
      idx += g.span;
    });
    y += 9;
    drawRow(
      [
        "",
        "",
        "Qty.",
        "Unit",
        "Rate (Rs.)",
        "Amount (Rs.)",
        ...raBills.flatMap(() => ["Qty.", "Rate (Rs.)", "Amount (Rs.)"]),
        "Qty.",
        "Rate (Rs.)",
        "Amount (Rs.)",
        "",
      ],
      true,
      6,
      1,
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

    items
      .filter((item) => item.kind !== "EXTRA")
      .forEach((item) =>
        drawRow(
          itemRow(item),
          false,
          Math.min(28, 6.5 + Math.ceil(String(item.particulars || "").length / 48) * 3.2),
          8,
        ),
      );
    drawRow(moneyRow("Total=", footer.total), true);
    drawRow(moneyRow(adjustRowLabel(footer.adjustKind, footer.lessPct), footer.less), true);
    drawRow(moneyRow("(A) Sub-Total=", footer.subA), true);
    const extras = items.filter((item) => item.kind === "EXTRA");
    if (extras.length) {
      drawRow(["", "Extra Items", "", "", "", "", ...raBills.flatMap(() => ["", "", ""]), "", "", "", ""], true);
      extras.forEach((item) =>
        drawRow(
          itemRow(item),
          false,
          Math.min(28, 6.5 + Math.ceil(String(item.particulars || "").length / 48) * 3.2),
          8,
        ),
      );
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
      if (y > pageH - margin - 10) {
        pdf.addPage([pageW, pageH], "landscape");
        y = margin;
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const noteLines = pdf.splitTextToSize(`Note:- ${report.note}`, innerW);
      pdf.text(noteLines, margin, y);
    }
  });

  saveBlob(pdf.output("blob"), `Work Progress Report ${companyName}.pdf`);
}
