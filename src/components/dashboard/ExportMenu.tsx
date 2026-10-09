import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportProjectsList, exportSubmissoes, exportApprovalHistory } from "@/lib/excel-export";

export function ExportMenu() {
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, label: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(`${label} exportado(a) com sucesso`);
    } catch (e: any) {
      toast.error("Falha ao exportar", { description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          <Download className="mr-2 h-4 w-4" />
          {busy ? "Exportando…" : "Exportar Excel"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Relatórios disponíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => run(exportProjectsList, "Lista de projetos")}>
          Lista completa de projetos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => exportSubmissoes(), "Submissões recebidas")}>
          Submissões recebidas por período
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(exportApprovalHistory, "Histórico de aprovações")}>
          Histórico de aprovações
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
