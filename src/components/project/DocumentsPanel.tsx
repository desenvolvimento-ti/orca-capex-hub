import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { projectDocPath } from "@/lib/storage";
import { formatDateBR } from "@/lib/labels";
import { Upload, Loader2, Check, AlertCircle, Paperclip } from "lucide-react";

type DocType = { id: string; key: string; label: string; description: string | null; required_for_stage: number; active: boolean; is_required: boolean; sort_order: number; uploader_role: string };
type Doc = { id: string; file_name: string; file_path: string; uploaded_at: string; uploaded_by: string; doc_type_id: string | null };

export function DocumentsPanel({
  projectId, canEdit, stage, lockedReason, title = "Documentos",
}: { projectId: string; canEdit: boolean; stage?: 1 | 2; lockedReason?: string; title?: string }) {
  const { profile, isRealFpa } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [pickedType, setPickedType] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["docs", projectId],
    queryFn: async (): Promise<Doc[]> => {
      const { data, error } = await supabase
        .from("project_documents")
        .select("id, file_name, file_path, uploaded_at, uploaded_by, doc_type_id")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });

  const { data: allTypes = [] } = useQuery({
    queryKey: ["required_document_types_active"],
    queryFn: async (): Promise<DocType[]> => {
      const { data, error } = await supabase
        .from("required_document_types")
        .select("id, key, label, description, required_for_stage, active, is_required, sort_order, uploader_role")
        .eq("active", true)
        .order("sort_order")
        .order("label");
      if (error) throw error;
      return (data ?? []) as DocType[];
    },
  });

  const { data: proj } = useQuery({
    queryKey: ["project-doc-roles", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("owner_id, area_id, executor_area_id").eq("id", projectId).maybeSingle();
      return data;
    },
  });
  const delegated = !!proj?.executor_area_id && proj.executor_area_id !== proj.area_id;
  const amRequester = !!proj && proj.owner_id === profile?.id;
  const amExecutor = delegated && profile?.area_id === proj?.executor_area_id;
  const canUploadType = (t?: DocType) => {
    if (!canEdit && !(amExecutor)) return false;
    if (!t || !delegated || isRealFpa) return canEdit || amExecutor;
    if (t.uploader_role === "solicitante") return amRequester;
    if (t.uploader_role === "executora") return amExecutor;
    return amRequester || amExecutor;
  };
  const restrictMsg = (t: DocType) =>
    t.uploader_role === "solicitante" ? "Envio restrito à Área Solicitante" : t.uploader_role === "executora" ? "Envio restrito à Área Executora" : "";

  const types = stage ? allTypes.filter((t) => t.required_for_stage === stage) : allTypes;
  const typeIds = new Set(types.map((t) => t.id));
  const allTypeIds = new Set(allTypes.map((t) => t.id));
  const visibleDocs = stage
    ? docs.filter((d) => (d.doc_type_id ? typeIds.has(d.doc_type_id) || (!allTypeIds.has(d.doc_type_id) && stage === 2) : stage === 2))
    : docs;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["docs", projectId] });
    qc.invalidateQueries({ queryKey: ["doc-keys", projectId] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!profile) throw new Error("Sessão expirada.");
      const path = projectDocPath(profile.id, projectId, file);
      const { error: upErr } = await supabase.storage.from("project-docs").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("project_documents").insert({
        project_id: projectId, file_name: file.name, file_path: path, uploaded_by: profile.id,
        doc_type_id: pickedType || null,
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: () => { toast.success("Documento anexado"); setPickedType(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      await supabase.storage.from("project-docs").remove([path]);
      const { error } = await supabase.from("project_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("project-docs").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.target = "_blank"; a.click();
  };

  const hasType = new Set(docs.map((d) => d.doc_type_id).filter(Boolean) as string[]);

  const triggerUploadForType = (typeId: string | "") => {
    if (!canUploadType(allTypes.find((t) => t.id === typeId))) return;
    setPickedType(typeId);
    // Wait for state to flush before opening picker
    setTimeout(() => inputRef.current?.click(), 0);
  };

  return (
    <div className="space-y-4">
      {types.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => {
              const ok = hasType.has(t.id);
              const clickable = canUploadType(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => triggerUploadForType(t.id)}
                  className={`group flex items-start gap-3 rounded-md border p-3 text-left transition ${
                    ok
                      ? "border-success/40 bg-success/5"
                      : t.is_required
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20"
                  } ${clickable ? "hover:border-primary hover:bg-primary/5" : "cursor-default"}`}
                >
                  {ok ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${t.is_required ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm ${ok ? "" : "font-medium"}`}>{t.label}</span>
                      <span className={`text-[10px] uppercase tracking-wider ${t.is_required ? "text-destructive" : "text-muted-foreground"}`}>{t.is_required ? "Obrigatório" : "Opcional"}</span>
                    </div>
                    {t.description && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
                    )}
                    {delegated && t.uploader_role !== "ambos" && (
                      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t.uploader_role === "solicitante" ? "Responsável: área solicitante" : "Responsável: área executora"}
                      </div>
                    )}
                    {!clickable && (canEdit || amExecutor) && restrictMsg(t) && (
                      <div className="mt-1 text-[11px] text-muted-foreground">{restrictMsg(t)}</div>
                    )}
                    {clickable && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-primary opacity-0 transition group-hover:opacity-100">
                        <Paperclip className="h-3 w-3" /> {ok ? "Anexar outro" : "Anexar documento"}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <div className="border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Documentos anexados
        </div>
        {visibleDocs.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum documento anexado.</div>
        ) : (
          <ul className="divide-y text-sm">
            {visibleDocs.map((d) => {
              const t = allTypes.find((x) => x.id === d.doc_type_id);
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <button onClick={() => download(d.file_path, d.file_name)} className="truncate text-left text-primary hover:underline">{d.file_name}</button>
                    {t && <div className="text-xs text-muted-foreground">{t.label}</div>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDateBR(d.uploaded_at)}</span>
                    {(canEdit || amExecutor) && d.uploaded_by === profile?.id && (
                      <button onClick={() => remove.mutate({ id: d.id, path: d.file_path })} className="text-destructive hover:underline">Remover</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canEdit || amExecutor ? (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            disabled={uploading || upload.isPending}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              await upload.mutateAsync(f).catch(() => {});
              setUploading(false);
              e.target.value = "";
            }}
          />
                    {(uploading || upload.isPending) && <p className="text-xs text-muted-foreground">Enviando…</p>}
          <p className="text-xs text-muted-foreground">
            Clique em um item acima para anexar o arquivo já no tipo correto.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{lockedReason ?? "Anexos indisponíveis nesta situação do projeto."}</p>
      )}
    </div>
  );
}
