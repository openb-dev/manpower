import { useEffect, useState } from "react";
import { api } from "./api.js";
import { ApplicationFields, blankFamily } from "./ApplicationForm.jsx";
import { personError } from "../server/data/required.js";
import { DECLARATION, JOINING_VERSION, TERMS } from "../server/data/joiningText.js";

function blankForm() {
  return {
    name: "", fatherOrHusband: "", dateOfBirth: "", age: "", localAddress: "", villageAddress: "", qualification: "",
    experience: "", characterCertificate: "", identificationMark: "", nationality: "", religion: "", reference: "",
    height: "", weight: "", chest: "", nominee: "", photo: "", photoName: "", exServiceNo: "", exRank: "",
    exDischargeDate: "", exDischargeBook: "", gunLicence: "", gunNo: "", mobile: "", presentAddress: "", presentPin: "",
    permanentAddress: "", permanentPin: "", aadhaar: "", pan: "", previousEmployer: "", uan: "", esiIp: "",
    preferredDispensary: "", family: blankFamily(), bankName: "", accountNo: "", ifsc: "", branchName: "", policeStatus: "",
    securityMoney: "", joiningTerms: false, declarationAccepted: false, termsAccepted: false,
    aadhaarFile: "", aadhaarFileName: "", panFile: "", panFileName: "",
    passbookFile: "", passbookFileName: "",
  };
}

function applyFetch(url, body, token) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export function Apply() {
  const [step, setStep] = useState("register");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [roles, setRoles] = useState([]);
  const [jobRole, setJobRole] = useState("");
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    fetch("/api/apply/roles")
      .then((response) => response.json())
      .then((rows) => setRoles(Array.isArray(rows) ? rows : []))
      .catch(() => setRoles([]));
  }, []);

  const role = roles.find((item) => item.name === jobRole);

  async function start(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await applyFetch("/api/apply/start", { contact });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "The code could not be sent.");
      return;
    }
    setContact(body.contact || contact);
    setStep("otp");
  }

  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await applyFetch("/api/apply/verify", { contact, code });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "That code is not valid.");
      return;
    }
    setSetupToken(body.setupToken || "");
    setStep("password");
  }

  async function savePassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await applyFetch("/api/apply/password", { setupToken, password });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "The password could not be saved.");
      return;
    }
    setToken(body.token || "");
    if (body.status === "submitted") setStep("done");
    else setStep(body.jobRole ? "form" : "role");
    if (body.jobRole) setJobRole(body.jobRole);
  }

  async function signInAgain(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await applyFetch("/api/apply/login", { contact, password });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Sign-in did not open.");
      return;
    }
    setToken(body.token || "");
    if (body.jobRole) setJobRole(body.jobRole);
    if (body.status === "submitted") setStep("done");
    else setStep(body.jobRole ? "form" : "role");
  }

  function chooseRole(event) {
    event.preventDefault();
    if (!jobRole) {
      setError("Choose a job role.");
      return;
    }
    setError("");
    setStep("form");
  }

  async function submitForm(event) {
    event.preventDefault();
    const application = {
      ...form,
      joiningTerms: Boolean(form.declarationAccepted && form.termsAccepted),
      termsVersion: JOINING_VERSION,
    };
    if (role && !role.gun) {
      application.gunLicence = application.gunLicence || "NA";
      application.gunNo = application.gunNo || "NA";
    }
    const message = personError({
      name: form.name,
      trade: role?.name || "",
      skill: role?.skill || "",
      salary: "1",
      attendance: "0",
      advance: "0",
      divisor: "26",
      deduct: "0",
      paymentDone: "0",
      application,
    });
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    const response = await applyFetch("/api/apply/submit", { jobRole, form: application }, token);
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "The application could not be sent.");
      return;
    }
    setStep("done");
  }

  if (step === "form") {
    return (
      <div className="apply-page">
        <header className="apply-top">
          <strong>Job application</strong>
          <span>{jobRole}</span>
        </header>
        <main>
          <form className="sheet book-form" onSubmit={submitForm}>
            <p className="form-section">Name</p>
            <label className="span-2">
              Name in full<span className="req"> *</span>
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <ApplicationFields
              form={form}
              showGun={Boolean(role?.gun)}
              showAcceptance={false}
              setField={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
            />
            <Acceptance
              text={DECLARATION}
              checked={form.declarationAccepted}
              label="I have read the declaration and I accept it"
              onChange={(value) => setForm((current) => ({ ...current, declarationAccepted: value }))}
            />
            <Acceptance
              text={TERMS}
              checked={form.termsAccepted}
              label="I have read the terms and conditions and I accept them"
              onChange={(value) => setForm((current) => ({ ...current, termsAccepted: value }))}
            />
            {error ? <div className="error span-2">{error}</div> : null}
            <div className="book-actions span-2">
              <button className="signin" type="submit" disabled={busy}>Submit application</button>
            </div>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="gate">
      <div className="gate-body">
        <section className="sheet gate-sheet apply-sheet">
          <p className="gate-brand">Job application</p>
          <h2>Apply for a job</h2>
          {step === "register" && (
            <form className="gate-fields" onSubmit={returning ? signInAgain : start}>
              <label>
                Email or mobile
                <input value={contact} onChange={(event) => setContact(event.target.value)} />
              </label>
              {returning ? (
                <label>
                  Password
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
              ) : null}
              {error ? <div className="error">{error}</div> : null}
              <button className="signin" type="submit" disabled={busy}>{returning ? "Continue" : "Send code"}</button>
              <button className="forgot" type="button" onClick={() => { setReturning((open) => !open); setError(""); }}>
                {returning ? "I am new" : "I already set a password"}
              </button>
            </form>
          )}
          {step === "otp" && (
            <form className="gate-fields" onSubmit={verify}>
              <p className="hint">Enter the 6-digit verification code sent to {contact}.</p>
              <label>
                Code
                <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" />
              </label>
              {error ? <div className="error">{error}</div> : null}
              <button className="signin" type="submit" disabled={busy}>Verify</button>
            </form>
          )}
          {step === "password" && (
            <form className="gate-fields" onSubmit={savePassword}>
              <label>
                Password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              {error ? <div className="error">{error}</div> : null}
              <button className="signin" type="submit" disabled={busy}>Save password</button>
            </form>
          )}
          {step === "role" && (
            <form className="gate-fields" onSubmit={chooseRole}>
              <label>
                Job role
                <select value={jobRole} onChange={(event) => setJobRole(event.target.value)}>
                  <option value="">Select</option>
                  {roles.map((item) => <option key={item.name}>{item.name}</option>)}
                </select>
              </label>
              {error ? <div className="error">{error}</div> : null}
              <button className="signin" type="submit">Open the form</button>
            </form>
          )}
          {step === "done" && (
            <div className="gate-fields">
              <p className="done-note">Your application has been received. Origin will see it in the applicant book.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ClauseList({ text }) {
  return (
    <article className="terms-box span-2">
      <h3>{text.title}</h3>
      {text.note ? <p>{text.note}</p> : null}
      {text.intro ? <p>{text.intro}</p> : null}
      <ol>
        {text.points.map((point) => <li key={point}>{point}</li>)}
      </ol>
    </article>
  );
}

function Acceptance({ text, checked, label, onChange }) {
  return (
    <>
      <ClauseList text={text} />
      <label className="span-2 accept-line">
        <input type="checkbox" required checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{label}<span className="req"> *</span></span>
      </label>
    </>
  );
}

function View({ label, value, wide = false }) {
  return (
    <label className={wide ? "span-2" : ""}>
      {label}
      <input readOnly value={value || ""} />
    </label>
  );
}

function StoredApplication({ form, files }) {
  const fileName = (kind) => files.find((file) => file.document_kind === kind)?.file_name || "";
  return (
    <div className="book-form">
      <p className="form-section">Application</p>
      <View label="Father / husband" value={form.fatherOrHusband} />
      <View label="Date of birth" value={form.dateOfBirth} />
      <View label="Age" value={form.age} />
      <View label="Qualification" value={form.qualification} />
      <View label="Local address" value={form.localAddress} wide />
      <View label="Village address" value={form.villageAddress} wide />
      <View label="Experience" value={form.experience} />
      <View label="Character certificate" value={form.characterCertificate} />
      <View label="Identification mark" value={form.identificationMark} />
      <View label="Nationality" value={form.nationality} />
      <View label="Religion" value={form.religion} />
      <View label="Reference" value={form.reference} />
      <View label="Height" value={form.height} />
      <View label="Weight" value={form.weight} />
      <View label="Chest" value={form.chest} />
      <View label="Nominee" value={form.nominee} />
      <View label="Photo" value={form.photoName || fileName("photo")} />
      <p className="form-section">Ex-serviceman</p>
      <View label="Ex-serviceman no." value={form.exServiceNo} />
      <View label="Rank" value={form.exRank} />
      <View label="Discharge date" value={form.exDischargeDate} />
      <View label="Discharge book no." value={form.exDischargeBook} />
      <View label="Gun licence" value={form.gunLicence} />
      <View label="Gun no." value={form.gunNo} />
      <p className="form-section">Declaration</p>
      <View label="Mobile" value={form.mobile} />
      <View label="Present address" value={form.presentAddress} wide />
      <View label="Present PIN" value={form.presentPin} />
      <View label="Permanent address" value={form.permanentAddress} wide />
      <View label="Permanent PIN" value={form.permanentPin} />
      <View label="Aadhaar last 4" value={form.aadhaarLast4} />
      <View label="PAN last 4" value={form.panLast4} />
      <View label="Previous employer" value={form.previousEmployer} />
      <View label="UAN" value={form.uan} />
      <View label="ESI IP no." value={form.esiIp} />
      <View label="Preferred dispensary" value={form.preferredDispensary} />
      <p className="form-section">Family</p>
      {(form.family || []).map((member, index) => (
        <div className="family-row" key={index}>
          <View label="Name" value={member.name} />
          <View label="Relation" value={member.relation} />
          <View label="Date of birth" value={member.dateOfBirth} />
          <View label="Aadhaar last 4" value={member.aadhaarLast4} />
        </div>
      ))}
      <p className="form-section">Bank and documents</p>
      <View label="Bank name" value={form.bankName} />
      <View label="Account last 4" value={form.accountLast4} />
      <View label="IFSC" value={form.ifsc} />
      <View label="Branch" value={form.branchName} />
      <View label="Police verification" value={form.policeStatus} />
      <View label="Security money" value={form.securityMoney} />
      <View label="Declaration" value={form.declarationAccepted ? "Accepted" : form.joiningTerms ? "Accepted" : ""} />
      <View label="Terms and conditions" value={form.termsAccepted ? "Accepted" : form.joiningTerms ? "Accepted" : ""} />
      <View label="Wording version" value={form.termsVersion || ""} />
      {(form.declarationAccepted || form.termsAccepted) && (
        <div className="span-2">
          <ClauseList text={DECLARATION} />
          <ClauseList text={TERMS} />
        </div>
      )}
      <View label="Aadhaar file" value={form.aadhaarFileName || fileName("aadhaar")} />
      <View label="PAN file" value={form.panFileName || fileName("pan")} />
      <View label="Bank passbook" value={form.passbookFileName || fileName("passbook")} />
    </div>
  );
}

function statusBadge(status) {
  const st = String(status || "").toLowerCase();
  if (st === "approved") {
    return <span style={{ background: "#dcfce7", color: "#166534", padding: "3px 10px", borderRadius: "9999px", fontWeight: "600", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>✓ Approved</span>;
  }
  if (st === "shortlisted") {
    return <span style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 10px", borderRadius: "9999px", fontWeight: "600", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>★ Shortlisted</span>;
  }
  if (st === "rejected") {
    return <span style={{ background: "#fee2e2", color: "#991b1b", padding: "3px 10px", borderRadius: "9999px", fontWeight: "600", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>✕ Rejected</span>;
  }
  if (st === "submitted") {
    return <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: "9999px", fontWeight: "600", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>● Submitted</span>;
  }
  return <span style={{ background: "#f1f5f9", color: "#475569", padding: "3px 10px", borderRadius: "9999px", fontWeight: "600", fontSize: "12px" }}>{status || "Registered"}</span>;
}

export function ApplicantBook({ onOpenEmployeeBook }) {
  const [rows, setRows] = useState([]);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [actionError, setActionError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  // Approval modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [basicSalary, setBasicSalary] = useState("14000");
  const [divisorDays, setDivisorDays] = useState("26");
  const [approveTrade, setApproveTrade] = useState("");
  const [approveSkill, setApproveSkill] = useState("Skilled");
  const [approving, setApproving] = useState(false);

  function load() {
    api("/api/applicants")
      .then(async (response) => {
        const body = await response.json().catch(() => []);
        if (!response.ok) throw new Error(body.error || "The applicant book could not be loaded.");
        setRows(body);
        setError("");
      })
      .catch((reason) => setError(reason.message));
  }

  useEffect(() => { load(); }, []);

  async function open(id) {
    setActionError("");
    setActionMsg("");
    const response = await api(`/api/applicants/${id}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "That application could not be opened.");
      return;
    }
    setPicked(body);
    setApproveTrade(body.jobRole || "Security Guard");
    setApproveSkill(
      body.jobRole === "Unskilled Worker"
        ? "Unskilled"
        : body.jobRole === "Semi-skilled Worker"
        ? "Semi-skilled"
        : "Skilled"
    );
    setBasicSalary("14000");
    setDivisorDays("26");
  }

  async function handleStatusChange(applicantId, newStatus) {
    setActionError("");
    setActionMsg("");
    try {
      const response = await api(`/api/applicants/${applicantId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update status.");

      setRows((prev) =>
        prev.map((r) => (r.id === applicantId ? { ...r, status_name: newStatus } : r))
      );
      if (picked && picked.id === applicantId) {
        setPicked((prev) => ({ ...prev, status: newStatus }));
      }
      setActionMsg(`Applicant marked as ${newStatus}.`);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleApprove() {
    if (!picked) return;
    setActionError("");
    setActionMsg("");
    setApproving(true);
    try {
      const response = await api(`/api/applicants/${picked.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          name: form?.name || picked.contact,
          trade: approveTrade,
          skill: approveSkill,
          salary: Number(basicSalary) || 14000,
          divisor: Number(divisorDays) || 26,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not approve applicant.");

      setShowApproveModal(false);
      setRows((prev) =>
        prev.map((r) => (r.id === picked.id ? { ...r, status_name: "approved" } : r))
      );
      setPicked((prev) => ({ ...prev, status: "approved", employeeId: data.employeeId }));
      setActionMsg(data.message || `Applicant approved and added to Employee book.`);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setApproving(false);
    }
  }

  const form = picked?.form;

  const filteredRows = rows.filter((r) => {
    if (filter === "ALL") return true;
    return String(r.status_name || "").toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="book">
      {error ? <p className="book-error">{error}</p> : null}

      {actionMsg && (
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", color: "#166534", padding: "12px 18px", borderRadius: "8px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "500", fontSize: "14px" }}>
          <span>{actionMsg}</span>
          <button type="button" onClick={() => setActionMsg("")} style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}>✕</button>
        </div>
      )}

      {actionError && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", padding: "12px 18px", borderRadius: "8px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "500", fontSize: "14px" }}>
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError("")} style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}>✕</button>
        </div>
      )}

      <section className="sheet">
        <div className="sheet-title" style={{ flexWrap: "wrap", gap: "10px" }}>
          <h2>Applications ({rows.length})</h2>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              { id: "ALL", label: "All", count: rows.length },
              { id: "submitted", label: "Submitted", count: rows.filter((r) => String(r.status_name).toLowerCase() === "submitted").length },
              { id: "shortlisted", label: "Shortlisted", count: rows.filter((r) => String(r.status_name).toLowerCase() === "shortlisted").length },
              { id: "approved", label: "Approved", count: rows.filter((r) => String(r.status_name).toLowerCase() === "approved").length },
              { id: "rejected", label: "Rejected", count: rows.filter((r) => String(r.status_name).toLowerCase() === "rejected").length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                style={{
                  background: filter === tab.id ? "#1e293b" : "#f1f5f9",
                  color: filter === tab.id ? "#ffffff" : "#475569",
                  border: "1px solid " + (filter === tab.id ? "#1e293b" : "#e2e8f0"),
                  borderRadius: "6px",
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  background: filter === tab.id ? "rgba(255,255,255,0.25)" : "#cbd5e1",
                  color: filter === tab.id ? "#fff" : "#1e293b",
                  borderRadius: "9999px",
                  padding: "1px 6px",
                  fontSize: "11px",
                }}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Job role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  No applications match this filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const isSelected = picked && picked.id === row.id;
                return (
                  <tr
                    key={row.id}
                    onClick={() => open(row.id)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "#f0fdf4" : undefined,
                    }}
                  >
                    <td style={{ fontWeight: isSelected ? "600" : "normal" }}>{row.applicant_name || "—"}</td>
                    <td>{row.contact}</td>
                    <td>{row.job_role || "—"}</td>
                    <td>{statusBadge(row.status_name)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => open(row.id)}
                        style={{
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          cursor: "pointer",
                          fontWeight: "600",
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {picked && (
        <section className="sheet gap">
          <div className="sheet-title" style={{ flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <div>
              <h2 style={{ display: "inline-block", marginRight: "12px" }}>{form?.name || picked.contact}</h2>
              {statusBadge(picked.status)}
            </div>

            {/* ACTION BUTTONS (Super Admin & Admin Facilities) */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {picked.status !== "approved" && (
                <>
                  {picked.status !== "shortlisted" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(picked.id, "shortlisted")}
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "7px 14px",
                        fontWeight: "600",
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      ★ Shortlist
                    </button>
                  )}

                  {picked.status !== "rejected" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(picked.id, "rejected")}
                      style={{
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "7px 14px",
                        fontWeight: "600",
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      ✕ Reject
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowApproveModal(true)}
                    style={{
                      background: "#16a34a",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "7px 18px",
                      fontWeight: "700",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                    }}
                  >
                    ✓ Approve & Convert to Employee
                  </button>
                </>
              )}

              {picked.status === "approved" && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ background: "#dcfce7", color: "#166534", padding: "6px 12px", borderRadius: "6px", fontWeight: "700", fontSize: "13px" }}>
                    ✓ Converted to Employee
                  </span>
                  {onOpenEmployeeBook && (
                    <button
                      type="button"
                      onClick={onOpenEmployeeBook}
                      style={{
                        background: "#0f172a",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "7px 14px",
                        fontWeight: "600",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      View in Employee book →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="book-note">
            {picked.jobRole || "No job role yet"} · {picked.contact} · Submitted: {picked.submittedAt ? new Date(picked.submittedAt).toLocaleDateString() : "Yes"}
          </p>

          {form ? <StoredApplication form={form} files={picked.files || []} /> : <p className="book-note">The form has not been submitted.</p>}
        </section>
      )}

      {/* APPROVAL MODAL */}
      {showApproveModal && picked && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "12px",
            maxWidth: "480px",
            width: "100%",
            padding: "24px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "18px", color: "#0f172a" }}>
              Approve & Onboard Employee
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
              This will create an active employee profile in the Employee book, copy all KYC and banking details, and update application status.
            </p>

            <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Candidate Name <span className="req">*</span></label>
                <input
                  type="text"
                  readOnly
                  value={form?.name || picked.contact}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: "14px", fontWeight: "600" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Trade / Designation <span className="req">*</span></label>
                <input
                  type="text"
                  required
                  value={approveTrade}
                  onChange={(e) => setApproveTrade(e.target.value)}
                  placeholder="e.g. Security Guard"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Skill Category <span className="req">*</span></label>
                <select
                  required
                  value={approveSkill}
                  onChange={(e) => setApproveSkill(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                >
                  <option value="Skilled">Skilled</option>
                  <option value="Semi-skilled">Semi-skilled</option>
                  <option value="Unskilled">Unskilled</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Monthly Salary (₹) <span className="req">*</span></label>
                  <input
                    type="number"
                    required
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#334155", marginBottom: "4px" }}>Days for Full Pay <span className="req">*</span></label>
                  <input
                    type="number"
                    required
                    value={divisorDays}
                    onChange={(e) => setDivisorDays(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                disabled={approving}
                style={{
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                style={{
                  background: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                {approving ? "Onboarding..." : "Confirm & Create Employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
