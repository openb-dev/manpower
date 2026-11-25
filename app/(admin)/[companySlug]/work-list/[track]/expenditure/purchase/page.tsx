"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { Download, Plus, ShoppingBag, X } from "lucide-react";
import { loadProcurementBook } from "../../../../actions";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";
import { formatDateDmy, maskDmyInput, parseDateValue } from "@/lib/applicantFormFields";
import { moneyText } from "@/lib/purchaseGstr";
import { isWorkListTrack, workListTrackLabel, type WorkListTrack } from "@/lib/workList";
import { downloadItemPurchaseExcel } from "@/lib/downloadItemPurchaseExcel";

const FIELD =
  "w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white";

const emptyForm = {
  id: "",
  itemName: "",
  quantity: "",
  unit: "",
  rate: "",
  amount: "",
  vendorName: "",
  purchaseLocation: "",
  invoiceNo: "",
  purchaseDate: "",
  supplierGstin: "",
  paymentThrough: "CASH",
  paymentMadeBy: "",
  deliveryPlace: "",
  deliveryDate: "",
  remarks: "",
  contractId: "",
};

export default function ItemPurchasePage() {
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
        setError(friendlyPublicError(err.message || "Item purchase could not be loaded."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [companySlug]);

  const totalAmount = useMemo(
    () => purchases.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [purchases],
  );

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
      itemName: row.itemName || "",
      quantity: row.quantity == null ? "" : String(row.quantity),
      unit: row.unit || "",
      rate: row.rate == null ? "" : String(row.rate),
      amount: row.amount == null ? "" : String(row.amount),
      vendorName: row.vendorName || "",
      purchaseLocation: row.purchaseLocation || "",
      invoiceNo: row.invoiceNo || "",
      purchaseDate: formatDateDmy(row.purchaseDate, ""),
      supplierGstin: row.supplierGstin || "",
      paymentThrough: row.paymentThrough || "CASH",
      paymentMadeBy: row.paymentMadeBy || "",
      deliveryPlace: row.deliveryPlace || "",
      deliveryDate: formatDateDmy(row.deliveryDate, ""),
      remarks: row.remarks || "",
      contractId: row.contractId || "",
    });
    setShowModal(true);
  }

  function patchForm(patch: Partial<typeof emptyForm>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      const qty = Number(next.quantity);
      const rate = Number(next.rate);
      if (
        (patch.quantity != null || patch.rate != null) &&
        Number.isFinite(qty) &&
        Number.isFinite(rate) &&
        next.quantity !== "" &&
        next.rate !== ""
      ) {
        next.amount = String(Math.round(qty * rate * 100) / 100);
      }
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.itemName.trim()) {
      alert("Please enter Item / Description.");
      return;
    }
    if (!form.vendorName.trim()) {
      alert("Please enter Shop Name (Purchase From).");
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
          itemName: form.itemName,
          quantity: form.quantity,
          unit: form.unit,
          rate: form.rate,
          amount: form.amount,
          vendorName: form.vendorName,
          purchaseLocation: form.purchaseLocation,
          invoiceNo: form.invoiceNo,
          purchaseDate: parseDateValue(form.purchaseDate)?.toISOString().slice(0, 10),
          supplierGstin: form.supplierGstin,
          paymentThrough: form.paymentThrough,
          paymentMadeBy: form.paymentMadeBy,
          deliveryPlace: form.deliveryPlace,
          deliveryDate: parseDateValue(form.deliveryDate)?.toISOString().slice(0, 10),
          remarks: form.remarks,
          contractId: form.contractId || null,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data?.error || "Could not save.");
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(friendlyPublicError(err.message || "Could not save."));
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
          Items Purchase
        </span>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">{companyName}</h1>
        <p className="text-sm text-slate-500">
          Client purchase sheet — item, qty, shop, bill, payment and delivery.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={() => void downloadItemPurchaseExcel({ companyName, rows: purchases })}
          disabled={!purchases.length}
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
          Add item
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">Loading...</div>
      ) : error ? (
        <div className="p-6 text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>
      ) : (
        <div className="overflow-x-auto border border-slate-400 bg-white rounded-lg shadow-sm">
          <table className="min-w-[2200px] w-max text-[10px] text-slate-800 border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1.5 text-center min-w-[48px]">SL No.</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[180px]">Item / Description</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[72px]">Quantity</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[64px]">Unit</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[80px]">Rate</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[96px]">Amount</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[160px]">Shop Name (Purchase From)</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[140px]">Purchase Location</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[100px]">Bill No</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[100px]">Bill Date</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[120px]">GST No. (If Any)</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[120px]">Payment Through (Online/Cash/UPI)</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[140px]">Payment made By (Name of Person)</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[120px]">Delivery Place</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[100px]">Delivery Date</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[140px]">Remarks</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[64px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={17} className="border border-slate-400 p-8 text-center text-slate-400">
                    No purchase rows yet. Add an item.
                  </td>
                </tr>
              ) : (
                purchases.map((row, i) => (
                  <tr key={row.id} className="hover:bg-amber-50/40">
                    <td className="border border-slate-400 p-1.5 text-center">{i + 1}</td>
                    <td className="border border-slate-400 p-1.5 font-semibold">{row.itemName}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">{row.quantity ?? "—"}</td>
                    <td className="border border-slate-400 p-1.5 text-center">{row.unit || "—"}</td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono">
                      {row.rate == null ? "—" : moneyText(Number(row.rate))}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-right font-mono font-bold">
                      {moneyText(Number(row.amount || 0))}
                    </td>
                    <td className="border border-slate-400 p-1.5">{row.vendorName || "—"}</td>
                    <td className="border border-slate-400 p-1.5">{row.purchaseLocation || "—"}</td>
                    <td className="border border-slate-400 p-1.5 whitespace-nowrap">{row.invoiceNo || "—"}</td>
                    <td className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                      {formatDateDmy(row.purchaseDate)}
                    </td>
                    <td className="border border-slate-400 p-1.5 font-mono whitespace-nowrap">
                      {row.supplierGstin || "—"}
                    </td>
                    <td className="border border-slate-400 p-1.5 text-center">{row.paymentThrough || "—"}</td>
                    <td className="border border-slate-400 p-1.5">{row.paymentMadeBy || "—"}</td>
                    <td className="border border-slate-400 p-1.5">{row.deliveryPlace || "—"}</td>
                    <td className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                      {formatDateDmy(row.deliveryDate, "—")}
                    </td>
                    <td className="border border-slate-400 p-1.5">{row.remarks || "—"}</td>
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
              <tr className="bg-amber-50 font-bold">
                <td className="border border-slate-400 p-1.5 text-right" colSpan={5}>
                  Total=
                </td>
                <td className="border border-slate-400 p-1.5 text-right font-mono">{moneyText(totalAmount)}</td>
                <td className="border border-slate-400 p-1.5" colSpan={11} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{form.id ? "Edit item" : "Add item"}</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Item / Description *">
                  <input
                    required
                    value={form.itemName}
                    onChange={(e) => patchForm({ itemName: e.target.value })}
                    className={FIELD}
                  />
                </Field>
              </div>
              <Field label="Quantity">
                <input
                  type="number"
                  step="0.001"
                  value={form.quantity}
                  onChange={(e) => patchForm({ quantity: e.target.value })}
                  className={FIELD}
                />
              </Field>
              <Field label="Unit">
                <input value={form.unit} onChange={(e) => patchForm({ unit: e.target.value })} className={FIELD} />
              </Field>
              <Field label="Rate">
                <input
                  type="number"
                  step="0.01"
                  value={form.rate}
                  onChange={(e) => patchForm({ rate: e.target.value })}
                  className={FIELD}
                />
              </Field>
              <Field label="Amount">
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => patchForm({ amount: e.target.value })}
                  className={FIELD}
                />
              </Field>
              <Field label="Shop Name (Purchase From) *">
                <input
                  required
                  value={form.vendorName}
                  onChange={(e) => patchForm({ vendorName: e.target.value })}
                  className={FIELD}
                />
              </Field>
              <Field label="Purchase Location">
                <input
                  value={form.purchaseLocation}
                  onChange={(e) => patchForm({ purchaseLocation: e.target.value })}
                  className={FIELD}
                />
              </Field>
              <Field label="Bill No">
                <input
                  value={form.invoiceNo}
                  onChange={(e) => patchForm({ invoiceNo: e.target.value })}
                  className={FIELD}
                />
              </Field>
              <Field label="Bill Date (dd/mm/yyyy)">
                <input
                  value={form.purchaseDate}
                  onChange={(e) => patchForm({ purchaseDate: maskDmyInput(e.target.value) })}
                  className={FIELD}
                  placeholder="dd/mm/yyyy"
                />
              </Field>
              <Field label="GST No. (If Any)">
                <input
                  value={form.supplierGstin}
                  onChange={(e) => patchForm({ supplierGstin: e.target.value.toUpperCase() })}
                  className={FIELD}
                />
              </Field>
              <Field label="Payment Through">
                <select
                  value={form.paymentThrough}
                  onChange={(e) => patchForm({ paymentThrough: e.target.value })}
                  className={FIELD}
                >
                  <option value="ONLINE">Online</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </Field>
              <Field label="Payment made By (Name of Person)">
                <input
                  value={form.paymentMadeBy}
                  onChange={(e) => patchForm({ paymentMadeBy: e.target.value })}
                  className={FIELD}
                />
              </Field>
              <Field label="Delivery Place">
                <input
                  value={form.deliveryPlace}
                  onChange={(e) => patchForm({ deliveryPlace: e.target.value })}
                  className={FIELD}
                />
              </Field>
              <Field label="Delivery Date (dd/mm/yyyy)">
                <input
                  value={form.deliveryDate}
                  onChange={(e) => patchForm({ deliveryDate: maskDmyInput(e.target.value) })}
                  className={FIELD}
                  placeholder="dd/mm/yyyy"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Remarks">
                  <input value={form.remarks} onChange={(e) => patchForm({ remarks: e.target.value })} className={FIELD} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Link to project (optional)">
                  <select
                    value={form.contractId}
                    onChange={(e) => patchForm({ contractId: e.target.value })}
                    className={FIELD}
                  >
                    <option value="">General</option>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.workName || c.clientName}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                >
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
