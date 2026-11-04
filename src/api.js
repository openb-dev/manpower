const TOKEN_KEY = "nk_auth_token";
const COMPANY_ID_KEY = "nk_company_id";

function readStorage(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

let token = readStorage(TOKEN_KEY);
let companyId = readStorage(COMPANY_ID_KEY);

export function getToken() {
  return token;
}

export function getCompanyId() {
  return companyId;
}

export function setToken(value) {
  token = value || "";
  writeStorage(TOKEN_KEY, token);
}

export function setCompanyId(value) {
  companyId = value ? String(value) : "";
  writeStorage(COMPANY_ID_KEY, companyId);
}

export function clearSession() {
  setToken("");
  setCompanyId("");
}

export async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (companyId && !headers.has("x-company-id")) headers.set("X-Company-Id", companyId);
  if (options.body && !headers.has("content-type")) headers.set("Content-Type", "application/json");

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && !url.includes("/api/login") && !url.includes("/api/apply")) {
    window.dispatchEvent(new CustomEvent("nk:unauthorized"));
  }
  return response;
}
