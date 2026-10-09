import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhone } from "@/lib/phone";
import { useDirectorates } from "@/components/admin/AllowedEmailsPanel";
import { ROLE_TITLE, type AppRole, formatDateBR } from "@/lib/labels";

const ROLES: AppRole[] = ["manager", "fpa"];
const DIRECTOR_ROLES: AppRole[] = [];

type Row = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  requested_area_id: string | null;
  requested_area_name: string | null;
  directorate_id: string | null;
  status: string;
  created_at: string;
  decided_at: string | null;
};

export function useAccessRequests() {
  return useQuery({
    queryKey: ["access_requests"],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_requests")
        .select("id, user_id, email, full_name, phone, requested_area_id, requested_area_name, directorate_id, status, created_at, decided_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

export function AccessRequestsPanel() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useAccessRequests();
  const { data: dirs = [] } = useDirectorates();
  const [draft, setDraft] = useState<Record<string, { role: AppRole; areaId: string; dirId?: string }>>({});

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("id, name, status").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["access_requests"] });
    qc.invalidateQueries({ queryKey: ["areas"] });
    qc.invalidateQueries({ queryKey: ["areas-all"] });
    qc.invalidateQueries({ queryKey: ["allowed_emails"] });
  };

  const approve = useMutation({
    mutationFn: async (r: Row) => {
      const d = draft[r.id] ?? { role: "manager" as AppRole, areaId: r.requested_area_id ?? "none" };
      const isDirector = DIRECTOR_ROLES.includes(d.role);
      const areaId = isDirector || d.areaId === "none" ? null : d.areaId;
      if (d.role === "manager" && !areaId) throw new Error("Selecione uma área para o papel Gestor.");
      const { error } = await supabase.rpc("approve_access_request", {
        p_request_id: r.id,
        p_role: d.role,
        p_area_id: areaId ?? undefined,
      });
      if (error) throw error;
      const dir = (d.dirId ?? r.directorate_id ?? "none");
      const dirVal = dir === "none" ? null : dir;
      await supabase.from("allowed_emails").update({ directorate_id: dirVal, phone: r.phone }).eq("email", r.email.toLowerCase());
      await supabase.from("profiles").update({ directorate_id: dirVal }).eq("id", r.user_id);
    },
    onSuccess: () => { toast.success("Acesso liberado — usuário movido para a lista de autorizados"); invalidate(); },
    onError: (e: Error) => toast.error("Não foi possível liberar", { description: e.message }),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reject_access_request", { p_request_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Solicitação recusada"); invalidate(); },
    onError: (e: Error) => toast.error("Não foi possível recusar", { description: e.message }),
  });

  const pending = rows.filter((r) => r.status === "pendente");

  const areaLabel = (id: string | null, fallback: string | null) => {
    if (!id) return fallback || "—";
    const a = areas.find((x) => x.id === id);
    if (!a) return fallback || "—";
    return a.status === "aprovada" ? a.name : `${a.name} (pendente)`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">
          Solicitações pendentes ({pending.length})
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : pending.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            Nenhuma solicitação pendente. Quem entrar com o Google aparecerá aqui até receber um papel.
          </div>
        ) : (
          <ul className="divide-y">
            {pending.map((r) => {
              const d = draft[r.id] ?? { role: "manager" as AppRole, areaId: r.requested_area_id ?? "none" };
              const isDirector = DIRECTOR_ROLES.includes(d.role);
              const set = (patch: Partial<typeof d>) => setDraft((s) => ({ ...s, [r.id]: { ...d, ...patch } }));
              return (
                <li key={r.id} className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.email} · WhatsApp: {r.phone ? formatPhone(r.phone) : "—"} · Área informada: {areaLabel(r.requested_area_id, r.requested_area_name)}
                      </div>
                      <div className="text-xs text-muted-foreground">Acesso em {formatDateBR(r.created_at)}</div>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end">
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Papel</div>
                      <Select value={d.role} onValueChange={(v) => set({ role: v as AppRole })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((x) => <SelectItem key={x} value={x}>{ROLE_TITLE[x]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Área</div>
                      <Select value={isDirector ? "none" : d.areaId} onValueChange={(v) => set({ areaId: v })} disabled={isDirector}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={isDirector ? "Não se aplica" : "Selecione…"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Sem área —</SelectItem>
                          {areas.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}{a.status === "aprovada" ? "" : " (pendente)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Diretoria</div>
                      <Select value={d.dirId ?? r.directorate_id ?? "none"} onValueChange={(v) => set({ dirId: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Sem diretoria —</SelectItem>
                          {dirs.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" onClick={() => approve.mutate(r)} disabled={approve.isPending}>
                      Liberar acesso
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => { if (confirm(`Recusar o acesso de ${r.email}?`)) reject.mutate(r.id); }}
                    >
                      Recusar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

    </div>
  );
}
