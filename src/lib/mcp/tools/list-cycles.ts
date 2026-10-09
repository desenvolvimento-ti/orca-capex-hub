import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_cycles",
  title: "Listar ciclos CapEx",
  description: "Lista os ciclos CapEx com suas janelas de submissão e análise.",
  inputSchema: {
    only_active: z.boolean().optional().describe("Se verdadeiro, retorna apenas ciclos ativos."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_active }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("cycles")
      .select("*")
      .order("year", { ascending: false })
      .order("cycle_number_in_year", { ascending: false });
    if (only_active) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { cycles: data ?? [] },
    };
  },
});
