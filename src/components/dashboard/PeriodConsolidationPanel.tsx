import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { CATEGORY_LABEL, STATUS_LABEL, formatBRL, formatDateBR } from "@/lib/labels";
import { exportSubmissoes } from "@/lib/excel-export";
import { Download } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  code: string | null;
  name: string;
  status: keyof typeof STATUS_LABEL;
  category: keyof typeof CATEGORY_LABEL;
  estimated_total: number | null;
  submitted_at: string | null;
  area_id: string;
  areas: { name: string } | null;
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const PRE_ANALISE = new Set(["em_pre_analise_fpa", "submetido_intake", "em_revisao_fpa"]);
const AGUARDANDO_DIRETORIA = new Set(["aguardando_diretoria_prev"]);
const DEVOLVIDOS = new Set(["devolvido_pre", "devolvido_revisao"]);
const PRE_APROVADOS = new Set([
  "aguardando_documentacao", "em_analise_fpa_orc", "aguardando_diretoria_final",
  "aprovado_final", "em_execucao", "concluido", "pre_aprovado",
  "submetido_documentacao", "liberado", "liberado_parcial",
]);
const NAO_APROVADOS = new Set(["nao_aprovado_pre", "reprovado_final", "nao_aprovado", "postergado", "cancelado", "reprovado"]);

export function PeriodConsolidationPanel() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["submitted-projects"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name, status, category, estimated_total, submitted_at, area_id, areas:areas!projects_area_id_fkey(name)")
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const years = useMemo(() => {
    const set = new Set<number>();
    rows.forEach((r) => r.submitted_at && set.add(new Date(r.submitted_at).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  const [year, setYear] = useState<string>("all");
  const effectiveYear = year === "all" ? null : Number(year);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportSubmissoes(effectiveYear ?? undefined);
      toast.success("Planilha gerada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  };

  const filtered = useMemo(
    () => (effectiveYear == null ? rows : rows.filter((r) => r.submitted_at && new Date(r.submitted_at).getFullYear() === effectiveYear)),
    [rows, effectiveYear],
  );

  const sum = (list: Row[]) => list.reduce((acc, r) => acc + Number(r.estimated_total ?? 0), 0);

  const byMonth = useMemo(() => {
    const acc = new Map<string, { label: string; count: number; total: number }>();
    filtered.forEach((r) => {
      if (!r.submitted_at) return;
      const d = new Date(r.submitted_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const label = `${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
      const cur = acc.get(key) ?? { label, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(r.estimated_total ?? 0);
      acc.set(key, cur);
    });
    return Array.from(acc.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v);
  }, [filtered]);

  const byArea = useMemo(() => {
    const acc = new Map<string, { label: string; count: number; total: number }>();
    filtered.forEach((r) => {
      const label = r.areas?.name ?? "—";
      const cur = acc.get(label) ?? { label, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(r.estimated_total ?? 0);
      acc.set(label, cur);
    });
    return Array.from(acc.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const byCategory = useMemo(() => {
    const acc = new Map<string, { label: string; count: number; total: number }>();
    filtered.forEach((r) => {
      const label = CATEGORY_LABEL[r.category] ?? "—";
      const cur = acc.get(label) ?? { label, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(r.estimated_total ?? 0);
      acc.set(label, cur);
    });
    return Array.from(acc.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const emPreAnalise = filtered.filter((r) => PRE_ANALISE.has(r.status));
  const aguardandoDiretoria = filtered.filter((r) => AGUARDANDO_DIRETORIA.has(r.status));
  const devolvidos = filtered.filter((r) => DEVOLVIDOS.has(r.status));
  const preAprovados = filtered.filter((r) => PRE_APROVADOS.has(r.status));
  const naoAprovados = filtered.filter((r) => NAO_APROVADOS.has(r.status));

  const maxMonth = Math.max(1, ...byMonth.map((m) => m.total));

  if (isLoading) {
    return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Recurso solicitado por período</h1>
          <p className="text-sm text-muted-foreground">
            Consolidação automática do que os gestores estão pedindo, pela data de submissão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[160px] shrink-0"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={exporting} onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            {exporting ? "Exportando…" : "Exportar Excel"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Solicitado" value={formatBRL(sum(filtered))} hint={`${filtered.length} projeto(s) submetido(s)`} />
        <Kpi label="Submetidos" value={String(emPreAnalise.length)} hint={formatBRL(sum(emPreAnalise))} tone="info" />
        <Kpi label="Aguardando Diretoria" value={String(aguardandoDiretoria.length)} hint={formatBRL(sum(aguardandoDiretoria))} tone="warn" />
        <Kpi
          label="Pré-aprovados"
          value={String(preAprovados.length)}
          hint={`${formatBRL(sum(preAprovados))} · ${devolvidos.length} devolvido(s) · ${naoAprovados.length} não aprovado(s)`}
          tone="success"
        />
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">Submissões por mês</div>
        {byMonth.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhuma submissão no período.</div>
        ) : (
          <div className="divide-y">
            {byMonth.map((m) => (
              <div key={m.label} className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-sm">
                <span className="text-muted-foreground">{m.label}</span>
                <div className="h-2 min-w-0 rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${Math.max(2, (m.total / maxMonth) * 100)}%` }} />
                </div>
                <span className="whitespace-nowrap tabular-nums">
                  {formatBRL(m.total)} <span className="text-xs text-muted-foreground">· {m.count}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title="Por área" rows={byArea} />
        <Breakdown title="Por categoria" rows={byCategory} />
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">Fila de pré-análise</div>
        {emPreAnalise.length + devolvidos.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nada aguardando o FP&A.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submetido</th>
                  <th className="px-4 py-3 text-right">Estimado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...emPreAnalise, ...devolvidos].map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{p.code ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.areas?.name ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateBR(p.submitted_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatBRL(p.estimated_total ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/projects/$id" params={{ id: p.id }}>Analisar</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, hint, tone = "neutral" }: {
  label: string; value: string; hint?: string;
  tone?: "neutral" | "info" | "warn" | "success";
}) {
  const toneClass =
    tone === "info" ? "text-primary" :
    tone === "warn" ? "text-amber-600 dark:text-amber-400" :
    tone === "success" ? "text-success" : "";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number; total: number }[] }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3 text-sm font-medium">{title}</div>
      {rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">Sem dados no período.</div>
      ) : (
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="whitespace-nowrap tabular-nums">
                {formatBRL(r.total)} <span className="text-xs text-muted-foreground">· {r.count}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
