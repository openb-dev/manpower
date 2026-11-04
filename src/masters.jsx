import { useEffect, useState } from "react";
import { api } from "./api.js";

function NameList({ title, path, label, withSkill = false }) {
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [skill, setSkill] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await api(path);
    if (!response.ok) {
      setError(`${title} could not be loaded.`);
      return;
    }
    setRows(await response.json());
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  async function add(event) {
    event.preventDefault();
    const response = await api(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withSkill ? { name, skill } : { name }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || `That ${label} could not be saved.`);
      return;
    }
    setName("");
    setSkill("");
    load();
  }

  async function remove(id) {
    const response = await api(`${path}/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(`That ${label} could not be removed.`);
      return;
    }
    load();
  }

  return (
    <section className="sheet gap">
      <h2>{title}</h2>
      <form className="book-form" onSubmit={add}>
        <label>
          Name<span className="req"> *</span>
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {withSkill ? (
          <label>
            Skill<span className="req"> *</span>
            <select required value={skill} onChange={(event) => setSkill(event.target.value)}>
              <option value="">Select</option>
              <option>Skilled</option>
              <option>Semi-skilled</option>
              <option>Unskilled</option>
            </select>
          </label>
        ) : null}
        <div className="book-actions">
          <button className="signin" type="submit">Add</button>
        </div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            {withSkill ? <th>Skill</th> : null}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              {withSkill ? <td>{row.skill}</td> : null}
              <td><button type="button" className="text-btn" onClick={() => remove(row.id)}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Departments() {
  const [rows, setRows] = useState([]);
  const [clientName, setClientName] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await api("/api/departments");
    if (!response.ok) {
      setError("Departments could not be loaded.");
      return;
    }
    setRows(await response.json());
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  async function add(event) {
    event.preventDefault();
    const response = await api("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName, name }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "That department could not be saved.");
      return;
    }
    setClientName("");
    setName("");
    load();
  }

  return (
    <section className="sheet gap">
      <h2>Departments</h2>
      <form className="book-form" onSubmit={add}>
        <label>
          Client<span className="req"> *</span>
          <input required value={clientName} onChange={(event) => setClientName(event.target.value)} />
        </label>
        <label>
          Department<span className="req"> *</span>
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">Add</button>
        </div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Department</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.clientName}</td>
              <td>{row.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function MasterLists() {
  return (
    <>
      <NameList title="Sites" path="/api/sites" label="site" />
      <Departments />
      <NameList title="Designations" path="/api/designations" label="designation" withSkill />
      <NameList title="Vendors" path="/api/vendors" label="vendor" />
      <Licences />
      <AuditList />
    </>
  );
}

function Licences() {
  const [rows, setRows] = useState([]);
  const [kind, setKind] = useState("PSARA");
  const [licenceNo, setLicenceNo] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await api("/api/licences");
    if (response.ok) setRows(await response.json());
  }

  useEffect(() => { load(); }, []);

  async function add(event) {
    event.preventDefault();
    const response = await api("/api/licences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, licenceNo, issuedOn, expiresOn }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The licence could not be saved.");
      return;
    }
    setLicenceNo("");
    setError("");
    load();
  }

  async function backup() {
    const response = await api("/api/backup");
    if (!response.ok) {
      setError("The backup could not be downloaded.");
      return;
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nk-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className="sheet gap">
      <h2>Licences</h2>
      <form className="book-form" onSubmit={add}>
        <label>Type<span className="req"> *</span><input required value={kind} onChange={(event) => setKind(event.target.value)} /></label>
        <label>Number<span className="req"> *</span><input required value={licenceNo} onChange={(event) => setLicenceNo(event.target.value)} /></label>
        <label>Issued<span className="req"> *</span><input required type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} /></label>
        <label>Expires<span className="req"> *</span><input required type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></label>
        <div className="book-actions"><button className="signin" type="submit">Add licence</button></div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      <table>
        <thead><tr><th>Type</th><th>Number</th><th>Issued</th><th>Expires</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}><td>{row.kind}</td><td>{row.licenceNo}</td><td>{row.issuedOn}</td><td>{row.expiresOn}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="book-actions">
        <button type="button" className="signin" onClick={backup}>Download backup</button>
      </div>
    </section>
  );
}

function AuditList() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api("/api/audit").then((response) => response.json()).then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <section className="sheet gap">
      <h2>Audit</h2>
      <table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}><td>{row.at}</td><td>{row.who}</td><td>{row.action}</td><td>{row.what}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
