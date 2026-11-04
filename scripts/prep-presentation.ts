import { PrismaClient } from "@prisma/client";
import { calcWageBill, calcWageLine, gemSampleLines } from "../lib/billing/wageBill.ts";
import { seedDemoAttendance } from "../prisma/demo-people.ts";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "nk" } });
  if (!company) throw new Error("NK company not found. Run prisma seed first.");

  await prisma.company.update({
    where: { id: company.id },
    data: {
      legalName: "M/s N.K.Enterprise",
      shortName: "N.K. Enterprise",
      gstin: "19AKEPD5739K1ZV",
      stateName: "West Bengal",
      stateCode: "19",
      sac: "998519",
    },
  });

  const nsgPayload = {
    clientName: "The Team Commander (Civil)",
    departmentName: "29 SCG, NSG, Regional Centre",
    contractType: "A",
    workName: "Manpower Outsourcing Services - Minimum wage",
    agreementNo: "GEMC-511687725998138",
    tenderNo: "GEMC-511687725998138",
    tenderOpening: new Date("2025-11-15"),
    estimateCost: 763705,
    tenderAmount: 763705,
    emdAmount: 15274,
    emdPercent: 2,
    emdMode: "ONLINE",
    emdInstrumentNo: "GEM-EMD-51168772",
    emdDate: new Date("2025-11-10"),
    emdBankName: "Canara Bank, Bidhannagar, Kolkata",
    emdStatus: "ADJUSTED_TO_PG",
    pgAmount: 38185,
    pgPercent: 5,
    pgMode: "BANK_GUARANTEE",
    pgInstrumentNo: "BG/CANARA/NSG/2025/211",
    pgBankName: "Canara Bank, Bidhannagar, Kolkata",
    pgDate: new Date("2025-11-20"),
    pgExpiryDate: new Date("2026-11-19"),
    pgClaimDate: new Date("2027-02-19"),
    pgStatus: "ACTIVE",
    startAgreement: new Date("2026-02-01"),
    startActual: new Date("2026-02-01"),
    completionAgreement: new Date("2026-02-28"),
    workStatus: "IN_PROGRESS",
    billNumber: "CB/NK/25-26/211",
    billDate: new Date("2026-03-06"),
    grossAmount: 647207.83,
    remarks: "GeM manpower bill CB/NK/25-26/211 for February 2026.",
  };

  const existingNsg = await prisma.contract.findFirst({
    where: { companyId: company.id, agreementNo: "GEMC-511687725998138" },
  });
  const nsg = existingNsg
    ? await prisma.contract.update({ where: { id: existingNsg.id }, data: nsgPayload })
    : await prisma.contract.create({ data: { companyId: company.id, ...nsgPayload } });

  const computed = gemSampleLines().map((line) => calcWageLine(line));
  const totals = calcWageBill(computed);
  const buyerAddress = [
    "Chandkathal Beria, Action Area -III,",
    "New Town, Rajarhat,",
    "Kolkata-743502.",
  ].join("\n");

  const existingGem = await prisma.invoice.findFirst({
    where: { companyId: company.id, billNo: "CB/NK/25-26/211" },
  });
  const dummy = await prisma.invoice.findFirst({
    where: { companyId: company.id, billNo: "NK-INV-2026-08" },
  });

  const invoiceData = {
    companyId: company.id,
    contractId: nsg.id,
    billNo: "CB/NK/25-26/211",
    periodFrom: new Date("2026-02-01"),
    periodTo: new Date("2026-02-28"),
    invoiceDate: new Date("2026-03-06"),
    orderNo: "GEMC-511687725998138",
    grossAmount: totals.basicAmount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    roundOff: totals.roundOff,
    sayTotal: totals.sayTotal,
    totalAmount: totals.sayTotal,
    status: "APPROVED",
    meta: {
      serviceChargePct: 3.85,
      gstRate: 18,
      orderDate: "2025-11-15",
      buyerGstin: "19CALR10790D2D9",
      buyerAddress,
      amountInWords: totals.amountInWords,
      inclusiveTotal: totals.inclusiveTotal,
      grandTotal: totals.grandTotal,
    },
  };

  if (existingGem) {
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: existingGem.id } });
    await prisma.invoice.update({
      where: { id: existingGem.id },
      data: {
        ...invoiceData,
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
    });
  } else if (dummy) {
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: dummy.id } });
    await prisma.invoice.update({
      where: { id: dummy.id },
      data: {
        ...invoiceData,
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
    });
  } else {
    await prisma.invoice.create({
      data: {
        ...invoiceData,
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
    });
  }

  const site = await prisma.site.findFirst({
    where: { companyId: company.id, code: "HEAD-OFFICE" },
  });
  if (site) {
    await prisma.employee.updateMany({
      where: { companyId: company.id, siteId: null, deletedAt: null },
      data: { siteId: site.id },
    });
  }

  await seedDemoAttendance(prisma, company.id, "2026-10");

  const hasGemReceipt = await prisma.ledgerEntry.findFirst({
    where: { companyId: company.id, narration: { contains: "CB/NK/25-26/211" } },
  });
  if (!hasGemReceipt) {
    await prisma.ledgerEntry.create({
      data: {
        companyId: company.id,
        entryDate: new Date("2026-03-18"),
        narration: "Client payment received against Tax Invoice CB/NK/25-26/211 (NSG GeM manpower bill)",
        voucherNumber: "VCH-NSG-2026-211",
        creditAmount: totals.sayTotal,
        debitAmount: 0,
        category: "CLIENT_RECEIPT",
        paymentMode: "BANK_TRANSFER",
      },
    });
  }

  console.log("NK presentation data ready");
  console.log({
    invoice: "CB/NK/25-26/211",
    sayTotal: totals.sayTotal,
    inclusiveTotal: totals.inclusiveTotal,
    amountInWords: totals.amountInWords,
    trades: computed.length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
