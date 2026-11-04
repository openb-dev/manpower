"use client";

import React from "react";
import { displayBillTotals, type WageLineBreakup, type WageBillTotals } from "@/lib/billing/wageBill";

const NK_HEAD = {
  legalName: "M/s N.K.Enterprise",
  tradeLine:
    "Govt. Contractor, Civil, Electric, Security Guard & House Keeping Services, Maintenance of Horticulture, Maintenance and Supply of Fire Fighting and Equipment's, Maintenance of Water Treatment Plant, travel Agency Activities & General Order Suppliers,",
  departments: "Woking Department of C.P.W.D., C.R.P.F., N.S.G., I.I.F.T., B.S.F., C.W.C., N.C.B. tc .",
  address:
    "Add: Nabanir Apartment, F-3/2 3rd Floor, Mohishgote, Dhali para, P.O.;-Krishnapur P.S.:- New Town, Kolkata-700102",
  gstin: "19AKEPD5739K1ZV",
  mobile: "9804057947",
  email: "nkenterprise063@gmail.com",
  pan: "AKEPD5739K",
  msme: "WB14D0009624",
  nsic: "NSIC/GP/KOL/2016/002993",
  bankName: "Canara Bank",
  accountNo: "97601400000155",
  ifsc: "CNRB0019760",
  accountType: "CC",
  branch: "Bidhannagar, Kolkata.",
};

function isNk(company: any) {
  const slug = String(company?.slug || "").toLowerCase();
  const name = `${company?.legalName || ""} ${company?.shortName || ""}`.toLowerCase();
  return slug === "nk" || /n\.?\s*k\.?\s*enterprise/.test(name);
}

function amt(value: number) {
  return (Number(value) || 0).toFixed(2);
}

function dmy(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function ordinal(n: number) {
  const v = n % 100;
  const s = ["th", "st", "nd", "rd"];
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function periodLabel(from?: string | Date | null, to?: string | Date | null) {
  if (!from || !to) return "";
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  const month = a.toLocaleString("en-GB", { month: "long" });
  return `(For the Month of ${ordinal(a.getDate())} ${month}'${a.getFullYear()} to ${ordinal(b.getDate())} ${month}'${b.getFullYear()}) (${dmy(a)}- ${dmy(b)})`;
}

function BillFooter({ pan, gstin, msme, nsic }: { pan: string; gstin: string; msme: string; nsic: string }) {
  return (
    <div className="bill-sheet-footer text-center text-[8.5px] leading-tight mt-3 uppercase">
      <div>N.B.: IF ADDITION/DELETION THE BILL MAY KINDLY BE CONVEYED TO THE FIRM FOR AUDIT PURPOSE PLEASE.</div>
      <div>
        PAN.NO. {pan}- GST NO.{gstin} ,REGD UNIT:- SSI/MSME, NO.{msme} NSIC REG. NO.
      </div>
      <div>{nsic}</div>
    </div>
  );
}

export function TaxInvoiceView({
  company,
  contract,
  billNo,
  invoiceDate,
  orderNo,
  orderDate,
  periodFrom,
  periodTo,
  buyerGstin,
  buyerAddress,
  lines,
  totals,
}: {
  company: any;
  contract?: any;
  billNo: string;
  invoiceDate?: string | Date | null;
  orderNo?: string | null;
  orderDate?: string | Date | null;
  periodFrom?: string | Date | null;
  periodTo?: string | Date | null;
  buyerGstin?: string | null;
  buyerAddress?: string | null;
  lines: WageLineBreakup[];
  totals: WageBillTotals;
}) {
  const shown = displayBillTotals(totals);
  const nk = isNk(company);
  const legalName = nk ? NK_HEAD.legalName : company?.legalName || company?.shortName || "Company";
  const gstin = nk ? NK_HEAD.gstin : company?.gstin || "—";
  const stateName = company?.stateName || "West Bengal";
  const stateCode = company?.stateCode || "19";
  const pan = nk ? NK_HEAD.pan : String(company?.pan || gstin).slice(2, 12) || "—";
  const msme = nk ? NK_HEAD.msme : company?.msme || "—";
  const nsic = nk ? NK_HEAD.nsic : company?.nsic || "—";
  const buyerLines = [
    contract?.departmentName,
    ...(String(buyerAddress || "")
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)),
  ].filter(Boolean);

  return (
    <div className="tax-invoice text-black bg-white">
      <div className="bill-print-footer">
        <BillFooter pan={pan} gstin={gstin} msme={msme} nsic={nsic} />
      </div>

      <section className="bill-sheet">
        <table className="bill-frame">
          <tbody>
            <tr>
              <td className="text-right text-[8px] leading-tight py-1 pr-1">
                (ORIGINAL FOR RECIPIENT)
                <br />
                (DUPLICATE FOR RECIPIENT)
                <br />
                (TRIPLICATE FOR RECIPIENT)
              </td>
            </tr>
            <tr>
              <td className="text-center py-1">
                <div className="font-serif text-[20px] font-bold underline tracking-wide">TAX INVOICE</div>
              </td>
            </tr>
            <tr>
              <td className="p-2">
                <div className="flex items-start gap-3">
                  {nk ? (
                    <img src="/nk-letterhead.jpg" alt="N.K. Enterprise" className="h-[52px] w-auto mt-0.5 shrink-0" />
                  ) : (
                    <div className="h-[52px] w-[88px] shrink-0 border border-black flex items-center justify-center text-[10px] font-bold">
                      {(company?.shortName || "CO").slice(0, 3).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 text-center">
                    <div className="font-serif italic font-bold text-[22px] leading-tight" style={{ color: "#cc0000" }}>
                      {legalName}
                    </div>
                    <div className="text-[9px] leading-snug mt-0.5">
                      {nk
                        ? NK_HEAD.tradeLine
                        : "Govt. Contractor — Manpower, Security, Housekeeping & Allied Services"}
                    </div>
                    {nk ? <div className="text-[9px] font-semibold mt-0.5">{NK_HEAD.departments}</div> : null}
                    <div className="text-[9px] mt-0.5">{nk ? NK_HEAD.address : ""}</div>
                    <div className="text-[10px] font-bold mt-0.5">
                      GSTIN : {gstin}
                      {nk ? `, Mobile : ${NK_HEAD.mobile}, E-mail : ${NK_HEAD.email}` : ""}
                    </div>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td className="p-0">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className="align-top w-[58%] p-1.5 border-r border-black">
                        <div className="italic font-semibold">Buyer (Bill to)</div>
                        <div>To,</div>
                        <div className="font-bold">{contract?.clientName || "Client"}</div>
                        {buyerLines.map((line) => (
                          <div key={String(line)}>{line}</div>
                        ))}
                        {buyerGstin ? <div className="mt-1">GSTIN: {buyerGstin}</div> : null}
                      </td>
                      <td className="align-top p-1.5">
                        <div>
                          <span className="font-semibold">Order No.</span> {orderNo || contract?.agreementNo || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">Date.</span> {dmy(orderDate) || "—"}
                        </div>
                        <div className="mt-2">
                          <span className="font-semibold">Invoice No.</span> {billNo || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">Date.</span> {dmy(invoiceDate) || "—"}
                        </div>
                        <div className="mt-2">
                          State Name: {stateName}, State Code: {stateCode}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td className="p-1.5">
                <div className="font-semibold">Subject:- Manpower Outsourcing Services - Minimum wage.</div>
                <div className="font-semibold">{periodLabel(periodFrom, periodTo)}</div>
              </td>
            </tr>
            <tr>
              <td className="p-0">
                <table className="w-full border-collapse text-[10.5px]">
                  <thead>
                    <tr>
                      <th className="bill-cell w-8">
                        Sl.
                        <br />
                        No
                      </th>
                      <th className="bill-cell text-left">Description of Items</th>
                      <th className="bill-cell w-14">
                        HSN/
                        <br />
                        SAC
                        <br />
                        Code
                      </th>
                      <th className="bill-cell w-14">Qty.</th>
                      <th className="bill-cell w-12">Unit</th>
                      <th className="bill-cell w-16">Rate</th>
                      <th className="bill-cell w-[72px]">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <React.Fragment key={`${line.trade}-${index}`}>
                        <tr>
                          <td className="bill-cell text-center font-bold align-top">{index + 1}</td>
                          <td className="bill-cell align-top">{line.description}</td>
                          <td className="bill-cell" />
                          <td className="bill-cell" />
                          <td className="bill-cell" />
                          <td className="bill-cell" />
                          <td className="bill-cell" />
                        </tr>
                        <tr>
                          <td className="bill-cell text-center align-top">i</td>
                          <td className="bill-cell align-top">{line.trade}</td>
                          <td className="bill-cell text-center">{line.sac}</td>
                          <td className="bill-cell text-right">{amt(line.qty)}</td>
                          <td className="bill-cell text-center">{line.unit}</td>
                          <td className="bill-cell text-right">{amt(line.grossRate)}</td>
                          <td className="bill-cell text-right">{amt(line.amount)}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                    <tr>
                      <td className="bill-cell" colSpan={5} />
                      <td className="bill-cell text-right font-bold">Total =</td>
                      <td className="bill-cell text-right font-bold">{amt(shown.inclusiveTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <BillFooter pan={pan} gstin={gstin} msme={msme} nsic={nsic} />
      </section>

      <section className="bill-sheet">
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            <GstRow first label="Basic Amount =" value={shown.basicAmount} />
            <GstRow label="CGST @ 9% =" value={shown.cgst} />
            <GstRow label="SGST @ 9% =" value={shown.sgst} />
            <GstRow label="Grand Total =" value={shown.grandTotal} bold />
            <GstRow label="R/off =" value={shown.roundOff} />
            <GstRow label="Say Total =" value={shown.sayTotal} bold />
            <tr>
              <td className="bill-cell italic font-semibold" colSpan={4}>
                Amount Chargeable (in word) : ({shown.amountInWords})
              </td>
            </tr>
          </tbody>
        </table>
        {lines.map((line, index) => (
          <WageBreakupTable key={`break-${index}`} index={index} line={line} />
        ))}
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            <tr>
              <td className="bill-cell p-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-bold">Company&apos;s Bank Details:</div>
                    <div className="pl-6 mt-1 space-y-0.5">
                      <div>Bank Name &nbsp;: {nk ? NK_HEAD.bankName : company?.bankName || "—"}</div>
                      <div>A/c No. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {nk ? NK_HEAD.accountNo : company?.accountNo || "—"}</div>
                      <div>IFSC Code &nbsp;: {nk ? NK_HEAD.ifsc : company?.ifsc || "—"}</div>
                      <div>A/c Type &nbsp;&nbsp;&nbsp;: {nk ? NK_HEAD.accountType : company?.accountType || "—"}</div>
                      <div>Branch Name: {nk ? NK_HEAD.branch : company?.branch || "—"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">For {legalName.replace(/^M\/s\s+/i, "M/s ")}</div>
                    <div className="h-14" />
                    <div>Authorised Signatory</div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <BillFooter pan={pan} gstin={gstin} msme={msme} nsic={nsic} />
      </section>
    </div>
  );
}

function GstRow({
  first,
  label,
  value,
  bold,
}: {
  first?: boolean;
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "font-bold" : ""}>
      <td className="bill-cell w-[38%]">{first ? "GST Components Break up-" : ""}</td>
      <td className="bill-cell text-right" colSpan={2}>
        {label}
      </td>
      <td className="bill-cell text-right w-24 font-mono">{amt(value)}</td>
    </tr>
  );
}

function WageBreakupTable({ index, line }: { index: number; line: WageLineBreakup }) {
  const esiNote =
    line.esi > 0 ? ` (${amt(line.basic).replace(/\.00$/, "")} x 3.25%= ${amt(line.esi)})` : "";
  return (
    <table className="wage-breakup w-full border-collapse text-[10.5px]">
      <thead>
        <tr>
          <th className="bill-cell text-center font-bold" colSpan={4}>
            ({index + 1}) &nbsp; Minimum Wage Components Break up- {line.trade}
          </th>
        </tr>
      </thead>
      <tbody>
        <WageRow n="i" label="Total Minimum Wage Per Day exclusive of GST" value={line.basic} />
        <WageRow
          n="ii"
          label={`ESI @ 3.25% (If the salary is more than Rs. 21000.00 then the ESIC payment will not be made)${esiNote}`}
          value={line.esi}
        />
        <WageRow
          n="iii"
          label="EPF @ 12% (Deducted EPFO on the basis of Maximum Ceiling Amount (i.e. 15000.00) (15000x12%= 1800/26= 69.23)"
          value={line.epf}
        />
        <WageRow
          n="iv"
          label="EDLI @ 0.50% (Deducted EDLI on the basis of Maximum Ceiling Amount (i.e. 15000.00) (15000x0.50%= 75/26= 2.88)"
          value={line.edli}
        />
        <WageRow
          n="v"
          label="PF Admin Charge @ 0.50% (Deducted PF Admin Charge on the basis of Maximum Ceiling Amount (i.e. 15000.00), (15000x0.50%= 75/26= 2.88)"
          value={line.pfAdmin}
        />
        <WageRow n="vi" label={line.optional1Label} value={line.optional1} />
        <WageRow n="vii" label={line.optional2Label} value={line.optional2} />
        <WageRow n="" label="Total Rs." value={line.exclusive} bold />
        <WageRow n="viii" label="GST @ 18%" value={line.gst} />
        <WageRow n="" label="Total Rs." value={line.afterGst} bold />
        <WageRow
          n="ix"
          label="Unit price Percentage of Service Charge inclusive of GST @ 3.85%"
          value={line.serviceCharge}
        />
        <WageRow n="" label="Gross Wage Per Day Including of GST" value={line.grossRate} bold />
      </tbody>
    </table>
  );
}

function WageRow({
  n,
  label,
  value,
  bold,
}: {
  n: string;
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "font-bold" : ""}>
      <td className="bill-cell w-8 text-center align-top">{n}</td>
      <td className="bill-cell align-top">{label}</td>
      <td className="bill-cell w-8 text-center">=</td>
      <td className="bill-cell w-24 text-right font-mono">{amt(value)}</td>
    </tr>
  );
}
