import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Trash2, FileDown, ChevronDown } from "lucide-react";
import { exportProjectExecutivePdf } from "@/lib/pdf-export";
import { AuditTimeline } from "@/components/project/AuditTimeline";
import { STATUS_LABEL, formatDateBR } from "@/lib/labels";
import { ProjectChat } from "@/components/project/ProjectChat";
import { BackButton } from "@/components/BackButton";
import { ProposalForm, type ProposalProject } from "@/components/project/ProposalForm";
import { FirmProjectForm, type FirmProject } from "@/components/project/FirmProjectForm";
import { ComparisonTable, ValidationDecision } from "@/components/project/ValidationPanel";
import { FpaPreAnaliseActions } from "@/components/project/Stage1Decisions";
import { STAGE1_EDITABLE, STAGE2_EDITABLE, STAGE2_STATUSES } from "@/lib/project-rules";
import { ExecutionTracking } from "@/components/execution/ExecutionTracking";
import { PendingInfoCard } from "@/components/project/PendingInfoCard";

export const Route = createFileRoute("/app/projects/$id")({
  head: () => ({ meta: [{ title: "Projeto · Hub de Investimentos" }, { name: "description", content: "Proposta, planejamento e validação do projeto." }] }),
  component: ProjectDetail,
});

type ProjectStatus = keyof typeof STATUS_LABEL;

function stage1LockedReason(status: string): string {
  if (status === "em_pre_analise_fpa") return "Proposta submetida e congelada. Ela só volta a ser editável se o FP&A devolver o projeto para ajuste.";
  if (status === "aguardando_diretoria_prev") return "Proposta submetida. Os dados indicativos estão congelados enquanto a decisão é registrada.";
  if (status === "nao_aprovado_pre") return "Projeto não aprovado na priorização. A proposta fica apenas para consulta.";
  return "Proposta indicativa congelada como linha de base na submissão.";
}
function stage2LockedReason(status: string): string {
  if (status === "em_validacao_execucao") return "Planejamento submetido. Ele está em validação para execução e só volta a ser editável se for devolvido.";
  if (status === "aprovado_final") return "Execução aprovada. O planejamento fica registrado para consulta.";
  return "Planejamento encerrado nesta situação e disponível apenas para consulta.";
}

function ProjectDetail() {
  const { id } = Route.useParams();
  const { profile, isRealFpa } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*, areas:areas!projects_area_id_fkey(name)").eq("id", id).single();
      if (error) throw error;
      const { data: owner } = await supabase.from("profiles").select("full_name, email, phone").eq("id", data.owner_id).maybeSingle();
      return { ...data, owner };
    },
  });

  const deleteProject = useMutation({
    mutationFn: async () => {
      await supabase.from("disbursements").delete().eq("project_id", id);
      await supabase.from("project_documents").delete().eq("project_id", id);
      await supabase.from("project_comments").delete().eq("project_id", id);
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto excluído");
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
      void navigate({ to: "/app/projects" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !project) return <div className="text-muted-foreground">Carregando…</div>;

  const p = project as any;
  const status = p.status as ProjectStatus;
  const isOwner = p.owner_id === profile?.id;
  const isExecutor = !!p.executor_area_id && p.executor_area_id !== p.area_id && p.executor_area_id === profile?.area_id;
  const canAct = isOwner || isRealFpa || isExecutor;
  const stage1Open = STAGE1_EDITABLE.includes(status);
  const inStage2 = STAGE2_STATUSES.includes(status);
  const stage2Open = STAGE2_EDITABLE.includes(status);
  const ownerEarlyDeletable = isOwner && ["no_hub", "rascunho"].includes(status);
  const canDelete = ownerEarlyDeletable || isRealFpa;

  const proposal: ProposalProject = {
    id: p.id, name: p.name, area_id: p.area_id, category: p.category, priority: p.priority,
    description: p.description, justification: p.justification,
    study_amount: p.study_amount, execution_amount: p.execution_amount,
    study_start_date: p.study_start_date, execution_start_date: p.execution_start_date, execution_months: p.execution_months, cost_center: p.cost_center,
    payback_months: p.payback_months, payback_not_applicable: !!p.payback_not_applicable, payback_na_justification: p.payback_na_justification,
    viability_summary: p.viability_summary, status,
    branch_id: p.branch_id, business_unit_id: p.business_unit_id, executor_area_id: p.executor_area_id, already_in_execution: !!p.already_in_execution,
  };
  const firm: FirmProject = {
    id: p.id, status, prioritization_result: p.prioritization_result,
    study_amount: p.study_amount, execution_amount: p.execution_amount,
    firm_study_amount: p.firm_study_amount, firm_execution_amount: p.firm_execution_amount,
    firm_study_start_date: p.firm_study_start_date, firm_execution_start_date: p.firm_execution_start_date,
    firm_execution_months: p.firm_execution_months, cost_center: p.cost_center, already_in_execution: !!p.already_in_execution, accounting_code: p.accounting_code, study_start_date: p.study_start_date,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <BackButton fallback="/app/projects" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {p.code && <span className="font-mono text-sm text-muted-foreground">{p.code}</span>}
            <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.areas?.name ?? "—"} · Gestor: {p.owner?.full_name ?? "—"}
            {p.owner?.phone && isRealFpa && <> · WhatsApp: {p.owner.phone}</>}
            {" "}· Submetido: {p.submitted_at ? formatDateBR(p.submitted_at) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            try { await exportProjectExecutivePdf(p.id); } catch (e: any) { toast.error(e?.message ?? "Falha ao gerar PDF"); }
          }}>
            <FileDown className="mr-1 h-4 w-4" /> PDF executivo
          </Button>
          {canDelete && (
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`) && deleteProject.mutate()} disabled={deleteProject.isPending}>
              <Trash2 className="mr-1 h-4 w-4" /> Excluir projeto
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Etapa 1 */}
          {stage1Open ? (
            <>
              <StageTitle n={1} title="Proposta indicativa" />
              {status === "devolvido_pre" && <ReturnNote text={p.last_deferral_reason} kind="pre" projectId={p.id} />}
              <ProposalForm key={p.updated_at} project={proposal} canEdit={canAct} lockedReason={canAct ? undefined : "Somente o gestor responsável ou o FP&A editam esta proposta."} />
            </>
          ) : (
            <Collapsible title="Etapa 1 · Proposta indicativa" subtitle={inStage2 ? "Concluída" : "Submetida"} defaultOpen={!inStage2}>
              <ProposalForm key={p.updated_at} project={proposal} canEdit={false} lockedReason={stage1LockedReason(status)} />
            </Collapsible>
          )}

          {(status === "em_pre_analise_fpa" || status === "aguardando_diretoria_prev") && (
            isRealFpa
              ? <ActionCard title="Análise do FP&A"><FpaPreAnaliseActions projectId={p.id} /></ActionCard>
              : <InfoCard text="Projeto submetido. Você será notificado da decisão do FP&A." />
          )}
          {status === "nao_aprovado_pre" && <InfoCard tone="danger" text={`Projeto rejeitado.${p.prioritization_justification ? ` ${p.prioritization_justification}` : ""}`} />}

          {/* Etapa 2 */}
          {inStage2 && (
            stage2Open ? (
              <>
                <StageTitle n={2} title="Planejamento" />
                {status === "devolvido_orc" && <ReturnNote text={p.validation_justification} kind="orc" projectId={p.id} />}
                <FirmProjectForm key={p.updated_at} project={firm} canEdit={canAct} canEditAccounting={isRealFpa} />
              </>
            ) : (
              <Collapsible title="Etapa 2 · Planejamento" subtitle={status === "em_validacao_execucao" ? "Submetido" : "Concluída"} defaultOpen={false}>
                <FirmProjectForm key={p.updated_at} project={firm} canEdit={false} canEditAccounting={isRealFpa} lockedReason={stage2LockedReason(status)} />
              </Collapsible>
            )
          )}

          {/* Validação para execução */}
          {["em_validacao_execucao", "aprovado_final", "reprovado_final", "estudo_concluido"].includes(status) && (
            <section className="space-y-4 rounded-lg border bg-card p-5">
              <h2 className="text-base font-semibold">Validação para execução · indicativo x planejado</h2>
              <ComparisonTable project={firm as any} />
              {status === "em_validacao_execucao" && (isRealFpa
                ? <ValidationDecision project={firm as any} />
                : <p className="text-sm text-muted-foreground">O FP&A está confrontando o orçamento planejado com o indicativo e levará a decisão à diretoria.</p>)}
            </section>
          )}
          {(status === "aprovado_final" || status === "em_execucao") && (
            <>
              <StageTitle n={3} title="Acompanhamento da execução" />
              <ExecutionTracking project={p} isOwner={isOwner} isFpa={isRealFpa} />
            </>
          )}
          {status === "reprovado_final" && <InfoCard tone="danger" text={`Execução não aprovada.${p.validation_justification ? ` ${p.validation_justification}` : ""}`} />}
          {status === "estudo_concluido" && <InfoCard text="Planejamento registrado como concluído. A execução não foi aprovada neste ciclo." />}
        </div>

        <aside>
          <div className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
            <Collapsible title="Chat do projeto" subtitle="Gestor e Admin" defaultOpen>
              <ProjectChat projectId={p.id} />
            </Collapsible>
            <Collapsible title="Histórico do projeto" defaultOpen={false}>
              <AuditTimeline projectId={p.id} />
            </Collapsible>
            <Collapsible title="Informações pendentes" defaultOpen={STAGE1_EDITABLE.includes(status) || stage2Open}>
              <PendingInfoCard projectId={p.id} data={p as never} stage={stage2Open ? 2 : 1} />
            </Collapsible>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StageTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>
      <h2 className="text-lg font-semibold tracking-tight">Etapa {n} · {title}</h2>
    </div>
  );
}

function Collapsible({ title, subtitle, defaultOpen, children }: { title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
        <span>{title}{subtitle && <span className="ml-2 text-xs font-normal text-muted-foreground">{subtitle}</span>}</span>
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
  );
}

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border-2 border-primary/30 bg-card p-5">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function InfoCard({ text, tone }: { text: string; tone?: "success" | "danger" }) {
  const cls = tone === "success" ? "border-success/40 bg-success/10" : tone === "danger" ? "border-destructive/40 bg-destructive/10" : "bg-muted/40";
  return <div className={`rounded-lg border p-4 text-sm ${cls}`}>{text}</div>;
}

function ReturnNote({ text, kind, projectId }: { text?: string | null; kind: "pre" | "orc"; projectId: string }) {
  const { data: last } = useQuery({
    queryKey: ["return-note", projectId, kind],
    queryFn: async () => {
      const { data } = await supabase.from("project_status_history").select("comment")
        .eq("project_id", projectId).eq("to_status", kind === "pre" ? "devolvido_pre" : "devolvido_orc")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data?.comment ?? null;
    },
  });
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
      <div className="font-medium">O FP&A devolveu o projeto para ajuste</div>
      <p className="mt-1 whitespace-pre-wrap">{last ?? text ?? "Veja a conversa do projeto."}</p>
      <p className="mt-2 text-xs text-muted-foreground">Toda alteração feita agora fica registrada no histórico.</p>
    </div>
  );
}
