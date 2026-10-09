import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatBRL, formatDateBR, STATUS_LABEL } from "@/lib/labels";
import { exportAcompanhamentoEvef } from "@/lib/excel-export";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type EvefRow = {
  id: string; code: string | null; name: string; status: string;
  payback_months: number | null;
  estimated_total: number | null; confirmed_total: number | null; ceo_approved_amount: number | null;
  concluido_em: string | null;
  areas: { name: string } | null;
  cycles: { name: string; year: number } | null;
  owner_id: string | null;
};

export function EvefTrackingPanel() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["evef-flagged"],
    queryFn: async (): Promise<EvefRow[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name, status, payback_months, estimated_total, confirmed_total, ceo_approved_amount, concluido_em, owner_id, areas:areas!projects_area_id_fkey(name), cycles(name, year)")
        .eq("flag_acompanhamento", true)
        .order("code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EvefRow[];
    },
  });

  const ids = projects.map((p) => p.id);
  const { data: disb = [] } = useQuery({
    queryKey: ["evef-disb", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disbursements")
        .select("project_id, amount, realized_amount")
        .in("project_id", ids);
      if (error) throw error;
      return (data ?? []) as { project_id: string; amount: number; realized_amount: number | null }[];
    },
  });

  const ownerIds = Array.from(new Set(projects.map((p) => p.owner_id).filter(Boolean) as string[]));
  const { data: owners = [] } = useQuery({
    queryKey: ["evef-owners", ownerIds.join(",")],
    enabled: ownerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
      return data ?? [];
    },
  });
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  const byProj = new Map<string, { plan: number; real: number }>();
  disb.forEach((d) => {
    const cur = byProj.get(d.project_id) ?? { plan: 0, real: 0 };
    cur.plan += Number(d.amount ?? 0);
    cur.real += Number(d.realized_amount ?? 0);
    byProj.set(d.project_id, cur);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Acompanhamento EVEF</h2>
          <p className="text-sm text-muted-foreground">
            Projetos marcados por FP&amp;A para análise de retorno pós-execução (EVEF em Excel, fora do sistema).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={projects.length === 0}
          onClick={async () => {
            try { await exportAcompanhamentoEvef(); toast.success("Exportado"); }
            catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)); }
          }}
        >
          <Download className="mr-1 h-4 w-4" /> Exportar Excel
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Projeto</th>
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Payback</th>
                <th className="px-3 py-2 text-right">Aprovado</th>
                <th className="px-3 py-2 text-right">Realizado</th>
                <th className="px-3 py-2 text-right">% Exec.</th>
                <th className="px-3 py-2">Concluído em</th>
                <th className="px-3 py-2">Gestor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">
                  Nenhum projeto flagado para acompanhamento EVEF. Marque a flag no detalhe do projeto (Etapa 5).
                </td></tr>
              ) : projects.map((p) => {
                const aprov = Number(p.ceo_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0);
                const sums = byProj.get(p.id) ?? { plan: 0, real: 0 };
                const pct = aprov > 0 ? (sums.real / aprov) * 100 : 0;
                const owner = p.owner_id ? ownerMap.get(p.owner_id) : null;
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link to="/app/projects/$id" params={{ id: p.id }} className="text-primary hover:underline">
                        {p.code ?? "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.areas?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] ?? p.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.payback_months ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(aprov)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(sums.real)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.concluido_em ? formatDateBR(p.concluido_em) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{owner?.full_name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
