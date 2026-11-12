import { useEffect, useState } from "react";
import { api, setCompanyId, setToken } from "./api.js";
import { inr } from "./data.js";
import { ApplicationFields, blankFamily } from "./ApplicationForm.jsx";
import { personError } from "../server/data/required.js";
import { Accounts, Crm, Finance, Procurement } from "./modules.jsx";
import { MasterLists } from "./masters.jsx";
import { ApplicantBook, Apply } from "./Apply.jsx";

const NAV = [
  ["home", "Dashboard"],
  ["hrm", "HRM"],
  ["crm", "CRM"],
  ["accounts", "Accounts"],
  ["finance", "Finance"],
  ["procurement", "Procurement"],
  ["masters", "Masters"],
];

const OPEN = {
  home: "home",
  overview: "overview",
  companies: "companies",
  hrm: "employees",
  crm: "crm",
  accounts: "accounts",
  finance: "finance",
  procurement: "procurement",
  masters: "masters",
};

const PAGE_META = {
  home: "Dashboard",
  employees: "Employee book",
  applicants: "Applicants",
  attendance: "Attendance",
  crm: "Contracts",
  accounts: "Bills",
  procurement: "Purchases",
  finance: "Ledger",
  masters: "Masters",
  overview: "All companies",
  companies: "Company registration",
};

const ROLE_LABEL = {
  super_admin: "Super admin",
  admin: "Company Admin",
  accounts: "Accounts",
  hr: "HR",
  viewer: "Viewer",
};

function moduleOf(page) {
  if (page === "employees" || page === "attendance" || page === "applicants") return "hrm";
  return page;
}

const USER_KEY = "nk_auth_user";
const COMPANY_KEY = "nk_company";
const PAGE_KEY = "nk_page";

function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function initialPage(savedUser, savedCompany) {
  try {
    const saved = localStorage.getItem(PAGE_KEY);
    if (saved) {
      if (savedUser?.role === "super_admin" && !savedCompany && saved !== "overview" && saved !== "companies") {
        return "overview";
      }
      return saved;
    }
  } catch {}
  return savedUser?.role === "super_admin" && !savedCompany ? "overview" : "home";
}

export default function App() {
  const [user, setUser] = useState(() => readStored(USER_KEY));
  const [company, setCompany] = useState(() => readStored(COMPANY_KEY));
  const [rejected, setRejected] = useState(false);
  const [page, setPage] = useState(() => initialPage(readStored(USER_KEY), readStored(COMPANY_KEY)));

  useEffect(() => {
    if (user && page) {
      try {
        localStorage.setItem(PAGE_KEY, page);
      } catch {}
    }
  }, [page, user]);

  useEffect(() => {
    if (user?.role === "super_admin" && !company && page !== "overview" && page !== "companies") {
      setPage("overview");
    }
  }, [user, company, page]);

  useEffect(() => {
    if (!user) return;
    api("/api/session")
      .then(async (res) => {
        if (!res.ok) {
          signOut();
          return;
        }
        const fresh = await res.json().catch(() => null);
        if (!fresh) return;
        setUser((prev) => {
          if (!prev) return prev;
          const merged = { ...prev, ...fresh };
          writeStored(USER_KEY, merged);
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      signOut();
    }
    window.addEventListener("nk:unauthorized", onUnauthorized);
    return () => window.removeEventListener("nk:unauthorized", onUnauthorized);
  }, []);

  if (window.location.pathname === "/apply" || window.location.pathname === "/apply/") return <Apply />;

  function signOut() {
    api("/api/logout", { method: "POST" }).catch(() => {});
    setToken("");
    setCompanyId("");
    writeStored(USER_KEY, null);
    writeStored(COMPANY_KEY, null);
    try {
      localStorage.removeItem(PAGE_KEY);
    } catch {}
    setCompany(null);
    setUser(null);
    setPage("home");
  }

  if (!user) {
    return (
      <Login
        rejected={rejected}
        onSuccess={(account) => {
          setRejected(false);
          setUser(account);
          writeStored(USER_KEY, account);

          if (account.role === "super_admin") {
            setCompany(null);
            setCompanyId("");
            writeStored(COMPANY_KEY, null);
            setPage("overview");
            try {
              localStorage.setItem(PAGE_KEY, "overview");
            } catch {}
          } else {
            const firm = account.company || null;
            setCompany(firm);
            if (firm) {
              setCompanyId(firm.id);
              writeStored(COMPANY_KEY, firm);
            } else {
              setCompanyId("");
              writeStored(COMPANY_KEY, null);
            }
            setPage("home");
            try {
              localStorage.setItem(PAGE_KEY, "home");
            } catch {}
          }
        }}
        onReject={() => setRejected(true)}
        onBack={() => setRejected(false)}
      />
    );
  }

  function openCompany(firm) {
    setCompanyId(firm.id);
    setCompany(firm);
    writeStored(COMPANY_KEY, firm);
    setPage("home");
    try {
      localStorage.setItem(PAGE_KEY, "home");
    } catch {}
  }

  function exitToOverview() {
    setCompanyId("");
    setCompany(null);
    writeStored(COMPANY_KEY, null);
    setPage("overview");
    try {
      localStorage.setItem(PAGE_KEY, "overview");
    } catch {}
  }

  if (!company && user.role !== "super_admin") {
    if (user.company) {
      setCompany(user.company);
      setCompanyId(user.company.id);
      writeStored(COMPANY_KEY, user.company);
      return null;
    }
    return (
      <div className="gate">
        <header className="bar">
          <strong>Manpower</strong>
        </header>
        <div className="gate-body">
          <section className="sheet gate-sheet">
            <h2>No company assigned</h2>
            <div className="gate-fields">
              <p className="gate-note">This account is not associated with any registered company. Please sign in with your company credentials.</p>
              <button className="signin" type="button" onClick={signOut}>Sign out</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const title = PAGE_META[page];

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">{company ? company.shortName : (user.role === "super_admin" ? "Super admin" : "Manpower")}</div>
        <nav>
          {(company
            ? NAV.filter(([id]) => id === "home" || user.modules?.includes(id))
            : [["overview", "All companies"]]
          ).concat(user.role === "super_admin" ? [["companies", "Company registration"]] : []).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={moduleOf(page) === id ? "side-item active" : "side-item"}
              onClick={() => setPage(OPEN[id] || id)}
            >
              <NavIcon name={id === "hrm" ? "employees" : id === "overview" ? "home" : id === "companies" ? "masters" : id} />
              {label}
            </button>
          ))}
        </nav>
        <div className="side-user">
          <span className="avatar" aria-hidden="true">{(user.name || "N").slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <span>{ROLE_LABEL[user.role] || user.role}</span>
          </div>
        </div>
        {company && user.role === "super_admin" && (
          <button type="button" className="side-out" onClick={exitToOverview}>
            All companies
          </button>
        )}
        <button type="button" className="side-out" onClick={signOut}>
          Sign out
        </button>
      </aside>
      <div className="main">
        <header className="crumb">
          <h1>{title}</h1>
          <p>{company ? `${company.shortName} / ${title}` : title}</p>
        </header>
        <main className="main-body">
          {page === "overview" && <AllCompanies onOpen={openCompany} />}
          {page === "companies" && <CompanyRegistration onOpen={openCompany} />}
          {page === "home" && company && <Dashboard modules={user.modules || []} onOpen={(id) => setPage(OPEN[id])} />}
          {(page === "employees" || page === "attendance" || page === "applicants") && (
            <div className="page-tabs">
              <button type="button" className={page === "employees" ? "active" : ""} onClick={() => setPage("employees")}>Employee book</button>
              {(user.role === "super_admin" || user.role === "admin" || user.role === "hr") && (
                <button type="button" className={page === "applicants" ? "active" : ""} onClick={() => setPage("applicants")}>Applicants</button>
              )}
              <button type="button" className={page === "attendance" ? "active" : ""} onClick={() => setPage("attendance")}>Attendance</button>
            </div>
          )}
          {page === "employees" && <EmployeeBook />}
          {page === "applicants" && (user.role === "super_admin" || user.role === "admin" || user.role === "hr") && (
            <ApplicantBook onOpenEmployeeBook={() => setPage("employees")} />
          )}
          {page === "attendance" && <Hrm />}
          {page === "masters" && <Masters />}
          {page === "crm" && <Crm />}
          {page === "accounts" && <Accounts />}
          {page === "finance" && <Finance />}
          {page === "procurement" && <Procurement />}
        </main>
      </div>
    </div>
  );
}

function NavIcon({ name }) {
  const paths = {
    home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z",
    employees: "M6 4h9l3 3v13H6zM9 4v4h6M9 12h6M9 16h4",
    hrm: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4 18c0-2.2 1.8-4 4-4s4 1.8 4 4M13 18c.2-1.6 1.4-3 3-3 1.8 0 3.2 1.5 3.4 3.2",
    crm: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4",
    accounts: "M5 6h14v12H5zM5 10h14M9 14h2",
    finance: "M5 18V8m4 10V6m4 12v-7m4 7V4",
    procurement: "M4 8h16l-1.5 10h-13zM8 8V6a4 4 0 0 1 8 0v2",
    masters: "M4 7h16M4 12h16M4 17h10",
  };
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Dashboard({ modules, onOpen }) {
  const [home, setHome] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/home")
      .then((response) => response.json())
      .then(setHome)
      .catch(() => setError("The dashboard could not be loaded. Start the API on port 3001."));
  }, []);

  if (!home) return <p className="book-error">{error || "Loading the dashboard."}</p>;

  const cards = [
    ["hrm", "HRM"],
    ["crm", "CRM"],
    ["accounts", "Accounts"],
    ["finance", "Finance"],
    ["procurement", "Procurement"],
  ].filter(([id]) => modules.includes(id));

  return (
    <>
      <div className="starts">
        {cards.map(([id, label]) => (
          <button key={id} type="button" onClick={() => onOpen(id)}>
            <NavIcon name={id === "hrm" ? "employees" : id} />
            <strong>{label}</strong>
          </button>
        ))}
      </div>
      <div className="stats">
        <Stat label="People on roll" value={String(home.people)} tone="blue" icon="people" />
        <Stat label={home.payMonth ? `Pay — ${monthLabel(home.payMonth)}` : "Pay"} value={inr(home.pay || 0)} tone="sand" icon="pay" />
        <Stat label="Client bills" value={inr(home.clientBill)} tone="cyan" icon="bill" />
        <Stat label="Material" value={inr(home.material)} tone="mint" icon="days" />
      </div>
      <section className="sheet gap">
        <h2>Contract orders</h2>
        <table>
          <thead>
            <tr>
              <th>Agreement</th>
              <th>Client</th>
              <th>Department</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {home.contracts.map((item) => (
              <tr key={item.id}>
                <td>{item.agreementNo}</td>
                <td>{item.clientName}</td>
                <td>{item.departmentName}</td>
                <td>{typeName(item.contractType)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Masters() {
  const [company, setCompany] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/home")
      .then((response) => response.json())
      .then((data) => setCompany(data.company))
      .catch(() => setError("The company could not be loaded."));
  }, []);

  async function saveCompany(event) {
    event.preventDefault();
    const response = await api("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(company),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The company could not be saved.");
      return;
    }
    setCompany(body);
    setError("");
  }

  if (!company) return <p className="book-error">{error || "Loading the company."}</p>;

  return (
    <>
    <section className="sheet">
      <h2>Company</h2>
      <form className="book-form" onSubmit={saveCompany}>
        <label>
          Legal name<span className="req"> *</span>
          <input required value={company.legalName} onChange={(event) => setCompany({ ...company, legalName: event.target.value })} />
        </label>
        <label>
          GSTIN<span className="req"> *</span>
          <input required value={company.gstin} onChange={(event) => setCompany({ ...company, gstin: event.target.value })} />
        </label>
        <label>
          State<span className="req"> *</span>
          <input required value={company.stateName} onChange={(event) => setCompany({ ...company, stateName: event.target.value })} />
        </label>
        <label>
          State code<span className="req"> *</span>
          <input required value={company.stateCode} onChange={(event) => setCompany({ ...company, stateCode: event.target.value })} />
        </label>
        <label>
          SAC<span className="req"> *</span>
          <input required value={company.sac} onChange={(event) => setCompany({ ...company, sac: event.target.value })} />
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">Save company</button>
        </div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
    </section>
    <MasterLists />
    </>
  );
}

function Stat({ label, value, tone, icon }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <div className="stat-row">
        <span className={`stat-icon ${tone}`}>
          <StatIcon name={icon} />
        </span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function StatIcon({ name }) {
  const paths = {
    people: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 .5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c.4-2.4 2.2-4 4.5-4s4.1 1.6 4.5 4M14 19c.3-1.8 1.5-3.2 3.2-3.2 1.6 0 2.8 1.2 3.2 3",
    days: "M6 4v3M18 4v3M4 9h16M5 6h14v14H5z",
    pay: "M12 5v14M8 8.5c.6-1.2 2-2 4-2s3.2.7 3.2 2.2-1.4 2-3.2 2.4-3.6.8-3.6 2.5 1.8 2.4 3.6 2.4 3.4-.8 4-2",
    bill: "M7 3h8l4 4v14H7zM15 3v4h4M9 13h6M9 17h6",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} fill="none" stroke="#1f3a5f" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AllCompanies({ onOpen }) {
  const [firms, setFirms] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/companies")
      .then(async (response) => {
        const body = await response.json().catch(() => []);
        if (!response.ok) throw new Error(body.error || "The companies could not be loaded.");
        setFirms(body);
      })
      .catch((reason) => setError(reason.message));
  }, []);

  return (
    <>
      {error ? <p className="book-error">{error}</p> : null}
      <div className="company-cards">
        {firms.map((firm) => (
          <button key={firm.id} type="button" onClick={() => onOpen(firm)}>
            <strong>{firm.shortName}</strong>
            <span>{firm.legalName}</span>
            <em>{firm.people} on roll</em>
          </button>
        ))}
      </div>
    </>
  );
}

function CompanyRegistration({ onOpen }) {
  const empty = { legalName: "", shortName: "", gstin: "", stateName: "", stateCode: "", sac: "" };
  const [form, setForm] = useState(empty);
  const [firms, setFirms] = useState([]);
  const [error, setError] = useState("");

  function load() {
    api("/api/companies")
      .then(async (response) => {
        const body = await response.json().catch(() => []);
        if (!response.ok) throw new Error(body.error || "The companies could not be loaded.");
        setFirms(body);
        setError("");
      })
      .catch((reason) => setError(reason.message));
  }

  useEffect(() => { load(); }, []);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    const response = await api("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The company could not be registered.");
      return;
    }
    setForm(empty);
    setError("");
    load();
  }

  return (
    <>
      <section className="sheet">
        <h2>Register a company</h2>
        <form className="book-form" onSubmit={save}>
          <label>Legal name<span className="req"> *</span><input required value={form.legalName} onChange={(event) => setField("legalName", event.target.value)} /></label>
          <label>Short name<span className="req"> *</span><input required value={form.shortName} onChange={(event) => setField("shortName", event.target.value)} /></label>
          <label>GSTIN<input value={form.gstin} onChange={(event) => setField("gstin", event.target.value)} /></label>
          <label>State<input value={form.stateName} onChange={(event) => setField("stateName", event.target.value)} /></label>
          <label>State code<input value={form.stateCode} onChange={(event) => setField("stateCode", event.target.value)} /></label>
          <label>SAC<input value={form.sac} onChange={(event) => setField("sac", event.target.value)} /></label>
          <div className="book-actions span-2">
            <button className="signin" type="submit">Register</button>
          </div>
        </form>
        {error ? <p className="book-error">{error}</p> : null}
      </section>
      <section className="sheet gap">
        <div className="sheet-title"><h2>Registered companies</h2></div>
        <table>
          <thead>
            <tr><th>Short name</th><th>Legal name</th><th>GSTIN</th><th>State</th><th></th></tr>
          </thead>
          <tbody>
            {firms.map((firm) => (
              <tr key={firm.id}>
                <td>{firm.shortName}</td>
                <td>{firm.legalName}</td>
                <td>{firm.gstin}</td>
                <td>{firm.stateName}</td>
                <td><button type="button" className="row-btn" onClick={() => onOpen(firm)}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Login({ rejected, onSuccess, onReject, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter the email and the password.");
      return;
    }
    const response = await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 403) {
      onReject();
      return;
    }
    if (!response.ok) {
      setError(body.error || "That email or password is not correct.");
      return;
    }
    setToken(body.token);
    onSuccess(body);
  }

  return (
    <div className="gate">
      <header className="bar">
        <strong>Manpower</strong>
      </header>
      <div className="gate-body">
        {rejected ? (
          <section className="sheet gate-sheet">
            <h2>User not active</h2>
            <div className="gate-fields">
              <p className="gate-note">Sign-in stopped here. An inactive user cannot open the modules.</p>
              <button className="signin" type="button" onClick={onBack}>Back to sign in</button>
            </div>
          </section>
        ) : (
          <form className="sheet gate-sheet" onSubmit={submit}>
            <p className="gate-brand">Manpower System</p>
            <h2>Sign in</h2>
            <div className="gate-fields">
              <label>
                Email
                <input
                  autoComplete="username"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                />
              </label>
              <label>
                Password
                <span className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                  />
                  <button type="button" className="forgot" onClick={() => setShowPassword((open) => !open)}>
                    {showPassword ? "Hide" : "View"}
                  </button>
                </span>
              </label>
              <button className="forgot" type="button" onClick={() => setForgot((open) => !open)}>
                Forgot password
              </button>
              {forgot ? <p className="hint">Ask your administrator to reset this password.</p> : null}
              {error ? <div className="error">{error}</div> : null}
              <button className="signin" type="submit">Sign in</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function money(value) {
  const cleaned = String(value ?? "").replace(/[₹,\s]/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned);
}

function payFigures(attendance, salary, divisor, deduct) {
  if (!Number.isFinite(salary) || !Number.isFinite(divisor) || divisor <= 0) {
    return { rate: null, month: null, actual: null };
  }
  const rate = Math.round(salary / divisor);
  const month = Number.isFinite(attendance) ? Math.round((attendance * salary) / divisor) : null;
  const actual = month == null ? null : month - (Number.isFinite(deduct) ? deduct : 0);
  return { rate, month, actual };
}

function statutoryOf(month, rates) {
  if (month == null || !rates) return { pf: null, esi: null };
  const cap = Math.round((rates.pfCeiling * rates.pfPercent) / 100);
  const pf = Math.min(Math.round((month * rates.pfPercent) / 100), cap);
  const esi = month > rates.esiWageLimit ? 0 : Math.round((month * rates.esiEmployeePercent) / 100);
  return { pf, esi };
}

function typeName(code) {
  if (code === "A") return "A — Manpower";
  if (code === "B") return "B — Work";
  return "C — Office";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function thisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "This month";
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function MonthField({ value, onChange }) {
  return (
    <label className="month-pick">
      Month<span className="req"> *</span>
      <input type="month" required value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ageFrom(value) {
  if (!value) return "";
  const born = new Date(`${value}T00:00:00`);
  if (Number.isNaN(born.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? String(age) : "";
}

function EmployeeBook() {
  const empty = {
    name: "", trade: "", skill: "", salary: "", divisor: "26", advance: "", attendance: "", deduct: "", paymentDone: "",
    fatherOrHusband: "", dateOfBirth: "", age: "", localAddress: "", villageAddress: "", qualification: "", experience: "",
    characterCertificate: "", identificationMark: "", nationality: "", religion: "", reference: "", height: "", weight: "", chest: "", nominee: "",
    photo: "", photoName: "", exServiceNo: "", exRank: "", exDischargeDate: "", exDischargeBook: "", gunLicence: "", gunNo: "",
    mobile: "", presentAddress: "", presentPin: "", permanentAddress: "", permanentPin: "", aadhaar: "", aadhaarLast4: "",
    pan: "", panLast4: "", previousEmployer: "", uan: "", esiIp: "", preferredDispensary: "", family: blankFamily(),
    accountNo: "", accountLast4: "", bankName: "", ifsc: "", branchName: "", policeStatus: "", securityMoney: "", joiningTerms: false,
    aadhaarFile: "", aadhaarFileName: "", panFile: "", panFileName: "", passbookFile: "", passbookFileName: "",
  };
  const [month, setMonth] = useState("");
  const [rows, setRows] = useState([]);
  const [extra, setExtra] = useState({ claims: [], close: [] });
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const figures = payFigures(money(form.attendance), money(form.salary), money(form.divisor), form.deduct === "" ? 0 : money(form.deduct));

  async function load(chosen) {
    const active = chosen || month;
    if (!active) return;
    const response = await api(`/api/employees?month=${active}`);
    if (!response.ok) {
      setError("The employee book could not be loaded. Start the API on port 3001.");
      return;
    }
    setRows(await response.json());
    const extraResponse = await api(`/api/payroll-extra?month=${active}`);
    if (extraResponse.ok) setExtra(await extraResponse.json());
    setError("");
  }

  useEffect(() => {
    api("/api/payroll-months")
      .then((response) => response.json())
      .then((list) => setMonth(list[0] || thisMonth()))
      .catch(() => setMonth(thisMonth()));
  }, []);

  useEffect(() => {
    if (!month) return;
    setEditingId(null);
    setForm(empty);
    setNotice("");
    load(month);
  }, [month]);

  function setField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "dateOfBirth") next.age = ageFrom(value);
      return next;
    });
  }

  async function edit(person) {
    const response = await api(`/api/employees/${person.id}`);
    const detail = await response.json().catch(() => ({}));
    const application = detail.application || {};
    const family = [...(application.family || [])];
    while (family.length < 5) family.push({ name: "", relation: "", dateOfBirth: "", aadhaar: "", aadhaarLast4: "" });
    setEditingId(person.id);
    setForm({
      ...empty,
      ...application,
      family,
      name: person.name,
      trade: person.trade || "",
      skill: person.skill || "",
      salary: person.salary == null ? "" : String(person.salary),
      divisor: String(person.divisor),
      advance: person.advance == null ? "" : String(person.advance),
      attendance: person.attendance == null ? "" : String(person.attendance),
      deduct: person.deduct == null ? "" : String(person.deduct),
      paymentDone: person.paymentDone == null ? "" : String(person.paymentDone),
      aadhaar: "",
      pan: "",
      accountNo: "",
      photo: "",
      aadhaarFile: "",
      panFile: "",
      passbookFile: "",
    });
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    const gap = personError({ ...form, application: form });
    if (gap) {
      setError(gap);
      return;
    }
    const payload = {
      name: form.name,
      trade: form.trade,
      skill: form.skill,
      salary: money(form.salary),
      divisor: money(form.divisor),
      advance: form.advance === "" ? 0 : money(form.advance),
      attendance: form.attendance === "" ? null : money(form.attendance),
      deduct: form.deduct === "" ? 0 : money(form.deduct),
      paymentDone: form.paymentDone === "" ? null : money(form.paymentDone),
      month,
      application: form,
    };
    const response = await api(editingId ? `/api/employees/${editingId}` : "/api/employees", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The employee book could not be saved.");
      return;
    }
    setForm(empty);
    setEditingId(null);
    load(month);
  }

  async function useAttendance() {
    const name = form.name.trim();
    if (!name) {
      setError("Enter the name first.");
      return;
    }
    const response = await api(`/api/attendance-days?month=${month}&name=${encodeURIComponent(name)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "Attendance days could not be read.");
      return;
    }
    setField("attendance", String(body.days));
    setError("");
    setNotice(`Attendance set from ${body.sheetName}. Save the person to keep it.`);
  }

  async function closeMonthPay() {
    const response = await api("/api/payroll/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice("");
      setError(body.error || "This month could not be closed.");
      return;
    }
    setError("");
    setNotice(body.message || "This month is closed.");
    load(month);
  }

  async function payslip(person) {
    const response = await api(`/api/employees/${person.id}/payslip?month=${month}`);
    if (!response.ok) {
      setError("The payslip could not be prepared.");
      return;
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payslip-${person.name}-${month}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  async function remove(id) {
    const response = await api(`/api/employees/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("That person could not be removed.");
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setForm(empty);
    }
    load(month);
  }

  return (
    <section className="sheet">
      <div className="sheet-title">
        <h2>Employee details</h2>
        <MonthField value={month} onChange={setMonth} />
      </div>
      <form className="book-form" onSubmit={save}>
        <p className="form-section">Employee details</p>
        <label>
          Name<span className="req"> *</span>
          <input required value={form.name} onChange={(event) => setField("name", event.target.value)} />
        </label>
        <label>
          Trade<span className="req"> *</span>
          <input required value={form.trade} onChange={(event) => setField("trade", event.target.value)} />
        </label>
        <label>
          Skill<span className="req"> *</span>
          <select required value={form.skill} onChange={(event) => setField("skill", event.target.value)}>
            <option value="">Select</option>
            <option>Skilled</option>
            <option>Semi-skilled</option>
            <option>Unskilled</option>
          </select>
        </label>
        <label>
          Original salary<span className="req"> *</span>
          <input required inputMode="decimal" value={form.salary} onChange={(event) => setField("salary", event.target.value)} />
        </label>
        <ApplicationFields form={form} setField={setField} />
        <p className="form-section">Payroll record — {monthLabel(month)}</p>
        <label>
          Attendance<span className="req"> *</span>
          <input required inputMode="decimal" value={form.attendance} onChange={(event) => setField("attendance", event.target.value)} />
        </label>
        <div className="book-actions">
          <button type="button" className="text-btn" onClick={useAttendance}>Use attendance days</button>
        </div>
        <label>
          Advance payment<span className="req"> *</span>
          <input required inputMode="decimal" value={form.advance} onChange={(event) => setField("advance", event.target.value)} />
        </label>
        <label>
          Days for full pay<span className="req"> *</span>
          <input required inputMode="decimal" value={form.divisor} onChange={(event) => setField("divisor", event.target.value)} />
        </label>
        <label>
          Rate per day
          <input readOnly value={figures.rate == null ? "" : inr(figures.rate)} />
        </label>
        <label>
          Salary for this month
          <input readOnly value={figures.month == null ? "" : inr(figures.month)} />
        </label>
        <label>
          Loan / salary advance deduct<span className="req"> *</span>
          <input required inputMode="decimal" value={form.deduct} onChange={(event) => setField("deduct", event.target.value)} />
        </label>
        <label>
          Actual salary for this month
          <input readOnly value={figures.actual == null ? "" : inr(figures.actual)} />
        </label>
        <label>
          Payment done<span className="req"> *</span>
          <input required inputMode="decimal" value={form.paymentDone} onChange={(event) => setField("paymentDone", event.target.value)} />
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">{editingId ? "Save" : "Add"}</button>
          {editingId ? (
            <button type="button" className="text-btn" onClick={() => { setEditingId(null); setForm(empty); }}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {error ? <p className="book-error">{error}</p> : null}
      {notice ? <p className="book-note">{notice}</p> : null}
      <div className="sheet-title">
        <h2>Pay list — {monthLabel(month)}</h2>
        <button type="button" className="signin" onClick={closeMonthPay}>Close this month</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Sl</th>
            <th>Name</th>
            <th className="num">Attendance</th>
            <th className="num">Advance payment</th>
            <th className="num">Original salary</th>
            <th className="num">Rate per day</th>
            <th className="num">Salary for this month</th>
            <th className="num">Deduct</th>
            <th className="num">Actual salary</th>
            <th className="num">Payment done</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((person) => {
            const line = payFigures(person.attendance, person.salary, person.divisor, person.deduct);
            return (
            <tr key={person.id} className={person.id === editingId ? "selected" : ""}>
              <td>{person.slNo || ""}</td>
              <td>
                <button type="button" className="row-btn" onClick={() => edit(person)}>{person.name}</button>
              </td>
              <td className="num">{person.attendance ?? ""}</td>
              <td className="num">{person.advance ? inr(person.advance) : ""}</td>
              <td className="num">{person.salary == null ? "—" : inr(person.salary)}</td>
              <td className="num">{line.rate == null ? "—" : inr(line.rate)}</td>
              <td className="num">{line.month == null ? "" : inr(line.month)}</td>
              <td className="num">{person.deduct ? inr(person.deduct) : ""}</td>
              <td className="num">{line.actual == null ? "" : inr(line.actual)}</td>
              <td className="num">{person.paymentDone == null ? "" : inr(person.paymentDone)}</td>
              <td>
                <button type="button" className="text-btn" onClick={() => payslip(person)}>Payslip</button>
                <button type="button" className="text-btn" onClick={() => remove(person.id)}>Remove</button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {extra.claims.length ? (
        <>
          <h2>Bill claim — {monthLabel(month)}</h2>
          <table>
            <thead>
              <tr>
                <th>Sl</th>
                <th>Name</th>
                <th className="num">Attendance</th>
                <th className="num">Original salary</th>
                <th className="num">Rate per day</th>
                <th className="num">Salary for this month</th>
                <th className="num">Actual salary</th>
                <th className="num">Payment done</th>
              </tr>
            </thead>
            <tbody>
              {extra.claims.map((row) => {
                const line = payFigures(row.attendance, row.salary, row.divisor, row.deduct);
                return (
                  <tr key={`${row.slNo}-${row.name}`}>
                    <td>{row.slNo}</td>
                    <td>{row.name}</td>
                    <td className="num">{row.attendance}</td>
                    <td className="num">{inr(row.salary)}</td>
                    <td className="num">{inr(line.rate)}</td>
                    <td className="num">{inr(line.month)}</td>
                    <td className="num">{inr(line.actual)}</td>
                    <td className="num">{row.paymentDone == null ? "" : inr(row.paymentDone)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : null}
      {extra.close.length ? (
        <div className="lines">
          {extra.close.map((row) => (
            <div key={row.label}><span>{row.label}</span><strong>{inr(row.amount)}</strong></div>
          ))}
          <div><span>Grand total</span><strong>{inr(extra.close.reduce((sum, row) => sum + row.amount, 0))}</strong></div>
        </div>
      ) : null}
    </section>
  );
}

function dayCount(from, to) {
  if (!from || !to) return 28;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const count = Math.round((end - start) / 86400000) + 1;
  if (!Number.isFinite(count) || count < 1 || count > 31) return 28;
  return count;
}

function markSpan(sheet) {
  let count = dayCount(sheet?.period_from, sheet?.period_to);
  for (const row of sheet?.rows || []) {
    for (const key of Object.keys(row.marks || {})) {
      const day = Number(key);
      if (day > count && day <= 31) count = day;
    }
  }
  return count;
}

function rupee(value) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? inr(amount) : String(value);
}

function blankMarks(count) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [String(index + 1), ""]));
}

function rowLabel(row) {
  if (row.row_kind === "trade") return row.trade || "Trade";
  if (row.row_kind === "bill_total" || row.row_kind === "group_total") return row.workman_name || "Total";
  return row.workman_name || "";
}

function WageTable({ lines, notes }) {
  return (
    <div className="sheet-wrap">
      <table className="day-grid">
        <thead>
          <tr>
            <th>Sl. No.</th>
            <th>Employees name</th>
            <th>EPFO no.</th>
            <th>ESIC no.</th>
            <th>Designation</th>
            <th className="num">Days worked</th>
            <th className="num">Daily rate</th>
            <th className="num">Basic</th>
            <th className="num">DA</th>
            <th className="num">Gross</th>
            <th className="num">PF @12%</th>
            <th className="num">ESIC @0.75%</th>
            <th className="num">P. Tax</th>
            <th className="num">Other deduction</th>
            <th className="num">Net amount</th>
            <th className="num">PF @13%</th>
            <th className="num">ESI @3.25%</th>
            <th>Admin charge</th>
            <th className="num">Employer total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className={line.row_kind === "total" ? "selected" : ""}>
              <td>{line.sl_no || ""}</td>
              <td>{line.employee_name}</td>
              <td>{line.epfo_no || ""}</td>
              <td>{line.esic_no || ""}</td>
              <td>{line.designation || ""}</td>
              <td className="num">{line.days_worked ?? ""}</td>
              <td className="num">{rupee(line.daily_rate)}</td>
              <td className="num">{rupee(line.basic)}</td>
              <td className="num">{rupee(line.da)}</td>
              <td className="num">{rupee(line.gross)}</td>
              <td className="num">{rupee(line.pf)}</td>
              <td className="num">{rupee(line.esic)}</td>
              <td className="num">{rupee(line.professional_tax)}</td>
              <td className="num">{rupee(line.other_deduction)}</td>
              <td className="num">{rupee(line.net_amount)}</td>
              <td className="num">{rupee(line.employer_pf)}</td>
              <td className="num">{rupee(line.employer_esi)}</td>
              <td>{line.admin_charge || ""}</td>
              <td className="num">{rupee(line.employer_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {notes.length ? (
        <table className="day-grid">
          <tbody>
            {notes.map((note) => (
              <tr key={note.id}>
                <td>{note.note}</td>
                <td>{note.month_label || ""}</td>
                <td className="num">{note.amount === null ? "" : rupee(note.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function ExtraTable({ lines }) {
  return (
    <div className="sheet-wrap">
      <table className="day-grid">
        <thead>
          <tr>
            <th>Sl. No.</th>
            <th>Employees name</th>
            <th className="num">Days worked</th>
            <th className="num">Daily rate</th>
            <th className="num">Total amount payable</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className={line.row_kind === "total" ? "selected" : ""}>
              <td>{line.sl_no || ""}</td>
              <td>{line.employee_name}</td>
              <td className="num">{line.days_worked ?? ""}</td>
              <td className="num">{rupee(line.daily_rate)}</td>
              <td className="num">{rupee(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Hrm() {
  const emptyRow = { rowKind: "workman", billSl: "", slNo: "", trade: "", workmanName: "", totalDays: "", marks: blankMarks(28) };
  const [sheets, setSheets] = useState([]);
  const [sheetId, setSheetId] = useState(null);
  const [header, setHeader] = useState(null);
  const [form, setForm] = useState(emptyRow);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [people, setPeople] = useState([]);
  const [rates, setRates] = useState(null);
  const [payId, setPayId] = useState(null);
  const [downloading, setDownloading] = useState("");
  const [month, setMonth] = useState("");

  async function load(keepId) {
    if (!month) return;
    const response = await api(`/api/attendance?month=${month}`);
    if (!response.ok) {
      setError("The attendance sheet could not be loaded. Start the API on port 3001.");
      return;
    }
    const data = await response.json();
    setSheets(data);
    setSheetId((current) => {
      if (keepId && data.some((item) => item.id === keepId)) return keepId;
      if (data.some((item) => item.id === current)) return current;
      return data[0]?.id || null;
    });
    setError("");
  }

  async function openMonth() {
    const response = await api("/api/attendance/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "This month could not be opened.");
      return;
    }
    load();
  }

  useEffect(() => {
    api("/api/attendance-months")
      .then((response) => response.json())
      .then((list) => setMonth(list[0] || thisMonth()))
      .catch(() => setMonth(thisMonth()));
    api("/api/statutory")
      .then((response) => response.json())
      .then(setRates)
      .catch(() => setRates(null));
  }, []);

  useEffect(() => {
    if (!month) return;
    load();
    api(`/api/employees?month=${month}`)
      .then((response) => response.json())
      .then((rows) => {
        setPeople(rows);
        setPayId((current) => current || rows[0]?.id || null);
      })
      .catch(() => setPeople([]));
  }, [month]);

  const sheet = sheets.find((item) => item.id === sheetId) || sheets[0];
  const days = markSpan(sheet);

  useEffect(() => {
    if (!sheet) return;
    setHeader({
      companyName: sheet.company_name || "",
      workName: sheet.work_name || "",
      workOrderNo: sheet.work_order_no || "",
      workOrderDate: sheet.work_order_date || "",
      periodFrom: sheet.period_from || "",
      periodTo: sheet.period_to || "",
      periodNote: sheet.period_note || "",
      billTab: sheet.bill_tab || "",
    });
    setEditingId(null);
    setForm({ ...emptyRow, marks: blankMarks(markSpan(sheet)) });
  }, [sheet?.id]);

  function setHead(key, value) {
    setHeader((current) => ({ ...current, [key]: value }));
  }

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setMark(day, value) {
    setForm((current) => ({ ...current, marks: { ...current.marks, [String(day)]: value } }));
  }

  function edit(row) {
    const count = markSpan(sheet);
    const marks = blankMarks(count);
    for (let day = 1; day <= count; day += 1) {
      marks[String(day)] = row.marks?.[day] || row.marks?.[String(day)] || "";
    }
    setEditingId(row.id);
    setForm({
      rowKind: row.row_kind,
      billSl: row.bill_sl_no || "",
      slNo: row.sl_no || "",
      trade: row.trade || "",
      workmanName: row.workman_name || "",
      totalDays: row.total_days == null ? "" : String(row.total_days),
      marks,
    });
    setError("");
  }

  async function saveHeader(event) {
    event.preventDefault();
    if (!sheet) return;
    const response = await api(`/api/attendance/${sheet.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(header),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The sheet header could not be saved.");
      return;
    }
    load(sheet.id);
  }

  async function saveRow(event) {
    event.preventDefault();
    if (!sheet) return;
    const response = await api(editingId ? `/api/attendance/rows/${editingId}` : `/api/attendance/${sheet.id}/rows`, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        totalDays: form.totalDays === "" ? null : form.totalDays,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || "The attendance row could not be saved.");
      return;
    }
    setEditingId(null);
    setForm({ ...emptyRow, marks: blankMarks(days) });
    load(sheet.id);
  }

  async function downloadFile(format) {
    if (!sheet) return;
    setDownloading(format);
    setError("");
    try {
      const response = await api(`/api/attendance/${sheet.id}/export?format=${format}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || "The file could not be prepared.");
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = match?.[1] || `attendance.${format === "word" ? "docx" : format === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch {
      setError("The file could not be prepared.");
    } finally {
      setDownloading("");
    }
  }

  async function remove(id) {
    const response = await api(`/api/attendance/rows/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("That row could not be removed.");
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setForm({ ...emptyRow, marks: blankMarks(days) });
    }
    load(sheet.id);
  }

  if (!month) return <p className="book-error">{error || "Loading the attendance sheet."}</p>;

  const showDays = Boolean(sheet) && !sheet.sheet_name.startsWith("Calculation") && !sheet.sheet_name.startsWith("Extra");
  const person = people.find((item) => item.id === payId);
  const figures = person ? payFigures(person.attendance, person.salary, person.divisor, person.deduct) : null;
  const check = statutoryOf(figures?.month ?? null, rates);

  return (
    <>
    <section className="sheet">
      <div className="sheet-title">
        <h2>{sheet ? sheet.sheet_name : "Attendance"}</h2>
        <div className="sheet-tools">
          <MonthField value={month} onChange={setMonth} />
        <div className="download">
          <span>Download</span>
          <button type="button" disabled={downloading !== ""} onClick={() => downloadFile("pdf")}>{downloading === "pdf" ? "PDF…" : "PDF"}</button>
          <button type="button" disabled={downloading !== ""} onClick={() => downloadFile("word")}>{downloading === "word" ? "Word…" : "Word"}</button>
          <button type="button" disabled={downloading !== "" || !sheet} onClick={() => downloadFile("excel")}>{downloading === "excel" ? "Excel…" : "Excel"}</button>
        </div>
        </div>
      </div>
      {!sheet ? (
        <div className="empty-month">
          <p>{monthLabel(month)} has no attendance sheet yet.</p>
          <button type="button" className="signin" onClick={openMonth}>Open this month</button>
          {error ? <p className="book-error">{error}</p> : null}
        </div>
      ) : null}
      {sheet && !header ? <p className="book-error">Loading the attendance sheet.</p> : null}
      {sheet && header ? <>
      <div className="sheet-tabs">
        {sheets.map((item) => (
          <button key={item.id} type="button" className={item.id === sheet.id ? "active" : ""} onClick={() => setSheetId(item.id)}>
            {item.sheet_name}
          </button>
        ))}
      </div>
      <form className="book-form" onSubmit={saveHeader}>
        <p className="form-section">Sheet header</p>
        <label>
          Company
          <input value={header.companyName} onChange={(event) => setHead("companyName", event.target.value)} />
        </label>
        <label>
          Bill tab
          <input value={header.billTab} onChange={(event) => setHead("billTab", event.target.value)} />
        </label>
        <label className="span-2">
          Name of work
          <input value={header.workName} onChange={(event) => setHead("workName", event.target.value)} />
        </label>
        <label>
          Work order no.
          <input value={header.workOrderNo} onChange={(event) => setHead("workOrderNo", event.target.value)} />
        </label>
        <label>
          Work order date
          <input type="date" value={header.workOrderDate} onChange={(event) => setHead("workOrderDate", event.target.value)} />
        </label>
        <label>
          Working period from
          <input type="date" value={header.periodFrom} onChange={(event) => setHead("periodFrom", event.target.value)} />
        </label>
        <label>
          Working period to
          <input type="date" value={header.periodTo} onChange={(event) => setHead("periodTo", event.target.value)} />
        </label>
        <label>
          Period note
          <input value={header.periodNote} onChange={(event) => setHead("periodNote", event.target.value)} />
        </label>
        <div className="book-actions">
          <button className="signin" type="submit">Save header</button>
        </div>
      </form>
      {showDays ? <form className="book-form" onSubmit={saveRow}>
        <p className="form-section">Workman row</p>
        <label>
          Row type
          <select value={form.rowKind} onChange={(event) => setField("rowKind", event.target.value)}>
            <option value="workman">Workman</option>
            <option value="trade">Trade</option>
            <option value="bill_total">Bill total</option>
            <option value="group_total">Group total</option>
          </select>
        </label>
        <label>
          Bill Sl. No.
          <input value={form.billSl} onChange={(event) => setField("billSl", event.target.value)} />
        </label>
        <label>
          Sl. No.
          <input value={form.slNo} onChange={(event) => setField("slNo", event.target.value)} />
        </label>
        <label>
          Trade
          <input value={form.trade} onChange={(event) => setField("trade", event.target.value)} />
        </label>
        <label>
          Name of workman
          <input value={form.workmanName} onChange={(event) => setField("workmanName", event.target.value)} />
        </label>
        <label>
          Total days
          <input inputMode="decimal" value={form.totalDays} onChange={(event) => setField("totalDays", event.target.value)} />
        </label>
        <div className="day-form">
          {Array.from({ length: days }, (_, index) => index + 1).map((day) => (
            <label key={day}>
              {day}
              <input value={form.marks[String(day)] || ""} onChange={(event) => setMark(day, event.target.value)} />
            </label>
          ))}
        </div>
        <div className="book-actions">
          <button className="signin" type="submit">{editingId ? "Save row" : "Add row"}</button>
          {editingId ? (
            <button type="button" className="text-btn" onClick={() => { setEditingId(null); setForm({ ...emptyRow, marks: blankMarks(days) }); }}>
              Cancel
            </button>
          ) : null}
        </div>
      </form> : null}
      {error ? <p className="book-error">{error}</p> : null}
      {showDays ? <div className="sheet-wrap">
        <table className="day-grid">
          <thead>
            <tr>
              <th>Sl. No.</th>
              <th>Trade</th>
              <th>Name of workman</th>
              {Array.from({ length: days }, (_, index) => index + 1).map((day) => <th key={day} className="day">{day}</th>)}
              <th className="num">Total days</th>
              <th>Bill Sl. No.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row) => row.row_kind === "trade" ? (
              <tr key={row.id} className="trade-row">
                <td colSpan={days + 6}>{row.trade}</td>
              </tr>
            ) : (
              <tr key={row.id} className={row.id === editingId || row.row_kind !== "workman" ? "selected" : ""}>
                <td>{row.sl_no || ""}</td>
                <td>{row.trade || ""}</td>
                <td>
                  <button type="button" className="row-btn" onClick={() => edit(row)}>{rowLabel(row)}</button>
                </td>
                {Array.from({ length: days }, (_, index) => index + 1).map((day) => (
                  <td key={day} className="day">{row.marks?.[day] || row.marks?.[String(day)] || ""}</td>
                ))}
                <td className="num">{row.total_days ?? ""}</td>
                <td>{row.bill_sl_no || ""}</td>
                <td>
                  <button type="button" className="text-btn" onClick={() => remove(row.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div> : null}
      {sheet.wageLines?.length ? <WageTable lines={sheet.wageLines} notes={sheet.wageNotes || []} /> : null}
      {sheet.extraPayments?.length ? <ExtraTable lines={sheet.extraPayments} /> : null}
      </> : null}
    </section>
    <section className="sheet gap">
      <h2>Pay — {monthLabel(month)}</h2>
      <label className="pay-pick">
        Worker
        <select value={payId || ""} onChange={(event) => setPayId(Number(event.target.value))}>
          {people.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>
      {person && figures ? (
        <div className="lines">
          <div><span>Original salary</span><strong>{person.salary == null ? "—" : inr(person.salary)}</strong></div>
          <div><span>Days for full pay</span><strong>{person.divisor}</strong></div>
          <div><span>Attendance</span><strong>{person.attendance ?? "—"}</strong></div>
          <div><span>Rate per day</span><strong>{figures.rate == null ? "—" : inr(figures.rate)}</strong></div>
          <div><span>Salary for this month</span><strong>{figures.month == null ? "—" : inr(figures.month)}</strong></div>
          <div><span>PF</span><strong>{check.pf == null ? "—" : inr(check.pf)}</strong></div>
          <div><span>ESI</span><strong>{check.esi == null ? "—" : inr(check.esi)}</strong></div>
          <div><span>Deduct this month</span><strong>{inr(person.deduct || 0)}</strong></div>
          <div><span>Actual salary</span><strong>{figures.actual == null ? "—" : inr(figures.actual)}</strong></div>
          <div><span>Payment done</span><strong>{person.paymentDone == null ? "—" : inr(person.paymentDone)}</strong></div>
        </div>
      ) : null}
    </section>
    </>
  );
}

