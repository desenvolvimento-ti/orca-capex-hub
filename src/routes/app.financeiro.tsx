import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, formatMonthShortBR, monthsBetween } from "@/lib/labels";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportFinanceiroConsolidado } from "@/lib/excel-export";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EvefTrackingPanel } from "@/components/dashboard/EvefTrackingPanel";
import { STAGES_3_TO_5_ENABLED } from "@/lib/features";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/app/financeiro")({ component: FinanceiroPage });

type ProjectRow = {
  id: string; code: string | null; name: string; cycle_id: string | null;
  status: string; area_id: string;
  estimated_total: number; confirmed_total: number | null;
  ceo_approved_amount: number | null; fpa_approved_amount: number | null;
  areas: { name: string } | null;
  cycles: { name: string; year: number } | null;
};

type Disb = { project_id: string; period: string; amount: number; realized_amount: number | null };

function approvedOf(p: ProjectRow): number {
  return Number(p.ceo_approved_amount ?? p.fpa_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0);
}

function FinanceiroPage() {
  if (!STAGES_3_TO_5_ENABLED) return <Navigate to="/app" />;
  return <FinanceiroContent />;
}

function FinanceiroContent() {
  const { isRealFpa, loading } = useAuth();
  const [cycleId, setCycleId] = useState<string>("all");
  const [areaId, setAreaId] = useState<string>("all");

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles-fin"],
    queryFn: async () => (await supabase.from("cycles").select("id, name, year").order("year", { ascending: false })).data ?? [],
    enabled: isRealFpa,
  });
  const { data: areas = [] } = useQuery({
    queryKey: ["areas-fin"],
    queryFn: async () => (await supabase.from("areas").select("id, name").order("name")).data ?? [],
    enabled: isRealFpa,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-fin"],
    queryFn: async (): Promise<ProjectRow[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name, cycle_id, status, area_id, estimated_total, confirmed_total, ceo_approved_amount, fpa_approved_amount, areas:areas!projects_area_id_fkey(name), cycles(name, year)")
        .in("status", ["liberado", "liberado_parcial"]);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectRow[];
    },
    enabled: isRealFpa,
  });

  const filtered = useMemo(() => projects.filter((p) =>
    (cycleId === "all" || p.cycle_id === cycleId) && (areaId === "all" || p.area_id === areaId)
  ), [projects, cycleId, areaId]);

  const projectIds = filtered.map((p) => p.id);
  const { data: disb = [] } = useQuery({
    queryKey: ["disb-fin", projectIds.join(",")],
    enabled: isRealFpa && projectIds.length > 0,
    queryFn: async (): Promise<Disb[]> => {
      const { data, error } = await supabase
        .from("disbursements")
        .select("project_id, period, amount, realized_amount")
        .in("project_id", projectIds);
      if (error) throw error;
      return (data ?? []) as unknown as Disb[];
    },
  });

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!isRealFpa) return <Navigate to="/app" />;

  const totals = filtered.reduce(
    (acc, p) => {
      acc.aprovado += approvedOf(p);
      return acc;
    },
    { aprovado: 0 }
  );
  const planejado = disb.reduce((s, d) => s + Number(d.amount ?? 0), 0);
  const realizado = disb.reduce((s, d) => s + Number(d.realized_amount ?? 0), 0);
  const saldo = totals.aprovado - planejado;
  const execPct = totals.aprovado > 0 ? (realizado / totals.aprovado) * 100 : 0;

  // Eixo mensal: min/max period
  const periods = disb.map((d) => d.period).sort();
  const months = periods.length > 0 ? monthsBetween(periods[0], periods[periods.length - 1]) : [];
  const chartData = months.map((m) => {
    const rows = disb.filter((d) => String(d.period) === m.iso);
    return {
      mes: formatMonthShortBR(m.iso),
      Planejado: rows.reduce((s, d) => s + Number(d.amount ?? 0), 0),
      Realizado: rows.reduce((s, d) => s + Number(d.realized_amount ?? 0), 0),
    };
  });

  const byProj = new Map<string, { plan: number; real: number }>();
  disb.forEach((d) => {
    const cur = byProj.get(d.project_id) ?? { plan: 0, real: 0 };
    cur.plan += Number(d.amount ?? 0);
    cur.real += Number(d.realized_amount ?? 0);
    byProj.set(d.project_id, cur);
  });

  return (
    <div className="space-y-6">
      <BackButton fallback="/app" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Painel Financeiro</h1>
          <p className="text-sm text-muted-foreground">Planejado × Realizado dos projetos liberados e acompanhamento EVEF.</p>
        </div>
      </div>

      <Tabs defaultValue="consolidado" className="space-y-6">
        <TabsList>
          <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
          <TabsTrigger value="evef">Acompanhamento EVEF</TabsTrigger>
        </TabsList>

        <TabsContent value="consolidado" className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={async () => {
              try { await exportFinanceiroConsolidado({ cycleId, areaId }); toast.success("Exportado"); }
              catch (e: any) { toast.error(e?.message ?? String(e)); }
            }}>
              <Download className="mr-1 h-4 w-4" /> Exportar Excel
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Ciclo</label>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ciclos</SelectItem>
              {cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.year})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Área</label>
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Aprovado" value={formatBRL(totals.aprovado)} />
        <Card label="Planejado" value={formatBRL(planejado)} />
        <Card label="Realizado" value={formatBRL(realizado)} tone="text-primary" />
        <Card label="Saldo (Aprovado − Planejado)" value={formatBRL(saldo)} tone={saldo < 0 ? "text-destructive" : "text-success"} />
        <Card label="% Execução" value={`${execPct.toFixed(1)}%`} />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 text-sm font-medium">Planejado × Realizado por mês</div>
        {chartData.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Sem desembolsos no período.</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v as number)} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Bar dataKey="Planejado" fill="var(--primary)" />
                <Bar dataKey="Realizado" fill="var(--success)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">Por projeto</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Projeto</th>
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Ciclo</th>
                <th className="px-3 py-2 text-right">Aprovado</th>
                <th className="px-3 py-2 text-right">Planejado</th>
                <th className="px-3 py-2 text-right">Realizado</th>
                <th className="px-3 py-2 text-right">Variação</th>
                <th className="px-3 py-2 text-right">% Exec.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhum projeto liberado com os filtros.</td></tr>
              ) : filtered.map((p) => {
                const approved = approvedOf(p);
                const sums = byProj.get(p.id) ?? { plan: 0, real: 0 };
                const variacao = sums.real - sums.plan;
                const pct = approved > 0 ? (sums.real / approved) * 100 : 0;
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{p.code ?? "—"}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.areas?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.cycles ? `${p.cycles.name} (${p.cycles.year})` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(approved)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(sums.plan)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(sums.real)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${variacao < 0 ? "text-destructive" : variacao > 0 ? "text-success" : ""}`}>{formatBRL(variacao)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="evef">
          <EvefTrackingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
