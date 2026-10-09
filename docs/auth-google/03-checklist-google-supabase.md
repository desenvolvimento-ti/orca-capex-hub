# 3. Checklist — Google Cloud, Supabase e MainDeploy

Estes passos exigem acesso administrativo aos projetos externos e não podem
ser concluídos pelo repositório.

## A. Google Cloud Console

1. Acessar https://console.cloud.google.com/ com uma conta administradora do
   Google Workspace `beachpark.com.br`.
2. Em **APIs & Services → OAuth consent screen**, selecionar **Internal** se
   disponível; caso contrário, selecionar **External** e manter a validação
   de domínio no banco.
3. Em **APIs & Services → Credentials → Create Credentials → OAuth client
   ID**, criar um cliente **Web application**.
4. Em **Authorized redirect URIs**, cadastrar a URL do callback do projeto
   Supabase realmente utilizado:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
   Obter o `<project-ref>` do `SUPABASE_URL` do ambiente de produção; não
   reutilizar um valor de outro ambiente ou deste documento.
5. Guardar Client ID e Client Secret para configurar o provider no Supabase.
   O Client Secret não deve ser adicionado ao código nem ao frontend.

## B. Supabase Dashboard

1. Abrir o mesmo projeto indicado por `SUPABASE_URL` de produção.
2. Em **Authentication → Providers → Google**, habilitar Google e configurar
   Client ID e Client Secret.
3. Em **Authentication → URL Configuration**, configurar:
   - **Site URL**: origem pública do app no MainDeploy.
   - **Redirect URLs**: origem MainDeploy com `/auth/callback`, origem local
     `http://localhost:<porta-do-dev>/auth/callback` e URLs de staging/preview
     utilizadas.
4. Revisar os usuários existentes e `public.allowed_emails`, especialmente
   contas fora do domínio corporativo. A trigger da migration valida novos
   usuários; contas já existentes precisam de tratamento administrativo.
5. Aplicar a migration
   [`20261008110000_a839e6e2-3180-43b2-9663-35f96148fca4.sql`](../../supabase/migrations/20261008110000_a839e6e2-3180-43b2-9663-35f96148fca4.sql)
   pelo fluxo de migrations da equipe antes de habilitar login em produção.
6. Depois de testar Google OAuth e confirmar que nenhum fluxo depende de
   senha/e-mail, desabilitar o provider e-mail/senha se a política do sistema
   exigir login exclusivamente Google. Não desabilitar antes de validar
   impacto sobre usuários existentes.

## C. MainDeploy

- Este repositório declara `@tanstack/react-start`; conforme o guia do
  MainDeploy, ele é identificado como **DOCKER_AUTO / TanStack Start**, porta 3000. Não há Dockerfile nem compose na raiz.
- O preset Nitro está definido como `node-server` fora do Lovable; o script
  `start` executa `.output/server/index.mjs` na porta padrão 3000. O módulo
  Cloudflare opcional do SDK MCP é externalizado; as métricas fazem fallback
  para `process.env` em Node.
- Configurar `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no ambiente de
  runtime do MainDeploy. O servidor injeta somente esses valores publicáveis
  no HTML para o client Supabase; eles não precisam estar disponíveis no
  build.
- Confirmar com o administrador do MainDeploy que esses valores apontam para
  o Supabase hospedado que contém os dados do CapEx, e não para uma instância
  Supabase Local provisionada automaticamente pela plataforma.
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` continuam aceitos
  para execução local/builds que já os utilizem.
- Não empacotar `.env`; o `.gitignore` do projeto ignora `.env*`.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY`, a chave `service_role` ou o Client
  Secret OAuth do Google no navegador.
- Conferir o comando e o artefato de execução gerados pelo MainDeploy antes
  de publicar. Aplicar migrations Supabase separadamente; o deploy não as
  executa automaticamente.

## D. Testes e conclusão

Seguir [06-testes-e-rollback.md](./06-testes-e-rollback.md). A migração só
está concluída depois de validar login, autorização e redirects no domínio
real do MainDeploy.
