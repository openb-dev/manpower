"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  LogOut,
  Plus,
  Shield,
  UserCog,
  X,
} from "lucide-react";
import NkLogo from "@/components/NkLogo";
import { isNkCompany } from "@/lib/nkLogo";
import { friendlyPublicError, readApiJson } from "@/lib/publicErrors";
import {
  ASSIGNABLE_OFFICE_ROLES,
  modulesForRole,
  officeRoleLabel,
  officeRoleNote,
} from "@/lib/officeRoles";

type CompanyRow = {
  id: string;
  slug: string;
  shortName: string;
  legalName: string;
  prefix: string;
  applicants: number;
  employees: number;
  contracts: number;
  users: number;
  projects: { id: string; label: string; clientName: string; agreementNo: string | null; workStatus: string }[];
  employeeOptions: { id: string; label: string; mobile: string }[];
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
  employeeId: string | null;
  employeeName: string | null;
  employeeCode: string | null;
  active: boolean;
  projectIds: string[];
  projects: { id: string; label: string }[];
};

const emptyForm = {
  id: "",
  name: "",
  email: "",
  password: "",
  role: "BACK_OFFICE",
  companyId: "",
  employeeId: "",
  projectIds: [] as string[],
  active: true,
};

export default function SuperAdminClient({
  initialCompanies,
}: {
  initialCompanies: CompanyRow[];
}) {
  const [tab, setTab] = useState<"companies" | "roles">("companies");
  const [companies, setCompanies] = useState<CompanyRow[]>(initialCompanies);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === form.companyId) || null,
    [companies, form.companyId],
  );

  async function loadBook() {
    setLoadingUsers(true);
    setError("");
    try {
      const res = await fetch("/api/super-admin", { credentials: "include" });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data?.error || "Could not load.");
      setCompanies(data.companies || []);
      setUsers(data.users || []);
    } catch (err: any) {
      setError(friendlyPublicError(err.message || "Could not load Super Admin data."));
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    if (tab === "roles") void loadBook();
  }, [tab]);

  function openNew() {
    setForm({
      ...emptyForm,
      companyId: companies[0]?.id || "",
      role: "BACK_OFFICE",
    });
    setShowForm(true);
  }

  function openEdit(row: UserRow) {
    setForm({
      id: row.id,
      name: row.name,
      email: row.email,
      password: "",
      role: row.role,
      companyId: row.companyId || "",
      employeeId: row.employeeId || "",
      projectIds: [...(row.projectIds || [])],
      active: row.active,
    });
    setShowForm(true);
  }

  function toggleProject(id: string) {
    setForm((prev) => ({
      ...prev,
      projectIds: prev.projectIds.includes(id)
        ? prev.projectIds.filter((p) => p !== id)
        : [...prev.projectIds, id],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_OFFICE_USER",
          id: form.id || undefined,
          name: form.name,
          email: form.email,
          password: form.password || undefined,
          role: form.role,
          companyId: form.companyId,
          employeeId: form.employeeId || null,
          projectIds: form.projectIds,
          active: form.active,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data?.error || "Could not save.");
      setShowForm(false);
      await loadBook();
      setTab("roles");
    } catch (err: any) {
      alert(friendlyPublicError(err.message || "Could not save."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: UserRow) {
    const res = await fetch("/api/super-admin", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SET_OFFICE_USER_ACTIVE",
        id: row.id,
        active: !row.active,
      }),
    });
    const data = await readApiJson(res);
    if (!res.ok) {
      alert(friendlyPublicError(data?.error || "Could not update."));
      return;
    }
    await loadBook();
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <span className="text-[11px] uppercase font-extrabold tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
              Super Admin
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">All access</h1>
            <p className="text-sm text-slate-500 mt-1">
              Open a company, or add office roles and assign projects to employees.
            </p>
          </div>
          <a href="/logout" className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline">
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Log out
          </a>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab("companies")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${
              tab === "companies"
                ? "bg-indigo-700 text-white border-indigo-700"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Building2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Companies
          </button>
          <button
            type="button"
            onClick={() => setTab("roles")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${
              tab === "roles"
                ? "bg-indigo-700 text-white border-indigo-700"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Shield className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Roles & project access
          </button>
        </div>

        {tab === "companies" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/${company.slug}/dashboard`}
                className="block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isNkCompany(company.slug) ? (
                      <NkLogo className="h-10 w-10 rounded-lg object-contain bg-black shrink-0" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 shrink-0">
                        <Building2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    )}
                    <div className="text-lg font-bold text-slate-900 truncate">{company.shortName}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                    {company.prefix}
                  </span>
                </div>
                <div className="text-sm text-slate-500 mt-1">{company.legalName}</div>
                <div className="text-xs text-slate-400 mt-3">
                  {company.applicants} applicants · {company.employees} employees · {company.contracts} projects
                </div>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700">
                  Open office
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Office roles</h2>
                <p className="text-sm text-slate-500">
                  Role → project-specific → employee-specific. Hierarchy from the client note.
                </p>
              </div>
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold rounded-xl"
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                Add role login
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {ASSIGNABLE_OFFICE_ROLES.filter((r) => r !== "COMPANY_ADMIN").map((role) => (
                <div key={role} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="font-bold text-slate-900">{officeRoleLabel(role)}</div>
                  <div className="text-xs text-slate-500 mt-1">{officeRoleNote(role)}</div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    Modules: {modulesForRole(role).join(", ")}
                  </div>
                </div>
              ))}
            </div>

            {error ? (
              <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>
            ) : null}

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <UserCog className="h-4 w-4 text-slate-500" aria-hidden />
                <h3 className="text-sm font-bold text-slate-900">Assigned logins</h3>
              </div>
              {loadingUsers ? (
                <div className="p-8 text-center text-slate-500 text-sm">Loading...</div>
              ) : users.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No office logins yet. Add one.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {users.map((row) => (
                    <div key={row.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900">{row.name}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {row.roleLabel}
                          </span>
                          {!row.active ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              Inactive
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{row.email}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Company: <span className="font-semibold text-slate-700">{row.companyName || "—"}</span>
                          {row.employeeName ? (
                            <>
                              {" "}
                              · Employee:{" "}
                              <span className="font-semibold text-slate-700">
                                {row.employeeName}
                                {row.employeeCode ? ` (${row.employeeCode})` : ""}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Projects:{" "}
                          {row.projects.length
                            ? row.projects.map((p) => p.label).join(", ")
                            : "All projects in company (none selected)"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(row)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                        >
                          {row.active ? "Deactivate" : "Activate"}
                        </button>
                        {row.companySlug ? (
                          <Link
                            href={`/${row.companySlug}/dashboard`}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-800"
                          >
                            Open company
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-600">
                  Super Admin
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {form.id ? "Update role login" : "Add role login"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3">
              <Field label="Name *">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <Field label="Login email *">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={FIELD}
                />
              </Field>
              <Field label={form.id ? "New password (optional)" : "Password *"}>
                <input
                  type="password"
                  required={!form.id}
                  minLength={form.id ? undefined : 6}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={FIELD}
                  placeholder={form.id ? "Leave blank to keep current" : "Min 6 characters"}
                />
              </Field>
              <Field label="Admin role *">
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className={FIELD}
                >
                  {ASSIGNABLE_OFFICE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {officeRoleLabel(role)} — {officeRoleNote(role)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Company *">
                <select
                  required
                  value={form.companyId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      companyId: e.target.value,
                      employeeId: "",
                      projectIds: [],
                    }))
                  }
                  className={FIELD}
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Employee (optional — employee-specific)">
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                  className={FIELD}
                  disabled={!selectedCompany}
                >
                  <option value="">Not linked to an employee</option>
                  {(selectedCompany?.employeeOptions || []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <div className="text-xs font-bold text-slate-700 mb-1">
                  Projects (project-specific) — leave empty for all projects in company
                </div>
                {!selectedCompany ? (
                  <p className="text-xs text-slate-400">Select a company first.</p>
                ) : selectedCompany.projects.length === 0 ? (
                  <p className="text-xs text-slate-400">No projects in Work Register yet for this company.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                    {selectedCompany.projects.map((p) => {
                      const on = form.projectIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${
                            on ? "bg-indigo-50 text-indigo-900" : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleProject(p.id)}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-semibold block">{p.label}</span>
                            <span className="text-slate-500">
                              {p.clientName}
                              {p.agreementNo ? ` · ${p.agreementNo}` : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                Active login
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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

const FIELD =
  "w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-700 block mb-1">{label}</label>
      {children}
    </div>
  );
}
