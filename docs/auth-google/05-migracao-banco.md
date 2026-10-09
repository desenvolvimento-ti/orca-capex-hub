# 5. Migration de banco

A migration
[`20261008110000_a839e6e2-3180-43b2-9663-35f96148fca4.sql`](../../supabase/migrations/20261008110000_a839e6e2-3180-43b2-9663-35f96148fca4.sql)
foi adicionada ao repositório; ainda não foi aplicada a nenhum projeto
Supabase.

## O que faz

1. Adiciona `profiles.avatar_url`.
2. Atualiza `public.handle_new_user()` para rejeitar novos usuários cujo
   endereço não esteja no domínio `@beachpark.com.br`.
3. Mantém o bootstrap existente do primeiro papel, a autorização por
   `allowed_emails` e a atribuição atual de papel/área/telefone.
4. Copia o avatar dos metadados OAuth sem sobrescrever papel existente.

O parâmetro `hd` enviado ao Google é apenas uma dica visual. A validação da
trigger é a barreira de domínio para novos usuários. A migration deve ser
aplicada antes de habilitar o provider Google em produção.

## Limites operacionais

- A trigger roda ao criar um usuário. Antes de ativar o OAuth, o administrador
  deve revisar `auth.users` e `allowed_emails` e decidir como tratar contas
  existentes fora do domínio.
- MainDeploy não executa migrations do Supabase. Aplicar a migration ao
  projeto apontado por `SUPABASE_URL` usando o fluxo operacional da equipe.
- O provider Google, URLs de redirect e secrets são configurações externas;
  nenhum Client Secret é gravado nesta migration.
