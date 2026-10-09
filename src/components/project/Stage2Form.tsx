import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatBRL, parseBRL } from "@/lib/labels";
import { Sparkles } from "lucide-react";

export type Stage2Initial = {
  status: string;
  est_start_date: string | null;
  est_end_date: string | null;
  planning_end_date: string | null;
  execution_start_date?: string | null;
  execution_end_date: string | null;
  total_planning: number | null;
  total_execution: number | null;
  confirmed_total: number | null;
  fpa_approved_amount: number | null;
  estimated_total: number | null;
};

export function Stage2Form({
  projectId,
  initial,
  canEdit,
  onRequestReview,
  reviewPending,
  onFinalSubmit,
  finalSubmitPending,
}: {
  projectId: string;
  initial: Stage2Initial;
  canEdit: boolean;
  onRequestReview?: (() => void) | null;
  reviewPending?: boolean;
  onFinalSubmit?: (() => void) | null;
  finalSubmitPending?: boolean;
}) {
  const { profile } = useAuth();
  const qc = useQueryClient();

  // Datas e valores divididos em planejamento / execução
  const [planStart, setPlanStart] = useState(initial.est_start_date ?? "");
  const [planEnd, setPlanEnd] = useState(initial.planning_end_date ?? "");
  const [execStart, setExecStart] = useState(initial.execution_start_date ?? "");
  const [execEnd, setExecEnd] = useState(initial.execution_end_date ?? "");
  const [planValueText, setPlanValueText] = useState(
    initial.total_planning != null ? Number(initial.total_planning).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""
  );
  const [execValueText, setExecValueText] = useState(
    initial.total_execution != null ? Number(initial.total_execution).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""
  );

  // Resync quando o initial muda (após save)
  useEffect(() => {
    setPlanStart(initial.est_start_date ?? "");
    setPlanEnd(initial.planning_end_date ?? "");
    setExecStart(initial.execution_start_date ?? "");
    setExecEnd(initial.execution_end_date ?? "");
    setPlanValueText(initial.total_planning != null ? Number(initial.total_planning).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
    setExecValueText(initial.total_execution != null ? Number(initial.total_execution).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
  }, [initial.est_start_date, initial.planning_end_date, initial.execution_start_date, initial.execution_end_date, initial.total_planning, initial.total_execution]);

  const planValue = parseBRL(planValueText);
  const execValue = parseBRL(execValueText);
  const allocated = planValue + execValue;
  const preApproved = Number(initial.fpa_approved_amount ?? initial.confirmed_total ?? initial.estimated_total ?? 0);
  const remaining = preApproved - allocated;
  const overAllocated = allocated > preApproved + 0.5;

  const dateError =
    planStart && planEnd && planEnd < planStart
      ? "O término do planejamento deve ser posterior ao início."
      : planEnd && execStart && execStart < planEnd
      ? "A execução deve iniciar após o término do planejamento."
      : execStart && execEnd && execEnd < execStart
      ? "O término da execução deve ser posterior ao início."
      : null;

  const { data: pendingFeedback = [] } = useQuery({
    queryKey: ["pending-feedback", projectId, initial.status],
    enabled: initial.status === "em_revisao_fpa",
    queryFn: async () => {
      const { data } = await supabase
        .from("project_status_history")
        .select("comment, created_at, actor_id")
        .eq("project_id", projectId)
        .eq("to_status", "em_revisao_fpa")
        .order("created_at", { ascending: false })
        .limit(1);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Sessão expirada.");
      const payload: Record<string, unknown> = {
        est_start_date: planStart || null,
        planning_end_date: planEnd || null,
        execution_start_date: execStart || null,
        execution_end_date: execEnd || null,
        est_end_date: execEnd || planEnd || null,
        total_planning: planValue || null,
        total_execution: execValue || null,
        confirmed_total: allocated || null,
      };
      const { error } = await supabase.from("projects").update(payload as never).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rascunho salvo");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastFpaNote = pendingFeedback[0]?.comment;

  const ActionRow = canEdit ? (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending || !!dateError}>
        {save.isPending ? "Salvando…" : "Salvar rascunho"}
      </Button>
      {onRequestReview && (
        <Button
          variant="secondary"
          onClick={() => {
            save.mutate(undefined, { onSuccess: () => onRequestReview() });
          }}
          disabled={save.isPending || reviewPending || !!dateError || allocated <= 0}
        >
          {reviewPending ? "Enviando…" : "Solicitar revisão do FP&A"}
        </Button>
      )}
      {onFinalSubmit && (
        <Button
          onClick={() => {
            save.mutate(undefined, { onSuccess: () => onFinalSubmit() });
          }}
          disabled={save.isPending || finalSubmitPending || !!dateError || allocated <= 0}
        >
          {finalSubmitPending ? "Enviando…" : "Submeter ao FP&A"}
        </Button>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Orçamento pré-aprovado pelo FP&A
          </div>
          <div className="text-xl font-semibold tabular-nums">{formatBRL(preApproved)}</div>
        </div>
        {initial.fpa_approved_amount != null && initial.estimated_total != null
          && Math.abs(Number(initial.fpa_approved_amount) - Number(initial.estimated_total)) > 0.5 && (
          <div className="mt-1 text-xs text-muted-foreground">
            Solicitado originalmente: <span className="tabular-nums">{formatBRL(initial.estimated_total)}</span>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Aloque este valor entre as fases de planejamento e execução. Defina as datas de cada período.
        </p>
      </div>

      {ActionRow}

      {initial.status === "em_revisao_fpa" && lastFpaNote && (
        <div className="rounded-md border border-warn/40 bg-warn/10 p-3 text-sm">
          <div className="font-medium">Feedback do FP&A</div>
          <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{lastFpaNote}</div>
        </div>
      )}

      {/* Planejamento + Execução em duas colunas */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-md border bg-card p-4">
          <div className="text-sm font-medium">Planejamento</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ps">Data de início</Label>
              <Input id="ps" type="date" value={planStart} onChange={(e) => setPlanStart(e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="pe">Data de término</Label>
              <Input id="pe" type="date" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div>
            <Label htmlFor="pv">Valor para planejamento (R$)</Label>
            <Input id="pv" inputMode="decimal" value={planValueText} onChange={(e) => setPlanValueText(e.target.value)} disabled={!canEdit} placeholder="0,00" />
            {planValueText && <div className="mt-1 text-xs text-muted-foreground">{formatBRL(planValue)}</div>}
          </div>
        </div>

        <div className="space-y-3 rounded-md border bg-card p-4">
          <div className="text-sm font-medium">Execução</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="es">Data de início</Label>
              <Input id="es" type="date" value={execStart} onChange={(e) => setExecStart(e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="ee">Data de término</Label>
              <Input id="ee" type="date" value={execEnd} onChange={(e) => setExecEnd(e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div>
            <Label htmlFor="ev">Valor para execução (R$)</Label>
            <Input id="ev" inputMode="decimal" value={execValueText} onChange={(e) => setExecValueText(e.target.value)} disabled={!canEdit} placeholder="0,00" />
            {execValueText && <div className="mt-1 text-xs text-muted-foreground">{formatBRL(execValue)}</div>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border bg-muted/20 p-4 sm:grid-cols-3">
        <Summary label="Total alocado" value={allocated} strong />
        <Summary label="Pré-aprovado" value={preApproved} />
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo</div>
          <div className={`mt-1 text-base font-semibold tabular-nums ${overAllocated ? "text-destructive" : remaining > 0.5 ? "text-warn" : "text-success"}`}>
            {formatBRL(remaining)}
          </div>
        </div>
      </div>

      {dateError && <div className="text-sm text-destructive">{dateError}</div>}
      {overAllocated && (
        <div className="text-sm text-destructive">
          O total alocado excede o orçamento pré-aprovado pelo FP&A.
        </div>
      )}

      {ActionRow && <div className="border-t pt-4">{ActionRow}</div>}
    </div>
  );
}

function Summary({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 tabular-nums ${strong ? "text-base font-semibold" : "text-sm"}`}>{formatBRL(value)}</div>
    </div>
  );
}
