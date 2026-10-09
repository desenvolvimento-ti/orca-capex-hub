import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send } from "lucide-react";

/**
 * Etapa 3 · FP&A encaminha o projeto (com documentação já submetida) para a Diretoria
 * para aprovação final. Chama a RPC `encaminhar_para_diretoria_final`.
 */
export function FpaEncaminharFinal({ projectId }: { projectId: string }) {
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("encaminhar_para_diretoria_final", { p_project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Encaminhado à Diretoria para aprovação final");
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
        A documentação está completa e o orçamento consolidado. Encaminhe à Diretoria para a decisão final.
      </p>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">
        <Send className="mr-1 h-4 w-4" />
        {mut.isPending ? "Encaminhando…" : "Encaminhar à Diretoria"}
      </Button>
    </div>
  );
}
