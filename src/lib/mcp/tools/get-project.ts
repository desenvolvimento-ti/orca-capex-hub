import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_project",
  title: "Detalhar projeto CapEx",
  description:
    "Retorna os detalhes de um projeto CapEx, incluindo cronograma de desembolsos (planejado e realizado) e histórico de status.",
  inputSchema: { project_id: z.string().describe("UUID do projeto.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [project, disbursements, history] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project_id).maybeSingle(),
      supabase
        .from("disbursements")
        .select("*")
        .eq("project_id", project_id)
        .order("period", { ascending: true }),
      supabase
        .from("project_status_history")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", { ascending: true }),
    ]);

    const error = project.error ?? disbursements.error ?? history.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!project.data) {
      return { content: [{ type: "text", text: "Projeto não encontrado ou sem acesso." }], isError: true };
    }

    const payload = {
      project: project.data,
      disbursements: disbursements.data ?? [],
      status_history: history.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
