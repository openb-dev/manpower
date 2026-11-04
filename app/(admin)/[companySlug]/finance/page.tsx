"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { loadFinanceBook } from "../actions";

export default function FinancePage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;

  const [entries, setEntries] = useState<any[]>([]);
  const [totalCredit, setTotalCredit] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [narration, setNarration] = useState("");
  const [voucherNumber, setVoucherNumber] = useState("");
  const [entryType, setEntryType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("CLIENT_RECEIPT");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [chequeNo, setChequeNo] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState("");

  function loadFinanceData() {
    setLoading(true);
    loadFinanceBook(companySlug)
      .then((data) => {
        setEntries(data.entries || []);
        setTotalCredit(data.totalCredit || 0);
        setTotalDebit(data.totalDebit || 0);
        setBalance(data.balance || 0);
        setListError("");
      })
      .catch((err) => {
        setEntries([]);
        setTotalCredit(0);
        setTotalDebit(0);
        setBalance(0);
        setListError(err.message || "The ledger could not be loaded.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadFinanceData();
  }, [companySlug]);

  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    if (paymentMode === "CHEQUE" && !chequeNo.trim()) {
      alert("Please enter the cheque number.");
      return;
    }
    setSaving(true);
    try {
      const creditAmount = entryType === "CREDIT" ? Number(amount) : 0;
      const debitAmount = entryType === "DEBIT" ? Number(amount) : 0;

      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_LEDGER_ENTRY",
          narration,
          voucherNumber,
          creditAmount,
          debitAmount,
          category,
          paymentMode,
          chequeNo: paymentMode === "CHEQUE" ? chequeNo.trim() : "",
          entryDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create ledger entry");

      setShowModal(false);
      setNarration("");
      setVoucherNumber("");
      setAmount("");
      setChequeNo("");
      setPaymentMode("CASH");
      loadFinanceData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider bg-violet-100 text-violet-800 px-2 py-0.5 rounded">
              Money
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Money in and money out</h1>
          <p className="text-sm text-slate-500">
            Write every time money comes in or goes out.
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5"
          >
            <span>+</span>
            <span>Add money entry</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Credits (Inflow)</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            ₹{totalCredit.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Receipts & Bank Inflows</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Debits (Outflow)</div>
          <div className="text-2xl font-black text-red-600 mt-1">
            ₹{totalDebit.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Wages, uniforms & expenses</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Ledger Balance</div>
          <div className={`text-2xl font-black mt-1 ${balance >= 0 ? "text-slate-900" : "text-red-700"}`}>
            ₹{balance.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Running cash/bank balance</div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading ledger entries...</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            {listError || "No ledger entries found. Click \"+ Record Ledger Entry\" to add one."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Voucher No</th>
                  <th className="p-4">Narration</th>
                  <th className="p-4">Paid by</th>
                  <th className="p-4">What for</th>
                  <th className="p-4 text-right">Debit (Out)</th>
                  <th className="p-4 text-right">Credit (In)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono text-xs text-slate-600">
                      {new Date(e.entryDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="p-4 font-mono text-xs font-bold text-violet-700">
                      {e.voucherNumber || "—"}
                    </td>
                    <td className="p-4 font-medium text-slate-900 max-w-md">
                      {e.narration}
                    </td>
                    <td className="p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 inline-block">
                        {paymentLabel(e.paymentMode)}
                      </div>
                      {e.chequeNo ? (
                        <div className="text-[11px] font-mono text-slate-500 mt-1">Chq {e.chequeNo}</div>
                      ) : null}
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {purposeLabel(e.category)}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-semibold text-red-600">
                      {Number(e.debitAmount) > 0 ? `₹${Number(e.debitAmount).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="p-4 text-right font-mono font-semibold text-emerald-600">
                      {Number(e.creditAmount) > 0 ? `₹${Number(e.creditAmount).toLocaleString("en-IN")}` : "—"}
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
              <h2 className="text-lg font-bold text-slate-900">Record General Ledger Entry</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Narration <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Guard salary payout for August 2026"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Voucher Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VCH-2026-041"
                    value={voucherNumber}
                    onChange={(e) => setVoucherNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Entry Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    In or out <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="CREDIT">Money in</option>
                    <option value="DEBIT">Money out</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    What for <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="CLIENT_RECEIPT">Client payment</option>
                    <option value="SALARY">Salary / wages</option>
                    <option value="OFFICE">Office / uniforms</option>
                    <option value="BANK">Bank charges</option>
                    <option value="GENERAL">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  How paid <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="ONLINE">Online</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              {paymentMode === "CHEQUE" ? (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Cheque number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={chequeNo}
                    onChange={(e) => setChequeNo(e.target.value)}
                    placeholder="e.g. 458921"
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
              ) : null}

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
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold"
                >
                  {saving ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function paymentLabel(mode?: string) {
  if (mode === "ONLINE") return "Online";
  if (mode === "BANK_TRANSFER") return "Bank transfer";
  if (mode === "CHEQUE") return "Cheque";
  if (mode === "CASH") return "Cash";
  return mode || "Cash";
}

function purposeLabel(category?: string) {
  if (category === "CLIENT_RECEIPT") return "Client payment";
  if (category === "SALARY") return "Salary / wages";
  if (category === "OFFICE") return "Office / uniforms";
  if (category === "BANK") return "Bank charges";
  return category || "Other";
}
