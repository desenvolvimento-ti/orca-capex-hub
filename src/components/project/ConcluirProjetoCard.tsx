import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

/**
 * Etapa 4 · Concluir projeto em execução. Chama a RPC `concluir_projeto`
 * (permitida ao gestor responsável ou FP&A).
 */
export function ConcluirProjetoCard({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("concluir_projeto", { p_project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto concluído");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["history", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
      qc.invalidateQueries({ queryKey: ["execution-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Marque o projeto como concluído quando a execução física-financeira estiver finalizada.
      </p>
      <Button
        onClick={() => confirm("Confirmar conclusão do projeto? Esta ação encerra a execução.") && mut.mutate()}
        disabled={mut.isPending}
        className="w-full"
        variant="outline"
      >
        <CheckCircle2 className="mr-1 h-4 w-4" />
        {mut.isPending ? "Concluindo…" : "Concluir projeto"}
      </Button>
    </div>
  );
}
