# 2. Arquitetura da autenticação Google

## Fluxo

```text
Login em /login
  → supabase.auth.signInWithOAuth(provider: "google")
  → Supabase Auth / Google
  → retorno para /auth/callback
  → sessão Supabase válida → /app
```

O OAuth é iniciado diretamente pelo Supabase, sem o serviço de autenticação
do Lovable. Isso permite usar o mesmo projeto Supabase no Lovable e no
MainDeploy, desde que as URLs de redirect e as variáveis de ambiente estejam
configuradas nos dois ambientes.

## Segurança e provisionamento

- `hd=beachpark.com.br` é apenas uma dica para a tela do Google, não uma
  barreira de segurança.
- A migration valida o domínio no banco antes de provisionar um novo usuário.
- A regra de `allowed_emails`, o bootstrap existente do primeiro usuário e
  a atribuição de papel permanecem em vigor.
- Usuários autenticados sem papel continuam passando pelo `AccessRequestGate`;
  autenticar com Google não concede acesso de negócio automaticamente.
- A migration captura nome, telefone e avatar sem sobrescrever papéis
  atribuídos por administradores.

## Retorno OAuth

A rota `/auth/callback` é client-side (`ssr: false`), aguarda o estado de
autenticação do Supabase e mostra uma mensagem útil quando o login falha.
O parâmetro `next` continua limitado a caminhos relativos same-origin.

## O que permanece igual

`AuthProvider`, `AppLayout`, `user_roles`, RLS, middleware de token das
server functions e regras de negócio não dependem do provedor OAuth e não são
alterados por esta migração.
