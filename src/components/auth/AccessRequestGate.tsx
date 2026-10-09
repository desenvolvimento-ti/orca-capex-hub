import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Logo } from "@/components/Logo";
import { RefreshCw } from "lucide-react";
import { formatPhone } from "@/lib/phone";

const NEW_AREA = "__new__";

/** Tela exibida a quem entrou no site mas ainda não tem papel atribuído. */
export function AccessRequestGate() {
  const { user, profile, refresh, signOut } = useAuth();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [areaChoice, setAreaChoice] = useState<string>(NEW_AREA);
  const [newArea, setNewArea] = useState("");
  const [dirId, setDirId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName((v) => v || profile.full_name);
    if (profile?.phone) setPhone((v) => v || formatPhone(profile.phone!));
  }, [profile]);

  const { data: request, isLoading } = useQuery({
    queryKey: ["my-access-request", user?.id],
    enabled: !!user?.id,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_requests")
        .select("id, status, requested_area_name, created_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("id, name")
        .eq("status", "aprovada")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: dirs = [] } = useQuery({
    queryKey: ["directorates-active"],
    queryFn: async () => (await supabase.from("directorates").select("id, name").eq("is_active", true).order("name")).data ?? [],
  });

  const areaOptions = useMemo(() => areas, [areas]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const digits = phone.replace(/\D/g, "");
    if (fullName.trim().length < 3) return toast.error("Informe seu nome completo.");
    if (digits.length < 10) return toast.error("Informe um número de WhatsApp válido com DDD.");
    if (dirs.length > 0 && !dirId) return toast.error("Selecione a diretoria à qual você responde.");
    const areaName = areaChoice === NEW_AREA ? newArea.trim() : "";
    if (areaChoice === NEW_AREA && areaName.length < 2) return toast.error("Informe o nome da sua área.");

    setBusy(true);
    try {
      let areaId: string | null = areaChoice === NEW_AREA ? null : areaChoice;
      let areaLabel = areaName;

      if (areaChoice === NEW_AREA) {
        const existing = areaOptions.find((a) => a.name.trim().toLowerCase() === areaName.toLowerCase());
        if (existing) {
          areaId = existing.id;
          areaLabel = existing.name;
        } else {
          const { data: created, error: areaErr } = await supabase
            .from("areas")
            .insert({ name: areaName, status: "pendente", created_by: user.id })
            .select("id, name")
            .single();
          if (areaErr) throw areaErr;
          areaId = created.id;
          areaLabel = created.name;
        }
      } else {
        areaLabel = areaOptions.find((a) => a.id === areaChoice)?.name ?? "";
      }

      await supabase.from("profiles").update({ full_name: fullName.trim(), phone }).eq("id", user.id);

      const { error } = await supabase.from("access_requests").upsert(
        {
          user_id: user.id,
          email: user.email ?? "",
          full_name: fullName.trim(),
          phone,
          requested_area_id: areaId,
          requested_area_name: areaLabel,
          directorate_id: dirId || null,
          status: "pendente",
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;

      toast.success("Solicitação enviada", { description: "A Administração vai liberar seu acesso." });
      await refresh();
      qc.invalidateQueries({ queryKey: ["my-access-request"] });
    } catch (err: any) {
      toast.error("Não foi possível enviar sua solicitação", { description: err?.message ?? String(err) });
    } finally {
      setBusy(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-4 py-4 sm:px-6">
          <Logo size="md" />
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sair</Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-10">{children}</main>
    </div>
  );

  if (isLoading) {
    return <Shell><div className="text-sm text-muted-foreground">Carregando…</div></Shell>;
  }

  if (request?.status === "recusado") {
    return (
      <Shell>
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-xl font-semibold tracking-tight">Acesso não liberado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua solicitação foi analisada e não foi liberada. Procure a Administração do CapEx para mais informações.
          </p>
        </div>
      </Shell>
    );
  }

  if (request) {
    return (
      <Shell>
        <div className="rounded-lg border bg-card p-6">
          <h1 className="text-xl font-semibold tracking-tight">Acesso aguardando liberação</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Recebemos seus dados. A Administração precisa definir seu papel{request.requested_area_name ? ` e confirmar a área "${request.requested_area_name}"` : ""} antes de liberar o acesso.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Já foi liberado? Clique abaixo para atualizar.</p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await refresh();
                qc.invalidateQueries({ queryKey: ["my-access-request"] });
                toast.info("Situação atualizada.");
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar situação
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold tracking-tight">Complete seu cadastro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Precisamos de algumas informações para a Administração liberar seu acesso.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ar-email">E-mail</Label>
            <Input id="ar-email" value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ar-name">Nome completo <span className="text-destructive">*</span></Label>
            <Input id="ar-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ar-phone">WhatsApp <span className="text-destructive">*</span></Label>
            <Input
              id="ar-phone"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(85) 99999-0000"
              inputMode="numeric"
              maxLength={16}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Área <span className="text-destructive">*</span></Label>
            <Select value={areaChoice} onValueChange={setAreaChoice}>
              <SelectTrigger><SelectValue placeholder="Selecione sua área" /></SelectTrigger>
              <SelectContent>
                {areaOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                <SelectItem value={NEW_AREA}>+ Minha área não está listada</SelectItem>
              </SelectContent>
            </Select>
            {areaChoice === NEW_AREA && (
              <>
                <Input
                  placeholder="Digite o nome da sua área"
                  id="ar-area"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  A área informada ficará pendente de aprovação pela Administração.
                </p>
              </>
            )}
          </div>
          {dirs.length > 0 && (
            <div className="space-y-2">
              <Label>Diretoria <span className="text-destructive">*</span></Label>
              <Select value={dirId || undefined} onValueChange={setDirId}>
                <SelectTrigger><SelectValue placeholder="Selecione a diretoria à qual você responde" /></SelectTrigger>
                <SelectContent>{dirs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Enviando…" : "Enviar para liberação"}
          </Button>
          <p className="text-xs text-muted-foreground">* Campos de preenchimento obrigatório.</p>
        </form>
      </div>
    </Shell>
  );
}
