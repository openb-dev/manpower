"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClientInvoice, loadAccountsBook } from "../actions";
import { friendlyPublicError } from "@/lib/publicErrors";
import { TaxInvoiceView } from "@/components/admin/TaxInvoiceView";
import {
  BILL_DEFAULTS,
  calcWageBill,
  calcWageLine,
  displayBillTotals,
  gemSampleLines,
  type WageLineInput,
} from "@/lib/billing/wageBill";

function blankLine(): WageLineInput {
  return {
    trade: "",
    skill: "Skilled",
    education: "High School",
    qty: 26,
    basic: 981,
    optional1: 10.66,
    optional2: 10,
    optional1Label: "Optional Allowance 1",
    optional2Label: "Optional Allowance 2",
    sac: BILL_DEFAULTS.sac,
  };
}

function money(value: number) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AccountsPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;

  const [company, setCompany] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [contractId, setContractId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderNo, setOrderNo] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [periodFrom, setPeriodFrom] = useState("2026-02-01");
  const [periodTo, setPeriodTo] = useState("2026-02-28");
  const [buyerGstin, setBuyerGstin] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [serviceChargePct, setServiceChargePct] = useState(String(BILL_DEFAULTS.serviceChargePct));
  const [lines, setLines] = useState<WageLineInput[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  function loadAccountsData() {
    setLoading(true);
    loadAccountsBook(companySlug)
      .then((data) => {
        setCompany(data.company || null);
        setInvoices(data.invoices || []);
        setContracts(data.contracts || []);
        setListError("");
      })
      .catch((err) => {
        setInvoices([]);
        setContracts([]);
        setListError(friendlyPublicError(err.message || "The invoice book could not be loaded."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAccountsData();
  }, [companySlug]);

  function updateLine(index: number, field: keyof WageLineInput, val: string | number) {
    const next = [...lines];
    (next[index] as any)[field] = val;
    setLines(next);
  }

  const computedLines = useMemo(
    () =>
      lines
        .filter((line) => line.trade.trim())
        .map((line) => calcWageLine(line, { serviceChargePct: Number(serviceChargePct) || 3.85 })),
    [lines, serviceChargePct],
  );
  const totals = useMemo(() => calcWageBill(computedLines), [computedLines]);

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!contractId.trim()) {
      alert("Client / work is required.");
      return;
    }
    if (
      !billNo.trim() ||
      !invoiceDate ||
      !orderNo.trim() ||
      !orderDate ||
      !periodFrom ||
      !periodTo ||
      !buyerGstin.trim() ||
      !buyerAddress.trim() ||
      serviceChargePct === ""
    ) {
      alert("Fill every field. All fields are required.");
      return;
    }
    for (const [index, line] of lines.entries()) {
      if (
        !line.trade.trim() ||
        !line.skill ||
        !line.education ||
        !String(line.sac || "").trim() ||
        !String(line.optional1Label || "").trim() ||
        !String(line.optional2Label || "").trim() ||
        line.qty === "" as any ||
        line.basic === "" as any ||
        line.optional1 === "" as any ||
        line.optional2 === "" as any
      ) {
        alert(`Fill every field on trade line ${index + 1}.`);
        return;
      }
      if (Number(line.qty) <= 0 || Number(line.basic) <= 0) {
        alert(`Days and basic wage must be more than 0 on line ${index + 1}.`);
        return;
      }
    }
    setSaving(true);
    try {
      await createClientInvoice(companySlug, {
        contractId,
        billNo,
        invoiceDate,
        orderNo,
        orderDate,
        periodFrom,
        periodTo,
        buyerGstin,
        buyerAddress,
        serviceChargePct: Number(serviceChargePct),
        lines,
      });
      setShowModal(false);
      setBillNo("");
      setLines([blankLine()]);
      loadAccountsData();
    } catch (err: any) {
      alert(friendlyPublicError(err.message || "This bill could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.totalAmount || 0), 0);
  const totalGst = invoices.reduce((acc, inv) => acc + Number(inv.cgst || 0) + Number(inv.sgst || 0), 0);

  return (
    <div className="space-y-6">
      <div className={viewing ? "print:hidden space-y-6" : "space-y-6"}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
              Bills
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Bills to clients</h1>
          <p className="text-sm text-slate-500">
            Tax invoice with minimum-wage breakup, GST and service charge.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
        >
          + Make a bill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi title="Total Invoices" value={String(invoices.length)} note="Generated bills" />
        <Kpi title="Say total billed" value={`₹${money(totalBilled)}`} note="After round off" />
        <Kpi title="GST charged" value={`₹${money(totalGst)}`} note="9% CGST + 9% SGST" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            {listError || "No bills yet. Click Make a bill."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4">Bill No</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Period</th>
                  <th className="p-4 text-right">Basic</th>
                  <th className="p-4 text-right">GST</th>
                  <th className="p-4 text-right">Say Total</th>
                  <th className="p-4 text-center">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono font-bold text-emerald-700 text-xs">{inv.billNo}</td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{inv.contract?.clientName || "Direct bill"}</div>
                      <div className="text-xs text-slate-400">{inv.contract?.agreementNo || inv.orderNo || "—"}</div>
                    </td>
                    <td className="p-4 text-xs font-mono">
                      {inv.periodFrom ? new Date(inv.periodFrom).toLocaleDateString("en-IN") : "—"} to{" "}
                      {inv.periodTo ? new Date(inv.periodTo).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="p-4 text-right font-mono text-xs">₹{money(Number(inv.grossAmount))}</td>
                    <td className="p-4 text-right font-mono text-xs">
                      ₹{money(Number(inv.cgst) + Number(inv.sgst))}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-800">
                      ₹{money(Number(inv.sayTotal) || Number(inv.totalAmount) || Number(inv.grossAmount) + Number(inv.cgst) + Number(inv.sgst))}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setViewing(inv)}
                        className="text-xs font-bold text-emerald-700 hover:underline"
                      >
                        Open bill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-6xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">Make tax invoice</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Client / work">
                  <select
                    required
                    value={contractId}
                    onChange={(e) => setContractId(e.target.value)}
                    className="input"
                  >
                    <option value="">Select contract</option>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.clientName} ({c.agreementNo || "No Agr#"})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Invoice No.">
                  <input required className="input font-mono" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="CB/NK/25-26/211" />
                </Field>
                <Field label="Invoice date">
                  <input required type="date" className="input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </Field>
                <Field label="Service charge %">
                  <input required type="number" step="0.01" className="input" value={serviceChargePct} onChange={(e) => setServiceChargePct(e.target.value)} />
                </Field>
                <Field label="Order No.">
                  <input required className="input font-mono" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="GEMC-..." />
                </Field>
                <Field label="Order date">
                  <input required type="date" className="input" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                </Field>
                <Field label="Period from">
                  <input required type="date" className="input" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
                </Field>
                <Field label="Period to">
                  <input required type="date" className="input" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
                </Field>
                <Field label="Buyer GSTIN">
                  <input required className="input font-mono" value={buyerGstin} onChange={(e) => setBuyerGstin(e.target.value)} />
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Buyer address">
                    <textarea required className="input min-h-16" value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} />
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Wage lines <span className="text-red-600">*</span> (every box on each line)
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLines(gemSampleLines())}
                    className="text-xs font-bold text-slate-600 hover:underline"
                  >
                    Load sample GeM lines
                  </button>
                  <button type="button" onClick={() => setLines([...lines, blankLine()])} className="text-xs font-bold text-emerald-700 hover:underline">
                    + Add trade
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => {
                  const calc = calcWageLine(line, { serviceChargePct: Number(serviceChargePct) || 3.85 });
                  return (
                    <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                        <Field label="Trade / post">
                          <input required className="input" value={line.trade} onChange={(e) => updateLine(idx, "trade", e.target.value)} placeholder="Plumber" />
                        </Field>
                        <Field label="Skill">
                          <select required className="input" value={line.skill} onChange={(e) => updateLine(idx, "skill", e.target.value)}>
                            <option value="">Select skill</option>
                            <option>Skilled</option>
                            <option>Semi-skilled</option>
                            <option>Unskilled</option>
                          </select>
                        </Field>
                        <Field label="School">
                          <select required className="input" value={line.education} onChange={(e) => updateLine(idx, "education", e.target.value)}>
                            <option value="">Select school</option>
                            <option>High School</option>
                            <option>Secondary School</option>
                            <option>Others</option>
                          </select>
                        </Field>
                        <Field label="Days">
                          <input required type="number" step="0.01" className="input text-right" value={line.qty} onChange={(e) => updateLine(idx, "qty", Number(e.target.value))} />
                        </Field>
                        <Field label="Basic wage / day">
                          <input required type="number" step="0.01" className="input text-right" value={line.basic} onChange={(e) => updateLine(idx, "basic", Number(e.target.value))} />
                        </Field>
                        <Field label="SAC">
                          <input required className="input font-mono" value={line.sac || ""} onChange={(e) => updateLine(idx, "sac", e.target.value)} />
                        </Field>
                        <Field label="Optional 1 name">
                          <input required className="input" value={line.optional1Label || ""} onChange={(e) => updateLine(idx, "optional1Label", e.target.value)} />
                        </Field>
                        <Field label="Optional 1 amount">
                          <input required type="number" step="0.01" className="input text-right" value={line.optional1 ?? ""} onChange={(e) => updateLine(idx, "optional1", e.target.value === "" ? ("" as any) : Number(e.target.value))} />
                        </Field>
                        <Field label="Optional 2 name">
                          <input required className="input" value={line.optional2Label || ""} onChange={(e) => updateLine(idx, "optional2Label", e.target.value)} />
                        </Field>
                        <Field label="Optional 2 amount">
                          <input required type="number" step="0.01" className="input text-right" value={line.optional2 ?? ""} onChange={(e) => updateLine(idx, "optional2", e.target.value === "" ? ("" as any) : Number(e.target.value))} />
                        </Field>
                        <div className="md:col-span-3 text-[11px] text-slate-600 pt-5">
                          ESI {money(calc.esi)} + EPF {money(calc.epf)} + EDLI {money(calc.edli)} + PF Admin {money(calc.pfAdmin)} = exclusive {money(calc.exclusive)}. GST {money(calc.gst)}. Service {money(calc.serviceCharge)}. Rate {money(calc.grossRate)}. Amount {money(calc.amount)}.
                        </div>
                        <div className="flex items-end justify-end">
                          {lines.length > 1 ? (
                            <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-red-600 text-xs font-bold">
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-100 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between"><span>Basic amount</span><span className="font-mono">₹{money(totals.basicAmount)}</span></div>
                <div className="flex justify-between"><span>CGST 9%</span><span className="font-mono">₹{money(totals.cgst)}</span></div>
                <div className="flex justify-between"><span>SGST 9%</span><span className="font-mono">₹{money(totals.sgst)}</span></div>
                <div className="flex justify-between"><span>R/off</span><span className="font-mono">₹{money(totals.roundOff)}</span></div>
                <div className="flex justify-between font-bold text-emerald-800 border-t border-slate-300 pt-1">
                  <span>Say total</span>
                  <span className="font-mono">₹{money(totals.sayTotal)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-xs font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold">
                  {saving ? "Saving..." : "Save bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {viewing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto print:static print:bg-white print:p-0 print:overflow-visible print:block">
          <div className="bg-white rounded-xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl my-4 print:max-w-none print:shadow-none print:rounded-none print:p-0 print:my-0 print:overflow-visible">
            <div className="flex justify-between items-center mb-3 no-print">
              <h2 className="font-bold">Tax invoice</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => window.print()} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg">
                  Print
                </button>
                <button type="button" onClick={() => setViewing(null)} className="px-3 py-1.5 border text-xs rounded-lg">
                  Close
                </button>
              </div>
            </div>
            <TaxInvoiceView
              company={company}
              contract={viewing.contract}
              billNo={viewing.billNo}
              invoiceDate={viewing.invoiceDate}
              orderNo={viewing.orderNo}
              orderDate={viewing.meta?.orderDate}
              periodFrom={viewing.periodFrom}
              periodTo={viewing.periodTo}
              buyerGstin={viewing.meta?.buyerGstin}
              buyerAddress={viewing.meta?.buyerAddress}
              lines={(viewing.lines || []).map((line: any) => line.breakup || calcWageLine({
                trade: line.trade,
                skill: line.skill,
                qty: Number(line.manDays),
                basic: Number(line.ratePerDay),
              }))}
              totals={displayBillTotals({
                inclusiveTotal: Number(viewing.meta?.inclusiveTotal) || Number(viewing.totalAmount) || 0,
                basicAmount: Number(viewing.grossAmount) || 0,
                cgst: Number(viewing.cgst) || 0,
                sgst: Number(viewing.sgst) || 0,
                grandTotal:
                  Number(viewing.meta?.grandTotal) ||
                  (Number(viewing.grossAmount) || 0) + (Number(viewing.cgst) || 0) + (Number(viewing.sgst) || 0),
                roundOff: Number(viewing.roundOff) || 0,
                sayTotal: Number(viewing.sayTotal) || Number(viewing.totalAmount) || 0,
                amountInWords: viewing.meta?.amountInWords || "",
              })}
            />
          </div>
        </div>
      )}

      <style>{`
        .input {
          width: 100%;
          padding: 0.4rem 0.6rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          background: white;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-600 block mb-1">
        {label} <span className="text-red-600">*</span>
      </span>
      {children}
    </label>
  );
}

function Kpi({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</div>
      <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
      <div className="text-[11px] text-slate-500 mt-1">{note}</div>
    </div>
  );
}
