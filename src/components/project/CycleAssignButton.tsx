import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDateBR, cyclePeriodFromDates } from "@/lib/labels";

/** Lista ciclos com período de Submissão aberto e permite direcionar o projeto. */
export function CycleAssignButton({ projectId, onAssigned }: { projectId: string; onAssigned?: () => void }) {
  const qc = useQueryClient();
  const [cycleId, setCycleId] = useState<string>("");

  const { data: openCycles = [] } = useQuery({
    queryKey: ["open-cycles-for-assign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cycles")
        .select("id, name, year, archived_at, submission_start, submission_end, analysis_start, analysis_end");
      if (error) throw error;
      return (data ?? [])
        .filter((c) => !c.archived_at && cyclePeriodFromDates(c) === "submissao")
        .map((c) => ({ id: c.id, name: c.name, year: c.year, closes_at: c.submission_end }));
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!cycleId) throw new Error("Escolha um ciclo.");
      const { error } = await supabase.rpc("submit_project_to_cycle" as never, {
        p_project_id: projectId,
        p_cycle_id: cycleId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto direcionado ao ciclo");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["history", projectId] });
      onAssigned?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (openCycles.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Nenhuma janela de Submissão aberta no momento. O projeto fica no seu hub até a próxima janela.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-primary/5 p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Direcionar para ciclo</div>
      <Select value={cycleId} onValueChange={setCycleId}>
        <SelectTrigger><SelectValue placeholder="Escolha um ciclo com janela aberta…" /></SelectTrigger>
        <SelectContent>
          {openCycles.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} ({c.year}) — Submissão
              {c.closes_at && ` · fecha ${formatDateBR(c.closes_at)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" className="w-full" disabled={!cycleId || submit.isPending} onClick={() => submit.mutate()}>
        {submit.isPending ? "Direcionando…" : "Submeter ao ciclo"}
      </Button>
    </div>
  );
}
