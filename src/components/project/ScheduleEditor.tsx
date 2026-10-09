import { useEffect, useMemo, useState } from "react";
import { MoneyInput } from "@/components/ui/money-input";
import { formatBRL, monthsBetween, parseBRL } from "@/lib/labels";
import { scheduleMonths, type ScheduleRow, type Phase } from "@/lib/project-rules";

export { scheduleMonths };

const key = (iso: string, phase: Phase) => `${phase}:${iso}`;

export function ScheduleEditor({
  studyStart, execStart, execMonths, value, onChange, readOnly, studyTarget, execTarget, compare, zeroMonths, onZeroMonthsChange,
}: {
  studyStart?: string | null;
  execStart?: string | null;
  execMonths?: number | null;
  value: ScheduleRow[];
  onChange?: (rows: ScheduleRow[]) => void;
  readOnly?: boolean;
  studyTarget: number;
  execTarget: number;
  /** Cronograma de referência (ex.: indicativo) exibido ao lado. */
  compare?: ScheduleRow[];
  /** Meses confirmados como sem desembolso (chave phase:iso). Quando informado, exibe a coluna de confirmação. */
  zeroMonths?: string[];
  onZeroMonthsChange?: (keys: string[]) => void;
}) {
  const zeroSet = new Set(zeroMonths ?? []);
  const showZero = !!zeroMonths;
  const months = useMemo(() => scheduleMonths(studyStart, execStart, execMonths), [studyStart, execStart, execMonths]);
  const byPeriod = useMemo(() => new Map(value.map((r) => [key(r.period, r.phase), Number(r.amount) || 0])), [value]);
  const cmpByPeriod = useMemo(() => new Map((compare ?? []).map((r) => [key(r.period, r.phase), Number(r.amount) || 0])), [compare]);
  const [text, setText] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    months.forEach((m) => {
      const v = byPeriod.get(key(m.iso, m.phase)) ?? 0;
      next[key(m.iso, m.phase)] = v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
    });
    setText(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months.map((m) => key(m.iso, m.phase)).join(","), JSON.stringify(value)]);

  const emit = (t: Record<string, string>) =>
    onChange?.(months.map((m) => ({ period: m.iso, phase: m.phase, amount: parseBRL(t[key(m.iso, m.phase)] ?? "") })).filter((r) => r.amount > 0));

  if (months.length === 0) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Informe o início do planejamento, o início da execução e o prazo de execução para gerar os meses do cronograma.</div>;
  }

  const cur = (m: { iso: string; phase: Phase }) => (readOnly ? byPeriod.get(key(m.iso, m.phase)) ?? 0 : parseBRL(text[key(m.iso, m.phase)] ?? ""));
  const sStudy = months.filter((m) => m.phase === "planejamento").reduce((s, m) => s + cur(m), 0);
  const sExec = months.filter((m) => m.phase === "execucao").reduce((s, m) => s + cur(m), 0);
  const studyMonths = months.filter((m) => m.phase === "planejamento").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-primary/20 ring-1 ring-primary/40" /> Meses de planejamento</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-success/20 ring-1 ring-success/40" /> Meses de execução</span>
      </div>
      {studyTarget > 0 && studyMonths === 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">Há verba de planejamento, mas nenhum mês de planejamento: o início do planejamento precisa ser anterior ao início da execução.</div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Mês</th>
              <th className="px-3 py-2">Natureza</th>
              {compare && <th className="px-3 py-2 text-right">Indicativo</th>}
              <th className="px-3 py-2 text-right">Valor</th>
              {showZero && <th className="px-3 py-2 text-center">Sem desembolso previsto</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {months.map((m) => {
              const k = key(m.iso, m.phase);
              const unconfirmed = showZero && cur(m) <= 0 && !zeroSet.has(k);
              return (
              <tr key={k} className={unconfirmed ? "bg-warning/15" : m.phase === "planejamento" ? "bg-primary/5" : "bg-success/5"}>
                <td className="px-3 py-1.5">
                  {m.label}
                  {unconfirmed && <div className="text-[11px] text-warning-foreground">Sem valor: preencha ou confirme</div>}
                </td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{m.phase === "planejamento" ? "Planejamento" : "Execução"}</td>
                {compare && <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatBRL(cmpByPeriod.get(key(m.iso, m.phase)) ?? 0)}</td>}
                <td className="px-3 py-1.5 text-right">
                  {readOnly ? (
                    <span className="tabular-nums">{formatBRL(byPeriod.get(key(m.iso, m.phase)) ?? 0)}</span>
                  ) : (
                    <div className="ml-auto max-w-44">
                      <MoneyInput
                        aria-label={`Valor de ${m.phase === "planejamento" ? "planejamento" : "execução"} em ${m.label}`}
                        className="h-8"
                        value={text[key(m.iso, m.phase)] ?? ""}
                        onChange={(value) => { const t = { ...text, [key(m.iso, m.phase)]: value }; setText(t); emit(t); }}
                      />
                    </div>
                  )}
                </td>
                {showZero && (
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      aria-label={`Sem desembolso previsto em ${m.label}`}
                      disabled={readOnly || cur(m) > 0}
                      checked={zeroSet.has(k) && cur(m) <= 0}
                      onChange={(e) => {
                        const next = new Set(zeroSet);
                        if (e.target.checked) next.add(k); else next.delete(k);
                        onZeroMonthsChange?.([...next]);
                      }}
                    />
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Total label="Soma dos meses de planejamento" value={sStudy} target={studyTarget} />
        <Total label="Soma dos meses de execução" value={sExec} target={execTarget} />
      </div>
    </div>
  );
}

function Total({ label, value, target }: { label: string; value: number; target: number }) {
  const ok = Math.abs(value - target) <= 0.01;
  return (
    <div className={`rounded-md border p-2 ${ok ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/10"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{formatBRL(value)} <span className="text-xs text-muted-foreground">de {formatBRL(target)}</span></div>
      {!ok && <div className="text-xs">Diferença de {formatBRL(target - value)}</div>}
    </div>
  );
}
