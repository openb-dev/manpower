import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const REPORT_COLUMNS = Prisma.raw(`
  id, company_id, name_of_work, work_order_no, work_order_date, period,
  department, situation,
  stipulated_start, actual_start, stipulated_completion, actual_completion,
  work_status, agency_name, report_date, balance_date,
  less_percent, adjust_kind, sd_percent, it_percent, gst_percent, labour_cess_percent,
  ra_bills, ra_notes, items, note, deleted_at, created_at, updated_at
`);

function jsonValue(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parseJson(value: unknown) {
  if (value == null) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function mapReport(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    nameOfWork: row.name_of_work || "",
    workOrderNo: row.work_order_no || "",
    workOrderDate: row.work_order_date,
    period: row.period || "",
    department: row.department || "",
    situation: row.situation || "",
    stipulatedStart: row.stipulated_start,
    actualStart: row.actual_start,
    stipulatedCompletion: row.stipulated_completion,
    actualCompletion: row.actual_completion,
    workStatus: row.work_status || "Under progress",
    agencyName: row.agency_name || "",
    reportDate: row.report_date,
    balanceDate: row.balance_date,
    lessPercent: row.less_percent == null ? 0.96 : Number(row.less_percent),
    adjustKind: String(row.adjust_kind || "LESS").toUpperCase() === "ADD" ? "ADD" : "LESS",
    sdPercent: row.sd_percent == null ? 2.5 : Number(row.sd_percent),
    itPercent: row.it_percent == null ? 2 : Number(row.it_percent),
    gstPercent: row.gst_percent == null ? 2 : Number(row.gst_percent),
    labourCessPercent: row.labour_cess_percent == null ? 1 : Number(row.labour_cess_percent),
    raBills: parseJson(row.ra_bills),
    raNotes: parseJson(row.ra_notes),
    items: parseJson(row.items),
    note: row.note,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWorkProgressReports(companyId: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT ${REPORT_COLUMNS}
    FROM work_progress_reports
    WHERE company_id = ${companyId}
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
  `;
  return rows.map(mapReport);
}

export async function getWorkProgressReport(companyId: string, id: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT ${REPORT_COLUMNS}
    FROM work_progress_reports
    WHERE id = ${id}
      AND company_id = ${companyId}
      AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows[0] ? mapReport(rows[0]) : null;
}

export async function saveWorkProgressReport(
  companyId: string,
  data: {
    id?: string;
    nameOfWork?: string;
    workOrderNo?: string;
    workOrderDate?: Date | null;
    period?: string;
    department?: string;
    situation?: string;
    stipulatedStart?: Date | null;
    actualStart?: Date | null;
    stipulatedCompletion?: Date | null;
    actualCompletion?: Date | null;
    workStatus?: string;
    agencyName?: string;
    reportDate?: Date | null;
    balanceDate?: Date | null;
    lessPercent?: number | null;
    adjustKind?: string | null;
    sdPercent?: number | null;
    itPercent?: number | null;
    gstPercent?: number | null;
    labourCessPercent?: number | null;
    raBills?: unknown;
    raNotes?: unknown;
    items?: unknown;
    note?: string | null;
  },
) {
  if (data.id) {
    const existing = await getWorkProgressReport(companyId, data.id);
    if (!existing) throw new Error("Report not found.");
  }
  const id = data.id || crypto.randomUUID();
  const rows = await prisma.$queryRaw<any[]>`
    INSERT INTO work_progress_reports (
      id, company_id, name_of_work, work_order_no, work_order_date, period,
      department, situation,
      stipulated_start, actual_start, stipulated_completion, actual_completion,
      work_status, agency_name, report_date, balance_date,
      less_percent, adjust_kind, sd_percent, it_percent, gst_percent, labour_cess_percent,
      ra_bills, ra_notes, items, note, created_at, updated_at
    ) VALUES (
      ${id},
      ${companyId},
      ${data.nameOfWork || ""},
      ${data.workOrderNo || ""},
      ${data.workOrderDate ?? null},
      ${data.period || ""},
      ${data.department || ""},
      ${data.situation || ""},
      ${data.stipulatedStart ?? null},
      ${data.actualStart ?? null},
      ${data.stipulatedCompletion ?? null},
      ${data.actualCompletion ?? null},
      ${data.workStatus || "Under progress"},
      ${data.agencyName || ""},
      ${data.reportDate ?? null},
      ${data.balanceDate ?? null},
      ${data.lessPercent ?? 0.96},
      ${String(data.adjustKind || "LESS").toUpperCase() === "ADD" ? "ADD" : "LESS"},
      ${data.sdPercent ?? 2.5},
      ${data.itPercent ?? 2},
      ${data.gstPercent ?? 2},
      ${data.labourCessPercent ?? 1},
      CAST(${jsonValue(data.raBills ?? [])} AS JSONB),
      CAST(${jsonValue(data.raNotes ?? {})} AS JSONB),
      CAST(${jsonValue(data.items ?? [])} AS JSONB),
      ${data.note || null},
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name_of_work = EXCLUDED.name_of_work,
      work_order_no = EXCLUDED.work_order_no,
      work_order_date = EXCLUDED.work_order_date,
      period = EXCLUDED.period,
      department = EXCLUDED.department,
      situation = EXCLUDED.situation,
      stipulated_start = EXCLUDED.stipulated_start,
      actual_start = EXCLUDED.actual_start,
      stipulated_completion = EXCLUDED.stipulated_completion,
      actual_completion = EXCLUDED.actual_completion,
      work_status = EXCLUDED.work_status,
      agency_name = EXCLUDED.agency_name,
      report_date = EXCLUDED.report_date,
      balance_date = EXCLUDED.balance_date,
      less_percent = EXCLUDED.less_percent,
      adjust_kind = EXCLUDED.adjust_kind,
      sd_percent = EXCLUDED.sd_percent,
      it_percent = EXCLUDED.it_percent,
      gst_percent = EXCLUDED.gst_percent,
      labour_cess_percent = EXCLUDED.labour_cess_percent,
      ra_bills = EXCLUDED.ra_bills,
      ra_notes = EXCLUDED.ra_notes,
      items = EXCLUDED.items,
      note = EXCLUDED.note,
      updated_at = NOW()
    WHERE work_progress_reports.company_id = ${companyId}
    RETURNING ${REPORT_COLUMNS}
  `;
  if (!rows[0]) throw new Error("Report not found.");
  return mapReport(rows[0]);
}

export async function deleteWorkProgressReport(companyId: string, id: string) {
  const result = await prisma.$executeRaw`
    UPDATE work_progress_reports
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
      AND company_id = ${companyId}
      AND deleted_at IS NULL
  `;
  if (!result) throw new Error("Report not found.");
  return { success: true };
}
