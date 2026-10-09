// SLA / Aging helpers for project statuses
import type { STATUS_LABEL } from "@/lib/labels";

type Status = keyof typeof STATUS_LABEL;

/** Limite (em dias) que um projeto deveria permanecer no status antes de ser considerado atrasado. */
export const SLA_THRESHOLDS: Partial<Record<Status, number>> = {
  submetido_intake: 3,
  submetido_documentacao: 3,
  em_revisao_fpa: 5,
  aguardando_diretor: 5,
  aguardando_cfo: 5,
  aguardando_ceo: 5,
  pre_aprovado: 7,
  devolvido_revisao: 7,
  aguardando_submissao: 7,
};

export type SlaLevel = "ok" | "atencao" | "atrasado" | "none";

export function slaThresholdFor(status: string): number | null {
  return SLA_THRESHOLDS[status as Status] ?? null;
}

export function daysBetween(fromIso: string | null | undefined, to: Date = new Date()): number {
  if (!fromIso) return 0;
  const t = new Date(fromIso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((to.getTime() - t) / 86_400_000));
}

export function slaLevel(days: number, threshold: number | null): SlaLevel {
  if (threshold == null) return "none";
  if (days > threshold) return "atrasado";
  if (days >= Math.ceil(threshold * 0.8)) return "atencao";
  return "ok";
}

/**
 * Para uma lista de projetos, recebe um Map projectId -> data ISO da última
 * mudança de status (vinda de project_status_history) e retorna helpers.
 */
export type SlaInfo = { days: number; threshold: number | null; level: SlaLevel };

export function computeSla(status: string, lastChangeIso: string | null | undefined): SlaInfo {
  const threshold = slaThresholdFor(status);
  const days = daysBetween(lastChangeIso);
  return { days, threshold, level: slaLevel(days, threshold) };
}
