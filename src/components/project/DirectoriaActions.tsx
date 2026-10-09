import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Check, RotateCcw, X } from "lucide-react";

/**
 * Botões inline Aprovar / Devolver / Reprovar usados pela Visão Diretoria e
 * pelo detalhe do projeto. Usa a RPC `decisao_diretoria` que valida papel
 * e status no servidor.
 */
export function DirectoriaActions({
  projectId,
  size = "sm",
  onDone,
}: {
  projectId: string;
  size?: "sm" | "default";
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [openKind, setOpenKind] = useState<"devolver" | "reprovar" | null>(null);
  const [comment, setComment] = useState("");

  const mut = useMutation({
    mutationFn: async ({ acao, justificativa }: { acao: "aprovar" | "devolver" | "reprovar"; justificativa: string }) => {
      const { error } = await supabase.rpc("decisao_diretoria", {
        p_project_id: projectId,
        p_acao: acao,
        p_justificativa: justificativa,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      const msg = vars.acao === "aprovar" ? "Projeto aprovado" : vars.acao === "devolver" ? "Devolvido ao gestor" : "Projeto reprovado";
      toast.success(msg);
      setOpenKind(null);
      setComment("");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["history", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["diretoria-projects"] });
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitJustified = (acao: "devolver" | "reprovar") => {
    if (!comment.trim()) {
      toast.error("Informe uma justificativa.");
      return;
    }
    mut.mutate({ acao, justificativa: comment.trim() });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size={size}
        onClick={() => mut.mutate({ acao: "aprovar", justificativa: "" })}
        disabled={mut.isPending}
      >
        <Check className="mr-1 h-4 w-4" /> Aprovar
      </Button>

      {(["devolver", "reprovar"] as const).map((kind) => (
        <Popover
          key={kind}
          open={openKind === kind}
          onOpenChange={(o) => {
            setOpenKind(o ? kind : null);
            if (!o) setComment("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              size={size}
              variant={kind === "devolver" ? "outline" : "ghost"}
              className={kind === "reprovar" ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : ""}
              disabled={mut.isPending}
            >
              {kind === "devolver" ? <RotateCcw className="mr-1 h-4 w-4" /> : <X className="mr-1 h-4 w-4" />}
              {kind === "devolver" ? "Devolver" : "Reprovar"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {kind === "devolver" ? "Devolver para Revisão" : "Reprovar projeto"}
              </div>
              <p className="text-xs text-muted-foreground">
                {kind === "devolver"
                  ? "O gestor poderá reforçar a documentação e ressubmeter pelo FP&A."
                  : "Decisão final neste ciclo. O gestor não poderá ressubmeter sem abrir um novo projeto."}
              </p>
              <Textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Justificativa (obrigatória)"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setOpenKind(null); setComment(""); }}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant={kind === "reprovar" ? "destructive" : "default"}
                  onClick={() => submitJustified(kind)}
                  disabled={mut.isPending}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
