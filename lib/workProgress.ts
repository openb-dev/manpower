import { raBillNumber, raBillOrdinal } from "@/lib/downloadWorkRegisterExcel";

export const DEFAULT_PROGRESS_RA: string[] = [];

export type ProgressItemKind = "BOQ" | "EXTRA";

export type ProgressRaQty = {
  qty?: string;
  rate?: string;
};

export type ProgressItem = {
  slNo: string;
  kind: ProgressItemKind;
  particulars: string;
  unit: string;
  boqQty: string;
  boqRate: string;
  ra: Record<string, ProgressRaQty>;
  balanceQty: string;
  remarks: string;
};

export type ProgressReportInput = {
  nameOfWork?: string;
  workOrderNo?: string;
  workOrderDate?: string | null;
  period?: string;
  department?: string;
  situation?: string;
  stipulatedStart?: string | null;
  actualStart?: string | null;
  stipulatedCompletion?: string | null;
  actualCompletion?: string | null;
  workStatus?: string;
  agencyName?: string;
  reportDate?: string | null;
  balanceDate?: string | null;
  lessPercent?: string | number | null;
  adjustKind?: string | null;
  sdPercent?: string | number | null;
  itPercent?: string | number | null;
  gstPercent?: string | number | null;
  labourCessPercent?: string | number | null;
  raBills?: string[];
  raNotes?: Record<string, string>;
  items?: ProgressItem[];
  note?: string;
};

export function emptyProgressItem(kind: ProgressItemKind = "BOQ", slNo = "1"): ProgressItem {
  return {
    slNo,
    kind,
    particulars: "",
    unit: "",
    boqQty: "",
    boqRate: "",
    ra: {},
    balanceQty: "",
    remarks: "",
  };
}

export function defaultRaBills(raw?: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value || "").trim()).filter(Boolean);
}

export function sortProgressRa(raBills: string[]) {
  return raBills.slice().sort((a, b) => raBillNumber(a) - raBillNumber(b) || String(a).localeCompare(String(b)));
}

export function nextProgressRa(raBills: string[]) {
  const nums = raBills.map(raBillNumber).filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return raBillOrdinal(next);
}

export function labelProgressRa(value: unknown) {
  const typed = String(value || "").trim();
  if (!typed) return "";
  const n = raBillNumber(typed);
  return n > 0 ? raBillOrdinal(n) : typed;
}

export function num(value: unknown) {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function moneyText(value: unknown) {
  const n = num(value);
  if (!value && value !== 0) return "";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function qtyRateAmount(qty: unknown, rate: unknown) {
  const q = num(qty);
  const r = num(rate);
  if (!q && !r) return 0;
  return Math.round(q * r * 100) / 100;
}

export function itemRate(item: ProgressItem, raNo?: string) {
  if (!raNo) return num(item.boqRate);
  const typed = item.ra?.[raNo]?.rate;
  if (typed != null && String(typed).trim() !== "") return num(typed);
  return num(item.boqRate);
}

export function itemRaQty(item: ProgressItem, raNo: string) {
  return num(item.ra?.[raNo]?.qty);
}

export function itemBalanceQty(item: ProgressItem, raBills: string[]) {
  if (item.balanceQty != null && String(item.balanceQty).trim() !== "") return num(item.balanceQty);
  if (item.kind === "EXTRA") return 0;
  const used = raBills.reduce((sum, raNo) => sum + itemRaQty(item, raNo), 0);
  return Math.round((num(item.boqQty) - used) * 1000) / 1000;
}

export function columnAmount(item: ProgressItem, col: "boq" | "balance" | string, raBills: string[]) {
  if (col === "boq") return qtyRateAmount(item.boqQty, item.boqRate);
  if (col === "balance") return qtyRateAmount(itemBalanceQty(item, raBills), itemRate(item));
  return qtyRateAmount(itemRaQty(item, col), itemRate(item, col));
}

export function parseProgressItems(raw: unknown): ProgressItem[] {
  if (!Array.isArray(raw) || !raw.length) return [emptyProgressItem()];
  return raw.map((row: any, index) => ({
    ...emptyProgressItem(row?.kind === "EXTRA" ? "EXTRA" : "BOQ", String(row?.slNo || index + 1)),
    slNo: String(row?.slNo || (row?.kind === "EXTRA" ? `E-${index + 1}` : index + 1)),
    kind: row?.kind === "EXTRA" ? "EXTRA" : "BOQ",
    particulars: String(row?.particulars || ""),
    unit: String(row?.unit || ""),
    boqQty: row?.boqQty == null ? "" : String(row.boqQty),
    boqRate: row?.boqRate == null ? "" : String(row.boqRate),
    ra: row?.ra && typeof row.ra === "object" ? row.ra : {},
    balanceQty: row?.balanceQty == null ? "" : String(row.balanceQty),
    remarks: String(row?.remarks || ""),
  }));
}

export function parseRaNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = value == null ? "" : String(value);
  }
  return out;
}

export function nextExtraSl(items: ProgressItem[]) {
  const count = items.filter((item) => item.kind === "EXTRA").length;
  return `E-${count + 1}`;
}

export function nextBoqSl(items: ProgressItem[]) {
  const count = items.filter((item) => item.kind !== "EXTRA").length;
  return String(count + 1);
}

/** Running row numbers 1,2,3… for BOQ and E-1,E-2… for extras. */
export function renumberProgressItems(items: ProgressItem[]) {
  let boq = 0;
  let extra = 0;
  return items.map((item) => {
    if (item.kind === "EXTRA") {
      extra += 1;
      return { ...item, slNo: `E-${extra}` };
    }
    boq += 1;
    return { ...item, slNo: String(boq) };
  });
}

export type ProgressColumnKey = "boq" | "balance" | string;

export function sumColumn(items: ProgressItem[], kind: ProgressItemKind | "ALL", col: ProgressColumnKey, raBills: string[]) {
  return items
    .filter((item) => kind === "ALL" || item.kind === kind)
    .reduce((sum, item) => sum + columnAmount(item, col, raBills), 0);
}

/** Commercial half-up to 2 decimals (matches office Excel). */
export function round2(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(n) * 100 + Number.EPSILON)) / 100;
}

export function progressColumns(raBills: string[]): ProgressColumnKey[] {
  return ["boq", ...raBills, "balance"];
}

export function columnTotals(items: ProgressItem[], raBills: string[], kind: ProgressItemKind | "ALL" = "BOQ") {
  const out: Record<string, number> = {};
  for (const col of progressColumns(raBills)) {
    out[col] = round2(sumColumn(items, kind, col, raBills));
  }
  return out;
}

export function recoveryLine(base: number, percent: number) {
  return round2(-(base * percent) / 100);
}

export function adjustKindOf(value: unknown): "LESS" | "ADD" {
  return String(value || "LESS").toUpperCase() === "ADD" ? "ADD" : "LESS";
}

export function adjustRowLabel(kind: "LESS" | "ADD", pct: number) {
  const how = `${pct}%`;
  return kind === "ADD" ? `Add (+${how})=` : `Less (-${how})=`;
}

/** Client sheet rounds (A) Sub-Total to whole rupees before recoveries. */
export function roundRupee(value: number) {
  return Math.round(value);
}

export function buildProgressFooter(items: ProgressItem[], report: ProgressReportInput) {
  const raBills = defaultRaBills(report.raBills);
  const adjustKind = adjustKindOf(report.adjustKind);
  const lessPct = num(report.lessPercent ?? 0.96);
  const sdPct = num(report.sdPercent ?? 2.5);
  const itPct = num(report.itPercent ?? 2);
  const gstPct = num(report.gstPercent ?? 2);
  const labourPct = num(report.labourCessPercent ?? 1);
  const total = columnTotals(items, raBills, "BOQ");
  const extra = columnTotals(items, raBills, "EXTRA");
  const cols = progressColumns(raBills);
  const less: Record<string, number> = {};
  const subA: Record<string, number> = {};
  const grand: Record<string, number> = {};
  const sd: Record<string, number> = {};
  const it: Record<string, number> = {};
  const gst: Record<string, number> = {};
  const labour: Record<string, number> = {};
  const recoveries: Record<string, number> = {};
  const net: Record<string, number> = {};
  for (const col of cols) {
    less[col] = round2((total[col] * lessPct) / 100);
    const rawSub = adjustKind === "ADD" ? total[col] + less[col] : total[col] - less[col];
    subA[col] = roundRupee(rawSub);
    grand[col] = round2(subA[col] + extra[col]);
    sd[col] = recoveryLine(grand[col], sdPct);
    it[col] = recoveryLine(grand[col], itPct);
    gst[col] = recoveryLine(grand[col], gstPct);
    labour[col] = recoveryLine(grand[col], labourPct);
    recoveries[col] = round2(sd[col] + it[col] + gst[col] + labour[col]);
    net[col] = round2(grand[col] + recoveries[col]);
  }
  return {
    raBills,
    adjustKind,
    lessPct,
    sdPct,
    itPct,
    gstPct,
    labourPct,
    total,
    less,
    subA,
    extra,
    grand,
    sd,
    it,
    gst,
    labour,
    recoveries,
    net,
  };
}
