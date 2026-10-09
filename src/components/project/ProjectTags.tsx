import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RISK_LABEL, RISK_TONE } from "@/lib/labels";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

type Risk = "baixo" | "medio" | "alto";

const TONE_CLASS: Record<string, string> = {
  success: "bg-success/20 text-success-foreground hover:bg-success/20",
  warn: "bg-warning/20 text-warning-foreground hover:bg-warning/20",
  danger: "bg-destructive/15 text-destructive hover:bg-destructive/15",
};

export function ProjectTagsBadges({
  risk,
  extraordinary,
  deferredCount = 0,
  deferralReason = null,
}: {
  risk: Risk | null;
  extraordinary: boolean;
  deferredCount?: number;
  deferralReason?: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {deferredCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 cursor-help">
                <RotateCcw className="mr-1 h-3 w-3" />
                Reenviado · {deferredCount}× não aprovado
              </Badge>
            </TooltipTrigger>
            {deferralReason && (
              <TooltipContent className="max-w-xs">
                <p className="text-xs font-medium mb-1">Última justificativa:</p>
                <p className="text-xs whitespace-pre-wrap">{deferralReason}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
      {risk && (
        <Badge className={TONE_CLASS[RISK_TONE[risk]]}>
          {RISK_LABEL[risk]} (maturidade documental)
        </Badge>
      )}
      {extraordinary && (
        <Badge className="bg-accent/20 text-accent hover:bg-accent/20">
          Aprovação extraordinária (Diretoria)
        </Badge>
      )}
    </div>
  );
}

export function ProjectTagsEditor({
  projectId,
  initialRisk,
  initialExtraordinary,
}: {
  projectId: string;
  initialRisk: Risk | null;
  initialExtraordinary: boolean;
}) {
  const { isRealFpa } = useAuth();
  const qc = useQueryClient();
  const [risk, setRisk] = useState<Risk | "none">(initialRisk ?? "none");
  const [extra, setExtra] = useState(initialExtraordinary);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").update({
        fpa_risk: risk === "none" ? null : risk,
        extraordinary_approval: extra,
      } as never).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tags atualizadas"); qc.invalidateQueries({ queryKey: ["project", projectId] }); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isRealFpa) return null;

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tags FP&A</div>
      <div>
        <Label className="text-xs">Maturidade documental</Label>
        <Select value={risk} onValueChange={(v) => setRisk(v as Risk | "none")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem classificação</SelectItem>
            <SelectItem value="baixo">Risco baixo</SelectItem>
            <SelectItem value="medio">Risco médio</SelectItem>
            <SelectItem value="alto">Risco alto</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between rounded-md border bg-card p-2">
        <div>
          <div className="text-sm font-medium">Aprovação extraordinária</div>
          <div className="text-xs text-muted-foreground">Marque quando a aprovação for via Diretoria fora do fluxo padrão.</div>
        </div>
        <Switch checked={extra} onCheckedChange={setExtra} />
      </div>
      <Button size="sm" className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        Salvar tags
      </Button>
    </div>
  );
}
