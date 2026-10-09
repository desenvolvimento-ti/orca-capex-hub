import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { WINDOW_LABEL, PERIOD_TONE, cyclePeriodFromDates, formatDateBR, type CyclePeriod } from "@/lib/labels";

type CycleRow = {
  id: string;
  year: number;
  name: string;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  submission_start: string | null;
  submission_end: string | null;
  analysis_start: string | null;
  analysis_end: string | null;
  cycle_start_date: string | null;
  cycle_end_date: string | null;
};

export function CyclesPanel() {
  const qc = useQueryClient();
  const [year, setYear] = useState<string>(String(new Date().getFullYear() + 1));
  const [name, setName] = useState<string>("");

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["cycles"],
    queryFn: async (): Promise<CycleRow[]> => {
      const { data, error } = await supabase
        .from("cycles")
        .select("id, year, name, is_active, archived_at, created_at, submission_start, submission_end, analysis_start, analysis_end, cycle_start_date, cycle_end_date")
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CycleRow[];
    },
  });

  const createCycle = useMutation({
    mutationFn: async () => {
      const y = parseInt(year, 10);
      if (!Number.isFinite(y) || y < 2000) throw new Error("Ano inválido");
      const { error } = await supabase.from("cycles").insert({ year: y, name: name.trim() || `Ciclo ${y}` });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); toast.success("Ciclo criado"); qc.invalidateQueries({ queryKey: ["cycles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("cycles").update({ is_active: false }).neq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("cycles").update({ is_active: true, archived_at: null }).eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("Ciclo ativado"); qc.invalidateQueries({ queryKey: ["cycles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      if (archive) {
        // Usa RPC: arquiva ciclo e devolve projetos "não aprovados" ao hub do gestor.
        const { error } = await supabase.rpc("archive_cycle" as never, { p_cycle_id: id } as never);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cycles").update({ archived_at: null }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.archive ? "Ciclo arquivado. Projetos não aprovados voltaram ao hub dos gestores." : "Ciclo restaurado");
      qc.invalidateQueries({ queryKey: ["cycles"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { count, error: cErr } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("cycle_id", id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) throw new Error(`Ciclo possui ${count} projeto(s) e não pode ser excluído. Arquive em vez disso.`);
      const { error } = await supabase.from("cycles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ciclo excluído"); qc.invalidateQueries({ queryKey: ["cycles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[120px_1fr_auto] md:items-end"
        onSubmit={(e) => { e.preventDefault(); createCycle.mutate(); }}
      >
        <div>
          <Label htmlFor="cycle-year">Ano</Label>
          <Input id="cycle-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cycle-name">Nome (opcional)</Label>
          <Input id="cycle-name" placeholder={`Ciclo ${year}`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={createCycle.isPending}>Criar ciclo</Button>
      </form>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">Ciclos ({cycles.length})</div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : cycles.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum ciclo criado.</div>
        ) : (
          <ul className="divide-y">
            {cycles.map((c) => {
              const archived = !!c.archived_at;
              const period = cyclePeriodFromDates(c);
              const isOpen = expanded.has(c.id);
              return (
                <li key={c.id} className={`space-y-4 px-4 py-4 ${archived ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2">
                      {!archived && (
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          className="mt-1 rounded p-1 text-muted-foreground hover:bg-muted"
                          aria-label={isOpen ? "Recolher janelas" : "Expandir janelas"}
                        >
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-sm text-muted-foreground">({c.year})</span>
                          {c.is_active && <Badge>Ativo</Badge>}
                          {archived && <Badge variant="secondary">Arquivado</Badge>}
                          {!archived && <PeriodBadge period={period} />}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Criado em {formatDateBR(c.created_at)}
                          {archived && ` · Arquivado em ${formatDateBR(c.archived_at)}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!c.is_active && !archived && (
                        <Button size="sm" variant="outline" onClick={() => activate.mutate(c.id)}>Ativar</Button>
                      )}
                      {!archived ? (
                        <Button size="sm" variant="outline" onClick={() => {
                          if (confirm(`Arquivar "${c.name}"?\n\nO ciclo será encerrado. Projetos NÃO aprovados deste ciclo voltam automaticamente ao hub do gestor (com histórico de reenvio).`))
                            archive.mutate({ id: c.id, archive: true });
                        }}>Arquivar</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => archive.mutate({ id: c.id, archive: false })}>Restaurar</Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Excluir ciclo ${c.name}? Esta ação não pode ser desfeita.`)) remove.mutate(c.id); }}>Excluir</Button>
                    </div>
                  </div>
                  {!archived && isOpen && <CyclePeriodConfig cycle={c} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PeriodBadge({ period }: { period: CyclePeriod }) {
  const tone = PERIOD_TONE[period];
  const cls =
    tone === "success" ? "bg-success/15 text-success border-success/30" :
    tone === "info" ? "bg-primary/10 text-primary border-primary/30" :
    "bg-muted text-muted-foreground border-muted";
  return <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${cls}`}>{WINDOW_LABEL[period]}</span>;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CyclePeriodConfig({ cycle }: { cycle: CycleRow }) {
  const qc = useQueryClient();
  const [subStart, setSubStart] = useState(toLocalInput(cycle.submission_start));
  const [subEnd, setSubEnd] = useState(toLocalInput(cycle.submission_end));
  const [anaStart, setAnaStart] = useState(toLocalInput(cycle.analysis_start));
  const [anaEnd, setAnaEnd] = useState(toLocalInput(cycle.analysis_end));
  const [cycleStart, setCycleStart] = useState(toLocalInput(cycle.cycle_start_date));
  const [cycleEnd, setCycleEnd] = useState(toLocalInput(cycle.cycle_end_date));

  // Re-sync if external data changes
  useEffect(() => {
    setSubStart(toLocalInput(cycle.submission_start));
    setSubEnd(toLocalInput(cycle.submission_end));
    setAnaStart(toLocalInput(cycle.analysis_start));
    setAnaEnd(toLocalInput(cycle.analysis_end));
    setCycleStart(toLocalInput(cycle.cycle_start_date));
    setCycleEnd(toLocalInput(cycle.cycle_end_date));
  }, [cycle.submission_start, cycle.submission_end, cycle.analysis_start, cycle.analysis_end, cycle.cycle_start_date, cycle.cycle_end_date]);

  const save = useMutation({
    mutationFn: async () => {
      const toISO = (v: string) => (v ? new Date(v).toISOString() : null);
      const ss = toISO(subStart), se = toISO(subEnd), as = toISO(anaStart), ae = toISO(anaEnd), cs = toISO(cycleStart), ce = toISO(cycleEnd);
      if (ss && se && new Date(ss) > new Date(se)) throw new Error("Submissão: data fim deve ser posterior à de início");
      if (as && ae && new Date(as) > new Date(ae)) throw new Error("Análise de Pré-Aprovação: data fim deve ser posterior à de início");
      if (se && as && new Date(as) < new Date(se)) throw new Error("Análise de Pré-Aprovação deve começar após o fim da Submissão");
      if (cs && ce && new Date(cs) > new Date(ce)) throw new Error("Início do ciclo deve ser anterior ao Fim do ciclo");
      if (ae && ce && new Date(ce) < new Date(ae)) throw new Error("Fim do ciclo deve ser posterior ao fim da Análise de Pré-Aprovação");
      const { error } = await supabase.from("cycles").update({
        submission_start: ss, submission_end: se,
        analysis_start: as, analysis_end: ae,
        cycle_start_date: cs, cycle_end_date: ce,
      } as never).eq("id", cycle.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Períodos salvos"); qc.invalidateQueries({ queryKey: ["cycles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closedHint = anaEnd
    ? `Fechado a partir de ${formatDateBR(new Date(anaEnd).toISOString())}`
    : "Fechado após o fim do período de Análise de Pré-Aprovação";

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Períodos do ciclo</div>
      <form
        className="grid gap-3"
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      >
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <Label className="text-xs">Submissão — início</Label>
            <Input type="datetime-local" value={subStart} onChange={(e) => setSubStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Submissão — fim</Label>
            <Input type="datetime-local" value={subEnd} onChange={(e) => setSubEnd(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <Label className="text-xs">Análise de Pré-Aprovação — início</Label>
            <Input type="datetime-local" value={anaStart} onChange={(e) => setAnaStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Análise de Pré-Aprovação — fim</Label>
            <Input type="datetime-local" value={anaEnd} onChange={(e) => setAnaEnd(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <Label className="text-xs">Início do ciclo (1º mês do cronograma)</Label>
            <Input type="datetime-local" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Define o 1º mês das colunas do cronograma do gestor.
            </p>
          </div>
          <div>
            <Label className="text-xs">Fim do ciclo (prazo final dos trâmites)</Label>
            <Input type="datetime-local" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Define o último mês das colunas. Projetos cuja execução ultrapasse esta data aparecem automaticamente também no ciclo seguinte que englobe o período remanescente.
            </p>
          </div>
        </div>
        <div className="rounded-md bg-background/50 px-3 py-2 text-xs text-muted-foreground">
          Fechado: automático após o fim da Análise de Pré-Aprovação. {closedHint}. O ciclo permanece ativo até ser arquivado pelo FP&A.
        </div>
        <div className="flex justify-end">
          <Button size="sm" type="submit" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar períodos"}
          </Button>
        </div>
      </form>
    </div>
  );
}
