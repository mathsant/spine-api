---
description: Analisa o projeto e prepara o ambiente para rodar/testar a aplicação localmente, perguntando ao usuário como simular cada dependência.
---

Argumentos opcionais do usuário (ex.: "só o backend", "já uso Docker", "não quero mexer no Makefile"):
$ARGUMENTS

## Sua tarefa

O objetivo é deixar claro **como subir a aplicação na máquina de um dev para testar localmente** — seja ela web, backend, mobile, worker, CLI, o que for — e deixar o ambiente pronto para isso. O comando **documenta** o passo a passo em `.specify/memory/local-dev.md` **e cria os arquivos de infra** (compose de dev, `.env.example`, scripts de seed/topics, alvos de runner). Ele **não sobe os serviços** e **não toca no código da aplicação**.

Rode **uma vez por projeto** (depois de `/architecture`, idealmente) e de novo só quando a infra local mudar: nova dependência, troca de banco/broker, nova integração externa.

`.specify/memory/local-dev.md` é conhecimento por-projeto, sobre subir o ambiente inteiro. Não confundir com o `quickstart.md` que o `/plan` gera por-feature (passos para validar aquela feature específica).

### Passo 1 — Preparar e detectar

Rode:
```
.specify/scripts/bash/setup-localdev.sh --json
```
Isso cria `.specify/memory/local-dev.md` a partir do template (no primeiro run) e detecta pistas. Capture do JSON: `LOCALDEV_FILE`, `ARCHITECTURE_FILE`, `CONSTITUTION_FILE`, `FIRST_RUN`, `ARCHITECTURE_EXISTS`, `COMPOSE_FILES`, `DOCKERFILES`, `ENV_EXAMPLES`, `STACK_FILES`, `RUNNER_FILES`, `DEVCONTAINER`.

### Passo 2 — Inventariar o que a aplicação precisa para rodar

1. Leia `.specify/memory/architecture.md` (fonte da verdade para stack, armazenamento, mensageria). Se `ARCHITECTURE_EXISTS` for `false`, avise que rodar `/architecture` antes é recomendado, mas prossiga: faça uma varredura leve você mesmo e, em qualquer ambiguidade de stack, pergunte em vez de assumir.
2. Explore o projeto para levantar o que é necessário para a aplicação **subir e funcionar**:
   - **Runtime e build**: linguagem/versão, gerenciador de pacotes, comando de dev/serve, comando de build, migrations.
   - **Serviços de infra**: bancos (Postgres, MongoDB, MySQL...), brokers/mensageria (Kafka, RabbitMQ, SQS, NATS...), caches (Redis, Memcached), storage (S3/MinIO), search (Elastic/OpenSearch), etc. Procure em `docker-compose*`, `Dockerfile`, configs de conexão, `architecture.md`, variáveis de ambiente, clientes importados no código.
   - **Variáveis de ambiente**: varra `.env*`, `process.env`/`os.getenv`/`ConfigService`/etc. no código, `README`. Liste toda env var que a app lê, marcando quais são segredo.
   - **Integrações externas**: gateways de pagamento, e-mail/SMS, SSO/IdP corporativo, APIs de terceiros, webhooks de entrada, feature stores, etc.
   - **Portas** que cada parte expõe.
   - **Seed / dados mínimos**: fixtures, usuário de teste, coleções/tabelas que precisam existir.

### Passo 3 — Classificar cada dependência

Para cada item do inventário, classifique:

- **(a) Trivial** — é só um processo/porta local (a própria app, um worker). Sem decisão a tomar.
- **(b) Infra containerizável** — banco, broker, cache, storage, search. Tem mais de uma forma razoável de rodar local → **isso vira pergunta no Passo 4**.
- **(c) Não simulável localmente** — integração externa que não roda fiel na máquina do dev (SDK fechado, exige domínio homologado, só responde na VPN, cobra por chamada, etc.) → **tratada no Passo 5**.

### Passo 4 — Perguntar como simular cada dependência (b) — dúvida bloqueia

**Regra crítica (mesma de `/specify` e `/architecture`): não assuma como rodar uma dependência — pergunte.** Uma pergunta por vez, aguardando resposta, com **sugestões concretas e o trade-off de cada uma**. Exemplos do tipo de sugestão a oferecer (adapte à stack real):

- **MongoDB**: container `mongo:7` no compose dev (fiel, precisa de Docker) · `mongodb-memory-server` só nos testes (rápido, não serve pra rodar a app) · Mongo instalado na máquina · cluster Atlas de dev compartilhado (precisa de rede/credencial).
- **Kafka**: container `redpanda` (leve, API-compatível, sobe rápido) · `bitnami/kafka` em modo KRaft (mais fiel ao Kafka real, mais pesado) · testcontainers só nos testes · cluster de dev na nuvem.
- **PostgreSQL**: container `postgres:16` no compose · Postgres local · SQLite como substituto local (só se a app não usar recursos específicos de PG).
- **Redis**: container `redis:7` · fake em memória (`fakeredis`/`ioredis-mock`) nos testes · Redis local.
- **S3 / storage**: `minio` no compose · `localstack` · bucket real de dev.

Pergunte também **versão** quando `architecture.md`/lockfile não fixar (ex.: "Kafka: qual versão o ambiente de produção usa?"). Se o usuário disser "tanto faz", escolha a opção mais fiel a produção e registre a escolha.

### Passo 5 — Integrações que não rodam localmente (c)

Para cada integração da classe (c):

1. Documente **explícito** na seção "Não roda localmente" de `local-dev.md`: o que é, **por que** não roda local, e a estratégia recomendada (sandbox do fornecedor com chaves de teste · feature flag para desligar o fluxo · usar o stub local).
2. **Ofereça gerar um stub/mock local simples** (um fake HTTP server, mappings de WireMock, um módulo fake plugável por env var). Só gere se o usuário aceitar. Se gerar, documente na seção "Stubs / mocks locais" o que ele finge ser, como ligá-lo e suas limitações.
3. Nunca deixe o usuário achando que uma integração desligada/stubada está "real".

### Passo 6 — Confirmar o plano antes de escrever

Mostre ao usuário um resumo fechado: cada serviço (b) e como será simulado + versão, cada integração (c) e o tratamento, e a lista de arquivos que você vai criar/alterar. Peça confirmação (igual `/architecture`). Ajuste conforme o feedback.

### Passo 7 — Criar os arquivos de infra

Nos locais convencionais do projeto (**não** dentro de `.specify/`), seguindo `architecture.md` para caminho de scripts:

- **`docker-compose.dev.yml`** (ou o nome que o usuário preferir) com os serviços escolhidos: **versão de imagem fixa** (nunca `:latest`), `healthcheck`, volumes nomeados, `ports` mapeadas. Se já existir um compose (`COMPOSE_FILES` não vazio), **não sobrescreva** — mostre os serviços que adicionaria e pergunte se prefere um arquivo `*.dev.yml` separado ou um merge.
- **`.env.example`** com **toda** env var que a app lê, agrupada por área, com default local seguro e comentário. Segredos ficam **vazios** com um comentário de onde obter. **Nunca escreva um `.env` real nem valores de segredo.** Se `ENV_EXAMPLES` já tiver um arquivo, complemente-o em vez de duplicar (ou crie `.env.local.example` se o existente for de outro contexto — pergunte).
- **Scripts de bootstrap** quando necessário (criar tópicos Kafka, init de banco, seed): em `scripts/dev/` ou onde `architecture.md` mandar. Torne-os idempotentes.
- **Ponto de entrada único** (opcional, se ajudar): um alvo `dev-up`/`dev-down` em `Makefile`/`Taskfile`, ou um script em `package.json`. Se o arquivo já existe, **mostre o diff e confirme** antes de alterar — nunca reescreva um `Makefile`/`package.json` existente por conta própria.
- **Stubs** da classe (c) só se o usuário optou no Passo 5.
- **Não** rode `docker compose up`, migrations, seed, nem inicie qualquer serviço. **Não** edite código da aplicação.

### Passo 8 — Escrever `local-dev.md`

Preencha `LOCALDEV_FILE` a partir do template, com valores concretos: pré-requisitos com versão, tabela de serviços e dependências, portas, passo a passo com os comandos exatos, referência de env vars, instruções de seed, a seção "Não roda localmente", a lista de arquivos gerados, o smoke test de verificação e os problemas comuns previsíveis.

**No re-run** (`FIRST_RUN` = `false`): sobrescreva o conteúdo gerado, mas **preserve** tudo entre `<!-- SDD:MANUAL:INICIO -->` e `<!-- SDD:MANUAL:FIM -->`, e **acrescente** uma linha em "Histórico" com o que mudou (serviço novo, troca de imagem, integração removida) em vez de substituir o histórico.

### Passo 9 — Reportar

Diga ao usuário:
- Os serviços escolhidos e como cada um é simulado (com a versão fixada).
- Os arquivos criados/alterados — lembrando que `docker-compose.dev.yml` e `.env.example` ainda precisam de revisão dele, e que ele deve `cp .env.example .env` e preencher os segredos.
- Quais dependências **não rodam localmente** e o workaround de cada uma.
- Os comandos exatos para subir o ambiente e o smoke test para confirmar que subiu.

## Regras importantes

- **Dúvida bloqueia, não assume** — nunca escolha sozinho como simular uma dependência (b); pergunte, uma de cada vez, com opções e trade-offs.
- **Nunca escreva um `.env` real** nem qualquer arquivo com segredo/credencial. `.env.example` só tem placeholder e default local seguro.
- **Nunca sobrescreva** `docker-compose*.yml`, `Makefile` ou scripts de `package.json` existentes — proponha o diff e confirme, ou use um arquivo `*.dev` separado.
- **Este comando não sobe nada** (`docker compose up`, migrations, seed, servidor) — só prepara e documenta.
- **Não toca em `specs/`** nem no código da aplicação.
- **Imagens de container sempre com versão fixa** — nada de `:latest`.
- **O que não roda localmente tem que ficar explícito** em `local-dev.md` — o usuário nunca deve confundir um fluxo stubado/desligado com o real.
