import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/labels";
import type { MonthRow } from "@/lib/execution";

const lbl = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`;

export function CurveChart({ rows, height = 260 }: { rows: MonthRow[]; height?: number }) {
  if (!rows.length) return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Sem cronograma ou realizado para exibir.</div>;
  const data = rows.map((r) => ({ ...r, label: lbl(r.month) }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="m" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <YAxis yAxisId="a" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v: number) => formatBRL(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="m" dataKey="planned" name="Previsto no mês" fill="var(--color-muted-foreground, #94a3b8)" fillOpacity={0.35} />
          <Bar yAxisId="m" dataKey="actual" name="Realizado no mês" fill="var(--color-primary, #2563eb)" fillOpacity={0.8} />
          <Line yAxisId="a" type="monotone" dataKey="plannedAcc" name="Previsto acumulado" stroke="#64748b" strokeDasharray="5 4" dot={false} />
          <Line yAxisId="a" type="monotone" dataKey="actualAcc" name="Realizado acumulado" stroke="#16a34a" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CurveTable({ rows }: { rows: MonthRow[] }) {
  const cur = new Date().toISOString().slice(0, 7) + "-01";
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Mês</th>
            <th className="px-3 py-2 text-right">Prev. estudo</th>
            <th className="px-3 py-2 text-right">Prev. execução</th>
            <th className="px-3 py-2 text-right">Real. estudo</th>
            <th className="px-3 py-2 text-right">Real. execução</th>
            <th className="px-3 py-2 text-right">Desvio mês</th>
            <th className="px-3 py-2 text-right">Prev. acum.</th>
            <th className="px-3 py-2 text-right">Real. acum.</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.month} className={r.month > cur ? "text-muted-foreground" : ""}>
              <td className="px-3 py-1.5">{r.month.slice(5, 7)}/{r.month.slice(0, 4)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatBRL(r.plannedStudy)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatBRL(r.plannedExec)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatBRL(r.actualStudy)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatBRL(r.actualExec)}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${r.month <= cur && r.diff > 0 ? "text-destructive" : ""}`}>{r.month <= cur ? formatBRL(r.diff) : "—"}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatBRL(r.plannedAcc)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums font-medium">{formatBRL(r.actualAcc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
