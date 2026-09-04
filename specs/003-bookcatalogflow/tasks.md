# Tarefas: Books Flow — busca, cache e status de leitura

**Entrada**: `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/003-bookcatalogflow/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial (mesmo arquivo ou depende de outra tarefa).

Caminhos seguem a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`,
mais as duas pastas transversais novas (`src/integrations/open-library/`, `src/lib/`)
justificadas no `plan.md`. Cada tarefa que cria arquivos numa pasta de domínio também
cria/atualiza o `index.ts` de re-export dessa pasta (exports nomeados, nunca `export default`).

**Nota sobre índices nos testes de integração**: as migrations (T004–T006) **não** rodam sob
`mongodb-memory-server`. As assertivas que dependem de índice único (books.olid/isbn13,
shelf_memberships.{userId,bookId}, e sobretudo o índice único **parcial** de
reading_sessions que garante "no máximo 1 session `reading` aberta" — RF-009) usam o helper
`ensureBookIndexes` (T030) no `beforeAll`.

**Nota sobre rede**: nenhum teste chama o Open Library real. `HttpOpenLibraryClient` (T027)
tem teste próprio contra um stub HTTP local (T026); todo teste de service que precisaria do
Open Library usa `FakeOpenLibraryClient` (T029, dublê determinístico — não é mock do banco,
é a mesma lógica de porta+adaptador de um repositório).

## Fases (cada uma é um marco entregável)

1. **Fundação** — variáveis de ambiente (com default, nenhuma obrigatória) e migrations das 3 coleções novas. Marco: `pnpm migrate:up` cria `books`/`shelf_memberships`/`reading_sessions` com os índices certos, incl. o único parcial.
2. **Erros tipados e schemas de entrada** — 5 classes de erro que estendem `AppError` + os 7 schemas `zod` dos endpoints. Marco: `pnpm lint`/`pnpm build` limpos; qualquer `ZodError` já vira `400 VALIDATION_ERROR`.
3. **Utilidades transversais** — cursor de paginação puro (`src/lib/pagination.ts`) e o cliente do Open Library (`src/integrations/open-library/`, interface + implementação `fetch`). Marco: unitários verdes; timeout/5xx do Open Library vira `OpenLibraryUnavailableError`; `FakeOpenLibraryClient` pronto para os services.
4. **Camada de dados** — helper de índices para teste + `BookRepository`, `ShelfMembershipRepository`, `ReadingSessionRepository` (interface + impl Mongo) em ordem TDD. Marco: integração verde com `mongodb-memory-server`, incl. `upsertByOlid`, upsert idempotente de `want_to_read`, e o reaproveitamento de session aberta via índice único parcial.
5. **Regras de negócio `books` + fiação parcial do container** — `openLibraryClient` + os 3 repositories no Awilix, e os 5 services de `src/services/books/` em ordem TDD (busca, detalhe/cache-on-read, want_to_read). Marco: cobertura de `src/services/books/**` ≥ 70%.
6. **Regras de negócio `reading-sessions` + fiação final do container** — os 7 services de `src/services/reading-sessions/` em ordem TDD e o registro dos 12 services no Awilix. Marco: cobertura de `src/services/reading-sessions/**` ≥ 70%; no máximo 1 session `reading` aberta por livro/usuário garantido ponta a ponta.
7. **Borda HTTP** — os 12 controllers, os 2 plugins de rota (`books`, `reading-sessions`) e `app.ts` sob `{ prefix: '/v1' }`. Marco: `app.inject()` cobre os 15 cenários de aceitação da spec, incl. `200` vs `201` em `start-reading`, `404` de session de outro usuário, `409`/`422`.
8. **Documentação e fechamento** — README, checagens estruturais e execução do `quickstart.md`. Marco: Definição de Pronto toda verificável.

---

## Fase 1: Fundação

- [x] T001 [P] Acrescentar ao `.env.example` o bloco `# books (003-bookcatalogflow)` com `OPEN_LIBRARY_BASE_URL=https://openlibrary.org` e `OPEN_LIBRARY_TIMEOUT_MS=5000` (ver `contracts/env.contract.md`). Arquivo: `.env.example`
- [x] T002 Estender o teste unitário do carregador de config (TDD — antes de T003): `OPEN_LIBRARY_BASE_URL` ausente → default `https://openlibrary.org`; `OPEN_LIBRARY_BASE_URL` inválida (não-URL) → inválido; `OPEN_LIBRARY_TIMEOUT_MS` ausente → default `5000`; valor não numérico ou `< 100` → inválido. Arquivo: `tests/unit/config/load-config.spec.ts`
- [x] T003 Estender o schema `zod` de ambiente conforme `contracts/env.contract.md`: `OPEN_LIBRARY_BASE_URL` (`z.string().url().default('https://openlibrary.org')`), `OPEN_LIBRARY_TIMEOUT_MS` (`z.coerce.number().int().min(100).default(5000)`); no `transform`, mapear para `openLibraryBaseUrl`, `openLibraryTimeoutMs`. Arquivo: `src/config/env.schema.ts` (faz T002 passar)
- [x] T004 [P] Gerar via `pnpm migrate:create -- create-books-collection` e preencher: `up` cria a coleção `books`, `createIndex({ olid: 1 }, { unique: true })` e `createIndex({ isbn13: 1 }, { unique: true, sparse: true })`; `down` faz `db.collection('books').drop()`. Arquivo: `migrations/<timestamp>-create-books-collection.js`
- [x] T005 [P] Gerar via `pnpm migrate:create -- create-shelf-memberships-collection` e preencher: `up` cria `shelf_memberships` e `createIndex({ userId: 1, bookId: 1 }, { unique: true })`; `down` dropa a coleção. Arquivo: `migrations/<timestamp>-create-shelf-memberships-collection.js`
- [x] T006 [P] Gerar via `pnpm migrate:create -- create-reading-sessions-collection` e preencher: `up` cria `reading_sessions`, `createIndex({ userId: 1, bookId: 1 }, { unique: true, partialFilterExpression: { status: 'reading' } })` (D5, RF-009), `createIndex({ userId: 1, createdAt: -1 })` (histórico paginado) e `createIndex({ userId: 1, bookId: 1 })` (filtro por livro); `down` dropa a coleção. Arquivo: `migrations/<timestamp>-create-reading-sessions-collection.js`

## Fase 2: Erros tipados e schemas de entrada

- [x] T007 [P] Criar `BookNotFoundError extends AppError` (`code: 'BOOK_NOT_FOUND'`, `statusCode: 404`). Arquivo: `src/errors/book-not-found-error.ts`
- [x] T008 [P] Criar `OpenLibraryUnavailableError extends AppError` (`code: 'OPEN_LIBRARY_UNAVAILABLE'`, `statusCode: 503`). Arquivo: `src/errors/open-library-unavailable-error.ts`
- [x] T009 [P] Criar `ReadingSessionNotFoundError extends AppError` (`code: 'READING_SESSION_NOT_FOUND'`, `statusCode: 404`; usada tanto para `sessionId` inexistente quanto de outro usuário — D9). Arquivo: `src/errors/reading-session-not-found-error.ts`
- [x] T010 [P] Criar `InvalidReadingSessionStateError extends AppError` (`code: 'INVALID_READING_SESSION_STATE'`, `statusCode: 409`). Arquivo: `src/errors/invalid-reading-session-state-error.ts`
- [x] T011 [P] Criar `InvalidReadingSessionDatesError extends AppError` (`code: 'INVALID_READING_SESSION_DATES'`, `statusCode: 422`). Arquivo: `src/errors/invalid-reading-session-dates-error.ts`
- [x] T012 Atualizar o barrel de erros reexportando as 5 classes novas junto das existentes. Arquivo: `src/errors/index.ts` (depende de T007–T011)
- [x] T013 [P] Schema `zod` de `searchBooks` (querystring) + teste unitário (TDD): `q` (`min 1`, `max 200`), `page` (int `>= 1`, default `1`), `limit` (int `1..50`, default `20`). Arquivos: `src/schemas/books/search-books.schema.ts`, `tests/unit/schemas/books/search-books.schema.spec.ts`
- [x] T014 [P] Schema `zod` de `listWantToRead` (querystring) + teste unitário (TDD): `cursor` opcional (string), `limit` (int `1..100`, default `20`). Arquivos: `src/schemas/books/list-want-to-read.schema.ts`, `tests/unit/schemas/books/list-want-to-read.schema.spec.ts`
- [x] T015 [P] Schema `zod` de `markFinished` (body) + teste unitário (TDD): `startedAt` opcional (`datetime`), `finishedAt` obrigatório (`datetime`). Arquivos: `src/schemas/books/mark-finished.schema.ts`, `tests/unit/schemas/books/mark-finished.schema.spec.ts`
- [x] T016 Criar o barrel `src/schemas/books/index.ts` reexportando os 3 schemas e seus tipos inferidos. Arquivo: `src/schemas/books/index.ts` (depende de T013–T015)
- [x] T017 [P] Schema `zod` de `updateProgress` (body) + teste unitário (TDD): `currentPage` (int `>= 1`, RF-013 — sem limite superior). Arquivos: `src/schemas/reading-sessions/update-progress.schema.ts`, `tests/unit/schemas/reading-sessions/update-progress.schema.spec.ts`
- [x] T018 [P] Schema `zod` de `finishReadingSession` (body) + teste unitário (TDD): `finishedAt` opcional (`datetime`). Arquivos: `src/schemas/reading-sessions/finish-reading-session.schema.ts`, `tests/unit/schemas/reading-sessions/finish-reading-session.schema.spec.ts`
- [x] T019 [P] Schema `zod` de `editReadingSession` (body) + teste unitário (TDD): `startedAt`/`finishedAt` (`datetime`, opcionais) e `currentPage` (int `>= 1`, opcional); `.refine` exigindo ao menos 1 campo presente. Arquivos: `src/schemas/reading-sessions/edit-reading-session.schema.ts`, `tests/unit/schemas/reading-sessions/edit-reading-session.schema.spec.ts`
- [x] T020 [P] Schema `zod` de `listReadingSessions` (querystring) + teste unitário (TDD): `bookId` opcional (string), `cursor` opcional (string), `limit` (int `1..100`, default `20`). Arquivos: `src/schemas/reading-sessions/list-reading-sessions.schema.ts`, `tests/unit/schemas/reading-sessions/list-reading-sessions.schema.spec.ts`
- [x] T021 Criar o barrel `src/schemas/reading-sessions/index.ts` reexportando os 4 schemas e seus tipos inferidos. Arquivo: `src/schemas/reading-sessions/index.ts` (depende de T017–T020)

## Fase 3: Utilidades transversais (cursor + cliente Open Library)

- [x] T022 [P] Teste unitário de `pagination` (TDD): `encodeCursor`→`decodeCursor` é round-trip; cursor malformado (base64 inválido ou JSON sem `createdAt`/`id`) lança. Arquivo: `tests/unit/lib/pagination.spec.ts`
- [x] T023 Criar `encodeCursor(payload)`/`decodeCursor(cursor)` (`base64url` de `JSON.stringify`) conforme `contracts/internal-ports.md`. Arquivo: `src/lib/pagination.ts` (faz T022 passar)
- [x] T024 Criar o barrel `src/lib/index.ts` reexportando `encodeCursor`, `decodeCursor`, `CursorPayload`. Arquivo: `src/lib/index.ts` (depende de T023)
- [x] T025 Criar a interface `OpenLibraryClient` e os tipos `OpenLibrarySearchResult`, `OpenLibrarySearchPage` conforme `contracts/internal-ports.md`. Arquivo: `src/integrations/open-library/open-library-client.ts`
- [x] T026 [P] Teste unitário de `HttpOpenLibraryClient` (TDD) contra um stub HTTP local (`node:http`, sem rede real): `search` mapeia `docs[]` do Open Library para `OpenLibrarySearchResult[]` (título, `author_name`→`authors`, `cover_i`→`coverUrl` calculada, `first_publish_year`, `isbn[0]`→`isbn13`, `key`→`olid` sem o prefixo `/works/`); `numFound: 0` → lista vazia (não é erro); `findByKey` com `numFound: 0` → `null`; timeout (`OPEN_LIBRARY_TIMEOUT_MS` curto no teste) → `OpenLibraryUnavailableError`; resposta `5xx` → `OpenLibraryUnavailableError`. Arquivo: `tests/unit/integrations/open-library/http-open-library-client.spec.ts` (depende de T025, T008)
- [x] T027 Criar `HttpOpenLibraryClient implements OpenLibraryClient` recebendo `{ baseUrl, timeoutMs }`: `search` chama `GET {baseUrl}/search.json?q=<query>&page=<page>&limit=<limit>`; `findByKey` chama `GET {baseUrl}/search.json?q=key:/works/<olid>&limit=1`; `fetch` + `AbortController(timeoutMs)`; erro de rede/abort/`5xx` → `OpenLibraryUnavailableError` (nunca propaga exceção crua). Arquivo: `src/integrations/open-library/http-open-library-client.ts` (depende de T025, T008; faz T026 passar)
- [x] T028 Criar o barrel `src/integrations/open-library/index.ts` reexportando a interface, os tipos e `HttpOpenLibraryClient`. Arquivo: `src/integrations/open-library/index.ts` (depende de T025, T027)
- [x] T029 Criar `FakeOpenLibraryClient implements OpenLibraryClient` — dublê determinístico em memória (seed de resultados fixos por `query`/`olid`; um modo que lança `OpenLibraryUnavailableError` sob demanda) para os testes de integração dos services (D8). Sem teste próprio — é fixture. Arquivo: `tests/integration/helpers/fake-open-library-client.ts` (depende de T025)

## Fase 4: Camada de dados (TDD)

- [x] T030 Criar `ensureBookIndexes(db: Db): Promise<void>` que aplica, sobre um `Db` em memória, os mesmos índices das migrations T004–T006 (`books.olid`/`books.isbn13` únicos, `shelf_memberships.{userId,bookId}` único, `reading_sessions.{userId,bookId}` único parcial `status:'reading'` + os 2 índices de listagem). Arquivo: `tests/integration/helpers/book-indexes.ts` (depende de T004–T006)
- [x] T031 [P] Teste de integração de `MongoBookRepository` (TDD, `mongodb-memory-server` + `ensureBookIndexes` no `beforeAll`): `upsertByOlid` cria na primeira chamada e atualiza (não duplica) numa segunda chamada com o mesmo `olid`; `findByOlid`/`findById` acham e retornam `null` quando não há; dois `olid` distintos com o mesmo `isbn13` → segunda `upsertByOlid` viola o índice único de `isbn13` (comportamento documentado, não precisa de erro amigável — caso extremo do Open Library, cai como erro genérico de infra). Arquivo: `tests/integration/repositories/books/mongo-book.repository.spec.ts` (depende de T030)
- [x] T032 Criar a interface `BookRepository` e os tipos `BookRecord`, `UpsertBookInput` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/books/book.repository.ts`
- [x] T033 Criar `MongoBookRepository implements BookRepository` recebendo `db: Db`: mapeia `_id` ↔ `id` (hex); `upsertByOlid` = `updateOne({ olid }, { $set, $setOnInsert: { createdAt: now } }, { upsert: true })` seguido de `findOne` para devolver o `BookRecord` atual. Arquivo: `src/repositories/books/mongo-book.repository.ts` (depende de T032; faz T031 passar)
- [x] T034 Criar o barrel `src/repositories/books/index.ts` reexportando a interface, os tipos e `MongoBookRepository`. Arquivo: `src/repositories/books/index.ts` (depende de T032, T033)
- [x] T035 [P] Teste de integração de `MongoShelfMembershipRepository` (TDD, com `ensureBookIndexes` no `beforeAll`): `add` cria; `add` de novo pro mesmo par → sem duplicar (idempotente, D6); `remove` apaga; `remove` de novo → sem erro (idempotente); `list` pagina por cursor (`createdAt` desc) e devolve `nextCursor: null` na última página. Arquivo: `tests/integration/repositories/shelf-memberships/mongo-shelf-membership.repository.spec.ts` (depende de T030, T024)
- [x] T036 Criar a interface `ShelfMembershipRepository` e os tipos `ShelfMembershipRecord`, `CursorPage<T>` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/shelf-memberships/shelf-membership.repository.ts`
- [x] T037 Criar `MongoShelfMembershipRepository implements ShelfMembershipRepository` recebendo `db: Db`: `add` = `updateOne(filter, { $setOnInsert }, { upsert: true })`; `remove` = `deleteOne` (idempotente); `list` usa `encodeCursor`/`decodeCursor` de `src/lib`. Arquivo: `src/repositories/shelf-memberships/mongo-shelf-membership.repository.ts` (depende de T036, T024; faz T035 passar)
- [x] T038 Criar o barrel `src/repositories/shelf-memberships/index.ts` reexportando a interface, os tipos e `MongoShelfMembershipRepository`. Arquivo: `src/repositories/shelf-memberships/index.ts` (depende de T036, T037)
- [x] T039 [P] Teste de integração de `MongoReadingSessionRepository` (TDD, com `ensureBookIndexes` no `beforeAll` — o mais sensível da feature): `startReading` cria a primeira session `reading`; chamar de novo pro mesmo `userId`+`bookId` → **não** lança, devolve a mesma session existente (RF-009, D5); `createFinished` sempre cria uma nova, mesmo já havendo uma `finished` anterior do mesmo livro (RF-016); `updateProgress` numa `finished` → `InvalidReadingSessionStateError`; `finish` muda status e é idempotente se já `finished`; `edit` com `finishedAt < startedAt` resultante → `InvalidReadingSessionDatesError`; `delete` remove; `listByUser` pagina por cursor e filtra por `bookId`; `countDistinctFinishedReaders` conta `userId` distintos com session `finished` daquele livro. Arquivo: `tests/integration/repositories/reading-sessions/mongo-reading-session.repository.spec.ts` (depende de T030, T024, T010, T011)
- [x] T040 Criar a interface `ReadingSessionRepository` e os tipos `ReadingSessionRecord`, `EditReadingSessionInput` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/reading-sessions/reading-session.repository.ts`
- [x] T041 Criar `MongoReadingSessionRepository implements ReadingSessionRepository` recebendo `db: Db`: `startReading` tenta `insertOne`; captura `code 11000` do índice único parcial e busca+retorna a session `reading` existente em vez de propagar; `updateProgress`/`finish`/`edit` lançam os erros de domínio correspondentes (T010, T011) antes de escrever; `listByUser`/`countDistinctFinishedReaders` usam `src/lib` para o cursor. Arquivo: `src/repositories/reading-sessions/mongo-reading-session.repository.ts` (depende de T040, T024, T010, T011; faz T039 passar)
- [x] T042 Criar o barrel `src/repositories/reading-sessions/index.ts` reexportando a interface, os tipos e `MongoReadingSessionRepository`. Arquivo: `src/repositories/reading-sessions/index.ts` (depende de T040, T041)

## Fase 5: Regras de negócio `books` + fiação parcial do container

- [x] T043 Registrar `openLibraryClient` (`asFunction((c) => new HttpOpenLibraryClient({ baseUrl: c.config.openLibraryBaseUrl, timeoutMs: c.config.openLibraryTimeoutMs }))`, singleton) no registro de infraestrutura do Awilix. Arquivo: `src/container/register-infrastructure.ts` (depende de T027, T003)
- [x] T044 Registrar `bookRepository`, `shelfMembershipRepository`, `readingSessionRepository` (`asFunction` a partir de `cradle.db`, singleton) no registro de repositories. Arquivo: `src/container/register-repositories.ts` (depende de T033, T037, T041)
- [x] T045 Estender `AppCradle` com `bookRepository`, `shelfMembershipRepository`, `readingSessionRepository`, `openLibraryClient`. Arquivo: `src/container/cradle.ts` (depende de T032, T036, T040, T025)
- [x] T046 Criar os DTOs de resposta do domínio `books` (`BookSearchResultDTO`, `BookDetailDTO`, `BookCursorPageDTO`) conforme `data-model.md`. Arquivo: `src/services/books/types.ts`
- [x] T047 [P] Teste de integração de `get-book.service` (TDD, `mongodb-memory-server` + `FakeOpenLibraryClient`): `olid` já cacheado → devolve do cache, **sem** chamar o client; `olid` não cacheado + client acha → cacheia (`upsertByOlid`) e devolve; `olid` não cacheado + client devolve `null` → `BookNotFoundError`; client lançando `OpenLibraryUnavailableError` → propaga; `aggregates.readerCount` reflete `countDistinctFinishedReaders`, `averageRating: null`, `reviewCount: 0`. Arquivo: `tests/integration/services/books/get-book.service.spec.ts` (depende de T033, T029, T007, T008)
- [x] T048 Criar `makeGetBook({ bookRepository, openLibraryClient, readingSessionRepository }): GetBook` conforme `contracts/internal-ports.md`. Arquivo: `src/services/books/get-book.service.ts` (depende de T032, T025, T040, T046; faz T047 passar)
- [x] T049 [P] Teste de integração de `search-books.service` (TDD): delega a `openLibraryClient.search` e devolve `BookSearchPageDTO`; falha do client → `OpenLibraryUnavailableError` propaga. Arquivo: `tests/integration/services/books/search-books.service.spec.ts` (depende de T029, T008)
- [x] T050 Criar `makeSearchBooks({ openLibraryClient }): SearchBooks`. Arquivo: `src/services/books/search-books.service.ts` (depende de T025, T046; faz T049 passar)
- [x] T051 [P] Teste de integração de `mark-want-to-read.service` (TDD): livro já cacheado → só cria a membership; livro não cacheado → cacheia primeiro (mesma lógica de `get-book`) e cria a membership; marcar 2x → idempotente (D6). Arquivo: `tests/integration/services/books/mark-want-to-read.service.spec.ts` (depende de T033, T037, T029)
- [x] T052 Criar `makeMarkWantToRead({ bookRepository, openLibraryClient, shelfMembershipRepository }): MarkWantToRead`. Arquivo: `src/services/books/mark-want-to-read.service.ts` (depende de T032, T036, T025; faz T051 passar)
- [x] T053 [P] Teste de integração de `unmark-want-to-read.service` (TDD): membership existente → remove; livro nunca cacheado → resolve sem erro e **sem** chamar `openLibraryClient` (RF-006, D3). Arquivo: `tests/integration/services/books/unmark-want-to-read.service.spec.ts` (depende de T033, T037)
- [x] T054 Criar `makeUnmarkWantToRead({ bookRepository, shelfMembershipRepository }): UnmarkWantToRead` — **não** recebe `openLibraryClient` (não deve chamá-lo). Arquivo: `src/services/books/unmark-want-to-read.service.ts` (depende de T032, T036; faz T053 passar)
- [x] T055 [P] Teste de integração de `list-want-to-read.service` (TDD): lista paginada com `nextCursor`; cada item traz os dados do `Book` resolvido (não só o `bookId`). Arquivo: `tests/integration/services/books/list-want-to-read.service.spec.ts` (depende de T037, T033)
- [x] T056 Criar `makeListWantToRead({ shelfMembershipRepository, bookRepository }): ListWantToRead`. Arquivo: `src/services/books/list-want-to-read.service.ts` (depende de T036, T032, T046; faz T055 passar)
- [x] T057 Criar o barrel `src/services/books/index.ts` reexportando os 5 `makeXxx`, os tipos de função e os DTOs de `types.ts`. Arquivo: `src/services/books/index.ts` (depende de T048, T050, T052, T054, T056)

## Fase 6: Regras de negócio `reading-sessions` + fiação final do container

- [x] T058 Criar os DTOs de resposta do domínio `reading-sessions` (`ReadingSessionDTO`, `ReadingSessionCursorPageDTO`) conforme `data-model.md`. Arquivo: `src/services/reading-sessions/types.ts`
- [x] T059 [P] Teste de integração de `start-reading.service` (TDD): livro cacheado + sem session aberta → cria `reading` (`created: true`); chamar de novo → reaproveita a mesma (`created: false`, RF-009); `want_to_read` prévio some após iniciar (RF-010); livro não cacheado → cacheia primeiro. Arquivo: `tests/integration/services/reading-sessions/start-reading.service.spec.ts` (depende de T041, T037, T033, T029)
- [x] T060 Criar `makeStartReading({ bookRepository, openLibraryClient, readingSessionRepository, shelfMembershipRepository, clock }): StartReading`. Arquivo: `src/services/reading-sessions/start-reading.service.ts` (depende de T032, T025, T040, T036, T058; faz T059 passar)
- [x] T061 [P] Teste de integração de `mark-finished.service` (TDD): cria session `finished` direta, `startedAt` opcional (RF-014); chamar de novo pro mesmo livro cria **outra** session, independente (RF-016, releitura); `want_to_read` prévio some (RF-010). Arquivo: `tests/integration/services/reading-sessions/mark-finished.service.spec.ts` (depende de T041, T037, T033, T029)
- [x] T062 Criar `makeMarkFinished({ bookRepository, openLibraryClient, readingSessionRepository, shelfMembershipRepository }): MarkFinished`. Arquivo: `src/services/reading-sessions/mark-finished.service.ts` (depende de T032, T025, T040, T036, T058; faz T061 passar)
- [x] T063 [P] Teste de integração de `update-progress.service` (TDD): session `reading` do dono → atualiza `currentPage`; session `finished` → `InvalidReadingSessionStateError`; session de outro usuário → `ReadingSessionNotFoundError` (D9). Arquivo: `tests/integration/services/reading-sessions/update-progress.service.spec.ts` (depende de T041, T010, T009)
- [x] T064 Criar `makeUpdateProgress({ readingSessionRepository }): UpdateProgress` — checa posse (D9) antes de delegar ao repositório. Arquivo: `src/services/reading-sessions/update-progress.service.ts` (depende de T040, T058; faz T063 passar)
- [x] T065 [P] Teste de integração de `finish-reading-session.service` (TDD): session `reading` do dono → `finished` + `finishedAt`; chamar de novo (já `finished`) → idempotente, atualiza `finishedAt`; session de outro usuário → `ReadingSessionNotFoundError`. Arquivo: `tests/integration/services/reading-sessions/finish-reading-session.service.spec.ts` (depende de T041, T009)
- [x] T066 Criar `makeFinishReadingSession({ readingSessionRepository, clock }): FinishReadingSession` — checa posse; `finishedAt ?? clock.now()`. Arquivo: `src/services/reading-sessions/finish-reading-session.service.ts` (depende de T040, T058; faz T065 passar)
- [x] T067 [P] Teste de integração de `edit-reading-session.service` (TDD): edição válida do dono → atualiza; `finishedAt < startedAt` resultante → `InvalidReadingSessionDatesError`; session de outro usuário → `ReadingSessionNotFoundError`. Arquivo: `tests/integration/services/reading-sessions/edit-reading-session.service.spec.ts` (depende de T041, T011, T009)
- [x] T068 Criar `makeEditReadingSession({ readingSessionRepository }): EditReadingSession` — checa posse antes de delegar. Arquivo: `src/services/reading-sessions/edit-reading-session.service.ts` (depende de T040, T058; faz T067 passar)
- [x] T069 [P] Teste de integração de `delete-reading-session.service` (TDD): apaga a do dono; session de outro usuário → `ReadingSessionNotFoundError` (não apaga). Arquivo: `tests/integration/services/reading-sessions/delete-reading-session.service.spec.ts` (depende de T041, T009)
- [x] T070 Criar `makeDeleteReadingSession({ readingSessionRepository }): DeleteReadingSession` — checa posse antes de delegar. Arquivo: `src/services/reading-sessions/delete-reading-session.service.ts` (depende de T040, T058; faz T069 passar)
- [x] T071 [P] Teste de integração de `list-reading-sessions.service` (TDD): pagina por cursor; filtro opcional por `bookId`; inclui sessions de todos os status, incl. releituras do mesmo livro. Arquivo: `tests/integration/services/reading-sessions/list-reading-sessions.service.spec.ts` (depende de T041)
- [x] T072 Criar `makeListReadingSessions({ readingSessionRepository }): ListReadingSessions`. Arquivo: `src/services/reading-sessions/list-reading-sessions.service.ts` (depende de T040, T058; faz T071 passar)
- [x] T073 Criar o barrel `src/services/reading-sessions/index.ts` reexportando os 7 `makeXxx`, os tipos de função e os DTOs de `types.ts`. Arquivo: `src/services/reading-sessions/index.ts` (depende de T060, T062, T064, T066, T068, T070, T072)
- [x] T074 Registrar os 12 services (`searchBooksService`, `getBookService`, `markWantToReadService`, `unmarkWantToReadService`, `listWantToReadService`, `startReadingService`, `markFinishedService`, `updateProgressService`, `finishReadingSessionService`, `editReadingSessionService`, `deleteReadingSessionService`, `listReadingSessionsService`) no registro de services. Arquivo: `src/container/register-services.ts` (depende de T057, T073)
- [x] T075 Estender `AppCradle` com os 12 tipos de service. Arquivo: `src/container/cradle.ts` (depende de T057, T073; sequencial com T045 — mesmo arquivo)

## Fase 7: Borda HTTP

- [x] T076 [P] Criar `search-books.controller.ts`: valida a querystring com `searchBooksSchema`, resolve `searchBooksService`, responde `200`. Arquivo: `src/controllers/books/search-books.controller.ts` (depende de T013, T050)
- [x] T077 [P] Criar `get-book.controller.ts`: valida o param `olid`, resolve `getBookService`, responde `200`. Arquivo: `src/controllers/books/get-book.controller.ts` (depende de T048)
- [x] T078 [P] Criar `mark-want-to-read.controller.ts`: usa `request.currentUser.id` + param `olid`, resolve `markWantToReadService`, responde `204`. Arquivo: `src/controllers/books/mark-want-to-read.controller.ts` (depende de T052)
- [x] T079 [P] Criar `unmark-want-to-read.controller.ts`: idem, resolve `unmarkWantToReadService`, responde `204`. Arquivo: `src/controllers/books/unmark-want-to-read.controller.ts` (depende de T054)
- [x] T080 [P] Criar `start-reading.controller.ts`: resolve `startReadingService`, responde `201` se `created`, senão `200`, corpo = a session. Arquivo: `src/controllers/books/start-reading.controller.ts` (depende de T060)
- [x] T081 [P] Criar `mark-finished.controller.ts`: valida o corpo com `markFinishedSchema`, resolve `markFinishedService`, responde `201`. Arquivo: `src/controllers/books/mark-finished.controller.ts` (depende de T015, T062)
- [x] T082 [P] Criar `list-want-to-read.controller.ts`: valida a querystring com `listWantToReadSchema`, resolve `listWantToReadService`, responde `200`. Arquivo: `src/controllers/books/list-want-to-read.controller.ts` (depende de T014, T056)
- [x] T083 Criar o barrel `src/controllers/books/index.ts` reexportando `booksRoutes` e os 7 controllers. Arquivo: `src/controllers/books/index.ts` (depende de T076–T082, T084)
- [x] T084 Criar o plugin de rotas do domínio `books`: `GET /books/search`, `GET /books/:olid`, `PUT`/`DELETE /books/:olid/want-to-read`, `POST /books/:olid/start-reading`, `POST /books/:olid/mark-finished`, `GET /me/want-to-read` — todas com `preHandler: app.authenticate` (RF-020). Arquivo: `src/controllers/books/books.routes.ts` (depende de T076–T082)
- [x] T085 [P] Criar `update-progress.controller.ts`: valida o corpo com `updateProgressSchema`, usa `request.currentUser.id` + param `sessionId`, resolve `updateProgressService`, responde `200`. Arquivo: `src/controllers/reading-sessions/update-progress.controller.ts` (depende de T017, T064)
- [x] T086 [P] Criar `finish-reading-session.controller.ts`: valida o corpo com `finishReadingSessionSchema`, resolve `finishReadingSessionService`, responde `200`. Arquivo: `src/controllers/reading-sessions/finish-reading-session.controller.ts` (depende de T018, T066)
- [x] T087 [P] Criar `edit-reading-session.controller.ts`: valida o corpo com `editReadingSessionSchema`, resolve `editReadingSessionService`, responde `200`. Arquivo: `src/controllers/reading-sessions/edit-reading-session.controller.ts` (depende de T019, T068)
- [x] T088 [P] Criar `delete-reading-session.controller.ts`: resolve `deleteReadingSessionService`, responde `204`. Arquivo: `src/controllers/reading-sessions/delete-reading-session.controller.ts` (depende de T070)
- [x] T089 [P] Criar `list-reading-sessions.controller.ts`: valida a querystring com `listReadingSessionsSchema`, resolve `listReadingSessionsService`, responde `200`. Arquivo: `src/controllers/reading-sessions/list-reading-sessions.controller.ts` (depende de T020, T072)
- [x] T090 Criar o barrel `src/controllers/reading-sessions/index.ts` reexportando `readingSessionsRoutes` e os 5 controllers. Arquivo: `src/controllers/reading-sessions/index.ts` (depende de T085–T089, T091)
- [x] T091 Criar o plugin de rotas do domínio `reading-sessions`: `POST /reading-sessions/:sessionId/progress`, `POST /reading-sessions/:sessionId/finish`, `PATCH`/`DELETE /reading-sessions/:sessionId`, `GET /me/reading-sessions` — todas com `preHandler: app.authenticate`. Arquivo: `src/controllers/reading-sessions/reading-sessions.routes.ts` (depende de T085–T089)
- [x] T092 [P] Teste de integração de rotas via `buildApp` + `app.inject()` (TDD — escrito antes de T094, que faz a fiação e o torna verde) cobrindo os cenários de aceitação 1–7 e 15 da spec: busca (`200`/`400`/`401`/`503`); detalhe (`200` cache-on-read/`404`/`503`); `want_to_read` (`204` idempotente nas duas direções, `200` na listagem, some após `start-reading`). Arquivo: `tests/integration/http/books.routes.spec.ts` (depende de T084)
- [x] T093 [P] Teste de integração de rotas via `app.inject()` cobrindo os cenários 6–14: `start-reading` `201`/`200` (reaproveita); progresso `200`/`409`; `mark-finished` `201` + releitura; `finish` `200` idempotente; editar `200`/`422`; apagar `204` + `404` depois; `sessionId` de outro usuário em qualquer operação → `404` (nunca `403`); histórico paginado com `bookId`. Arquivo: `tests/integration/http/reading-sessions.routes.spec.ts` (depende de T091)
- [x] T094 Atualizar `buildApp`: registrar `booksRoutes` e `readingSessionsRoutes` com `{ prefix: '/v1' }`. Arquivo: `src/app.ts` (depende de T083, T090; faz T092/T093 passar)

## Fase 8: Documentação e fechamento

- [x] T095 [P] Acrescentar ao `README.md` a seção **Books**: os 11 endpoints com corpo e respostas de sucesso/erro, a tabela de códigos de erro novos (de `contracts/error-codes.md`), as 2 variáveis de ambiente novas e o passo `pnpm migrate:up`. Arquivo: `README.md`
- [x] T096 Rodar `pnpm lint`, `pnpm test` (unit + integration), `pnpm test:coverage` e `pnpm build`; conferir `grep -rn "export default" src` vazio, `grep -rn "from 'mongodb'" src/services src/controllers src/integrations src/lib` vazio, `grep -rn "fetch(" src/services src/controllers src/repositories` vazio (só `src/integrations/open-library` chama `fetch`), e um `index.ts` em cada pasta de domínio nova; sanar o que falhar. Sem arquivo fixo (ajustes pontuais onde o comando apontar). (depende de T001–T094)
- [x] T097 Executar `specs/003-bookcatalogflow/quickstart.md` de ponta a ponta (Docker + `pnpm migrate:up`) e marcar cada item da "Definição de Pronto" no `spec.md`. Arquivo: `specs/003-bookcatalogflow/spec.md` (depende de T096)

---

## Dependências

- **Fase 1 → todas**: `env.schema` (T003) alimenta `register-infrastructure.ts`; as migrations (T004–T006) definem os índices que o helper de teste (T030) replica e que o `quickstart` aplica.
- **Fase 2 → Fases 3–7**: as 5 classes de erro (T007–T011) são usadas pelo cliente Open Library, pelos repositories e pelos services; os 7 schemas (T013–T020) são usados pelos controllers.
- **Fase 3 → Fases 4–6**: `src/lib/pagination.ts` (paginação) é usado pelos repositories de `shelf-memberships`/`reading-sessions`; `OpenLibraryClient`/`HttpOpenLibraryClient`/`FakeOpenLibraryClient` sustentam os repositories/services que resolvem/cacheiam livro.
- **Fase 4 → Fases 5–6**: os 3 repositories (interface + impl) são injetados nos services; `ensureBookIndexes` (T030) é pré-requisito de todo teste de integração de repositório e do reaproveitamento de session via índice único parcial.
- **Fase 5 → Fase 6**: `get-book.service` (a base do cache-on-read) é o padrão que `start-reading`/`mark-finished` replicam; o container (`register-repositories`, `register-infrastructure`) precisa estar de pé antes dos services de `reading-sessions` também.
- **Fase 6 → Fase 7**: os 12 services sustentam os 12 controllers; `register-services`/`cradle` precisam dos barrels `src/services/books/index.ts` e `src/services/reading-sessions/index.ts`.
- **Fase 7 → Fase 8**: `app.ts` completo (T094) é pré-requisito do `quickstart` e das checagens finais.
- Internas relevantes:
  - T002 (teste) antes de T003; T003 → T043
  - T007–T011 → T012
  - T013–T015 → T016; T017–T020 → T021
  - T022 → T023 → T024
  - T025 → T026 (teste) → T027 → T028; T025 → T029
  - T004–T006 → T030 → T031, T035, T039
  - T032 → T033 (faz T031 passar) → T034
  - T036 + T024 → T037 (faz T035 passar) → T038
  - T040 + T024 + T010 + T011 → T041 (faz T039 passar) → T042
  - T027 + T003 → T043; T033 + T037 + T041 → T044; T032/T036/T040/T025 → T045
  - T046 → T047 (teste) → T048; T046 → T049 (teste) → T050
  - T046 → T051 (teste) → T052; T046 → T053 (teste) → T054; T046 → T055 (teste) → T056
  - T048/T050/T052/T054/T056 → T057
  - T058 → T059 (teste) → T060; T058 → T061 (teste) → T062
  - T058 → T063 (teste) → T064; T058 → T065 (teste) → T066
  - T058 → T067 (teste) → T068; T058 → T069 (teste) → T070; T058 → T071 (teste) → T072
  - T060/T062/T064/T066/T068/T070/T072 → T073
  - T057 + T073 → T074 → T075 (sequencial com T045, mesmo arquivo `cradle.ts`)
  - T013/T050 → T076; T048 → T077; T052 → T078; T054 → T079; T060 → T080; T015/T062 → T081; T014/T056 → T082
  - T076–T082 → T083, T084
  - T017/T064 → T085; T018/T066 → T086; T019/T068 → T087; T070 → T088; T020/T072 → T089
  - T085–T089 → T090, T091
  - T084 → T092 (escrito para falhar; T094 o faz passar); T091 → T093 (idem)
  - T083 + T090 → T094 → T096; T001–T094 → T096 → T097

## Exemplo de execução em paralelo

```
# Fase 1 — arquivos distintos:
T001 .env.example | T004 migration books | T005 migration shelf_memberships | T006 migration reading_sessions
# (T002 → T003 é um par sequencial: teste antes, schema depois)

# Fase 2 — as 5 classes de erro (arquivos distintos, sem dependência entre si):
T007 book-not-found-error.ts | T008 open-library-unavailable-error.ts
T009 reading-session-not-found-error.ts
T010 invalid-reading-session-state-error.ts | T011 invalid-reading-session-dates-error.ts

# Fase 2 — os 7 schemas + specs (pares independentes):
T013 search-books | T014 list-want-to-read | T015 mark-finished
T017 update-progress | T018 finish-reading-session | T019 edit-reading-session | T020 list-reading-sessions

# Fase 4 — os testes de integração dos 3 repositories (arquivos distintos; todos após T030):
T031 mongo-book.repository.spec.ts | T035 mongo-shelf-membership.repository.spec.ts | T039 mongo-reading-session.repository.spec.ts

# Fase 5 — os testes de integração dos 5 services de books (arquivos distintos):
T047 get-book | T049 search-books | T051 mark-want-to-read | T053 unmark-want-to-read | T055 list-want-to-read

# Fase 6 — os testes de integração dos 7 services de reading-sessions (arquivos distintos):
T059 start-reading | T061 mark-finished | T063 update-progress | T065 finish
T067 edit | T069 delete | T071 list

# Fase 7 — os 12 controllers (arquivos distintos):
T076 search-books.controller | T077 get-book.controller | T078 mark-want-to-read.controller
T079 unmark-want-to-read.controller | T080 start-reading.controller | T081 mark-finished.controller
T082 list-want-to-read.controller | T085 update-progress.controller | T086 finish-reading-session.controller
T087 edit-reading-session.controller | T088 delete-reading-session.controller | T089 list-reading-sessions.controller

# Fase 8 — T095 (README) corre em paralelo ao restante; T096/T097 são sequenciais e finais.
```

## Notas

- Ordem TDD: T002→T003, T022→T023, T026→T027, T031→T033, T035→T037, T039→T041, T047→T048,
  T049→T050, T051→T052, T053→T054, T055→T056, T059→T060, T061→T062, T063→T064, T065→T066,
  T067→T068, T069→T070, T071→T072, T092/T093→T094 (o teste é escrito para falhar antes da
  implementação que o satisfaz).
- `src/integrations/open-library/` e `src/lib/` são pastas transversais (utilidades sem
  estado de domínio, sem Fastify), como `src/auth/`/`src/http/` da 002 — ver `plan.md`.
- Nenhum service de `books`/`reading-sessions` importa `mongodb` nem `fetch` diretamente —
  só as implementações Mongo (`repositories/**`) e `HttpOpenLibraryClient`
  (`integrations/open-library/**`), respectivamente.
- `unmark-want-to-read.service` (T054) é a única operação de escrita que **não** recebe
  `openLibraryClient` como dependência — reforça em código a regra de não chamar rede numa
  remoção (D3, RF-006).
- Posse de `ReadingSession` (D9): toda operação de mutação sobre um `sessionId`
  (T064/T066/T068/T070) verifica `session.userId === userId` e usa `ReadingSessionNotFoundError`
  tanto para "não existe" quanto para "é de outro usuário" — nunca `403`.
- Índices nos testes: as migrations não rodam sob `mongodb-memory-server`; os testes que
  dependem de índice único (incl. o parcial de `reading_sessions`) chamam `ensureBookIndexes`
  (T030). O `quickstart` (T097) valida o caminho real com `pnpm migrate:up`.
- Commitar após cada tarefa concluída.
