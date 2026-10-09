import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_project_comment",
  title: "Comentar em projeto",
  description: "Adiciona um comentário no chat de um projeto CapEx, em nome do usuário autenticado.",
  inputSchema: {
    project_id: z.string().describe("UUID do projeto."),
    body: z.string().describe("Texto do comentário."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ project_id, body }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const text = body.trim();
    if (!text) {
      return { content: [{ type: "text", text: "O comentário não pode ser vazio." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("project_comments")
      .insert({ project_id, author_id: ctx.getUserId()!, body: text })
      .select()
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { comment: data },
    };
  },
});
