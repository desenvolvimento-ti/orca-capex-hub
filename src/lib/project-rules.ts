import { monthsBetween } from "@/lib/labels";
/**
 * Regras compartilhadas do fluxo por etapas.
 * Espelham as validações do servidor (stage1_missing / stage2_missing).
 */

export type Phase = "planejamento" | "execucao";
export type ScheduleRow = { period: string; phase: Phase; amount: number };

export type Pending = { label: string; anchor: string };
export type UploaderRole = "solicitante" | "executora" | "ambos";
export type RequiredDoc = { key: string; label: string; uploader_role?: UploaderRole | string | null };

/** Situações em que a proposta indicativa (etapa 1) está aberta para edição. */
export const STAGE1_EDITABLE = ["no_hub", "rascunho", "devolvido_pre", "no_ciclo", "retornado_backlog"];
/** Situações em que o projeto firme (etapa 2) está aberto para edição. */
export const STAGE2_EDITABLE = ["em_projeto_firme", "devolvido_orc"];
/** Situações a partir das quais a etapa 2 existe. */
export const STAGE2_STATUSES = ["em_projeto_firme", "devolvido_orc", "em_validacao_execucao", "aprovado_final", "reprovado_final", "estudo_concluido", "em_execucao", "concluido"];

export type Stage1Data = {
  name?: string | null;
  description?: string | null;
  justification?: string | null;
  study_amount?: number | null;
  execution_amount?: number | null;
  study_start_date?: string | null;
  execution_start_date?: string | null;
  execution_months?: number | null;
  payback_not_applicable?: boolean | null;
  payback_na_justification?: string | null;
  payback_months?: number | null;
  viability_summary?: string | null;
  branch_id?: string | null;
  business_unit_id?: string | null;
  executor_area_id?: string | null;
  already_in_execution?: boolean | null;
  cost_center?: string | null;
  indicativo_zero_months?: string[] | null;
};

export type Stage2Data = {
  study_start_date?: string | null;
  firm_study_amount?: number | null;
  firm_execution_amount?: number | null;
  firm_study_start_date?: string | null;
  firm_execution_start_date?: string | null;
  firm_execution_months?: number | null;
  cost_center?: string | null;
};

const cap = (m: Pending[]) => m.map((x) => ({ ...x, label: x.label.charAt(0).toUpperCase() + x.label.slice(1) }));
const blank = (s?: string | null) => !s || !s.trim();
const sum = (rows: ScheduleRow[], phase: Phase) => rows.filter((r) => r.phase === phase).reduce((s, r) => s + (Number(r.amount) || 0), 0);

/** Pendências da Etapa 1 separadas por responsável (área solicitante x área executora). */
export function stage1Split(p: Stage1Data, schedule: ScheduleRow[], docKeys: Set<string>, requiredDocs: RequiredDoc[] = []): { requester: Pending[]; executor: Pending[] } {
  const r: Pending[] = [];
  const e: Pending[] = [];
  if (blank(p.name)) r.push({ label: "nome", anchor: "f-name" });
  if (!p.branch_id) r.push({ label: "filial", anchor: "f-branch_id" });
  if (!p.business_unit_id) r.push({ label: "unidade de negócio", anchor: "f-business_unit_id" });
  if (!p.executor_area_id) r.push({ label: "área executora", anchor: "f-executor_area_id" });
  if (p.already_in_execution && !/^\d{6}$/.test(p.cost_center ?? "")) r.push({ label: "centro de custo (6 dígitos numéricos)", anchor: "f-cost_center" });
  if (blank(p.description)) r.push({ label: "descrição", anchor: "f-description" });
  if (blank(p.justification)) r.push({ label: "justificativa", anchor: "f-justification" });
  if (p.payback_not_applicable) {
    if (blank(p.payback_na_justification)) r.push({ label: "justificativa de payback não aplicável", anchor: "f-payback_na" });
  } else {
    if (!p.payback_months || Number(p.payback_months) <= 0) r.push({ label: "payback estimado", anchor: "f-payback_months" });
    if (blank(p.viability_summary)) r.push({ label: "premissas do payback", anchor: "f-viability_summary" });
  }
  const reqArea = (p as { area_id?: string | null }).area_id;
  const deleg = !!reqArea && !!p.executor_area_id && p.executor_area_id !== reqArea;
  for (const d of requiredDocs) if (!docKeys.has(d.key)) {
    const item = { label: `documento: ${d.label}`, anchor: "f-attachments" };
    if (deleg && d.uploader_role === "executora") e.push(item); else r.push(item);
  }

  if (p.study_amount == null || Number(p.study_amount) < 0) e.push({ label: "verba de planejamento", anchor: "f-study_amount" });
  if (p.execution_amount == null || Number(p.execution_amount) <= 0) e.push({ label: "verba de execução", anchor: "f-execution_amount" });
  if (!p.study_start_date) e.push({ label: "início do planejamento", anchor: "f-study_start_date" });
  if (!p.execution_start_date) e.push({ label: "início da execução", anchor: "f-execution_start_date" });
  if (p.study_start_date && p.execution_start_date && p.execution_start_date <= p.study_start_date)
    e.push({ label: "início da execução deve ser posterior ao início do planejamento", anchor: "f-execution_start_date" });
  if (!p.execution_months || p.execution_months < 1) e.push({ label: "prazo de execução", anchor: "f-execution_months" });
  if (Math.abs(sum(schedule, "planejamento") - (Number(p.study_amount) || 0)) > 0.01)
    e.push({ label: "cronograma de planejamento diferente da verba de planejamento", anchor: "f-schedule" });
  if (Math.abs(sum(schedule, "execucao") - (Number(p.execution_amount) || 0)) > 0.01)
    e.push({ label: "cronograma de execução diferente da verba de execução", anchor: "f-schedule" });
  const zeroOk = new Set(p.indicativo_zero_months ?? []);
  const filled = new Set(schedule.filter((x) => Number(x.amount) > 0).map((x) => `${x.phase}:${x.period}`));
  for (const m of scheduleMonths(p.study_start_date, p.execution_start_date, p.execution_months)) {
    const k = `${m.phase}:${m.iso}`;
    if (!filled.has(k) && !zeroOk.has(k)) e.push({ label: `mês ${m.label} (${m.phase === "planejamento" ? "planejamento" : "execução"}) sem desembolso previsto não confirmado`, anchor: "f-schedule" });
  }
  return { requester: cap(r), executor: cap(e) };
}

export function stage1Pending(p: Stage1Data, schedule: ScheduleRow[], docKeys: Set<string>, requiredDocs: RequiredDoc[] = []): Pending[] {
  const s = stage1Split(p, schedule, docKeys, requiredDocs);
  return [...s.requester, ...s.executor];
}

/** Há outra área executora designada? */
export function isDelegated(p: { area_id?: string | null; executor_area_id?: string | null }) {
  return !!p.executor_area_id && p.executor_area_id !== p.area_id;
}

export function stage2Pending(p: Stage2Data, schedule: ScheduleRow[], docKeys: Set<string>, requiredDocs: RequiredDoc[] = []): Pending[] {
  const m: Pending[] = [];
  if (!/^\d{6}$/.test(p.cost_center ?? "")) m.push({ label: "centro de custo (6 dígitos numéricos)", anchor: "g-cost_center" });
  if (p.firm_execution_amount == null || Number(p.firm_execution_amount) <= 0) m.push({ label: "verba de execução", anchor: "g-execution_amount" });
  if (!p.firm_execution_start_date) m.push({ label: "início da execução", anchor: "g-execution_start_date" });
  const ps = p.firm_study_start_date || p.study_start_date;
  if (ps && p.firm_execution_start_date && p.firm_execution_start_date <= ps) m.push({ label: "início da execução deve ser posterior ao início do planejamento", anchor: "g-execution_start_date" });
  if (!p.firm_execution_months || p.firm_execution_months < 1) m.push({ label: "prazo de execução", anchor: "g-execution_months" });
  for (const d of requiredDocs) if (!docKeys.has(d.key)) m.push({ label: `documento: ${d.label}`, anchor: "g-attachments" });
  if (Math.abs(sum(schedule, "execucao") - (Number(p.firm_execution_amount) || 0)) > 0.01)
    m.push({ label: "cronograma de execução diferente da verba de execução", anchor: "g-schedule" });
  return cap(m);
}

/** Fim da execução = último dia do mês (início + prazo - 1). */
export function executionEnd(start?: string | null, months?: number | null): string | null {
  if (!start || !months || months < 1) return null;
  const d = new Date(start + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 0));
  return end.toISOString().slice(0, 10);
}

export function isPast(date?: string | null): boolean {
  if (!date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return date < today;
}

/** Situação visível ao gestor (inclui as calculadas). */
export function situationLabel(status: string, pendingCount: number): string | null {
  if (STAGE1_EDITABLE.includes(status) && status !== "devolvido_pre") {
    return pendingCount > 0 ? "Pendente" : "Aguardando submissão";
  }
  return null;
}

export function scrollToAnchor(anchor: string) {
  const el = document.getElementById(anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = (el.matches("input,textarea,button") ? el : el.querySelector("input,textarea,button")) as HTMLElement | null;
  setTimeout(() => focusable?.focus(), 300);
}

/**
 * Linhas do cronograma: meses de estudo (do início do estudo até o mês de início da execução)
 * e meses de execução (início da execução + prazo).
 */
export function scheduleMonths(studyStart?: string | null, execStart?: string | null, execMonths?: number | null) {
  const end = executionEnd(execStart, execMonths);
  if (!studyStart || !execStart || !end || execStart <= studyStart) return [];
  const execMonthIso = execStart.slice(0, 7) + "-01";
  const studyLast = execStart.slice(8, 10) === "01"
    ? (() => { const [y, m] = execStart.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 10); })()
    : execMonthIso;
  const studyRows = studyLast >= studyStart.slice(0, 7) + "-01"
    ? monthsBetween(studyStart.slice(0, 7) + "-01", studyLast).map((m) => ({ ...m, phase: "planejamento" as Phase }))
    : [];
  const execRows = monthsBetween(execMonthIso, end).map((m) => ({ ...m, phase: "execucao" as Phase }));
  return [...studyRows, ...execRows].sort((a, b) => a.iso.localeCompare(b.iso) || (a.phase === "planejamento" ? -1 : 1));
}
