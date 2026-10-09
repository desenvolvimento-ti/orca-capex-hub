import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X } from "lucide-react";

type Action = "assign_cycle" | "back_to_hub" | "mark_in_analysis";

export function BatchActionsBar({
  selected,
  onClear,
}: {
  selected: { id: string; status: string; cycle_id: string | null }[];
  onClear: () => void;
}) {
  const { profile, isRealFpa } = useAuth();
  const qc = useQueryClient();
  const [cycleId, setCycleId] = useState<string>("");

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles-open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cycles")
        .select("id, name, year, is_active, archived_at")
        .is("archived_at", null)
        .order("year", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isRealFpa,
  });

  const run = useMutation({
    mutationFn: async (action: Action) => {
      if (!profile) throw new Error("Sessão expirada");
      if (action === "assign_cycle" && !cycleId) throw new Error("Selecione um ciclo");

      let updated = 0;
      let skipped = 0;
      for (const p of selected) {
        try {
          if (action === "assign_cycle") {
            // Sem código novo aqui — gen_project_code dispara para projetos sem code.
            const { error } = await supabase
              .from("projects")
              .update({ cycle_id: cycleId, status: "submetido_intake" })
              .eq("id", p.id);
            if (error) throw error;
            await supabase.from("project_status_history").insert({
              project_id: p.id, from_status: p.status as never, to_status: "submetido_intake",
              actor_id: profile.id, actor_role: "fpa", comment: "Atribuído ao ciclo (em lote)",
            });
            updated++;
          } else if (action === "back_to_hub") {
            const { error } = await supabase
              .from("projects")
              .update({ cycle_id: null, code: null, status: "no_hub", submitted_at: null, decided_at: null })
              .eq("id", p.id);
            if (error) throw error;
            await supabase.from("project_status_history").insert({
              project_id: p.id, from_status: p.status as never, to_status: "no_hub",
              actor_id: profile.id, actor_role: "fpa", comment: "Movido ao hub (em lote)",
            });
            updated++;
          } else if (action === "mark_in_analysis") {
            if (!["submetido_intake", "submetido_documentacao", "devolvido_revisao"].includes(p.status)) {
              skipped++; continue;
            }
            const { error } = await supabase
              .from("projects")
              .update({ status: "em_revisao_fpa" })
              .eq("id", p.id);
            if (error) throw error;
            await supabase.from("project_status_history").insert({
              project_id: p.id, from_status: p.status as never, to_status: "em_revisao_fpa",
              actor_id: profile.id, actor_role: "fpa", comment: "Marcado como em revisão FP&A (em lote)",
            });
            updated++;
          }
        } catch (e) {
          skipped++;
        }
      }
      return { updated, skipped };
    },
    onSuccess: ({ updated, skipped }) => {
      toast.success(`${updated} projeto(s) atualizado(s)`, {
        description: skipped > 0 ? `${skipped} ignorado(s) por status inválido` : undefined,
      });
      qc.invalidateQueries({ queryKey: ["projects-by-cycle-fpa"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["cycles"] });
      onClear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isRealFpa || selected.length === 0) return null;

  return (
    <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-lg">
      <span className="text-sm font-medium">{selected.length} selecionado(s)</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Atribuir ao ciclo…" /></SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({c.year}){c.is_active ? " · ativo" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!cycleId || run.isPending} onClick={() => run.mutate("assign_cycle")}>
            Atribuir
          </Button>
        </div>
        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate("mark_in_analysis")}>
          Em revisão FP&A
        </Button>
        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate("back_to_hub")}>
          Voltar ao Hub
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={run.isPending}>
          {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
