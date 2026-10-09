# Etapa 3 – Acompanhamento da execução

## Decisões confirmadas
- Colunas da importação. Obrigatórias: Código do projeto (CAP-...), Centro de custo, Competência (mês/ano) e Valor (R$). Opcionais: Descrição/histórico, Fornecedor e Nº do documento/lançamento.
- Vínculo: pelo código do projeto. Se o centro de custo for diferente do cadastrado, o valor é lançado mesmo assim e aparece um alerta de divergência.
- Desvio relevante: o FP&A define o percentual e o valor mínimo na Administração. Para ser relevante, o desvio precisa ultrapassar os dois limites.
- Entrada na etapa 3: logo que o projeto é liberado na validação para execução.
- Não entra neste fluxo: CapEx de manutenção ordinária/corretiva.

## O que será construído

**1. Importação e lançamento manual (FP&A)**
- Tela "Realizado" com upload da planilha. Antes de confirmar, o FP&A vê a prévia com cada linha classificada como: vinculada, vinculada com divergência de centro de custo, fora do rito ou com erro (mês ou valor inválido).
- Cada importação fica registrada com arquivo, mês, quem importou e totais. Reimportar o mesmo mês substitui os lançamentos daquela importação, sem duplicar valores.
- Lançamento manual por projeto, com os mesmos campos, e opção de editar ou excluir o lançamento.

**2. Classificação automática**
- Gastos com competência anterior ao início da execução contam como estudo/projeto. Os demais contam como execução.

**3. Realizado x cronograma**
- A comparação usa o cronograma firme. Se ele não existir, usa o indicativo.
- A tabela mensal mostra, por natureza: previsto, realizado, desvio no mês e acumulado.
- A curva acumulada compara o previsto com o realizado.
- A página do projeto ganha a seção "Etapa 3 – Acompanhamento". As etapas 1 e 2 ficam recolhidas.

**4. Desvios**
- Um desvio relevante gera um alerta no projeto, uma notificação para o gestor e uma mensagem automática no chat do projeto.
- O gestor responde de uma de duas formas:
  - **Ajustar previsão:** reprojeta os meses futuros. Os meses passados não mudam, e o ajuste fica na auditoria.
  - **Justificar:** escreve um texto, que é registrado no chat.
- O FP&A dá o desvio por tratado ou pede nova ação. Tudo aparece no histórico unificado.

**5. Fila "Fora do rito"**
- Reúne as linhas da contabilidade que não correspondem a nenhum projeto do Hub, agrupadas por código e centro de custo, com os valores somados.
- Ações do FP&A:
  - vincular a um projeto existente;
  - indicar o gestor responsável, que é notificado para cadastrar o projeto;
  - marcar como manutenção ou fora do escopo, com justificativa;
  - acompanhar o status: aberto, em contato ou resolvido.

**6. Visão por gestor**
- Tela para o FP&A escolher um gestor e ver os projetos em andamento, com curva mensal e acumulada por projeto e consolidada.
- O próprio gestor vê a mesma tela, só com os projetos dele.
- Exportação em Excel e em PDF para envio periódico.

**7. Ajustes gerais**
- Painéis do gestor e do FP&A ganham o grupo "Em execução" e um contador de desvios pendentes.
- As exportações de Excel passam a incluir realizado e desvios.
- O PDF executivo ganha a seção de acompanhamento quando houver dados.
- A etapa 3 volta a ser liberada no sistema.

## Detalhes técnicos
- Novas tabelas (aditivas, com permissões e regras de acesso):
  - `actuals_imports`: arquivo, competência, autor e totais.
  - `actual_entries`: project_id nulo quando fora do rito, código e centro de custo informados, competência, valor, fase calculada, origem (importação ou manual), cc_mismatch e campos opcionais.
  - `unmatched_actuals_queue`: status, gestor indicado e resolução.
  - `project_deviations`: mês, previsto, realizado, status e resposta.
  - `deviation_settings`: pct e valor mínimo, em linha única.
- Acesso: o FP&A pode ler e alterar tudo. O gestor só lê os dados dos próprios projetos e só responde aos desvios deles.
- Funções no servidor:
  - `import_actuals`: faz a validação e o vínculo, e é idempotente por importação.
  - `recalc_deviations(project, month)`: calcula os desvios.
  - `responder_desvio` e `tratar_desvio`: registram a resposta do gestor e a decisão do FP&A.
  - `resolver_fora_do_rito`: resolve itens da fila.
  - Gatilhos: mensagens no chat e notificações.
- O campo `disbursements.realized_amount` antigo continua existindo, mas o sistema deixa de usá-lo. O realizado passa a vir de `actual_entries`, e o campo antigo recebe marcação de descontinuado.
- A leitura da planilha é feita no navegador com a biblioteca `xlsx`, que já está instalada. O mapeamento das colunas é tolerante a variações de nome no cabeçalho.
- Novas telas: `/app/realizado` (importação, lançamento manual e fora do rito) e `/app/acompanhamento-gestor`. A seção da etapa 3 fica na página do projeto.
