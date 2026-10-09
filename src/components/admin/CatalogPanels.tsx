import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phone";

type Field = { key: string; label: string; required?: boolean; placeholder?: string; mask?: "phone" };
type Table = "branches" | "business_units" | "directorates";

function friendly(e: { message: string; code?: string }) {
  if (e.code === "23503") return "Não é possível excluir: há registros vinculados. Desative em vez de excluir.";
  if (e.code === "23505") return "Já existe um cadastro com esse nome.";
  return e.message;
}

function CatalogPanel({
  table, title, fields, extra, extraLabel, columnsFor, groupBy,
}: {
  table: Table; title: string; fields: Field[];
  extra?: { key: string; options: { id: string; name: string }[] };
  extraLabel?: string;
  columnsFor?: (r: Record<string, any>) => string;
  groupBy?: { key: string; label: (id: string) => string };
}) {
  const qc = useQueryClient();
  const empty = Object.fromEntries([...fields.map((f) => [f.key, ""]), ...(extra ? [[extra.key, ""]] : [])]);
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").order("name");
      if (error) throw error;
      return data as Record<string, any>[];
    },
  });

  const validate = (v: Record<string, string>) => {
    for (const f of fields) if (f.required && !v[f.key]?.trim()) throw new Error(`Informe ${f.label.toLowerCase()}.`);
    if (extra && !v[extra.key]) throw new Error(`Selecione ${extraLabel?.toLowerCase()}.`);
    if (v.email && !v.email.includes("@")) throw new Error("E-mail inválido.");
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() || null]));
  };
  const refresh = () => qc.invalidateQueries({ queryKey: [table] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(table).insert(validate(form) as never);
      if (error) throw new Error(friendly(error));
    },
    onSuccess: () => { setForm(empty); toast.success("Cadastrado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(table).update(validate(edit) as never).eq("id", editId!);
      if (error) throw new Error(friendly(error));
    },
    onSuccess: () => { setEditId(null); toast.success("Atualizado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, v }: { id: string; v: boolean }) => {
      const { error } = await supabase.from(table).update({ is_active: v } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(friendly(error));
    },
    onSuccess: () => { toast.success("Excluído"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const inputs = (v: Record<string, string>, set: (v: Record<string, string>) => void) => (
    <>
      {extra && (
        <div>
          <Label>{extraLabel} <span className="text-destructive">*</span></Label>
          <Select value={v[extra.key] || undefined} onValueChange={(x) => set({ ...v, [extra.key]: x })}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>{extra.options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {fields.map((f) => (
        <div key={f.key}>
          <Label>{f.label} {f.required && <span className="text-destructive">*</span>}</Label>
          <Input value={v[f.key] ?? ""} placeholder={f.placeholder} inputMode={f.mask ? "numeric" : undefined} onChange={(e) => set({ ...v, [f.key]: f.mask ? formatPhone(e.target.value) : e.target.value })} />
        </div>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] md:items-end"
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
        {inputs(form, setForm)}
        <Button type="submit" disabled={create.isPending}>Adicionar</Button>
      </form>
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-medium">{title} ({rows.length})</div>
        {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          : rows.length === 0 ? <div className="p-6 text-sm text-muted-foreground">Nenhum cadastro ainda.</div>
          : (
            <div>{(groupBy ? [...new Set(rows.map((r) => r[groupBy.key] as string))].sort((a, b) => groupBy.label(a).localeCompare(groupBy.label(b))) : [null]).map((g) => (
            <div key={g ?? "all"}>
            {groupBy && g && <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{groupBy.label(g)} ({rows.filter((r) => r[groupBy.key] === g).length})</div>}
            <ul className="divide-y border-b last:border-b-0">
              {rows.filter((r) => !groupBy || r[groupBy.key] === g).map((r) => (
                <li key={r.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  {editId === r.id ? (
                    <div className="grid flex-1 gap-2 md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] md:items-end">
                      {inputs(edit, setEdit)}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => update.mutate()} disabled={update.isPending}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="font-medium">{r.name}{!r.is_active && <span className="ml-2 text-xs font-normal text-muted-foreground">(inativo)</span>}</div>
                        {columnsFor && <div className="text-xs text-muted-foreground">{columnsFor(r)}</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch checked={!!r.is_active} onCheckedChange={(v) => toggle.mutate({ id: r.id, v })} /> Ativo
                        </label>
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditId(r.id);
                          setEdit(Object.fromEntries(Object.keys(empty).map((k) => [k, r[k] ?? ""])));
                        }}>Editar</Button>
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => confirm(`Excluir "${r.name}"?`) && remove.mutate(r.id)}>Excluir</Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
            </div>))}
            </div>
          )}
      </div>
    </div>
  );
}

export function BranchesPanel() {
  return <CatalogPanel table="branches" title="Filiais cadastradas"
    fields={[{ key: "name", label: "Nome da filial", required: true, placeholder: "Ex.: Fortaleza" }, { key: "code", label: "Código", placeholder: "Opcional" }]}
    columnsFor={(r) => (r.code ? `Código: ${r.code}` : "")} />;
}

export function BusinessUnitsPanel() {
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const nameOf = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  if (branches.length === 0) return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Cadastre ao menos uma filial antes de criar unidades de negócio.</div>;
  return <CatalogPanel table="business_units" title="Unidades de negócio cadastradas"
    extra={{ key: "branch_id", options: branches.map((b) => ({ id: b.id, name: b.name })) }} extraLabel="Filial"
    fields={[{ key: "name", label: "Nome da unidade", required: true, placeholder: "Ex.: Parque Aquático" }]}
    groupBy={{ key: "branch_id", label: nameOf }} />;
}

export function DirectoratesPanel() {
  return <CatalogPanel table="directorates" title="Diretorias cadastradas"
    fields={[
      { key: "name", label: "Nome da diretoria", required: true, placeholder: "Ex.: Diretoria de Operações" },
      { key: "director_name", label: "Diretor", required: true },
      { key: "phone", label: "Telefone", mask: "phone", placeholder: "(85) 99999-0000" },
      { key: "email", label: "E-mail" },
    ]}
    columnsFor={(r) => [`Diretor: ${r.director_name}`, r.phone ? formatPhone(r.phone) : null, r.email].filter(Boolean).join(" · ")} />;
}
