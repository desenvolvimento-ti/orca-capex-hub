import { createFileRoute, Outlet, Navigate, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut } from "lucide-react";
import { AccessRequestGate } from "@/components/auth/AccessRequestGate";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FontSizeToggle } from "@/components/FontSizeToggle";
import { ROLE_LABEL } from "@/lib/labels";
import { STAGES_3_TO_5_ENABLED } from "@/lib/features";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { loading, session, profile, roles, effectiveRole, isRealFpa, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!session) return <Navigate to="/login" />;
  if (!roles.length) return <AccessRequestGate />;

  const isManager = effectiveRole === "manager";
  const isDirectoria =
    effectiveRole === "ceo" || effectiveRole === "cfo" || effectiveRole === "cco" || effectiveRole === "cmo";
  const isDirectoriaOnly = isDirectoria && !isRealFpa;

  const navItems: { to: string; label: string; show: boolean }[] = isManager
    ? [{ to: "/app", label: "Painel", show: true }]
    : isDirectoriaOnly
    ? [{ to: "/app/diretoria", label: "Meu Painel", show: true }]
    : [
        { to: "/app", label: "Acompanhamento", show: true },
        { to: "/app/projects", label: "Projetos", show: !!effectiveRole },
        { to: "/app/realizado", label: "Realizado", show: isRealFpa },
        { to: "/app/acompanhamento-gestor", label: "Curva por gestor", show: isRealFpa },
        { to: "/app/financeiro", label: "Financeiro", show: isRealFpa && STAGES_3_TO_5_ENABLED },
        { to: "/app/diretoria", label: "Meu Painel", show: isDirectoria },
        { to: "/app/admin", label: "Administração", show: isRealFpa },
      ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 2xl:px-12">
          <Logo size="md" />
          <div className="flex items-center gap-4">
            <FontSizeToggle />
            <ThemeToggle />
            <NotificationsBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1 text-right text-sm hover:bg-muted">
                  <div>
                    <div className="font-medium">{profile?.full_name ?? session.user.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {roles.length ? roles.map((r) => ROLE_LABEL[r]).join(" · ") : "Sem papel atribuído"}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{session.user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-[1800px] gap-1 overflow-x-auto px-2 sm:px-4 lg:px-6 2xl:px-10">
          {navItems.filter((i) => i.show).map((i) => {
            const active = i.to === "/app" ? path === "/app" : path.startsWith(i.to);
            return (
              <Link
                key={i.to}
                to={i.to}
                className={`border-b-2 px-4 py-2 text-sm transition ${active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {i.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 2xl:px-12"><Outlet /></main>
      <CommandPalette />
    </div>
  );
}
