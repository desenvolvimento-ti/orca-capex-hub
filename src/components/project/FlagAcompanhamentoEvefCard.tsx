import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function FlagAcompanhamentoEvefCard({
  projectId,
  initial,
}: {
  projectId: string;
  initial: boolean;
}) {
  const qc = useQueryClient();
  const [checked, setChecked] = useState(!!initial);

  const mut = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("projects")
        .update({ flag_acompanhamento: next })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      toast.success(next ? "Projeto marcado para acompanhamento EVEF" : "Flag EVEF removida");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (e: unknown) => {
      setChecked((v) => !v);
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar flag");
    },
  });

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor="flag-evef" className="text-sm font-medium">
          Acompanhar EVEF
        </Label>
        <p className="text-xs text-muted-foreground">
          Inclui este projeto no relatório de acompanhamento pós-execução (análise de retorno em Excel).
        </p>
      </div>
      <Switch
        id="flag-evef"
        checked={checked}
        onCheckedChange={(v) => {
          setChecked(v);
          mut.mutate(v);
        }}
        disabled={mut.isPending}
      />
    </div>
  );
}
