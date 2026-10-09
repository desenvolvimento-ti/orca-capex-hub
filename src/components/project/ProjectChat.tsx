import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL, type AppRole } from "@/lib/labels";

interface Comment {
  id: string;
  author_id: string;
  author_role: AppRole | null;
  body: string;
  created_at: string;
  author_name?: string;
}

export function ProjectChat({ projectId }: { projectId: string }) {
  const { profile, effectiveRole, isRealFpa } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["project-comments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_comments" as never)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Comment[];
      const ids = Array.from(new Set(rows.map((r) => r.author_id)));
      const map = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        (profs ?? []).forEach((p) => map.set(p.id, p.full_name));
      }
      return rows.map((r) => ({ ...r, author_name: map.get(r.author_id) ?? "—" }));
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Sem sessão");
      const text = body.trim();
      if (!text) throw new Error("Digite uma mensagem.");
      const { error } = await supabase.from("project_comments" as never).insert({
        project_id: projectId,
        author_id: profile.id,
        author_role: effectiveRole,
        body: text,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["project-comments", projectId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_comments" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-comments", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : comments.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Use este espaço para alinhamentos com a equipe.
          </div>
        ) : (
          comments.map((c) => {
            const isMine = c.author_id === profile?.id;
            const canDelete = isMine || isRealFpa;
            return (
              <div key={c.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg border p-3 text-sm ${isMine ? "bg-primary/10 border-primary/30" : "bg-muted/40"}`}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span>
                      {c.author_name}
                      {c.author_role && <> · <span className="font-medium">{ROLE_LABEL[c.author_role]}</span></>}
                    </span>
                    <span>{new Date(c.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                  {canDelete && (
                    <button
                      onClick={() => { if (confirm("Apagar este comentário?")) remove.mutate(c.id); }}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> apagar
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2 border-t pt-3">
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva uma mensagem para o FP&A ou para o gestor…"
        />
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => send.mutate()} disabled={send.isPending || !body.trim()}>
            <MessageSquare className="mr-1 h-4 w-4" /> Enviar mensagem
          </Button>
        </div>
      </div>
    </div>
  );
}
