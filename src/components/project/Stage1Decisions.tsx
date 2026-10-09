import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  ["project", "audit-timeline", "manager-projects", "prioritization"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

/** FP&A: pré-análise — devolver para ajuste, pré-aprovar ou rejeitar. */
export function FpaPreAnaliseActions({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const act = useMutation({
    mutationFn: async (acao: "devolver" | "pre_aprovar" | "rejeitar") => {
      const { error } = await supabase.rpc("fpa_pre_analise", { p_project_id: projectId, p_acao: acao, p_comentario: comment });
      if (error) throw error;
      return acao;
    },
    onSuccess: (acao) => {
      toast.success(acao === "pre_aprovar" ? "Projeto pré-aprovado" : acao === "rejeitar" ? "Projeto rejeitado" : "Projeto devolvido para ajuste");
      setComment(""); invalidate(qc);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário (obrigatório para devolver ou rejeitar)" />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" className="text-destructive" onClick={() => act.mutate("rejeitar")} disabled={act.isPending}>Rejeitar</Button>
        <Button variant="outline" onClick={() => act.mutate("devolver")} disabled={act.isPending}>Devolver para ajuste</Button>
        <Button onClick={() => act.mutate("pre_aprovar")} disabled={act.isPending}>Pré-aprovar</Button>
      </div>
    </div>
  );
}

const RESULTS = [
  { v: "aprovado", l: "Aprovado" },
  { v: "estudo", l: "Aprovada apenas a verba de estudo/projeto" },
  { v: "nao_aprovado", l: "Não aprovado" },
];

/** FP&A: registrar e publicar o resultado da priorização de um projeto. */
export function PrioritizationActions({ projectId, current, currentJust }: { projectId: string; current: string | null; currentJust: string | null }) {
  const qc = useQueryClient();
  const [result, setResult] = useState(current ?? "");
  const [just, setJust] = useState(currentJust ?? "");
  const register = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!result) throw new Error("Selecione o resultado da priorização.");
      const { error } = await supabase.rpc("registrar_priorizacao", { p_project_id: projectId, p_resultado: result, p_justificativa: just });
      if (error) throw error;
      if (publish) {
        const { error: e2 } = await supabase.rpc("publicar_priorizacao", { p_project_ids: [projectId] });
        if (e2) throw e2;
      }
      return publish;
    },
    onSuccess: (pub) => { toast.success(pub ? "Resultado publicado. O gestor foi notificado." : "Resultado registrado (ainda não publicado)"); invalidate(qc); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {RESULTS.map((r) => (
          <label key={r.v} className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${result === r.v ? "border-primary bg-primary/5" : ""}`}>
            <input type="radio" name={`prio-${projectId}`} checked={result === r.v} onChange={() => setResult(r.v)} /> {r.l}
          </label>
        ))}
      </div>
      <Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Observação da diretoria (opcional)" />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => register.mutate(false)} disabled={register.isPending}>Registrar sem publicar</Button>
        <Button onClick={() => register.mutate(true)} disabled={register.isPending}>Registrar e publicar</Button>
      </div>
    </div>
  );
}
