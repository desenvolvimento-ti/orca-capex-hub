import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatBRL, parseBRL } from "@/lib/labels";

const APPROVED = ["aprovado_final", "em_execucao", "concluido"];
const STUDY_RELEASED = ["em_projeto_firme", "devolvido_orc", "em_validacao_execucao", "estudo_concluido"];

export function useCeiling() {
  return useQuery({
    queryKey: ["investment-ceiling"],
    queryFn: async () => {
      const [{ data: hist, error }, { data: projs, error: e2 }] = await Promise.all([
        supabase.from("investment_ceiling_history").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("id, status, confirmed_total, study_amount, firm_study_amount")
          .in("status", [...APPROVED, ...STUDY_RELEASED] as never),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      const committed = (projs ?? []).reduce((s, p) => s + Number(
        APPROVED.includes(p.status) ? p.confirmed_total ?? 0 : p.study_amount ?? 0), 0);
      const current = hist?.[0] ? Number(hist[0].amount) : null;
      return { history: hist ?? [], current, committed, slack: current == null ? null : current - committed };
    },
  });
}

export function CeilingPanel() {
  const { isRealFpa } = useAuth();
  const qc = useQueryClient();
  const { data } = useCeiling();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [showHist, setShowHist] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const v = parseBRL(amount);
      if (!v || v <= 0) throw new Error("Informe o novo valor do teto.");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("investment_ceiling_history").insert({ amount: v, reason: reason.trim() || null, created_by: u.user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Teto atualizado"); setAmount(""); setReason(""); qc.invalidateQueries({ queryKey: ["investment-ceiling"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold">Teto de investimento</h2>
      <p className="text-xs text-muted-foreground">Dinâmico: pode subir ou cair ao longo do ano conforme o resultado da empresa.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Teto vigente" value={data?.current == null ? "Não definido" : formatBRL(data.current)} />
        <Stat label="Comprometido" value={formatBRL(data?.committed ?? 0)} hint="Execuções aprovadas + verbas de estudo liberadas" />
        <Stat label="Folga" value={data?.slack == null ? "—" : formatBRL(data.slack)} tone={data?.slack != null && data.slack < 0 ? "danger" : undefined} />
      </div>
      {isRealFpa && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <div><Label htmlFor="ceil-amount">Novo teto (R$)</Label><Input id="ceil-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
          <div><Label htmlFor="ceil-reason">Motivo</Label><Input id="ceil-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: revisão do resultado do trimestre" /></div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Atualizar teto</Button>
        </div>
      )}
      {(data?.history.length ?? 0) > 0 && (
        <div className="mt-4">
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowHist((v) => !v)}>{showHist ? "Ocultar histórico" : "Ver histórico do teto"}</button>
          {showHist && (
            <ul className="mt-2 divide-y rounded-md border text-sm">
              {data!.history.map((h) => (
                <li key={h.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>{new Date(h.created_at).toLocaleString("pt-BR")} · {h.reason ?? "—"}</span>
                  <span className="font-medium tabular-nums">{formatBRL(h.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
