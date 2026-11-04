import { prisma } from "../../lib/db/index.ts";
import { calcWageBill, calcWageLine } from "../../lib/billing/wageBill.ts";

function mustText(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function mustNumber(value: unknown, label: string, allowZero = false) {
  if (value === "" || value == null) throw new Error(`${label} is required.`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${label} is required.`);
  if (!allowZero && n <= 0) throw new Error(`${label} is required.`);
  return n;
}

export async function createWageInvoice(companyId: string, body: any) {
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const contractId = mustText(body.contractId, "Client / work");
  const billNo = mustText(body.billNo, "Invoice No.");
  const invoiceDate = mustText(body.invoiceDate, "Invoice date");
  const orderNo = mustText(body.orderNo, "Order No.");
  const orderDate = mustText(body.orderDate, "Order date");
  const periodFrom = mustText(body.periodFrom, "Period from");
  const periodTo = mustText(body.periodTo, "Period to");
  const buyerGstin = mustText(body.buyerGstin, "Buyer GSTIN");
  const buyerAddress = mustText(body.buyerAddress, "Buyer address");
  const serviceChargePct = mustNumber(body.serviceChargePct, "Service charge %", true);
  if (!rawLines.length) throw new Error("Add at least one trade line.");

  for (const [index, line] of rawLines.entries()) {
    const n = index + 1;
    mustText(line.trade, `Trade / post on line ${n}`);
    mustText(line.skill, `Skill on line ${n}`);
    mustText(line.education, `School on line ${n}`);
    mustText(line.sac, `SAC on line ${n}`);
    mustNumber(line.qty ?? line.manDays, `Days on line ${n}`);
    mustNumber(line.basic ?? line.ratePerDay, `Basic wage / day on line ${n}`);
    mustNumber(line.optional1, `Optional 1 on line ${n}`, true);
    mustNumber(line.optional2, `Optional 2 on line ${n}`, true);
    mustText(line.optional1Label, `Optional 1 name on line ${n}`);
    mustText(line.optional2Label, `Optional 2 name on line ${n}`);
  }
  const computed = rawLines.map((line: any) =>
    calcWageLine(
      {
        trade: line.trade,
        skill: line.skill,
        education: line.education,
        qty: Number(line.qty ?? line.manDays),
        basic: Number(line.basic ?? line.ratePerDay),
        optional1: Number(line.optional1 || 0),
        optional2: Number(line.optional2 || 0),
        optional1Label: line.optional1Label,
        optional2Label: line.optional2Label,
        sac: line.sac,
      },
      { serviceChargePct },
    ),
  );
  const totals = calcWageBill(computed);

  return prisma.invoice.create({
    data: {
      companyId,
      contractId,
      billNo,
      periodFrom: new Date(periodFrom),
      periodTo: new Date(periodTo),
      invoiceDate: new Date(invoiceDate),
      orderNo,
      grossAmount: totals.basicAmount,
      cgst: totals.cgst,
      sgst: totals.sgst,
      roundOff: totals.roundOff,
      sayTotal: totals.sayTotal,
      totalAmount: totals.sayTotal,
      status: body.status || "DRAFT",
      meta: {
        serviceChargePct,
        gstRate: 18,
        orderDate,
        buyerGstin,
        buyerAddress,
        amountInWords: totals.amountInWords,
        inclusiveTotal: totals.inclusiveTotal,
        grandTotal: totals.grandTotal,
      },
      lines: {
        create: computed.map((line) => ({
          trade: line.trade,
          skill: line.skill,
          sac: line.sac,
          manDays: line.qty,
          ratePerDay: line.grossRate,
          amount: line.amount,
          breakup: line,
        })),
      },
    },
    include: { lines: true, contract: true },
  });
}
