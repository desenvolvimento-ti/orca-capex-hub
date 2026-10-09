import { useEffect, useMemo, useRef, useState } from "react";
import { MoneyInput } from "@/components/ui/money-input";
import { formatBRL, parseBRL } from "@/lib/labels";
import { scheduleMonths } from "@/components/project/ScheduleEditor";
import type { Phase, ScheduleRow } from "@/lib/project-rules";

const key = (iso: string, phase: Phase) => `${phase}:${iso}`;
const fmt = (n: number) => (n ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
/** Célula inexistente no escopo: hachura diagonal nítida, sem texto. */
const HATCH = "bg-[repeating-linear-gradient(135deg,transparent_0,transparent_5px,var(--color-border)_5px,var(--color-border)_7px)]";
const monthLabel = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  const s = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).replace(".", "").replace(" de ", "/");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

type Row = { iso: string; phase: Phase; ind: number | null; planned: number | null; plannedEditable: boolean; label: string };

/**
 * Cronograma da Etapa 2 em dois blocos: Planejamento (indicativo congelado) e Execução
 * (indicativo alinhado por mês ordinal da execução). Hachura = dado inexistente no escopo.
 */
export function Stage2Schedule({
  studyStart, execStart, execMonths, indicative, firm, realized, onFirmChange, onRealizedChange, canEditFirm, canEditRealized, execTarget,
}: {
  studyStart?: string | null; execStart?: string | null; execMonths?: number | null;
  indicative: ScheduleRow[]; firm: ScheduleRow[]; realized: ScheduleRow[];
  onFirmChange?: (rows: ScheduleRow[]) => void; onRealizedChange?: (rows: ScheduleRow[]) => void;
  canEditFirm: boolean; canEditRealized: boolean; execTarget: number;
}) {
  const grid = useMemo(() => scheduleMonths(studyStart, execStart, execMonths), [studyStart, execStart, execMonths]);
  const execGrid = useMemo(() => grid.filter((m) => m.phase === "execucao"), [grid]);

  const fir = useMemo(() => new Map(firm.map((r) => [key(r.period, r.phase), Number(r.amount) || 0])), [firm]);
  const rea = useMemo(() => new Map(realized.map((r) => [key(r.period, r.phase), Number(r.amount) || 0])), [realized]);

  const planRows = useMemo<Row[]>(() => {
    const ind = new Map(indicative.filter((r) => r.phase === "planejamento").map((r) => [r.period, Number(r.amount) || 0]));
    const set = new Set<string>([...ind.keys(), ...grid.filter((m) => m.phase === "planejamento").map((m) => m.iso),
      ...realized.filter((r) => r.phase === "planejamento").map((r) => r.period)]);
    return [...set].sort().map((iso) => {
      const has = ind.has(iso);
      return { iso, phase: "planejamento" as Phase, ind: has ? ind.get(iso)! : null, planned: has ? ind.get(iso)! : null, plannedEditable: false, label: monthLabel(iso) };
    });
  }, [indicative, grid, realized]);

  const execRows = useMemo<Row[]>(() => {
    const indExec = indicative.filter((r) => r.phase === "execucao").sort((a, b) => a.period.localeCompare(b.period));
    const rows: Row[] = execGrid.map((m, i) => ({
      iso: m.iso, phase: "execucao", ind: i < indExec.length ? Number(indExec[i].amount) || 0 : null,
      planned: fir.get(key(m.iso, "execucao")) ?? 0, plannedEditable: true, label: `${monthLabel(m.iso)} · Mês ${i + 1}`,
    }));
    const inGrid = new Set(execGrid.map((m) => m.iso));
    realized.filter((r) => r.phase === "execucao" && !inGrid.has(r.period)).forEach((r) =>
      rows.push({ iso: r.period, phase: "execucao", ind: null, planned: null, plannedEditable: false, label: monthLabel(r.period) }));
    return rows.sort((a, b) => a.iso.localeCompare(b.iso));
  }, [indicative, execGrid, fir, realized]);

  // Ao deslocar a execução, os valores planejados acompanham a ordem do mês (Mês 1 continua Mês 1).
  const execKey = execGrid.map((m) => m.iso).join(",");
  const prevExec = useRef<string[] | null>(null);
  useEffect(() => {
    const cur = execGrid.map((m) => m.iso);
    const prev = prevExec.current;
    prevExec.current = cur;
    if (!prev || !canEditFirm || !prev.length || !cur.length || prev[0] === cur[0]) return;
    const shifted = cur.map((iso, i) => ({ period: iso, phase: "execucao" as Phase, amount: i < prev.length ? fir.get(key(prev[i], "execucao")) ?? 0 : 0 }))
      .filter((r) => r.amount > 0);
    onFirmChange?.([...indicative.filter((r) => r.phase === "planejamento"), ...shifted]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execKey]);

  const allRows = [...planRows, ...execRows];
  const [firmText, setFirmText] = useState<Record<string, string>>({});
  const [realText, setRealText] = useState<Record<string, string>>({});
  useEffect(() => {
    const f: Record<string, string> = {}; const r: Record<string, string> = {};
    allRows.forEach((m) => { const k = key(m.iso, m.phase); f[k] = fmt(fir.get(k) ?? 0); r[k] = fmt(rea.get(k) ?? 0); });
    setFirmText(f); setRealText(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows.map((m) => key(m.iso, m.phase)).join(","), JSON.stringify(firm), JSON.stringify(realized)]);

  const emitFirm = (t: Record<string, string>) => onFirmChange?.([
    ...indicative.filter((r) => r.phase === "planejamento"),
    ...execGrid.map((m) => ({ period: m.iso, phase: "execucao" as Phase, amount: parseBRL(t[key(m.iso, "execucao")] ?? "") })).filter((r) => r.amount > 0),
  ]);
  const emitReal = (t: Record<string, string>) => onRealizedChange?.(
    allRows.map((m) => ({ period: m.iso, phase: m.phase, amount: parseBRL(t[key(m.iso, m.phase)] ?? "") })).filter((r) => r.amount > 0),
  );

  const plannedValue = (m: Row) => {
    if (m.planned == null) return null;
    if (m.plannedEditable && canEditFirm) return parseBRL(firmText[key(m.iso, m.phase)] ?? "");
    return m.planned;
  };
  const hasReal = (m: Row) => { const k = key(m.iso, m.phase); return rea.has(k) || (canEditRealized && !!realText[k]); };
  const realValue = (m: Row) => (canEditRealized ? parseBRL(realText[key(m.iso, m.phase)] ?? "") : rea.get(key(m.iso, m.phase)) ?? 0);

  const sExec = execRows.reduce((s, m) => s + (plannedValue(m) ?? 0), 0);
  const execOk = Math.abs(sExec - execTarget) <= 0.01;

  if (allRows.length === 0) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Informe o início e o prazo da execução para gerar os meses do cronograma.</div>;
  }

  const table = (title: string, rows: Row[], tone: string) => {
    const totInd = rows.reduce((s, m) => s + (m.ind ?? 0), 0);
    const totReal = rows.reduce((s, m) => s + (hasReal(m) ? realValue(m) : 0), 0);
    const totPlan = rows.reduce((s, m) => s + (plannedValue(m) ?? 0), 0);
    return (
      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Sem meses neste bloco.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Mês</th>
                  <th className="px-3 py-2 text-right">Indicativo</th>
                  <th className="px-3 py-2 text-right">Realizado</th>
                  <th className="px-3 py-2 text-right">Planejado</th>
                  <th className="px-3 py-2 text-right">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((m) => {
                  const k = key(m.iso, m.phase);
                  const pv = plannedValue(m); const hr = hasReal(m); const rv = realValue(m);
                  const base = hr ? rv : pv;
                  const diff = m.ind != null && base != null ? base - m.ind : null;
                  return (
                    <tr key={k} className={tone}>
                      <td className="px-3 py-1.5">{m.label}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums text-muted-foreground ${m.ind == null ? HATCH : ""}`}>{m.ind == null ? "" : formatBRL(m.ind)}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${!canEditRealized && !hr ? HATCH : ""}`}>
                        {canEditRealized ? (
                          <div className="ml-auto max-w-40">
                            <MoneyInput aria-label={`Realizado em ${monthLabel(m.iso)}`} className="h-8" value={realText[k] ?? ""}
                              onChange={(v) => { const t = { ...realText, [k]: v }; setRealText(t); emitReal(t); }} />
                          </div>
                        ) : hr ? formatBRL(rv) : ""}
                      </td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${pv == null ? HATCH : ""}`}>
                        {pv == null ? "" : m.plannedEditable && canEditFirm ? (
                          <div className="ml-auto max-w-40">
                            <MoneyInput aria-label={`Planejado em ${monthLabel(m.iso)}`} className="h-8" value={firmText[k] ?? ""}
                              onChange={(v) => { const t = { ...firmText, [k]: v }; setFirmText(t); emitFirm(t); }} />
                          </div>
                        ) : formatBRL(pv)}
                      </td>
                      <td className={`px-3 py-1.5 text-right text-xs tabular-nums ${diff == null ? HATCH : diff > 0.01 ? "text-destructive" : diff < -0.01 ? "text-success" : "text-muted-foreground"}`}>
                        {diff == null ? "" : Math.abs(diff) <= 0.01 ? "—" : `${diff > 0 ? "+" : ""}${formatBRL(diff)}${m.ind ? ` (${((diff / m.ind) * 100).toFixed(1)}%)` : ""}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-medium">
                <tr>
                  <td className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">Total {title.toLowerCase()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(totInd)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(totReal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(totPlan)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {table("Planejamento", planRows, "bg-primary/5")}
      {table("Execução", execRows, "bg-success/5")}
      <div className={`rounded-md border p-2 text-sm ${execOk ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/10"}`}>
        <div className="text-xs text-muted-foreground">Soma dos meses de execução (planejado)</div>
        <div className="font-medium tabular-nums">{formatBRL(sExec)} <span className="text-xs text-muted-foreground">de {formatBRL(execTarget)}</span></div>
        {!execOk && <div className="text-xs">Diferença de {formatBRL(execTarget - sExec)}</div>}
      </div>
      <p className="text-xs text-muted-foreground">
        Células hachuradas não existiam no escopo original. "R$ 0,00" é um valor lançado como zero; "—" na variação indica diferença nula.
        Na execução, o indicativo é comparado pela ordem do mês (Mês 1 com Mês 1 da proposta).
      </p>
    </div>
  );
}
