import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatBRL, formatDateBR, formatMonthShortBR } from "@/lib/labels";
import { executionEnd } from "@/lib/project-rules";
import { useSchedule } from "@/components/project/ProposalForm";
import { useCeiling } from "@/components/admin/CeilingPanel";

type P = {
  id: string; status: string; prioritization_result: string | null;
  firm_study_amount: number | null; firm_execution_amount: number | null;
  firm_study_start_date: string | null; firm_execution_start_date: string | null; firm_execution_months: number | null;
  study_amount: number | null;
};

export function useBaseline(projectId: string) {
  return useQuery({
    queryKey: ["baseline", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_baselines").select("snapshot, created_at")
        .eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data?.snapshot as any | null;
    },
  });
}

export function ComparisonTable({ project }: { project: P }) {
  const { data: base } = useBaseline(project.id);
  const { data: firmSched = [] } = useSchedule(project.id, "firme");
  if (!base) return <div className="text-sm text-muted-foreground">Linha de base indicativa não encontrada.</div>;

  const fTotal = Number(project.firm_study_amount ?? 0) + Number(project.firm_execution_amount ?? 0);
  const fEnd = executionEnd(project.firm_execution_start_date, project.firm_execution_months);
  const rows: { label: string; a: any; b: any; kind: "money" | "date" | "months" }[] = [
    { label: "Verba de planejamento", a: base.study_amount, b: project.firm_study_amount, kind: "money" },
    { label: "Verba de execução", a: base.execution_amount, b: project.firm_execution_amount, kind: "money" },
    { label: "Valor total", a: base.total, b: fTotal, kind: "money" },
    { label: "Início do planejamento", a: base.study_start_date, b: project.firm_study_start_date, kind: "date" },
    { label: "Início da execução", a: base.execution_start_date, b: project.firm_execution_start_date, kind: "date" },
    { label: "Prazo de execução", a: base.execution_months, b: project.firm_execution_months, kind: "months" },
    { label: "Fim da execução", a: base.execution_end_date, b: fEnd, kind: "date" },
  ];
  const fmt = (v: any, k: string) => v == null ? "—" : k === "money" ? formatBRL(v) : k === "date" ? formatDateBR(v) : `${v} meses`;
  const variation = (a: any, b: any, k: string) => {
    if (a == null || b == null || k === "date") return a !== b ? "alterado" : "";
    const d = Number(b) - Number(a);
    if (d === 0) return "";
    const pct = Number(a) !== 0 ? ` (${d > 0 ? "+" : ""}${((d / Number(a)) * 100).toFixed(1)}%)` : "";
    return `${d > 0 ? "+" : ""}${k === "money" ? formatBRL(d) : `${d} meses`}${pct}`;
  };

  const periods = Array.from(new Set([...(base.schedule ?? []).map((r: any) => r.period), ...firmSched.map((r) => r.period)])).sort();
  const aBy = new Map<string, number>(); (base.schedule ?? []).forEach((r: any) => aBy.set(r.period, (aBy.get(r.period) ?? 0) + Number(r.amount)));
  const bBy = new Map<string, number>(); firmSched.forEach((r) => bBy.set(r.period, (bBy.get(r.period) ?? 0) + r.amount));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-3 py-2">Campo</th><th className="px-3 py-2 text-right">Indicativo</th><th className="px-3 py-2 text-right">Planejado</th><th className="px-3 py-2 text-right">Variação</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const v = variation(r.a, r.b, r.kind);
              return (
                <tr key={r.label} className={v ? "bg-warning/10" : ""}>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.a, r.kind)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(r.b, r.kind)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{v || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {periods.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr><th className="px-2 py-1 text-left">Cronograma</th>{periods.map((p) => <th key={p} className="px-2 py-1 text-right">{formatMonthShortBR(p)}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="px-2 py-1">Indicativo</td>{periods.map((p) => <td key={p} className="px-2 py-1 text-right tabular-nums">{formatBRL(aBy.get(p) ?? 0)}</td>)}</tr>
              <tr><td className="px-2 py-1 font-medium">Planejado</td>{periods.map((p) => <td key={p} className={`px-2 py-1 text-right tabular-nums ${(aBy.get(p) ?? 0) !== (bBy.get(p) ?? 0) ? "bg-warning/10 font-medium" : ""}`}>{formatBRL(bBy.get(p) ?? 0)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ValidationDecision({ project }: { project: P }) {
  const qc = useQueryClient();
  const { data: ceil } = useCeiling();
  const [just, setJust] = useState("");
  const fTotal = Number(project.firm_study_amount ?? 0) + Number(project.firm_execution_amount ?? 0);
  const impact = fTotal - Number(project.study_amount ?? 0);
  const onlyStudy = project.prioritization_result === "estudo";

  const decide = useMutation({
    mutationFn: async (acao: string) => {
      const { error } = await supabase.rpc("decisao_validacao_execucao", { p_project_id: project.id, p_acao: acao, p_justificativa: just });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decisão registrada");
      ["project", "audit-timeline", "investment-ceiling", "manager-projects"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Box label="Folga atual do teto" value={ceil?.slack == null ? "Teto não definido" : formatBRL(ceil.slack)} />
        <Box label="Impacto desta aprovação" value={formatBRL(impact)} hint="Total planejado menos a verba de planejamento já liberada" />
        <Box label="Folga após aprovar" value={ceil?.slack == null ? "—" : formatBRL(ceil.slack - impact)} danger={ceil?.slack != null && ceil.slack - impact < 0} />
      </div>
      {onlyStudy && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">Na priorização foi aprovada apenas a verba de planejamento. Você pode registrar o planejamento como concluído e manter a execução não aprovada.</div>
      )}
      <Textarea rows={3} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Justificativa da decisão (obrigatória para devolver ou não aprovar)" />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => decide.mutate("devolver")} disabled={decide.isPending}>Devolver para ajuste</Button>
        <Button variant="outline" className="text-destructive" onClick={() => decide.mutate("nao_aprovar")} disabled={decide.isPending}>Não aprovar</Button>
        {onlyStudy && <Button variant="secondary" onClick={() => decide.mutate("concluir_estudo")} disabled={decide.isPending}>Registrar planejamento como concluído</Button>}
        <Button onClick={() => decide.mutate("aprovar")} disabled={decide.isPending}>Aprovar para execução</Button>
      </div>
    </div>
  );
}

function Box({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
