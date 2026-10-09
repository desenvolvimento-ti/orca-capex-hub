import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Check, RotateCcw, X, Pencil } from "lucide-react";
import { formatBRL, formatDateBR, parseBRL } from "@/lib/labels";

type CRStatus =
  | "pendente_fpa"
  | "aguardando_diretor"
  | "aguardando_ceo"
  | "aprovado"
  | "devolvido_revisao"
  | "reprovado";

const CR_STATUS_LABEL: Record<CRStatus, string> = {
  pendente_fpa: "Aguardando FP&A",
  aguardando_diretor: "Aguardando Diretoria",
  aguardando_ceo: "Aguardando CEO",
  aprovado: "Aprovada",
  devolvido_revisao: "Devolvida",
  reprovado: "Reprovada",
};

const OPEN_STATUSES: CRStatus[] = ["pendente_fpa", "aguardando_diretor", "aguardando_ceo"];

type Request = {
  id: string;
  status: CRStatus;
  justification: string;
  requested_total: number | null;
  requested_execution_start: string | null;
  requested_execution_end: string | null;
  requested_planning_end: string | null;
  last_decision_comment: string | null;
  created_at: string;
};

type Project = {
  id: string;
  owner_id: string;
  area_id: string;
  status: string;
  estimated_total: number | null;
  confirmed_total: number | null;
  ceo_approved_amount: number | null;
  execution_start_date: string | null;
  est_start_date: string | null;
  execution_end_date: string | null;
  planning_end_date: string | null;
};

export function ChangeRequestPanel({ project }: { project: Project }) {
  const qc = useQueryClient();
  const { profile, effectiveRole, roles, isRealFpa, viewAs } = useAuth();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["change-requests", project.id],
    queryFn: async () => {
      const { data, error } = await (supabase as never as { from: (t: string) => { select: (s: string) => { eq: (a: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: Request[] | null; error: { message: string } | null }> } } } })
        .from("project_change_requests")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Request[];
    },
  });

  const isOwner = project.owner_id === profile?.id;
  const liberado = project.status === "liberado" || project.status === "liberado_parcial";
  const hasOpen = useMemo(() => requests.some((r) => OPEN_STATUSES.includes(r.status)), [requests]);
  const canRequest = isOwner && liberado && !hasOpen;

  const open = requests.find((r) => OPEN_STATUSES.includes(r.status));

  // Quem pode decidir agora?
  const actsAsCeo = roles.includes("ceo") || (isRealFpa && viewAs === "ceo");
  const actsAsDirector =
    roles.includes("cfo") || roles.includes("cco") || roles.includes("cmo") ||
    (isRealFpa && (viewAs === "cfo" || viewAs === "cco" || viewAs === "cmo"));
  const actsAsFpa = effectiveRole === "fpa";

  const canDecide = (s: CRStatus): boolean => {
    if (s === "pendente_fpa") return actsAsFpa || isRealFpa;
    if (s === "aguardando_diretor") return actsAsDirector || isRealFpa;
    if (s === "aguardando_ceo") return actsAsCeo || isRealFpa;
    return false;
  };

  const decide = useMutation({
    mutationFn: async ({ requestId, acao, justificativa }: { requestId: string; acao: "aprovar" | "devolver" | "reprovar"; justificativa: string }) => {
      const { error } = await supabase.rpc("decisao_alteracao" as never, {
        p_request_id: requestId,
        p_acao: acao,
        p_justificativa: justificativa,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decisão registrada");
      qc.invalidateQueries({ queryKey: ["change-requests", project.id] });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["approved-schedule"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Solicitações do gestor para alterar valor ou datas após a liberação. Passam por FP&A → Diretoria → CEO.
        </p>
        {canRequest && (
          <RequestChangeDialog project={project} />
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : requests.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          Nenhuma solicitação de alteração.
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">{CR_STATUS_LABEL[r.status]}</div>
                <div className="text-xs text-muted-foreground">{formatDateBR(r.created_at)}</div>
              </div>
              <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                {r.requested_total != null && (
                  <li><span className="text-muted-foreground">Novo valor:</span> <span className="font-medium tabular-nums">{formatBRL(r.requested_total)}</span></li>
                )}
                {r.requested_execution_start && (
                  <li><span className="text-muted-foreground">Início execução:</span> <span className="font-medium">{formatDateBR(r.requested_execution_start)}</span></li>
                )}
                {r.requested_execution_end && (
                  <li><span className="text-muted-foreground">Fim execução:</span> <span className="font-medium">{formatDateBR(r.requested_execution_end)}</span></li>
                )}
                {r.requested_planning_end && (
                  <li><span className="text-muted-foreground">Fim planejamento:</span> <span className="font-medium">{formatDateBR(r.requested_planning_end)}</span></li>
                )}
              </ul>
              <div className="mt-2 text-xs">
                <span className="text-muted-foreground">Justificativa: </span>{r.justification}
              </div>
              {r.last_decision_comment && (
                <div className="mt-1 text-xs">
                  <span className="text-muted-foreground">Último comentário: </span>{r.last_decision_comment}
                </div>
              )}
              {OPEN_STATUSES.includes(r.status) && canDecide(r.status) && (
                <div className="mt-3">
                  <DecisionButtons onDecide={(acao, just) => decide.mutate({ requestId: r.id, acao, justificativa: just })} pending={decide.isPending} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionButtons({
  onDecide, pending,
}: {
  onDecide: (acao: "aprovar" | "devolver" | "reprovar", just: string) => void;
  pending: boolean;
}) {
  const [openKind, setOpenKind] = useState<"devolver" | "reprovar" | null>(null);
  const [comment, setComment] = useState("");
  const submit = (kind: "devolver" | "reprovar") => {
    if (!comment.trim()) { toast.error("Informe uma justificativa."); return; }
    onDecide(kind, comment.trim());
    setOpenKind(null); setComment("");
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => onDecide("aprovar", "")} disabled={pending}>
        <Check className="mr-1 h-4 w-4" /> Aprovar
      </Button>
      {(["devolver", "reprovar"] as const).map((k) => (
        <Popover key={k} open={openKind === k} onOpenChange={(o) => { setOpenKind(o ? k : null); if (!o) setComment(""); }}>
          <PopoverTrigger asChild>
            <Button size="sm" variant={k === "devolver" ? "outline" : "ghost"} className={k === "reprovar" ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : ""} disabled={pending}>
              {k === "devolver" ? <RotateCcw className="mr-1 h-4 w-4" /> : <X className="mr-1 h-4 w-4" />}
              {k === "devolver" ? "Devolver" : "Reprovar"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <div className="text-sm font-medium">{k === "devolver" ? "Devolver solicitação" : "Reprovar solicitação"}</div>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Justificativa (obrigatória)" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setOpenKind(null); setComment(""); }}>Cancelar</Button>
                <Button size="sm" variant={k === "reprovar" ? "destructive" : "default"} onClick={() => submit(k)} disabled={pending}>Confirmar</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}

export function RequestChangeDialog({ project, trigger }: { project: Project; trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const currentTotal = Number(project.ceo_approved_amount ?? project.confirmed_total ?? project.estimated_total ?? 0);
  const [totalText, setTotalText] = useState<string>("");
  const [execStart, setExecStart] = useState<string>("");
  const [execEnd, setExecEnd] = useState<string>("");
  const [planEnd, setPlanEnd] = useState<string>("");
  const [just, setJust] = useState("");

  const reset = () => { setTotalText(""); setExecStart(""); setExecEnd(""); setPlanEnd(""); setJust(""); };

  const submit = useMutation({
    mutationFn: async () => {
      if (!just.trim()) throw new Error("Informe uma justificativa.");
      const parsedTotal = totalText.trim() ? parseBRL(totalText) : null;
      if (!parsedTotal && !execStart && !execEnd && !planEnd) {
        throw new Error("Informe pelo menos um campo a alterar.");
      }
      const { error } = await supabase.rpc("solicitar_alteracao" as never, {
        p_project_id: project.id,
        p_justificativa: just.trim(),
        p_requested_total: parsedTotal,
        p_requested_execution_start: execStart || null,
        p_requested_execution_end: execEnd || null,
        p_requested_planning_end: planEnd || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação enviada ao FP&A");
      qc.invalidateQueries({ queryKey: ["change-requests", project.id] });
      reset();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Pencil className="mr-1 h-4 w-4" /> Solicitar alteração
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar alteração do projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Atual: valor {formatBRL(currentTotal)} · execução {formatDateBR(project.execution_start_date ?? project.est_start_date)} → {formatDateBR(project.execution_end_date)}.
            Preencha só o que deseja alterar. A solicitação passará por FP&A → Diretoria → CEO.
          </p>
          <div>
            <Label>Novo valor total (R$)</Label>
            <Input inputMode="decimal" value={totalText} onChange={(e) => setTotalText(e.target.value)} placeholder="Ex.: 250.000,00" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Início execução</Label>
              <Input type="date" value={execStart} onChange={(e) => setExecStart(e.target.value)} />
            </div>
            <div>
              <Label>Fim execução</Label>
              <Input type="date" value={execEnd} onChange={(e) => setExecEnd(e.target.value)} />
            </div>
            <div>
              <Label>Fim planejamento</Label>
              <Input type="date" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Justificativa <span className="text-destructive">*</span></Label>
            <Textarea rows={3} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Por que a alteração é necessária?" />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> Campo obrigatório. Ao aprovar, o cronograma financeiro fora da nova janela será removido automaticamente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submit.isPending}>Cancelar</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            {submit.isPending ? "Enviando…" : "Enviar solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
