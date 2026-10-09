# Como preparar um repositório para deploy no MainDeploy

> Cole este arquivo inteiro no assistente/IA que trabalha no repositório que
> você quer implantar. Ele explica como a plataforma **MainDeploy** decide o
> que fazer com o seu projeto e o que ajustar no repositório para o deploy
> subir de primeira, sem precisar de tentativa e erro em produção.

## Visão geral: como o MainDeploy decide o que fazer com seu projeto

Ao enviar um ZIP (ou importar via GitHub), a plataforma analisa a raiz do
projeto e escolhe **uma** das estratégias abaixo. A detecção é por
prioridade — o primeiro critério que bater, vence, mesmo que o projeto também
se encaixe em outro mais abaixo na lista:

| Ordem | O que é detectado | Estratégia | O que a plataforma faz |
|---|---|---|---|
| 1 | `docker-compose-prod.yml` / `docker-compose.yml` / `docker-compose.yaml` na raiz | `DOCKER_USER` (compose) | Roda o compose **como está**, sem reescrever portas nem nomes de serviço/container. Só adiciona um prefixo de projeto (`-p <slug>`) para isolar de outros deploys. |
| 2 | `Dockerfile` na raiz (sem compose) | `DOCKER_USER` (Dockerfile) | Builda e roda a imagem exatamente como o `Dockerfile` define. |
| 3 | `index.html` na raiz/`public/` (só quando **não** há `package.json`) ou em `dist/`, `build/`, `out/`, `_site/`, `site/` | `STATIC` | Nenhum container — os arquivos são servidos direto pelo servidor de arquivos da plataforma. |
| 4 | `package.json` | `DOCKER_AUTO` (Node) | Gera um Dockerfile a partir do framework detectado (ver tabela de frameworks abaixo). |
| 5 | `requirements.txt` / `pyproject.toml` / `Pipfile` / `setup.py` | `DOCKER_AUTO` (Python) | Idem, framework Flask/FastAPI/Django/genérico. |
| 6 | `go.mod` | `DOCKER_AUTO` (Go) | Idem, Gin/Echo/Fiber/genérico. |
| 7 | `Gemfile` | `DOCKER_AUTO` (Ruby) | Idem, Rails/Sinatra/genérico. |
| 8 | `composer.json` / `index.php` | `DOCKER_AUTO` (PHP) | Idem, Laravel/Slim/genérico. |
| 9 | `pom.xml` / `build.gradle(.kts)` | `DOCKER_AUTO` (Java) | Idem, Spring Boot/Quarkus/genérico. |
| — | Nada do acima | Falha (confiança `LOW`) | Deploy não é possível sem um desses arquivos na raiz. |

**Ponto mais importante desta tabela:** se o seu repositório tem um
`docker-compose.yml`/`docker-compose.yaml` **de desenvolvimento local** na
raiz, ele **sempre** vence sobre o `Dockerfile` de produção, mesmo que este
exista. Se você não quer que a plataforma use o compose de dev, ele **não
pode ir dentro do ZIP/branch de deploy** — renomeie para
`docker-compose.dev.yml` (ou qualquer nome fora da lista acima) e garanta que
o processo de empacotamento não o inclua.

### Frameworks reconhecidos (dentro de cada stack DOCKER_AUTO)

| Stack | Sinal detectado | Framework | Porta padrão assumida |
|---|---|---|---|
| Node | dep `next` | Next.js | 3000 |
| Node | dep `nuxt`/`@nuxt/core` | Nuxt | 3000 |
| Node | dep `@nestjs/core` | NestJS | porta lida de `app.listen()`/`process.env.PORT`, senão 3000 |
| Node | dep `express` | Express | idem |
| Node | dep `fastify` | Fastify | idem |
| Node | dep `react`/`react-dom` (sem `next`) | SPA React (build estático) | 80 (servido via nginx após `npm run build`) |
| Node | dep `vue` (sem `nuxt`) | SPA Vue (build estático) | 80 |
| Node | dep `@tanstack/start`/`@tanstack/react-start` | TanStack Start | 3000 |
| Node | nenhum dos acima | genérico | porta detectada ou 3000 |
| Python | import `flask` | Flask (`gunicorn`) | 5000 |
| Python | import `fastapi` | FastAPI (`uvicorn`) | 8000 |
| Python | import `django` ou `manage.py` presente | Django (`gunicorn ...wsgi:application`) | 8000 |
| Go | import `gin-gonic/gin` / `labstack/echo` / `gofiber/fiber` | Gin/Echo/Fiber | 8080 (Fiber: 3000) |
| Ruby | `gem 'rails'` / `gem 'sinatra'` | Rails/Sinatra | 3000 / 4567 |
| PHP | `laravel/framework` / `slim/slim` no `composer.json` | Laravel/Slim | 8000 / 8080 |
| Java | `spring-boot-starter` / `quarkus` no build file | Spring Boot/Quarkus | 8080 |

Se o seu framework/porta real não bate com a tabela, **não tem problema** —
é só um ponto de atenção: revise o Dockerfile gerado antes de confirmar o
deploy, ou envie seu próprio `Dockerfile` (estratégia `DOCKER_USER`) para ter
controle total.

## Regras de rede que todo projeto precisa respeitar

Isso é o que mais causa erro de "connection refused" em primeiro deploy:

- **Dentro do container, `localhost`/`127.0.0.1` aponta para o próprio
  container**, nunca para o host da máquina onde a plataforma roda. Qualquer
  serviço externo ao seu container (banco de dados compartilhado da
  plataforma, outro serviço rodando no host, etc.) precisa ser endereçado por
  **`host.docker.internal`**, nunca por `localhost`.
- **Essa resolução só é automática em projetos de container único
  (`DOCKER_AUTO` ou `DOCKER_USER` com um único `Dockerfile`)** — a plataforma
  adiciona `host.docker.internal → host-gateway` automaticamente nesse fluxo.
  **Projetos com `docker-compose.yml` (estratégia compose) não recebem isso
  automaticamente** — se o seu compose precisa alcançar algo no host, adicione
  você mesmo no seu `docker-compose.yml`:
  ```yaml
  services:
    seu-servico:
      extra_hosts:
        - "host.docker.internal:host-gateway"
  ```
- Variáveis de ambiente configuradas na tela "Variáveis de Ambiente" do
  projeto, na plataforma, são injetadas como variáveis de ambiente reais do
  processo (`docker run -e CHAVE=valor`), **não** como um arquivo `.env`
  copiado. Se o seu código carrega um `.env` do repositório com algo como
  `os.environ.setdefault(...)` (Python) ou lib equivalente que não sobrescreve
  valores já existentes, as variáveis da plataforma **têm prioridade** sobre
  o `.env` empacotado — isso é o comportamento desejado, mas se o seu loader
  sempre sobrescreve com o `.env` do ZIP, o valor da plataforma será ignorado.
  Trate o `.env` do repositório como **default só para rodar local, fora de
  container**.
- **Portas já reservadas pela própria plataforma — nunca publique nelas no
  seu `docker-compose.yml`:**

  | Porta (host) | Uso |
  |---|---|
  | `5452` | Postgres da própria plataforma |
  | `5433` | Postgres do Supabase Local compartilhado (`SUPABASE_DB_PORT`) |
  | `6379` | Redis da plataforma |
  | `3001` | API da plataforma |
  | `5173` | Client dev (Vite) da plataforma |
  | `40000`–`50000` | Pool dinâmico de portas para containers `DOCKER_AUTO` |

  Projetos `DOCKER_AUTO` (container único) nunca colidem com essas portas —
  a plataforma aloca uma porta livre do pool dinâmico automaticamente. O
  risco existe **só** para projetos que sobem seu próprio
  `docker-compose.yml` publicando portas fixas no host — hoje não existe
  validação prévia disso; o conflito só aparece no momento do
  `docker compose up` (`Bind for 0.0.0.0:<porta> failed: port is already
  allocated`).
  - Se seu compose sobe seu próprio Postgres/Redis/etc. só para os serviços
    do próprio compose se falarem entre si, **não publique a porta no host**
    (remova o `ports:` do serviço — os outros serviços do mesmo compose já
    se alcançam pela rede interna do compose, por nome de serviço).

## Variáveis de ambiente e banco de dados

- Configure segredos e configuração de runtime (chave secreta da
  aplicação, credenciais de banco, flags de ambiente) **na tela "Variáveis de
  Ambiente" do projeto na plataforma** — não dependa só do `.env` do
  repositório, que deve ser tratado como fallback de desenvolvimento local.
- Se o projeto usa Postgres, confirme com quem administra a plataforma:
  - Se você vai usar um **banco compartilhado da plataforma** (Postgres
    principal ou Supabase Local): o role/database do seu projeto precisa ser
    criado manualmente uma vez (`CREATE ROLE`/`CREATE DATABASE`) antes do
    primeiro deploy — a plataforma não provisiona isso sozinha para bancos
    "cru" (fora do fluxo de provisionamento Supabase). `DB_HOST`
    (`host.docker.internal`) e `DB_PORT` (a porta real do Postgres
    compartilhado) devem vir das variáveis de ambiente do projeto, nunca de
    um valor fixo tipo `localhost` no código/`.env`.
  - Se o projeto declara dependências de Supabase (`@supabase/supabase-js`,
    `SUPABASE_URL` no `.env`, etc.), a plataforma detecta isso automaticamente
    (`database_requirements` na análise) e pode provisionar uma instância
    Supabase Local dedicada para o projeto — nesse caso as variáveis
    `SUPABASE_URL`/`SUPABASE_ANON_KEY`/etc. são injetadas pela plataforma, não
    precisam ser fixadas no repositório.
- **Migrations não rodam automaticamente.** Se o seu framework precisa de um
  passo de migração (Django `migrate`, Prisma `migrate deploy`, Rails
  `db:migrate`, etc.), o `Dockerfile`/entrypoint precisa rodar isso
  explicitamente antes de subir o servidor — a plataforma só builda e dá
  `docker run`/`docker compose up`, nunca executa comandos de aplicação por
  conta própria.
- **Recomendado:** o entrypoint que roda migrations deve também **esperar o
  banco aceitar conexões** antes de tentar migrar (loop de retry com timeout
  curto). Containers têm `RestartPolicy: unless-stopped` — sem essa espera,
  uma corrida de inicialização (seu container subindo antes do banco estar
  pronto) vira um loop de crash/restart em vez de se recuperar sozinho.

## Empacotamento do ZIP (se o deploy não for via GitHub import)

- Extensões aceitas dentro do ZIP: código-fonte comum (`.html .css .js .ts
  .jsx .tsx` etc.), imagens, fontes, `.json .yaml .yml .toml .env .lock`,
  certificados (`.crt .key`), entre outras — arquivos fora da lista permitida
  são rejeitados na validação. Binários de build (executáveis compilados
  sem extensão reconhecida, etc.) não são aceitos.
- Tamanho máximo do conteúdo extraído: **200 MB**.
- **Gere o ZIP a partir do controle de versão (`git archive`), não
  compactando a pasta manualmente.** Um "compactar pasta inteira" no
  explorador de arquivos ignora o `.gitignore` e frequentemente inclui
  `node_modules/`, bancos SQLite locais (`db.sqlite3`), `.venv/`, artefatos de
  build antigos, etc. — infla o ZIP, pode estourar os 200 MB, e manda estado
  local irrelevante (às vezes até sensível) para produção.
  ```bash
  git archive HEAD -o deploy.zip
  ```

## Se o projeto for servido como SPA/estático (`STATIC`)

- A plataforma serve o projeto em `/<slug>` (ou `{slug}.<domínio base>` se
  roteamento por subdomínio estiver habilitado) e injeta automaticamente
  `<base href="/<slug>/">` no `<head>` do `index.html` — não é preciso fazer
  isso manualmente no build, mas **evite hardcodar caminhos absolutos a partir
  da raiz (`/algo`) no seu código/roteador** quando o deploy for path-based;
  prefira caminhos relativos ou o roteador em modo "hash"/`basename`
  configurável.
- Rotas desconhecidas (qualquer coisa que não seja um arquivo existente)
  fazem fallback para `index.html` — roteamento client-side (React
  Router, Vue Router, etc.) funciona sem configuração extra no servidor.

## CSRF / hosts permitidos (frameworks com validação de Host/Origin)

Frameworks como Django, Rails ou similares validam o cabeçalho `Host`/CSRF
`Origin` contra uma lista configurada (`ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`
etc.). Como o app roda atrás de proxy/roteamento da plataforma (path `/slug`
ou subdomínio `{slug}.<domínio base>`), confirme que essa lista:

- aceita o domínio público real do deploy (configurado como variável de
  ambiente, não hardcoded no código-fonte);
- tem um caminho de configuração para teste local via HTTP em porta
  diferente, se você também testa o container localmente antes do deploy
  (senão login/formulários funcionam em produção mas quebram em teste local,
  ou vice-versa).

## Checklist final antes de gerar o ZIP/branch de deploy

- [ ] Não há `docker-compose.yml`/`docker-compose.yaml` de desenvolvimento na
      raiz do pacote de deploy (a menos que seja intencionalmente a
      estratégia `DOCKER_USER` compose, com portas de host revisadas contra a
      tabela de portas reservadas acima)
- [ ] `Dockerfile` (se usado) roda migrations/setup necessário antes do
      comando final do servidor, com espera/retry pela disponibilidade do
      banco
- [ ] Nenhum `.env` real com segredos de produção dentro do ZIP — segredos
      vão na tela "Variáveis de Ambiente" da plataforma
- [ ] Arquivos de estado local (bancos SQLite, `node_modules/`, `.venv/`,
      builds antigos) fora do ZIP — gerado via `git archive`, não zip manual
      da pasta
- [ ] Serviços que precisam alcançar algo no host da plataforma usam
      `host.docker.internal` (nunca `localhost`), com `extra_hosts` explícito
      no compose se aplicável
- [ ] `ALLOWED_HOSTS`/`CSRF_TRUSTED_ORIGINS` (ou equivalente do framework)
      configurável por variável de ambiente, aceitando o domínio real do
      deploy
- [ ] Porta que a aplicação escuta declarada via `EXPOSE` no Dockerfile (ou
      `ports:`/serviço correto no compose) batendo com a porta real do
      servidor da aplicação
