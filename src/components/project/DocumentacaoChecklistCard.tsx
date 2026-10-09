import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { projectDocPath } from "@/lib/storage";
import { formatBRL, formatDateBR } from "@/lib/labels";
import { Check, AlertCircle, Upload, Loader2, FileText, Send } from "lucide-react";

/**
 * Etapa 3 · Aguardando documentação.
 * Mostra checklist de docs obrigatórios (stage 2), cada item abre popup para anexar
 * o documento tipado, e um botão "Submeter documentação" que chama `submeter_documentacao`.
 */
type DocType = {
  id: string; key: string; label: string; description: string | null;
  required_for_stage: number; sort_order: number;
};
type Doc = { id: string; file_name: string; file_path: string; uploaded_at: string; doc_type_id: string | null };

export function DocumentacaoChecklistCard({
  projectId,
  suggestedAmount,
  canSubmit,
}: {
  projectId: string;
  suggestedAmount: number | null;
  canSubmit: boolean;
}) {
  const qc = useQueryClient();
  const [pickerFor, setPickerFor] = useState<DocType | null>(null);

  const { data: types = [] } = useQuery({
    queryKey: ["required_document_types_active"],
    queryFn: async (): Promise<DocType[]> => {
      const { data, error } = await supabase
        .from("required_document_types")
        .select("id, key, label, description, required_for_stage, sort_order")
        .eq("active", true)
        .lte("required_for_stage", 2)
        .order("sort_order")
        .order("label");
      if (error) throw error;
      return (data ?? []) as DocType[];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["docs", projectId],
    queryFn: async (): Promise<Doc[]> => {
      const { data, error } = await supabase
        .from("project_documents")
        .select("id, file_name, file_path, uploaded_at, doc_type_id")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });

  const docsByType = useMemo(() => {
    const m = new Map<string, Doc[]>();
    docs.forEach((d) => {
      if (!d.doc_type_id) return;
      m.set(d.doc_type_id, [...(m.get(d.doc_type_id) ?? []), d]);
    });
    return m;
  }, [docs]);

  const missing = types.filter((t) => t.required_for_stage === 2 && !docsByType.get(t.id)?.length);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submeter_documentacao", { p_project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documentação enviada para análise FP&A");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["history", projectId] });
      qc.invalidateQueries({ queryKey: ["manager-projects"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {suggestedAmount != null && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor pré-aprovado</div>
          <div className="font-medium tabular-nums">{formatBRL(suggestedAmount)}</div>
        </div>
      )}

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Documentos obrigatórios (Orçamentação)
        </div>
        {types.filter((t) => t.required_for_stage === 2).length === 0 ? (
          <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            Nenhum documento obrigatório configurado para esta etapa.
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {types.filter((t) => t.required_for_stage === 2).map((t) => {
              const attached = docsByType.get(t.id) ?? [];
              const ok = attached.length > 0;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => canSubmit && setPickerFor(t)}
                    disabled={!canSubmit}
                    className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition ${
                      ok ? "border-success/40 bg-success/5" : "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                    } ${!canSubmit ? "cursor-default opacity-70" : ""}`}
                  >
                    {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{t.label}</div>
                      {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                      {ok ? (
                        <div className="mt-1 space-y-0.5">
                          {attached.map((d) => (
                            <div key={d.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span className="truncate">{d.file_name}</span>
                              <span>· {formatDateBR(d.uploaded_at)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">Clique para anexar</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {canSubmit && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="text-xs text-muted-foreground">
            {missing.length === 0
              ? "Todos os documentos obrigatórios anexados."
              : `Faltam ${missing.length} documento(s) obrigatório(s).`}
          </div>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending || missing.length > 0}>
            <Send className="mr-1 h-4 w-4" />
            {submit.isPending ? "Enviando…" : "Submeter documentação"}
          </Button>
        </div>
      )}

      {pickerFor && (
        <UploadDialog
          docType={pickerFor}
          projectId={projectId}
          onClose={() => setPickerFor(null)}
          onUploaded={() => {
            qc.invalidateQueries({ queryKey: ["docs", projectId] });
          }}
        />
      )}
    </div>
  );
}

function UploadDialog({
  docType, projectId, onClose, onUploaded,
}: { docType: DocType; projectId: string; onClose: () => void; onUploaded: () => void }) {
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!profile) throw new Error("Sessão expirada.");
      const path = projectDocPath(profile.id, projectId, file);
      const { error: upErr } = await supabase.storage.from("project-docs").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("project_documents").insert({
        project_id: projectId, file_name: file.name, file_path: path,
        uploaded_by: profile.id, doc_type_id: docType.id,
      });
      if (dbErr) throw dbErr;
    },
    onSuccess: () => { toast.success("Documento anexado"); onUploaded(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anexar: {docType.label}</DialogTitle>
        </DialogHeader>
        {docType.description && (
          <p className="text-sm text-muted-foreground">{docType.description}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          disabled={busy || upload.isPending}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            await upload.mutateAsync(f).catch(() => {});
            setBusy(false);
            e.target.value = "";
          }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => inputRef.current?.click()} disabled={busy || upload.isPending}>
            {busy || upload.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
              : <><Upload className="mr-2 h-4 w-4" /> Selecionar arquivo</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
