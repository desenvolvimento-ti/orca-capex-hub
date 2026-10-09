import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { BackButton } from "@/components/BackButton";
import { ProposalForm } from "@/components/project/ProposalForm";

export const Route = createFileRoute("/app/projects/new")({
  head: () => ({ meta: [{ title: "Novo projeto · Hub de Investimentos" }, { name: "description", content: "Cadastre a proposta indicativa de um novo projeto." }] }),
  component: NewProject,
});

function NewProject() {
  const { effectiveRole, isRealFpa, loading } = useAuth();
  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (effectiveRole !== "manager" && !isRealFpa) return <Navigate to="/app/projects" />;

  return (
    <div className="space-y-6">
      <BackButton fallback="/app" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo projeto</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre a proposta indicativa: valores de estudo e de execução, datas, cronograma e payback. Para salvar basta nome e categoria; complete o restante quando quiser e submeta ao FP&A.
        </p>
      </div>
      <ProposalForm canEdit />
    </div>
  );
}
