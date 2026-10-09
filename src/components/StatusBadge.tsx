import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import { isAwaitingNextPhase } from "@/lib/features";

type Status = keyof typeof STATUS_LABEL;

const TONE_CLASS: Record<string, string> = {
  neutral: "bg-muted text-foreground hover:bg-muted",
  info: "bg-primary/15 text-primary hover:bg-primary/15",
  warn: "bg-warning/20 text-warning-foreground hover:bg-warning/20",
  success: "border-success/30 bg-success/15 text-success hover:bg-success/15",
  danger: "bg-destructive/15 text-destructive hover:bg-destructive/15",
};

export function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  const awaiting = isAwaitingNextPhase(status);
  const tone = awaiting ? "success" : STATUS_TONE[status] ?? "neutral";
  const label = awaiting ? "Pré-aprovado — aguardando próxima etapa" : STATUS_LABEL[status];
  return <Badge className={`${TONE_CLASS[tone] ?? TONE_CLASS.neutral} ${className}`}>{label}</Badge>;
}
