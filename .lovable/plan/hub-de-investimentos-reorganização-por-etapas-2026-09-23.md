# Hub de Investimentos — Reorganização por etapas

## Conflitos com a estrutura atual (decisões propostas)

1. **Status**: hoje existem 31 status, vários de fluxos antigos. Proposta: manter o enum atual (projetos antigos continuam abrindo) e usar só este subconjunto no novo fluxo. Os status antigos ficam fora de uso e são mapeados para os novos.
   - Etapa 1: `no_hub` (rascunho) -> `em_pre_analise_fpa` -> `devolvido_pre` -> `aguardando_diretoria_prev` -> `aprovado` / `aprovado_estudo` (novo) / `nao_aprovado_pre`
   - Etapa 2: `em_projeto_firme` (novo) -> `em_validacao_execucao` (novo, FP&A + diretoria) -> `devolvido_orc` / `aprovado_final` (liberado para gastar) / `reprovado_final` / `estudo_concluido` (novo, para aprovados "só estudo")
   - "Pendente de informações" e "Pronto para submeter" **não são status gravados**: são calculados a partir dos campos quando o projeto está em rascunho ou devolvido. Assim nunca ficam dessincronizados.
2. **Chave `STAGES_3_TO_5_ENABLED`**: hoje esconde tudo depois da pré-aprovação. Ela passa a esconder só a etapa 3 (execução). Etapa 2 e validação ficam ligadas.
3. **Teto de investimento**: hoje só existe orçamento por área e ciclo (`area_budgets`). Proposta: criar um teto único da empresa, com histórico de alterações, separado do orçamento por área (que continua existindo e não entra na decisão).
4. **Cronograma**: a tabela de desembolsos já tem a natureza (planejamento/execução). Falta separar indicativo, firme e realizado: adiciono uma coluna "versão" (indicativo, firme). O realizado já existe por mês.
5. **Ciclos**: a priorização da diretoria continua sem janelas; o FP&A registra o resultado projeto a projeto (ou em lote) e publica.
6. **Etapas da diretoria antigas** (diretor da área, CFO, CEO): ficam fora do novo fluxo. Toda decisão da diretoria é registrada pelo FP&A no Hub.

## Etapa 1 — tela única (criar = editar)

- Um único formulário substitui a tela "Novo projeto" e o diálogo "Editar cadastro". Blocos em ordem: Informações gerais, Estimativa de investimento, Cronograma financeiro, Viabilidade e retorno, Anexos, e no fim o bloco de ação ("Salvar" e "Submeter").
- Estimativa: verba de estudo, valor de execução, total calculado, início do estudo, início da execução, prazo de execução (meses, com ajuda "somente a execução; o estudo é o intervalo entre as duas datas"). Textos obsoletos sobre segregação reescritos.
- Datas: início da execução antes do estudo = pendência; data no passado = alerta amarelo sem bloquear.
- Cronograma: meses do início do estudo ao fim da execução, meses de estudo e execução com cores diferentes, subtotal por natureza. Diferença contra os valores informados vira pendência.
- Viabilidade: TIR removida de todo o sistema (formulário, página, painéis, filtros, PDF, exportações, ferramentas de agentes). Payback (meses) e premissas obrigatórios, ou "Não se aplica" com justificativa obrigatória.
- Anexos da etapa 1: base do orçamento indicativo (obrigatória) e fundamentação do payback (obrigatória quando houver payback).
- Salvar exige só nome e categoria. Validação toda em português pela aplicação (sem a validação do navegador), com foco no primeiro campo com problema.
- Submeter: bloqueia e mostra a lista exata do que falta, cada item com atalho que rola até o campo.
- Ao submeter: valores, datas e cronograma viram linha de base congelada. Edição só volta quando o FP&A devolve; cada alteração após devolução fica na trilha de auditoria.

## Painel do gestor

- Situações visíveis e no filtro: Pendente de informações, Pronto para submeter, Em pré-análise FP&A, Devolvido para ajuste, Em priorização da diretoria, Aprovado, Aprovado só estudo, Não aprovado, Em projeto firme, Em validação para execução, Liberado para execução.
- "Aguardando sua ação" conta: pendentes, prontos, devolvidos e etapa 2 em aberto.
- Botão "Submeter" em cada linha pronta. O botão genérico "Submeter Projeto" do topo é removido.
- Nomenclatura uniformizada ("FP&A" como destinatário em todo lugar, sem "Administração" nos textos de fluxo).

## Priorização (FP&A)

- Lista de projetos em priorização com registro do resultado: Aprovado, Aprovado só estudo, Não aprovado, com justificativa. Botão "Publicar resultado" notifica os gestores (sino e, quando o e-mail estiver ativo, e-mail).

## Etapa 2 — projeto firme

- Só aparece para aprovados (inclusive só estudo), com orientação no topo: pré-aprovado, verba de estudo liberada, o que apresentar.
- Mesma estrutura de valores, datas, prazo e cronograma da etapa 1 (versão firme), com o indicativo exibido como referência.
- Documentos: escopo técnico, cotações, orçamento firme, análise de risco, análise de impacto e retorno. A seção de documentos sai da etapa 1.
- Centro de custo (obrigatório para submeter) e código contábil (opcional; FP&A pode preencher depois).
- Mesma regra de salvar/submeter; botão "Submeter para validação de execução" no fim.

## Validação para execução (FP&A + diretoria)

- Comparação lado a lado indicativo x firme: estudo, execução, total, datas, prazo e cronograma mês a mês, com variação absoluta e percentual e destaque do que mudou.
- Teto de investimento: FP&A atualiza a qualquer momento (valor, data, motivo), com histórico. Tela de decisão mostra teto atual, já comprometido, folga e folga após aprovar.
- Resultados: Aprovado para execução, Devolvido para ajuste, Não aprovado. Para aprovados "só estudo": "Registrar projeto firme como concluído" mantendo a execução não aprovada.

## Página do projeto

- Coluna principal: etapas concluídas no topo (somente leitura, recolhíveis), depois a etapa corrente, terminando no botão de ação. Card lateral "Submeter projeto" removido.
- Coluna lateral: chat do projeto sempre acessível, botão "Enviar mensagem". Toda mensagem notifica a outra parte com link para o projeto.
- Histórico unificado: um único "Histórico do projeto" (remove o card duplicado e mantém a linha do tempo de auditoria).
- Cabeçalho: código gerado já na criação (sem texto "no hub" na posição do código).
- Mensagens de bloqueio explicam a etapa/situação (ex.: "Anexos da etapa 1 ficam travados após a submissão; aguarde a devolução do FP&A").
- PDF executivo: dois valores, duas datas, prazo de execução, cronograma separado por natureza, sem TIR.

## Detalhes técnicos

- Migração (aditiva, sem apagar colunas):
  - `projects`: `study_amount`, `execution_amount`, `study_start_date`, `execution_months`, `payback_not_applicable`, `payback_na_justification`, `payback_assumptions`, e os equivalentes firmes (`firm_*`), `cost_center`, `accounting_code`, `baseline_frozen_at`, `prioritization_result`, `prioritization_published_at`. `tir_pct` marcado como obsoleto. Backfill a partir de `total_planning`, `total_execution`, `execution_start_date`, `est_start_date`.
  - Novos valores de status: `aprovado_estudo`, `em_projeto_firme`, `em_validacao_execucao`, `estudo_concluido`.
  - `disbursements`: coluna `version` ('indicativo' | 'firme', padrão 'indicativo').
  - Nova tabela `project_baselines` (fotografia imutável em JSON do indicativo na submissão), com RLS e bloqueio de update/delete.
  - Nova tabela `investment_ceiling_history` (valor, vigente desde, motivo, autor) com RLS: leitura para autenticados, escrita só FP&A.
  - `required_document_types`: coluna `stage` (1 ou 2); tipos da etapa 1 (base do orçamento indicativo, fundamentação do payback) e da etapa 2.
  - Novas funções: `submeter_projeto` reescrita (valida no servidor com as mesmas regras e grava a linha de base), `registrar_priorizacao`, `publicar_priorizacao`, `submeter_projeto_firme`, `decisao_validacao_execucao`, `concluir_estudo`, `atualizar_teto`. Trigger de código na criação. Trigger de notificação em `project_comments`. Trigger que registra alterações após devolução.
  - Políticas de edição: gestor edita só em rascunho/devolvido (etapa 1) ou em projeto firme/devolvido_orc (etapa 2); FP&A sempre pode editar `accounting_code`.
- Frontend: um módulo compartilhado de regras (`project-rules.ts`) produz a lista de pendências usada no formulário, no painel, no diálogo de submissão e espelhada no servidor. Novos componentes: formulário de etapa 1, formulário de etapa 2, comparação indicativo x firme, painel de teto, priorização. Formulários com `noValidate`.
- Compatibilidade: projetos antigos abrem com os campos novos preenchidos pelo backfill; status antigos mapeados para a situação mais próxima.

## Ordem de execução

1. Migração + regras compartilhadas + remoção da TIR.
2. Formulário único da etapa 1, painel do gestor, submissão e linha de base.
3. Página do projeto (layout linear, chat lateral, histórico unificado, correções).
4. Priorização e publicação.
5. Etapa 2 e validação para execução com teto.
6. PDF executivo e exportações Excel ajustados.
