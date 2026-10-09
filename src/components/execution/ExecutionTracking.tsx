import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { formatBRL, parseBRL } from "@/lib/labels";
import { loadCurves } from "@/lib/execution";
import { CurveChart, CurveTable } from "./CurveChart";

const fmtM = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;

export function ExecutionTracking({ project, isOwner, isFpa }: { project: any; isOwner: boolean; isFpa: boolean }) {
  const id = project.id as string;
  const qc = useQueryClient();
  const refresh = () => {
    ["exec-curve", "exec-deviations", "exec-entries"].forEach((k) => qc.invalidateQueries({ queryKey: [k, id] }));
    qc.invalidateQueries({ queryKey: ["project-comments", id] });
  };

  const { data: curve } = useQuery({ queryKey: ["exec-curve", id], queryFn: async () => (await loadCurves([id])).get(id)! });
  const { data: deviations = [] } = useQuery({
    queryKey: ["exec-deviations", id],
    queryFn: async () => (await supabase.from("project_deviations").select("*").eq("project_id", id).order("competencia", { ascending: false })).data ?? [],
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["exec-entries", id],
    queryFn: async () => (await supabase.from("actual_entries").select("*").eq("project_id", id).order("competencia", { ascending: false })).data ?? [],
  });

  const rows = curve?.rows ?? [];
  const last = rows[rows.length - 1];
  const mismatch = entries.filter((e: any) => e.cc_mismatch).length;

  return (
    <section className="space-y-5 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Base de comparação: cronograma <strong>{curve?.version === "firme" ? "firme" : "indicativo"}</strong>. Realizado lançado pelo FP&A a partir do relatório contábil.
        </p>
        {last && <div className="text-sm">Acumulado: <strong>{formatBRL(last.actualAcc)}</strong> de {formatBRL(last.plannedAcc)} previsto</div>}
      </div>
      {mismatch > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          {mismatch} lançamento(s) com centro de custo diferente do cadastrado ({project.cost_center ?? "não informado"}).
        </div>
      )}
      <CurveChart rows={rows} />
      <details className="rounded-md border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Tabela mensal e acumulada</summary>
        <div className="p-3"><CurveTable rows={rows} /></div>
      </details>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Desvios relevantes</h3>
        {deviations.length === 0 && <p className="text-sm text-muted-foreground">Nenhum desvio relevante até agora.</p>}
        {deviations.map((d: any) => <DeviationCard key={d.id} d={d} project={project} isOwner={isOwner} isFpa={isFpa} onDone={refresh} />)}
      </div>

      {(isOwner || isFpa) && ["aprovado_final", "em_execucao"].includes(project.status) && (
        <ReforecastEditor projectId={id} rows={rows} onDone={refresh} />
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Lançamentos do realizado</h3>
        {isFpa && <ManualEntryForm project={project} onDone={refresh} />}
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum lançamento.</p> : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Competência</th><th className="px-3 py-2">Natureza</th><th className="px-3 py-2">CC</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2 text-right">Valor</th>{isFpa && <th />}</tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((e: any) => (
                  <tr key={e.id}>
                    <td className="px-3 py-1.5">{fmtM(e.competencia)}</td>
                    <td className="px-3 py-1.5 text-xs">{e.phase === "planejamento" ? "Estudo/projeto" : "Execução"}</td>
                    <td className={`px-3 py-1.5 ${e.cc_mismatch ? "text-warning font-medium" : ""}`}>{e.cost_center ?? "—"}</td>
                    <td className="px-3 py-1.5 text-xs">{[e.description, e.supplier, e.doc_number].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-1.5 text-xs">{e.source === "manual" ? "Manual" : "Importação"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatBRL(e.amount)}</td>
                    {isFpa && (
                      <td className="px-2">
                        {e.source === "manual" && (
                          <Button size="icon" variant="ghost" onClick={async () => {
                            if (!confirm("Excluir lançamento?")) return;
                            const { error } = await supabase.from("actual_entries").delete().eq("id", e.id);
                            if (error) toast.error(error.message); else refresh();
                          }}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const DEV_STATUS: Record<string, string> = { pendente_gestor: "Aguardando gestor", respondido: "Respondido pelo gestor", tratado: "Tratado" };

function DeviationCard({ d, isOwner, isFpa, onDone }: { d: any; project: any; isOwner: boolean; isFpa: boolean; onDone: () => void }) {
  const [text, setText] = useState("");
  const respond = useMutation({
    mutationFn: async (kind: "ajuste" | "justificativa") => {
      const { error } = await supabase.rpc("responder_desvio", { p_deviation_id: d.id, p_kind: kind, p_texto: text });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Resposta registrada no chat"); setText(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const treat = useMutation({
    mutationFn: async (acao: "tratado" | "nova_acao") => {
      const { error } = await supabase.rpc("tratar_desvio", { p_deviation_id: d.id, p_acao: acao, p_comentario: text });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Desvio atualizado"); setText(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const pending = d.status === "pendente_gestor";
  return (
    <div className={`rounded-md border p-3 text-sm ${pending ? "border-destructive/40 bg-destructive/5" : d.status === "respondido" ? "border-warning/40 bg-warning/5" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          {pending && <AlertTriangle className="h-4 w-4 text-destructive" />}
          {fmtM(d.competencia)} · previsto {formatBRL(d.planned)} · realizado {formatBRL(d.actual)} ({d.actual - d.planned >= 0 ? "+" : ""}{formatBRL(d.actual - d.planned)})
        </div>
        <span className="text-xs text-muted-foreground">{DEV_STATUS[d.status] ?? d.status}</span>
      </div>
      {d.response && <p className="mt-1 text-xs text-muted-foreground">{d.response_kind === "ajuste" ? "Ajuste" : "Justificativa"}: {d.response}</p>}
      {pending && isOwner && (
        <div className="mt-2 space-y-2">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Explique o desvio ou descreva o ajuste feito na previsão abaixo" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate("ajuste")}>Registrar ajuste de previsão</Button>
            <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate("justificativa")}>Justificar desvio</Button>
          </div>
        </div>
      )}
      {isFpa && d.status !== "tratado" && (
        <div className="mt-2 space-y-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Comentário (opcional)" />
          <div className="flex gap-2">
            <Button size="sm" disabled={treat.isPending} onClick={() => treat.mutate("tratado")}>Dar por tratado</Button>
            {d.status === "respondido" && <Button size="sm" variant="outline" disabled={treat.isPending} onClick={() => treat.mutate("nova_acao")}>Pedir nova ação</Button>}
          </div>
        </div>
      )}
    </div>
  );
}

function ReforecastEditor({ projectId, rows, onDone }: { projectId: string; rows: { month: string; plannedStudy: number; plannedExec: number }[]; onDone: () => void }) {
  const cur = new Date().toISOString().slice(0, 7) + "-01";
  const future = rows.filter((r) => r.month >= cur);
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const months = [...future.map((r) => r.month), ...(extra ? [extra + "-01"] : [])];
      const payload = months.map((m) => {
        const base = future.find((r) => r.month === m);
        const txt = vals[m];
        const amount = txt != null ? parseBRL(txt) : (base ? base.plannedStudy + base.plannedExec : 0);
        return { period: m, phase: base && base.plannedStudy > 0 && base.plannedExec === 0 ? "planejamento" : "execucao", amount };
      });
      const { error } = await supabase.rpc("ajustar_previsao", { p_project_id: projectId, p_rows: payload as any });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Previsão reprojetada. Registre a justificativa no desvio."); setOpen(false); setVals({}); setExtra(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Ajustar previsão dos próximos meses</Button>;
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="text-sm font-medium">Reprojeção dos meses a partir de {fmtM(cur)}</div>
      <p className="text-xs text-muted-foreground">Meses passados não mudam. O ajuste fica registrado no histórico.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {future.map((r) => (
          <label key={r.month} className="text-xs">
            {fmtM(r.month)}
            <Input defaultValue={(r.plannedStudy + r.plannedExec).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} onChange={(e) => setVals({ ...vals, [r.month]: e.target.value })} />
          </label>
        ))}
        <label className="text-xs">Novo mês
          <Input type="month" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </label>
        {extra && <label className="text-xs">Valor {extra}<Input onChange={(e) => setVals({ ...vals, [extra + "-01"]: e.target.value })} /></label>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Salvar previsão</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

function ManualEntryForm({ project, onDone }: { project: any; onDone: () => void }) {
  const [f, setF] = useState({ competencia: "", amount: "", cost_center: project.cost_center ?? "", description: "", supplier: "", doc_number: "" });
  const save = useMutation({
    mutationFn: async () => {
      if (!f.competencia || !f.amount) throw new Error("Informe competência e valor.");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("actual_entries").insert({
        project_id: project.id, project_code: project.code ?? "", cost_center: f.cost_center || null,
        competencia: f.competencia + "-01", amount: parseBRL(f.amount), source: "manual",
        description: f.description || null, supplier: f.supplier || null, doc_number: f.doc_number || null, created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lançamento registrado"); setF({ ...f, amount: "", description: "", supplier: "", doc_number: "" }); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-7">
      <Input type="month" value={f.competencia} onChange={(e) => setF({ ...f, competencia: e.target.value })} />
      <Input placeholder="Valor (R$)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      <Input placeholder="Centro de custo" value={f.cost_center} onChange={(e) => setF({ ...f, cost_center: e.target.value })} />
      <Input placeholder="Descrição" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <Input placeholder="Fornecedor" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
      <Input placeholder="Nº documento" value={f.doc_number} onChange={(e) => setF({ ...f, doc_number: e.target.value })} />
      <Button onClick={() => save.mutate()} disabled={save.isPending}>Lançar</Button>
    </div>
  );
}
