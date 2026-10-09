import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { PeriodConsolidationPanel } from "@/components/dashboard/PeriodConsolidationPanel";
import { ExecutionOverviewPanel } from "@/components/dashboard/ExecutionOverviewPanel";
import { ManagerDashboard } from "@/components/manager/ManagerDashboard";
import { STAGES_3_TO_5_ENABLED } from "@/lib/features";
import { PrioritizationPanel } from "@/components/dashboard/PrioritizationPanel";
import { CeilingPanel } from "@/components/admin/CeilingPanel";
import { ExecutionAlertsCard } from "@/components/dashboard/ExecutionAlertsCard";

export const Route = createFileRoute("/app/")({ component: AppHome });

function AppHome() {
  const { roles, effectiveRole, isRealFpa } = useAuth();

  const isDirectoria =
    effectiveRole === "ceo" || effectiveRole === "cfo" || effectiveRole === "cco" || effectiveRole === "cmo";
  if (isDirectoria && !isRealFpa) return <Navigate to="/app/diretoria" />;

  if (!roles.length) {
    return (
      <div className="rounded-lg border bg-card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo ao CapEx</h1>
        <div className="mt-6 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
          <strong>Aguardando autorização.</strong> Sua conta foi criada, mas ainda não recebeu um papel.
          Peça à Administração para liberar seu acesso.
        </div>
      </div>
    );
  }

  if (isRealFpa) {
    return (
      <div className="space-y-6">
        <ExecutionAlertsCard />
        <PrioritizationPanel />
        <CeilingPanel />
        <PeriodConsolidationPanel />
        {STAGES_3_TO_5_ENABLED && (
          <section className="space-y-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Acompanhamento CAPEX · execução</h2>
              <p className="text-xs text-muted-foreground">
                Projetos aprovados em execução — consumo, desvios e alertas de estouro.
              </p>
            </div>
            <ExecutionOverviewPanel />
          </section>
        )}
      </div>
    );
  }

  if (effectiveRole === "manager") return <ManagerDashboard />;

  return <PeriodConsolidationPanel />;
}
