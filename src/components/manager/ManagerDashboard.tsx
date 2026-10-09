import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ACTIVE_CATEGORIES, CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL,
  formatBRL, formatDateBR, shortName,
} from "@/lib/labels";
import { Plus, AlertTriangle } from "lucide-react";
import { SubmitProjectDialog } from "@/components/manager/SubmitProjectDialog";
import { STAGE1_EDITABLE, STAGE2_EDITABLE, stage1Pending, situationLabel } from "@/lib/project-rules";

type Project = {
  id: string; code: string | null; name: string;
  executor_area_id?: string | null;
  status: keyof typeof STATUS_LABEL;
  category: keyof typeof CATEGORY_LABEL;
  priority: keyof typeof PRIORITY_LABEL;
  estimated_total: number;
  est_start_date: string | null;
  est_end_date: string | null;
  description: string | null;
  justification: string | null;
  viability_summary: string | null;
  planning_end_date: string | null;
  execution_end_date: string | null;
  created_at: string;
  submitted_at: string | null;
  area_id: string;
  owner_id: string;
  fpa_risk: "baixo" | "medio" | "alto" | null;
  extraordinary_approval: boolean;
  ceo_approved_amount: number | null;
  directoria_suggested_amount: number | null;
  areas: { name: string } | null;
  owner_name?: string;
  pendingCount?: number;
  pendingList?: string[];
  study_amount: number | null; execution_amount: number | null; study_start_date: string | null;
  execution_start_date: string | null; execution_months: number | null; payback_months: number | null;
  payback_not_applicable: boolean; payback_na_justification: string | null;
};

const PRIORITY_TONE: Record<keyof typeof PRIORITY_LABEL, string> = {
  alta: "bg-destructive/15 text-destructive border-destructive/30",
  media: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  baixa: "bg-muted text-muted-foreground border-muted",
};

const HUB_STATUSES = new Set(STAGE1_EDITABLE.filter((x) => x !== "devolvido_pre"));
const BADGE_W = "min-w-[150px] justify-center text-center";

function needsManagerAction(p: Project): { pending: boolean; reason: string } {
  if (HUB_STATUSES.has(p.status)) {
    return { pending: true, reason: (p.pendingCount ?? 0) > 0 ? "Pendente" : "Aguardando submissão" };
  }
  const reasonMap: Record<string, string> = {
    devolvido_pre: "FP&A devolveu a proposta para ajuste",
    devolvido_orc: "FP&A devolveu o projeto firme para ajuste",
    em_projeto_firme: "Apresente o projeto firme",
  };
  if (reasonMap[p.status]) return { pending: true, reason: reasonMap[p.status] };
  return { pending: false, reason: "" };
}

function situationGroup(p: Project): string {
  if (HUB_STATUSES.has(p.status)) return (p.pendingCount ?? 0) > 0 ? "pendente" : "pronto";
  return p.status;
}

const SITUATION_OPTIONS: { v: string; l: string }[] = [
  { v: "pendente", l: "Pendente" },
  { v: "pronto", l: "Aguardando submissão" },
  { v: "em_pre_analise_fpa", l: "Submetido" },
  { v: "devolvido_pre", l: "Devolvido para ajuste" },
  { v: "nao_aprovado_pre", l: "Rejeitado" },
  { v: "em_projeto_firme", l: "Pré-aprovado" },
  { v: "devolvido_orc", l: "Projeto firme devolvido" },
  { v: "em_validacao_execucao", l: "Validação" },
  { v: "aprovado_final", l: "Liberado para execução" },
  { v: "reprovado_final", l: "Execução não aprovada" },
  { v: "estudo_concluido", l: "Projeto firme concluído" },
];

const SELECT_COLS =
  "id, code, name, status, category, priority, estimated_total, est_start_date, est_end_date, description, justification, viability_summary, cost_center, planning_end_date, execution_end_date, created_at, submitted_at, area_id, owner_id, fpa_risk, extraordinary_approval, ceo_approved_amount, directoria_suggested_amount, study_amount, execution_amount, study_start_date, execution_start_date, execution_months, payback_months, payback_not_applicable, payback_na_justification, branch_id, business_unit_id, executor_area_id, already_in_execution, indicativo_zero_months, areas:areas!projects_area_id_fkey(name)";

/** scope="own": projetos do gestor logado. scope="all": todos os projetos (visão Admin). */
export function ManagerDashboard({ scope = "own" }: { scope?: "own" | "all" }) {
  const { profile } = useAuth();
  const ownerId = profile?.id;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["manager-projects", scope, ownerId],
    enabled: scope === "all" || !!ownerId,
    queryFn: async (): Promise<Project[]> => {
      let query = supabase.from("projects").select(SELECT_COLS).order("created_at", { ascending: false });
      if (scope === "own") query = profile?.area_id ? query.or(`owner_id.eq.${ownerId},executor_area_id.eq.${profile.area_id}`) : query.eq("owner_id", ownerId!);
      const { data, error } = await query;
      if (error) throw error;
      let rows = (data ?? []) as unknown as Project[];
      const hubIds = rows.filter((r) => HUB_STATUSES.has(r.status)).map((r) => r.id);
      if (hubIds.length) {
        const [{ data: disb }, { data: docs }, { data: req }] = await Promise.all([
          supabase.from("disbursements").select("project_id, phase, period, amount").eq("version", "indicativo").in("project_id", hubIds),
          supabase.from("project_documents").select("project_id, required_document_types(key)").in("project_id", hubIds),
          supabase.from("required_document_types").select("key, label").eq("active", true).eq("is_required", true).eq("required_for_stage", 1),
        ]);
        rows = rows.map((r) => {
          if (!HUB_STATUSES.has(r.status)) return r;
          const sched = (disb ?? []).filter((d) => d.project_id === r.id).map((d) => ({ period: d.period, phase: d.phase, amount: Number(d.amount) }));
          const keys = new Set((docs ?? []).filter((d: any) => d.project_id === r.id).map((d: any) => d.required_document_types?.key).filter(Boolean) as string[]);
          const list = stage1Pending(r as any, sched, keys, req ?? []).map((x) => x.label);
          return { ...r, pendingCount: list.length, pendingList: list };
        });
      }
      const s2 = rows.filter((r) => STAGE2_EDITABLE.includes(r.status));
      if (s2.length) {
        const res = await Promise.all(s2.map((r) => supabase.rpc("stage2_missing", { p_project_id: r.id })));
        const byId = new Map<string, string[]>();
        s2.forEach((r, i) => {
          if (res[i].error) {
            console.error("stage2_missing falhou", r.id, res[i].error);
            byId.set(r.id, ["Não foi possível verificar as pendências. Abra o projeto para conferir."]);
          } else {
            byId.set(r.id, (res[i].data ?? []) as string[]);
          }
        });
        rows = rows.map((r) => byId.has(r.id) ? { ...r, pendingCount: byId.get(r.id)!.length, pendingList: byId.get(r.id)! } : r);
      }
      if (scope === "own") return rows;
      const ids = Array.from(new Set(rows.map((r) => r.owner_id).filter(Boolean)));
      if (ids.length === 0) return rows;
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return rows.map((r) => ({ ...r, owner_name: nameById.get(r.owner_id) ?? "—" }));
    },
  });

  return <PanelTab projects={projects} isLoading={isLoading} scope={scope} />;
}

function PanelTab({ projects, isLoading, scope }: { projects: Project[]; isLoading: boolean; scope: "own" | "all" }) {
  const [submitFor, setSubmitFor] = useState<{ id: string; name: string; pending: string[] } | null>(null);

  const totalAll = projects.length;
  const submetidos = projects.filter((p) => p.status === "em_pre_analise_fpa").length;
  const needsAction = projects.filter((p) => needsManagerAction(p).pending).length;
  const preAprovados = projects.filter((p) => p.status === "em_projeto_firme").length;

  const isAll = scope === "all";
  const myAreaId = useAuth().profile?.area_id;
  const [q, setQ] = useState("");
  const [statusGroup, setStatusGroup] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [areaId, setAreaId] = useState<string>("all");
  const [ownerId, setOwnerId] = useState<string>("all");
  const tableRef = useRef<HTMLDivElement>(null);

  const areaOptions = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => { if (p.area_id && p.areas?.name) map.set(p.area_id, p.areas.name); });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const ownerOptions = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => { if (p.owner_id && p.owner_name) map.set(p.owner_id, p.owner_name); });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const statusOptions = useMemo(() => {
    const present = new Set(projects.map(situationGroup));
    return SITUATION_OPTIONS.filter((o) => present.has(o.v));
  }, [projects]);
  const categoryOptions = useMemo(() => {
    const present = new Set(projects.map((p) => p.category));
    return ACTIVE_CATEGORIES.filter((c) => present.has(c));
  }, [projects]);

  const focusFromCard = (group: string) => {
    setStatusGroup(group);
    setCategory("all");
    setQ("");
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const filtered = useMemo(() => {
    let rows = projects;
    if (category !== "all") rows = rows.filter((p) => p.category === category);
    if (areaId !== "all") rows = rows.filter((p) => p.area_id === areaId);
    if (ownerId !== "all") rows = rows.filter((p) => p.owner_id === ownerId);
    if (statusGroup !== "all") {
      rows = rows.filter((p) => {
        switch (statusGroup) {
          case "needs_action": return needsManagerAction(p).pending;
          case "submetido": return p.status === "em_pre_analise_fpa";
          default: return situationGroup(p) === statusGroup;
        }
      });
    }
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(n) || (p.code ?? "").toLowerCase().includes(n));
    }
    return rows;
  }, [projects, category, areaId, ownerId, statusGroup, q]);


  return (
    <div className="space-y-6">
      {/* Header + CTA */}
      <div className="grid grid-cols-1 items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{isAll ? "Projetos" : "Painel de Gestão"}</h1>
          <p className="text-sm text-muted-foreground">
            {isAll
              ? "Todos os projetos de todos os gestores."
              : "Cadastre seus projetos, complete as informações e submeta ao FP&A. Submeta cada projeto pela própria linha."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/projects/new"><Plus className="mr-1 h-4 w-4" /> Novo Projeto</Link>
          </Button>
        </div>
      </div>

      {/* Big numbers clicáveis */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BigNumber
          label="Total"
          value={totalAll}
          hint={isAll ? "Todos os projetos cadastrados." : "Todos seus projetos."}
          active={statusGroup === "all"}
          onClick={() => focusFromCard("all")}
        />
        <BigNumber
          label={isAll ? "Aguardando ação do gestor" : "Aguardando sua ação"}
          value={needsAction}
          tone="warn"
          icon={<AlertTriangle className="h-4 w-4" />}
          hint="Pendentes de informação, prontos para submeter, devolvidos e projetos em planejamento."
          active={statusGroup === "needs_action"}
          onClick={() => focusFromCard("needs_action")}
        />
        <BigNumber
          label="Submetido"
          value={submetidos}
          tone="info"
          hint={isAll ? "Projetos já submetidos ao FP&A pelos gestores." : "Projetos já submetidos ao FP&A."}
          active={statusGroup === "submetido"}
          onClick={() => focusFromCard("submetido")}
        />
        <BigNumber
          label="Pré-aprovados"
          value={preAprovados}
          tone="success"
          hint="Projetos pré-aprovados, em planejamento (Etapa 2)."
          active={statusGroup === "em_projeto_firme"}
          onClick={() => focusFromCard("em_projeto_firme")}
        />
      </div>

      {/* Filtros */}
      <div className={`grid gap-3 rounded-lg border bg-card p-4 scroll-mt-4 ${isAll ? "md:grid-cols-5" : "md:grid-cols-3"}`} ref={tableRef}>
        {statusGroup !== "all" && (
          <div className="-mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground md:col-span-full">
            <span>Filtro ativo a partir do painel.</span>
            <button type="button" onClick={() => setStatusGroup("all")} className="rounded border px-2 py-0.5 hover:bg-accent">Limpar filtro</button>
          </div>
        )}
        <Input placeholder="Buscar por nome ou código…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={statusGroup} onValueChange={setStatusGroup}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="needs_action">{isAll ? "Aguardando ação do gestor" : "Aguardando sua ação"}</SelectItem>
            <SelectItem value="submetido">Submetidos</SelectItem>
            {statusOptions.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAll && (
          <>
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {areaOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder="Gestor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os gestores</SelectItem>
                {ownerOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
      </div>


      {/* Tabela */}
      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhum projeto com esses filtros.
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-3 w-8"></th>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nome</th>
                  {isAll && <th className="px-4 py-3">Gestor</th>}
                  {isAll && <th className="px-4 py-3">Área</th>}
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Estimado</th>
                  <th className="px-4 py-3">Submetido</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p) => {
                  const action = needsManagerAction(p);
                  const canSubmit = HUB_STATUSES.has(p.status);
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-2 py-3">
                        {action.pending && (
                          <Popover>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label="Ver pendências do projeto"
                                      className="inline-flex rounded p-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    </button>
                                  </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Ver pendências do projeto</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <PopoverContent className="w-72 text-sm">
                              <div className="mb-2 font-medium">
                                {STAGE2_EDITABLE.includes(p.status) ? "Pendências da Etapa 2 · Planejamento:" : HUB_STATUSES.has(p.status) ? "Pendências da Etapa 1 · Proposta indicativa:" : "Ação necessária:"}
                              </div>
                              {(p.pendingList ?? []).length > 0 ? (
                                <ul className="list-inside list-disc space-y-1 text-muted-foreground">{(p.pendingList ?? []).map((l) => <li key={l}>{l}</li>)}</ul>
                              ) : (
                                <p className="text-muted-foreground">
                                  {HUB_STATUSES.has(p.status) ? "Nenhuma pendência. Pronto para submeter." : STAGE2_EDITABLE.includes(p.status) ? "Nenhuma pendência. Pronto para enviar para liberação." : action.reason}
                                </p>
                              )}
                            </PopoverContent>
                          </Popover>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {p.code ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium">{p.name}{p.executor_area_id && p.executor_area_id !== p.area_id && p.executor_area_id === myAreaId && <span className="ml-2 rounded border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">Executora</span>}</div>
                      </td>
                      {isAll && <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">{shortName(p.owner_name) || "—"}</td>}
                      {isAll && <td className="px-4 py-3 text-xs text-muted-foreground">{p.areas?.name ?? "—"}</td>}
                      <td className="px-4 py-3 text-xs text-muted-foreground">{CATEGORY_LABEL[p.category]}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex w-16 justify-center rounded border px-2 py-0.5 text-center text-xs ${PRIORITY_TONE[p.priority]}`}>
                          {PRIORITY_LABEL[p.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3">{HUB_STATUSES.has(p.status)
                        ? <Badge variant="outline" className={`${BADGE_W} pointer-events-none border-transparent text-xs text-foreground ${(p.pendingCount ?? 0) > 0 ? "bg-warning/20" : "bg-success/20"}`}>{situationLabel(p.status, p.pendingCount ?? 0)}</Badge>
                        : <StatusBadge status={p.status} className={BADGE_W} />}</td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums">{formatBRL(p.estimated_total)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {p.submitted_at ? formatDateBR(p.submitted_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link to="/app/projects/$id" params={{ id: p.id }}>Acessar</Link>
                          </Button>
                          {canSubmit && (
                            <Button size="sm" onClick={() => setSubmitFor({ id: p.id, name: p.name, pending: p.pendingList ?? [] })}>Submeter</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SubmitProjectDialog open={!!submitFor} onOpenChange={(o) => !o && setSubmitFor(null)} project={submitFor} />
    </div>
  );
}

function BigNumber({
  label, value, hint, tone = "neutral", icon, onClick, active,
}: {
  label: string;
  value: number | null;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warn" | "info";
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass =
    tone === "success" ? "text-success" :
    tone === "danger" ? "text-destructive" :
    tone === "warn" ? "text-amber-600 dark:text-amber-400" :
    tone === "info" ? "text-primary" :
    "";
  const interactive = !!onClick;
  const baseClass = `rounded-lg border bg-card p-4 text-left transition ${interactive ? "cursor-pointer hover:border-primary/40 hover:bg-accent/20" : ""} ${active ? "border-primary ring-1 ring-primary/40" : ""}`;
  const content = (
    <>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>
        {value == null ? "—" : value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </>
  );
  if (interactive) {
    return <button type="button" onClick={onClick} className={baseClass} title={hint}>{content}</button>;
  }
  return <div className={baseClass} title={hint}>{content}</div>;
}
