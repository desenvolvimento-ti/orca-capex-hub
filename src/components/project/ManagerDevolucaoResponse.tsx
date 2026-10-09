import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Check, RefreshCw } from "lucide-react";
import { formatBRL, parseBRL } from "@/lib/labels";

/**
 * Etapa 2 — Resposta do gestor à devolução com ajuste de valor.
 * Usa a RPC `responder_devolucao_pre` — duas ações:
 *  - aceitar     → aguardando_documentacao (adota o valor sugerido pela Diretoria)
 *  - renegociar  → aguardando_diretoria_prev (propõe novo valor + comentário)
 */
export function ManagerDevolucaoResponse({
  projectId,
  estimatedTotal,
  suggestedAmount,
}: {
  projectId: string;
  estimatedTotal: number | null;
  suggestedAmount: number | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newValueText, setNewValueText] = useState(
    estimatedTotal != null ? Number(estimatedTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""
  );
  const [comment, setComment] = useState("");

  const mut = useMutation({
    mutationFn: async ({
      acao, novoValor, comentario,
    }: { acao: "aceitar" | "renegociar"; novoValor: number | null; comentario: string }) => {
      const { error } = await supabase.rpc("responder_devolucao_pre", {
        p_project_id: projectId,
        p_acao: acao,
        p_novo_valor: novoValor as unknown as number,
        p_comentario: comentario,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.acao === "aceitar" ? "Valor aceito — projeto segue para orçamentação" : "Renegociação enviada à Diretoria");
      setOpen(false);
      setComment("");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["history", projectId] });
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/40">
        <div className="font-medium text-amber-900 dark:text-amber-200">
          Diretoria sugeriu ajuste de valor
        </div>
        <div className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
          Solicitado: <strong>{formatBRL(estimatedTotal ?? 0)}</strong> · Sugerido: <strong>{formatBRL(suggestedAmount ?? 0)}</strong>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => mut.mutate({ acao: "aceitar", novoValor: null, comentario: "" })}
          disabled={mut.isPending}
        >
          <Check className="mr-1 h-4 w-4" />
          Aceitar {formatBRL(suggestedAmount ?? 0)}
        </Button>

        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setComment(""); }}>
          <PopoverTrigger asChild>
            <Button variant="outline" disabled={mut.isPending}>
              <RefreshCw className="mr-1 h-4 w-4" /> Renegociar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <div className="text-sm font-medium">Propor novo valor</div>
              <p className="text-xs text-muted-foreground">
                O projeto volta à Diretoria com o novo valor e sua justificativa.
              </p>
              <div>
                <Label htmlFor="new-val">Novo valor proposto (R$) <span className="text-destructive">*</span></Label>
                <Input id="new-val" inputMode="decimal" value={newValueText} onChange={(e) => setNewValueText(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Comentário <span className="text-destructive">*</span></Label>
                <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Justifique o novo valor…" />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setComment(""); }}>Cancelar</Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const v = parseBRL(newValueText);
                    if (v <= 0) return toast.error("Informe o novo valor.");
                    if (!comment.trim()) return toast.error("Justifique a renegociação.");
                    mut.mutate({ acao: "renegociar", novoValor: v, comentario: comment.trim() });
                  }}
                  disabled={mut.isPending}
                >
                  Enviar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
