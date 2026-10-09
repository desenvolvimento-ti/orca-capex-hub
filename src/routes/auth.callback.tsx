import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/auth-domain";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function safeNext(path: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function getOAuthErrorMessage(): string {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const error = query.get("error") ?? hash.get("error");
  const description = query.get("error_description") ?? hash.get("error_description");

  if (error === "access_denied") return "Login cancelado. Tente novamente.";

  const details = `${error ?? ""} ${description ?? ""}`.toLowerCase();
  if (details.includes("beachpark") || details.includes("domain")) {
    return `Use uma conta @${ALLOWED_EMAIL_DOMAIN} para acessar o sistema.`;
  }
  if (details.includes("autorizado") || details.includes("authorized")) {
    return "Sua conta ainda não foi liberada. Solicite acesso à Administração.";
  }

  return `Não foi possível concluir o login. Use uma conta @${ALLOWED_EMAIL_DOMAIN} liberada para acessar o sistema ou solicite acesso à Administração.`;
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (session) {
      let next: string | null = null;
      try {
        next = safeNext(window.sessionStorage.getItem("capex.next"));
        window.sessionStorage.removeItem("capex.next");
      } catch {
        next = null;
      }
      if (next) {
        window.location.replace(next);
        return;
      }
      void navigate({ to: "/app", replace: true });
      return;
    }
    setError(getOAuthErrorMessage());
  }, [loading, session, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <Logo size="md" />
        {error ? (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Não foi possível entrar</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button asChild className="w-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Concluindo autenticação…</p>
        )}
      </div>
    </main>
  );
}
