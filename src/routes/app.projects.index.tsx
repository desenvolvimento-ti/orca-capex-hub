import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ManagerDashboard } from "@/components/manager/ManagerDashboard";

export const Route = createFileRoute("/app/projects/")({ component: ProjectsList });

function ProjectsList() {
  const { effectiveRole, isRealFpa } = useAuth();
  const scope = isRealFpa || effectiveRole !== "manager" ? "all" : "own";
  return <ManagerDashboard scope={scope} />;
}
