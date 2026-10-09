import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { STATUS_LABEL } from "@/lib/labels";

const STAGE_ORDER: { key: string; label: string }[] = [
  { key: "submetido_intake", label: "Intake" },
  { key: "em_revisao_fpa", label: "Revisão FP&A" },
  { key: "aguardando_diretor", label: "Diretor" },
  { key: "aguardando_ceo", label: "CEO" },
  { key: "liberado", label: "Liberado" },
  { key: "reprovado", label: "Reprovado" },
  { key: "devolvido_revisao", label: "Devolvido" },
];

const COLOR: Record<string, string> = {
  submetido_intake: "hsl(var(--primary))",
  em_revisao_fpa: "hsl(var(--primary))",
  aguardando_diretor: "hsl(var(--warning, 38 92% 50%))",
  aguardando_ceo: "hsl(var(--warning, 38 92% 50%))",
  liberado: "hsl(var(--success, 142 70% 45%))",
  reprovado: "hsl(var(--destructive))",
  devolvido_revisao: "hsl(var(--destructive))",
};

export function CycleFunnelPanel({ cycleId }: { cycleId: string | null }) {
  const { data: funnel = [] } = useQuery({
    queryKey: ["funnel", cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cycle_funnel", { p_cycle_id: cycleId! });
      if (error) throw error;
      return data as Array<{ status: string; total: number }>;
    },
  });

  const { data: heatmap = [] } = useQuery({
    queryKey: ["heatmap", cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("status_avg_days", { p_cycle_id: cycleId! });
      if (error) throw error;
      return data as Array<{ status: string; avg_days: number; samples: number }>;
    },
  });

  const funnelData = STAGE_ORDER.map((s) => {
    const row = funnel.find((f) => f.status === s.key);
    return { name: s.label, key: s.key, total: row ? Number(row.total) : 0 };
  });

  const heatData = heatmap
    .filter((h) => STATUS_LABEL[h.status as keyof typeof STATUS_LABEL])
    .map((h) => ({
      name: STATUS_LABEL[h.status as keyof typeof STATUS_LABEL] ?? h.status,
      key: h.status,
      avg: Number(h.avg_days ?? 0),
      samples: Number(h.samples ?? 0),
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  if (!cycleId) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Funil do ciclo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} fontSize={12} />
                <Tooltip />
                <Bar dataKey="total">
                  {funnelData.map((d) => <Cell key={d.key} fill={COLOR[d.key] ?? "hsl(var(--primary))"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tempo médio por status (dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={heatData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={140} fontSize={11} />
                <Tooltip formatter={(v: number) => `${v} dias`} />
                <Bar dataKey="avg" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {heatData.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">Sem histórico suficiente.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
