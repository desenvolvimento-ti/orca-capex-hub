import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyInput } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { projectDocPath } from "@/lib/storage";
import { AlertTriangle, CheckCircle2, Paperclip, Save, X } from "lucide-react";
import { ACTIVE_CATEGORIES, CATEGORY_LABEL, PRIORITY_LABEL, formatBRL, formatDateBR, parseBRL } from "@/lib/labels";
import { ScheduleEditor, scheduleMonths } from "@/components/project/ScheduleEditor";
import { DocumentsPanel } from "@/components/project/DocumentsPanel";
import {
  executionEnd, isPast, scrollToAnchor, stage1Pending, type Pending, type ScheduleRow,
} from "@/lib/project-rules";

const CATEGORIES = ACTIVE_CATEGORIES;
const PRIORITIES = Object.keys(PRIORITY_LABEL) as Array<keyof typeof PRIORITY_LABEL>;

export type ProposalProject = {
  id: string; name: string; area_id: string; category: string; priority: string;
  description: string | null; justification: string | null;
  study_amount: number | null; execution_amount: number | null;
  study_start_date: string | null; execution_start_date: string | null; execution_months: number | null;
  payback_months: number | null; payback_not_applicable: boolean; payback_na_justification: string | null;
  viability_summary: string | null; status: string; cost_center?: string | null; indicativo_zero_months?: string[] | null;
  branch_id?: string | null; business_unit_id?: string | null; executor_area_id?: string | null; already_in_execution?: boolean;
};

const money = (n: number | null | undefined) =>
  n == null ? "" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function useDocKeys(projectId?: string) {
  return useQuery({
    queryKey: ["doc-keys", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_documents").select("doc_type_id, required_document_types(key)").eq("project_id", projectId!);
      if (error) throw error;
      return new Set((data ?? []).map((d: any) => d.required_document_types?.key).filter(Boolean) as string[]);
    },
  });
}

export function useRequiredDocs(stage: 1 | 2) {
  return useQuery({
    queryKey: ["required-docs", stage],
    queryFn: async () => {
      const { data, error } = await supabase.from("required_document_types")
        .select("key, label, uploader_role").eq("active", true).eq("is_required", true).eq("required_for_stage", stage).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSchedule(projectId: string | undefined, version: "indicativo" | "firme") {
  return useQuery({
    queryKey: ["schedule", projectId, version],
    enabled: !!projectId,
    queryFn: async (): Promise<ScheduleRow[]> => {
      const { data, error } = await supabase.from("disbursements")
        .select("period, phase, amount").eq("project_id", projectId!).eq("version", version).order("period");
      if (error) throw error;
      return (data ?? []).map((r) => ({ period: r.period, phase: r.phase, amount: Number(r.amount) }));
    },
  });
}

export function ProposalForm({
  project, canEdit, lockedReason,
}: { project?: ProposalProject; canEdit: boolean; lockedReason?: string }) {
  const { profile, isRealFpa } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isNew = !project;

  const [name, setName] = useState(project?.name ?? "");
  const [category, setCategory] = useState(project?.category ?? "");
  const [priority, setPriority] = useState(project?.priority ?? "media");
  const [description, setDescription] = useState(project?.description ?? "");
  const [justification, setJustification] = useState(project?.justification ?? "");
  const [studyText, setStudyText] = useState(money(project?.study_amount));
  const [execText, setExecText] = useState(money(project?.execution_amount));
  const [studyStart, setStudyStart] = useState(project?.study_start_date ?? "");
  const [execStart, setExecStart] = useState(project?.execution_start_date ?? "");
  const [monthsText, setMonthsText] = useState(project?.execution_months ? String(project.execution_months) : "");
  const [paybackNA, setPaybackNA] = useState(!!project?.payback_not_applicable);
  const [paybackNAJust, setPaybackNAJust] = useState(project?.payback_na_justification ?? "");
  const [paybackText, setPaybackText] = useState(project?.payback_months ? String(project.payback_months) : "");
  const [premissas, setPremissas] = useState(project?.viability_summary ?? "");
  const [costCenter, setCostCenter] = useState(project?.cost_center ?? "");
  const [branchId, setBranchId] = useState(project?.branch_id ?? "");
  const [unitId, setUnitId] = useState(project?.business_unit_id ?? "");
  const [executorId, setExecutorId] = useState(project?.executor_area_id ?? "");
  const [inExecution, setInExecution] = useState(!!project?.already_in_execution);
  const [zeroMonths, setZeroMonths] = useState<string[]>(project?.indicativo_zero_months ?? []);
  const [staged, setStaged] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending[] | null>(null);

  const { data: savedSchedule = [] } = useSchedule(project?.id, "indicativo");
  const [schedule, setSchedule] = useState<ScheduleRow[] | null>(null);
  const rows = schedule ?? savedSchedule;
  const { data: docKeys = new Set<string>() } = useDocKeys(project?.id);
  const { data: reqDocs = [] } = useRequiredDocs(1);
  const { data: reqDocsAll = [] } = useQuery({
    queryKey: ["stage1-doc-types-all"],
    enabled: isNew,
    queryFn: async () => (await supabase.from("required_document_types").select("id, label, is_required").eq("active", true).eq("required_for_stage", 1).order("sort_order")).data ?? [],
  });
  const needsAreaPick = isNew && isRealFpa && !profile?.area_id;
  const [adminArea, setAdminArea] = useState("");
  const { data: areaList = [] } = useQuery({
    queryKey: ["areas-for-admin-project"],
    enabled: needsAreaPick,
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });



  const { data: branches = [] } = useQuery({
    queryKey: ["branches-active"],
    queryFn: async () => (await supabase.from("branches").select("id, name").eq("is_active", true).order("name")).data ?? [],
  });
  const { data: units = [] } = useQuery({
    queryKey: ["units-active"],
    queryFn: async () => (await supabase.from("business_units").select("id, name, branch_id").eq("is_active", true).order("name")).data ?? [],
  });
  const { data: allAreas = [] } = useQuery({
    queryKey: ["areas-executor-options"],
    queryFn: async () => (await supabase.from("areas").select("id, name, can_execute_for_others, status").order("name")).data ?? [],
  });
  const ownArea = project?.area_id ?? profile?.area_id ?? (adminArea || null);
  const executorOptions = allAreas.filter((a) => a.id === ownArea || (a.can_execute_for_others && a.status === "aprovada"));
  const delegated = !!executorId && executorId !== ownArea;
  const amExecutor = delegated && profile?.area_id === executorId && !isRealFpa;
  // Solicitante não edita campos da executora quando delegado; executora só edita os seus.
  const lockExecFields = delegated && !amExecutor && !isRealFpa;
  const lockReqFields = amExecutor;

  const study = studyText.trim() ? parseBRL(studyText) : null;
  const exec = execText.trim() ? parseBRL(execText) : null;
  const months = monthsText ? Number(monthsText) : null;
  const end = executionEnd(execStart, months);
  const payback = paybackText ? Number(paybackText) : null;

  const data = useMemo(() => ({
    name, description, justification, study_amount: study, execution_amount: exec,
    study_start_date: studyStart || null, execution_start_date: execStart || null, execution_months: months,
    payback_not_applicable: paybackNA, payback_na_justification: paybackNAJust, payback_months: payback, viability_summary: premissas, cost_center: costCenter,
    branch_id: branchId || null, business_unit_id: unitId || null, executor_area_id: executorId || null, already_in_execution: inExecution, area_id: ownArea, indicativo_zero_months: zeroMonths,
  }), [zeroMonths, branchId, unitId, executorId, inExecution, ownArea, costCenter, name, description, justification, study, exec, studyStart, execStart, months, paybackNA, paybackNAJust, payback, premissas]);

  const livePending = stage1Pending(data, rows, docKeys, reqDocs);

  const save = useMutation({
    mutationFn: async (): Promise<string> => {
      const errs: Record<string, string> = {};
      if (!name.trim()) errs["f-name"] = "Informe o nome do projeto.";
      if (!category) errs["f-category"] = "Selecione a categoria.";
      const area = project?.area_id ?? profile?.area_id ?? (adminArea || null);
      if (!area) {
        if (isRealFpa) errs["f-area"] = "Selecione a área do projeto.";
        else errs["f-name"] = "Sua conta não está vinculada a uma área. Peça à Administração para definir sua área.";
      }
      if (inExecution && costCenter && !/^\d{6}$/.test(costCenter)) errs["f-cost_center"] = "O centro de custo deve ter exatamente 6 dígitos.";
      if (studyStart && execStart && execStart <= studyStart) errs["f-execution_start_date"] = "O início da execução deve ser posterior ao início do estudo.";
      setErrors(errs);
      const first = Object.keys(errs)[0];
      if (first) { scrollToAnchor(first); throw new Error(errs[first]); }
      if (!profile) throw new Error("Sessão expirada.");

      const payload: Record<string, unknown> = {
        name: name.trim(), category, priority, area_id: area,
        description: description.trim(), justification: justification.trim(),
        study_amount: study, execution_amount: exec,
        study_start_date: studyStart || null, execution_start_date: execStart || null, execution_months: months,
        payback_not_applicable: paybackNA, payback_na_justification: paybackNAJust.trim() || null,
        payback_months: paybackNA ? null : payback, viability_summary: premissas.trim() || null,
        cost_center: inExecution ? (costCenter.trim() || null) : (project?.cost_center ?? null),
        branch_id: branchId || null, business_unit_id: unitId || null,
        executor_area_id: executorId || area, already_in_execution: inExecution,
        indicativo_zero_months: zeroMonths,
      };
      if (amExecutor) {
        for (const k of ["name", "category", "priority", "area_id", "description", "justification", "branch_id", "business_unit_id", "executor_area_id", "already_in_execution"]) delete payload[k];
      } else if (lockExecFields) {
        for (const k of ["study_amount", "execution_amount", "study_start_date", "execution_start_date", "execution_months", "cost_center", "indicativo_zero_months"]) delete payload[k];
      }
      let id = project?.id;
      if (!id) {
        const { data: ins, error } = await supabase.from("projects").insert({
          ...payload, owner_id: profile.id, status: "no_hub", created_by_fpa: isRealFpa, cycle_id: null,
        } as never).select("id").single();
        if (error) throw error;
        id = ins.id;
      } else {
        const { error } = await supabase.from("projects").update(payload as never).eq("id", id);
        if (error) throw error;
      }
      if (schedule && !lockExecFields) {
        const { error: dErr } = await supabase.from("disbursements").delete().eq("project_id", id).eq("version", "indicativo");
        if (dErr) throw dErr;
        if (schedule.length) {
          const { error: iErr } = await supabase.from("disbursements").insert(
            schedule.map((r) => ({ project_id: id!, version: "indicativo", phase: r.phase, period: r.period, amount: r.amount })) as never,
          );
          if (iErr) throw iErr;
        }
      }
      const files = Object.entries(staged);
      if (isNew && files.length) {
        const failed: string[] = [];
        for (const [typeId, file] of files) {
          const path = projectDocPath(profile.id, id!, file);
          const { error: upErr } = await supabase.storage.from("project-docs").upload(path, file);
          const { error: dbErr } = upErr ? { error: upErr } : await supabase.from("project_documents").insert({
            project_id: id!, file_name: file.name, file_path: path, uploaded_by: profile.id, doc_type_id: typeId,
          });
          if (dbErr) failed.push(file.name);
        }
        if (failed.length) toast.error(`Projeto salvo, mas não foi possível anexar: ${failed.join(", ")}. Anexe novamente pelo projeto.`);
      }
      return id!;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["schedule", id] });
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
      qc.invalidateQueries({ queryKey: ["history", id] });
      setSchedule(null);
      if (isNew) {
        toast.success("Projeto salvo. Complete as informações quando quiser e depois submeta.");
        navigate({ to: "/app" });
      }
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const id = await save.mutateAsync();
      const list = stage1Pending(data, rows, docKeys, reqDocs);
      setPending(list);
      if (list.length) throw new Error("__pending");
      if (amExecutor) throw new Error("A submissão é feita pela área solicitante.");
      const { error } = await supabase.rpc("submeter_projeto", { p_project_id: id });
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      toast.success("Projeto submetido. Ele segue para a pré-análise do FP&A.");
      setPending(null);
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
      qc.invalidateQueries({ queryKey: ["history", id] });
      qc.invalidateQueries({ queryKey: ["audit-timeline", id] });
    },
    onError: (e: Error) => { if (e.message !== "__pending") toast.error(e.message); },
  });

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>;
  const ro = !canEdit;

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(undefined, { onSuccess: () => !isNew && toast.success("Alterações salvas"), onError: (e) => toast.error(e.message) }); }} className="space-y-6">
      {ro && lockedReason && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{lockedReason}</div>
      )}
      {delegated && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          {amExecutor
            ? "Sua área é a executora deste projeto: preencha verbas, datas e cronograma. Os demais campos são da área solicitante."
            : "Projeto delegado a outra área executora: verbas, datas e cronograma são preenchidos por ela."}
        </div>
      )}
      <fieldset disabled={ro} className="space-y-6">
        <fieldset disabled={lockReqFields} className="space-y-6">
        <Section title="Informações gerais">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="f-name">Nome do projeto <Req /></Label>
              <Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reforma do parque aquático infantil" />
              {err("f-name")}
            </div>
            <div id="f-category" className="md:col-span-2">
              <Label>Categoria <Req /></Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
              {err("f-category")}
            </div>
            {needsAreaPick && (
              <div id="f-area" className="md:col-span-2">
                <Label>Área do projeto <Req /></Label>
                <Select value={adminArea} onValueChange={setAdminArea}>
                  <SelectTrigger><SelectValue placeholder="Selecione a área…" /></SelectTrigger>
                  <SelectContent>{areaList.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Sua conta de administrador não tem área vinculada — escolha a área a que o projeto pertence.</p>
                {err("f-area")}
              </div>
            )}
            <div className="md:col-span-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="f-description">Descrição do projeto</Label>
              <Textarea id="f-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Escopo, entregáveis e premissas do projeto." />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="f-justification">Justificativa para execução</Label>
              <Textarea id="f-justification" rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Por que este projeto é necessário? Qual o impacto esperado?" />
            </div>
          </div>
        </Section>

        <Section title="Estrutura e execução">
          <div className="grid gap-4 md:grid-cols-3">
            <div id="f-branch_id">
              <Label>Filial <Req /></Label>
              <Select value={branchId} onValueChange={(v) => { setBranchId(v); setUnitId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div id="f-business_unit_id">
              <Label>Unidade de negócio <Req /></Label>
              <Select value={unitId} onValueChange={setUnitId} disabled={!branchId}>
                <SelectTrigger><SelectValue placeholder={branchId ? "Selecione…" : "Escolha a filial antes"} /></SelectTrigger>
                <SelectContent>{units.filter((u) => u.branch_id === branchId).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div id="f-executor_area_id">
              <Label>Área executora <Req /></Label>
              <Select value={executorId} onValueChange={setExecutorId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{executorOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.id === ownArea ? " (própria área)" : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <Checkbox checked={inExecution} onCheckedChange={(v) => setInExecution(!!v)} />
            Projeto já está em execução?
          </label>
          {inExecution && (
            <div className="mt-3 max-w-sm">
              <Label htmlFor="f-cost_center">Centro de custo <Req /></Label>
              <Input id="f-cost_center" value={costCenter} inputMode="numeric" maxLength={6} disabled={lockExecFields} onChange={(e) => setCostCenter(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 dígitos numéricos" />
              <p className="mt-1 text-xs text-muted-foreground">Obrigatório para projetos que já estão em execução.</p>
              {err("f-cost_center")}
            </div>
          )}
        </Section>
        </fieldset>

        <fieldset disabled={lockExecFields} className="space-y-6">
        <Section title="Estimativa de investimento" hint="Valores e datas indicativos, separados entre a fase de planejamento e a fase de execução.">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="f-study_amount">Verba de planejamento</Label>
              <MoneyInput id="f-study_amount" value={studyText} onChange={setStudyText} />
              <p className="mt-1 text-xs text-muted-foreground">Custo de desenvolver o projeto: engenharia, estudos, consultorias. Use 0 se não houver.</p>
            </div>
            <div>
              <Label htmlFor="f-execution_amount">Verba de execução</Label>
              <MoneyInput id="f-execution_amount" value={execText} onChange={setExecText} />
            </div>
            <div>
              <Label>Valor total</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium tabular-nums">{formatBRL((study ?? 0) + (exec ?? 0))}</div>
              <p className="mt-1 text-xs text-muted-foreground">Soma de estudo e execução.</p>
            </div>
            <div>
              <Label htmlFor="f-study_start_date">Início do planejamento</Label>
              <Input id="f-study_start_date" type="date" value={studyStart} onChange={(e) => setStudyStart(e.target.value)} />
              {isPast(studyStart) && <PastWarn />}
            </div>
            <div>
              <Label htmlFor="f-execution_start_date">Início da execução</Label>
              <Input id="f-execution_start_date" type="date" value={execStart} onChange={(e) => setExecStart(e.target.value)} />
              {studyStart && execStart && execStart <= studyStart && <p className="mt-1 text-xs text-destructive">O início da execução deve ser posterior ao início do estudo.</p>}
              {isPast(execStart) && <PastWarn />}
            </div>
            <div>
              <Label htmlFor="f-execution_months">Prazo de execução (meses)</Label>
              <Input id="f-execution_months" inputMode="numeric" value={monthsText} onChange={(e) => setMonthsText(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 6" />
              <p className="mt-1 text-xs text-muted-foreground">Somente a duração da execução. O período de estudo é o intervalo entre as duas datas.</p>
              {end && <p className="text-xs text-muted-foreground">Fim previsto da execução: {formatDateBR(end)}</p>}
            </div>
          </div>
        </Section>


        <Section title="Cronograma financeiro" hint="Desembolso mensal estimado. A soma dos meses de planejamento deve bater com a verba de planejamento, e a dos meses de execução com a verba de execução." id="f-schedule">
          <ScheduleEditor studyStart={studyStart} execStart={execStart} execMonths={months} value={rows} onChange={setSchedule} readOnly={ro || lockExecFields} studyTarget={study ?? 0} execTarget={exec ?? 0} zeroMonths={zeroMonths} onZeroMonthsChange={setZeroMonths} />
          {err("f-schedule")}
        </Section>
        </fieldset>

        <Section title="Viabilidade e retorno">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={paybackNA} onCheckedChange={(v) => setPaybackNA(!!v)} />
              Não se aplica (projeto sem retorno financeiro direto, como manutenção extraordinária ou adequação obrigatória de segurança ou legal)
            </label>
            {paybackNA ? (
              <div>
                <Label htmlFor="f-payback_na">Justificativa</Label>
                <Textarea id="f-payback_na" rows={3} value={paybackNAJust} onChange={(e) => setPaybackNAJust(e.target.value)} placeholder="Explique por que o projeto não tem retorno financeiro direto." />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="f-payback_months">Payback estimado (meses)</Label>
                  <Textarea id="f-payback_months" className="h-20 min-h-20 resize-none" inputMode="numeric" value={paybackText} onChange={(e) => setPaybackText(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 18" />
                </div>
                <div>
                  <Label htmlFor="f-viability_summary">Premissas</Label>
                  <Textarea id="f-viability_summary" className="h-20 min-h-20" value={premissas} onChange={(e) => setPremissas(e.target.value)} placeholder="Ganhos esperados, premissas de receita ou economia, riscos." />
                </div>
              </div>
            )}
          </div>
        </Section>
      </fieldset>

      <Section title="Documentos anexos" id="f-attachments" hint="Documentos em vermelho são obrigatórios; em amarelo, opcionais.">
        {project ? (
          <DocumentsPanel projectId={project.id} canEdit={canEdit} stage={1} title="Documentos solicitados" lockedReason={lockedReason} />
        ) : (
          <StagedDocs docs={reqDocsAll} value={staged} onChange={setStaged} disabled={!canEdit} />
        )}
      </Section>

      {canEdit && (
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
          {!isNew && (
            <div className="flex items-center gap-2 text-sm">
              {livePending.length === 0
                ? <><CheckCircle2 className="h-4 w-4 text-success" /> Pronto para submeter</>
                : <><AlertTriangle className="h-4 w-4 text-warning-foreground" /> Pendente</>}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit" variant={isNew ? "default" : "outline"} disabled={save.isPending || submit.isPending}>
              <Save className="mr-1 h-4 w-4" /> {save.isPending && !submit.isPending ? "Salvando…" : isNew ? "Salvar projeto" : "Salvar alterações"}
            </Button>
          </div>
          <p className="text-right text-xs text-muted-foreground">{isNew ? "Para salvar basta nome e categoria." : ""} A submissão é feita pelo botão "Submeter" no seu painel de projetos.</p>
        </div>
      )}
    </form>
  );
}

function Req() { return <span className="text-destructive">*</span>; }
function PastWarn() { return <p className="mt-1 text-xs text-destructive">Data no passado. Confirme se o projeto já está em curso.</p>; }

export function Section({ title, hint, children, id }: { title: string; hint?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-lg border bg-card p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function StagedDocs({ docs, value, onChange, disabled }: {
  docs: { id: string; label: string; is_required: boolean }[];
  value: Record<string, File>; onChange: (v: Record<string, File>) => void; disabled?: boolean;
}) {
  if (docs.length === 0) return <p className="text-sm text-muted-foreground">Nenhum documento solicitado nesta etapa.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Os arquivos escolhidos são enviados quando você clicar em "Salvar projeto".</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {docs.map((d) => {
          const f = value[d.id];
          return (
            <div key={d.id} className={`flex items-start gap-3 rounded-md border p-3 ${f ? "border-success/40 bg-success/5" : d.is_required ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"}`}>
              <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{d.label}</div>
                {f ? (
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="truncate">{f.name}</span>
                    {!disabled && <button type="button" aria-label="Remover arquivo" onClick={() => { const n = { ...value }; delete n[d.id]; onChange(n); }}><X className="h-3 w-3" /></button>}
                  </div>
                ) : (
                  <label className={`mt-1 inline-block text-xs text-primary ${disabled ? "" : "cursor-pointer hover:underline"}`}>
                    Escolher arquivo
                    <input type="file" className="hidden" disabled={disabled} onChange={(e) => { const file = e.target.files?.[0]; if (file) onChange({ ...value, [d.id]: file }); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
