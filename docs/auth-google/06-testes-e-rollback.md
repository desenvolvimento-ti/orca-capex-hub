# 6. Testes e rollback

## Testes manuais antes de produção

1. **Login corporativo liberado**
   - Iniciar "Entrar com Google" em `/login` com conta
     `@beachpark.com.br` configurada em `allowed_emails`.
   - Esperado: retorno por `/auth/callback`, navegação para `/app`, perfil e
     papel conforme allowlist; `avatar_url` preenchido quando fornecido pelo
     Google.
2. **Conta corporativa sem autorização de negócio**
   - Usar conta corporativa não cadastrada em `allowed_emails`.
   - Esperado: a trigger rejeita o novo usuário, não cria perfil/papel, e
     `/auth/callback` orienta a solicitar liberação à Administração.
3. **Conta fora do domínio**
   - Tentar login com conta Google pessoal.
   - Esperado: a trigger rejeita o novo usuário e `/auth/callback` explica
     que é necessário usar uma conta `@beachpark.com.br`; não deve surgir
     novo perfil nem papel.
4. **Login repetido**
   - Reautenticar uma conta corporativa existente.
   - Esperado: não duplica perfil/papel e não sobrescreve permissões definidas
     por administradores.
5. **Logout e persistência**
   - Confirmar que logout volta a `/login` e que reload mantém uma sessão
     válida via storage Supabase existente.
6. **Guarda de rota**
   - Acessar `/app` sem sessão; esperado redirecionamento para `/login`.
7. **Permissões**
   - Confirmar que permissões RLS e papéis existentes se mantêm; OAuth não
     deve conceder nem ampliar acesso ao sistema.
8. **MainDeploy**
   - Validar build, inicialização/porta 3000, acesso à rota direta
     `/auth/callback` e callback OAuth no domínio publicado.

## Rollback

1. Desabilitar Google em **Supabase Dashboard → Authentication → Providers**.
2. Reabilitar o provider de e-mail/senha se ele tiver sido desativado e se
   essa forma de login for necessária para o rollback.
3. Reverter o código por um commit corretivo que restaure o fluxo anterior,
   seguido de novo deploy.
4. Não editar uma migration aplicada. Criar uma nova migration que restaure
   a versão anterior de `handle_new_user()`; manter a coluna `avatar_url`,
   que é aditiva.

## Critério de conclusão

A migração só está concluída depois de a migration ser aplicada ao projeto
Supabase correto, Google OAuth funcionar no MainDeploy e os cenários de
autorização acima passarem no domínio de produção.
