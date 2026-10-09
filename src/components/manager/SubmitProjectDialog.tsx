import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, AlertTriangle } from "lucide-react";

/** Submissão a partir da linha do painel. Pendências já calculadas na lista. */
export function SubmitProjectDialog({
  open, onOpenChange, project,
}: { open: boolean; onOpenChange: (o: boolean) => void; project: { id: string; name: string; pending: string[] } | null }) {
  const qc = useQueryClient();
  const pending = project?.pending ?? [];
  const blocked = pending.length > 0;

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submeter_projeto", { p_project_id: project!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto submetido. Ele segue para a pré-análise do FP&A.");
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
      qc.invalidateQueries({ queryKey: ["project", project!.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {blocked ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Não é possível submeter</DialogTitle>
              <DialogDescription>O projeto "{project?.name}" ainda tem pendências. Complete o que falta:</DialogDescription>
            </DialogHeader>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">{pending.map((m) => <li key={m}>{m}</li>)}</ul>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
              {project && (
                <Button asChild onClick={() => onOpenChange(false)}>
                  <Link to="/app/projects/$id" params={{ id: project.id }}>Completar cadastro</Link>
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Confirmar submissão</DialogTitle>
              <DialogDescription>Deseja confirmar a submissão do projeto "{project?.name}"?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
                {submit.isPending ? "Enviando…" : "Confirmar submissão"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
