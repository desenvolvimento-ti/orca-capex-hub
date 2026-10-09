import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBRL } from "@/lib/labels";
import { AlertTriangle, TrendingUp } from "lucide-react";

type ExecProject = {
  id: string;
  code: string | null;
  name: string;
  status: string;
  area_id: string;
  ceo_approved_amount: number | null;
  confirmed_total: number | null;
  estimated_total: number | null;
  areas: { name: string } | null;
};

type Disb = { project_id: string; amount: number; realized_amount: number | null };

/**
 * Wave E · Overview de execução para FP&A.
 * Lista projetos em execução com % consumido, desvio, e alerta de estouro projetado.
 */
export function ExecutionOverviewPanel() {
  const [areaFilter, setAreaFilter] = useState<string>("all");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["execution-overview"],
    queryFn: async (): Promise<ExecProject[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name, status, area_id, ceo_approved_amount, confirmed_total, estimated_total, areas:areas!projects_area_id_fkey(name)")
        .in("status", ["em_execucao", "liberado", "liberado_parcial"])
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ExecProject[];
    },
  });

  const { data: disb = [] } = useQuery({
    queryKey: ["execution-overview-disb", projects.map((p) => p.id).join(",")],
    enabled: projects.length > 0,
    queryFn: async (): Promise<Disb[]> => {
      const { data, error } = await supabase
        .from("disbursements")
        .select("project_id, amount, realized_amount")
        .in("project_id", projects.map((p) => p.id));
      if (error) throw error;
      return (data ?? []) as Disb[];
    },
  });

  const rollup = useMemo(() => {
    const map = new Map<string, { plan: number; real: number }>();
    disb.forEach((d) => {
      const r = map.get(d.project_id) ?? { plan: 0, real: 0 };
      r.plan += Number(d.amount ?? 0);
      r.real += Number(d.realized_amount ?? 0);
      map.set(d.project_id, r);
    });
    return map;
  }, [disb]);

  const areas = useMemo(() => {
    const s = new Map<string, string>();
    projects.forEach((p) => { if (p.areas?.name) s.set(p.area_id, p.areas.name); });
    return Array.from(s.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [projects]);

  const filtered = areaFilter === "all" ? projects : projects.filter((p) => p.area_id === areaFilter);

  const totals = filtered.reduce(
    (acc, p) => {
      const r = rollup.get(p.id) ?? { plan: 0, real: 0 };
      const approved = Number(p.ceo_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0);
      acc.approved += approved;
      acc.plan += r.plan;
      acc.real += r.real;
      return acc;
    },
    { approved: 0, plan: 0, real: 0 }
  );

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando execução…</div>;

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum projeto em execução no momento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="font-medium">{filtered.length} projeto(s) em execução</span>
          <span className="text-muted-foreground">·</span>
          <span className="tabular-nums">Aprovado {formatBRL(totals.approved)}</span>
          <span className="text-muted-foreground">·</span>
          <span className="tabular-nums text-primary">Realizado {formatBRL(totals.real)}</span>
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="h-8 w-[220px]"><SelectValue placeholder="Filtrar por área" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {areas.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-xs">
          <thead className="bg-muted/40 text-left uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Projeto</th>
              <th className="px-3 py-2">Área</th>
              <th className="px-3 py-2 text-right">Aprovado</th>
              <th className="px-3 py-2 text-right">Realizado</th>
              <th className="px-3 py-2 text-right">% consumido</th>
              <th className="px-3 py-2 text-right">Desvio (real − plan)</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((p) => {
              const r = rollup.get(p.id) ?? { plan: 0, real: 0 };
              const approved = Number(p.ceo_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0);
              const pct = approved > 0 ? (r.real / approved) * 100 : 0;
              const dev = r.real - r.plan;
              const overrun = dev > 0;
              const projectedOverflow = pct > 100;
              return (
                <tr key={p.id} className={`hover:bg-muted/20 ${projectedOverflow ? "bg-destructive/5" : overrun ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-2">
                    <Link to="/app/projects/$id" params={{ id: p.id }} className="text-primary hover:underline">
                      <span className="font-mono text-[11px]">{p.code ?? "—"}</span>{" "}
                      <span className="font-medium">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.areas?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(approved)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-primary">{formatBRL(r.real)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${projectedOverflow ? "font-semibold text-destructive" : ""}`}>
                    {pct.toFixed(1)}%
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${dev > 0 ? "text-amber-600 dark:text-amber-400" : dev < 0 ? "text-success" : ""}`}>
                    {formatBRL(dev)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {projectedOverflow ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Estouro
                      </span>
                    ) : overrun ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> Desvio
                      </span>
                    ) : (
                      <StatusBadge status={p.status as never} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
