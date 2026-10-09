import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus, GripVertical } from "lucide-react";

type Row = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  required_for_stage: number;
  active: boolean;
  is_required: boolean;
  sort_order: number;
  uploader_role: string;
};

const UPLOADERS = [
  { v: "ambos", l: "Ambos" },
  { v: "solicitante", l: "Solicitante" },
  { v: "executora", l: "Executora" },
];

const STAGES = [
  { n: 1, title: "Etapa 1 - Proposta Indicativa" },
  { n: 2, title: "Etapa 2 - Planejamento" },
];

const KEYS = ["required_document_types", "required_document_types_active", "required-docs"];

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function RequiredDocsPanel() {
  const qc = useQueryClient();
  const invalidate = () => KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["required_document_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("required_document_types")
        .select("id, key, label, description, required_for_stage, active, is_required, sort_order, uploader_role")
        .order("sort_order")
        .order("label");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [draft, setDraft] = useState({ label: "", description: "", required_for_stage: "1", is_required: true, uploader_role: "ambos" });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const label = draft.label.trim();
      if (!label) throw new Error("Informe o nome.");
      const stage = Number(draft.required_for_stage) || 1;
      const base = slugify(label) || "documento";
      const existing = new Set(rows.map((r) => r.key));
      let key = base; let i = 2;
      while (existing.has(key)) key = `${base}_${i++}`;
      const maxOrder = Math.max(0, ...rows.filter((r) => r.required_for_stage === stage).map((r) => r.sort_order));
      const { error } = await supabase.from("required_document_types").insert({
        key, label,
        description: draft.description.trim() || null,
        required_for_stage: stage,
        sort_order: maxOrder + 1,
        active: true,
        is_required: draft.is_required,
        uploader_role: draft.uploader_role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento criado");
      setDraft({ label: "", description: "", required_for_stage: draft.required_for_stage, is_required: true, uploader_role: "ambos" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Row> }) => {
      const { error } = await supabase.from("required_document_types").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, stage, beforeId }: { id: string; stage: number; beforeId: string | null }) => {
      const list = rows.filter((r) => r.required_for_stage === stage && r.id !== id);
      const idx = beforeId ? list.findIndex((r) => r.id === beforeId) : list.length;
      const moved = rows.find((r) => r.id === id)!;
      list.splice(idx < 0 ? list.length : idx, 0, moved);
      const ops = list.map((r, i) => {
        const patch: Partial<Row> = {};
        if (r.sort_order !== i + 1) patch.sort_order = i + 1;
        if (r.id === id && r.required_for_stage !== stage) patch.required_for_stage = stage;
        return Object.keys(patch).length ? supabase.from("required_document_types").update(patch).eq("id", r.id) : null;
      }).filter(Boolean);
      const res = await Promise.all(ops);
      const err = res.find((r: any) => r?.error);
      if (err) throw (err as any).error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("required_document_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Documento removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDrop = (stage: number, beforeId: string | null) => {
    if (dragId && dragId !== beforeId) move.mutate({ id: dragId, stage, beforeId });
    setDragId(null); setOverKey(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Documentos</h2>
        <p className="text-sm text-muted-foreground">
          Defina os documentos solicitados em cada etapa. Arraste pelos pontinhos para reordenar ou mover entre etapas.
          Obrigatórios bloqueiam a submissão; inativos ficam ocultos para o gestor.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Carregando…</div>
      ) : STAGES.map((s) => {
        const list = rows.filter((r) => r.required_for_stage === s.n);
        return (
          <div
            key={s.n}
            className={`rounded-lg border bg-card ${overKey === `stage-${s.n}` ? "ring-2 ring-primary/40" : ""}`}
            onDragOver={(e) => { e.preventDefault(); if (!overKey?.startsWith("row-")) setOverKey(`stage-${s.n}`); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverKey(null); }}
            onDrop={(e) => { e.preventDefault(); onDrop(s.n, null); }}
          >
            <div className="border-b px-4 py-3 text-sm font-semibold">{s.title}</div>
            {list.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhum documento. Arraste um documento para cá ou adicione abaixo.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-2"></th>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Quem pode anexar</th>
                    <th className="px-3 py-2">Obrigatório</th>
                    <th className="px-3 py-2">Ativo</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((r) => (
                    <tr
                      key={r.id}
                      draggable
                      onDragStart={(e) => { setDragId(r.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragId(null); setOverKey(null); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOverKey(`row-${r.id}`); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(s.n, r.id); }}
                      className={`${dragId === r.id ? "opacity-40" : ""} ${overKey === `row-${r.id}` ? "border-t-2 border-t-primary" : ""}`}
                    >
                      <td className="cursor-grab px-2 py-2 text-muted-foreground active:cursor-grabbing" title="Arrastar">
                        <GripVertical className="h-4 w-4" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.label}</div>
                        {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <Select value={r.uploader_role ?? "ambos"} onValueChange={(v) => update.mutate({ id: r.id, patch: { uploader_role: v } })}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{UPLOADERS.map((u) => <SelectItem key={u.v} value={u.v}>{u.l}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Switch checked={r.is_required} onCheckedChange={(v) => update.mutate({ id: r.id, patch: { is_required: v } })} />
                      </td>
                      <td className="px-3 py-2">
                        <Switch checked={r.active} onCheckedChange={(v) => update.mutate({ id: r.id, patch: { active: v } })} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => { if (confirm(`Remover "${r.label}"?`)) remove.mutate(r.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Adicionar documento</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Nome <span className="text-destructive">*</span></Label>
            <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Cotações" />
          </div>
          <div>
            <Label>Etapa</Label>
            <Select value={draft.required_for_stage} onValueChange={(v) => setDraft({ ...draft, required_for_stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s.n} value={String(s.n)}>{s.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </div>
          <div className="md:col-span-4">
            <Label>Descrição</Label>
            <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Curta descrição do que o documento deve conter" />
          </div>
          <div className="md:col-span-2">
            <Label>Quem pode anexar</Label>
            <Select value={draft.uploader_role} onValueChange={(v) => setDraft({ ...draft, uploader_role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UPLOADERS.map((u) => <SelectItem key={u.v} value={u.v}>{u.l}</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">Só vale quando a área executora é diferente da solicitante.</p>
          </div>
          <div className="flex items-center gap-2 md:col-span-4">
            <Switch checked={draft.is_required} onCheckedChange={(v) => setDraft({ ...draft, is_required: v })} />
            <Label>Obrigatório</Label>
          </div>
        </div>
      </div>
    </div>
  );
}
