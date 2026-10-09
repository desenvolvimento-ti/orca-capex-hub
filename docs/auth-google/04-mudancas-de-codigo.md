# 4. Implementação

Esta etapa foi implementada no repositório:

- `src/routes/login.tsx`: inicia OAuth Google diretamente com
  `supabase.auth.signInWithOAuth`, informa `hd=beachpark.com.br` como dica e
  mantém a navegação segura para `next`.
- `src/routes/auth.callback.tsx`: processa o retorno OAuth, redireciona uma
  sessão válida e explica falhas de domínio/autorização.
- `src/lib/auth-domain.ts`: centraliza o domínio usado na interface.
- `src/integrations/supabase/types.ts`: inclui o campo `avatar_url` adicionado
  pela migration.
- `supabase/migrations/20261008110000_a839e6e2-3180-43b2-9663-35f96148fca4.sql`:
  valida o domínio na trigger existente e armazena o avatar sem alterar as
  regras de `allowed_emails` e `user_roles`.

As rotas de senha não fazem parte do fluxo atual do CapEx e não foram
removidas ou recriadas. O login Google que existia via `cloud-auth-js` do
Lovable foi substituído pelo OAuth do Supabase para que o app possa usar o
mesmo provider fora do Lovable.

## Não alterado

- Regras e políticas RLS; lista `allowed_emails`; papéis existentes.
- `AuthProvider`, `AccessRequestGate` e a guarda de `/app`.
- Configuração do provider no Google Cloud/Supabase Dashboard, que exige
  credenciais e URLs do ambiente e deve ser feita por um administrador.
