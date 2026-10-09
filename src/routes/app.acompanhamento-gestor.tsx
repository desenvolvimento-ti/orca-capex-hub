import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BackButton } from "@/components/BackButton";
import { formatBRL } from "@/lib/labels";
import { EXECUTION_STATUSES, exportManagerCurves, loadCurves, sumCurves, type MonthRow } from "@/lib/execution";
import { CurveChart, CurveTable } from "@/components/execution/CurveChart";

export const Route = createFileRoute("/app/acompanhamento-gestor")({
  head: () => ({ meta: [
    { title: "Curva por gestor · Hub de Investimentos" },
    { name: "description", content: "Curva mensal e acumulada dos projetos em execução por gestor." },
    { property: "og:title", content: "Curva por gestor · Hub de Investimentos" },
    { property: "og:description", content: "Previsto x realizado dos projetos em execução." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ManagerCurvePage,
});

const fmtM = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;

function ManagerCurvePage() {
  const { profile, isRealFpa } = useAuth();
  const [picked, setPicked] = useState("");
  const managerId = isRealFpa ? picked : profile?.id ?? "";

  const { data: managers = [] } = useQuery({
    queryKey: ["exec-managers"], enabled: isRealFpa,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("owner_id").in("status", [...EXECUTION_STATUSES]);
      const ids = [...new Set((data ?? []).map((d) => d.owner_id))];
      if (!ids.length) return [];
      return (await supabase.from("profiles").select("id, full_name").in("id", ids).order("full_name")).data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["manager-curves", managerId], enabled: !!managerId,
    queryFn: async () => {
      const { data: ps } = await supabase.from("projects").select("id, code, name").eq("owner_id", managerId).in("status", [...EXECUTION_STATUSES]).order("code");
      const projects = ps ?? [];
      const curves = await loadCurves(projects.map((p) => p.id));
      return { projects, curves: projects.map((p) => curves.get(p.id)!) };
    },
  });

  const managerName = isRealFpa ? managers.find((m) => m.id === picked)?.full_name ?? "" : profile?.full_name ?? "";
  const consolidated = data ? sumCurves(data.curves) : [];

  const pdf = () => {
    if (!data) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14); doc.text(`Acompanhamento da execução · ${managerName}`, 14, 14);
    doc.setFontSize(9); doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 20);
    const body = (rows: MonthRow[]) => rows.map((r) => [fmtM(r.month), formatBRL(r.planned), formatBRL(r.actual), formatBRL(r.diff), formatBRL(r.plannedAcc), formatBRL(r.actualAcc)]);
    const head = [["Mês", "Previsto", "Realizado", "Desvio", "Prev. acum.", "Real. acum."]];
    autoTable(doc, { startY: 26, head: [["Consolidado"]], body: [], theme: "plain" });
    autoTable(doc, { head, body: body(consolidated), styles: { fontSize: 8 } });
    data.projects.forEach((p, i) => {
      autoTable(doc, { head: [[`${p.code ?? ""} · ${p.name} (${data.curves[i].version})`]], body: [], theme: "plain" });
      autoTable(doc, { head, body: body(data.curves[i].rows), styles: { fontSize: 8 } });
    });
    doc.save(`acompanhamento_${managerName.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <BackButton fallback="/app" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Curva de execução {isRealFpa ? "por gestor" : ""}</h1>
          <p className="text-sm text-muted-foreground">Previsto x realizado, mensal e acumulado, dos projetos em execução.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isRealFpa && (
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={picked} onChange={(e) => setPicked(e.target.value)}>
              <option value="">Escolha o gestor…</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          )}
          {data && data.projects.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => exportManagerCurves(managerName, data.projects, data.curves)}><FileSpreadsheet className="mr-1 h-4 w-4" /> Excel</Button>
              <Button size="sm" variant="outline" onClick={pdf}><FileDown className="mr-1 h-4 w-4" /> PDF</Button>
            </>
          )}
        </div>
      </div>

      {!managerId && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Escolha um gestor para ver a curva.</div>}
      {isLoading && <div className="text-muted-foreground">Carregando…</div>}
      {data && data.projects.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum projeto em execução.</div>}
      {data && data.projects.length > 0 && (
        <>
          <section className="space-y-3 rounded-lg border bg-card p-5">
            <h2 className="text-base font-semibold">Consolidado · {data.projects.length} projeto(s)</h2>
            <CurveChart rows={consolidated} />
          </section>
          {data.projects.map((p, i) => (
            <section key={p.id} className="space-y-3 rounded-lg border bg-card p-5">
              <div className="flex items-baseline justify-between">
                <Link to="/app/projects/$id" params={{ id: p.id }} className="font-semibold hover:underline"><span className="font-mono text-sm text-muted-foreground">{p.code}</span> {p.name}</Link>
                <span className="text-xs text-muted-foreground">Base: cronograma {data.curves[i].version}</span>
              </div>
              <CurveChart rows={data.curves[i].rows} height={200} />
              <details><summary className="cursor-pointer text-sm">Tabela</summary><div className="mt-2"><CurveTable rows={data.curves[i].rows} /></div></details>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
