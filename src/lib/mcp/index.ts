import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import listCyclesTool from "./tools/list-cycles";
import addProjectCommentTool from "./tools/add-project-comment";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "beach-park-capex-hub",
  title: "Beach Park CapEx Hub",
  version: "0.1.0",
  instructions:
    "Ferramentas do Beach Park CapEx Hub. Use `list_cycles` para descobrir ciclos, `list_projects` para localizar projetos (filtros por status, área, ciclo e busca), `get_project` para detalhes com cronograma de desembolsos e histórico de status, e `add_project_comment` para comentar em um projeto. Todo acesso respeita as permissões do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCyclesTool, listProjectsTool, getProjectTool, addProjectCommentTool],
});
