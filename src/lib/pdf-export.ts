import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateBR, STATUS_LABEL } from "@/lib/labels";

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 40, 50);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subtitle, 40, 68);
    doc.setTextColor(0);
  }
  doc.setDrawColor(220);
  doc.line(40, 78, 555, 78);
}

function footerAll(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} · Pág. ${i}/${pages}`,
      40,
      doc.internal.pageSize.getHeight() - 20,
    );
  }
}

export async function exportProjectExecutivePdf(projectId: string) {
  const { data: p, error } = await supabase
    .from("projects")
    .select("*, areas:areas!projects_area_id_fkey(name), cycles(name, year)")
    .eq("id", projectId)
    .single();
  if (error || !p) throw error ?? new Error("Projeto não encontrado");

  const { data: owner } = await supabase
    .from("profiles").select("full_name, email")
    .eq("id", p.owner_id).maybeSingle();

  const { data: disb = [] } = await supabase
    .from("disbursements").select("period, amount, phase, version")
    .eq("project_id", projectId).order("period", { ascending: true });

  const { data: timeline = [] } = await supabase
    .rpc("project_audit_timeline", { p_project_id: projectId });

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(
    doc,
    `Projeto ${p.code ?? "sem código"} — ${p.name}`,
    `${(p.areas as any)?.name ?? "—"} · Ciclo: ${(p.cycles as any)?.name ?? "—"} · Status: ${STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] ?? p.status}`,
  );

  autoTable(doc, {
    startY: 92,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    body: [
      ["Gestor", owner?.full_name ?? "—"],
      ["E-mail", owner?.email ?? "—"],
      ["Verba de planejamento", formatBRL(p.study_amount)],
      ["Verba de execução", formatBRL(p.execution_amount)],
      ["Valor total (indicativo)", formatBRL(Number(p.study_amount ?? 0) + Number(p.execution_amount ?? 0))],
      ["Início do planejamento", formatDateBR(p.study_start_date)],
      ["Início da execução", formatDateBR(p.execution_start_date)],
      ["Prazo de execução", p.execution_months ? `${p.execution_months} meses` : "—"],
      ["Payback", p.payback_not_applicable ? `Não se aplica — ${p.payback_na_justification ?? ""}` : p.payback_months ? `${p.payback_months} meses` : "—"],
      ...(p.firm_execution_amount != null ? [
        ["Estudo (firme)", formatBRL(p.firm_study_amount)],
        ["Execução (firme)", formatBRL(p.firm_execution_amount)],
        ["Prazo de execução (firme)", p.firm_execution_months ? `${p.firm_execution_months} meses` : "—"],
        ["Centro de custo", p.cost_center ?? "—"],
        ["Código contábil", p.accounting_code ?? "—"],
      ] : []),
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 140 } },
  });

  const y1 = (doc as any).lastAutoTable.finalY + 18;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Descrição", 40, y1);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(doc.splitTextToSize(p.description || "—", 515), 40, y1 + 14);

  const y2 = y1 + 14 + doc.getTextDimensions(doc.splitTextToSize(p.description || "—", 515)).h + 16;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Justificativa", 40, y2);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(doc.splitTextToSize(p.justification || "—", 515), 40, y2 + 14);

  if (disb && disb.length > 0) {
    doc.addPage();
    header(doc, "Cronograma financeiro", `${p.code ?? ""} — ${p.name}`);
    autoTable(doc, {
      startY: 92,
      head: [["Mês", "Versão", "Natureza", "Valor (R$)"]],
      body: disb.map((d: any) => [
        new Date(d.period).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }),
        d.version === "firme" ? "Firme" : "Indicativo",
        d.phase === "planejamento" ? "Planejamento" : "Execução",
        formatBRL(Number(d.amount)),
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
      columnStyles: { 3: { halign: "right" } },
    });
  }

  if (timeline && (timeline as any[]).length > 0) {
    doc.addPage();
    header(doc, "Linha do tempo / Auditoria", `${p.code ?? ""} — ${p.name}`);
    autoTable(doc, {
      startY: 92,
      head: [["Data", "Evento", "Responsável", "De → Para", "Comentário"]],
      body: (timeline as any[]).map((t) => [
        new Date(t.event_at).toLocaleString("pt-BR"),
        KIND_LABEL[t.kind] ?? t.kind,
        t.actor_name ?? "—",
        t.from_status || t.to_status
          ? `${statusLabel(t.from_status)} → ${statusLabel(t.to_status)}`
          : "—",
        t.comment ?? "",
      ]),
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 70 }, 2: { cellWidth: 90 }, 3: { cellWidth: 130 } },
    });
  }

  footerAll(doc);
  doc.save(`projeto_${p.code ?? p.id.slice(0, 8)}.pdf`);
}

const KIND_LABEL: Record<string, string> = {
  status: "Mudança de status",
  change_request: "Solicitação de alteração",
  document: "Documento",
  comment: "Comentário",
};

function statusLabel(s: string | null | undefined) {
  if (!s) return "—";
  return STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? s;
}

export async function exportCycleExecutivePdf(cycleId: string) {
  const { data: cycle } = await supabase
    .from("cycles").select("*").eq("id", cycleId).single();
  if (!cycle) throw new Error("Ciclo não encontrado");

  const { data: projects = [] } = await supabase
    .from("projects")
    .select("id, code, name, status, estimated_total, ceo_approved_amount, released_amount, areas:areas!projects_area_id_fkey(name)")
    .eq("cycle_id", cycleId)
    .order("code", { ascending: true });

  const { data: usage = [] } = await supabase
    .rpc("area_budget_usage", { p_cycle_id: cycleId });

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  header(doc, `Ciclo ${cycle.name} (${cycle.year})`, "Relatório executivo — resumo do ciclo");

  const totalPlan = (projects ?? []).reduce((s, p: any) => s + Number(p.estimated_total || 0), 0);
  const totalApp = (projects ?? []).reduce((s, p: any) => s + Number(p.ceo_approved_amount || 0), 0);
  const totalRel = (projects ?? []).reduce((s, p: any) => s + Number(p.released_amount || 0), 0);

  autoTable(doc, {
    startY: 92,
    theme: "plain",
    styles: { fontSize: 10 },
    body: [
      ["Projetos no ciclo", String(projects?.length ?? 0)],
      ["Total planejado", formatBRL(totalPlan)],
      ["Total aprovado (CEO)", formatBRL(totalApp)],
      ["Total liberado", formatBRL(totalRel)],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 200 } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [["Área", "Orçamento", "Planejado", "Aprovado", "Liberado", "% uso"]],
    body: (usage as any[]).map((u) => {
      const budget = Number(u.budget_amount || 0);
      const rel = Number(u.released_amount || 0);
      const pct = budget > 0 ? (rel / budget) * 100 : 0;
      return [u.area_name, formatBRL(budget), formatBRL(u.planned_amount), formatBRL(u.approved_amount), formatBRL(rel), `${pct.toFixed(1)}%`];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  doc.addPage();
  header(doc, "Projetos do ciclo", `${cycle.name} (${cycle.year})`);
  autoTable(doc, {
    startY: 92,
    head: [["Código", "Projeto", "Área", "Status", "Planejado", "Aprovado", "Liberado"]],
    body: (projects ?? []).map((p: any) => [
      p.code ?? "—",
      p.name,
      p.areas?.name ?? "—",
      STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] ?? p.status,
      formatBRL(p.estimated_total),
      formatBRL(p.ceo_approved_amount),
      formatBRL(p.released_amount),
    ]),
    foot: [[
      "", "", "", "Total",
      formatBRL(totalPlan), formatBRL(totalApp), formatBRL(totalRel),
    ]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
    columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });

  footerAll(doc);
  doc.save(`ciclo_${cycle.name.replace(/\s+/g, "_")}_${cycle.year}.pdf`);
}
