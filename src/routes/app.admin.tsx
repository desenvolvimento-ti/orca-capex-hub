import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreasPanel } from "@/components/admin/AreasPanel";
import { AllowedEmailsPanel } from "@/components/admin/AllowedEmailsPanel";
import { AccessRequestsPanel, useAccessRequests } from "@/components/admin/AccessRequestsPanel";
import { RequiredDocsPanel } from "@/components/admin/RequiredDocsPanel";
import { AreaBudgetsPanel } from "@/components/admin/AreaBudgetsPanel";
import { STAGES_3_TO_5_ENABLED } from "@/lib/features";
import { BackButton } from "@/components/BackButton";
import { DeviationSettingsPanel } from "@/components/admin/DeviationSettingsPanel";
import { BranchesPanel, BusinessUnitsPanel, DirectoratesPanel } from "@/components/admin/CatalogPanels";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

function AdminPage() {
  const { loading, primaryRole } = useAuth();
  const { data: requests = [] } = useAccessRequests();
  const pending = requests.filter((r) => r.status === "pendente").length;

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (primaryRole !== "fpa") return <Navigate to="/app" />;

  return (
    <div className="space-y-6">
      <BackButton fallback="/app" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-sm text-muted-foreground">Cadastros base do sistema CapEx.</p>
      </div>
      {pending > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <strong>{pending}</strong> {pending === 1 ? "pessoa aguarda" : "pessoas aguardam"} liberação de acesso.
        </div>
      )}
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">
            Usuários e acessos{pending > 0 ? ` (${pending})` : ""}
          </TabsTrigger>
          <TabsTrigger value="org">Áreas e diretorias</TabsTrigger>
          <TabsTrigger value="branches">Filiais e unidades</TabsTrigger>
          <TabsTrigger value="deviation">Critério de desvio</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          {STAGES_3_TO_5_ENABLED && <TabsTrigger value="budgets">Orçamentos por área</TabsTrigger>}
        </TabsList>
        <TabsContent value="requests" className="mt-6 space-y-8"><AccessRequestsPanel /><AllowedEmailsPanel /></TabsContent>
        <TabsContent value="org" className="mt-6 space-y-8">
          <section className="space-y-3"><h2 className="text-lg font-semibold">Diretorias</h2><DirectoratesPanel /></section>
          <section className="space-y-3"><h2 className="text-lg font-semibold">Áreas</h2><AreasPanel /></section>
        </TabsContent>
        <TabsContent value="branches" className="mt-6 space-y-8">
          <section className="space-y-3"><h2 className="text-lg font-semibold">Filiais</h2><BranchesPanel /></section>
          <section className="space-y-3"><h2 className="text-lg font-semibold">Unidades de negócio por filial</h2><BusinessUnitsPanel /></section>
        </TabsContent>
        <TabsContent value="deviation" className="mt-6"><DeviationSettingsPanel /></TabsContent>
        <TabsContent value="docs" className="mt-6"><RequiredDocsPanel /></TabsContent>
        {STAGES_3_TO_5_ENABLED && <TabsContent value="budgets" className="mt-6"><AreaBudgetsPanel /></TabsContent>}
      </Tabs>
    </div>
  );
}
