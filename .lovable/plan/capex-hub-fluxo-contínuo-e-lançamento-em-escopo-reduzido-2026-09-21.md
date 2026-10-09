# CapEx Hub — Fluxo contínuo e lançamento em escopo reduzido

O sistema deixa de ser organizado em ciclos fechados com janelas de submissão. Gestores passam a submeter projetos a qualquer momento, e o FP&A ganha uma visão consolidada por período (mês/ano) construída automaticamente a partir do que foi submetido.

O lançamento inicial cobre apenas **submissão e consolidação para pré-aprovação**. As etapas de orçamentação, aprovação final, execução e acompanhamento ficam prontas, mas ocultas, ligadas depois por um interruptor.

## 1. Submissão contínua

- Remover janelas de submissão/análise: nada mais bloqueia o gestor por período.
- Submeter deixa de exigir escolha de ciclo. O projeto vai direto para pré-análise do FP&A com data de submissão registrada.
- Antes de enviar, o sistema confere os campos mínimos: valor estimado, datas estimadas, categoria, prioridade, descrição, justificativa e resumo de viabilidade. Faltando algo, a submissão é bloqueada com a lista do que falta e um atalho para completar o cadastro.

## 2. Painel do Gestor

- Sai a aba/visão de "Ciclos de Investimento".
- No topo do painel, dois botões: **+ Novo Projeto** e **Submeter Projeto**. O segundo abre a lista dos projetos já criados que estão prontos (ou aponta o que falta em cada um).
- O painel continua sendo o centro de acompanhamento: cartões por situação, destaque para projetos que aguardam ação do gestor, lista filtrável e acesso ao detalhe de cada projeto.

## 3. Visão do FP&A por período

- Nova visão de consolidação: total pedido por ano e por mês de submissão, com quebra por área, categoria e situação.
- A agregação é automática, sem cadastro ou ação de ciclo.
- Filtro de período (ano / intervalo de datas) aplicado à lista de projetos e às exportações.
- Administração deixa de ter cadastro de ciclos e janelas.

## 4. Escopo reduzido no lançamento

Um interruptor único controla as áreas ainda não usadas. Desligado (padrão no lançamento):

- Visíveis: painel do gestor, cadastro e submissão de projetos, pré-análise FP&A, painel da Diretoria com pré-aprovação, consolidação por período, exportações, notificações, comentários e histórico.
- Ocultos: orçamentação e aprovação final, checklist de documentos técnicos, cronograma financeiro e valores realizados, execução e conclusão, acompanhamento EVEF, metas e orçamento por área.

Projetos pré-aprovados ficam em uma situação de espera clara ("Pré-aprovado — aguardando próxima etapa") em vez de avançarem para telas ocultas.

## Detalhes técnicos

- Banco (aditivo, sem quebra): coluna `submitted_at` já existe e passa a ser a chave temporal; nova RPC `submeter_projeto(p_project_id)` valida campos mínimos e move `no_hub` → `em_pre_analise_fpa` sem ciclo. `submit_project_to_cycle` e as tabelas `cycles`/`windows` ficam marcadas como `DEPRECATED` via `COMMENT`, sem drop. `projects.cycle_id` permanece nulo e deixa de ser preenchido.
- Nova RPC/consulta de agregação por período para o painel FP&A (`solicitado_por_periodo`), somando `estimated_total` por ano/mês/área/categoria/status.
- Feature flag em `src/lib/features.ts` (`STAGES_3_TO_5_ENABLED = false`), consumida pela navegação em `src/routes/app.tsx`, pelo detalhe do projeto e pelos painéis. Rotas ocultas redirecionam para `/app`.
- `SubmitProjectDialog` perde `cycleId`/`cycleName` e ganha validação de campos mínimos; `CycleWindowsBanner`, `CycleAssignButton`, `FpaCyclesPanel`, `CycleDashboard`, `CycleFunnelPanel` e `admin/CyclesPanel` saem das telas ativas.
- `ManagerDashboard` reorganizado sem ciclos; `app.index.tsx` do FP&A passa a montar a consolidação por período.
- Exportações Excel/PDF trocam o parâmetro de ciclo por intervalo de datas.
