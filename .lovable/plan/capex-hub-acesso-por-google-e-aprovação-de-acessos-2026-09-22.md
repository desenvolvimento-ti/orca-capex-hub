# CapEx Hub — Acesso por Google e aprovação de acessos

## Objetivo

Trocar o cadastro manual de e-mails por um fluxo de **solicitação de acesso**: a pessoa entra com a conta Google corporativa, informa WhatsApp e área, e a Administração aprova definindo papel e área.

## 1. Entrada no site

- Tela de login passa a ter **um único botão: "Entrar com Google"**.
- Removidas: aba "Criar conta", campos de e-mail/senha, "Esqueci minha senha" e a tela de redefinição.
- Removida a opção "Alterar senha" no menu do usuário.
- O login com Google é ativado nesta mesma entrega (usando as credenciais gerenciadas), então funciona de imediato.

## 2. Primeiro acesso e solicitação

Quem entra sem papel definido vê um formulário curto:

- Nome completo (já vem do Google, editável)
- WhatsApp (obrigatório, com máscara)
- Área — pode escolher uma área existente na lista **ou digitar uma nova**

Ao enviar, aparece a tela "Acesso aguardando liberação da Administração". Nada mais do site fica disponível até a aprovação.

## 3. Administração — Solicitações de acesso

Nova aba na Administração, antes de "E-mails autorizados":

- Lista de pessoas que entraram e ainda não têm papel, com e-mail, nome, WhatsApp, área informada e data do acesso.
- Em cada linha: definir **papel** e **área**, e botão **Liberar acesso**. Também é possível **recusar** (mantém registro, sem acesso).
- Contador de pendências no título da aba e um aviso no topo da Administração quando houver solicitações.
- A aba "E-mails autorizados" continua existindo para pré-autorizar alguém, agora com coluna de **WhatsApp**.

## 4. Áreas criadas pelos gestores

- A área digitada no primeiro acesso entra na lista de áreas com situação **"Pendente de aprovação"**.
- No painel de Áreas: badge de pendente, botões **Aprovar**, **Editar** (nome + diretor vinculado) e **Excluir**.
- Ao excluir uma área pendente, as solicitações que a citavam voltam a pedir escolha de área na aprovação.
- Áreas pendentes não aparecem nos filtros/listas normais até serem aprovadas.

## 5. Ajustes de tela pedidos

- **Acompanhamento (Admin)**: fica um único botão "Exportar Excel" (o do painel de consolidação); o menu duplicado do topo sai.
- **Projetos (Admin)**: passa a ter a mesma apresentação da visão do Gestor (mesmos cartões de números clicáveis, mesma lista), mas com todos os projetos de todos os gestores e os filtros de área/gestor mantidos.
- Removido o seletor **"Visualizar como"** do topo (e a simulação de papéis que dependia dele).
- O papel **FP&A** passa a se chamar **Admin** nos nomes de perfil, menus e listas de papel. Textos de processo ("em análise FP&A") permanecem como estão.

## 6. Melhorias que sugiro incluir

- Restringir o login Google ao domínio corporativo, evitando pedidos de acesso de Gmail pessoal.
- Registrar quem liberou e quando, no histórico de acessos.
- Aviso no sino de notificações da Administração quando surgir nova solicitação.
- Tela de "aguardando liberação" com botão de atualizar, para a pessoa entrar sozinha assim que for liberada.

## Detalhes técnicos

- Ativar provider Google (`configure_social_auth`) e usar `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`; login por e-mail/senha deixa de ser usado no app.
- Migração: `areas.status` (`pendente`/`aprovada`, default `aprovada` para as existentes) + `areas.created_by`; `allowed_emails.phone`; nova tabela `access_requests` (user_id, email, full_name, phone, requested_area_id, requested_area_name, status, decided_by, decided_at) com GRANTs e RLS (o próprio usuário insere/lê o seu; papel `fpa` lê e decide tudo).
- `handle_new_user` deixa de lançar exceção para e-mail não autorizado: cria o perfil sem papel; se houver `allowed_emails` correspondente, aplica papel/área como hoje.
- RPC `approve_access_request(request_id, role, area_id)` (security definer) que grava `user_roles`, atualiza `profiles.area_id`/`phone`, aprova a área pendente quando for o caso e registra a decisão.
- Remover `ChangePasswordDialog`, rota `reset-password` e o `viewAs` de `use-auth`/`app.tsx` e telas que o consomem.
- Extrair o layout do `ManagerDashboard` (cartões + lista) para reutilizar na visão Admin de Projetos com escopo "todos os projetos".
- `ROLE_LABEL`/`ROLE_TITLE.fpa` → "Admin"; enum `app_role` no banco continua `fpa`.
