# Ambiente de desenvolvimento local: better-books

**Origem**: detectado a partir do projeto (docker-compose.yml, .env.example e architecture.md já existiam e cobriam toda a stack)
**Última atualização**: 2026-09-04

<!--
Este arquivo descreve COMO subir o projeto na máquina de um dev para testar
localmente. É conhecimento por-projeto (como architecture.md): rode /localdev uma
vez e de novo só quando a infra local mudar (nova dependência, troca de banco/broker,
nova integração externa).
-->

## Como rodar (resumo)

```bash
# 1. copie o exemplo de env e preencha MONGO_URI com a connection string do seu
#    cluster Atlas (Atlas UI -> Connect -> Drivers)
cp .env.example .env

# 2. instale as dependências e rode as migrations (contra o Atlas)
pnpm install
pnpm run migrate:up

# 3. suba a aplicação (watch mode)
pnpm run dev
```

Não há mais container local obrigatório — o Mongo é o cluster Atlas apontado por
`MONGO_URI`. O `docker-compose.yml` continua no repo como caminho **legado/opcional**
(rodar Mongo 100% local, sem depender do Atlas); ver seção própria abaixo.

## Pré-requisitos

| Ferramenta | Versão | Para quê | Como instalar |
|---|---|---|---|
| Node.js | v24.x (`engines` exige `>=24 <25`) | rodar a API | nvm / instalador oficial |
| pnpm | 9.15.4 (`packageManager` no `package.json`) | instalar deps e rodar scripts | `corepack enable` ou `npm i -g pnpm@9.15.4` |
| Acesso ao cluster Atlas `development` | — | conectar ao MongoDB | usuário/senha do banco (peça a quem administra o projeto Atlas) |
| (opcional/legado) Docker + Compose v2 | qualquer recente (testado com 29.2) | subir um MongoDB local em vez do Atlas | Docker Desktop |

> **Nota**: `architecture.md` ainda cita `npm` como gerenciador de pacotes — divergência conhecida
> e já registrada no `CLAUDE.md` do repo. O projeto usa `pnpm` de fato (`pnpm-lock.yaml` versionado).

## Serviços e dependências

| Dependência | Papel no sistema | Como rodar localmente | Config / credenciais |
|---|---|---|---|
| MongoDB | banco principal (books, users, sessions, reading-sessions, etc.) | **cluster MongoDB Atlas** `development` (`development.1oqv3.mongodb.net`) — nenhum processo local necessário | `MONGO_URI=mongodb+srv://<user>:<password>@development.1oqv3.mongodb.net/?appName=development`, `MONGO_DB_NAME=better_books` |
| Open Library (`openlibrary.org`) | busca/cache de metadados de livro (`src/integrations/open-library/`) | **não é simulada** — a app chama a API pública real via `fetch`; é read-only, sem chave/auth | `OPEN_LIBRARY_BASE_URL`, `OPEN_LIBRARY_TIMEOUT_MS` (default 5000ms) |

Não há broker, cache ou storage adicional nesta stack.

### Caminho legado/opcional: MongoDB local via Docker

`docker-compose.yml` continua no repo subindo `mongo:7` em `localhost:27017` pra
quem preferir não depender do Atlas (ex.: sem rede, teste isolado). Pra usar:
`docker compose up -d` e trocar `MONGO_URI` no `.env` pra
`mongodb://localhost:27017`. Não é o caminho recomendado nem documentado como
padrão a partir desta mudança — Atlas é a fonte da verdade agora.

### Portas usadas

| Porta | Serviço |
|---|---|
| 3000 | API (Fastify) |
| 27017 | MongoDB local (só no caminho legado via docker-compose) |

## Passo a passo detalhado

1. `cp .env.example .env` e preencha `MONGO_URI` com a connection string do cluster
   Atlas `development` (usuário/senha do banco — peça a quem administra o projeto
   Atlas se não tiver). Troque `ACCESS_TOKEN_SECRET` só se quiser um segredo
   próprio (é usado para assinar JWT, qualquer string ≥32 chars serve em dev).
2. `pnpm install` — instala as dependências (Fastify, Awilix, driver mongodb, zod, etc.).
3. `pnpm run migrate:up` — roda as 6 migrations em `migrations/` (users, auth-sessions, refresh-tokens, books, shelf-memberships, reading-sessions) **contra o cluster Atlas**. Lê `MONGO_URI`/`MONGO_DB_NAME` do `.env` via `migrate-mongo-config.js`.
4. `pnpm run dev` — sobe a API em modo watch (`tsx watch src/server.ts`) em `http://localhost:3000`.
5. Confirme com o smoke test abaixo.

## Variáveis de ambiente

Fonte da verdade: **`.env.example`** (na raiz, já completo — cobre todas as vars de `src/config/env.schema.ts`). Copie para `.env`.

| Variável | Obrigatória | Default local | Observação |
|---|---|---|---|
| `NODE_ENV` | não | `development` | ativa `pino-pretty` no logger |
| `PORT` | não | `3000` | porta da API |
| `HOST` | não | `0.0.0.0` | bind address |
| `MONGO_URI` | sim | — (placeholder no `.env.example`) | connection string do cluster Atlas `development`; local `.env` real tem usuário/senha e **não é versionado** |
| `MONGO_DB_NAME` | sim | `better_books` | nome do banco (selecionado via `client.db()`, independente do path na URI) |
| `LOG_LEVEL` | não | `info` | nível do pino |
| `ACCESS_TOKEN_SECRET` | sim | `dev-only-change-me-please-32-chars-min` | segredo HS256 (≥32 chars); troque para algo próprio se quiser, não precisa ser real segredo em dev |
| `AUTH_RATE_LIMIT_MAX` | não | `10` | limite de tentativas de auth |
| `AUTH_RATE_LIMIT_WINDOW_MS` | não | `900000` | janela do rate limit (ms) |
| `OPEN_LIBRARY_BASE_URL` | não | `https://openlibrary.org` | API real, sem chave |
| `OPEN_LIBRARY_TIMEOUT_MS` | não | `5000` | timeout de rede |
| `MONGO_PORT` | não (só compose, caminho legado) | `27017` | usada só pelo `docker-compose.yml`, não lida pela app |

## Dados de exemplo / seed

Sem seed — o banco sobe vazio (só as coleções criadas pelas migrations, sem documentos). Para testar os fluxos, registre um usuário via `POST /v1/auth/register` e use os endpoints de books/reading-sessions normalmente — não há script de seed no repositório.

## Não roda localmente

Nenhuma integração desta feature está bloqueada localmente. A Open Library é chamada de verdade (API pública, sem custo/chave); se a máquina estiver sem rede, `search`/cache-on-read vão falhar com timeout — isso é esperado e não precisa de stub (os testes de integração já isolam essa rede com `FakeOpenLibraryClient`, então a suíte de testes não depende de internet — só a app rodando em `pnpm run dev` depende).

## Arquivos gerados pelo /localdev

Nenhum arquivo de infra novo — `docker-compose.yml` e `.env.example` já existiam e já cobriam toda a stack. Este comando só criou/preencheu `.specify/memory/local-dev.md`.

## Verificação (smoke test)

- [ ] `curl -sf localhost:3000/health` retorna 200
- [ ] `pnpm run migrate:up` roda sem erro e sem migrations pendentes na segunda execução

## Problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| `MongoServerSelectionError` / timeout ao conectar | IP local não está na access list do projeto Atlas, ou `MONGO_URI`/senha errados | confirmar `MONGO_URI` no `.env`; pedir a quem administra o Atlas pra liberar seu IP na Network Access do projeto |
| `querySrv ECONNREFUSED _mongodb._tcp.<cluster>` (Windows) ao usar `mongodb+srv://` | bug local: o serviço "DNS Client" do Windows em `127.0.0.1:53` recusa consultas SRV/TXT que o driver do Mongo precisa pra resolver `mongodb+srv://` (confirmado nesta máquina — `dns.lookup` comum funciona, `dns.resolveSrv`/`resolveTxt` não); não é problema do Atlas nem do projeto | trocar `MONGO_URI` pra formato padrão (não-SRV) com os 3 hosts do shard: pegue os hosts/`replicaSet` em Atlas UI → Connect → Drivers → "not using the SRV connection format?" (ou via `nslookup -type=SRV _mongodb._tcp.<cluster>` / `nslookup -type=TXT <cluster>` usando um DNS externo tipo 8.8.8.8) e monte `mongodb://user:pass@host1:27017,host2:27017,host3:27017/?replicaSet=<rs>&authSource=admin&tls=true` |
| `migrate-mongo: MONGO_URI and MONGO_DB_NAME must be set` | `.env` não existe ou não foi copiado de `.env.example` | `cp .env.example .env` e preencher `MONGO_URI` |
| `Invalid environment configuration` ao subir a app | alguma env var obrigatória ausente/inválida no `.env` | ver a lista de issues impressa no console; conferir contra `env.schema.ts` |
| Erro de timeout ao buscar livro por `olid` novo | sem rede / Open Library fora do ar | checar conectividade; endpoint depende de rede real |
| Preciso rodar sem Atlas (offline, teste isolado) | caminho legado ainda funciona | `docker compose up -d` e trocar `MONGO_URI` pra `mongodb://localhost:27017` no `.env` |

<!-- SDD:MANUAL:INICIO -->
<!-- Notas manuais do time sobre o ambiente local. Preservado no re-run do /localdev. -->
<!-- SDD:MANUAL:FIM -->

## Histórico

| Data | Mudança |
|---|---|
| 2026-09-04 | Configuração inicial documentada — infra (compose + .env.example) já existia pronta desde a feature 003; nenhum arquivo novo de infra precisou ser criado. |
| 2026-09-04 | Trocado o Mongo padrão de dev pra MongoDB Atlas (cluster `development`). `docker-compose.yml` mantido como caminho legado/opcional; `.env.example` passou a usar placeholder de `MONGO_URI` em vez do `mongodb://localhost:27017`. |
