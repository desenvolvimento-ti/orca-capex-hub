import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { formatBRL, formatDateBR } from "@/lib/labels";
import { downloadActualsTemplate, parseActualsFile, type ParsedActual } from "@/lib/execution";

export const Route = createFileRoute("/app/realizado")({
  head: () => ({ meta: [
    { title: "Realizado · Hub de Investimentos" },
    { name: "description", content: "Importação do realizado contábil, lançamentos e fila fora do rito." },
    { property: "og:title", content: "Realizado · Hub de Investimentos" },
    { property: "og:description", content: "Importação do realizado contábil e conciliação mensal." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: RealizadoPage,
});

const fmtM = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;

function RealizadoPage() {
  const { loading, isRealFpa } = useAuth();
  const { data: queue = [] } = useQueue();
  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!isRealFpa) return <Navigate to="/app" />;
  const open = queue.filter((q: any) => q.status === "aberto" || q.status === "em_contato").length;
  return (
    <div className="space-y-6">
      <BackButton fallback="/app" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Realizado</h1>
        <p className="text-sm text-muted-foreground">Relatório contábil de imobilizado, vinculado aos projetos pelo código e centro de custo.</p>
      </div>
      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Importar planilha</TabsTrigger>
          <TabsTrigger value="queue">Fora do rito{open ? ` (${open})` : ""}</TabsTrigger>
          <TabsTrigger value="history">Importações</TabsTrigger>
          <TabsTrigger value="deviations">Desvios</TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="mt-6"><ImportPanel /></TabsContent>
        <TabsContent value="queue" className="mt-6"><QueuePanel /></TabsContent>
        <TabsContent value="history" className="mt-6"><HistoryPanel /></TabsContent>
        <TabsContent value="deviations" className="mt-6"><DeviationsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function useProjectsByCode() {
  return useQuery({
    queryKey: ["projects-by-code"],
    queryFn: async () => (await supabase.from("projects").select("id, code, name, cost_center, owner_id, status")).data ?? [],
  });
}

function ImportPanel() {
  const qc = useQueryClient();
  const { data: projects = [] } = useProjectsByCode();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedActual[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [comp, setComp] = useState("");

  const byCode = new Map(projects.filter((p: any) => p.code).map((p: any) => [p.code.toUpperCase(), p]));
  const classify = (r: ParsedActual) => {
    if (r.error) return { k: "erro", label: r.error };
    const p: any = byCode.get(r.project_code);
    if (!p) return { k: "fora", label: "Fora do rito" };
    if (p.cost_center && r.cost_center && p.cost_center.trim().toUpperCase() !== r.cost_center.toUpperCase()) return { k: "cc", label: `CC diverge (${p.cost_center})` };
    return { k: "ok", label: "Vinculada" };
  };
  const cls = rows.map(classify);
  const count = (k: string) => cls.filter((c) => c.k === k).length;

  const onFile = async (f: File | null) => {
    setFile(f); setRows([]); setMissing([]);
    if (!f) return;
    try {
      const res = await parseActualsFile(f);
      setRows(res.rows); setMissing(res.missingColumns);
      const months = res.rows.map((r) => r.competencia).filter(Boolean) as string[];
      if (months.length && !comp) {
        const freq = new Map<string, number>(); months.forEach((m) => freq.set(m, (freq.get(m) ?? 0) + 1));
        setComp([...freq.entries()].sort((a, b) => b[1] - a[1])[0][0].slice(0, 7));
      }
    } catch (e: any) { toast.error(e?.message ?? "Não foi possível ler a planilha"); }
  };

  const confirm = useMutation({
    mutationFn: async () => {
      if (!comp) throw new Error("Informe o mês de referência da importação.");
      const valid = rows.filter((r) => !r.error).map((r) => ({
        project_code: r.project_code, cost_center: r.cost_center, competencia: r.competencia, amount: r.amount,
        description: r.description, supplier: r.supplier, doc_number: r.doc_number,
      }));
      const { data, error } = await supabase.rpc("import_actuals", { p_file_name: file?.name ?? "planilha", p_competencia: comp + "-01", p_rows: valid as any });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (d) => {
      toast.success(`Importação concluída: ${d.matched_rows} vinculadas, ${d.unmatched_rows} fora do rito`);
      setRows([]); setFile(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 text-sm">
        <div className="font-medium">Colunas esperadas</div>
        <p className="mt-1 text-muted-foreground">Obrigatórias: <strong>Código do projeto</strong>, <strong>Centro de custo</strong>, <strong>Competência</strong> (mês/ano) e <strong>Valor</strong>. Opcionais: Descrição/histórico, Fornecedor, Nº documento. Reimportar o mesmo mês de referência substitui a importação anterior daquele mês.</p>
        <Button variant="link" className="px-0" onClick={downloadActualsTemplate}><Download className="mr-1 h-4 w-4" /> Baixar modelo</Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Planilha
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="text-sm">Mês de referência
          <Input type="month" value={comp} onChange={(e) => setComp(e.target.value)} />
        </label>
      </div>
      {missing.length > 0 && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">Colunas não encontradas: {missing.join(", ")}.</div>}
      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <span>Vinculadas: <strong>{count("ok")}</strong></span>
            <span className="text-warning">CC divergente: <strong>{count("cc")}</strong></span>
            <span>Fora do rito: <strong>{count("fora")}</strong></span>
            <span className="text-destructive">Com erro (ignoradas): <strong>{count("erro")}</strong></span>
            <span>Total válido: <strong>{formatBRL(rows.filter((r) => !r.error).reduce((s, r) => s + (r.amount ?? 0), 0))}</strong></span>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Código</th><th className="px-3 py-2">CC</th><th className="px-3 py-2">Competência</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Situação</th></tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1">{r.line}</td>
                    <td className="px-3 py-1 font-mono text-xs">{r.project_code}</td>
                    <td className="px-3 py-1">{r.cost_center}</td>
                    <td className="px-3 py-1">{r.competencia ? fmtM(r.competencia) : "—"}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{r.amount != null ? formatBRL(r.amount) : "—"}</td>
                    <td className={`px-3 py-1 text-xs ${cls[i].k === "erro" ? "text-destructive" : cls[i].k === "cc" ? "text-warning" : cls[i].k === "fora" ? "text-muted-foreground" : "text-success"}`}>{cls[i].label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}><Upload className="mr-1 h-4 w-4" /> Confirmar importação</Button>
        </>
      )}
    </div>
  );
}

function useQueue() {
  return useQuery({
    queryKey: ["unmatched-queue"],
    queryFn: async () => {
      const [{ data: q }, { data: e }] = await Promise.all([
        supabase.from("unmatched_actuals_queue").select("*").order("updated_at", { ascending: false }),
        supabase.from("actual_entries").select("project_code, cost_center, amount, competencia").is("project_id", null),
      ]);
      return (q ?? []).map((x: any) => {
        const es = (e ?? []).filter((r: any) => r.project_code === x.project_code && (r.cost_center ?? "") === x.cost_center);
        return { ...x, total: es.reduce((s: number, r: any) => s + Number(r.amount), 0), months: [...new Set(es.map((r: any) => r.competencia))].sort() };
      });
    },
  });
}

const Q_STATUS: Record<string, string> = { aberto: "Aberto", em_contato: "Em contato", resolvido: "Resolvido", fora_escopo: "Fora do escopo" };

function QueuePanel() {
  const qc = useQueryClient();
  const { data: queue = [] } = useQueue();
  const { data: projects = [] } = useProjectsByCode();
  const { data: managers = [] } = useQuery({
    queryKey: ["managers-list"],
    queryFn: async () => {
      const { data: r } = await supabase.from("user_roles").select("user_id").eq("role", "manager");
      const ids = (r ?? []).map((x) => x.user_id);
      if (!ids.length) return [];
      return (await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids).order("full_name")).data ?? [];
    },
  });
  const [showAll, setShowAll] = useState(false);
  const act = useMutation({
    mutationFn: async (a: { id: string; acao: string; project?: string; manager?: string; comment?: string }) => {
      const { error } = await supabase.rpc("resolver_fora_do_rito", { p_queue_id: a.id, p_acao: a.acao, p_project_id: a.project ?? undefined, p_manager_id: a.manager ?? undefined, p_comentario: a.comment ?? undefined } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fila atualizada"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const list = queue.filter((q: any) => showAll || q.status === "aberto" || q.status === "em_contato");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gastos do relatório contábil sem projeto correspondente no Hub. Use para abordar o gestor responsável.</p>
        <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>{showAll ? "Só pendentes" : "Mostrar resolvidos"}</Button>
      </div>
      {list.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum item pendente.</div>}
      {list.map((q: any) => <QueueItem key={q.id} q={q} projects={projects} managers={managers} onAct={(a) => act.mutate({ id: q.id, ...a })} busy={act.isPending} />)}
    </div>
  );
}

function QueueItem({ q, projects, managers, onAct, busy }: { q: any; projects: any[]; managers: any[]; onAct: (a: { acao: string; project?: string; manager?: string; comment?: string }) => void; busy: boolean }) {
  const [project, setProject] = useState("");
  const [manager, setManager] = useState(q.assigned_manager_id ?? "");
  const [comment, setComment] = useState("");
  const m = managers.find((x) => x.id === q.assigned_manager_id);
  return (
    <div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><span className="font-mono">{q.project_code}</span> · CC {q.cost_center || "—"} · <strong>{formatBRL(q.total)}</strong> · {q.months.map(fmtM).join(", ")}</div>
        <span className="rounded bg-muted px-2 py-0.5 text-xs">{Q_STATUS[q.status] ?? q.status}</span>
      </div>
      {m && <div className="text-xs text-muted-foreground">Gestor abordado: {m.full_name}{m.phone ? ` · WhatsApp ${m.phone}` : ""}</div>}
      {q.resolution && <div className="text-xs text-muted-foreground">Obs.: {q.resolution}</div>}
      {q.status === "resolvido" || q.status === "fora_escopo" ? (
        <Button size="sm" variant="ghost" onClick={() => onAct({ acao: "reabrir" })}>Reabrir</Button>
      ) : (
        <div className="grid gap-2 md:grid-cols-3">
          <div className="flex gap-2">
            <select className="h-9 flex-1 rounded-md border bg-background px-2" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Vincular a projeto…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
            <Button size="sm" disabled={!project || busy} onClick={() => onAct({ acao: "vincular", project })}>Vincular</Button>
          </div>
          <div className="flex gap-2">
            <select className="h-9 flex-1 rounded-md border bg-background px-2" value={manager} onChange={(e) => setManager(e.target.value)}>
              <option value="">Gestor responsável…</option>
              {managers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={!manager || busy} onClick={() => onAct({ acao: "em_contato", manager, comment })}>Acionar</Button>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Observação / justificativa" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAct({ acao: "fora_escopo", comment })}>Fora do escopo</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPanel() {
  const { data = [] } = useQuery({
    queryKey: ["actuals-imports"],
    queryFn: async () => (await supabase.from("actuals_imports").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  if (!data.length) return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma importação ainda.</div>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="px-3 py-2">Referência</th><th className="px-3 py-2">Arquivo</th><th className="px-3 py-2">Importado em</th><th className="px-3 py-2 text-right">Linhas</th><th className="px-3 py-2 text-right">Vinculadas</th><th className="px-3 py-2 text-right">Fora do rito</th><th className="px-3 py-2 text-right">Total</th></tr>
        </thead>
        <tbody className="divide-y">
          {data.map((i: any) => (
            <tr key={i.id}>
              <td className="px-3 py-1.5">{fmtM(i.competencia)}</td><td className="px-3 py-1.5">{i.file_name}</td><td className="px-3 py-1.5">{formatDateBR(i.created_at)}</td>
              <td className="px-3 py-1.5 text-right">{i.total_rows}</td><td className="px-3 py-1.5 text-right">{i.matched_rows}</td><td className="px-3 py-1.5 text-right">{i.unmatched_rows}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatBRL(i.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviationsPanel() {
  const { data = [] } = useQuery({
    queryKey: ["all-deviations"],
    queryFn: async () => (await supabase.from("project_deviations").select("*, projects(code, name)").neq("status", "tratado").order("competencia", { ascending: false })).data ?? [],
  });
  if (!data.length) return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum desvio pendente.</div>;
  return (
    <div className="space-y-2">
      {data.map((d: any) => (
        <Link key={d.id} to="/app/projects/$id" params={{ id: d.project_id }} className="block rounded-md border bg-card p-3 text-sm hover:bg-muted/40">
          <span className="font-mono text-xs">{d.projects?.code}</span> {d.projects?.name} · {fmtM(d.competencia)} · previsto {formatBRL(d.planned)} · realizado {formatBRL(d.actual)}
          <span className="ml-2 text-xs text-muted-foreground">{d.status === "pendente_gestor" ? "Aguardando gestor" : "Respondido pelo gestor — avaliar"}</span>
        </Link>
      ))}
    </div>
  );
}
