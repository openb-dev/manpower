export function invoiceDocument(invoice, company) {
  const money = (value) => (value === null || value === undefined || value === "" ? "" : Number(value));
  const info = [
    company?.legalName || "M/s. N.K. Enterprise",
    company?.gstin ? `GSTIN ${company.gstin}` : "",
    [company?.stateName, company?.stateCode ? `State code ${company.stateCode}` : ""].filter(Boolean).join("    "),
    company?.sac ? `SAC ${company.sac}` : "",
    `Invoice ${invoice.invoiceNo}`,
    `Buyer ${invoice.buyerName || ""}`,
    `Department ${invoice.departmentName || ""}`,
    `Order ${invoice.agreementNo || ""}`,
    `Period ${invoice.periodFrom || ""} to ${invoice.periodTo || ""}`,
  ].map((line) => String(line || "").trim()).filter(Boolean);

  const columns = ["Trade", "Skill", "Man-days", "Rate", "Amount"];
  const rows = (invoice.lines || []).map((line) => ({
    kind: "line",
    cells: [line.trade, line.skill, money(line.manDays), money(line.rate), money(line.amount)],
  }));
  const totals = [
    ["Man-days", invoice.manDays],
    ["Line total", invoice.lineTotal],
    ["Basic", invoice.basicAmount],
    ["CGST", invoice.cgst],
    ["SGST", invoice.sgst],
    ["Round off", invoice.roundOff],
    ["Say total", invoice.sayTotal],
    ["TDS on GST", invoice.tdsGst],
    ["TDS on income tax", invoice.tdsIncomeTax],
  ];
  for (const [label, amount] of totals) {
    rows.push({
      kind: label === "Say total" ? "total" : "line",
      cells: [label, "", "", "", amount === null || amount === undefined ? "" : Number(amount)],
    });
  }
  return { title: `Invoice ${invoice.invoiceNo}`, info, columns, rows, notes: [] };
}
