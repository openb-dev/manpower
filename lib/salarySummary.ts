/** Half-up to 2 decimals (client salary sheet style). */
export function round2(value: number) {
  return Math.round((Number(value) || 0) * 100 + Number.EPSILON) / 100;
}

export function roundRupee(value: number) {
  return Math.round(Number(value) || 0);
}

export type SalaryLineInput = {
  employeeId: string;
  fullName: string;
  designation: string;
  uan?: string | null;
  esicNo?: string | null;
  workingDays: number;
  dailyWage: number;
  professionalTax?: number;
  allowance1?: number;
  allowance2?: number;
  others?: number;
  bonus?: number;
};

export type SalaryLine = SalaryLineInput & {
  grossBasic: number;
  earningDaily: number;
  epfEmployee: number;
  esicEmployee: number;
  professionalTax: number;
  allowance1: number;
  allowance2: number;
  others: number;
  bonus: number;
  netAmount: number;
  epfEmployer: number;
  esiEmployer: number;
  employerTotal: number;
};

export function buildSalaryLine(input: SalaryLineInput): SalaryLine {
  const workingDays = Number(input.workingDays) || 0;
  const dailyWage = Number(input.dailyWage) || 0;
  const grossBasic = roundRupee(workingDays * dailyWage);
  const earningDaily = grossBasic;
  const epfEmployee = roundRupee(grossBasic * 0.12);
  const esicEmployee = roundRupee(grossBasic * 0.0075);
  const professionalTax = roundRupee(input.professionalTax ?? 0);
  const allowance1 = roundRupee(input.allowance1 ?? 0);
  const allowance2 = roundRupee(input.allowance2 ?? 0);
  const others = roundRupee(input.others ?? 0);
  const bonus = roundRupee(input.bonus ?? 0);
  const netAmount = roundRupee(
    grossBasic - epfEmployee - esicEmployee - professionalTax - others + allowance1 + allowance2 + bonus,
  );
  const epfEmployer = round2(grossBasic * 0.13);
  const esiEmployer = round2(grossBasic * 0.0325);
  const employerTotal = round2(epfEmployer + esiEmployer);

  return {
    ...input,
    workingDays,
    dailyWage,
    grossBasic,
    earningDaily,
    epfEmployee,
    esicEmployee,
    professionalTax,
    allowance1,
    allowance2,
    others,
    bonus,
    netAmount,
    epfEmployer,
    esiEmployer,
    employerTotal,
  };
}

export function buildSalarySummary(rows: SalaryLineInput[]) {
  const lines = rows
    .filter((row) => (Number(row.workingDays) || 0) > 0 || (Number(row.dailyWage) || 0) > 0)
    .map(buildSalaryLine);

  const totals = lines.reduce(
    (acc, row) => {
      acc.employees += 1;
      acc.workingDays += row.workingDays;
      acc.grossBasic += row.grossBasic;
      acc.earningDaily += row.earningDaily;
      acc.epfEmployee += row.epfEmployee;
      acc.esicEmployee += row.esicEmployee;
      acc.professionalTax += row.professionalTax;
      acc.allowance1 += row.allowance1;
      acc.allowance2 += row.allowance2;
      acc.others += row.others;
      acc.bonus += row.bonus;
      acc.netAmount += row.netAmount;
      acc.epfEmployer += row.epfEmployer;
      acc.esiEmployer += row.esiEmployer;
      acc.employerTotal += row.employerTotal;
      return acc;
    },
    {
      employees: 0,
      workingDays: 0,
      grossBasic: 0,
      earningDaily: 0,
      epfEmployee: 0,
      esicEmployee: 0,
      professionalTax: 0,
      allowance1: 0,
      allowance2: 0,
      others: 0,
      bonus: 0,
      netAmount: 0,
      epfEmployer: 0,
      esiEmployer: 0,
      employerTotal: 0,
    },
  );

  totals.epfEmployer = round2(totals.epfEmployer);
  totals.esiEmployer = round2(totals.esiEmployer);
  totals.employerTotal = round2(totals.employerTotal);

  return { lines, totals };
}

export function moneyText(value: number) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
