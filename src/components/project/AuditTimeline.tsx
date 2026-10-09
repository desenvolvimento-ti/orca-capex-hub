import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, ROLE_LABEL, type AppRole } from "@/lib/labels";
import { FileText, MessageSquare, GitCommitHorizontal, Paperclip } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Row = {
  event_at: string; kind: "status" | "change_request" | "document" | "comment";
  actor_id: string | null; actor_name: string | null; actor_role: string | null;
  from_status: string | null; to_status: string | null;
  comment: string | null; ref_id: string | null;
};

const ICON: Record<Row["kind"], any> = {
  status: GitCommitHorizontal,
  change_request: FileText,
  document: Paperclip,
  comment: MessageSquare,
};
const KIND_LABEL: Record<Row["kind"], string> = {
  status: "Status", change_request: "Alteração", document: "Documento", comment: "Comentário",
};

export function AuditTimeline({ projectId }: { projectId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit-timeline", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("project_audit_timeline", { p_project_id: projectId });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (data.length === 0) return <div className="text-sm text-muted-foreground">Sem eventos registrados.</div>;

  return (
    <ol className="relative space-y-4 border-l pl-5">
      {data.map((r, i) => {
        const Icon = ICON[r.kind];
        return (
          <li key={`${r.ref_id}-${i}`} className="relative">
            <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border bg-background">
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wider">{KIND_LABEL[r.kind]}</span>
              <span>{new Date(r.event_at).toLocaleString("pt-BR")}</span>
              <span>· {formatDistanceToNow(new Date(r.event_at), { addSuffix: true, locale: ptBR })}</span>
              <span>· {r.actor_name ?? "—"}</span>
              {r.actor_role && <span>({ROLE_LABEL[r.actor_role as AppRole] ?? r.actor_role})</span>}
            </div>
            {(r.from_status || r.to_status) && (
              <div className="mt-0.5 text-sm">
                {r.from_status && <span className="text-muted-foreground">{STATUS_LABEL[r.from_status as keyof typeof STATUS_LABEL] ?? r.from_status} → </span>}
                {r.to_status && <span className="font-medium">{STATUS_LABEL[r.to_status as keyof typeof STATUS_LABEL] ?? r.to_status}</span>}
              </div>
            )}
            {r.comment && <div className="mt-0.5 whitespace-pre-wrap text-sm">{r.comment}</div>}
          </li>
        );
      })}
    </ol>
  );
}
