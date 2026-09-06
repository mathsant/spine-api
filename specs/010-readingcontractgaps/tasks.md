# Tarefas: Lacunas de contrato de leitura/descoberta para o front-end (`010-readingcontractgaps`)

**Entrada**: `plan.md`, `research.md`, `data-model.md`, `contracts/openapi-delta.md`, `contracts/behavior-checklist.md`, `quickstart.md` de `specs/010-readingcontractgaps/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial. Ordem TDD dentro de cada fase: o teste existe e falha antes da implementação que ele cobre. Commitar após cada tarefa (direto na `master` — decisão do usuário nesta feature).

Caminhos seguem a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`. Identificadores e caminhos em inglês.

## Fases (marcos)

| Fase | Marco entregável | Depende de |
|---|---|---|
| **F1 — `pageCount` no catálogo** | `pageCount` (int\|null) presente em toda resposta de livro (`get-book`, `search`, `want-to-read`) e no `BookRecord` | — |
| **F2 — Migration de índices** | 3 índices de apoio criados e reversíveis; helper de teste em sync | — |
| **F3 — `GET /books/{olid}/reviews`** | Endpoint de reviews de um livro por seguidos, ponta a ponta | F2 (índice `reviews_bookId_userId`, `reading_sessions_bookId_status_userId`) |
| **F4 — Histórico: `status` + ordenação + cursor** | `GET /me/reading-sessions` com filtro `status`, ordenação reading→finished, cursor com quebra de formato | F2 (índice `reading_sessions_userId_status_createdAt`) |
| **F5 — `book` embutido no histórico** | Itens de `GET /me/reading-sessions` carregam `book{title,authors,coverUrl,pageCount}` | F1 (pageCount no book DTO), F4 (mesmos arquivos de serviço/DTO) |
| **F6 — `GET /books/popular-among-following`** | Endpoint de descoberta "populares no círculo", top-20 sem paginação | F1 (pageCount em `BookSearchResult`), F2 |
| **F7 — Documentação + fechamento** | `docs/` atualizado, `redocly lint` limpo, quickstart rodado, nomes enviados ao front-end | F1–F6 |

---

## Fase F1 — `pageCount` no catálogo

### Testes primeiro
- [x] **T001** [P] Estender `tests/unit/integrations/open-library/http-open-library-client.spec.ts`: `toResult` mapeia `number_of_pages_median` numérico → `pageCount`, e ausência → `pageCount: null`.
- [x] **T002** [P] Estender `tests/integration/services/books/get-book.service.spec.ts`: resposta inclui `pageCount` (valor vindo do Open Library no cache miss; `null` quando o doc não traz).
- [x] **T003** [P] Estender `tests/integration/services/books/search-books.service.spec.ts`: cada item da página traz `pageCount` (valor e `null`).
- [x] **T004** [P] Estender `tests/integration/services/books/list-want-to-read.service.spec.ts`: cada item traz `pageCount` a partir do book cacheado.

### Implementação
- [x] **T005** [P] `tests/helpers/fake-open-library-client.ts` e `tests/helpers/open-library-stub` fixtures: incluir `number_of_pages_median` / `pageCount` nos docs fake usados pelos testes acima.
- [x] **T006** `src/integrations/open-library/open-library-client.ts`: adicionar `pageCount: number | null` a `OpenLibrarySearchResult`.
- [x] **T007** `src/integrations/open-library/http-open-library-client.ts`: `OpenLibraryDoc.number_of_pages_median?: number`; `toResult` seta `pageCount: doc.number_of_pages_median ?? null`.
- [x] **T008** `src/repositories/books/book.repository.ts`: adicionar `pageCount: number | null` a `BookRecord` e a `UpsertBookInput`.
- [x] **T009** `src/repositories/books/mongo-book.repository.ts`: `BookDocument.pageCount?: number | null`; `toRecord` → `pageCount: doc.pageCount ?? null`; `upsertByOlid` inclui `pageCount: input.pageCount` no `$set`.
- [x] **T010** `src/services/books/types.ts`: adicionar `pageCount: number | null` a `BookSearchResultDTO` (propaga para `BookDetailDTO`, `BookSearchPageDTO`, `BookCursorPageDTO`).
- [x] **T011** [P] `src/services/books/get-book.service.ts`: `toDTO` inclui `pageCount: book.pageCount`.
- [x] **T012** [P] `src/services/books/list-want-to-read.service.ts`: `toResultDTO` recebe e retorna `pageCount`.
- [x] **T013** [P] `src/services/books/search-books.service.ts`: garantir que o retorno de `makeSearchBooks` inclui `pageCount` (passagem tipada do `OpenLibrarySearchResult` para `BookSearchResultDTO`; mapear explicitamente se o compilador exigir).
- [x] **T014** Rodar `pnpm test` das trilhas de books + `pnpm typecheck`; T001–T004 passam.

---

## Fase F2 — Migration de índices

- [x] **T015** Criar migration via `npx migrate-mongo create add-reading-contract-gaps-indexes`; em `migrations/<ts>-add-reading-contract-gaps-indexes.js`, `up` cria: `reading_sessions` `{ userId:1, status:-1, createdAt:-1 }` (`reading_sessions_userId_status_createdAt`), `reading_sessions` `{ bookId:1, status:1, userId:1 }` (`reading_sessions_bookId_status_userId`), `reviews` `{ bookId:1, userId:1 }` (`reviews_bookId_userId`); `down` derruba os três por nome.
- [x] **T016** `tests/helpers/book-indexes.ts`: adicionar `reading_sessions_userId_status_createdAt` e `reading_sessions_bookId_status_userId` ao `ensureBookIndexes` (manter em sync com `migrations/`, conforme o comentário do helper).
- [x] **T017** `tests/helpers/review-indexes.ts`: adicionar `reviews_bookId_userId`.
- [~] **T018** (bloqueada: sem MongoDB local neste ambiente; criação equivalente dos 3 índices verificada via `mongodb-memory-server` nos helpers/testes de repositório) `pnpm migrate:up` num banco local; conferir os 3 índices; `pnpm migrate:down` reverte sem erro; `pnpm migrate:up` de novo.

---

## Fase F3 — `GET /books/{olid}/reviews`

### Testes primeiro
- [x] **T019** [P] `tests/unit/schemas/books/list-book-reviews.schema.spec.ts`: `cursor` opcional (string ≥1), `limit` com default e limites min/max.
- [x] **T020** [P] Estender `tests/integration/repositories/reading-sessions/mongo-reading-session.repository.spec.ts`: `findLatestFinishedPerUserForBook` devolve no máximo 1 registro por `userId` (a session `finished` mais recente), ignora `reading`, `userIds` vazio → `[]` sem tocar o banco.
- [x] **T021** `tests/integration/services/books/list-book-reviews.service.spec.ts`: cenários de aceitação 4–10 da spec (RF-006..012) — inclui seguido com releitura (1 review), review própria ausente, usuário não-seguido/pending ausente (**DoD P6**), `olid` inexistente → `BookNotFoundError`, livro sem reviews de seguidos → página vazia, paginação por cursor sem repetição/omissão.
- [x] **T022** Estender `tests/integration/http/books.routes.spec.ts`: `GET /v1/books/:olid/reviews` → 200 (forma do item: `reviewId`, `author{userId,handle,displayName,avatarUrl:null}`, `rating`, `text`, `containsSpoiler`, `createdAt`), 401 sem token, 404 `BOOK_NOT_FOUND`.

### Implementação
- [x] **T023** `src/schemas/books/list-book-reviews.schema.ts`: `listBookReviewsSchema` (`cursor?`, `limit` default 20, max 50); export em `src/schemas/books/index.ts`.
- [x] **T024** `src/repositories/reading-sessions/reading-session.repository.ts`: assinatura `findLatestFinishedPerUserForBook(bookId: string, userIds: string[]): Promise<ReadingSessionRecord[]>`.
- [x] **T025** `src/repositories/reading-sessions/mongo-reading-session.repository.ts`: implementar com aggregation `$match {bookId,status:'finished',userId:{$in}}` → `$sort {finishedAt:-1,createdAt:-1,_id:-1}` → `$group {_id:'$userId', doc:{$first:'$$ROOT'}}`; `userIds` vazio → `[]`.
- [x] **T026** `src/services/books/types.ts`: `BookReviewByFollowingDTO` (`reviewId`, `author{userId,handle,displayName,avatarUrl}`, `rating`, `text`, `containsSpoiler`, `createdAt`) e `BookReviewByFollowingCursorPageDTO`.
- [x] **T027** `src/services/books/list-book-reviews.service.ts`: `makeListBookReviews({ bookRepository, openLibraryClient, followRepository, readingSessionRepository, reviewRepository, userRepository })` — `resolveBook` (404), `followRepository.listFolloweeIds`, `findLatestFinishedPerUserForBook`, `reviewRepository.findBySessionIds`, descartar sessions sem review, `userRepository.findById` em batch, ordenar por `createdAt` da review desc, aplicar cursor `{createdAt,id}` (`encodeCursor`/`decodeCursor` existentes) e `limit+1`.
- [x] **T028** `src/services/books/index.ts`: re-export de `makeListBookReviews` e tipos.
- [x] **T029** `src/controllers/books/list-book-reviews.controller.ts`: handler — valida query com `listBookReviewsSchema`, exige `currentUser`, resolve `listBookReviewsByFollowingService`, `reply.status(200)`.
- [x] **T030** `src/controllers/books/books.routes.ts`: `app.get('/books/:olid/reviews', { preHandler: app.authenticate }, listBookReviewsController)`; re-export em `src/controllers/books/index.ts` se necessário.
- [x] **T031** `src/container/register-services.ts`: registrar `listBookReviewsByFollowingService` com as 6 deps do cradle.
- [x] **T032** Rodar `pnpm test` das trilhas books/reading-sessions + `pnpm typecheck`; T019–T022 passam.

---

## Fase F4 — Histórico: `status` + ordenação + cursor

### Testes primeiro
- [x] **T033** [P] `tests/unit/lib/reading-session-cursor.spec.ts`: round-trip de `{ status, createdAt, id }`; cursor no formato antigo (`{createdAt,id}` sem `status`) → `ValidationError`; base64url malformado → `ValidationError`.
- [x] **T034** [P] Estender `tests/unit/schemas/reading-sessions/list-reading-sessions.schema.spec.ts`: `status` aceita `reading`/`finished`, rejeita outro valor, ausência é válida.
- [x] **T035** Estender `tests/integration/repositories/reading-sessions/mongo-reading-session.repository.spec.ts`: `listByUser` com `filter.status`; sem filtro, ordena todas as `reading` antes das `finished`, cada grupo `createdAt` desc; keyset paginando através da fronteira reading→finished sem repetição/omissão (dataset com N>limit nos dois grupos); cursor no formato antigo → erro.
- [x] **T036** Estender `tests/integration/services/reading-sessions/list-reading-sessions.service.spec.ts`: RF-021..027 — atualizar asserts de ordenação hoje baseados só em `createdAt`; `status` + `bookId` combinados.
- [x] **T037** Estender `tests/integration/http/reading-sessions.routes.spec.ts`: `GET /v1/me/reading-sessions?status=reading|finished` filtra; `?status=xpto` → 400 `VALIDATION_ERROR`.

### Implementação
- [x] **T038** `src/lib/reading-session-cursor.ts`: `encodeReadingSessionCursor({status,createdAt,id})` / `decodeReadingSessionCursor(string)` (base64url+JSON, valida os 3 campos e `status ∈ {reading,finished}`, senão `ValidationError`); export em `src/lib/index.ts`.
- [x] **T039** `src/schemas/reading-sessions/list-reading-sessions.schema.ts`: adicionar `status: z.enum(['reading', 'finished']).optional()`.
- [x] **T040** `src/repositories/reading-sessions/reading-session.repository.ts`: `listByUser` — `filter` passa a ser `{ bookId?: string; status?: 'reading' | 'finished' }`; atualizar o JSDoc.
- [x] **T041** `src/repositories/reading-sessions/mongo-reading-session.repository.ts`: em `listByUser` — aplicar `query.status` quando presente; `sort({ status: -1, createdAt: -1, _id: -1 })`; decodificar cursor com `decodeReadingSessionCursor`; predicado keyset de 3 chaves (`status` `$lt` → `status` igual + `createdAt` `$lt` → iguais + `_id` `$lt`); `nextCursor` via `encodeReadingSessionCursor` com o `status` do último item. Comentar a dependência da grafia do enum na ordenação.
- [x] **T042** `src/services/reading-sessions/list-reading-sessions.service.ts`: `ListReadingSessionsInput` ganha `status?: 'reading' | 'finished'`; repassar ao `repository.listByUser`.
- [x] **T043** `src/controllers/reading-sessions/list-reading-sessions.controller.ts`: extrair `status` do schema e repassar ao serviço.
- [x] **T044** Rodar `pnpm test` reading-sessions + `pnpm typecheck`; T033–T037 passam.

---

## Fase F5 — `book` embutido no histórico

### Testes primeiro
- [x] **T045** [P] `tests/unit/services/reading-sessions/to-dto.spec.ts`: o mapper do item de listagem produz `book { title, authors, coverUrl, pageCount }`; as respostas não-listagem não têm `book`.
- [x] **T046** Estender `tests/integration/services/reading-sessions/list-reading-sessions.service.spec.ts`: cada item traz `book` resolvido do `bookRepository`; batch-load (nº de chamadas ao `bookRepository.findById` proporcional a livros distintos da página, não a itens — RF-030).
- [x] **T047** Estender `tests/integration/http/reading-sessions.routes.spec.ts`: a listagem traz `book`; `POST /books/:olid/start-reading`, `POST /reading-sessions/:id/progress`, `POST /reading-sessions/:id/finish`, `PATCH /reading-sessions/:id`, `POST /books/:olid/mark-finished` **não** trazem `book` (RF-029).

### Implementação
- [x] **T048** `src/services/reading-sessions/types.ts`: `ReadingSessionBookDTO { title; authors; coverUrl; pageCount }`; `ReadingSessionListItemDTO = ReadingSessionDTO & { book: ReadingSessionBookDTO }` e `ReadingSessionListCursorPageDTO`. Manter `ReadingSessionDTO` sem `book` para as demais respostas.
- [x] **T049** `src/services/reading-sessions/to-dto.ts`: adicionar `toReadingSessionListItemDTO(record, review, book)` (reusa `toReadingSessionDTO` e acopla `book`); não alterar a assinatura de `toReadingSessionDTO`.
- [x] **T050** `src/services/reading-sessions/list-reading-sessions.service.ts`: após obter a página, `bookRepository.findById` em lote pelos `bookId` distintos; mapear cada item com `toReadingSessionListItemDTO`; tipo de retorno `ReadingSessionListCursorPageDTO`.
- [x] **T051** `src/services/reading-sessions/index.ts`: re-export dos tipos novos.
- [x] **T052** Rodar `pnpm test` reading-sessions + `pnpm typecheck`; T045–T047 passam.

---

## Fase F6 — `GET /books/popular-among-following`

### Testes primeiro
- [x] **T053** Estender `tests/integration/repositories/reading-sessions/mongo-reading-session.repository.spec.ts`: `aggregatePopularBookIdsForReaders` — contagem por `userId` distinto, `$nin` de `excludeBookIds`, `$limit`, ordena por `readerCount` desc + `lastActivityAt` desc, `readerIds` vazio → `[]`; `listBookIdsForUser` devolve `distinct('bookId')` do usuário.
- [x] **T054** [P] Estender `tests/integration/repositories/shelf-memberships/mongo-shelf-membership.repository.spec.ts`: `listBookIdsForUser` devolve os `bookId` marcados como want-to-read pelo usuário.
- [x] **T055** `tests/integration/services/books/list-popular-among-following.service.spec.ts`: RF-013..020 — ranking por leitores distintos, empate por atividade recente depois `title`, exclusão de livro que o solicitante já tem session **ou** want-to-read, teto de 20 sem `nextCursor`, sessions de não-seguido não contam (**DoD P6**), sem followees/sem atividade/tudo conhecido → `{ items: [] }`.
- [x] **T056** Estender `tests/integration/http/books.routes.spec.ts`: `GET /v1/books/popular-among-following` → 200 (`{items:[...]}` sem `nextCursor`, itens no formato `BookSearchResult` com `pageCount`), 401 sem token; `GET /v1/books/:olid` continua funcionando (a rota estática não é capturada por `:olid`).

### Implementação
- [x] **T057** `src/repositories/reading-sessions/reading-session.repository.ts`: assinaturas `aggregatePopularBookIdsForReaders(readerIds: string[], excludeBookIds: string[], limit: number): Promise<Array<{ bookId: string; readerCount: number; lastActivityAt: Date }>>` e `listBookIdsForUser(userId: string): Promise<string[]>`.
- [x] **T058** `src/repositories/reading-sessions/mongo-reading-session.repository.ts`: implementar as duas (aggregation `$group` com `$addToSet`/`$size`/`$max`; `distinct`). `readerIds` vazio → `[]` sem tocar o banco.
- [x] **T059** `src/repositories/shelf-memberships/shelf-membership.repository.ts` + `src/repositories/shelf-memberships/mongo-shelf-membership.repository.ts`: `listBookIdsForUser(userId): Promise<string[]>` (`distinct('bookId', { userId })`).
- [x] **T060** `src/services/books/types.ts`: `PopularAmongFollowingResponseDTO { items: BookSearchResultDTO[] }`.
- [x] **T061** `src/services/books/list-popular-among-following.service.ts`: `makeListPopularAmongFollowing({ followRepository, readingSessionRepository, shelfMembershipRepository, bookRepository })` — `listFolloweeIds` (vazio → `{items:[]}`); `excludeBookIds` = união de `readingSessionRepository.listBookIdsForUser(userId)` e `shelfMembershipRepository.listBookIdsForUser(userId)`; `aggregatePopularBookIdsForReaders(followeeIds, excludeBookIds, 20)`; `bookRepository.findById` em lote; desempate final por `title` asc; mapear para `BookSearchResultDTO` (com `pageCount`).
- [x] **T062** `src/services/books/index.ts`: re-export.
- [x] **T063** `src/controllers/books/list-popular-among-following.controller.ts`: handler — exige `currentUser`, resolve `listPopularAmongFollowingService`, `reply.status(200)`.
- [x] **T064** `src/controllers/books/books.routes.ts`: registrar `app.get('/books/popular-among-following', { preHandler: app.authenticate }, listPopularAmongFollowingController)` **antes** de `app.get('/books/:olid', ...)`; re-export no index se necessário.
- [x] **T065** `src/container/register-services.ts`: registrar `listPopularAmongFollowingService` com as 4 deps.
- [x] **T066** Rodar `pnpm test` books + `pnpm typecheck`; T053–T056 passam.

---

## Fase F7 — Documentação + fechamento

- [x] **T067** [P] `docs/openapi.yaml`: aplicar o delta de `contracts/openapi-delta.md` — paths `listBookReviewsByFollowing` e `listPopularAmongFollowing`; alterar `listReadingSessions` (param `status`, resposta `ReadingSessionListCursorPage`, `400`); schemas novos (`BookReviewByFollowing`, `BookReviewByFollowingCursorPage`, `PopularAmongFollowingResponse`, `ReadingSessionBook`, `ReadingSessionListItem`, `ReadingSessionListCursorPage`); `pageCount` em `BookSearchResult` (incluir em `required`).
- [x] **T068** [P] `docs/flows/reading-flow.md`: `pageCount` no livro (nullable, lazy); filtro `status` e ordenação reading→finished no histórico; `book` embutido nos itens; `bookId` = id interno do Book.
- [x] **T069** [P] `docs/flows/review-flow.md`: nova seção "Reviews de um livro por quem eu sigo" (`GET /books/{olid}/reviews`) — regra de 1-por-seguidor, exclusão da própria review, filtro P6, `avatarUrl` sempre `null`.
- [x] **T070** [P] `docs/pagination-guide.md`: o cursor de `GET /me/reading-sessions` mudou de formato (carrega `status`) e não é retrocompatível; `GET /books/{olid}/reviews` usa o cursor padrão; `GET /books/popular-among-following` não é paginado.
- [x] **T071** `pnpm docs:lint` sem erros; `pnpm typecheck`; `pnpm test` (suíte completa) verde; conferir que nenhum schema ficou órfão (`ReadingSessionCursorPage` — remover se o lint acusar).
- [~] **T072** (não executável neste ambiente: exige MongoDB + servidor + Open Library reais; cobertura equivalente pelos testes de integração/rota com mongodb-memory-server) Rodar `specs/010-readingcontractgaps/quickstart.md` manualmente (seed A/B/C, passos 2–6) e marcar o checklist de fechamento.
- [x] **T073** Fechar a Definição de Pronto da spec (4 itens) e enviar à sessão `spine-frontend` os nomes finais de rota/schema publicados no `openapi.yaml`.

---

## Dependências

- **F1 → F5, F6**: `BookSearchResultDTO.pageCount` (T010) precede o `book` embutido (T048–T050) e o mapeamento de populares (T060–T061).
- **F2 → F3, F4, F6**: os índices (T015) precedem a validação de performance; `tests/helpers/*-indexes.ts` (T016–T017) precisam existir antes dos testes de repositório de F3/F4/F6 que dependem de ordenação/filtro corretos sob índice.
- **F3**: T023 (schema) → T029/T030 (controller/rota); T024 (interface) → T025 (impl) → T027 (serviço) → T029 → T030 → T031 (DI). Testes T019–T022 antes de T023–T031.
- **F4**: T038 (cursor codec) → T041 (repo usa o codec); T039 (schema) → T042/T043; T040 (interface) → T041. Testes T033–T037 antes da implementação.
- **F5** depende de **F4** concluída (mesmos arquivos: `list-reading-sessions.service.ts`, `to-dto.ts`, `types.ts` de reading-sessions) — não paralelizar F4 e F5.
- **F6**: T057 (interface) → T058; T059 (shelf repo) independente de T058 → `[P]`; T060 → T061 (serviço) → T063 → T064 → T065 (DI). Testes T053–T056 antes.
- **F7** depende de F1–F6 mergeadas: T067–T070 podem rodar em paralelo (arquivos distintos); T071 depois deles; T072 depois de T071; T073 por último.

## Exemplo de execução em paralelo

```
# F1, testes (arquivos de teste distintos):
T001  tests/unit/integrations/open-library/http-open-library-client.spec.ts
T002  tests/integration/services/books/get-book.service.spec.ts
T003  tests/integration/services/books/search-books.service.spec.ts
T004  tests/integration/services/books/list-want-to-read.service.spec.ts

# F1, implementação após T009 (serviços em arquivos distintos):
T011  src/services/books/get-book.service.ts
T012  src/services/books/list-want-to-read.service.ts
T013  src/services/books/search-books.service.ts

# F7, documentação (arquivos distintos):
T067  docs/openapi.yaml
T068  docs/flows/reading-flow.md
T069  docs/flows/review-flow.md
T070  docs/pagination-guide.md
```

## Notas

- `[P]` só onde os arquivos são distintos e não há dependência — nunca em duas tarefas que escrevem no mesmo arquivo (ex.: T041 e nada mais toca `mongo-reading-session.repository.ts` na mesma leva; F3/F4/F6 editam esse arquivo em fases diferentes, sequencialmente).
- Verificar que cada teste falha antes de implementar o código correspondente.
- Commitar após cada tarefa (direto na `master` nesta feature).
- `pnpm` é o gerenciador (o `packageManager` do `package.json` declara `pnpm@9.15.4`); os scripts são os do `package.json` (`test`, `test:unit`, `test:integration`, `docs:lint`, `migrate:up`/`down`).
- Nenhuma tarefa ficou bloqueada por lacuna no `plan.md`/`data-model.md`.
