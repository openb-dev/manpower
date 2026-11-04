import { useEffect, useState } from "react";
import { api } from "./api.js";
import { inr } from "./data.js";

function typeName(code) {
  if (code === "A") return "A — Manpower";
  if (code === "B") return "B — Work";
  return "C — Office";
}

function nextStep(code) {
  if (code === "A") return "Deployment, then man-days by trade";
  if (code === "B") return "Material, manpower on the work, and other expense";
  return "Attendance only. No client bill.";
}

function blankContract() {
  return {
    clientName: "",
    departmentName: "",
    contractType: "A",
    workName: "",
    agreementNo: "",
    measurementBookNo: "",
    billNumber: "",
    voucherNumber: "",
    remarks: "",
    tenderOpening: "",
    tenderAmount: "",
    estimateCost: "",
    startAgreement: "",
    startActual: "",
    completionAgreement: "",
    completionActual: "",
    grossAmount: "",
    netAmount: "",
    earnestMoney: "",
    performanceGuarantee: "",
    securityDeposit: "",
    incomeTax: "",
    gstRecovery: "",
    educationCess: "",
    labourWelfareCess: "",
    waterCharge: "",
    withheld: "",
    otherRecovery: "",
    esiAmount: "",
    pfAmount: "",
    bankReceivedDate: "",
    reimburseDate: "",
  };
}

function asForm(record) {
  const form = blankContract();
  for (const key of Object.keys(form)) form[key] = record[key] == null ? "" : String(record[key]);
  return form;
}

function Field({ label, value, onChange, type = "text", wide = false }) {
  return (
    <label className={wide ? "span-2" : undefined}>
      {label}<span className="req"> *</span>
      <input required type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function thisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function Deployment({ contractId }) {
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState([]);
  const [sites, setSites] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [daysWorked, setDaysWorked] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [deploymentResponse, peopleResponse, siteResponse] = await Promise.all([
      api(`/api/deployments?contractId=${contractId}&month=${month}`),
      api(`/api/employees?month=${month}`),
      api("/api/sites"),
    ]);
    if (!deploymentResponse.ok || !peopleResponse.ok || !siteResponse.ok) {
      setError("Deployment could not be loaded.");
      return;
    }
    setRows(await deploymentResponse.json());
    setPeople(await peopleResponse.json());
    setSites(await siteResponse.json());
    setError("");
  }

  useEffect(() => {
    if (month) load();
  }, [contractId, month]);

  async function useDays() {
    const person = people.find((item) => item.id === Number(employeeId));
    if (!person) {
      setError("Choose the worker.");
      return;
    }
    const response = await api(`/api/attendance-days?month=${month}&name=${encodeURIComponent(person.name)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "Attendance days could not be read.");
      return;
    }
    setDaysWorked(String(body.days));
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    const response = await api("/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, month, employeeId, siteId, daysWorked }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The deployment could not be saved.");
      return;
    }
    setDaysWorked("");
    load();
  }

  async function remove(id) {
    const response = await api(`/api/deployments/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("That deployment could not be removed.");
      return;
    }
    load();
  }

  const days = rows.reduce((sum, row) => sum + Number(row.daysWorked || 0), 0);

  return (
    <section className="sheet gap">
      <h2>Deployment</h2>
      <form className="book-form" onSubmit={save}>
        <label>
          Month<span className="req"> *</span>
          <input required type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label>
          Worker<span className="req"> *</span>
          <select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">Select</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label>
          Site<span className="req"> *</span>
          <select required value={siteId} onChange={(event) => setSiteId(event.target.value)}>
            <option value="">Select</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </label>
        <label>
          Days<span className="req"> *</span>
          <input required inputMode="decimal" value={daysWorked} onChange={(event) => setDaysWorked(event.target.value)} />
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">Add deployment</button>
          <button type="button" className="text-btn" onClick={useDays}>Use attendance days</button>
        </div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      <div className="lines">
        <div><span>Man-days this month</span><strong>{days}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Worker</th>
            <th>Site</th>
            <th className="num">Days</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.employeeName}</td>
              <td>{row.siteName}</td>
              <td className="num">{row.daysWorked ?? ""}</td>
              <td><button type="button" className="text-btn" onClick={() => remove(row.id)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function WorkRegister({ contractId }) {
  const empty = {
    measurementBookNo: "", lcc: "", billNo: "", startDate: "", completionDate: "", grossAmount: "", netAmount: "",
    voucherNo: "", bankReceivedDate: "", performanceGuarantee: "", earnestMoney: "", labourWelfareCess: "",
    gstAmount: "", incomeTax: "", securityDeposit: "", esiPf: "", waterCharge: "", otherWithheld: "", remarks: "",
  };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api(`/api/work-register/${contractId}`)
      .then((response) => response.json())
      .then((row) => setForm(row ? { ...empty, ...row } : empty))
      .catch(() => setError("The work register could not be loaded."));
  }, [contractId]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    const response = await api(`/api/work-register/${contractId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The work register could not be saved.");
      return;
    }
    setError("");
    setNotice("Work register saved.");
  }

  const fields = [
    ["Measurement book no.", "measurementBookNo"],
    ["LCC", "lcc"],
    ["Bill no.", "billNo"],
    ["Start date", "startDate", "date"],
    ["Completion date", "completionDate", "date"],
    ["Gross amount", "grossAmount"],
    ["Net amount", "netAmount"],
    ["Voucher no.", "voucherNo"],
    ["Bank received date", "bankReceivedDate", "date"],
    ["Performance guarantee", "performanceGuarantee"],
    ["Earnest money", "earnestMoney"],
    ["Labour welfare cess", "labourWelfareCess"],
    ["GST", "gstAmount"],
    ["Income tax", "incomeTax"],
    ["Security deposit", "securityDeposit"],
    ["ESI / PF", "esiPf"],
    ["Water charge", "waterCharge"],
    ["Other withheld", "otherWithheld"],
  ];

  return (
    <section className="sheet gap">
      <h2>Work register</h2>
      <form className="book-form" onSubmit={save}>
        {fields.map(([label, key, type]) => (
          <label key={key}>
            {label}
            <input type={type || "text"} value={form[key] ?? ""} onChange={(event) => setField(key, event.target.value)} />
          </label>
        ))}
        <label className="span-2">
          Remarks
          <input value={form.remarks || ""} onChange={(event) => setField("remarks", event.target.value)} />
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">Save register</button>
        </div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      {notice ? <p className="book-note">{notice}</p> : null}
    </section>
  );
}

export function Crm() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(blankContract());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const [response, departmentResponse] = await Promise.all([api("/api/contracts"), api("/api/departments")]);
    if (!response.ok || !departmentResponse.ok) {
      setError("The contract orders could not be loaded.");
      return;
    }
    const data = await response.json();
    setRows(data);
    setDepartments(await departmentResponse.json());
    setError("");
    return data;
  }

  useEffect(() => {
    load().then((data) => {
      if (data?.[0]) {
        setEditingId(data[0].id);
        setForm(asForm(data[0]));
      }
    });
  }, []);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    const response = await api(editingId ? `/api/contracts/${editingId}` : "/api/contracts", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The contract order could not be saved.");
      return;
    }
    const data = await load();
    const saved = data?.find((row) => row.id === (editingId || body.id)) || data?.[0];
    if (saved) {
      setEditingId(saved.id);
      setForm(asForm(saved));
    }
  }

  return (
    <>
    <section className="sheet">
      <h2>Contract order</h2>
      <form className="book-form" onSubmit={save}>
        <p className="form-section">Client and type</p>
        <label>
          Department
          <select
            value={departments.find((item) => item.clientName === form.clientName && item.name === form.departmentName)?.id || (form.departmentName ? "current" : "")}
            onChange={(event) => {
              const chosen = departments.find((item) => String(item.id) === event.target.value);
              if (!chosen) return;
              setField("clientName", chosen.clientName);
              setField("departmentName", chosen.name);
            }}
          >
            <option value="">Select</option>
            {form.departmentName && !departments.some((item) => item.clientName === form.clientName && item.name === form.departmentName) ? (
              <option value="current">{form.clientName} — {form.departmentName}</option>
            ) : null}
            {departments.map((item) => (
              <option key={item.id} value={item.id}>{item.clientName} — {item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Contract type
          <select value={form.contractType} onChange={(event) => setField("contractType", event.target.value)}>
            <option value="A">A — Manpower</option>
            <option value="B">B — Work</option>
            <option value="C">C — Office</option>
          </select>
        </label>
        <label>
          Next step
          <input readOnly value={nextStep(form.contractType)} />
        </label>
        <Field wide label="Work name" value={form.workName} onChange={(value) => setField("workName", value)} />
        <Field label="Agreement / work order no." value={form.agreementNo} onChange={(value) => setField("agreementNo", value)} />
        <Field label="Measurement book no." value={form.measurementBookNo} onChange={(value) => setField("measurementBookNo", value)} />
        <Field label="Bill number" value={form.billNumber} onChange={(value) => setField("billNumber", value)} />
        <p className="form-section">Tender, dates, and amount</p>
        <Field label="Tender opening" type="date" value={form.tenderOpening} onChange={(value) => setField("tenderOpening", value)} />
        <Field label="Tender amount" value={form.tenderAmount} onChange={(value) => setField("tenderAmount", value)} />
        <Field label="Estimate cost" value={form.estimateCost} onChange={(value) => setField("estimateCost", value)} />
        <Field label="Start as per agreement" type="date" value={form.startAgreement} onChange={(value) => setField("startAgreement", value)} />
        <Field label="Start as per actual" type="date" value={form.startActual} onChange={(value) => setField("startActual", value)} />
        <Field label="Completion as per agreement" type="date" value={form.completionAgreement} onChange={(value) => setField("completionAgreement", value)} />
        <Field label="Completion as per actual" type="date" value={form.completionActual} onChange={(value) => setField("completionActual", value)} />
        <Field label="Gross amount" value={form.grossAmount} onChange={(value) => setField("grossAmount", value)} />
        <Field label="Net amount" value={form.netAmount} onChange={(value) => setField("netAmount", value)} />
        <Field label="Voucher number" value={form.voucherNumber} onChange={(value) => setField("voucherNumber", value)} />
        <p className="form-section">Recoveries</p>
        <Field label="Earnest money" value={form.earnestMoney} onChange={(value) => setField("earnestMoney", value)} />
        <Field label="Performance guarantee" value={form.performanceGuarantee} onChange={(value) => setField("performanceGuarantee", value)} />
        <Field label="Security deposit" value={form.securityDeposit} onChange={(value) => setField("securityDeposit", value)} />
        <Field label="Income tax" value={form.incomeTax} onChange={(value) => setField("incomeTax", value)} />
        <Field label="GST" value={form.gstRecovery} onChange={(value) => setField("gstRecovery", value)} />
        <Field label="Education cess" value={form.educationCess} onChange={(value) => setField("educationCess", value)} />
        <Field label="Labour welfare cess" value={form.labourWelfareCess} onChange={(value) => setField("labourWelfareCess", value)} />
        <Field label="Water charge" value={form.waterCharge} onChange={(value) => setField("waterCharge", value)} />
        <Field label="Withheld" value={form.withheld} onChange={(value) => setField("withheld", value)} />
        <Field label="Other" value={form.otherRecovery} onChange={(value) => setField("otherRecovery", value)} />
        <Field label="ESI" value={form.esiAmount} onChange={(value) => setField("esiAmount", value)} />
        <Field label="PF" value={form.pfAmount} onChange={(value) => setField("pfAmount", value)} />
        <p className="form-section">Bank</p>
        <Field label="Bank received date" type="date" value={form.bankReceivedDate} onChange={(value) => setField("bankReceivedDate", value)} />
        <Field label="Reimburse date" type="date" value={form.reimburseDate} onChange={(value) => setField("reimburseDate", value)} />
        <label className="span-2">
          Remarks
          <input value={form.remarks} onChange={(event) => setField("remarks", event.target.value)} />
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">{editingId ? "Save order" : "Add order"}</button>
          <button type="button" className="text-btn" onClick={() => { setEditingId(null); setForm(blankContract()); }}>
            New order
          </button>
        </div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Agreement</th>
            <th>Client</th>
            <th>Department</th>
            <th>Type</th>
            <th className="num">Gross amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.id === editingId ? "selected" : ""}>
              <td>
                <button type="button" className="row-btn" onClick={() => { setEditingId(row.id); setForm(asForm(row)); }}>{row.agreementNo}</button>
              </td>
              <td>{row.clientName}</td>
              <td>{row.departmentName}</td>
              <td>{typeName(row.contractType)}</td>
              <td className="num">{row.grossAmount == null ? "" : inr(row.grossAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
    {editingId && form.contractType === "A" ? <Deployment contractId={editingId} /> : null}
    {editingId && form.contractType === "B" ? <WorkRegister contractId={editingId} /> : null}
    </>
  );
}

function TdsAndReceipt({ invoice, onSaved }) {
  const [tdsGst, setTdsGst] = useState(invoice.tdsGst ?? "");
  const [tdsIncomeTax, setTdsIncomeTax] = useState(invoice.tdsIncomeTax ?? "");
  const [receivedOn, setReceivedOn] = useState("");
  const [amount, setAmount] = useState("");
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setTdsGst(invoice.tdsGst ?? "");
    setTdsIncomeTax(invoice.tdsIncomeTax ?? "");
    api(`/api/receipts?invoiceId=${invoice.id}`).then((response) => response.json()).then(setReceipts).catch(() => setReceipts([]));
  }, [invoice.id, invoice.tdsGst, invoice.tdsIncomeTax]);

  async function saveTds(event) {
    event.preventDefault();
    const response = await api(`/api/invoices/${invoice.id}/tds`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tdsGst, tdsIncomeTax }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "TDS could not be saved.");
      return;
    }
    setError("");
    onSaved();
  }

  async function saveReceipt(event) {
    event.preventDefault();
    const response = await api("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id, receivedOn, amount }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The receipt could not be saved.");
      return;
    }
    setAmount("");
    setReceivedOn("");
    setError("");
    const list = await api(`/api/receipts?invoiceId=${invoice.id}`);
    if (list.ok) setReceipts(await list.json());
  }

  return (
    <>
      <form className="book-form" onSubmit={saveTds}>
        <p className="form-section">TDS typed from the client paper</p>
        <label>
          TDS on GST
          <input value={tdsGst} onChange={(event) => setTdsGst(event.target.value)} />
        </label>
        <label>
          TDS on income tax
          <input value={tdsIncomeTax} onChange={(event) => setTdsIncomeTax(event.target.value)} />
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">Save TDS</button>
        </div>
      </form>
      <form className="book-form" onSubmit={saveReceipt}>
        <p className="form-section">Money received</p>
        <label>
          Date
          <input type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
        </label>
        <label>
          Amount
          <input value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">Add receipt</button>
        </div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      {receipts.map((row) => (
        <div className="lines" key={row.id}><div><span>{row.receivedOn || "Receipt"}</span><strong>{inr(row.amount)}</strong></div></div>
      ))}
    </>
  );
}

function Returns() {
  const [month, setMonth] = useState("");
  const [kind, setKind] = useState("GST");
  const [status, setStatus] = useState("Pending");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    const response = await api("/api/returns");
    if (response.ok) setRows(await response.json());
  }

  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    const response = await api("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, kind, status }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The return could not be saved.");
      return;
    }
    setError("");
    load();
  }

  return (
    <section className="sheet gap">
      <h2>Returns</h2>
      <form className="book-form" onSubmit={save}>
        <label>
          Month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label>
          Return
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option>PF</option>
            <option>ESI</option>
            <option>GST</option>
            <option>TDS</option>
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>Pending</option>
            <option>Filed</option>
          </select>
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">Save return</button>
        </div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      <table>
        <thead><tr><th>Month</th><th>Return</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}><td>{row.month}</td><td>{row.kind}</td><td>{row.status}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Accounts() {
  const [card, setCard] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoiceId, setInvoiceId] = useState(null);
  const [line, setLine] = useState({ trade: "", skill: "Skilled", manDays: "" });
  const [error, setError] = useState("");

  async function load() {
    const [cardResponse, invoiceResponse] = await Promise.all([api("/api/rate-card"), api("/api/invoices")]);
    if (!cardResponse.ok || !invoiceResponse.ok) {
      setError("The rate card and bill could not be loaded.");
      return;
    }
    const invoiceRows = await invoiceResponse.json();
    setCard(await cardResponse.json());
    setInvoices(invoiceRows);
    setInvoiceId((current) => current || invoiceRows[0]?.id || null);
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  const invoice = invoices.find((item) => item.id === invoiceId) || invoices[0];

  async function addLine(event) {
    event.preventDefault();
    if (!invoice) return;
    const response = await api(`/api/invoices/${invoice.id}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(line),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The bill line could not be saved.");
      return;
    }
    setLine({ trade: "", skill: "Skilled", manDays: "" });
    load();
  }

  async function useDeploymentDays() {
    if (!invoice?.contractId || !invoice.periodFrom) {
      setError("This bill has no contract period.");
      return;
    }
    const month = invoice.periodFrom.slice(0, 7);
    const response = await api(`/api/deployments?contractId=${invoice.contractId}&month=${month}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "Deployment days could not be read.");
      return;
    }
    if (!body.length) {
      setError("No deployment is stored for this bill's month.");
      return;
    }
    const days = body.reduce((sum, row) => sum + Number(row.daysWorked || 0), 0);
    setLine((current) => ({ ...current, manDays: String(days) }));
    setError("");
  }

  async function downloadInvoice(format) {
    if (!invoice) return;
    const response = await api(`/api/invoices/${invoice.id}/export?format=${format}`);
    if (!response.ok) {
      setError("The bill could not be prepared.");
      return;
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const extension = format === "word" ? "docx" : format === "excel" ? "xlsx" : "pdf";
    link.download = `invoice-${invoice.invoiceNo}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <section className="sheet">
        <h2>Rate card</h2>
        <table>
          <thead>
            <tr>
              <th>Skill</th>
              <th>Trades</th>
              <th className="num">Gross daily rate</th>
            </tr>
          </thead>
          <tbody>
            {card.map((row) => (
              <tr key={row.skill}>
                <td>{row.skill}</td>
                <td>{row.trades}</td>
                <td className="num">{inr(row.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {invoice ? (
        <section className="sheet gap">
          <div className="sheet-title">
            <h2>Invoice {invoice.invoiceNo}</h2>
            <div className="download">
              <span>Download</span>
              <button type="button" onClick={() => downloadInvoice("pdf")}>PDF</button>
              <button type="button" onClick={() => downloadInvoice("word")}>Word</button>
              <button type="button" onClick={() => downloadInvoice("excel")}>Excel</button>
            </div>
          </div>
          <div className="lines">
            <div><span>Order</span><strong>{invoice.agreementNo}</strong></div>
            <div><span>Buyer</span><strong>{invoice.buyerName}</strong></div>
            <div><span>Department</span><strong>{invoice.departmentName}</strong></div>
            <div><span>Period</span><strong>{invoice.periodFrom} to {invoice.periodTo}</strong></div>
            <div><span>Man-days</span><strong>{invoice.manDays}</strong></div>
            <div><span>Line total</span><strong>{inr(invoice.lineTotal)}</strong></div>
            <div><span>Basic</span><strong>{inr(invoice.basicAmount)}</strong></div>
            <div><span>CGST</span><strong>{inr(invoice.cgst)}</strong></div>
            <div><span>SGST</span><strong>{inr(invoice.sgst)}</strong></div>
            <div><span>Round off</span><strong>{inr(invoice.roundOff)}</strong></div>
            <div><span>Say total</span><strong>{inr(invoice.sayTotal)}</strong></div>
            <div><span>TDS on GST</span><strong>{invoice.tdsGst == null ? "Not entered" : inr(invoice.tdsGst)}</strong></div>
            <div><span>TDS on income tax</span><strong>{invoice.tdsIncomeTax == null ? "Not entered" : inr(invoice.tdsIncomeTax)}</strong></div>
          </div>
          <form className="book-form" onSubmit={addLine}>
            <p className="form-section">Man-days by trade</p>
            <label>
              Trade
              <input value={line.trade} onChange={(event) => setLine({ ...line, trade: event.target.value })} />
            </label>
            <label>
              Skill
              <select value={line.skill} onChange={(event) => setLine({ ...line, skill: event.target.value })}>
                {card.map((row) => <option key={row.skill}>{row.skill}</option>)}
              </select>
            </label>
            <label>
              Man-days
              <input inputMode="decimal" value={line.manDays} onChange={(event) => setLine({ ...line, manDays: event.target.value })} />
            </label>
            <div className="book-actions">
              <button className="signin" type="submit">Add line</button>
              <button type="button" className="text-btn" onClick={useDeploymentDays}>Use deployment days</button>
            </div>
          </form>
          {error ? <p className="book-error">{error}</p> : null}
          <table>
            <thead>
              <tr>
                <th>Trade</th>
                <th>Skill</th>
                <th className="num">Man-days</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((row) => (
                <tr key={row.id}>
                  <td>{row.trade}</td>
                  <td>{row.skill}</td>
                  <td className="num">{row.manDays}</td>
                  <td className="num">{inr(row.rate)}</td>
                  <td className="num">{inr(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TdsAndReceipt invoice={invoice} onSaved={load} />
        </section>
      ) : null}
      <Returns />
    </>
  );
}

export function Finance() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/ledger")
      .then((response) => response.json())
      .then(setRows)
      .catch(() => setError("The ledger could not be loaded."));
  }, []);

  const sum = (kind) => rows.filter((row) => row.kind === kind).reduce((total, row) => total + row.amount, 0);
  const label = {
    disbursement: "Disbursement",
    client_bill: "Client bill",
    expense: "Procurement",
    tds_gst: "TDS on GST",
    tds_income_tax: "TDS on income tax",
    receipt: "Money received",
    office: "Office expense",
  };

  return (
    <>
      <section className="sheet">
        <h2>Ledger</h2>
        {error ? <p className="book-error">{error}</p> : null}
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>Entry</th>
              <th>Reference</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{label[row.kind] || row.kind}</td>
                <td>{row.narration}</td>
                <td>{row.sourceRef}</td>
                <td className="num">{inr(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="sheet gap">
        <h2>Report</h2>
        <div className="lines">
          <div><span>Client bills</span><strong>{inr(sum("client_bill"))}</strong></div>
          <div><span>Salary paid</span><strong>{inr(sum("disbursement"))}</strong></div>
          <div><span>Material</span><strong>{inr(sum("expense"))}</strong></div>
          <div><span>Money received</span><strong>{inr(sum("receipt"))}</strong></div>
          <div><span>Office expenses</span><strong>{inr(sum("office"))}</strong></div>
        </div>
      </section>
      <OfficeExpenses />
    </>
  );
}

function OfficeExpenses() {
  const [rows, setRows] = useState([]);
  const [narration, setNarration] = useState("");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await api("/api/expenses");
    if (response.ok) setRows(await response.json());
  }

  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    const response = await api("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ narration, amount, spentOn }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The expense could not be saved.");
      return;
    }
    setNarration("");
    setAmount("");
    setSpentOn("");
    setError("");
    load();
  }

  return (
    <section className="sheet gap">
      <h2>Office expense</h2>
      <form className="book-form" onSubmit={save}>
        <label>Date<span className="req"> *</span><input required type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} /></label>
        <label>What for<span className="req"> *</span><input required value={narration} onChange={(event) => setNarration(event.target.value)} /></label>
        <label>Amount<span className="req"> *</span><input required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <div className="book-actions"><button className="signin" type="submit">Add expense</button></div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      <table>
        <thead><tr><th>Date</th><th>What for</th><th className="num">Amount</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}><td>{row.spentOn}</td><td>{row.narration}</td><td className="num">{inr(row.amount)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PurchaseOrders({ works }) {
  const [rows, setRows] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({ vendorId: "", contractId: "", orderDate: "", itemName: "", quantity: "", amount: "" });
  const [error, setError] = useState("");

  async function load() {
    const [orders, vendorRows] = await Promise.all([api("/api/purchase-orders"), api("/api/vendors")]);
    if (orders.ok) setRows(await orders.json());
    if (vendorRows.ok) setVendors(await vendorRows.json());
  }

  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    const response = await api("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The purchase order could not be saved.");
      return;
    }
    setForm({ vendorId: "", contractId: "", orderDate: "", itemName: "", quantity: "", amount: "" });
    setError("");
    load();
  }

  async function receive(id) {
    const now = new Date();
    const receivedOn = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const response = await api(`/api/purchase-orders/${id}/receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receivedOn }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The goods could not be marked received.");
      return;
    }
    setError("");
    load();
  }

  return (
    <section className="sheet gap">
      <h2>Purchase order</h2>
      <form className="book-form" onSubmit={save}>
        <label>
          Vendor<span className="req"> *</span>
          <select required value={form.vendorId} onChange={(event) => setForm({ ...form, vendorId: event.target.value })}>
            <option value="">Select</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </select>
        </label>
        <label>
          Works contract<span className="req"> *</span>
          <select required value={form.contractId} onChange={(event) => setForm({ ...form, contractId: event.target.value })}>
            <option value="">Select work</option>
            {works.map((order) => <option key={order.id} value={order.id}>{order.agreementNo}</option>)}
          </select>
        </label>
        <label>Date<span className="req"> *</span><input required type="date" value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} /></label>
        <label>Item<span className="req"> *</span><input required value={form.itemName} onChange={(event) => setForm({ ...form, itemName: event.target.value })} /></label>
        <label>Quantity<span className="req"> *</span><input required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label>Amount<span className="req"> *</span><input required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
        <div className="book-actions"><button className="signin" type="submit">Add order</button></div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      <table>
        <thead><tr><th>Vendor</th><th>Item</th><th>Work</th><th className="num">Amount</th><th></th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.vendorName}</td>
              <td>{row.lines.map((line) => line.itemName).join(", ")}</td>
              <td>{row.agreementNo || "Not tagged"}</td>
              <td className="num">{inr(row.lines.reduce((sum, line) => sum + line.amount, 0))}</td>
              <td>{row.received ? "Received" : <button type="button" className="text-btn" onClick={() => receive(row.id)}>Receive</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Procurement() {
  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ itemName: "", vendorName: "", amount: "", contractId: "" });
  const [error, setError] = useState("");

  async function load() {
    const [purchaseResponse, orderResponse] = await Promise.all([api("/api/purchases"), api("/api/contracts")]);
    if (!purchaseResponse.ok || !orderResponse.ok) {
      setError("Purchases could not be loaded.");
      return;
    }
    setRows(await purchaseResponse.json());
    setOrders(await orderResponse.json());
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  const works = orders.filter((order) => order.contractType === "B");

  async function save(event) {
    event.preventDefault();
    const response = await api("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The purchase could not be saved.");
      return;
    }
    setForm({ itemName: "", vendorName: "", amount: "", contractId: "" });
    load();
  }

  async function remove(id) {
    const response = await api(`/api/purchases/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("That purchase could not be removed.");
      return;
    }
    load();
  }

  return (
    <>
      <section className="sheet">
        <h2>Material purchase</h2>
        <form className="book-form" onSubmit={save}>
          <label>
            Item<span className="req"> *</span>
            <input required value={form.itemName} onChange={(event) => setForm({ ...form, itemName: event.target.value })} />
          </label>
          <label>
            Vendor<span className="req"> *</span>
            <input required value={form.vendorName} onChange={(event) => setForm({ ...form, vendorName: event.target.value })} />
          </label>
          <label>
            Amount<span className="req"> *</span>
            <input required inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </label>
          <label>
            Works contract<span className="req"> *</span>
            <select required value={form.contractId} onChange={(event) => setForm({ ...form, contractId: event.target.value })}>
              <option value="">Select work</option>
              {works.map((order) => (
                <option key={order.id} value={order.id}>{order.agreementNo}</option>
              ))}
            </select>
          </label>
          <div className="book-actions">
            <button className="signin" type="submit">Add purchase</button>
          </div>
        </form>
        {error ? <p className="book-error">{error}</p> : null}
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Vendor</th>
              <th>Work</th>
              <th className="num">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.itemName}</td>
                <td>{row.vendorName}</td>
                <td>{row.agreementNo || "Not tagged"}</td>
                <td className="num">{inr(row.amount)}</td>
                <td><button type="button" className="text-btn" onClick={() => remove(row.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="sheet gap">
        <h2>Bill preparation</h2>
        {works.length ? works.map((order) => {
          const tagged = rows.filter((row) => row.contractId === order.id);
          const total = tagged.reduce((sum, row) => sum + row.amount, 0);
          return (
            <div key={order.id}>
              <p className="form-section">{order.agreementNo}</p>
              <div className="lines">
                <div><span>Material purchase</span><strong>{inr(total)}</strong></div>
              </div>
            </div>
          );
        }) : null}
      </section>
      <PurchaseOrders works={works} />
    </>
  );
}
