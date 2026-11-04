export const BILL_DEFAULTS = {
  sac: "998519",
  gstRate: 18,
  serviceChargePct: 3.85,
  workingDays: 26,
  pfCeiling: 15000,
  esiLimit: 21000,
  epfPct: 12,
  edliPct: 0.5,
  pfAdminPct: 0.5,
  esiPct: 3.25,
};

export type WageLineInput = {
  trade: string;
  skill?: string;
  education?: string;
  qty: number;
  basic: number;
  optional1?: number;
  optional2?: number;
  optional1Label?: string;
  optional2Label?: string;
  sac?: string;
};

export type WageLineBreakup = {
  trade: string;
  skill: string;
  education: string;
  sac: string;
  qty: number;
  unit: "Days";
  basic: number;
  esi: number;
  epf: number;
  edli: number;
  pfAdmin: number;
  optional1: number;
  optional2: number;
  optional1Label: string;
  optional2Label: string;
  exclusive: number;
  gst: number;
  afterGst: number;
  serviceCharge: number;
  grossRate: number;
  amount: number;
  description: string;
};

export type WageBillTotals = {
  inclusiveTotal: number;
  basicAmount: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  roundOff: number;
  sayTotal: number;
  amountInWords: string;
};

function money(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function pfOnCeiling(
  ceiling = BILL_DEFAULTS.pfCeiling,
  pct: number,
  workingDays = BILL_DEFAULTS.workingDays,
) {
  return money((ceiling * (pct / 100)) / workingDays);
}

export function calcEsi(basic: number, workingDays = BILL_DEFAULTS.workingDays) {
  const monthly = money(basic * workingDays);
  if (monthly > BILL_DEFAULTS.esiLimit) return 0;
  return money(basic * (BILL_DEFAULTS.esiPct / 100));
}

export function calcWageLine(
  input: WageLineInput,
  opts?: { serviceChargePct?: number; gstRate?: number; workingDays?: number },
): WageLineBreakup {
  const serviceChargePct = opts?.serviceChargePct ?? BILL_DEFAULTS.serviceChargePct;
  const gstRate = opts?.gstRate ?? BILL_DEFAULTS.gstRate;
  const workingDays = opts?.workingDays ?? BILL_DEFAULTS.workingDays;
  const skill = input.skill || "Skilled";
  const education = input.education || "High School";
  const basic = money(input.basic);
  const esi = calcEsi(basic, workingDays);
  const epf = pfOnCeiling(BILL_DEFAULTS.pfCeiling, BILL_DEFAULTS.epfPct, workingDays);
  const edli = pfOnCeiling(BILL_DEFAULTS.pfCeiling, BILL_DEFAULTS.edliPct, workingDays);
  const pfAdmin = pfOnCeiling(BILL_DEFAULTS.pfCeiling, BILL_DEFAULTS.pfAdminPct, workingDays);
  const optional1 = money(input.optional1 || 0);
  const optional2 = money(input.optional2 || 0);
  const exclusive = money(basic + esi + epf + edli + pfAdmin + optional1 + optional2);
  const gst = money(exclusive * (gstRate / 100));
  const afterGst = money(exclusive + gst);
  const serviceCharge = money(exclusive * (serviceChargePct / 100));
  const grossRate = money(afterGst + serviceCharge);
  const qty = money(input.qty);
  const amount = money(qty * grossRate);

  return {
    trade: input.trade.trim(),
    skill,
    education,
    sac: input.sac || BILL_DEFAULTS.sac,
    qty,
    unit: "Days",
    basic,
    esi,
    epf,
    edli,
    pfAdmin,
    optional1,
    optional2,
    optional1Label: input.optional1Label || "Optional Allowance 1",
    optional2Label: input.optional2Label || "Optional Allowance 2",
    exclusive,
    gst,
    afterGst,
    serviceCharge,
    grossRate,
    amount,
    description: `Manpower Outsourcing Services - Minimum wage - ${skill}; ${education}; Others.`,
  };
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function displayBillTotals(totals: Partial<WageBillTotals> | null | undefined): WageBillTotals {
  const basicAmount = num(totals?.basicAmount);
  const cgst = num(totals?.cgst);
  const sgst = num(totals?.sgst);
  const grandTotal = num(totals?.grandTotal) || money(basicAmount + cgst + sgst);
  const inclusiveTotal = num(totals?.inclusiveTotal) || grandTotal;
  const sayTotal = num(totals?.sayTotal) || Math.round(grandTotal) || Math.round(inclusiveTotal);
  const roundOff = num(totals?.roundOff) || money(sayTotal - grandTotal);
  const words = String(totals?.amountInWords || "").trim();
  const amountInWords =
    words && !/^0+$/.test(words) && words.toLowerCase() !== "rupees zero only"
      ? words
      : amountInIndianWords(sayTotal);
  return { inclusiveTotal, basicAmount, cgst, sgst, grandTotal, roundOff, sayTotal, amountInWords };
}

export function calcWageBill(lines: WageLineBreakup[], gstRate = BILL_DEFAULTS.gstRate): WageBillTotals {
  const inclusiveTotal = money(lines.reduce((sum, line) => sum + line.amount, 0));
  const basicAmount = money(inclusiveTotal / (1 + gstRate / 100));
  const cgst = money(basicAmount * (gstRate / 200));
  const sgst = money(basicAmount * (gstRate / 200));
  const grandTotal = money(basicAmount + cgst + sgst);
  const sayTotal = Math.round(grandTotal);
  const roundOff = money(sayTotal - grandTotal);
  return {
    inclusiveTotal,
    basicAmount,
    cgst,
    sgst,
    grandTotal,
    roundOff,
    sayTotal,
    amountInWords: amountInIndianWords(sayTotal),
  };
}

export function amountInIndianWords(value: number) {
  const n = Math.round(Math.abs(Number(value) || 0));
  if (n === 0) return "Rupees zero only";
  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function belowThousand(num: number) {
    const parts: string[] = [];
    if (num >= 100) {
      parts.push(`${ones[Math.floor(num / 100)]} hundred`);
      num %= 100;
    }
    if (num >= 20) {
      parts.push(tens[Math.floor(num / 10)]);
      if (num % 10) parts.push(ones[num % 10]);
    } else if (num > 0) {
      parts.push(ones[num]);
    }
    return parts.join(" ");
  }

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${belowThousand(crore)} crore`);
  if (lakh) parts.push(`${belowThousand(lakh)} lakh`);
  if (thousand) parts.push(`${belowThousand(thousand)} thousand`);
  if (rest) parts.push(belowThousand(rest));
  const body = parts.join(" ").replace(/\s+/g, " ").trim();
  return `Rupees ${body} only`;
}

export function gemSampleLines(): WageLineInput[] {
  return [
    { trade: "Plumber", skill: "Skilled", education: "High School", qty: 28, basic: 981, optional1: 10.66, optional2: 10, optional1Label: "Optional Allowance 1", optional2Label: "Optional Allowance 2" },
    { trade: "Pump Operator and helper of Plumber", skill: "Skilled", education: "High School", qty: 56, basic: 981, optional1: 10.66, optional2: 10, optional1Label: "Optional Allowance 1", optional2Label: "Optional Allowance 2" },
    { trade: "Electrician", skill: "Skilled", education: "High School", qty: 112, basic: 981, optional1: 10.66, optional2: 10, optional1Label: "Optional Allowance 1", optional2Label: "Optional Allowance 2" },
    { trade: "Fire Fighting Operator", skill: "Skilled", education: "Secondary School", qty: 84, basic: 981, optional1: 10.66, optional2: 10, optional1Label: "Optional Allowance 1", optional2Label: "Optional Allowance 2" },
    { trade: "STP Operator", skill: "Skilled", education: "High School", qty: 84, basic: 981, optional1: 10.66, optional2: 10, optional1Label: "Optional Allowance 1", optional2Label: "Optional Allowance 2" },
    { trade: "Carpenter", skill: "Skilled", education: "High School", qty: 24, basic: 981, optional1: 10.66, optional2: 10, optional1Label: "Optional Allowance 1", optional2Label: "Optional Allowance 2" },
    { trade: "Sewer Man", skill: "Semi-skilled", education: "High School", qty: 28, basic: 893, optional1: 9.78, optional2: 10, optional1Label: "Optional Allowance 1", optional2Label: "Optional Allowance 2" },
    {
      trade: "Helper of Electrician & DG Operator",
      skill: "Unskilled",
      education: "High School",
      qty: 56,
      basic: 805,
      optional1: 9.16,
      optional2: 10,
      optional1Label: "Optional Allowance 1 (Dress Allowance)",
      optional2Label: "Optional Allowance 2 (Dress Labour Cess)",
    },
    {
      trade: "Sweeper",
      skill: "Unskilled",
      education: "High School",
      qty: 140,
      basic: 805,
      optional1: 9.16,
      optional2: 10,
      optional1Label: "Optional Allowance 1 (Dress Allowance)",
      optional2Label: "Optional Allowance 2 (Dress Labour Cess)",
    },
  ];
}
