# 1. Situação atual

Este documento foi atualizado para o sistema CapEx atual. O roteiro anterior
descrevia outro sistema e não correspondia ao schema nem às regras de acesso
deste repositório.

## Autenticação e acesso

- `src/routes/login.tsx` inicia OAuth do Google diretamente pelo Supabase.
- `src/routes/auth.callback.tsx` trata o retorno OAuth, aguarda a sessão e
  encaminha para `/app`; falhas mostram instruções para usar uma conta
  corporativa liberada.
- `src/hooks/use-auth.tsx` obtém a sessão e carrega `profiles` e `user_roles`.
- `src/routes/app.tsx` mantém o gate atual: sem sessão, envia para `/login`;
  sem papel, mostra `AccessRequestGate`.
- `public.allowed_emails` decide o papel e a área no provisionamento. O
  primeiro usuário continua sendo tratado pela regra de bootstrap existente.
- A autenticação e a autorização são coisas distintas: a troca do provedor
  não concede automaticamente um papel de negócio.

## Migration da autenticação

A migration `20261008110000_a839e6e2-3180-43b2-9663-35f96148fca4.sql`:

- valida o domínio `@beachpark.com.br` dentro de `handle_new_user`;
- mantém a validação existente por `allowed_emails`, papéis, área e telefone;
- armazena `avatar_url` recebido dos metadados do Google sem alterar papéis
  previamente concedidos.

A migration precisa ser aplicada ao projeto Supabase usado pelo deploy. O
MainDeploy não aplica migrations do Supabase automaticamente.

## Configuração fora do repositório

O provider Google, o OAuth Client no Google Cloud, as URLs permitidas no
Supabase e as variáveis do MainDeploy precisam ser configurados manualmente.
Os passos estão em
[03-checklist-google-supabase.md](./03-checklist-google-supabase.md).
