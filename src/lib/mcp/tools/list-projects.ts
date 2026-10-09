import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "Listar projetos CapEx",
  description:
    "Lista os projetos CapEx visíveis para o usuário autenticado, com filtros opcionais por status, área, ciclo e busca por nome/código.",
  inputSchema: {
    status: z.string().optional().describe("Filtra por status exato do projeto, ex.: em_execucao."),
    area_id: z.string().optional().describe("UUID da área."),
    cycle_id: z.string().optional().describe("UUID do ciclo."),
    search: z.string().optional().describe("Busca parcial por nome ou código do projeto."),
    limit: z.number().optional().describe("Máximo de registros (padrão 50, teto 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, area_id, cycle_id, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limit ?? 50, 1), 200);
    let query = supabase
      .from("projects")
      .select(
        "id, code, name, status, category, priority, area_id, cycle_id, estimated_total, released_amount, execution_start_date, execution_end_date, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(take);

    if (status) query = query.eq("status", status);
    if (area_id) query = query.eq("area_id", area_id);
    if (cycle_id) query = query.eq("cycle_id", cycle_id);
    if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { projects: data ?? [] },
    };
  },
});
