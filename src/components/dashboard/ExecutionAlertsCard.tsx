import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ExecutionAlertsCard() {
  const { data } = useQuery({
    queryKey: ["exec-alerts"],
    queryFn: async () => {
      const [a, b, c] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }).in("status", ["aprovado_final", "em_execucao"]),
        supabase.from("project_deviations").select("id", { count: "exact", head: true }).neq("status", "tratado"),
        supabase.from("unmatched_actuals_queue").select("id", { count: "exact", head: true }).in("status", ["aberto", "em_contato"]),
      ]);
      return { exec: a.count ?? 0, dev: b.count ?? 0, queue: c.count ?? 0 };
    },
  });
  const items = [
    { label: "Em execução", value: data?.exec ?? 0, to: "/app/acompanhamento-gestor" as const },
    { label: "Desvios pendentes", value: data?.dev ?? 0, to: "/app/realizado" as const },
    { label: "Fora do rito", value: data?.queue ?? 0, to: "/app/realizado" as const },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <Link key={i.label} to={i.to} className="rounded-lg border bg-card p-4 hover:bg-muted/40">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{i.label}</div>
          <div className="mt-1 text-2xl font-semibold">{i.value}</div>
        </Link>
      ))}
    </section>
  );
}
