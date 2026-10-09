/**
 * Escopo do lançamento.
 *
 * Fase 1 (atual): submissão contínua de projetos + consolidação para pré-aprovação.
 * As etapas 3 a 5 (orçamentação/aprovação final, execução, acompanhamento EVEF)
 * estão implementadas, porém ocultas. Basta ligar a chave abaixo para liberá-las.
 */
export const STAGES_3_TO_5_ENABLED = false;

/** Status das etapas ainda não liberadas no lançamento. */
const HIDDEN_STAGE_STATUSES = new Set([
  "aguardando_documentacao",
  "em_analise_fpa_orc",
  "aguardando_diretoria_final",
  "em_execucao",
  "concluido",
  "aguardando_submissao",
  "submetido_documentacao",
  "aguardando_diretor",
  "aguardando_cfo",
  "aguardando_ceo",
  "liberado",
  "liberado_parcial",
  "pre_aprovado",
]);

/**
 * Enquanto as etapas seguintes estão desligadas, projetos pré-aprovados
 * mostram um rótulo de espera em vez de apontar para telas ocultas.
 */
export function isAwaitingNextPhase(status: string): boolean {
  return !STAGES_3_TO_5_ENABLED && HIDDEN_STAGE_STATUSES.has(status);
}
