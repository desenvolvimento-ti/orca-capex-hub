import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, STATUS_LABEL } from "@/lib/labels";
import { StatusBadge } from "@/components/StatusBadge";

type Project = {
  id: string; code: string; name: string; status: keyof typeof STATUS_LABEL;
  estimated_total: number; confirmed_total: number | null;
  ceo_approved_amount: number | null; released_amount: number | null;
  cycle_id: string; area_id: string;
};

const PIPELINE_GROUPS: Array<{ key: string; label: string; statuses: Array<keyof typeof STATUS_LABEL> }> = [
  { key: "intake", label: "Em Intake", statuses: ["rascunho", "submetido_intake"] },
  { key: "stage2", label: "Em Submissão", statuses: ["pre_aprovado", "aguardando_submissao", "devolvido_revisao"] },
  { key: "review", label: "Em Revisão", statuses: ["submetido_documentacao", "em_revisao_fpa", "aguardando_cfo", "aguardando_ceo"] },
  { key: "decided", label: "Liberados", statuses: ["liberado", "liberado_parcial"] },
  { key: "rejected", label: "Recusados / Backlog", statuses: ["postergado", "cancelado", "retornado_backlog", "reprovado"] },
];

export function CycleDashboard() {
  const { data: cycle } = useQuery({
    queryKey: ["active-cycle"],
    queryFn: async () => {
      const { data } = await supabase.from("cycles").select("*").eq("is_active", true).maybeSingle();
      return data;
    },
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["dashboard-projects", cycle?.id],
    enabled: !!cycle?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name, status, estimated_total, confirmed_total, ceo_approved_amount, released_amount, cycle_id, area_id, areas:areas!projects_area_id_fkey(name)")
        .eq("cycle_id", cycle!.id);
      if (error) throw error;
      return data as unknown as (Project & { areas: { name: string } | null })[];
    },
  });

  if (!cycle) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Nenhum ciclo ativo. Crie e ative um ciclo na <Link to="/app/admin" className="text-primary hover:underline">Administração</Link>.
      </div>
    );
  }
  if (isLoading) return <div className="text-muted-foreground">Carregando dashboard…</div>;

  const totalEstimated = projects.reduce((s, p) => s + Number(p.estimated_total ?? 0), 0);
  const totalConfirmed = projects.reduce((s, p) => s + Number(p.confirmed_total ?? 0), 0);
  const totalApproved = projects.reduce((s, p) => s + Number(p.ceo_approved_amount ?? 0), 0);
  const totalReleased = projects.reduce((s, p) => s + Number(p.released_amount ?? 0), 0);

  const counts: Record<string, number> = {};
  projects.forEach((p) => { counts[p.status] = (counts[p.status] ?? 0) + 1; });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Ciclo ativo</div>
        <h1 className="text-2xl font-semibold tracking-tight">{cycle.name} <span className="text-muted-foreground">· {cycle.year}</span></h1>
        <p className="text-sm text-muted-foreground">{projects.length} projeto(s) cadastrado(s)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Estimado (Intake)" value={totalEstimated} tone="neutral" />
        <KpiCard label="Confirmado (Etapa 2)" value={totalConfirmed} tone="info" />
        <KpiCard label="Aprovado pelo CEO" value={totalApproved} tone="success" />
        <KpiCard label="Liberado / executando" value={totalReleased} tone="success" />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">Pipeline por estágio</div>
        <div className="grid gap-px bg-border md:grid-cols-5">
          {PIPELINE_GROUPS.map((g) => {
            const total = g.statuses.reduce((s, st) => s + (counts[st] ?? 0), 0);
            return (
              <div key={g.key} className="bg-card p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{g.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{total}</div>
                <div className="mt-2 space-y-1">
                  {g.statuses.filter((st) => counts[st]).map((st) => (
                    <div key={st} className="flex items-center justify-between gap-2 text-xs">
                      <StatusBadge status={st} />
                      <span className="tabular-nums text-muted-foreground">{counts[st]}</span>
                    </div>
                  ))}
                  {total === 0 && <div className="text-xs text-muted-foreground">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-medium">Projetos do ciclo</div>
          <Link to="/app/projects" className="text-xs text-primary hover:underline">Ver todos →</Link>
        </div>
        {projects.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Sem projetos neste ciclo.</div>
        ) : (
          <ul className="divide-y text-sm">
            {projects.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to="/app/projects/$id" params={{ id: p.id }} className="font-mono text-xs text-primary hover:underline">{p.code}</Link>
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{(p as Project & { areas: { name: string } | null }).areas?.name ?? "—"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden tabular-nums text-muted-foreground sm:inline">
                    {formatBRL(p.ceo_approved_amount ?? p.confirmed_total ?? p.estimated_total)}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "info" | "success" }) {
  const toneCls = tone === "success" ? "border-success/30 bg-success/5" : tone === "info" ? "border-primary/30 bg-primary/5" : "bg-card";
  return (
    <div className={`rounded-lg border p-4 ${toneCls}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{formatBRL(value)}</div>
    </div>
  );
}
