import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Save, Send } from "lucide-react";
import { formatBRL, formatDateBR, parseBRL } from "@/lib/labels";
import { Stage2Schedule } from "@/components/project/Stage2Schedule";
import { DocumentsPanel } from "@/components/project/DocumentsPanel";
import { Section, useDocKeys, useRequiredDocs, useSchedule } from "@/components/project/ProposalForm";
import { executionEnd, scrollToAnchor, stage2Pending, type Pending, type ScheduleRow } from "@/lib/project-rules";

export type FirmProject = {
  id: string; status: string; prioritization_result: string | null;
  study_amount: number | null; execution_amount: number | null;
  firm_study_amount: number | null; firm_execution_amount: number | null;
  firm_study_start_date: string | null; firm_execution_start_date: string | null; firm_execution_months: number | null;
  cost_center: string | null; already_in_execution?: boolean; accounting_code: string | null; study_start_date?: string | null;
};

const money = (n: number | null | undefined) =>
  n == null ? "" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FirmProjectForm({
  project, canEdit, canEditAccounting, lockedReason,
}: { project: FirmProject; canEdit: boolean; canEditAccounting: boolean; lockedReason?: string }) {
  const qc = useQueryClient();
  const studyText = money(project.study_amount);
  const [execText, setExecText] = useState(money(project.firm_execution_amount));
  const studyStart = project.study_start_date ?? "";
  const [execStart, setExecStart] = useState(project.firm_execution_start_date ?? "");
  const [monthsText, setMonthsText] = useState(project.firm_execution_months ? String(project.firm_execution_months) : "");
  const [pending, setPending] = useState<Pending[] | null>(null);
  const ccLocked = !!project.already_in_execution && /^\d{6}$/.test(project.cost_center ?? "");
  const [costCenter, setCostCenter] = useState(project.cost_center ?? "");

  const { data: saved = [] } = useSchedule(project.id, "firme");
  const { data: indicative = [] } = useSchedule(project.id, "indicativo");
  const [schedule, setSchedule] = useState<ScheduleRow[] | null>(null);
  const rows = schedule ?? saved;
  const { data: savedReal = [] } = useQuery({
    queryKey: ["schedule", project.id, "realizado"],
    queryFn: async (): Promise<ScheduleRow[]> => {
      const { data, error } = await supabase.from("disbursements").select("period, phase, amount").eq("project_id", project.id).eq("version", "realizado").order("period");
      if (error) throw error;
      return (data ?? []).map((r) => ({ period: r.period, phase: r.phase as ScheduleRow["phase"], amount: Number(r.amount) }));
    },
  });
  const [realized, setRealized] = useState<ScheduleRow[] | null>(null);
  const { data: docKeys = new Set<string>() } = useDocKeys(project.id);
  const { data: reqDocs = [] } = useRequiredDocs(2);

  const study = studyText.trim() ? parseBRL(studyText) : null;
  const exec = execText.trim() ? parseBRL(execText) : null;
  const months = monthsText ? Number(monthsText) : null;
  const end = executionEnd(execStart, months);
  const data = {
    firm_study_amount: study, firm_execution_amount: exec, firm_study_start_date: studyStart || null,
    firm_execution_start_date: execStart || null, firm_execution_months: months,
    study_start_date: studyStart || null,
    cost_center: costCenter || null,
  };
  const firmRows = schedule ?? (saved.length ? [...indicative.filter((r) => r.phase === "planejamento"), ...saved.filter((r) => r.phase === "execucao")] : saved);
  const livePending = stage2Pending(data, firmRows, docKeys, reqDocs);

  const save = useMutation({
    mutationFn: async () => {
      if (canEdit) {
        const { study_start_date: _s, ...upd } = data as Record<string, unknown>;
        if (ccLocked) delete upd.cost_center;
        const { error } = await supabase.from("projects").update(upd as never).eq("id", project.id);
        if (error) throw error;
      }
      if (canEditAccounting && realized) {
        const { error: d } = await supabase.from("disbursements").delete().eq("project_id", project.id).eq("version", "realizado");
        if (d) throw d;
        if (realized.length) {
          const { error: i } = await supabase.from("disbursements").insert(
            realized.map((r) => ({ project_id: project.id, version: "realizado", phase: r.phase, period: r.period, amount: r.amount })) as never,
          );
          if (i) throw i;
        }
      }
      if (canEdit && schedule) {
        const { error: d } = await supabase.from("disbursements").delete().eq("project_id", project.id).eq("version", "firme");
        if (d) throw d;
        if (schedule.length) {
          const { error: i } = await supabase.from("disbursements").insert(
            schedule.map((r) => ({ project_id: project.id, version: "firme", phase: r.phase, period: r.period, amount: r.amount })) as never,
          );
          if (i) throw i;
        }
      }
    },
    onSuccess: () => {
      setSchedule(null); setRealized(null);
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["schedule", project.id] });
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      const list = stage2Pending(data, firmRows, docKeys, reqDocs);
      setPending(list);
      if (list.length) throw new Error("__pending");
      const { error } = await supabase.rpc("submeter_projeto_firme", { p_project_id: project.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Planejamento submetido para validação de execução.");
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["audit-timeline", project.id] });
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
    },
    onError: (e: Error) => { if (e.message !== "__pending") toast.error(e.message); },
  });

  const ro = !canEdit;
  const onlyStudy = project.prioritization_result === "estudo";

  return (
    <form noValidate className="space-y-6" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined, { onSuccess: () => toast.success("Alterações salvas"), onError: (e) => toast.error(e.message) }); }}>
      {canEdit && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm">
          <div className="font-medium">{onlyStudy ? "Verba de planejamento aprovada" : "Projeto pré-aprovado"}</div>
          <p className="mt-1">
            {onlyStudy
              ? "A diretoria quer o projeto desenvolvido e pronto, mas não liberou a execução neste ciclo. A verba de planejamento está liberada."
              : "A verba de planejamento está liberada."}{" "}
            Agora apresente escopo técnico, cotações de fornecedores, orçamento planejado, análise de risco e análise de impacto e retorno, além dos valores, datas e cronograma planejados da execução.
          </p>
        </div>
      )}
      {ro && lockedReason && <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{lockedReason}</div>}

      <fieldset disabled={ro} className="space-y-6">
        <Section title="Valores e prazos planejados" hint="Orçamento planejado da execução, comparado à proposta indicativa.">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="g-study_amount">Verba de planejamento</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm tabular-nums">{studyText ? `R$ ${studyText}` : "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">Congelada conforme a Etapa 1.</p>
            </div>
            <div>
              <Label htmlFor="g-execution_amount">Verba de execução</Label>
              <MoneyInput id="g-execution_amount" value={execText} onChange={setExecText} />
              <p className="mt-1 text-xs text-muted-foreground">Indicativo: {formatBRL(project.execution_amount)}</p>
            </div>
            <div>
              <Label>Valor total</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium tabular-nums">{formatBRL((study ?? 0) + (exec ?? 0))}</div>
            </div>
            <div>
              <Label htmlFor="g-study_start_date">Início do planejamento</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">{studyStart ? formatDateBR(studyStart) : "—"}</div>
              <p className="mt-1 text-xs text-muted-foreground">Congelado conforme a Etapa 1.</p>
            </div>
            <div>
              <Label htmlFor="g-execution_start_date">Início da execução</Label>
              <Input id="g-execution_start_date" type="date" value={execStart} onChange={(e) => setExecStart(e.target.value)} />
              {studyStart && execStart && execStart <= studyStart && <p className="mt-1 text-xs text-destructive">O início da execução deve ser posterior ao início do planejamento.</p>}
            </div>
            <div>
              <Label htmlFor="g-execution_months">Prazo de execução (meses)</Label>
              <Input id="g-execution_months" inputMode="numeric" value={monthsText} onChange={(e) => setMonthsText(e.target.value.replace(/\D/g, ""))} />
              <p className="mt-1 text-xs text-muted-foreground">Somente a execução.{end && ` Fim previsto: ${formatDateBR(end)}.`}</p>
            </div>
          </div>
        </Section>

        <Section title="Centro de custo" hint={ccLocked ? "Informado na Etapa 1 (projeto já em execução)." : "Obrigatório para seguir para a validação."}>
          <div className="max-w-sm">
            <Label htmlFor="g-cost_center">Centro de custo {!ccLocked && <span className="text-destructive">*</span>}</Label>
            {ccLocked
              ? <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm tabular-nums">{project.cost_center}</div>
              : <Input id="g-cost_center" value={costCenter} inputMode="numeric" maxLength={6} onChange={(e) => setCostCenter(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 dígitos numéricos" />}
          </div>
        </Section>
      </fieldset>

      <Section title="Cronograma financeiro" id="g-schedule" hint="Indicativo congelado da Etapa 1, realizado lançado pela Administração e planejado da execução.">
        <Stage2Schedule studyStart={studyStart} execStart={execStart} execMonths={months} indicative={indicative} firm={firmRows} realized={realized ?? savedReal}
          onFirmChange={setSchedule} onRealizedChange={setRealized} canEditFirm={canEdit} canEditRealized={canEditAccounting} execTarget={exec ?? 0} />
      </Section>

      <Section title="Documentos anexos" id="g-attachments" hint="Documentos em vermelho são obrigatórios; em amarelo, opcionais.">
        <DocumentsPanel projectId={project.id} canEdit={canEdit} stage={2} title="Documentos solicitados" lockedReason={lockedReason} />
      </Section>

      {(canEdit || canEditAccounting) && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          {pending && pending.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Para submeter, falta:</div>
              <ul className="mt-2 space-y-1">
                {pending.map((p, i) => (
                  <li key={i}><button type="button" className="text-left text-primary hover:underline" onClick={() => scrollToAnchor(p.anchor)}>{p.label}</button></li>
                ))}
              </ul>
            </div>
          )}
          {canEdit && (
            <div className="flex items-center gap-2 text-sm">
              {livePending.length === 0
                ? <><CheckCircle2 className="h-4 w-4 text-success" /> Pronto para submeter</>
                : <><AlertTriangle className="h-4 w-4" /> Pendente</>}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit" variant="outline" disabled={save.isPending}><Save className="mr-1 h-4 w-4" /> Salvar alterações</Button>
            {canEdit && (
              <Button type="button" onClick={() => submit.mutate()} disabled={submit.isPending}>
                <Send className="mr-1 h-4 w-4" /> {submit.isPending ? "Submetendo…" : "Submeter para validação de execução"}
              </Button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
