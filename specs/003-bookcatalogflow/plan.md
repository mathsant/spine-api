# Plano de Implementação: Books Flow — busca, cache e status de leitura

**Branch**: `003-bookcatalogflow` | **Data**: 2026-09-04 | **Spec**: [spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/003-bookcatalogflow/spec.md`

## Resumo

Entregar a fatia inicial de livros do MVP (`product.md` escopo 4 + 5, P2/P3/P4/P10): busca de
livros por título/autor via Open Library, cache local (`books`) gravado só quando o usuário
interage pela primeira vez, `want_to_read` idempotente, e o ciclo completo de
`ReadingSession` (iniciar, progresso por página, finalizar, marcar como lido direto,
releitura, editar, apagar, histórico paginado). Review, Feed e visualização do status de
outro usuário (depende de Follow) ficam fora — todos os endpoints operam só sobre o próprio
usuário autenticado (RF-020).

Abordagem técnica (Fase 0, `research.md`, decisões D1–D11):
- **Open Library**: um único port `OpenLibraryClient` sobre `search.json` (busca livre e
  lookup exato por `olid` via `q=key:...`) — sem endpoints `works/`/`authors/` separados (D1).
- **Transporte**: `fetch` nativo do Node 24 + `AbortController` para timeout — zero
  dependência nova (D2).
- **Identificador de rota**: `olid` (chave de obra do Open Library); toda ação sobre um livro
  resolve/cacheia (`findByOlid` → `openLibraryClient.findByKey` → `upsertByOlid`) exceto
  remover `want_to_read`, que só olha o cache local (D3).
- **Paginação**: cursor opaco nas listas internas (`want_to_read`, histórico de sessions);
  `page`/`limit` na busca externa, por ser um proxy de API já paginada por offset (D4).
- **Concorrência**: índice único parcial `{ userId, bookId }` com `status: 'reading'` garante
  no máximo uma session aberta por livro/usuário; violação é traduzida em "reaproveita a
  existente" no repositório (D5). `want_to_read` idempotente via índice único + upsert (D6).
- **Consistência entre coleções**: remoção automática de `want_to_read` ao iniciar/finalizar
  leitura é melhor esforço, sem transação multi-documento (D7, mesma decisão da 002).
- **Testabilidade**: `OpenLibraryClient` é injetado por interface; testes de service usam um
  `FakeOpenLibraryClient` — o MongoDB continua real via `mongodb-memory-server` (D8).
- **Posse**: session de outro usuário responde `404 READING_SESSION_NOT_FOUND` (nunca `403`),
  para não vazar a existência de dados privados de terceiros (D9, alinhado a P6 do `product.md`).
- **Config**: `OPEN_LIBRARY_BASE_URL`, `OPEN_LIBRARY_TIMEOUT_MS` (ambas com default, não
  obrigatórias) no `AppConfig` (D10).
- **Persistência**: coleções `books`, `shelf_memberships`, `reading_sessions` via 3 migrations
  `migrate-mongo` reversíveis (D11).

## Contexto Técnico

<!-- Esta seção é lida pelo update-agent-context.sh para atualizar o CLAUDE.md do projeto. -->

**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova nesta feature** — integração com Open Library via `fetch` nativo do Node 24 (`src/integrations/open-library/`)
**Armazenamento**: MongoDB — coleções `books`, `shelf_memberships`, `reading_sessions` criadas por 3 migrations `migrate-mongo` reversíveis; `mongodb-memory-server` ^11 nos testes de integração (rede do Open Library isolada por um `FakeOpenLibraryClient`, não pela rede real)
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (services de books/reading-sessions) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; `search`/cache-on-read fazem 1 chamada de rede ao Open Library quando o cache não tem o `olid` ainda (aceito — RF-003); timeout de rede configurável (`OPEN_LIBRARY_TIMEOUT_MS`, default 5000ms) evita requisição pendurada
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; `fetch`/rede do Open Library só em `integrations/open-library/**`; services não importam Fastify; nenhum `export default`; no máximo 1 reading session `reading` aberta por livro/usuário (índice único parcial); progresso não valida contra total de páginas (RF-013); session de terceiro responde `404`, nunca `403` (D9)
**Escala/escopo**: 11 endpoints (`GET /v1/books/search`, `GET /v1/books/:olid`, `PUT`/`DELETE /v1/books/:olid/want-to-read`, `POST /v1/books/:olid/start-reading`, `POST /v1/books/:olid/mark-finished`, `GET /v1/me/want-to-read`, `POST /v1/reading-sessions/:id/progress`, `POST /v1/reading-sessions/:id/finish`, `PATCH`/`DELETE /v1/reading-sessions/:id`, `GET /v1/me/reading-sessions`), 3 coleções + 3 migrations, 3 entidades persistidas (Book, ShelfMembership, ReadingSession), 5 classes de erro novas, 12 services, 3 repositories, 2 pastas transversais novas (`src/integrations/open-library/`, `src/lib/` para o cursor)

> **Nota sobre `architecture.md`**: o documento lista `npm` como gerenciador de pacotes, mas o
> repositório já adotou `pnpm` (commit `962fd39`, `package.json` com `"packageManager":
> "pnpm@9.15.4"`, `pnpm-lock.yaml` versionado — feature 002). Este plano segue o estado real
> do repositório (`pnpm`); vale atualizar `architecture.md` numa próxima passada de
> `/architecture` para eliminar a divergência (fora do escopo deste plano).

## Verificação da Constituição

*Gate obrigatório: rodado antes da Fase 0 e novamente após a Fase 1. Consulte `.specify/memory/constitution.md`.*

- [x] **Idioma do código: inglês** — toda pasta/arquivo/identificador/contrato/entidade/erro deste plano está em inglês (`books`, `shelf_memberships`, `reading_sessions`, `startReadingService`, `ReadingSessionNotFoundError`, …); artefatos SDD seguem em português. Conforme.
- [x] **P1 Testes por tipo de código** — regra de negócio = os 12 services de `src/services/books/` e `src/services/reading-sessions/` (leem/escrevem `books`, `shelf_memberships`, `reading_sessions`): cobertos por **integração** com `mongodb-memory-server` (sem mock de banco) + `FakeOpenLibraryClient` (isola só a rede de terceiro, não o banco), caminho feliz + ≥1 de erro cada. Funções puras — `encodeCursor`/`decodeCursor`, schemas `zod`, mapeamento de resposta do Open Library — por **unitário**. `HttpOpenLibraryClient` tem teste de integração próprio contra stub HTTP local. Gate `src/services/**` ≥ 70% no CI. Conforme.
- [x] **P2 Acesso a dados só via repositório** — `BookRepository`+`MongoBookRepository`, `ShelfMembershipRepository`+`MongoShelfMembershipRepository`, `ReadingSessionRepository`+`MongoReadingSessionRepository`, todos injetados por Awilix. Services não importam `mongodb` (regra ESLint da 001 barra o import fora de `repositories/**`/`db/**`). Conforme.
- [x] **P3 Validação de entrada com Zod na borda** — um schema `zod` por endpoint em `src/schemas/books/` e `src/schemas/reading-sessions/`, validado no controller antes do service; `ZodError` → `ValidationError` (400 + `details`) pelo handler global já existente. Services recebem só dados já validados/tipados. Conforme.
- [x] **P4 Mudança de schema/índice apenas via migration** — 3 migrations `migrate-mongo` reversíveis criam as coleções e todos os índices (`books.olid` único, `books.isbn13` único esparso, `shelf_memberships.{userId,bookId}` único, `reading_sessions.{userId,bookId}` único parcial `status:'reading'`, `reading_sessions.{userId,createdAt}`, `reading_sessions.{userId,bookId}`). Nenhum `createIndex` no bootstrap. Conforme.
- [x] **P5 Erros tipados com hierarquia** — 5 classes novas estendem `AppError`: `BookNotFoundError`, `OpenLibraryUnavailableError`, `ReadingSessionNotFoundError`, `InvalidReadingSessionStateError`, `InvalidReadingSessionDatesError`. `MongoBookRepository`/`MongoReadingSessionRepository` capturam `code 11000` e traduzem (nunca propagam — no caso do índice parcial, viram "reaproveita a session existente", não um erro); `HttpOpenLibraryClient` captura falha de rede/timeout/5xx e traduz para `OpenLibraryUnavailableError`. Nada de infra vaza para a borda. Conforme.

**Nenhuma dependência nova** — `fetch`/`AbortController` já vêm com o Node 24 (D1/D2 do `research.md`).

Resultado: **sem violações** na rodada inicial. Repetir após a Fase 1 abaixo.

## Estrutura do Projeto

### Documentos desta feature (`specs/003-bookcatalogflow/`)

```
specs/003-bookcatalogflow/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # Fase 0 — decisões D1–D11
├── data-model.md        # Fase 1 — Book, ShelfMembership, ReadingSession, DTOs, erros
├── quickstart.md         # Fase 1 — validação manual (12 passos)
├── contracts/            # Fase 1
│   ├── books.openapi.yaml      # 11 endpoints, /v1
│   ├── internal-ports.md       # interfaces entre camadas (integrations/, repositories, services, http)
│   ├── error-codes.md          # 5 códigos novos + reaproveitados + invariantes
│   └── env.contract.md         # OPEN_LIBRARY_BASE_URL, OPEN_LIBRARY_TIMEOUT_MS
└── tasks.md               # Fase 2 — gerado pelo /tasks, não por este comando
```

### Código-fonte (raiz do repositório)

Segue a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`,
com duas pastas transversais novas (`src/integrations/open-library/`, `src/lib/`) seguindo a
mesma lógica de `src/auth/`/`src/http/` da 002 (utilidades sem camada de domínio, documentado
abaixo). Arquivos que esta feature cria (C):

```
better-books/
├── src/
│   ├── app.ts                                          # M: registra booksRoutes, readingSessionsRoutes com { prefix: '/v1' }
│   ├── config/
│   │   └── env.schema.ts                                # M: + OPEN_LIBRARY_BASE_URL, OPEN_LIBRARY_TIMEOUT_MS
│   ├── integrations/
│   │   └── open-library/                                 # C: pasta transversal — cliente HTTP do Open Library
│   │       ├── open-library-client.ts                   # C: interface OpenLibraryClient
│   │       ├── http-open-library-client.ts               # C: implementação (fetch + AbortController)
│   │       └── index.ts                                  # C
│   ├── lib/                                              # C: pasta transversal — utilidades puras sem I/O
│   │   ├── pagination.ts                                 # C: encodeCursor / decodeCursor
│   │   └── index.ts                                      # C
│   ├── container/
│   │   ├── cradle.ts                                     # M: + os 3 repositories, openLibraryClient, os 12 services
│   │   ├── register-infrastructure.ts                    # M: + openLibraryClient (asFunction a partir de config)
│   │   ├── register-repositories.ts                      # M: + bookRepository, shelfMembershipRepository, readingSessionRepository
│   │   └── register-services.ts                          # M: + os 12 services novos
│   ├── errors/
│   │   ├── book-not-found-error.ts                      # C: 404 BOOK_NOT_FOUND
│   │   ├── open-library-unavailable-error.ts             # C: 503 OPEN_LIBRARY_UNAVAILABLE
│   │   ├── reading-session-not-found-error.ts            # C: 404 READING_SESSION_NOT_FOUND
│   │   ├── invalid-reading-session-state-error.ts        # C: 409 INVALID_READING_SESSION_STATE
│   │   ├── invalid-reading-session-dates-error.ts        # C: 422 INVALID_READING_SESSION_DATES
│   │   └── index.ts                                      # M: re-exporta os novos
│   ├── schemas/
│   │   ├── books/
│   │   │   ├── search-books.schema.ts                    # C
│   │   │   ├── list-want-to-read.schema.ts                # C
│   │   │   ├── mark-finished.schema.ts                    # C
│   │   │   └── index.ts                                   # C
│   │   └── reading-sessions/
│   │       ├── update-progress.schema.ts                  # C
│   │       ├── finish-reading-session.schema.ts            # C
│   │       ├── edit-reading-session.schema.ts              # C
│   │       ├── list-reading-sessions.schema.ts             # C
│   │       └── index.ts                                    # C
│   ├── controllers/
│   │   ├── books/
│   │   │   ├── books.routes.ts                           # C: plugin do domínio; preHandler app.authenticate em todas
│   │   │   ├── search-books.controller.ts                # C
│   │   │   ├── get-book.controller.ts                    # C
│   │   │   ├── mark-want-to-read.controller.ts            # C
│   │   │   ├── unmark-want-to-read.controller.ts           # C
│   │   │   ├── start-reading.controller.ts                # C: responde 200/201 conforme created
│   │   │   ├── mark-finished.controller.ts                 # C
│   │   │   ├── list-want-to-read.controller.ts              # C
│   │   │   └── index.ts                                     # C
│   │   └── reading-sessions/
│   │       ├── reading-sessions.routes.ts                 # C: plugin do domínio; preHandler app.authenticate em todas
│   │       ├── update-progress.controller.ts               # C
│   │       ├── finish-reading-session.controller.ts        # C
│   │       ├── edit-reading-session.controller.ts           # C
│   │       ├── delete-reading-session.controller.ts         # C
│   │       ├── list-reading-sessions.controller.ts           # C
│   │       └── index.ts                                      # C
│   ├── services/
│   │   ├── books/
│   │   │   ├── search-books.service.ts                    # C
│   │   │   ├── get-book.service.ts                         # C
│   │   │   ├── mark-want-to-read.service.ts                 # C
│   │   │   ├── unmark-want-to-read.service.ts                # C
│   │   │   ├── list-want-to-read.service.ts                  # C
│   │   │   ├── types.ts                                       # C: DTOs (BookSearchResultDTO, BookDetailDTO, BookCursorPageDTO)
│   │   │   └── index.ts                                        # C
│   │   └── reading-sessions/
│   │       ├── start-reading.service.ts                    # C
│   │       ├── mark-finished.service.ts                     # C
│   │       ├── update-progress.service.ts                   # C
│   │       ├── finish-reading-session.service.ts              # C
│   │       ├── edit-reading-session.service.ts                # C
│   │       ├── delete-reading-session.service.ts               # C
│   │       ├── list-reading-sessions.service.ts                # C
│   │       ├── types.ts                                          # C: ReadingSessionDTO, ReadingSessionCursorPageDTO
│   │       └── index.ts                                          # C
│   └── repositories/
│       ├── books/
│       │   ├── book.repository.ts                          # C: interface BookRepository
│       │   ├── mongo-book.repository.ts                     # C: impl + upsertByOlid
│       │   └── index.ts                                      # C
│       ├── shelf-memberships/
│       │   ├── shelf-membership.repository.ts                 # C: interface
│       │   ├── mongo-shelf-membership.repository.ts            # C: impl (upsert idempotente, cursor)
│       │   └── index.ts                                         # C
│       └── reading-sessions/
│           ├── reading-session.repository.ts                   # C: interface
│           ├── mongo-reading-session.repository.ts              # C: impl (índice parcial, tradução de 11000, cursor)
│           └── index.ts                                          # C
├── migrations/
│   ├── <ts>-create-books-collection.js                     # C: books + índice único olid + índice único esparso isbn13
│   ├── <ts>-create-shelf-memberships-collection.js          # C: shelf_memberships + índice único {userId,bookId}
│   └── <ts>-create-reading-sessions-collection.js           # C: reading_sessions + índice único parcial + 2 índices de listagem
├── tests/
│   ├── unit/
│   │   ├── lib/pagination.spec.ts                          # C: encode/decode round-trip; cursor malformado
│   │   ├── integrations/open-library/http-open-library-client.spec.ts  # C: mapeamento de resposta, timeout, 5xx -> OpenLibraryUnavailableError
│   │   └── schemas/{books,reading-sessions}/*.spec.ts       # C: um por schema
│   └── integration/
│       ├── helpers/
│       │   ├── book-indexes.ts                              # C: ensureBookIndexes(db) — replica os índices das migrations no Db em memória
│       │   └── fake-open-library-client.ts                  # C: FakeOpenLibraryClient determinístico (D8)
│       ├── services/books/
│       │   ├── search-books.service.spec.ts                 # C: ok; erro de rede do fake
│       │   ├── get-book.service.spec.ts                      # C: cache hit; cache miss + resolve; olid inexistente -> 404; falha de rede -> 503
│       │   ├── mark-want-to-read.service.spec.ts               # C: cria membership; idempotente; cacheia se não cacheado
│       │   ├── unmark-want-to-read.service.spec.ts              # C: remove; no-op se nunca cacheado (sem chamar o fake)
│       │   └── list-want-to-read.service.spec.ts                 # C: paginação, cursor
│       ├── services/reading-sessions/
│       │   ├── start-reading.service.spec.ts                   # C: cria; reaproveita aberta; remove want_to_read
│       │   ├── mark-finished.service.spec.ts                    # C: cria finished direto; releitura cria outra; remove want_to_read
│       │   ├── update-progress.service.spec.ts                   # C: ok; rejeita se não reading
│       │   ├── finish-reading-session.service.spec.ts             # C: ok; idempotente se já finished
│       │   ├── edit-reading-session.service.spec.ts                # C: ok; rejeita finishedAt < startedAt
│       │   ├── delete-reading-session.service.spec.ts               # C: ok; 404 se de outro usuário
│       │   └── list-reading-sessions.service.spec.ts                 # C: paginação, filtro por bookId
│       └── http/
│           ├── books.routes.spec.ts                          # C: app.inject() — os 7 endpoints de /books e /me/want-to-read
│           └── reading-sessions.routes.spec.ts                 # C: app.inject() — os 5 endpoints de /reading-sessions e /me/reading-sessions
├── .env.example                                 # M: + 2 linhas (OPEN_LIBRARY_*)
└── README.md                                    # M: seção "Books" com os 11 endpoints e códigos de erro
```

> `src/integrations/open-library/` e `src/lib/` não estão em `architecture.md`, mas seguem a
> mesma lógica de `src/auth/`/`src/http/`/`src/lifecycle/` da 001/002: utilidades transversais
> sem estado de domínio. `src/integrations/` é o único lugar (fora de testes) onde `fetch` é
> chamado para um serviço de terceiro — mesmo espírito de "`mongodb` só em `repositories/**`",
> aplicado à rede externa.

## Fase 0: Pesquisa

Concluída — ver [research.md](./research.md). Nenhum `[NEEDS CLARIFICATION]` remanescente: a
stack está fixada por `architecture.md` (com a nota de divergência `pnpm` acima) e o
comportamento pela spec + esclarecimentos de 2026-09-04. Decisões: D1 client único sobre
`search.json` · D2 `fetch` nativo, sem dependência nova · D3 `olid` como identificador de
rota + cache-on-read · D4 cursor interno / page-limit externo · D5 índice único parcial para
"no máximo 1 session aberta" · D6 `want_to_read` idempotente via índice único + upsert · D7
remoção de `want_to_read` best-effort, sem transação · D8 `OpenLibraryClient` injetável, fake
nos testes de service · D9 posse de session responde 404, nunca 403 · D10 novas envs (ambas
com default) · D11 3 migrations novas.

**Saída**: `research.md`.

## Fase 1: Design & Contratos

Concluída.

1. `data-model.md` — `Book`, `ShelfMembership`, `ReadingSession` (coleções + índices +
   regras), DTOs de resposta, schemas de entrada e as 5 classes de erro novas.
2. `contracts/` — `books.openapi.yaml` (11 endpoints sob `/v1`), `internal-ports.md`
   (`OpenLibraryClient`, `src/lib/pagination.ts`, os 3 repositories, assinaturas dos 12
   services, plugins de rota), `error-codes.md` (tabela código→status→origem +
   invariantes), `env.contract.md` (`OPEN_LIBRARY_BASE_URL`, `OPEN_LIBRARY_TIMEOUT_MS`).
3. Cenários de teste extraídos dos 15 cenários de aceitação da spec → mapeados em
   `tests/unit/**` e `tests/integration/**` na Estrutura do Projeto acima (destaque para
   reaproveitamento de session aberta, remoção automática de `want_to_read`, e a distinção
   `BOOK_NOT_FOUND` vs `OPEN_LIBRARY_UNAVAILABLE`).
4. `quickstart.md` — 12 passos cobrindo cada área da Definição de Pronto.
5. Design/telas: N/A (sem `design/`, sem UI).
6. `update-agent-context.sh` — executado para propagar a stack desta feature ao `CLAUDE.md`.

**Saída**: `data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md` atualizado.

## Fase 2: Abordagem de Planejamento de Tarefas

*Descrição do que o `/tasks` fará — não executar agora, não gerar `tasks.md` aqui.*

**Estratégia de geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md` como base.
- **Bloco A — fundação** (sequencial): estender `env.schema.ts` + `.env.example`
  (`OPEN_LIBRARY_*`, D10); as 3 migrations `migrate-mongo` (D11).
- **Bloco B — utilidades puras** (`[P]` entre si, TDD): `src/lib/pagination.ts`
  (`encodeCursor`/`decodeCursor`) com `tests/unit/lib/pagination.spec.ts`.
- **Bloco C — integração externa, TDD**: `OpenLibraryClient` (interface) →
  `HttpOpenLibraryClient` com teste unitário-de-borda contra stub HTTP local (mapeamento,
  timeout, 5xx); `tests/integration/helpers/fake-open-library-client.ts` (dublê
  determinístico, sem teste próprio — é fixture).
- **Bloco D — erros** (`[P]` entre si): uma tarefa por classe em `src/errors/*-error.ts` +
  atualizar `src/errors/index.ts`.
- **Bloco E — schemas `zod`** (`[P]` entre si): um arquivo + um `*.spec.ts` unitário por
  schema em `src/schemas/books/` e `src/schemas/reading-sessions/`; criar os `index.ts`.
- **Bloco F — repositories, ordem TDD**: (0) `tests/integration/helpers/book-indexes.ts`
  (replica os índices das migrations no `Db` em memória — migrations não rodam sob
  `mongodb-memory-server`, mas a tradução de `11000` depende dos índices); (1)
  `BookRepository`; (2) `ShelfMembershipRepository`; (3) `ReadingSessionRepository` (a mais
  sensível — índice único parcial, tradução de reaproveitamento, cursor) — cada uma:
  teste de integração antes da implementação.
- **Bloco G — services `books`, ordem TDD** (dependem de B, C, D, F):
  `get-book.service` (a base do cache-on-read, os outros a reaproveitam) →
  `search-books.service` → `mark-want-to-read.service` → `unmark-want-to-read.service` →
  `list-want-to-read.service`; criar `src/services/books/index.ts`.
- **Bloco H — services `reading-sessions`, ordem TDD** (dependem de G para o
  cache-on-read do livro): `start-reading.service` → `mark-finished.service` →
  `update-progress.service` → `finish-reading-session.service` →
  `edit-reading-session.service` → `delete-reading-session.service` →
  `list-reading-sessions.service`; criar `src/services/reading-sessions/index.ts`.
- **Bloco I — container**: `register-infrastructure.ts` (+ `openLibraryClient`),
  `register-repositories.ts`, `register-services.ts`, `cradle.ts` — uma tarefa cada
  (sequencial, tocam arquivos compartilhados).
- **Bloco J — borda HTTP** (`[P]` os controllers entre si; routes por último de cada
  domínio): controllers de `books/` → `books.routes.ts` (`preHandler: app.authenticate` em
  todas); controllers de `reading-sessions/` → `reading-sessions.routes.ts` (idem).
- **Bloco K — composição**: `src/app.ts` (registra os 2 plugins de rota com
  `{ prefix: '/v1' }`); `tests/integration/http/books.routes.spec.ts` e
  `reading-sessions.routes.spec.ts` cobrindo os 15 cenários de aceitação via `app.inject()`
  (incl. `200` vs `201` em `start-reading`, `404` de session de outro usuário, `409`/`422`).
- **Bloco L — docs e fechamento**: `README.md` (seção Books); checagens estruturais
  (`grep` de `export default`, `mongodb` fora de camada, `fetch` fora de `integrations/`);
  executar `quickstart.md` e marcar a Definição de Pronto.
- Cada pasta de domínio nova termina com `index.ts` de re-export (dobrado na tarefa que cria
  os arquivos da pasta).

**Estratégia de ordenação**:
- Fundação (A) antes de tudo; utilidades (B) e integração externa (C) e erros (D) antes dos
  repositories/services que os usam.
- Dependência: env/migrations → lib/integrations/erros → schemas → repositories → services
  `books` → services `reading-sessions` → container → controllers/routes → `app.ts`.
- TDD: teste antes da implementação em B, C, F, G, H.
- `[P]` para arquivos independentes (schemas entre si, classes de erro entre si, controllers
  de um mesmo domínio entre si).
- Os testes `*.routes.spec.ts` (K) por último, quando todas as peças existem.

**Estimativa**: ~85 tarefas (ver `tasks.md`).

## Rastreio de Complexidade

*Sem violações da Verificação da Constituição.*

| Item | O que é | Resolução |
|---|---|---|
| `src/integrations/open-library/` e `src/lib/` fora de `architecture.md` | 2 pastas transversais novas | mesma justificativa de `src/auth/`/`src/http/` da 002: utilidades sem estado de domínio; anotado na Estrutura do Projeto |
| `architecture.md` cita `npm`, repositório usa `pnpm` | divergência documental pré-existente (desde a 002) | plano segue o estado real (`pnpm`); recomendado rodar `/architecture` numa próxima passada para corrigir o documento — fora do escopo desta feature |

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — sem `design/`, sem UI)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
- [x] Fase 2: `/tasks` (`tasks.md`) — 97 tarefas geradas e implementadas via `/implement`
