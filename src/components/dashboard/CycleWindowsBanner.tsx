import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR, cyclePeriodFromDates } from "@/lib/labels";

/** Banner destacando o período de Submissão aberto do ciclo ativo, voltado para gestores. */
export function CycleWindowsBanner() {
  const { data } = useQuery({
    queryKey: ["active-cycle-submission"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cycles")
        .select("id, name, year, is_active, archived_at, submission_start, submission_end, analysis_start, analysis_end")
        .eq("is_active", true)
        .is("archived_at", null);
      if (error) throw error;
      return (data ?? []).filter((c) => cyclePeriodFromDates(c) === "submissao");
    },
  });

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        Nenhuma janela de Submissão aberta no momento. Você pode continuar cadastrando projetos no seu hub — eles ficarão prontos para direcionar quando uma janela abrir.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/10 p-4"
        >
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Janela aberta</div>
            <div className="text-sm font-semibold">
              Submissão · {c.name} ({c.year})
            </div>
            <div className="text-xs text-muted-foreground">
              {c.submission_start ? `Abriu em ${formatDateBR(c.submission_start)}` : "Sem data de abertura"}
              {c.submission_end ? ` · fecha em ${formatDateBR(c.submission_end)}` : ""}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Vá em <strong>Projetos</strong> para direcionar seus rascunhos do hub.
          </div>
        </div>
      ))}
    </div>
  );
}
