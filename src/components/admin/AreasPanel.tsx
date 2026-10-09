import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/labels";

export function AreasPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("areas").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["areas"] });
    qc.invalidateQueries({ queryKey: ["areas-executor-options"] });
  };

  const create = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabase.from("areas").insert({ name: n.trim(), status: "aprovada" });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); toast.success("Área criada"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { name?: string; status?: string; can_execute_for_others?: boolean } }) => {
      const { error } = await supabase.from("areas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setEditingId(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Área removida"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendentes = areas.filter((a) => a.status !== "aprovada").length;

  return (
    <div className="space-y-6">
      <form className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(name); }}>
        <div>
          <Label htmlFor="area-name">Nova área</Label>
          <Input id="area-name" placeholder="Ex.: Tecnologia, Alimentos & Bebidas" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" disabled={!name.trim() || create.isPending}>Adicionar</Button>
      </form>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">
          Áreas cadastradas ({areas.length})
          {pendentes > 0 && <span className="ml-2 text-xs font-normal text-warning">{pendentes} aguardando aprovação</span>}
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : areas.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhuma área cadastrada ainda.</div>
        ) : (
          <ul className="divide-y">
            {areas.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                {editingId === a.id ? (
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Label>Nome</Label>
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => update.mutate({ id: a.id, patch: { name: editingName.trim() } })} disabled={!editingName.trim()}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {a.name}
                        {a.status !== "aprovada" && (
                          <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[11px] font-normal text-warning">Aguardando aprovação</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">Criada em {formatDateBR(a.created_at)}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch checked={!!a.can_execute_for_others}
                          onCheckedChange={(v) => update.mutate({ id: a.id, patch: { can_execute_for_others: v } })} />
                        Pode executar projetos de outras áreas
                      </label>
                      {a.status !== "aprovada" && (
                        <Button size="sm" onClick={() => update.mutate({ id: a.id, patch: { status: "aprovada" } })}>Aprovar</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(a.id); setEditingName(a.name); }}>Editar</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Remover a área "${a.name}"?`)) remove.mutate(a.id); }}>Excluir</Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
