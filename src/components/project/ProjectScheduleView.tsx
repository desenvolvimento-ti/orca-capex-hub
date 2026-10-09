import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, Sparkles } from "lucide-react";
import { formatBRL, formatMonthShortBR, monthsBetween, parseBRL } from "@/lib/labels";

type Props = {
  projectId: string;
  startDate: string | null;
  endDate: string | null;
  approvedAmount: number | null;
  planningEnd?: string | null;
  ownerId?: string;
};

type Row = { id?: string; period: string; amount: number; realized_amount: number | null; phase: string };

export function ProjectScheduleView({ projectId, startDate, endDate, approvedAmount, ownerId }: Props) {
  const { profile, isRealFpa } = useAuth();
  const qc = useQueryClient();
  // Wave E: apenas FP&A registra o realizado. Gestor visualiza e reprojeta meses futuros.
  const canEditReal = isRealFpa;
  const isOwner = !!ownerId && profile?.id === ownerId;
  const canReplan = isRealFpa || isOwner;


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["project-schedule", projectId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("disbursements")
        .select("id, period, amount, realized_amount, phase")
        .eq("project_id", projectId)
        .order("period");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const months = monthsBetween(startDate, endDate);
  const byPeriod = useMemo(() => {
    const m = new Map<string, Row>();
    rows.forEach((r) => m.set(String(r.period), r));
    return m;
  }, [rows]);

  const [realText, setRealText] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next: Record<string, string> = {};
    months.forEach((m) => {
      const r = byPeriod.get(m.iso);
      const v = r?.realized_amount ?? 0;
      next[m.iso] = v ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
    });
    setRealText(next);
    setDirty(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, startDate, endDate]);

  const planTotal = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const realTotal = months.reduce((s, m) => s + (parseBRL(realText[m.iso] ?? "") || 0), 0);
  const approved = Number(approvedAmount ?? 0);
  const balance = approved - planTotal;
  const variation = realTotal - planTotal;

  const save = useMutation({
    mutationFn: async () => {
      const updates: { period: string; value: number | null }[] = [];
      dirty.forEach((iso) => {
        const v = parseBRL(realText[iso] ?? "");
        updates.push({ period: iso, value: v > 0 ? v : null });
      });
      for (const u of updates) {
        const existing = byPeriod.get(u.period);
        if (existing?.id) {
          const { error } = await supabase.from("disbursements")
            .update({ realized_amount: u.value })
            .eq("id", existing.id);
          if (error) throw error;
        } else if (u.value != null) {
          // criar linha mínima para registrar o realizado em um mês sem plano
          const { error } = await supabase.from("disbursements").insert({
            project_id: projectId, period: u.period, amount: 0, realized_amount: u.value, phase: "execucao",
          });
          if (error) throw error;
        }
      }
      return updates.length;
    },
    onSuccess: (n) => {
      if (n === 0) return toast.info("Nenhuma alteração");
      toast.success("Realizado atualizado");
      qc.invalidateQueries({ queryKey: ["project-schedule", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reprojetar: redistribui o saldo remanescente (approved - realizado até hoje) nos meses futuros do plano.
  const today = new Date();
  const currentIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const futureMonths = months.filter((m) => m.iso > currentIso);
  const realizedToDate = rows.reduce((s, r) => s + Number(r.realized_amount ?? 0), 0);
  const remaining = Number(approvedAmount ?? 0) - realizedToDate;

  const replan = useMutation({
    mutationFn: async () => {
      if (futureMonths.length === 0) throw new Error("Não há meses futuros para reprojetar.");
      if (remaining <= 0) throw new Error("Não há saldo remanescente para redistribuir.");
      const per = Number((remaining / futureMonths.length).toFixed(2));
      for (const m of futureMonths) {
        const existing = byPeriod.get(m.iso);
        if (existing?.id) {
          const { error } = await supabase.from("disbursements").update({ amount: per }).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("disbursements").insert({
            project_id: projectId, period: m.iso, amount: per, phase: "execucao",
          });
          if (error) throw error;
        }
      }
      return futureMonths.length;
    },
    onSuccess: (n) => {
      toast.success(`Cronograma reprojetado em ${n} mês(es)`);
      qc.invalidateQueries({ queryKey: ["project-schedule", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando cronograma…</div>;
  if (months.length === 0) {
    return <div className="text-sm text-muted-foreground">Cronograma indisponível: período de planejamento/execução não definido.</div>;
  }

  const hasOverrun = months.some((m) => {
    const row = byPeriod.get(m.iso);
    const plan = row?.amount ?? 0;
    const real = parseBRL(realText[m.iso] ?? "");
    return plan > 0 && real > plan;
  });

  return (
    <div className="space-y-3">
      {hasOverrun && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <div className="font-medium text-amber-800 dark:text-amber-200">Desvio detectado</div>
            <div className="text-amber-700 dark:text-amber-300">
              Há meses com realizado acima do planejado. Considere reprojetar os meses restantes.
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-xs">
        <div><span className="text-muted-foreground">Aprovado: </span><span className="font-medium tabular-nums">{formatBRL(approved)}</span></div>
        <div><span className="text-muted-foreground">Planejado: </span><span className="font-medium tabular-nums">{formatBRL(planTotal)}</span></div>
        <div><span className="text-muted-foreground">Realizado: </span><span className="font-medium tabular-nums text-primary">{formatBRL(realTotal)}</span></div>
        <div>
          <span className="text-muted-foreground">Saldo: </span>
          <span className={`font-medium tabular-nums ${balance < 0 ? "text-destructive" : balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-success"}`}>
            {formatBRL(balance)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Variação (real − plan): </span>
          <span className={`font-medium tabular-nums ${variation < 0 ? "text-destructive" : variation > 0 ? "text-success" : ""}`}>
            {formatBRL(variation)}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-xs">
          <thead className="bg-muted/40 text-left uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Mês</th>
              <th className="px-3 py-2">Fase</th>
              <th className="px-3 py-2 text-right">Planejado</th>
              <th className="px-3 py-2 text-right">Realizado</th>
              <th className="px-3 py-2 text-right">Variação</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {months.map((m) => {
              const row = byPeriod.get(m.iso);
              const plan = row?.amount ?? 0;
              const realStr = realText[m.iso] ?? "";
              const real = parseBRL(realStr);
              const v = real - plan;
              const over = plan > 0 && real > plan;
              return (
                <tr key={m.iso} className={`hover:bg-muted/20 ${over ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-2 font-mono">
                    <div className="flex items-center gap-1">
                      {formatMonthShortBR(m.iso)}
                      {over && <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{row?.phase ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{plan > 0 ? formatBRL(plan) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {canEditReal ? (
                      <Input
                        inputMode="decimal"
                        className="h-7 w-28 text-right text-xs tabular-nums"
                        value={realStr}
                        onChange={(e) => {
                          setRealText((t) => ({ ...t, [m.iso]: e.target.value }));
                          setDirty((d) => { const n = new Set(d); n.add(m.iso); return n; });
                        }}
                        placeholder="0,00"
                      />
                    ) : (
                      <span className="tabular-nums">{real > 0 ? formatBRL(real) : "—"}</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${v < 0 ? "text-destructive" : v > 0 ? "text-success" : ""}`}>
                    {plan === 0 && real === 0 ? "—" : formatBRL(v)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td colSpan={2} className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatBRL(planTotal)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatBRL(realTotal)}</td>
              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${variation < 0 ? "text-destructive" : variation > 0 ? "text-success" : ""}`}>
                {formatBRL(variation)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {canEditReal
            ? "Apenas FP&A registra o realizado. Alertas aparecem quando o realizado supera o planejado no mês."
            : "O realizado é preenchido pela FP&A. Reprojete os meses futuros se houver desvio."}
        </p>
        <div className="flex gap-2">
          {canReplan && futureMonths.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm(`Redistribuir ${formatBRL(remaining)} igualmente nos próximos ${futureMonths.length} mês(es)?`)) {
                  replan.mutate();
                }
              }}
              disabled={replan.isPending || remaining <= 0}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              {replan.isPending ? "Reprojetando…" : "Reprojetar meses restantes"}
            </Button>
          )}
          {canEditReal && (
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || dirty.size === 0}>
              {save.isPending ? "Salvando…" : "Salvar realizado"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

