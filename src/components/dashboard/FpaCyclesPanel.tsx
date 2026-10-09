import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { SlaBadge } from "@/components/SlaBadge";
import { BatchActionsBar } from "@/components/dashboard/BatchActionsBar";
import { CycleFunnelPanel } from "@/components/dashboard/CycleFunnelPanel";
import { AreaBudgetPanel } from "@/components/dashboard/AreaBudgetPanel";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportCycleExecutivePdf } from "@/lib/pdf-export";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { computeSla } from "@/lib/sla";
import { formatBRL, STATUS_LABEL, cyclePeriodFromDates, WINDOW_LABEL, type CyclePeriod } from "@/lib/labels";

type CycleRow = {
  id: string; name: string; year: number;
  is_active: boolean; archived_at: string | null;
  submission_start: string | null; submission_end: string | null;
  analysis_start: string | null; analysis_end: string | null;
  cycle_start_date: string | null; cycle_end_date: string | null;
  cycle_number_in_year: number | null;
};

type ProjectRow = {
  id: string; code: string | null; name: string;
  status: keyof typeof STATUS_LABEL;
  estimated_total: number;
  ceo_approved_amount: number | null;
  fpa_approved_amount: number | null;
  confirmed_total: number | null;
  cycle_id: string | null;
  updated_at: string;
};

const APPROVED = new Set(["liberado", "liberado_parcial"]);
const REJECTED = new Set(["reprovado"]);
const POSTPONED = new Set(["postergado", "nao_aprovado", "cancelado"]);
const WAITING = new Set(["aguardando_diretor", "aguardando_ceo", "aguardando_cfo"]);
const PREAPPROVED = new Set(["pre_aprovado"]);
const FPA = new Set(["submetido_intake", "submetido_documentacao", "em_revisao_fpa"]);

type GroupKey = "fpa" | "pre" | "waiting" | "approved" | "rejected" | "postponed";
const GROUP_SETS: Record<GroupKey, Set<string>> = {
  fpa: FPA, pre: PREAPPROVED, waiting: WAITING, approved: APPROVED, rejected: REJECTED, postponed: POSTPONED,
};

function projValue(p: ProjectRow): number {
  return Number(p.ceo_approved_amount ?? p.fpa_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0);
}

const TONE: Record<CyclePeriod, string> = {
  submissao: "bg-success/15 text-success border-success/30",
  analise: "bg-primary/10 text-primary border-primary/30",
  em_vigencia: "bg-success/15 text-success border-success/30",
  pausa: "bg-muted text-muted-foreground border-muted",
  fechado: "bg-muted text-muted-foreground border-muted",
};

export function FpaCyclesPanel() {
  const { isRealFpa } = useAuth();

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["cycles"],
    queryFn: async (): Promise<CycleRow[]> => {
      const { data, error } = await supabase
        .from("cycles")
        .select("id, name, year, is_active, archived_at, submission_start, submission_end, analysis_start, analysis_end, cycle_start_date, cycle_end_date, cycle_number_in_year")
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CycleRow[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-by-cycle-fpa"],
    queryFn: async (): Promise<ProjectRow[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name, status, estimated_total, ceo_approved_amount, fpa_approved_amount, confirmed_total, cycle_id, updated_at");
      if (error) throw error;
      return (data ?? []) as unknown as ProjectRow[];
    },
  });

  const byCycle = useMemo(() => {
    const map = new Map<string, ProjectRow[]>();
    projects.forEach((p) => {
      if (!p.cycle_id) return;
      const arr = map.get(p.cycle_id) ?? [];
      arr.push(p);
      map.set(p.cycle_id, arr);
    });
    return map;
  }, [projects]);

  const [selected, setSelected] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupKey | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const selectedCycle = cycles.find((c) => c.id === selected) ?? null;
  const selectedProjects = selected ? byCycle.get(selected) ?? [] : [];

  // Histórico para SLA (apenas projetos visíveis)
  const visibleIds = selectedProjects.map((p) => p.id);
  const { data: lastChanges = new Map<string, string>() } = useQuery({
    queryKey: ["status-history-latest", visibleIds.join(",")],
    enabled: visibleIds.length > 0,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data } = await supabase
        .from("project_status_history")
        .select("project_id, created_at")
        .in("project_id", visibleIds)
        .order("created_at", { ascending: false });
      const m = new Map<string, string>();
      (data ?? []).forEach((r: any) => {
        if (!m.has(r.project_id)) m.set(r.project_id, r.created_at);
      });
      return m;
    },
  });

  const filtered = useMemo(() => {
    if (!group) return selectedProjects;
    const set = GROUP_SETS[group];
    return selectedProjects.filter((p) => set.has(p.status));
  }, [selectedProjects, group]);

  const toggle = (id: string) => {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setPicked((s) => {
      if (s.size === filtered.length) return new Set();
      return new Set(filtered.map((p) => p.id));
    });
  };

  const selectedRows = filtered.filter((p) => picked.has(p.id))
    .map((p) => ({ id: p.id, status: p.status, cycle_id: p.cycle_id }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Painel dos Ciclos</h1>
        <p className="text-sm text-muted-foreground">Visão geral de todos os ciclos. Clique em um card para ver detalhes.</p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Carregando…</div>
      ) : cycles.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Nenhum ciclo criado. Vá em <Link to="/app/admin" className="text-primary hover:underline">Administração</Link> para criar.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {cycles.map((c) => {
            const period = cyclePeriodFromDates(c);
            const archived = !!c.archived_at;
            const ps = byCycle.get(c.id) ?? [];
            return (
              <button
                key={c.id}
                onClick={() => { setSelected(selected === c.id ? null : c.id); setGroup(null); setPicked(new Set()); }}
                className={`rounded-lg border bg-card p-4 text-left transition hover:border-primary/40 ${selected === c.id ? "border-primary ring-1 ring-primary/40" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">({c.year}{c.cycle_number_in_year ? ` · #${String(c.cycle_number_in_year).padStart(2, "0")}` : ""})</span>
                  {c.is_active && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary-foreground">Ativo</span>}
                  {archived && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Arquivado</span>}
                </div>
                <div className="mt-2">
                  <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${TONE[period]}`}>{WINDOW_LABEL[period]}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Projetos" value={String(ps.length)} />
                  <Stat label="Valor total" value={formatBRL(ps.reduce((s, p) => s + projValue(p), 0))} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedCycle && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Detalhes · {selectedCycle.name} ({selectedCycle.year})
              {group && <span className="ml-2 text-xs text-muted-foreground">filtro: <strong>{GROUP_LABEL[group]}</strong></span>}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try { await exportCycleExecutivePdf(selectedCycle.id); }
                  catch (e: any) { toast.error(e?.message ?? "Falha ao gerar PDF"); }
                }}
              >
                <FileDown className="mr-1 h-4 w-4" /> PDF executivo
              </Button>
              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setSelected(null); setGroup(null); setPicked(new Set()); }}>fechar ×</button>
            </div>
          </div>
          <BigNumbers items={selectedProjects} active={group} onToggle={(g) => { setGroup((cur) => cur === g ? null : g); setPicked(new Set()); }} />
          <ProjectsByCycleList
            items={filtered}
            lastChanges={lastChanges}
            picked={picked}
            onToggle={toggle}
            onToggleAll={toggleAll}
            allowSelect={isRealFpa}
          />
          <AreaBudgetPanel cycleId={selectedCycle.id} />
          <CycleFunnelPanel cycleId={selectedCycle.id} />
        </section>
      )}

      <BatchActionsBar selected={selectedRows} onClear={() => setPicked(new Set())} />
    </div>
  );
}

const GROUP_LABEL: Record<GroupKey, string> = {
  fpa: "Em análise FP&A", pre: "Pré-aprovados", waiting: "Aguardando Diretoria",
  approved: "Aprovados", rejected: "Reprovados", postponed: "Postergados",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function BigNumbers({ items, active, onToggle }: { items: ProjectRow[]; active: GroupKey | null; onToggle: (g: GroupKey) => void }) {
  const sum = (arr: ProjectRow[]) => arr.reduce((s, p) => s + projValue(p), 0);
  const cards: { key: GroupKey; label: string; arr: ProjectRow[]; tone: string }[] = [
    { key: "fpa", label: "Em análise FP&A", arr: items.filter((p) => FPA.has(p.status)), tone: "text-primary" },
    { key: "pre", label: "Pré-aprovados", arr: items.filter((p) => PREAPPROVED.has(p.status)), tone: "text-primary" },
    { key: "waiting", label: "Aguardando Diretoria", arr: items.filter((p) => WAITING.has(p.status)), tone: "text-amber-600 dark:text-amber-400" },
    { key: "approved", label: "Aprovados", arr: items.filter((p) => APPROVED.has(p.status)), tone: "text-success" },
    { key: "rejected", label: "Reprovados", arr: items.filter((p) => REJECTED.has(p.status)), tone: "text-destructive" },
    { key: "postponed", label: "Postergados", arr: items.filter((p) => POSTPONED.has(p.status)), tone: "text-muted-foreground" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => {
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onToggle(c.key)}
            className={`rounded-lg border bg-card p-4 text-left transition hover:border-primary/40 ${isActive ? "border-primary ring-1 ring-primary/40" : ""}`}
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${c.tone}`}>{c.arr.length}</div>
            <div className="mt-1 text-xs tabular-nums text-muted-foreground">{formatBRL(sum(c.arr))}</div>
          </button>
        );
      })}
    </div>
  );
}

function ProjectsByCycleList({
  items, lastChanges, picked, onToggle, onToggleAll, allowSelect,
}: {
  items: ProjectRow[];
  lastChanges: Map<string, string>;
  picked: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  allowSelect: boolean;
}) {
  if (items.length === 0) {
    return <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">Nenhum projeto neste filtro.</div>;
  }
  const allChecked = items.length > 0 && items.every((p) => picked.has(p.id));
  return (
    <div className="overflow-x-auto rounded-md border bg-card text-sm">
      <table className="w-full">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            {allowSelect && (
              <th className="w-10 px-3 py-2">
                <Checkbox checked={allChecked} onCheckedChange={onToggleAll} aria-label="Selecionar todos" />
              </th>
            )}
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Projeto</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">SLA</th>
            <th className="px-3 py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((p) => {
            const lastIso = lastChanges.get(p.id) ?? p.updated_at;
            const sla = computeSla(p.status, lastIso);
            return (
              <tr key={p.id} className="hover:bg-muted/20">
                {allowSelect && (
                  <td className="px-3 py-2">
                    <Checkbox checked={picked.has(p.id)} onCheckedChange={() => onToggle(p.id)} aria-label={`Selecionar ${p.name}`} />
                  </td>
                )}
                <td className="px-3 py-2">
                  <Link to="/app/projects/$id" params={{ id: p.id }} className="font-mono text-xs text-primary hover:underline">{p.code ?? "—"}</Link>
                </td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                <td className="px-3 py-2"><SlaBadge info={sla} /></td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatBRL(projValue(p))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
