import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { parseBRL } from "@/lib/labels";

export function DeviationSettingsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["deviation-settings"],
    queryFn: async () => (await supabase.from("deviation_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [pct, setPct] = useState("20");
  const [min, setMin] = useState("5.000,00");
  useEffect(() => {
    if (data) { setPct(String(data.pct)); setMin(Number(data.min_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })); }
  }, [data]);
  const save = async () => {
    const { error } = await supabase.from("deviation_settings").upsert({ id: 1, pct: Number(pct.replace(",", ".")) || 0, min_amount: parseBRL(min), updated_at: new Date().toISOString() });
    if (error) toast.error(error.message); else { toast.success("Critério de desvio salvo"); qc.invalidateQueries({ queryKey: ["deviation-settings"] }); }
  };
  return (
    <div className="max-w-xl space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">Critério de desvio relevante</h2>
        <p className="text-sm text-muted-foreground">Um mês é sinalizado quando a diferença entre realizado e previsto ultrapassa os dois limites. Vale para as próximas importações e lançamentos.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Percentual mínimo (%)<Input value={pct} onChange={(e) => setPct(e.target.value)} /></label>
        <label className="text-sm">Valor mínimo (R$)<Input value={min} onChange={(e) => setMin(e.target.value)} /></label>
      </div>
      <Button onClick={save}>Salvar</Button>
    </div>
  );
}
