import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatBRL, monthsBetween, parseBRL, formatMonthShortBR } from "@/lib/labels";
import { RequestChangeDialog } from "@/components/project/ChangeRequestPanel";

type Proj = {
  id: string;
  name: string;
  cycle_id: string | null;
  ceo_approved_amount: number | null;
  estimated_total: number;
  est_start_date: string | null;
  planning_end_date: string | null;
  execution_end_date: string | null;
};

type Cell = { projectId: string; period: string; amount: number };

export function PreApprovedSchedule({
  cycleId,
  ownerId,
  cycleStartDate,
  cycleEndDate,
}: {
  cycleId: string;
  ownerId: string;
  cycleStartDate?: string | null;
  cycleEndDate?: string | null;
}) {
  const qc = useQueryClient();

  // Busca: projetos liberados deste ciclo + projetos liberados de outros ciclos
  // cuja execução transborde para a janela deste ciclo (auto-alocação em ciclo futuro).
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["approved-schedule", cycleId, ownerId, cycleStartDate, cycleEndDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, cycle_id, ceo_approved_amount, estimated_total, est_start_date, planning_end_date, execution_end_date")
        .eq("owner_id", ownerId)
        .in("status", ["liberado", "liberado_parcial"])
        .order("name");
      if (error) throw error;
      const all = (data ?? []) as Proj[];
      // Filtra para projetos deste ciclo + overflows que toquem o range do ciclo
      const cs = cycleStartDate ? new Date(cycleStartDate) : null;
      const ce = cycleEndDate ? new Date(cycleEndDate) : null;
      return all.filter((p) => {
        if (p.cycle_id === cycleId) return true;
        if (!cs || !ce) return false;
        const pStart = p.est_start_date ? new Date(p.est_start_date) : null;
        const pEnd = p.execution_end_date
          ? new Date(p.execution_end_date)
          : p.planning_end_date ? new Date(p.planning_end_date) : null;
        if (!pStart || !pEnd) return false;
        // overlap: pStart <= ce && pEnd >= cs
        return pStart <= ce && pEnd >= cs;
      });
    },
  });

  const projectIds = projects.map((p) => p.id);

  const { data: existing = [] } = useQuery({
    queryKey: ["disbursements-batch", projectIds.join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disbursements")
        .select("project_id, period, amount, phase")
        .in("project_id", projectIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Eixo de meses: usa janela do ciclo (cycle_start_date..cycle_end_date) como prioridade.
  // Fallback: união das datas dos projetos.
  const months = useMemo(() => {
    if (cycleStartDate && cycleEndDate) {
      return monthsBetween(cycleStartDate, cycleEndDate);
    }
    if (projects.length === 0) return [];
    let minStart: string | null = null;
    let maxEnd: string | null = null;
    for (const p of projects) {
      const s = p.est_start_date;
      const e = p.execution_end_date ?? p.planning_end_date;
      if (s && (!minStart || s < minStart)) minStart = s;
      if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
    }
    return monthsBetween(minStart, maxEnd);
  }, [projects, cycleStartDate, cycleEndDate]);

  // Helpers de range por projeto
  const isMonthAllowedForProject = (p: Proj, iso: string): boolean => {
    if (!p.est_start_date) return false;
    const endRef = p.execution_end_date ?? p.planning_end_date;
    if (!endRef) return false;
    // Compara primeiro dia do mês com os ranges (em ISO YYYY-MM-DD)
    const monthStart = iso; // already YYYY-MM-01
    const projStartMonth = p.est_start_date.slice(0, 7) + "-01";
    const projEndMonth = endRef.slice(0, 7) + "-01";
    return monthStart >= projStartMonth && monthStart <= projEndMonth;
  };

  const [text, setText] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next: Record<string, string> = {};
    existing.forEach((row) => {
      const k = `${row.project_id}|${row.period}`;
      const v = Number(row.amount) || 0;
      next[k] = v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
    });
    setText(next);
    setDirty(new Set());
  }, [existing]);

  const update = (projectId: string, period: string, raw: string) => {
    const k = `${projectId}|${period}`;
    setText((t) => ({ ...t, [k]: raw }));
    setDirty((d) => {
      const n = new Set(d);
      n.add(k);
      return n;
    });
  };

  const phaseFor = (p: Proj, periodISO: string): "planejamento" | "execucao" => {
    if (p.planning_end_date && periodISO <= p.planning_end_date) return "planejamento";
    return "execucao";
  };

  const projectTotal = (p: Proj) =>
    months.reduce((s, m) => s + (parseBRL(text[`${p.id}|${m.iso}`] ?? "") || 0), 0);

  const monthTotal = (iso: string) =>
    projects.reduce((s, p) => s + (parseBRL(text[`${p.id}|${iso}`] ?? "") || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      // Trava: bloqueia salvar se algum projeto tem saldo negativo (excede aprovado).
      const overspent = projects
        .map((p) => ({
          p,
          approved: Number(p.ceo_approved_amount ?? p.estimated_total ?? 0),
          projected: projectTotal(p),
        }))
        .filter((x) => x.approved - x.projected < -0.005);
      if (overspent.length > 0) {
        const names = overspent.map((x) => x.p.name).join(", ");
        throw new Error(
          `O cronograma excede o valor aprovado em: ${names}. Ajuste antes de salvar.`,
        );
      }

      const cells: Cell[] = [];
      dirty.forEach((k) => {
        const [projectId, period] = k.split("|");
        const p = projects.find((x) => x.id === projectId);
        if (!p || !isMonthAllowedForProject(p, period)) return; // ignora células fora do range
        const amount = parseBRL(text[k] ?? "");
        cells.push({ projectId, period, amount });
      });
      if (cells.length === 0) return 0;

      for (const c of cells) {
        await supabase
          .from("disbursements")
          .delete()
          .eq("project_id", c.projectId)
          .eq("period", c.period);
      }
      const toInsert = cells
        .filter((c) => c.amount > 0)
        .map((c) => {
          const p = projects.find((x) => x.id === c.projectId)!;
          return {
            project_id: c.projectId,
            period: c.period,
            amount: c.amount,
            phase: phaseFor(p, c.period),
          };
        });
      if (toInsert.length > 0) {
        const { error } = await supabase.from("disbursements").insert(toInsert);
        if (error) throw error;
      }
      return cells.length;
    },
    onSuccess: (n) => {
      if (n === 0) return toast.info("Nenhuma alteração para salvar");
      toast.success("Cronograma atualizado");
      qc.invalidateQueries({ queryKey: ["disbursements-batch", projectIds.join(",")] });
      qc.invalidateQueries({ queryKey: ["manager-disbursement-sums"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (projects.length === 0) {
    return <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhum projeto aprovado para liberação financeira neste ciclo.</div>;
  }
  if (months.length === 0) {
    return <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Defina o "Início do ciclo" e "Fim do ciclo" (Administração ▸ Ciclos) para gerar as colunas do cronograma.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-20 bg-muted/40 px-3 py-2 text-right">Ações</th>
              <th className="sticky left-[120px] z-20 bg-muted/40 px-3 py-2">Projeto</th>
              <th className="px-3 py-2 text-right">Valor aprovado</th>
              <th className="px-3 py-2 text-right">Total projetado</th>
              <th className="px-3 py-2 text-right">Saldo</th>
              {months.map((m) => (
                <th key={m.iso} className="px-2 py-2 text-right">{formatMonthShortBR(m.iso)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {projects.map((p) => {
              const approved = Number(p.ceo_approved_amount ?? p.estimated_total ?? 0);
              const projected = projectTotal(p);
              const balance = approved - projected;
              const balanceClass =
                balance < 0
                  ? "text-destructive font-semibold"
                  : balance > 0
                  ? "text-success font-semibold"
                  : "";
              const fromOtherCycle = p.cycle_id !== cycleId;
              return (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2">
                    <div className="flex justify-start gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/projects/$id" params={{ id: p.id }}>Acessar</Link>
                      </Button>
                      <RequestChangeDialog
                        project={{
                          id: p.id,
                          owner_id: ownerId,
                          area_id: "",
                          status: "liberado",
                          estimated_total: p.estimated_total,
                          confirmed_total: null,
                          ceo_approved_amount: p.ceo_approved_amount,
                          execution_start_date: p.est_start_date,
                          est_start_date: p.est_start_date,
                          execution_end_date: p.execution_end_date,
                          planning_end_date: p.planning_end_date,
                        }}
                      />
                    </div>
                  </td>
                  <td className="sticky left-[120px] z-10 bg-card px-3 py-2 font-medium">
                    <div>{p.name}</div>
                    {fromOtherCycle && (
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cronograma transbordado</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(approved)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(projected)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${balanceClass}`}>
                    {formatBRL(balance)}
                  </td>
                  {months.map((m) => {
                    const k = `${p.id}|${m.iso}`;
                    const allowed = isMonthAllowedForProject(p, m.iso);
                    return (
                      <td key={m.iso} className="px-1 py-1">
                        <Input
                          inputMode="decimal"
                          disabled={!allowed}
                          title={allowed ? undefined : "Fora do período de planejamento/execução do projeto"}
                          className={`h-8 w-24 text-right text-xs tabular-nums ${!allowed ? "bg-muted/40 cursor-not-allowed" : ""}`}
                          value={allowed ? (text[k] ?? "") : ""}
                          onChange={(e) => update(p.id, m.iso, e.target.value)}
                          placeholder={allowed ? "0,00" : "—"}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td className="sticky left-0 z-10 bg-muted/30" />
              <td className="sticky left-[120px] z-10 bg-muted/30 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Total por mês</td>
              <td className="px-3 py-2" colSpan={3} />
              {months.map((m) => (
                <td key={m.iso} className="px-2 py-2 text-right font-semibold tabular-nums">{formatBRL(monthTotal(m.iso))}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending || dirty.size === 0}>
          {save.isPending ? "Salvando…" : "Salvar cronograma"}
        </Button>
      </div>
    </div>
  );
}
