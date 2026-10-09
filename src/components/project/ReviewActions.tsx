import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL, parseBRL } from "@/lib/labels";
import { AlertCircle, Sparkles } from "lucide-react";
import { DirectoriaActions } from "@/components/project/DirectoriaActions";

function useMissingDocs(projectId: string, stage: number) {
  return useQuery({
    queryKey: ["missing_required_docs", projectId, stage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("missing_required_docs", { p_project_id: projectId, p_stage: stage });
      if (error) throw error;
      return (data ?? []) as { id: string; key: string; label: string; required_for_stage: number }[];
    },
  });
}


export function ReviewActions({
  projectId,
  status,
  areaId,
  confirmedTotal,
  estimatedTotal,
  extraordinaryApproval,
}: {
  projectId: string;
  status: string;
  areaId: string;
  confirmedTotal: number | null;
  estimatedTotal?: number | null;
  extraordinaryApproval?: boolean;
}) {
  const { profile, primaryRole } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [risk, setRisk] = useState<"baixo" | "medio" | "alto">("medio");
  const [approvedText, setApprovedText] = useState(
    confirmedTotal != null ? Number(confirmedTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""
  );
  const [adjustMode, setAdjustMode] = useState(false);
  const [adjustText, setAdjustText] = useState(
    estimatedTotal != null ? Number(estimatedTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""
  );

  const { data: area } = useQuery({
    queryKey: ["area", areaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("id, director_id").eq("id", areaId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!areaId,
  });

  const invalidate = () => {
    setComment("");
    setAdjustMode(false);
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["history", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  type Status =
    | "submetido_intake" | "submetido_documentacao" | "devolvido_revisao" | "aguardando_cfo"
    | "retornado_backlog" | "aguardando_ceo" | "aguardando_diretor" | "pre_aprovado"
    | "em_revisao_fpa" | "liberado" | "liberado_parcial" | "reprovado" | "nao_aprovado";

  const act = useMutation({
    mutationFn: async ({ to, requireComment, extra }: { to: Status; requireComment?: boolean; extra?: Record<string, unknown> }) => {
      if (!profile) throw new Error("Sem sessão");
      if (requireComment && !comment.trim()) throw new Error("Informe uma justificativa.");
      const update: Record<string, unknown> = { status: to, ...extra };
      if (["liberado", "liberado_parcial", "reprovado", "nao_aprovado"].includes(to)) update.decided_at = new Date().toISOString();
      if (to === "pre_aprovado") update.decided_at = new Date().toISOString();
      const { error } = await supabase.from("projects").update(update as never).eq("id", projectId);
      if (error) throw error;
      await supabase.from("project_status_history").insert({
        project_id: projectId, from_status: status as never, to_status: to,
        actor_id: profile.id, actor_role: primaryRole, comment: comment.trim() || null,
      });
    },
    onSuccess: () => { toast.success("Decisão registrada"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const encaminharDiretor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("encaminhar_para_diretor", { p_project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Encaminhado ao Diretor da Área"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const decisaoDiretor = useMutation({
    mutationFn: async (aprovado: boolean) => {
      if (!comment.trim()) throw new Error("Informe uma justificativa.");
      const { error } = await supabase.rpc("decisao_diretor", {
        p_project_id: projectId,
        p_aprovado: aprovado,
        p_justificativa: comment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Decisão registrada"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // FP&A revisa submissão inicial (pré-aprovação).
  const isFpaIntake = primaryRole === "fpa" && status === "submetido_intake";
  // FP&A revisa projeto pré-aprovado ou já com documentação: encaminha ao CEO / Diretor.
  const isFpaRouting = primaryRole === "fpa" && (status === "submetido_documentacao");
  // FP&A responde a um pedido de revisão do gestor (em_revisao_fpa).
  const isFpaFeedback = primaryRole === "fpa" && status === "em_revisao_fpa";
  const isCeo = primaryRole === "ceo" && status === "aguardando_ceo";
  const isDirector =
    status === "aguardando_diretor" &&
    !!area?.director_id &&
    area.director_id === profile?.id;

  // Stage 1 (pré-aprovação) e Stage 2 (encaminhamento) — checklist de docs obrigatórios.
  const stageCheck = isFpaIntake ? 1 : isFpaRouting ? 2 : 0;
  const { data: missingDocs = [] } = useMissingDocs(projectId, stageCheck || 1);
  const blockedByDocs = stageCheck > 0 && missingDocs.length > 0;
  const missingLabels = missingDocs.map((d) => d.label).join(", ");

  if (!isFpaIntake && !isFpaRouting && !isFpaFeedback && !isCeo && !isDirector) return null;


  // Diretor de Área e CEO usam o mesmo conjunto de ações inline (Aprovar / Devolver / Reprovar).
  if (isDirector || isCeo) {
    return (
      <div className="space-y-3">
        {isCeo && extraordinaryApproval && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <Sparkles className="h-4 w-4 mt-0.5" />
            <div>Projeto com <strong>aprovação extraordinária do Diretor da Área</strong>.</div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {isCeo
            ? "Aprovação final da Diretoria. Devolva para revisão do gestor ou reprove caso a iniciativa não deva avançar neste ciclo."
            : "Aprovação extraordinária. Ao aprovar, o projeto segue automaticamente para deliberação final do CEO."}
        </p>
        <DirectoriaActions projectId={projectId} size="default" />
      </div>
    );
  }

  const busy = act.isPending || encaminharDiretor.isPending || decisaoDiretor.isPending;

  return (
    <div className="space-y-3">
      {blockedByDocs && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-medium">Documentos obrigatórios faltando</div>
            <div className="text-xs">{missingLabels}</div>
            <div className="mt-1 text-[11px] text-amber-900/80 dark:text-amber-200/80">Anexe os documentos faltantes para liberar as ações abaixo.</div>
          </div>
        </div>
      )}
      {isFpaRouting && (
        <div>
          <Label>Risco FP&A</Label>
          <Select value={risk} onValueChange={(v) => setRisk(v as typeof risk)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baixo">Baixo</SelectItem>
              <SelectItem value="medio">Médio</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isFpaIntake && adjustMode && (
        <div className="rounded-md border bg-muted/30 p-3">
          <Label htmlFor="adj">Valor pré-aprovado pelo FP&A (R$)</Label>
          <Input id="adj" inputMode="decimal" value={adjustText} onChange={(e) => setAdjustText(e.target.value)} placeholder="0,00" />
          <div className="mt-1 text-xs text-muted-foreground">
            Solicitado pelo gestor: {formatBRL(estimatedTotal ?? 0)} · Pré-aprovado: {formatBRL(parseBRL(adjustText))}
          </div>
        </div>
      )}

      <div>
        <Label>
          Justificativa / comentário
          {((isFpaIntake && adjustMode) || isFpaFeedback) && <span className="text-destructive"> *</span>}
        </Label>
        <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário sobre a decisão…" />
      </div>

      <div className="flex flex-col gap-2 pt-2">
        {isFpaIntake && (
          <>
            <Button
              onClick={() =>
                act.mutate({
                  to: "pre_aprovado",
                  extra: { fpa_approved_amount: Number(estimatedTotal ?? 0) },
                })
              }
              disabled={busy || blockedByDocs}
              title={blockedByDocs ? `Faltam documentos: ${missingLabels}` : undefined}
            >
              Pré-aprovar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!adjustMode) { setAdjustMode(true); return; }
                const adjusted = parseBRL(adjustText);
                if (adjusted <= 0) return toast.error("Informe o valor ajustado.");
                if (!comment.trim()) return toast.error("Justifique o ajuste do orçamento.");
                act.mutate({
                  to: "pre_aprovado",
                  extra: { fpa_approved_amount: adjusted },
                });
              }}
              disabled={busy || blockedByDocs}
              title={blockedByDocs ? `Faltam documentos: ${missingLabels}` : undefined}
            >
              {adjustMode ? "Confirmar pré-aprovação com ajuste" : "Pré-aprovar com ajuste de orçamento"}
            </Button>
            <Button variant="outline" onClick={() => act.mutate({ to: "devolvido_revisao", requireComment: true })} disabled={busy}>
              Devolver para revisão
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => act.mutate({ to: "nao_aprovado", requireComment: true })}
              disabled={busy}
            >
              Não aprovar
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Projetos "não aprovados" voltam ao hub do gestor quando o ciclo for arquivado, mantendo histórico para reenvio em ciclo futuro.
            </p>
          </>
        )}

        {isFpaFeedback && (
          <>
            <p className="text-xs text-muted-foreground">
              O gestor pediu revisão antes da submissão final. Devolva com feedback (obrigatório) para que ele ajuste a alocação.
            </p>
            <Button
              onClick={() => act.mutate({ to: "pre_aprovado", requireComment: true })}
              disabled={busy}
            >
              Devolver ao gestor com feedback
            </Button>
          </>
        )}

        {isFpaRouting && (
          <>
            <Button onClick={() => act.mutate({ to: "aguardando_ceo", extra: { fpa_risk: risk } })} disabled={busy || blockedByDocs}
              title={blockedByDocs ? `Faltam documentos: ${missingLabels}` : undefined}>
              Encaminhar à Diretoria (CEO)
            </Button>
            {!area?.director_id && (
              <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/30 p-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
                <div>Nenhum Diretor cadastrado para esta área. Cadastre em Administração &gt; Áreas para habilitar o fluxo extraordinário.</div>
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => encaminharDiretor.mutate()}
              disabled={busy || !area?.director_id || blockedByDocs}
              title={blockedByDocs ? `Faltam documentos: ${missingLabels}` : undefined}
            >
              Encaminhar ao Diretor da Área (extraordinário)
            </Button>
            <Button variant="outline" onClick={() => act.mutate({ to: "pre_aprovado", requireComment: true })} disabled={busy}>
              Devolver ao gestor para ajustes
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => act.mutate({ to: "reprovado", requireComment: true })} disabled={busy}>
              Reprovar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

