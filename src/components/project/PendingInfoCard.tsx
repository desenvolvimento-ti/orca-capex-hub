import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useDocKeys, useRequiredDocs, useSchedule } from "@/components/project/ProposalForm";
import { useAuth } from "@/hooks/use-auth";
import { isDelegated, stage1Split, stage2Pending, scrollToAnchor, type Pending, type Stage1Data, type Stage2Data } from "@/lib/project-rules";

function List({ title, items }: { title?: string; items: Pending[] }) {
  return (
    <div>
      {title && <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</div>}
      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" /> Nada pendente.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((m, i) => (
            <li key={i}>
              <button type="button" onClick={() => scrollToAnchor(m.anchor)} className="text-left hover:underline">• {m.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lista de pendências da etapa atual (com base no que já foi salvo), separada por área quando delegado. */
export function PendingInfoCard({ projectId, data, stage = 1 }: { projectId: string; data: Stage1Data & Stage2Data & { area_id?: string | null; executor_area_id?: string | null }; stage?: 1 | 2 }) {
  const { profile, isRealFpa } = useAuth();
  const { data: schedule = [] } = useSchedule(projectId, stage === 2 ? "firme" : "indicativo");
  const { data: docKeys = new Set<string>() } = useDocKeys(projectId);
  const { data: reqDocs = [] } = useRequiredDocs(stage);

  if (stage === 1) {
    const split = stage1Split(data, schedule, docKeys, reqDocs);
    const total = split.requester.length + split.executor.length;
    const delegated = isDelegated(data);
    const amExecutor = delegated && profile?.area_id === data.executor_area_id && !isRealFpa;
    if (amExecutor) {
      return split.executor.length === 0
        ? <div className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Sua parte está completa.</div>
        : <div className="text-sm"><List title="Pendências da área executora" items={split.executor} /></div>;
    }
    if (total === 0) return <div className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Tudo preenchido — aguardando submissão.</div>;
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4 text-warning" /> Falta preencher ({total}):</div>
        {delegated ? (
          <>
            <List title="Pendências da área solicitante" items={split.requester} />
            <List title="Pendências da área executora" items={split.executor} />
          </>
        ) : <List items={[...split.requester, ...split.executor]} />}
      </div>
    );
  }

  const pending = stage2Pending(data, schedule, docKeys, reqDocs);
  return (
    <div className="text-sm">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Etapa 2 · Planejamento</div>
      {pending.length === 0 ? (
        <div className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" /> Tudo preenchido — aguardando submissão.</div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4 text-warning" /> Falta preencher ({pending.length}):</div>
          <List items={pending} />
        </>
      )}
    </div>
  );
}
