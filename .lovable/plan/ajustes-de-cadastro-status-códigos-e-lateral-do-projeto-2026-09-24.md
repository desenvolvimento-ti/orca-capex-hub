# Ajustes de cadastro, status, códigos e lateral do projeto

## Resultado
- Ampliar os campos Categoria e Prioridade para a largura total da seção de informações gerais.
- Simplificar os rótulos visíveis do fluxo atual, incluindo o estado intermediário da diretoria sob o rótulo “Submetido”, sem remover estados internos necessários às decisões e permissões.
- Gerar códigos de novos projetos no padrão `SIGLA-ANO-XXX`, com siglas `NOV`, `APR`, `MEX`, `INT` e `BIO`; o ano virá da data de início da execução e a sequência será própria de cada combinação de sigla e ano.
- Preservar todos os códigos de projetos já cadastrados.
- Remover “Tags do projeto” da página de detalhes e também os indicadores dessas tags no cabeçalho e na lista de projetos.
- Manter na lateral apenas “Informações pendentes”, “Chat do projeto” e “Histórico do projeto”, todos recolhíveis e dentro de uma lateral fixa durante a rolagem.

## Regras de compatibilidade
- Os estados internos continuarão existindo para preservar o fluxo, histórico, permissões e dados antigos; apenas os nomes exibidos serão consolidados quando não agregarem informação ao usuário.
- O código será atribuído quando houver data de início da execução. Projetos salvos inicialmente sem essa data receberão o código quando ela for informada, sem alterar códigos já existentes.

## Verificação
- Conferir criação e edição de projeto, incluindo código gerado e larguras dos campos.
- Conferir abertura, fechamento e fixação das três seções laterais.
- Conferir a listagem com os novos rótulos e sem tags.
- Validar a compilação e testar as telas em largura de computador e celular.
