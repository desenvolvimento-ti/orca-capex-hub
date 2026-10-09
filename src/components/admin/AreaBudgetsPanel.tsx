import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { formatBRL, parseBRL } from "@/lib/labels";

type Area = { id: string; name: string };
type Cycle = { id: string; name: string; year: number };
type Budget = {
  id: string; area_id: string; cycle_id: string;
  budget_amount: number; warning_threshold: number;
  notes: string | null;
  areas?: Area | null; cycles?: Cycle | null;
};

export function AreaBudgetsPanel() {
  const qc = useQueryClient();
  const [areaId, setAreaId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [amount, setAmount] = useState("");
  const [threshold, setThreshold] = useState("80");
  const [notes, setNotes] = useState("");

  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data } = await supabase.from("areas").select("id, name").order("name");
      return (data ?? []) as Area[];
    },
  });
  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("cycles").select("id, name, year").order("year", { ascending: false });
      return (data ?? []) as Cycle[];
    },
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["area-budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("area_budgets")
        .select("id, area_id, cycle_id, budget_amount, warning_threshold, notes, areas(id,name), cycles(id,name,year)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Budget[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!areaId || !cycleId) throw new Error("Selecione área e ciclo.");
      const value = parseBRL(amount);
      if (!(value > 0)) throw new Error("Informe um valor de orçamento.");
      const t = Number(threshold.replace(",", ".")) / 100;
      if (!(t > 0 && t <= 1)) throw new Error("Limite de alerta deve estar entre 1 e 100.");
      const { error } = await supabase.from("area_budgets").upsert({
        area_id: areaId, cycle_id: cycleId,
        budget_amount: value, warning_threshold: t,
        notes: notes.trim() || null,
      } as any, { onConflict: "area_id,cycle_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orçamento salvo");
      setAmount(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["area-budgets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("area_budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orçamento removido");
      qc.invalidateQueries({ queryKey: ["area-budgets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const m = new Map<string, Budget[]>();
    budgets.forEach((b) => {
      const key = b.cycle_id;
      const arr = m.get(key) ?? []; arr.push(b); m.set(key, arr);
    });
    return m;
  }, [budgets]);

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-4">
        <div className="mb-3 text-sm font-medium">Definir orçamento por área/ciclo</div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
            <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger><SelectValue placeholder="Ciclo" /></SelectTrigger>
            <SelectContent>{cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.year})</SelectItem>)}</SelectContent>
          </Select>
          <Input inputMode="decimal" placeholder="Orçamento (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input inputMode="decimal" placeholder="Alerta (%)" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </div>
        <Textarea className="mt-3" placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {budgets.length === 0 ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Nenhum orçamento cadastrado ainda.
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([cid, items]) => {
            const cycle = items[0].cycles;
            return (
              <div key={cid} className="rounded-md border bg-card">
                <div className="border-b px-4 py-2 text-sm font-medium">
                  {cycle?.name} ({cycle?.year})
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Área</th>
                      <th className="px-3 py-2 text-right">Orçamento</th>
                      <th className="px-3 py-2 text-right">Alerta</th>
                      <th className="px-3 py-2">Observações</th>
                      <th className="w-10 px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((b) => (
                      <tr key={b.id}>
                        <td className="px-3 py-2">{b.areas?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatBRL(b.budget_amount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{Math.round(Number(b.warning_threshold) * 100)}%</td>
                        <td className="px-3 py-2 text-muted-foreground">{b.notes ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover orçamento?")) remove.mutate(b.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
