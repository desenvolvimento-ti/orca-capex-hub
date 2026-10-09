import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { StatusBadge } from "@/components/StatusBadge";
import { DirectoriaActions } from "@/components/project/DirectoriaActions";
import { DirectoriaPrevActions } from "@/components/project/DirectoriaPrevActions";
import { DirectoriaFinalActions } from "@/components/project/DirectoriaFinalActions";
import { formatBRL, STATUS_LABEL } from "@/lib/labels";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/app/diretoria")({ component: DiretoriaPage });

type StatRow = {
  id: string;
  code: string | null;
  name: string;
  status: keyof typeof STATUS_LABEL;
  estimated_total: number;
  confirmed_total: number | null;
  fpa_approved_amount: number | null;
  ceo_approved_amount: number | null;
  extraordinary_approval: boolean;
  fpa_risk: "baixo" | "medio" | "alto" | null;
  area_id: string;
  owner_id: string;
  cycle_id: string | null;
  areas: { name: string } | null;
  owner_name?: string;
};

type DecisionRow = StatRow;

const APPROVED = new Set(["liberado", "liberado_parcial", "aprovado_final", "em_execucao", "concluido"]);
const REJECTED = new Set(["reprovado", "reprovado_final", "nao_aprovado_pre"]);
const POSTPONED = new Set(["postergado", "nao_aprovado", "cancelado"]);
const WAITING = new Set(["aguardando_diretor", "aguardando_ceo", "aguardando_diretoria_prev", "aguardando_diretoria_final"]);
const PREAPPROVED = new Set(["pre_aprovado", "aguardando_documentacao"]);

type GroupKey = "recv" | "waiting" | "approved" | "rejected" | "postponed" | "preapproved";

const GROUP_LABEL: Record<GroupKey, string> = {
  recv: "Recebidos pela Diretoria",
  waiting: "Aguardando decisão",
  approved: "Aprovados",
  rejected: "Reprovados",
  postponed: "Postergados",
  preapproved: "Pré-aprovados (margem)",
};

function projValue(p: StatRow): number {
  return Number(
    p.ceo_approved_amount ?? p.fpa_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0
  );
}

function DiretoriaPage() {
  const { profile, roles, viewAs, isRealFpa } = useAuth();
  const actsAsCeo = roles.includes("ceo") || (isRealFpa && viewAs === "ceo");
  const isAreaDirector =
    !actsAsCeo && (roles.includes("cfo") || roles.includes("cco") || roles.includes("cmo"));

  const [selectedGroup, setSelectedGroup] = useState<GroupKey | null>(null);

  const { data: myAreaIds = [] } = useQuery({
    queryKey: ["my-director-areas", profile?.id, isAreaDirector],
    enabled: !!profile?.id && isAreaDirector,
    queryFn: async () => {
      const { data } = await supabase.from("areas").select("id").eq("director_id", profile!.id);
      return (data ?? []).map((a) => a.id);
    },
  });

  const { data: activeCycle } = useQuery({
    queryKey: ["active-cycle"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cycles")
        .select("id, name, year")
        .eq("is_active", true)
        .is("archived_at", null)
        .maybeSingle();
      return data;
    },
  });

  const scopeReady = actsAsCeo || (isAreaDirector && myAreaIds.length > 0);

  // Stats: todos os projetos do ciclo vigente, escopados por papel — agora com dados completos
  // para podermos exibir a lista detalhada do grupo clicado.
  const { data: stats = [] } = useQuery({
    queryKey: ["diretoria-stats", activeCycle?.id, actsAsCeo, myAreaIds.join(",")],
    enabled: !!activeCycle?.id && scopeReady,
    queryFn: async () => {
      let q = supabase
        .from("projects")
        .select(
          "id, code, name, status, estimated_total, confirmed_total, fpa_approved_amount, ceo_approved_amount, extraordinary_approval, fpa_risk, area_id, owner_id, cycle_id, areas:areas!projects_area_id_fkey(name)"
        )
        .eq("cycle_id", activeCycle!.id);
      if (!actsAsCeo) q = q.in("area_id", myAreaIds);
      const { data, error } = await q;
      if (error) throw error;
      const list = (data ?? []) as unknown as StatRow[];
      const owners = Array.from(new Set(list.map((r) => r.owner_id)));
      if (owners.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", owners);
        const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
        return list.map((r) => ({ ...r, owner_name: map.get(r.owner_id) ?? "—" }));
      }
      return list;
    },
  });

  // Lista de pendências (aguardando decisão deste usuário)
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["diretoria-projects", profile?.id, actsAsCeo, isAreaDirector, myAreaIds.join(",")],
    enabled: !!profile?.id && scopeReady,
    queryFn: async () => {
      let q = supabase
        .from("projects")
        .select(
          "id, code, name, status, estimated_total, confirmed_total, fpa_approved_amount, ceo_approved_amount, extraordinary_approval, fpa_risk, area_id, owner_id, cycle_id, areas:areas!projects_area_id_fkey(name)"
        )
        .order("submitted_at", { ascending: false });

      if (actsAsCeo) {
        q = q.in("status", ["aguardando_ceo", "aguardando_diretoria_final"]);
      } else {
        q = q.in("status", ["aguardando_diretor", "aguardando_diretoria_prev", "aguardando_diretoria_final"]).in("area_id", myAreaIds);
      }
      const { data, error } = await q;
      if (error) throw error;

      const list = (data ?? []) as unknown as DecisionRow[];
      const owners = Array.from(new Set(list.map((r) => r.owner_id)));
      if (owners.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", owners);
        const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
        return list.map((r) => ({ ...r, owner_name: map.get(r.owner_id) ?? "—" }));
      }
      return list;
    },
  });

  const groups = useMemo(() => {
    const reachedDiretoria = stats.filter(
      (p) => WAITING.has(p.status) || APPROVED.has(p.status) || REJECTED.has(p.status) || POSTPONED.has(p.status)
    );
    return {
      recv: reachedDiretoria,
      waiting: stats.filter((p) => WAITING.has(p.status)),
      approved: stats.filter((p) => APPROVED.has(p.status)),
      rejected: stats.filter((p) => REJECTED.has(p.status)),
      postponed: stats.filter((p) => POSTPONED.has(p.status)),
      preapproved: stats.filter((p) => PREAPPROVED.has(p.status)),
    } as Record<GroupKey, StatRow[]>;
  }, [stats]);

  if (!actsAsCeo && !isAreaDirector) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Esta área é exclusiva da Diretoria.
      </div>
    );
  }

  const sum = (arr: StatRow[]) => arr.reduce((s, p) => s + projValue(p), 0);

  return (
    <div className="space-y-6">
      <BackButton fallback="/app" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu Painel</h1>
        <p className="text-sm text-muted-foreground">
          {actsAsCeo
            ? "Projetos aguardando aprovação final do CEO — incluindo aqueles aprovados extraordinariamente por outro Diretor."
            : "Projetos encaminhados pelo FP&A para sua aprovação extraordinária como Diretor da área."}
        </p>
      </div>

      <section className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Ciclo vigente {activeCycle ? `· ${activeCycle.name} (${activeCycle.year})` : "· nenhum ciclo ativo"}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <BigCard label="Recebidos" gKey="recv" count={groups.recv.length} total={sum(groups.recv)}
            active={selectedGroup === "recv"} onClick={() => setSelectedGroup(selectedGroup === "recv" ? null : "recv")} />
          <BigCard label="Aguardando decisão" gKey="waiting" count={groups.waiting.length} total={sum(groups.waiting)} tone="warn"
            active={selectedGroup === "waiting"} onClick={() => setSelectedGroup(selectedGroup === "waiting" ? null : "waiting")} />
          <BigCard label="Aprovados" gKey="approved" count={groups.approved.length} total={sum(groups.approved)} tone="success"
            active={selectedGroup === "approved"} onClick={() => setSelectedGroup(selectedGroup === "approved" ? null : "approved")} />
          <BigCard label="Reprovados" gKey="rejected" count={groups.rejected.length} total={sum(groups.rejected)} tone="danger"
            active={selectedGroup === "rejected"} onClick={() => setSelectedGroup(selectedGroup === "rejected" ? null : "rejected")} />
          <BigCard label="Postergados" gKey="postponed" count={groups.postponed.length} total={sum(groups.postponed)} tone="muted"
            active={selectedGroup === "postponed"} onClick={() => setSelectedGroup(selectedGroup === "postponed" ? null : "postponed")} />
          <BigCard label="Pré-aprovados (margem)" gKey="preapproved" count={groups.preapproved.length} total={sum(groups.preapproved)} tone="info"
            hint="Margem ainda disponível para aprovação."
            active={selectedGroup === "preapproved"} onClick={() => setSelectedGroup(selectedGroup === "preapproved" ? null : "preapproved")} />
        </div>
        <p className="text-[11px] text-muted-foreground">Clique em qualquer card para ver os projetos do grupo.</p>
      </section>

      {selectedGroup && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">{GROUP_LABEL[selectedGroup]}</h2>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedGroup(null)}
            >
              fechar ×
            </button>
          </div>
          <GroupList items={groups[selectedGroup]} />
        </section>
      )}

      <div>
        <h2 className="text-sm font-semibold tracking-tight">Pendências de decisão</h2>
        <p className="text-xs text-muted-foreground">Projetos aguardando sua ação direta.</p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhum projeto aguardando sua decisão no momento.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((p) => {
            const value =
              p.fpa_approved_amount ?? p.confirmed_total ?? p.estimated_total ?? 0;
            return (
              <li key={p.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to="/app/projects/$id" params={{ id: p.id }} className="font-mono text-xs text-primary hover:underline">
                      {p.code ?? "sem código"}
                    </Link>
                    <span className="truncate font-medium">{p.name}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{p.areas?.name ?? "—"}</span>
                    <span>· Gestor: {p.owner_name ?? "—"}</span>
                    <span>· {formatBRL(value)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {p.status === "aguardando_diretoria_prev" ? (
                    <DirectoriaPrevActions projectId={p.id} estimatedTotal={p.estimated_total ?? null} />
                  ) : p.status === "aguardando_diretoria_final" ? (
                    <DirectoriaFinalActions
                      projectId={p.id}
                      approvedAmount={p.confirmed_total ?? p.estimated_total ?? null}
                    />
                  ) : (
                    <DirectoriaActions projectId={p.id} />
                  )}
                  <Link to="/app/projects/$id" params={{ id: p.id }} className="text-xs text-primary hover:underline">
                    Abrir projeto →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GroupList({ items }: { items: StatRow[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Nenhum projeto neste grupo.
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/app/projects/$id" params={{ id: p.id }} className="font-mono text-xs text-primary hover:underline">
                {p.code ?? "—"}
              </Link>
              <span className="truncate font-medium">{p.name}</span>
              <StatusBadge status={p.status} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {p.areas?.name ?? "—"} · Gestor: {p.owner_name ?? "—"} · {formatBRL(projValue(p))}
            </div>
          </div>
          <Link to="/app/projects/$id" params={{ id: p.id }} className="text-xs text-primary hover:underline">
            Acessar →
          </Link>
        </li>
      ))}
    </ul>
  );
}

function BigCard({
  label, gKey, count, total, tone = "neutral", hint, active, onClick,
}: {
  label: string;
  gKey: GroupKey;
  count: number;
  total: number;
  tone?: "neutral" | "success" | "danger" | "warn" | "info" | "muted";
  hint?: string;
  active: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "success" ? "text-success" :
    tone === "danger" ? "text-destructive" :
    tone === "warn" ? "text-amber-600 dark:text-amber-400" :
    tone === "info" ? "text-primary" :
    tone === "muted" ? "text-muted-foreground" :
    "";
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      data-key={gKey}
      className={`rounded-lg border bg-card p-4 text-left transition hover:border-primary/40 ${active ? "border-primary ring-1 ring-primary/40" : ""}`}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${toneClass}`}>{count}</div>
      <div className="mt-1 text-xs tabular-nums text-muted-foreground">{formatBRL(total)}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </button>
  );
}
