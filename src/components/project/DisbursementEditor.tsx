import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatBRL, monthsBetween, parseBRL } from "@/lib/labels";

export type DisbRow = { period: string; amount: number };

export function DisbursementEditor({
  startDate,
  endDate,
  value,
  onChange,
  readOnly,
}: {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  value: DisbRow[];
  onChange?: (rows: DisbRow[]) => void;
  readOnly?: boolean;
}) {
  const months = useMemo(() => monthsBetween(startDate, endDate), [startDate, endDate]);
  const valueMap = useMemo(() => {
    const m = new Map<string, number>();
    value.forEach((r) => m.set(r.period, Number(r.amount) || 0));
    return m;
  }, [value]);

  const [text, setText] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    months.forEach((m) => {
      const v = valueMap.get(m.iso) ?? 0;
      next[m.iso] = v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
    });
    setText(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, JSON.stringify(value)]);

  const total = months.reduce((s, m) => s + (parseBRL(text[m.iso] ?? "") || 0), 0);

  const update = (iso: string, raw: string) => {
    const t = { ...text, [iso]: raw };
    setText(t);
    onChange?.(months.map((m) => ({ period: m.iso, amount: parseBRL(t[m.iso] ?? "") })).filter((r) => r.amount > 0));
  };

  if (!startDate || !endDate) {
    return <div className="text-xs text-muted-foreground">Informe as datas para gerar o cronograma mensal.</div>;
  }
  if (months.length === 0) {
    return <div className="text-xs text-destructive">Intervalo de datas inválido.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Mês</th>
            <th className="px-3 py-2 text-right">Valor (R$)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {months.map((m) => (
            <tr key={m.iso}>
              <td className="px-3 py-2 capitalize">{m.label}</td>
              <td className="px-3 py-2 text-right">
                {readOnly ? (
                  <span className="tabular-nums">{formatBRL(valueMap.get(m.iso) ?? 0)}</span>
                ) : (
                  <Input
                    inputMode="decimal"
                    className="h-8 text-right tabular-nums"
                    value={text[m.iso] ?? ""}
                    onChange={(e) => update(m.iso, e.target.value)}
                    placeholder="0,00"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/30">
          <tr>
            <td className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatBRL(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
