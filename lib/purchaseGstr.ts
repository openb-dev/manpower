export type PurchaseGstrRow = {
  id?: string;
  supplierGstin?: string | null;
  vendorName: string;
  invoiceNo?: string | null;
  purchaseDate?: string | Date | null;
  amount: number; // invoice value
  taxableAmount?: number | null;
  igst?: number | null;
  cgst?: number | null;
  sgst?: number | null;
  remarks?: string | null;
  itemName?: string | null;
};

export function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function buildPurchaseGstrTotals(rows: PurchaseGstrRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.invoiceValue += num(row.amount);
      acc.taxable += num(row.taxableAmount ?? row.amount);
      acc.igst += num(row.igst);
      acc.cgst += num(row.cgst);
      acc.sgst += num(row.sgst);
      return acc;
    },
    { invoiceValue: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 },
  );
}

/** Tax payable summary block from client GSTR-2B sheet. */
export function buildTaxPayableSummary(rows: PurchaseGstrRow[], opts?: { outputTax?: number; tds?: number; lateFees?: number }) {
  const totals = buildPurchaseGstrTotals(rows);
  const inputTax = totals.igst + totals.cgst + totals.sgst;
  const outputTax = num(opts?.outputTax);
  const tds = num(opts?.tds);
  const lateFees = num(opts?.lateFees);
  const totalPayable = outputTax - inputTax - tds + lateFees;
  return {
    ...totals,
    inputTax,
    outputTax,
    tds,
    lateFees,
    totalPayable,
  };
}

export function moneyText(value: number) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
