import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Check, RotateCcw, X } from "lucide-react";
import { formatBRL, parseBRL } from "@/lib/labels";

/**
 * Etapa 2 — Decisão de Pré-Aprovação (Diretoria / FP&A em simulação).
 * Usa a RPC `decisao_diretoria_prev` — três ações:
 *  - pre_aprovar      → aguardando_documentacao
 *  - devolver         → devolvido_pre (com valor sugerido + justificativa)
 *  - nao_aprovar      → nao_aprovado_pre (com justificativa)
 */
export function DirectoriaPrevActions({
  projectId,
  estimatedTotal,
  size = "sm",
  onDone,
}: {
  projectId: string;
  estimatedTotal: number | null;
  size?: "sm" | "default";
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [openKind, setOpenKind] = useState<"pre" | "devolver" | "nao" | null>(null);
  const [comment, setComment] = useState("");
  const [suggestedText, setSuggestedText] = useState(
    estimatedTotal != null ? Number(estimatedTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""
  );

  const mut = useMutation({
    mutationFn: async ({
      acao, valor, justificativa,
    }: { acao: "pre_aprovar" | "devolver" | "nao_aprovar"; valor: number | null; justificativa: string }) => {
      const { error } = await supabase.rpc("decisao_diretoria_prev", {
        p_project_id: projectId,
        p_acao: acao,
        p_valor_sugerido: valor as unknown as number,
        p_justificativa: justificativa,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      const msg =
        vars.acao === "pre_aprovar" ? "Projeto pré-aprovado" :
        vars.acao === "devolver" ? "Devolvido ao gestor com ajuste" : "Projeto não aprovado";
      toast.success(msg);
      setOpenKind(null);
      setComment("");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["history", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["diretoria-projects"] });
      qc.invalidateQueries({ queryKey: ["diretoria-stats"] });
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmPre = () => {
    const valor = parseBRL(suggestedText);
    mut.mutate({ acao: "pre_aprovar", valor: valor > 0 ? valor : null, justificativa: comment.trim() });
  };
  const confirmDevolver = () => {
    const valor = parseBRL(suggestedText);
    if (valor <= 0) return toast.error("Informe o valor sugerido.");
    if (!comment.trim()) return toast.error("Justifique a devolução.");
    mut.mutate({ acao: "devolver", valor, justificativa: comment.trim() });
  };
  const confirmNao = () => {
    if (!comment.trim()) return toast.error("Informe uma justificativa.");
    mut.mutate({ acao: "nao_aprovar", valor: null, justificativa: comment.trim() });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Pré-aprovar */}
      <Popover open={openKind === "pre"} onOpenChange={(o) => { setOpenKind(o ? "pre" : null); if (!o) setComment(""); }}>
        <PopoverTrigger asChild>
          <Button size={size} disabled={mut.isPending}>
            <Check className="mr-1 h-4 w-4" /> Pré-aprovar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <div className="text-sm font-medium">Pré-aprovar projeto</div>
            <p className="text-xs text-muted-foreground">
              Confirma o valor pré-aprovado. Se ajustar, o valor sugerido substituirá o estimado pelo gestor.
            </p>
            <div>
              <Label htmlFor="pre-val">Valor pré-aprovado (R$)</Label>
              <Input id="pre-val" inputMode="decimal" value={suggestedText} onChange={(e) => setSuggestedText(e.target.value)} placeholder="0,00" />
              <div className="mt-1 text-xs text-muted-foreground">
                Solicitado pelo gestor: {formatBRL(estimatedTotal ?? 0)} · Confirmando: {formatBRL(parseBRL(suggestedText))}
              </div>
            </div>
            <div>
              <Label>Comentário (opcional)</Label>
              <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Observações internas…" />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setOpenKind(null); setComment(""); }}>Cancelar</Button>
              <Button size="sm" onClick={confirmPre} disabled={mut.isPending}>Confirmar</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Devolver com ajuste de valor */}
      <Popover open={openKind === "devolver"} onOpenChange={(o) => { setOpenKind(o ? "devolver" : null); if (!o) setComment(""); }}>
        <PopoverTrigger asChild>
          <Button size={size} variant="outline" disabled={mut.isPending}>
            <RotateCcw className="mr-1 h-4 w-4" /> Devolver com ajuste
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <div className="text-sm font-medium">Devolver com ajuste de valor</div>
            <p className="text-xs text-muted-foreground">
              O gestor poderá aceitar o novo valor (segue para orçamentação) ou renegociar (volta para sua análise).
            </p>
            <div>
              <Label htmlFor="dev-val">Valor sugerido pela Diretoria (R$) <span className="text-destructive">*</span></Label>
              <Input id="dev-val" inputMode="decimal" value={suggestedText} onChange={(e) => setSuggestedText(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Justificativa <span className="text-destructive">*</span></Label>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Por que ajustar o valor?" />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setOpenKind(null); setComment(""); }}>Cancelar</Button>
              <Button size="sm" onClick={confirmDevolver} disabled={mut.isPending}>Devolver</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Não aprovar */}
      <Popover open={openKind === "nao"} onOpenChange={(o) => { setOpenKind(o ? "nao" : null); if (!o) setComment(""); }}>
        <PopoverTrigger asChild>
          <Button size={size} variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={mut.isPending}>
            <X className="mr-1 h-4 w-4" /> Não aprovar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <div className="text-sm font-medium">Não aprovar</div>
            <p className="text-xs text-muted-foreground">
              Decisão final neste ciclo. O projeto retorna ao hub do gestor quando o ciclo for arquivado.
            </p>
            <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Justificativa (obrigatória)" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setOpenKind(null); setComment(""); }}>Cancelar</Button>
              <Button size="sm" variant="destructive" onClick={confirmNao} disabled={mut.isPending}>Confirmar</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
