import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/auth-domain";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},
});

/** Só aceita caminhos relativos same-origin. */
function safeNext(next?: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function LoginPage() {
  const { session, loading } = useAuth();
  const { next } = Route.useSearch();
  const nextPath = safeNext(next);
  const [busy, setBusy] = useState(false);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  if (session) {
    if (nextPath) {
      window.location.replace(nextPath);
      return null;
    }
    return <Navigate to="/app" />;
  }

  const onGoogle = async () => {
    setBusy(true);
    if (nextPath) {
      try {
        window.sessionStorage.setItem("capex.next", nextPath);
      } catch {
        /* ignore */
      }
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
      },
    });
    if (error) {
      setBusy(false);
      return toast.error("Não foi possível entrar com o Google", { description: error.message });
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-to-br from-background via-secondary/30 to-muted text-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo size="lg" />
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight text-foreground">
            Gestão do orçamento de CapEx
          </h1>
          <p className="text-sm text-muted-foreground">
            Plataforma da UGB CapEx para coleta, pré-aprovação e liberação financeira de projetos de
            investimento do Beach Park.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© Beach Park · UGB CapEx</p>
      </div>
      <div className="flex items-start justify-center p-6 pt-16 sm:p-12 sm:pt-24">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Logo size="md" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Acesso restrito</h2>
            <p className="text-sm text-muted-foreground">Entre com sua conta Google corporativa.</p>
          </div>
          <Button className="w-full" onClick={onGoogle} disabled={busy}>
            {busy ? "Abrindo o Google…" : "Entrar com Google"}
          </Button>
          <p className="text-xs text-muted-foreground">
            No primeiro acesso você informará seu WhatsApp e sua área. A liberação do acesso é feita
            pela Administração.
          </p>
        </div>
      </div>
    </div>
  );
}
