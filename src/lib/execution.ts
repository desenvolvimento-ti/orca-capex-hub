import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export const EXECUTION_STATUSES = ["aprovado_final", "em_execucao"] as const;

export type MonthRow = {
  month: string; // YYYY-MM-01
  planned: number;
  plannedStudy: number;
  plannedExec: number;
  actual: number;
  actualStudy: number;
  actualExec: number;
  diff: number;
  plannedAcc: number;
  actualAcc: number;
};

export type ProjectCurve = { projectId: string; version: "firme" | "indicativo"; rows: MonthRow[] };

const m0 = (d: string) => d.slice(0, 7) + "-01";

/** Carrega previsto (firme, ou indicativo se não houver) e realizado de vários projetos. */
export async function loadCurves(projectIds: string[]): Promise<Map<string, ProjectCurve>> {
  const out = new Map<string, ProjectCurve>();
  if (!projectIds.length) return out;
  const [{ data: disb, error: e1 }, { data: act, error: e2 }] = await Promise.all([
    supabase.from("disbursements").select("project_id, phase, period, amount, version").in("project_id", projectIds),
    supabase.from("actual_entries").select("project_id, phase, competencia, amount").in("project_id", projectIds),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  for (const id of projectIds) {
    const d = (disb ?? []).filter((r) => r.project_id === id);
    const version: "firme" | "indicativo" = d.some((r) => r.version === "firme") ? "firme" : "indicativo";
    const map = new Map<string, MonthRow>();
    const get = (m: string) => {
      let r = map.get(m);
      if (!r) { r = { month: m, planned: 0, plannedStudy: 0, plannedExec: 0, actual: 0, actualStudy: 0, actualExec: 0, diff: 0, plannedAcc: 0, actualAcc: 0 }; map.set(m, r); }
      return r;
    };
    d.filter((r) => r.version === version).forEach((r) => {
      const row = get(m0(r.period)); const v = Number(r.amount) || 0;
      row.planned += v; if (r.phase === "planejamento") row.plannedStudy += v; else row.plannedExec += v;
    });
    (act ?? []).filter((r) => r.project_id === id).forEach((r) => {
      const row = get(m0(r.competencia)); const v = Number(r.amount) || 0;
      row.actual += v; if (r.phase === "planejamento") row.actualStudy += v; else row.actualExec += v;
    });
    const rows = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
    let pa = 0, aa = 0;
    rows.forEach((r) => { pa += r.planned; aa += r.actual; r.plannedAcc = pa; r.actualAcc = aa; r.diff = r.actual - r.planned; });
    out.set(id, { projectId: id, version, rows });
  }
  return out;
}

export function sumCurves(curves: ProjectCurve[]): MonthRow[] {
  const map = new Map<string, MonthRow>();
  curves.forEach((c) => c.rows.forEach((r) => {
    const x = map.get(r.month) ?? { ...r, planned: 0, plannedStudy: 0, plannedExec: 0, actual: 0, actualStudy: 0, actualExec: 0, diff: 0, plannedAcc: 0, actualAcc: 0 };
    x.planned += r.planned; x.plannedStudy += r.plannedStudy; x.plannedExec += r.plannedExec;
    x.actual += r.actual; x.actualStudy += r.actualStudy; x.actualExec += r.actualExec;
    map.set(r.month, x);
  }));
  const rows = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  let pa = 0, aa = 0;
  rows.forEach((r) => { pa += r.planned; aa += r.actual; r.plannedAcc = pa; r.actualAcc = aa; r.diff = r.actual - r.planned; });
  return rows;
}

/* ============ Importação da planilha contábil ============ */

export type ParsedActual = {
  line: number;
  project_code: string;
  cost_center: string;
  competencia: string | null;
  amount: number | null;
  description?: string;
  supplier?: string;
  doc_number?: string;
  error?: string;
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIASES: Record<string, string[]> = {
  project_code: ["codigodoprojeto", "codigoprojeto", "codprojeto", "projeto", "codigo", "cap", "ordem", "ordeminterna"],
  cost_center: ["centrodecusto", "centrocusto", "cc", "ccusto", "centro"],
  competencia: ["competencia", "mes", "mesano", "periodo", "data", "datalancamento", "referencia"],
  amount: ["valor", "valorrs", "montante", "valorbrl", "total"],
  description: ["descricao", "historico", "descricaohistorico", "texto"],
  supplier: ["fornecedor", "razaosocial"],
  doc_number: ["documento", "ndocumento", "numerodocumento", "lancamento", "nlancamento", "doc"],
};

function toMonth(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-01`;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-01`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/); // MM/AAAA
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); // DD/MM/AAAA
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-01`;
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})/); // AAAA-MM
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  return null;
}
function toAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v == null || v === "") return null;
  let s = String(v).replace(/[R$\s]/g, "");
  const neg = /^\(.*\)$/.test(s); s = s.replace(/[()]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export async function parseActualsFile(file: File): Promise<{ rows: ParsedActual[]; missingColumns: string[] }> {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (!raw.length) return { rows: [], missingColumns: [] };
  const headers = Object.keys(raw[0]);
  const col: Record<string, string | undefined> = {};
  for (const [k, al] of Object.entries(ALIASES)) {
    col[k] = headers.find((h) => al.includes(norm(h))) ?? headers.find((h) => al.some((a) => a.length > 3 && norm(h).includes(a)));
  }
  const REQUIRED: Record<string, string> = { project_code: "Código do projeto", cost_center: "Centro de custo", competencia: "Competência", amount: "Valor" };
  const missingColumns = Object.entries(REQUIRED).filter(([k]) => !col[k]).map(([, l]) => l);
  if (missingColumns.length) return { rows: [], missingColumns };
  const rows = raw.map((r, i): ParsedActual => {
    const out: ParsedActual = {
      line: i + 2,
      project_code: String(r[col.project_code!] ?? "").trim().toUpperCase(),
      cost_center: String(r[col.cost_center!] ?? "").trim(),
      competencia: toMonth(r[col.competencia!]),
      amount: toAmount(r[col.amount!]),
      description: col.description ? String(r[col.description] ?? "").trim() || undefined : undefined,
      supplier: col.supplier ? String(r[col.supplier] ?? "").trim() || undefined : undefined,
      doc_number: col.doc_number ? String(r[col.doc_number] ?? "").trim() || undefined : undefined,
    };
    if (!out.project_code) out.error = "Sem código do projeto";
    else if (!out.competencia) out.error = "Competência inválida";
    else if (out.amount == null) out.error = "Valor inválido";
    return out;
  }).filter((r) => r.project_code || r.amount);
  return { rows, missingColumns };
}

export function downloadActualsTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    { "Código do projeto": "CAP-2026-001", "Centro de custo": "1010", "Competência": "01/2026", "Valor": 10000, "Descrição": "", "Fornecedor": "", "Nº documento": "" },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Realizado");
  XLSX.writeFile(wb, "modelo_realizado.xlsx");
}

export function exportManagerCurves(managerName: string, projects: { code: string | null; name: string }[], curves: ProjectCurve[]) {
  const fmtM = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
  const wb = XLSX.utils.book_new();
  const cons = sumCurves(curves).map((r) => ({
    "Mês": fmtM(r.month), "Previsto": r.planned, "Realizado": r.actual, "Desvio": r.diff,
    "Previsto acumulado": r.plannedAcc, "Realizado acumulado": r.actualAcc,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cons), "Consolidado");
  const det: Record<string, unknown>[] = [];
  curves.forEach((c, i) => c.rows.forEach((r) => det.push({
    "Código": projects[i]?.code ?? "", "Projeto": projects[i]?.name ?? "", "Base": c.version === "firme" ? "Firme" : "Indicativo",
    "Mês": fmtM(r.month), "Previsto estudo": r.plannedStudy, "Previsto execução": r.plannedExec, "Previsto": r.planned,
    "Realizado estudo": r.actualStudy, "Realizado execução": r.actualExec, "Realizado": r.actual, "Desvio": r.diff,
    "Previsto acumulado": r.plannedAcc, "Realizado acumulado": r.actualAcc,
  })));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(det), "Por projeto");
  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `acompanhamento_${managerName.replace(/\s+/g, "_")}_${ts}.xlsx`);
}
