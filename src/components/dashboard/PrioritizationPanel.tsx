import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL } from "@/lib/labels";

const RESULT_LABEL: Record<string, string> = { aprovado: "Aprovado", estudo: "Só verba de estudo", nao_aprovado: "Não aprovado" };

export function PrioritizationPanel() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["prioritization"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects")
        .select("id, code, name, study_amount, execution_amount, estimated_total, prioritization_result, areas:areas!projects_area_id_fkey(name)")
        .eq("status", "aguardando_diretoria_prev").order("submitted_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setResult = useMutation({
    mutationFn: async ({ id, result }: { id: string; result: string | null }) => {
      const { error } = await supabase.rpc("registrar_priorizacao", { p_project_id: id, p_resultado: result as string, p_justificativa: "" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prioritization"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = data.filter((p) => p.prioritization_result);
  const publish = useMutation({
    mutationFn: async () => {
      const { data: n, error } = await supabase.rpc("publicar_priorizacao", { p_project_ids: ready.map((p) => p.id) });
      if (error) throw error;
      return n;
    },
    onSuccess: (n) => {
      toast.success(`${n} resultado(s) publicados. Os gestores foram notificados.`);
      ["prioritization", "manager-projects", "project"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Priorização da diretoria</h2>
          <p className="text-xs text-muted-foreground">Registre o resultado de cada projeto e publique para notificar os gestores.</p>
        </div>
        <Button onClick={() => publish.mutate()} disabled={!ready.length || publish.isPending}>
          Publicar resultados ({ready.length})
        </Button>
      </div>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum projeto em priorização.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2">Projeto</th><th className="px-3 py-2">Área</th><th className="px-3 py-2 text-right">Estudo</th><th className="px-3 py-2 text-right">Execução</th><th className="px-3 py-2">Resultado</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.map((p: any) => (
                <tr key={p.id}>
                  <td className="px-3 py-2"><Link to="/app/projects/$id" params={{ id: p.id }} className="text-primary hover:underline">{p.code} · {p.name}</Link></td>
                  <td className="px-3 py-2 text-muted-foreground">{p.areas?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(p.study_amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(p.execution_amount)}</td>
                  <td className="px-3 py-2">
                    <Select value={p.prioritization_result ?? "none"} onValueChange={(v) => setResult.mutate({ id: p.id, result: v === "none" ? null : v })}>
                      <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">A definir</SelectItem>
                        {Object.entries(RESULT_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
