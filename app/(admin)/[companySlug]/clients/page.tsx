"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Contact, Download, Plus, Trash2, X } from "lucide-react";
import { loadClientDetailsBook } from "../actions";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";
import { downloadClientDetailsExcel } from "@/lib/downloadClientDetailsExcel";

const FIELD =
  "w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white";

const emptyForm = {
  id: "",
  departmentName: "",
  officerName: "",
  designation: "",
  contactOfficial: "",
  contactPersonal: "",
  whatsappNumber: "",
  emailOfficial: "",
  emailPersonal: "",
  websiteLink: "",
  officeAddress: "",
  location: "",
  remarks: "",
};

export default function ClientsDetailsPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;
  const [company, setCompany] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function loadData() {
    setLoading(true);
    loadClientDetailsBook(companySlug)
      .then((data) => {
        setCompany(data.company || null);
        setRows(data.rows || []);
        setError("");
      })
      .catch((err) => {
        setRows([]);
        setError(friendlyPublicError(err.message || "Clients details could not be loaded."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (companySlug) loadData();
  }, [companySlug]);

  function openNew() {
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(row: any) {
    setForm({
      id: row.id,
      departmentName: row.departmentName || "",
      officerName: row.officerName || "",
      designation: row.designation || "",
      contactOfficial: row.contactOfficial || "",
      contactPersonal: row.contactPersonal || "",
      whatsappNumber: row.whatsappNumber || "",
      emailOfficial: row.emailOfficial || "",
      emailPersonal: row.emailPersonal || "",
      websiteLink: row.websiteLink || "",
      officeAddress: row.officeAddress || "",
      location: row.location || "",
      remarks: row.remarks || "",
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: form.id ? "UPDATE_CLIENT_DETAIL" : "CREATE_CLIENT_DETAIL",
          ...form,
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this client detail row?")) return;
    const res = await fetch(`/api/admin/${companySlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_CLIENT_DETAIL", id }),
    });
    const data = await readApiJson(res);
    if (!res.ok) {
      alert(friendlyPublicError(data?.error || "Could not delete."));
      return;
    }
    loadData();
  }

  const companyName = company?.legalName || company?.shortName || "M/s. N.K. Enterprise";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase font-extrabold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
            <Contact className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Clients details
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">CLIENTS DETAILS</h1>
          <p className="text-sm text-slate-500">
            Department officers, contact numbers, emails and office addresses — same columns as the client sheet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void downloadClientDetailsExcel({ companyName, rows })}
            disabled={!rows.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download Excel
          </button>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-bold rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add row
          </button>
        </div>
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
                <th className="border border-slate-400 p-1.5 text-center min-w-[48px]">Sl. No.</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[160px]">Department Name</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[140px]">Officer Name</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[120px]">Designation</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[130px]">
                  Contract Number
                  <br />
                  (Official)
                </th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[130px]">
                  Contract Number
                  <br />
                  (Personal)
                </th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[120px]">WhatsApp Number</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[160px]">
                  Email ID
                  <br />
                  (Official)
                </th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[160px]">
                  Email ID
                  <br />
                  (Personal)
                </th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[160px]">Website Link</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[220px]">Office address</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[140px]">Location / City / Town</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[140px]">Remarks</th>
                <th className="border border-slate-400 p-1.5 text-center min-w-[88px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="border border-slate-400 p-8 text-center text-slate-400">
                    No client rows yet. Add a row.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-indigo-50/40">
                    <td className="border border-slate-400 p-1.5 text-center">{i + 1}</td>
                    <td className="border border-slate-400 p-1.5 font-semibold">{row.departmentName || "—"}</td>
                    <td className="border border-slate-400 p-1.5">{row.officerName || "—"}</td>
                    <td className="border border-slate-400 p-1.5">{row.designation || "—"}</td>
                    <td className="border border-slate-400 p-1.5 font-mono whitespace-nowrap">
                      {row.contactOfficial || "—"}
                    </td>
                    <td className="border border-slate-400 p-1.5 font-mono whitespace-nowrap">
                      {row.contactPersonal || "—"}
                    </td>
                    <td className="border border-slate-400 p-1.5 font-mono whitespace-nowrap">
                      {row.whatsappNumber || "—"}
                    </td>
                    <td className="border border-slate-400 p-1.5 whitespace-nowrap">{row.emailOfficial || "—"}</td>
                    <td className="border border-slate-400 p-1.5 whitespace-nowrap">{row.emailPersonal || "—"}</td>
                    <td className="border border-slate-400 p-1.5">
                      {row.websiteLink ? (
                        <a
                          href={row.websiteLink.startsWith("http") ? row.websiteLink : `https://${row.websiteLink}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline break-all"
                        >
                          {row.websiteLink}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="border border-slate-400 p-1.5">{row.officeAddress || "—"}</td>
                    <td className="border border-slate-400 p-1.5">{row.location || "—"}</td>
                    <td className="border border-slate-400 p-1.5">{row.remarks || "—"}</td>
                    <td className="border border-slate-400 p-1.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="text-[10px] font-bold text-blue-700 hover:underline mr-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row.id)}
                        className="inline-flex text-rose-600 hover:text-rose-800"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{form.id ? "Edit client detail" : "Add client detail"}</h3>
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
              <Field label="Department Name">
                <input
                  value={form.departmentName}
                  onChange={(e) => setForm((f) => ({ ...f, departmentName: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <Field label="Officer Name">
                <input
                  value={form.officerName}
                  onChange={(e) => setForm((f) => ({ ...f, officerName: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <Field label="Designation">
                <input
                  value={form.designation}
                  onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <Field label="WhatsApp Number">
                <input
                  value={form.whatsappNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsappNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }))
                  }
                  className={FIELD}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Contract Number (Official)">
                <input
                  value={form.contactOfficial}
                  onChange={(e) => setForm((f) => ({ ...f, contactOfficial: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <Field label="Contract Number (Personal)">
                <input
                  value={form.contactPersonal}
                  onChange={(e) => setForm((f) => ({ ...f, contactPersonal: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <Field label="Email ID (Official)">
                <input
                  type="email"
                  value={form.emailOfficial}
                  onChange={(e) => setForm((f) => ({ ...f, emailOfficial: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <Field label="Email ID (Personal)">
                <input
                  type="email"
                  value={form.emailPersonal}
                  onChange={(e) => setForm((f) => ({ ...f, emailPersonal: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Website Link">
                  <input
                    value={form.websiteLink}
                    onChange={(e) => setForm((f) => ({ ...f, websiteLink: e.target.value }))}
                    className={FIELD}
                    placeholder="https://..."
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Office address">
                  <textarea
                    rows={2}
                    value={form.officeAddress}
                    onChange={(e) => setForm((f) => ({ ...f, officeAddress: e.target.value }))}
                    className={FIELD}
                  />
                </Field>
              </div>
              <Field label="Location / City / Town">
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <Field label="Remarks">
                <input
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                  className={FIELD}
                />
              </Field>
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
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-sm font-bold disabled:opacity-50"
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
