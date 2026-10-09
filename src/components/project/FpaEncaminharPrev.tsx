import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send } from "lucide-react";

/**
 * Etapa 2 — FP&A encaminha o projeto (em_pre_analise_fpa) à Diretoria da área
 * para pré-aprovação. Usa a RPC `encaminhar_para_diretoria_prev`.
 */
export function FpaEncaminharPrev({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("encaminhar_para_diretoria_prev", { p_project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Encaminhado à Diretoria para pré-aprovação");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["history", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["diretoria-projects"] });
      qc.invalidateQueries({ queryKey: ["diretoria-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Etapa 2 — pré-análise FP&A. Ao encaminhar, a Diretoria da área decide pela pré-aprovação
        (ou devolve com ajuste de valor / não aprova).
      </p>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        <Send className="mr-1 h-4 w-4" /> Encaminhar à Diretoria (pré-aprovação)
      </Button>
    </div>
  );
}
