import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { formatBRL } from "@/lib/labels";

/**
 * Etapa 3 · Decisão final da Diretoria.
 * Usa a RPC `decisao_diretoria_final`:
 *  - aprovar  → em_execucao (libera o valor e destrava execução)
 *  - reprovar → reprovado_final
 */
export function DirectoriaFinalActions({
  projectId,
  approvedAmount,
  size = "sm",
  onDone,
}: {
  projectId: string;
  approvedAmount: number | null;
  size?: "sm" | "default";
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [openKind, setOpenKind] = useState<"aprovar" | "reprovar" | null>(null);
  const [comment, setComment] = useState("");

  const mut = useMutation({
    mutationFn: async ({ acao, justificativa }: { acao: "aprovar" | "reprovar"; justificativa: string }) => {
      const { error } = await supabase.rpc("decisao_diretoria_final", {
        p_project_id: projectId,
        p_acao: acao,
        p_justificativa: justificativa,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.acao === "aprovar" ? "Projeto aprovado — liberado para execução" : "Projeto reprovado");
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

  const confirmAprovar = () => {
    mut.mutate({ acao: "aprovar", justificativa: comment.trim() });
  };
  const confirmReprovar = () => {
    if (!comment.trim()) return toast.error("Informe uma justificativa.");
    mut.mutate({ acao: "reprovar", justificativa: comment.trim() });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={openKind === "aprovar"} onOpenChange={(o) => { setOpenKind(o ? "aprovar" : null); if (!o) setComment(""); }}>
        <PopoverTrigger asChild>
          <Button size={size} disabled={mut.isPending}>
            <Check className="mr-1 h-4 w-4" /> Aprovar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <div className="text-sm font-medium">Aprovação final</div>
            <p className="text-xs text-muted-foreground">
              Libera o valor {approvedAmount != null && <>de <span className="font-medium">{formatBRL(approvedAmount)}</span></>} para execução do projeto.
            </p>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário (opcional)" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setOpenKind(null); setComment(""); }}>Cancelar</Button>
              <Button size="sm" onClick={confirmAprovar} disabled={mut.isPending}>Confirmar aprovação</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={openKind === "reprovar"} onOpenChange={(o) => { setOpenKind(o ? "reprovar" : null); if (!o) setComment(""); }}>
        <PopoverTrigger asChild>
          <Button size={size} variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={mut.isPending}>
            <X className="mr-1 h-4 w-4" /> Reprovar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <div className="text-sm font-medium">Reprovar projeto</div>
            <p className="text-xs text-muted-foreground">Decisão final neste ciclo.</p>
            <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Justificativa (obrigatória)" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setOpenKind(null); setComment(""); }}>Cancelar</Button>
              <Button size="sm" variant="destructive" onClick={confirmReprovar} disabled={mut.isPending}>Confirmar reprovação</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
