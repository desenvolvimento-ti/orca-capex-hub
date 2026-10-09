import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, ROLE_TITLE, formatMonthShortBR, monthsBetween, type AppRole } from "@/lib/labels";

function download(wb: XLSX.WorkBook, filename: string) {
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, `${filename}_${ts}.xlsx`);
}

function autoWidth(rows: Record<string, unknown>[]): XLSX.ColInfo[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k) => {
    const max = Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length));
    return { wch: Math.min(Math.max(max + 2, 10), 50) };
  });
}

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");
const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

/* ============ 1. Lista de Projetos ============ */
export async function exportProjectsList() {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "code, name, status, category, priority, estimated_total, confirmed_total, fpa_approved_amount, ceo_approved_amount, est_start_date, est_end_date, execution_start_date, execution_end_date, planning_end_date, submitted_at, decided_at, created_at, areas:areas!projects_area_id_fkey(name), cycles(name, year), owner_id"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as any[];

  const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter(Boolean)));
  const ownerMap = new Map<string, string>();
  if (ownerIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
    (profs ?? []).forEach((p: any) => ownerMap.set(p.id, p.full_name));
  }

  const out = rows.map((r) => ({
    Código: r.code ?? "—",
    Nome: r.name,
    Status: (STATUS_LABEL as any)[r.status] ?? r.status,
    Categoria: r.category ?? "",
    Prioridade: r.priority ?? "",
    Área: r.areas?.name ?? "",
    Gestor: ownerMap.get(r.owner_id) ?? "",
    Ciclo: r.cycles ? `${r.cycles.name} (${r.cycles.year})` : "Hub",
    "Valor Estimado (R$)": Number(r.estimated_total ?? 0),
    "Valor Confirmado (R$)": Number(r.confirmed_total ?? 0),
    "Valor Pré-Aprovado FP&A (R$)": Number(r.fpa_approved_amount ?? 0),
    "Valor Aprovado CEO (R$)": Number(r.ceo_approved_amount ?? 0),
    "Início Estimado": fmtDate(r.est_start_date),
    "Fim Estimado": fmtDate(r.est_end_date),
    "Início Execução": fmtDate(r.execution_start_date),
    "Fim Execução": fmtDate(r.execution_end_date),
    "Fim Planejamento": fmtDate(r.planning_end_date),
    "Submetido em": fmtDateTime(r.submitted_at),
    "Decidido em": fmtDateTime(r.decided_at),
    "Criado em": fmtDateTime(r.created_at),
  }));

  const ws = XLSX.utils.json_to_sheet(out);
  ws["!cols"] = autoWidth(out);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Projetos");
  download(wb, "capex_projetos");
}

/* ============ 2. Cronograma Consolidado por Ciclo ============ */
export async function exportCycleSchedule(cycleId?: string) {
  const cyclesQ = cycleId
    ? supabase.from("cycles").select("id, name, year").eq("id", cycleId)
    : supabase.from("cycles").select("id, name, year").order("year", { ascending: false });
  const { data: cycles, error: ce } = await cyclesQ;
  if (ce) throw ce;
  if (!cycles?.length) throw new Error("Nenhum ciclo encontrado");

  const wb = XLSX.utils.book_new();

  for (const c of cycles as any[]) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, code, name, est_start_date, est_end_date, execution_start_date, execution_end_date, planning_end_date, ceo_approved_amount, confirmed_total, estimated_total, areas:areas!projects_area_id_fkey(name)")
      .eq("cycle_id", c.id);
    const ps = (projects ?? []) as any[];
    if (!ps.length) continue;

    const allStart = ps
      .map((p) => p.execution_start_date ?? p.est_start_date)
      .filter(Boolean)
      .sort()[0];
    const allEnd = ps
      .map((p) => p.execution_end_date ?? p.planning_end_date ?? p.est_end_date)
      .filter(Boolean)
      .sort()
      .reverse()[0];
    const months = monthsBetween(allStart, allEnd);

    const ids = ps.map((p) => p.id);
    const { data: disb } = await supabase
      .from("disbursements")
      .select("project_id, period, amount")
      .in("project_id", ids);
    const byProj = new Map<string, Map<string, number>>();
    (disb ?? []).forEach((d: any) => {
      const m = byProj.get(d.project_id) ?? new Map();
      m.set(String(d.period), (m.get(String(d.period)) ?? 0) + Number(d.amount));
      byProj.set(d.project_id, m);
    });

    const out = ps.map((p) => {
      const row: Record<string, any> = {
        Código: p.code ?? "—",
        Nome: p.name,
        Área: p.areas?.name ?? "",
        "Aprovado (R$)": Number(p.ceo_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0),
      };
      let total = 0;
      const m = byProj.get(p.id) ?? new Map();
      months.forEach((mo) => {
        const v = m.get(mo.iso) ?? 0;
        row[formatMonthShortBR(mo.iso)] = v || "";
        total += v;
      });
      row["Total Cronograma (R$)"] = total;
      row["Saldo (R$)"] = Number(row["Aprovado (R$)"]) - total;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(out);
    ws["!cols"] = autoWidth(out);
    const sheetName = `${c.name} ${c.year}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  if (!wb.SheetNames.length) throw new Error("Nenhum projeto com cronograma encontrado nos ciclos.");
  download(wb, "capex_cronograma");
}

/* ============ 3. Histórico de Aprovações ============ */
export async function exportApprovalHistory() {
  const { data, error } = await supabase
    .from("project_status_history")
    .select("from_status, to_status, comment, actor_id, actor_role, created_at, projects(code, name)")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean)));
  const actorMap = new Map<string, string>();
  if (actorIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
    (profs ?? []).forEach((p: any) => actorMap.set(p.id, p.full_name));
  }

  const out = rows.map((r) => ({
    "Data/Hora": fmtDateTime(r.created_at),
    Código: r.projects?.code ?? "—",
    Projeto: r.projects?.name ?? "",
    "De (status)": r.from_status ? (STATUS_LABEL as any)[r.from_status] ?? r.from_status : "",
    "Para (status)": (STATUS_LABEL as any)[r.to_status] ?? r.to_status,
    Ator: actorMap.get(r.actor_id) ?? "",
    Cargo: r.actor_role ? (ROLE_TITLE as any)[r.actor_role as AppRole] ?? r.actor_role : "",
    Comentário: r.comment ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(out);
  ws["!cols"] = autoWidth(out);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Histórico");
  download(wb, "capex_historico_aprovacoes");
}

/* ============ 4. Financeiro Consolidado (Planejado vs Realizado) ============ */
export async function exportFinanceiroConsolidado(filters?: { cycleId?: string; areaId?: string }) {
  let q = supabase
    .from("projects")
    .select("id, code, name, cycle_id, area_id, status, estimated_total, confirmed_total, ceo_approved_amount, fpa_approved_amount, areas:areas!projects_area_id_fkey(name), cycles(name, year)")
    .in("status", ["liberado", "liberado_parcial"]);
  if (filters?.cycleId && filters.cycleId !== "all") q = q.eq("cycle_id", filters.cycleId);
  if (filters?.areaId && filters.areaId !== "all") q = q.eq("area_id", filters.areaId);
  const { data: projs, error } = await q;
  if (error) throw error;
  const ps = (projs ?? []) as any[];
  if (!ps.length) throw new Error("Nenhum projeto liberado para exportar");

  const ids = ps.map((p) => p.id);
  const { data: disb } = await supabase
    .from("disbursements")
    .select("project_id, period, amount, realized_amount")
    .in("project_id", ids);
  const rows = (disb ?? []) as any[];

  const out = ps.map((p) => {
    const myRows = rows.filter((d) => d.project_id === p.id);
    const plan = myRows.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const real = myRows.reduce((s, d) => s + Number(d.realized_amount ?? 0), 0);
    const approved = Number(p.ceo_approved_amount ?? p.fpa_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0);
    return {
      Código: p.code ?? "—",
      Projeto: p.name,
      Área: p.areas?.name ?? "",
      Ciclo: p.cycles ? `${p.cycles.name} (${p.cycles.year})` : "—",
      "Aprovado (R$)": approved,
      "Planejado (R$)": plan,
      "Realizado (R$)": real,
      "Variação (R$)": real - plan,
      "Saldo (R$)": approved - plan,
      "% Execução": approved > 0 ? Number((real / approved * 100).toFixed(2)) : 0,
    };
  });

  const ws = XLSX.utils.json_to_sheet(out);
  ws["!cols"] = autoWidth(out);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Por Projeto");

  // Sheet 2: mensal
  const periods = Array.from(new Set(rows.map((d) => String(d.period)))).sort();
  if (periods.length) {
    const monthRows = periods.map((iso) => {
      const r = rows.filter((d) => String(d.period) === iso);
      return {
        Mês: formatMonthShortBR(iso),
        "Planejado (R$)": r.reduce((s, d) => s + Number(d.amount ?? 0), 0),
        "Realizado (R$)": r.reduce((s, d) => s + Number(d.realized_amount ?? 0), 0),
      };
    });
    const ws2 = XLSX.utils.json_to_sheet(monthRows);
    ws2["!cols"] = autoWidth(monthRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Mensal");
  }
  download(wb, "capex_financeiro");
}

/* ============ 5. Acompanhamento EVEF (projetos flagados) ============ */
export async function exportAcompanhamentoEvef() {
  const { data: projs, error } = await supabase
    .from("projects")
    .select("id, code, name, area_id, status, payback_months, estimated_total, confirmed_total, ceo_approved_amount, owner_id, concluido_em, areas:areas!projects_area_id_fkey(name), cycles(name, year)")
    .eq("flag_acompanhamento", true)
    .order("code", { ascending: true });
  if (error) throw error;
  const ps = (projs ?? []) as any[];
  if (!ps.length) throw new Error("Nenhum projeto flagado para acompanhamento EVEF");

  const ids = ps.map((p) => p.id);
  const [{ data: disb }, { data: owners }] = await Promise.all([
    supabase.from("disbursements").select("project_id, amount, realized_amount").in("project_id", ids),
    supabase.from("profiles").select("id, full_name, email, phone").in("id", ps.map((p) => p.owner_id).filter(Boolean)),
  ]);
  const drows = (disb ?? []) as any[];
  const ownerMap = new Map((owners ?? []).map((o: any) => [o.id, o]));

  const out = ps.map((p) => {
    const my = drows.filter((d) => d.project_id === p.id);
    const plan = my.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    const real = my.reduce((s, d) => s + Number(d.realized_amount ?? 0), 0);
    const aprov = Number(p.ceo_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0);
    const owner = p.owner_id ? ownerMap.get(p.owner_id) : null;
    return {
      Código: p.code ?? "",
      Projeto: p.name,
      Área: p.areas?.name ?? "",
      Ciclo: p.cycles ? `${p.cycles.name} (${p.cycles.year})` : "",
      Status: STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] ?? p.status,
      "Payback (meses)": p.payback_months ?? "",
      "Valor aprovado (R$)": aprov,
      "Planejado (R$)": plan,
      "Realizado (R$)": real,
      "Variação (R$)": real - plan,
      "% Execução": aprov > 0 ? Number(((real / aprov) * 100).toFixed(1)) : 0,
      "Concluído em": fmtDate(p.concluido_em),
      Gestor: (owner as any)?.full_name ?? "",
      "E-mail gestor": (owner as any)?.email ?? "",
      "Telefone gestor": (owner as any)?.phone ?? "",
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(out);
  ws["!cols"] = autoWidth(out);
  XLSX.utils.book_append_sheet(wb, ws, "Acompanhamento EVEF");
  download(wb, "capex_evef");
}

/* ============ Submissões recebidas (consolidação FP&A) ============ */
export async function exportSubmissoes(year?: number) {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "code, name, status, category, priority, estimated_total, est_start_date, est_end_date, description, justification, viability_summary, payback_months, study_amount, execution_amount, study_start_date, execution_start_date, execution_months, submitted_at, created_at, owner_id, areas:areas!projects_area_id_fkey(name)"
    )
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  let rows = (data ?? []) as any[];
  if (year) rows = rows.filter((r) => new Date(r.submitted_at).getFullYear() === year);
  if (!rows.length) throw new Error("Nenhuma submissão para exportar");

  const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter(Boolean)));
  const ownerMap = new Map<string, string>();
  if (ownerIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
    (profs ?? []).forEach((p: any) => ownerMap.set(p.id, p.full_name));
  }

  const out = rows.map((r) => ({
    Código: r.code ?? "—",
    Nome: r.name,
    Status: (STATUS_LABEL as any)[r.status] ?? r.status,
    Área: r.areas?.name ?? "",
    Gestor: ownerMap.get(r.owner_id) ?? "",
    Categoria: r.category ?? "",
    Prioridade: r.priority ?? "",
    "Valor Estimado (R$)": Number(r.estimated_total ?? 0),
    "Início Estimado": fmtDate(r.est_start_date),
    "Fim Estimado": fmtDate(r.est_end_date),
    "Verba de planejamento": Number(r.study_amount ?? 0),
    "Verba de execução": Number(r.execution_amount ?? 0),
    "Início do planejamento": r.study_start_date ?? "",
    "Início da execução": r.execution_start_date ?? "",
    "Prazo de execução (meses)": r.execution_months ?? "",
    "Payback (meses)": r.payback_months ?? "",
    "Submetido em": fmtDateTime(r.submitted_at),
    "Mês/Ano da submissão": r.submitted_at
      ? new Date(r.submitted_at).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })
      : "",
    Descrição: r.description ?? "",
    Justificativa: r.justification ?? "",
    "Premissas": r.viability_summary ?? "",
  }));

  const resumoMap = new Map<string, { Período: string; Projetos: number; "Valor (R$)": number }>();
  rows.forEach((r) => {
    const d = new Date(r.submitted_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cur = resumoMap.get(key) ?? { Período: key, Projetos: 0, "Valor (R$)": 0 };
    cur.Projetos += 1;
    cur["Valor (R$)"] += Number(r.estimated_total ?? 0);
    resumoMap.set(key, cur);
  });
  const resumo = Array.from(resumoMap.values()).sort((a, b) => b.Período.localeCompare(a.Período));

  const wb = XLSX.utils.book_new();
  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  wsResumo["!cols"] = autoWidth(resumo as any);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo por período");
  const ws = XLSX.utils.json_to_sheet(out);
  ws["!cols"] = autoWidth(out);
  XLSX.utils.book_append_sheet(wb, ws, "Submissões");
  download(wb, year ? `capex_submissoes_${year}` : "capex_submissoes");
}
