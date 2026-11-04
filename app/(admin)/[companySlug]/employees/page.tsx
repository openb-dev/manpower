"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import HrmHeader from "@/components/admin/HrmHeader";
import { statusLabel } from "@/components/admin/SimpleGuide";
import { assignStaffSite, loadEmployeeBook, loadReportPerson } from "../actions";

const ApplicantPaperForm = dynamic(
  () => import("@/components/admin/ApplicantPaperForm").then((mod) => mod.ApplicantPaperForm),
  { ssr: false },
);

export default function EmployeeBookPage() {
  const params = useParams();
  const companySlug = params?.companySlug as string;

  const [employees, setEmployees] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [listError, setListError] = useState("");
  const [sites, setSites] = useState<any[]>([]);
  const [savingSite, setSavingSite] = useState("");

  function loadEmployees() {
    setLoading(true);
    loadEmployeeBook(companySlug, { search })
      .then((data) => {
        setEmployees(data.items || []);
        setTotal(data.total || 0);
        setSites(data.sites || []);
        setListError("");
      })
      .catch((e: any) => {
        setEmployees([]);
        setTotal(0);
        setListError(e.message || "The employee book could not be loaded.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadEmployees();
  }, [companySlug]);

  async function handleAssignSite(empId: string, siteId: string) {
    if (!siteId) return;
    setSavingSite(empId);
    try {
      const result = await assignStaffSite(companySlug, empId, siteId);
      setEmployees((rows) =>
        rows.map((row) =>
          row.id === empId ? { ...row, siteId, site: { name: result.siteName } } : row
        )
      );
      setSelectedEmployee((current) =>
        current && current.id === empId ? { ...current, siteId, site: { name: result.siteName } } : current
      );
    } catch (e: any) {
      alert(e.message || "Site could not be saved.");
    } finally {
      setSavingSite("");
    }
  }

  async function handleSoftDelete(empId: string) {
    const reason = prompt("Why is this person leaving? Write a short reason.");
    if (!reason) return;

    try {
      const res = await fetch(`/api/admin/${companySlug}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SOFT_DELETE_EMPLOYEE",
          employeeId: empId,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to update record.");
      else {
        alert("Done. This person is terminated.");
        loadEmployees();
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function openEmployee(emp: any) {
    setSelectedEmployee(emp);
    try {
      const detail = await loadReportPerson(companySlug, "employee", emp.id);
      setSelectedEmployee({ ...emp, ...detail });
    } catch (err: any) {
      alert(err.message || "Could not open this employee form.");
    }
  }

  return (
    <div className="space-y-6">
      <div className={selectedEmployee ? "print:hidden space-y-6" : "space-y-6"}>
      <HrmHeader companySlug={companySlug} activeTab="employees" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500">
            People who work for this company.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Type name, mobile or employee number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadEmployees()}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg w-full sm:w-64 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-10"
          />
          <button
            onClick={loadEmployees}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs transition"
          >
            Search
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">Loading employee records...</div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {listError || "No employee records found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-4">Employee no.</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Job</th>
                  <th className="p-4">Site</th>
                  <th className="p-4">Salary</th>
                  <th className="p-4">Aadhaar</th>
                  <th className="p-4">Stage</th>
                  <th className="p-4 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono font-bold text-blue-600">{emp.employeeCode}</td>
                    <td className="p-4 font-semibold text-slate-900">
                      {emp.fullName}
                      <span className="block text-xs text-slate-400 font-normal">{emp.mobile}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-slate-800">{emp.jobRole?.name}</span>
                      <span className="block text-xs text-slate-400">{emp.roleCategory?.name}</span>
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-700">
                      <select
                        value={emp.siteId || ""}
                        disabled={savingSite === emp.id}
                        onChange={(e) => handleAssignSite(emp.id, e.target.value)}
                        className="max-w-40 px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                      >
                        <option value="">No site</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 font-mono">
                      ₹{Number(emp.basicRate || 0).toLocaleString()}
                      <span className="block text-[10px] text-slate-400">/ {emp.divisorDays || 26} days</span>
                    </td>
                    <td className="p-4 font-mono text-xs">{emp.aadhaarDisplay}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          emp.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {statusLabel(emp.status)}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEmployee(emp)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded"
                      >
                        Open
                      </button>
                      {emp.status === "ACTIVE" && (
                        <button
                          onClick={() => handleSoftDelete(emp.id)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded"
                        >
                          Terminate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </div>

      {/* PROFILE DRAWER / MODAL */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:static print:bg-white print:p-0 print:overflow-visible print:block">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:p-0 print:overflow-visible">
            <div className="flex items-center justify-between border-b pb-4 mb-4 no-print">
              <div>
                <span className="text-xs font-mono font-bold text-blue-600">{selectedEmployee.employeeCode}</span>
                <h2 className="text-xl font-bold text-slate-900">{selectedEmployee.fullName}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg"
                >
                  Print paper form
                </button>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="text-slate-400 hover:text-slate-700 text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <ApplicantPaperForm person={selectedEmployee} company={{ slug: companySlug }} />

            <div className="grid grid-cols-2 gap-3 text-sm mt-6 no-print">
              <div>
                <span className="text-xs text-slate-400 block">Mobile</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.mobile}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Aadhaar</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.aadhaarDisplay}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">PAN</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.pan || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">UAN / PF</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.uan || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">ESIC IP</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.esicNo || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Bank Account</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.bankAccountNo || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Bank IFSC</span>
                <span className="font-semibold text-slate-800">{selectedEmployee.bankIfsc || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Joining Date</span>
                <span className="font-semibold text-slate-800">
                  {new Date(selectedEmployee.joiningDate).toLocaleDateString()}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-slate-400 block">Duty site</span>
                <select
                  value={selectedEmployee.siteId || ""}
                  disabled={savingSite === selectedEmployee.id}
                  onChange={(e) => handleAssignSite(selectedEmployee.id, e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-sm"
                >
                  <option value="">Select duty site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Set the site first. Then you can mark attendance.
                </p>
              </div>
            </div>

            <div className="mt-6 border-t pt-4 no-print">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Documents & Private Storage
              </h3>
              {selectedEmployee.documents?.length > 0 ? (
                <div className="space-y-1">
                  {selectedEmployee.documents.map((d: any) => (
                    <div key={d.id} className="text-xs p-2 bg-slate-50 rounded flex justify-between">
                      <span className="font-medium text-slate-800">{d.docType}</span>
                      <span className="text-slate-400 font-mono text-[10px]">{d.fileName}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No document attachments uploaded.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
