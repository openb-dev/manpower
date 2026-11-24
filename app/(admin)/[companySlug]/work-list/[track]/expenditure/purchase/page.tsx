"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { Download, Plus, ShoppingBag, X } from "lucide-react";
import { loadProcurementBook } from "../../../../actions";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";
import { formatDateDmy, maskDmyInput, parseDateValue } from "@/lib/applicantFormFields";
import { downloadPurchaseGstrExcel } from "@/lib/downloadPurchaseGstrExcel";
import { buildTaxPayableSummary, moneyText } from "@/lib/purchaseGstr";
import { isWorkListTrack, workListTrackLabel, type WorkListTrack } from "@/lib/workList";

const FIELD =
  "w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white";

const emptyForm = {
  id: "",
  vendorName: "",
  supplierGstin: "",
  invoiceNo: "",
  purchaseDate: "",
  amount: "",
  taxableAmount: "",
  igst: "",
  cgst: "",
  sgst: "",
  remarks: "",
  contractId: "",
};

export default function PurchaseRegisterPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;
  const trackParam = params?.track as string;
  if (!isWorkListTrack(trackParam)) notFound();
  const track = trackParam as WorkListTrack;

  const [company, setCompany] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [monthKey, setMonthKey] = useState(() => new Date().toISOString().slice(0, 7));

  function loadData() {
    setLoading(true);
    loadProcurementBook(companySlug)
      .then((data) => {
        setPurchases(data.purchases || []);
        setContracts(data.contracts || []);
        setCompany(data.company || null);
        setError("");
      })
      .catch((err) => {
        setPurchases([]);
        setError(friendlyPublicError(err.message || "Purchase register could not be loaded."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [companySlug]);

  // loadProcurementBook doesn't return company — fix by reading from contracts path or enhance action
  // For now use companySlug label from purchases; we'll patch actions to return company.

  const filtered = useMemo(() => {
    return purchases.filter((row) => {
      if (!row.purchaseDate) return true;
      const d = new Date(row.purchaseDate);
      if (Number.isNaN(d.getTime())) return true;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === monthKey;
    });
  }, [purchases, monthKey]);

  const summary = useMemo(() => buildTaxPayableSummary(filtered), [filtered]);
  const monthLabel = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  }, [monthKey]);

  function openNew() {
    setForm({
      ...emptyForm,
      purchaseDate: formatDateDmy(new Date().toISOString(), ""),
    });
    setShowModal(true);
  }

  function openEdit(row: any) {
    setForm({
      id: row.id,
      vendorName: row.vendorName || "",
      supplierGstin: row.supplierGstin || "",
      invoiceNo: row.invoiceNo || "",
      purchaseDate: formatDateDmy(row.purchaseDate, ""),
      amount: row.amount == null ? "" : String(row.amount),
      taxableAmount: row.taxableAmount == null ? "" : String(row.taxableAmount),
      igst: row.igst == null ? "" : String(row.igst),
      cgst: row.cgst == null ? "" : String(row.cgst),
      sgst: row.sgst == null ? "" : String(row.sgst),
      remarks: row.remarks || row.itemName || "",
      contractId: row.contractId || "",
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorName.trim()) {
      alert("Please enter Trade / Legal Name of supplier.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: form.id ? "UPDATE_PURCHASE" : "CREATE_PURCHASE",
          id: form.id || undefined,
          vendorName: form.vendorName,
          supplierGstin: form.supplierGstin,
          invoiceNo: form.invoiceNo,
          purchaseDate: parseDateValue(form.purchaseDate)?.toISOString().slice(0, 10),
          amount: form.amount,
          taxableAmount: form.taxableAmount,
          igst: form.igst,
          cgst: form.cgst,
          sgst: form.sgst,
          remarks: form.remarks,
          itemName: form.remarks || form.vendorName,
          contractId: form.contractId || null,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data?.error || "Could not save purchase.");
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(friendlyPublicError(err.message || "Could not save purchase."));
    } finally {
      setSaving(false);
    }
  }

  const companyName = company?.legalName || company?.shortName || "M/s. N.K. Enterprise";

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
          <Link href={`/${companySlug}/work-list`} className="font-semibold text-blue-700 hover:underline">
            Work List
          </Link>
          <span>/</span>
          <Link href={`/${companySlug}/work-list/${track}`} className="font-semibold text-blue-700 hover:underline">
            {workListTrackLabel(track)}
          </Link>
          <span>/</span>
          <Link
            href={`/${companySlug}/work-list/${track}/expenditure`}
            className="font-semibold text-blue-700 hover:underline"
          >
            Work Expenditure
          </Link>
          <span>/</span>
          <span className="font-bold text-slate-700">Items Purchase</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
          <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Purchase Register (GSTR-2B)
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Items Purchase</h1>
        <p className="text-sm text-slate-500">
          Taxable inward supplies from registered persons — same layout as the office GSTR-2B sheet.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          Month
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void downloadPurchaseGstrExcel({
                companyName,
                monthLabel,
                rows: filtered,
              })
            }
            disabled={!filtered.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download Excel
          </button>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add invoice
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">Loading...</div>
      ) : error ? (
        <div className="p-6 text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>
      ) : (
        <>
          <div className="overflow-x-auto border border-slate-400 bg-white rounded-lg shadow-sm">
            <table className="min-w-[1600px] w-max text-[10px] text-slate-800 border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[48px]">
                    Sl No
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[140px]">
                    GSTIN of Supplier
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[200px]">
                    Trade / Legal Name
                  </th>
                  <th colSpan={4} className="border border-slate-400 p-1.5 text-center">
                    Invoice Details
                  </th>
                  <th colSpan={3} className="border border-slate-400 p-1.5 text-center">
                    GST Details
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[160px]">
                    Remarks
                  </th>
                  <th rowSpan={2} className="border border-slate-400 p-1.5 text-center align-middle min-w-[64px]">
                    Action
                  </th>
                </tr>
                <tr className="bg-slate-50">
                  <th className="border border-slate-400 p-1.5 text-center min-w-[120px]">Invoice Number</th>
                  <th className="border border-slate-400 p-1.5 text-center min-w-[100px]">Invoice Date</th>
                  <th className="border border-slate-400 p-1.5 text-center min-w-[110px]">Invoice Value</th>
                  <th className="border border-slate-400 p-1.5 text-center min-w-[110px]">Taxable Amount</th>
                  <th className="border border-slate-400 p-1.5 text-center min-w-[100px]">Integrated Tax</th>
                  <th className="border border-slate-400 p-1.5 text-center min-w-[100px]">Central Tax</th>
                  <th className="border border-slate-400 p-1.5 text-center min-w-[100px]">State/UT Tax</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="border border-slate-400 p-8 text-center text-slate-400">
                      No purchases in this month. Add an invoice.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => (
                    <tr key={row.id} className="hover:bg-amber-50/50">
                      <td className="border border-slate-400 p-1.5 text-center">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5 font-mono whitespace-nowrap">{row.supplierGstin || "—"}</td>
                      <td className="border border-slate-400 p-1.5 font-semibold min-w-[200px]">{row.vendorName}</td>
                      <td className="border border-slate-400 p-1.5 whitespace-nowrap">{row.invoiceNo || "—"}</td>
                      <td className="border border-slate-400 p-1.5 text-center whitespace-nowrap">{formatDateDmy(row.purchaseDate)}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(Number(row.amount || 0))}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">
                        {moneyText(Number(row.taxableAmount ?? row.amount ?? 0))}
                      </td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(Number(row.igst || 0))}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(Number(row.cgst || 0))}</td>
                      <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(Number(row.sgst || 0))}</td>
                      <td className="border border-slate-400 p-1.5">{row.remarks || row.itemName || "—"}</td>
                      <td className="border border-slate-400 p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-[10px] font-bold text-blue-700 hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm space-y-1">
              <div className="font-bold text-slate-900 mb-2">TOTAL ITC TAKEN</div>
              <div className="flex justify-between"><span>IGST</span><span className="font-mono">{moneyText(summary.igst)}</span></div>
              <div className="flex justify-between"><span>CGST</span><span className="font-mono">{moneyText(summary.cgst)}</span></div>
              <div className="flex justify-between"><span>SGST</span><span className="font-mono">{moneyText(summary.sgst)}</span></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm space-y-1">
              <div className="font-bold text-slate-900 mb-2">TAX PAYABLE SUMMARY</div>
              <div className="flex justify-between"><span>OUTPUT TAX</span><span className="font-mono">{moneyText(summary.outputTax)}</span></div>
              <div className="flex justify-between"><span>LESS INPUT</span><span className="font-mono">{moneyText(summary.inputTax)}</span></div>
              <div className="flex justify-between"><span>LESS TDS</span><span className="font-mono">{moneyText(summary.tds)}</span></div>
              <div className="flex justify-between"><span>ADD LATE FEES</span><span className="font-mono">{moneyText(summary.lateFees)}</span></div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1 mt-1">
                <span>TOTAL PAYABLE</span>
                <span className="font-mono">{moneyText(summary.totalPayable)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{form.id ? "Edit invoice" : "Add invoice"}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3">
              <Field label="GSTIN of Supplier">
                <input value={form.supplierGstin} onChange={(e) => setForm((f) => ({ ...f, supplierGstin: e.target.value.toUpperCase() }))} className={FIELD} maxLength={15} />
              </Field>
              <Field label="Trade / Legal Name *">
                <input required value={form.vendorName} onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))} className={FIELD} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Invoice Number">
                  <input value={form.invoiceNo} onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))} className={FIELD} />
                </Field>
                <Field label="Invoice Date (dd/mm/yyyy)">
                  <input value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: maskDmyInput(e.target.value) }))} className={FIELD} placeholder="dd/mm/yyyy" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Invoice Value *">
                  <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={FIELD} />
                </Field>
                <Field label="Taxable Amount">
                  <input type="number" step="0.01" value={form.taxableAmount} onChange={(e) => setForm((f) => ({ ...f, taxableAmount: e.target.value }))} className={FIELD} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="IGST">
                  <input type="number" step="0.01" value={form.igst} onChange={(e) => setForm((f) => ({ ...f, igst: e.target.value }))} className={FIELD} />
                </Field>
                <Field label="CGST">
                  <input type="number" step="0.01" value={form.cgst} onChange={(e) => setForm((f) => ({ ...f, cgst: e.target.value }))} className={FIELD} />
                </Field>
                <Field label="SGST">
                  <input type="number" step="0.01" value={form.sgst} onChange={(e) => setForm((f) => ({ ...f, sgst: e.target.value }))} className={FIELD} />
                </Field>
              </div>
              <Field label="Remarks">
                <input value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} className={FIELD} />
              </Field>
              <Field label="Link to project (optional)">
                <select value={form.contractId} onChange={(e) => setForm((f) => ({ ...f, contractId: e.target.value }))} className={FIELD}>
                  <option value="">General</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.workName || c.clientName}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-700 block mb-1">{label}</label>
      {children}
    </div>
  );
}
