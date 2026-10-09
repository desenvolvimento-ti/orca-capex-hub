// Portuguese (Brazil) labels and formatters
export type AppRole = "manager" | "fpa" | "cfo" | "ceo" | "cco" | "cmo";

export const ROLE_LABEL: Record<AppRole, string> = {
  manager: "Gestor",
  fpa: "Admin",
  cfo: "Diretoria",
  ceo: "Diretoria",
  cco: "Diretoria",
  cmo: "Diretoria",
};

/** Cargo detalhado (usado quando queremos diferenciar CCO/CMO/CFO/CEO no select de cadastro) */
export const ROLE_TITLE: Record<AppRole, string> = {
  manager: "Gestor",
  fpa: "Admin",
  cfo: "Diretoria (CFO)",
  ceo: "Diretoria (CEO)",
  cco: "Diretoria (CCO)",
  cmo: "Diretoria (CMO)",
};


export const CATEGORY_LABEL = {
  implementacao_novos_negocios: "Implementação de Novos Negócios",
  aprimoramento_negocios_existentes: "Aprimoramento de Negócios Existentes",
  manutencao_extraordinaria: "Manutenção Extraordinária",
  intangivel_ti: "Intangível / TI",
  ativo_biologico: "Ativo Biológico",
  // categorias antigas (mantidas para projetos existentes)
  novos_negocios: "Novos Negócios",
  infraestrutura_crescimento: "Infraestrutura de Suporte ao Crescimento",
  manutencao_recorrente: "Manutenção Recorrente",
  manutencao_ciclica_estrutural: "Manutenção Cíclica/Estrutural",
  experiencia_cliente: "Experiência do Cliente",
  eficiencia_operacional: "Eficiência Operacional",
  infraestrutura_colaboradores: "Infraestrutura para Colaboradores",
} as const;

/** Categorias disponíveis para novos cadastros. */
export const ACTIVE_CATEGORIES = [
  "implementacao_novos_negocios",
  "aprimoramento_negocios_existentes",
  "manutencao_extraordinaria",
] as const;

export const PRIORITY_LABEL = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
} as const;

export const STATUS_LABEL = {
  // Etapa 1 — Levantamento (Hub)
  no_hub: "Em elaboração",
  no_ciclo: "No ciclo (a submeter)",
  rascunho: "Rascunho",
  // Etapa 2 — Pré-análise
  em_pre_analise_fpa: "Submetido",
  aguardando_diretoria_prev: "Submetido",
  devolvido_pre: "Devolvido para ajuste",
  nao_aprovado_pre: "Rejeitado",
  em_projeto_firme: "Pré-aprovado",
  em_validacao_execucao: "Validação",
  estudo_concluido: "Projeto firme concluído (execução não aprovada)",
  // Etapa 3 — Orçamentação e aprovação final
  aguardando_documentacao: "Aguardando documentação",
  em_analise_fpa_orc: "Em análise FP&A (orçamentação)",
  aguardando_diretoria_final: "Aguardando aprovação final",
  devolvido_orc: "Projeto firme devolvido para ajuste",
  aprovado_final: "Liberado para execução",
  reprovado_final: "Execução não aprovada",
  // Etapa 4 e 5 — Execução e conclusão
  em_execucao: "Em execução",
  concluido: "Concluído",
  // Legados (mantidos para compatibilidade — migração já reclassificou existentes)
  submetido_intake: "Submetido",
  pre_aprovado: "Pré-aprovado",
  postergado: "Não aprovado",
  cancelado: "Não aprovado",
  nao_aprovado: "Não aprovado",
  aguardando_submissao: "Aguardando documentação",
  submetido_documentacao: "Em análise FP&A",
  em_revisao_fpa: "Submetido",
  devolvido_revisao: "Devolvido",
  aguardando_diretor: "Aguardando Diretoria",
  aguardando_cfo: "Aguardando Diretoria",
  aguardando_ceo: "Aguardando Diretoria",
  retornado_backlog: "Em elaboração",
  liberado: "Em execução",
  liberado_parcial: "Em execução",
  reprovado: "Reprovado",
} as const;


export const STATUS_TONE: Record<keyof typeof STATUS_LABEL, "neutral" | "info" | "warn" | "success" | "danger"> = {
  no_hub: "neutral",
  no_ciclo: "neutral",
  rascunho: "neutral",
  em_pre_analise_fpa: "info",
  aguardando_diretoria_prev: "warn",
  devolvido_pre: "warn",
  nao_aprovado_pre: "danger",
  em_projeto_firme: "success",
  em_validacao_execucao: "info",
  estudo_concluido: "neutral",
  aguardando_documentacao: "warn",
  em_analise_fpa_orc: "info",
  aguardando_diretoria_final: "warn",
  devolvido_orc: "warn",
  aprovado_final: "success",
  reprovado_final: "danger",
  em_execucao: "success",
  concluido: "success",
  // legados
  submetido_intake: "info",
  pre_aprovado: "success",
  postergado: "danger",
  cancelado: "danger",
  nao_aprovado: "danger",
  aguardando_submissao: "warn",
  submetido_documentacao: "info",
  em_revisao_fpa: "info",
  devolvido_revisao: "warn",
  aguardando_diretor: "warn",
  aguardando_cfo: "warn",
  aguardando_ceo: "warn",
  retornado_backlog: "neutral",
  liberado: "success",
  liberado_parcial: "success",
  reprovado: "danger",
};

/** Etapas do fluxo (matriz do chefe). */
export function etapaDoStatus(status: string): 1 | 2 | 3 | 4 | 5 {
  if (["no_hub", "no_ciclo", "rascunho", "retornado_backlog"].includes(status)) return 1;
  if (["em_pre_analise_fpa", "aguardando_diretoria_prev", "devolvido_pre", "nao_aprovado_pre",
       "submetido_intake", "em_revisao_fpa", "pre_aprovado"].includes(status)) return 2;
  if (["aguardando_documentacao", "em_analise_fpa_orc", "aguardando_diretoria_final",
       "devolvido_orc", "aprovado_final", "reprovado_final",
       "aguardando_submissao", "submetido_documentacao",
       "aguardando_diretor", "aguardando_cfo", "aguardando_ceo",
       "devolvido_revisao", "postergado", "cancelado", "nao_aprovado", "reprovado"].includes(status)) return 3;
  if (["em_execucao", "liberado", "liberado_parcial"].includes(status)) return 4;
  if (["concluido"].includes(status)) return 5;
  return 1;
}

/** Status que representam decisão final negativa. */
export const NAO_APROVADO_STATUSES = ["nao_aprovado_pre", "reprovado_final", "nao_aprovado", "postergado", "cancelado", "reprovado"] as const;

/** Status que aguardam ação do gestor. */
export const MANAGER_ACTION_STATUSES = ["devolvido_pre", "devolvido_orc", "aguardando_documentacao", "pre_aprovado", "devolvido_revisao", "em_revisao_fpa", "liberado", "liberado_parcial"] as const;

/** Status encaminhados à Diretoria. */
export const DIRECTORIA_STATUSES = ["aguardando_diretoria_prev", "aguardando_diretoria_final", "aguardando_diretor", "aguardando_cfo", "aguardando_ceo"] as const;

/** Status em análise pelo FP&A. */
export const FPA_ANALYSIS_STATUSES = ["em_pre_analise_fpa", "em_analise_fpa_orc", "submetido_intake", "submetido_documentacao"] as const;

/** Status aprovados / em execução. */
export const APROVADO_STATUSES = ["aprovado_final", "em_execucao", "concluido", "liberado", "liberado_parcial"] as const;

export const PHASE_LABEL = { planejamento: "Estudo/projeto", execucao: "Execução" } as const;

export const WINDOW_LABEL = {
  submissao: "Submissão",
  analise: "Análise de Pré-Aprovação",
  em_vigencia: "Em vigência",
  pausa: "Em pausa entre janelas",
  fechado: "Fechado",
} as const;

export type CyclePeriod = keyof typeof WINDOW_LABEL;

export const PERIOD_TONE: Record<CyclePeriod, "success" | "info" | "muted"> = {
  submissao: "success",
  analise: "info",
  em_vigencia: "success",
  pausa: "muted",
  fechado: "muted",
};

export function cyclePeriodFromDates(c: {
  submission_start?: string | null;
  submission_end?: string | null;
  analysis_start?: string | null;
  analysis_end?: string | null;
  cycle_start_date?: string | null;
  cycle_end_date?: string | null;
} | null | undefined, at: Date = new Date()): CyclePeriod {
  if (!c) return "fechado";
  const t = at.getTime();
  const inRange = (s?: string | null, e?: string | null) => {
    if (!s || !e) return false;
    const st = new Date(s).getTime();
    const et = new Date(e).getTime();
    return Number.isFinite(st) && Number.isFinite(et) && t >= st && t <= et;
  };
  if (inRange(c.submission_start, c.submission_end)) return "submissao";
  if (inRange(c.analysis_start, c.analysis_end)) return "analise";
  if (inRange(c.cycle_start_date, c.cycle_end_date)) return "em_vigencia";

  if (c.cycle_end_date && t > new Date(c.cycle_end_date).getTime()) return "fechado";

  const future = [c.submission_start, c.analysis_start, c.cycle_start_date]
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .filter((ts) => Number.isFinite(ts) && ts > t);
  if (future.length > 0) return "pausa";

  return "fechado";
}

export const RISK_LABEL = { baixo: "Risco baixo", medio: "Risco médio", alto: "Risco alto" } as const;
export const RISK_TONE: Record<keyof typeof RISK_LABEL, "success" | "warn" | "danger"> = {
  baixo: "success", medio: "warn", alto: "danger",
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return brl.format(Number.isFinite(n as number) ? (n as number) : 0);
}

export function parseBRL(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatDateBR(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatMonthBR(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
}

/** Returns "MAI/26" style month label */
export function formatMonthShortBR(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const MONTHS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const m = MONTHS[d.getUTCMonth()];
  const y = String(d.getUTCFullYear()).slice(-2);
  return `${m}/${y}`;
}

export function toISODate(year: number, month0: number): string {
  // returns YYYY-MM-01
  const m = String(month0 + 1).padStart(2, "0");
  return `${year}-${m}-01`;
}

export function monthsBetween(startISO?: string | null, endISO?: string | null): { y: number; m: number; iso: string; label: string }[] {
  if (!startISO || !endISO) return [];
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) return [];
  const out: { y: number; m: number; iso: string; label: string }[] = [];
  let y = s.getUTCFullYear();
  let m = s.getUTCMonth();
  const ey = e.getUTCFullYear();
  const em = e.getUTCMonth();
  while (y < ey || (y === ey && m <= em)) {
    const iso = toISODate(y, m);
    out.push({
      y, m, iso,
      label: `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][m]}/${y}`,
    });
    m++;
    if (m > 11) { m = 0; y++; }
    if (out.length > 120) break;
  }
  return out;
}

/** Reduz um nome completo ao primeiro e último sobrenome. Ex.: "Rodrigo Guedes Ferro" -> "Rodrigo Ferro". */
export function shortName(full?: string | null) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}
