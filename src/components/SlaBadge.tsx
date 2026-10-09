import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, AlertTriangle } from "lucide-react";
import type { SlaInfo } from "@/lib/sla";

const TONE: Record<string, string> = {
  ok: "bg-success/10 text-success border-success/30",
  atencao: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  atrasado: "bg-destructive/10 text-destructive border-destructive/30",
};

export function SlaBadge({ info, compact }: { info: SlaInfo; compact?: boolean }) {
  if (info.threshold == null) {
    return compact ? null : (
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">—</span>
    );
  }
  const tone = TONE[info.level] ?? TONE.ok;
  const label = compact ? `${info.days}d` : `${info.days}d / ${info.threshold}d`;
  const tipLabel = info.level === "atrasado"
    ? `Atrasado: ${info.days} dias no status (limite ${info.threshold}).`
    : info.level === "atencao"
    ? `Atenção: ${info.days} dias no status (limite ${info.threshold}).`
    : `${info.days} dias no status (limite ${info.threshold}).`;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] tabular-nums ${tone}`}>
            {info.level === "atrasado" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
