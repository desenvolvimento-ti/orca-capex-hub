# Migração do login para Google OAuth

## Estado

O código do repositório foi migrado de OAuth mediado pelo Lovable para OAuth
Google direto pelo Supabase, com rota de callback e validação de domínio para
novos usuários. A migration ainda precisa ser aplicada, e as configurações
externas de Google Cloud, Supabase e MainDeploy continuam pendentes.

## Decisões para o sistema CapEx atual

| Tema                        | Decisão                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| Provedor de login           | Google OAuth pelo Supabase                                             |
| Domínio para novos usuários | `@beachpark.com.br`, validado no banco                                 |
| Autorização do app          | Preservar `allowed_emails`, papéis e gate administrativo               |
| MainDeploy                  | TanStack Start em Node (`node-server`); configurar Supabase em runtime |

Os documentos originais descreviam outro sistema e uma role genérica `viewer`.
Essa regra não corresponde ao CapEx atual: autenticar com Google não concede
acesso de negócio automaticamente.

## Antes de habilitar em produção

1. Siga [03-checklist-google-supabase.md](./03-checklist-google-supabase.md)
   para configurar o OAuth Client, o provider e os redirects no projeto
   Supabase correto.
2. Revise usuários existentes e `allowed_emails`; a validação da migration
   ocorre na criação de novos usuários.
3. Aplique
   [`20261008110000_a839e6e2-3180-43b2-9663-35f96148fca4.sql`](../../supabase/migrations/20261008110000_a839e6e2-3180-43b2-9663-35f96148fca4.sql)
   pelo fluxo de migrations da equipe.
4. Configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` em runtime no
   MainDeploy; o servidor injeta esses valores publicáveis no HTML para o
   cliente. Confirme que apontam ao Supabase hospedado com os dados do CapEx,
   não ao Supabase Local eventualmente provisionado pela plataforma. Nunca
   empacote `.env`, a chave `service_role` ou o segredo OAuth.
5. Execute os casos de [06-testes-e-rollback.md](./06-testes-e-rollback.md).

O guia geral de requisitos da plataforma está em
[main-deploy-project-onboarding-guide.md](./main-deploy-project-onboarding-guide.md).
