import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/labels";

type Usage = {
  area_id: string; area_name: string;
  budget_amount: number; warning_threshold: number;
  planned_amount: number; approved_amount: number; released_amount: number;
  projects_count: number;
};

export function AreaBudgetPanel({ cycleId }: { cycleId: string | null }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["area-budget-usage", cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("area_budget_usage", { p_cycle_id: cycleId! });
      if (error) throw error;
      return (data ?? []) as Usage[];
    },
  });

  if (!cycleId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Orçamento por área</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem áreas cadastradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Área</th>
                  <th className="py-2 pr-3 text-right">Orçamento</th>
                  <th className="py-2 pr-3 text-right">Planejado</th>
                  <th className="py-2 pr-3 text-right">Aprovado</th>
                  <th className="py-2 pr-3 text-right">Liberado</th>
                  <th className="py-2 pr-3 w-52">Uso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const budget = Number(r.budget_amount || 0);
                  const rel = Number(r.released_amount || 0);
                  const pct = budget > 0 ? Math.min(200, (rel / budget) * 100) : 0;
                  const t = Number(r.warning_threshold || 0.8) * 100;
                  const over = budget > 0 && rel > budget;
                  const warn = budget > 0 && !over && pct >= t;
                  const tone = over ? "text-destructive" : warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
                  return (
                    <tr key={r.area_id}>
                      <td className="py-2 pr-3 font-medium">{r.area_name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{budget > 0 ? formatBRL(budget) : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(r.planned_amount)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(r.approved_amount)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(rel)}</td>
                      <td className="py-2 pr-3">
                        {budget > 0 ? (
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(100, pct)} className="h-2" />
                            <span className={`text-xs tabular-nums ${tone}`}>
                              {pct.toFixed(0)}%
                              {(warn || over) && <AlertTriangle className="ml-1 inline h-3 w-3" />}
                            </span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">sem orçamento</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
