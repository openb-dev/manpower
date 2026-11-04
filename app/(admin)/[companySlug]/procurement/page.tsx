"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadProcurementBook } from "../actions";

export default function ProcurementPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;

  const [purchases, setPurchases] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [itemName, setItemName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [contractId, setContractId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState("");

  function loadProcurementData() {
    setLoading(true);
    loadProcurementBook(companySlug)
      .then((data) => {
        setPurchases(data.purchases || []);
        setContracts(data.contracts || []);
        setListError("");
      })
      .catch((err) => {
        setPurchases([]);
        setContracts([]);
        setListError(err.message || "The purchase book could not be loaded.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProcurementData();
  }, [companySlug]);

  async function handleCreatePurchase(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_PURCHASE",
          itemName,
          vendorName,
          amount,
          invoiceNo,
          contractId: contractId && contractId !== "GENERAL" ? contractId : null,
          purchaseDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record purchase");

      setShowModal(false);
      setItemName("");
      setVendorName("");
      setAmount("");
      setInvoiceNo("");
      loadProcurementData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const totalSpent = purchases.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const uniqueVendors = new Set(purchases.map((p) => p.vendorName)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
              Purchases
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Things we bought</h1>
          <p className="text-sm text-slate-500">
            Uniforms, shoes, badges and other items bought from a shop or vendor.
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Add a purchase</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Purchases</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{purchases.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Recorded material invoices</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Spend</div>
          <div className="text-2xl font-black text-amber-700 mt-1">
            ₹{totalSpent.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Direct material expenditures</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Registered Vendors</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{uniqueVendors}</div>
          <div className="text-[11px] text-slate-500 mt-1">Active uniform & gear suppliers</div>
        </div>
      </div>

      {/* Procurement Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading purchases...</div>
        ) : purchases.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            {listError || "No material purchases logged yet. Click \"+ Record Material Purchase\" to add one."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4">Item & Gear</th>
                  <th className="p-4">Vendor</th>
                  <th className="p-4">Vendor Invoice No</th>
                  <th className="p-4">Contract Allocation</th>
                  <th className="p-4">Purchase Date</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-semibold text-slate-900">
                      {p.itemName}
                    </td>
                    <td className="p-4 text-slate-700">
                      {p.vendorName}
                    </td>
                    <td className="p-4 font-mono text-xs text-amber-700 font-semibold">
                      {p.invoiceNo || "—"}
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {p.contract?.clientName || "General Stock"}
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-600">
                      {new Date(p.purchaseDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-900">
                      ₹{Number(p.amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">Record Material Purchase</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Item / Materials <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50 Sets Guard Uniforms, Belts & Lathis"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Vendor / Supplier <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bengal Safety & Uniform Works"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Invoice / Bill No <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BSW/2026/842"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Purchase Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Amount (₹) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="₹"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Allocate to Contract <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
                    value={contractId}
                    onChange={(e) => setContractId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="">Select contract</option>
                    <option value="GENERAL">General Company Stock</option>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.clientName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                >
                  {saving ? "Saving..." : "Save Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
