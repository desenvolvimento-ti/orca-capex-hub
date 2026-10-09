import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ROLE_TITLE, type AppRole, formatDateBR } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";

const ROLES: AppRole[] = ["manager", "fpa"];

type Row = {
  id: string; email: string; role: AppRole; area_id: string | null; directorate_id: string | null;
  phone: string | null; is_active: boolean; created_at: string;
};

export function useDirectorates() {
  return useQuery({
    queryKey: ["directorates-active"],
    queryFn: async () => (await supabase.from("directorates").select("id, name").eq("is_active", true).order("name")).data ?? [],
  });
}

export function AllowedEmailsPanel() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("manager");
  const [areaId, setAreaId] = useState("none");
  const [dirId, setDirId] = useState("none");
  const [editing, setEditing] = useState<string | null>(null);
  const [ed, setEd] = useState({ role: "manager" as AppRole, areaId: "none", dirId: "none" });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: async () => (await supabase.from("areas").select("id, name").order("name")).data ?? [],
  });
  const { data: dirs = [] } = useDirectorates();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["allowed_emails"],
    queryFn: async () => {
      const { data, error } = await supabase.from("allowed_emails")
        .select("id, email, role, area_id, directorate_id, phone, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["allowed_emails"] });
  const nm = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name ?? "—";
  const n = (v: string) => (v === "none" ? null : v);

  const syncProfile = async (mail: string, fn: (pid: string) => Promise<void>) => {
    const { data: prof } = await supabase.from("profiles").select("id").eq("email", mail).maybeSingle();
    if (prof?.id) await fn(prof.id);
  };

  const create = useMutation({
    mutationFn: async () => {
      const cleaned = email.trim().toLowerCase();
      if (!cleaned.includes("@")) throw new Error("E-mail inválido");
      if (role === "manager" && areaId === "none") throw new Error("Selecione uma área para Gestor");
      const { error } = await supabase.from("allowed_emails").insert({ email: cleaned, role, area_id: n(areaId), directorate_id: n(dirId) });
      if (error) throw error;
    },
    onSuccess: () => { setEmail(""); setAreaId("none"); setDirId("none"); toast.success("E-mail autorizado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (r: Row) => {
      if (ed.role === "manager" && ed.areaId === "none") throw new Error("Selecione uma área para Gestor");
      const { error } = await supabase.from("allowed_emails")
        .update({ role: ed.role, area_id: n(ed.areaId), directorate_id: n(ed.dirId) }).eq("id", r.id);
      if (error) throw error;
      await syncProfile(r.email, async (pid) => {
        if (r.is_active) {
          await supabase.from("user_roles").delete().eq("user_id", pid);
          await supabase.from("user_roles").insert({ user_id: pid, role: ed.role });
        }
        await supabase.from("profiles").update({ area_id: n(ed.areaId), directorate_id: n(ed.dirId) }).eq("id", pid);
      });
    },
    onSuccess: () => { toast.success("Autorização atualizada"); setEditing(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ r, v }: { r: Row; v: boolean }) => {
      const { error } = await supabase.from("allowed_emails").update({ is_active: v }).eq("id", r.id);
      if (error) throw error;
      await syncProfile(r.email, async (pid) => {
        await supabase.from("user_roles").delete().eq("user_id", pid);
        if (v) await supabase.from("user_roles").insert({ user_id: pid, role: r.role });
      });
    },
    onSuccess: (_d, { v }) => { toast.success(v ? "Acesso ativado" : "Acesso desativado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("allowed_emails").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sel = (value: string, set: (v: string) => void, list: { id: string; name: string }[], none: string, cls = "") => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger className={cls}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{none}</SelectItem>
        {list.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const roleSel = (value: AppRole, set: (v: AppRole) => void, cls = "") => (
    <Select value={value} onValueChange={(v) => set(v as AppRole)}>
      <SelectTrigger className={cls}><SelectValue /></SelectTrigger>
      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_TITLE[r]}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[2fr_1fr_1.2fr_1.2fr_auto] md:items-end"
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        <div><Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" placeholder="usuario@beachpark.com.br" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>Papel</Label>{roleSel(role, setRole)}</div>
        <div><Label>Área {role === "manager" && <span className="text-destructive">*</span>}</Label>{sel(areaId, setAreaId, areas, "— Sem área —")}</div>
        <div><Label>Diretoria</Label>{sel(dirId, setDirId, dirs, "— Sem diretoria —")}</div>
        <Button type="submit" disabled={create.isPending}>Autorizar</Button>
      </form>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">Usuários autorizados ({rows.length})</div>
        {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          : rows.length === 0 ? <div className="p-6 text-sm text-muted-foreground">Nenhum e-mail autorizado ainda.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">E-mail</th><th className="px-4 py-2">Papel</th><th className="px-4 py-2">Área</th>
                    <th className="px-4 py-2">Diretoria</th><th className="px-4 py-2">WhatsApp</th><th className="px-4 py-2">Cadastrado em</th>
                    <th className="px-4 py-2">Ativo</th><th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const isEd = editing === r.id;
                    return (
                      <tr key={r.id} className={r.is_active ? "" : "opacity-60"}>
                        <td className="px-4 py-2 font-medium">{r.email}</td>
                        <td className="px-4 py-2">{isEd ? roleSel(ed.role, (v) => setEd({ ...ed, role: v }), "h-8 w-[130px]") : ROLE_TITLE[r.role]}</td>
                        <td className="px-4 py-2 text-muted-foreground">{isEd ? sel(ed.areaId, (v) => setEd({ ...ed, areaId: v }), areas, "— Sem área —", "h-8 w-[180px]") : nm(areas, r.area_id)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{isEd ? sel(ed.dirId, (v) => setEd({ ...ed, dirId: v }), dirs, "— Sem diretoria —", "h-8 w-[180px]") : nm(dirs, r.directorate_id)}</td>
                        <td className="px-4 py-2 text-muted-foreground tabular-nums">{r.phone ? formatPhone(r.phone) : "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDateBR(r.created_at)}</td>
                        <td className="px-4 py-2"><Switch checked={r.is_active} onCheckedChange={(v) => toggle.mutate({ r, v })} /></td>
                        <td className="px-4 py-2 text-right">
                          {isEd ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                              <Button size="sm" disabled={update.isPending} onClick={() => update.mutate(r)}>Salvar</Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setEditing(r.id); setEd({ role: r.role, areaId: r.area_id ?? "none", dirId: r.directorate_id ?? "none" }); }}>Editar</Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Remover autorização de ${r.email}?`)) remove.mutate(r.id); }}>Excluir</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
