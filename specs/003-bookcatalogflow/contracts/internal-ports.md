# Contratos internos (ports) — Books Flow

Interfaces TypeScript que as camadas expõem umas às outras. Nomes em inglês; caminhos seguem
`.specify/memory/architecture.md`. Fluxo unidirecional: controller → service → repository; só
`repositories/**`, `db/**` tocam o driver `mongodb`; só `integrations/open-library/**` toca a
rede do Open Library.

---

## `OpenLibraryClient` — `src/integrations/open-library/open-library-client.ts`

Pasta transversal nova (mesma lógica de `src/auth/` na 002 — fora da tabela de
`architecture.md`, mesmo padrão porta+adaptador). Nenhum Fastify, nenhum `mongodb`. Coberta
por **teste de integração com um dublê** (`FakeOpenLibraryClient`, D8 do `research.md`) nos
services que a consomem; `HttpOpenLibraryClient` em si é exercitada por um teste de
integração próprio (unitário-de-borda) contra um stub HTTP local.

```ts
export interface OpenLibrarySearchResult {
  olid: string;                    // key do Open Library sem o prefixo "/works/"
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;         // já resolvida a partir de cover_i, se houver
  firstPublishYear: number | null;
}

export interface OpenLibrarySearchPage {
  items: OpenLibrarySearchResult[];
  page: number;
  limit: number;
  totalItems: number;
}

export interface OpenLibraryClient {
  /** Busca livre por título/autor. Lança OpenLibraryUnavailableError em falha de rede/timeout/5xx. */
  search(query: string, page: number, limit: number): Promise<OpenLibrarySearchPage>;

  /** Busca exata por olid (q=key:/works/<olid>, limit=1). null se não achou (não é erro). */
  findByKey(olid: string): Promise<OpenLibrarySearchResult | null>;
}
```

Implementação: `HttpOpenLibraryClient` em `http-open-library-client.ts`, recebe
`{ baseUrl, timeoutMs }`. Usa `fetch` global + `AbortController`. Registro Awilix:
`openLibraryClient`.

---

## `BookRepository` — `src/repositories/books/book.repository.ts`

Port de acesso a dados de `books`. Registro Awilix: `bookRepository`.

```ts
export interface BookRecord {
  id: string;
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertBookInput {
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
}

export interface BookRepository {
  findByOlid(olid: string): Promise<BookRecord | null>;
  findById(id: string): Promise<BookRecord | null>;
  /** updateOne upsert por olid — nunca duplica o mesmo olid (D3). */
  upsertByOlid(input: UpsertBookInput): Promise<BookRecord>;
}
```

Implementação: `MongoBookRepository` em `mongo-book.repository.ts`, recebe `db: Db`.

---

## `ShelfMembershipRepository` — `src/repositories/shelf-memberships/shelf-membership.repository.ts`

Port de acesso a `shelf_memberships`. Registro Awilix: `shelfMembershipRepository`.

```ts
export interface ShelfMembershipRecord {
  id: string;
  userId: string;
  bookId: string;
  createdAt: Date;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ShelfMembershipRepository {
  /** Upsert idempotente — marcar de novo não duplica nem falha (D6). */
  add(userId: string, bookId: string): Promise<void>;
  /** deleteOne idempotente — remover algo que não existe não é erro. */
  remove(userId: string, bookId: string): Promise<void>;
  /** Cursor por createdAt desc (D4). */
  list(userId: string, cursor: string | null, limit: number): Promise<CursorPage<ShelfMembershipRecord>>;
}
```

Implementação: `MongoShelfMembershipRepository` em `mongo-shelf-membership.repository.ts`.

---

## `ReadingSessionRepository` — `src/repositories/reading-sessions/reading-session.repository.ts`

Port de acesso a `reading_sessions`. Registro Awilix: `readingSessionRepository`.

```ts
export interface ReadingSessionRecord {
  id: string;
  userId: string;
  bookId: string;
  status: 'reading' | 'finished';
  startedAt: Date | null;
  finishedAt: Date | null;
  currentPage: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EditReadingSessionInput {
  startedAt?: Date;
  finishedAt?: Date;
  currentPage?: number;
}

export interface ReadingSessionRepository {
  /**
   * Tenta inserir uma session `reading`. Se violar o índice único parcial (código 11000),
   * busca e retorna a session `reading` já existente em vez de propagar o erro (RF-009, D5).
   */
  startReading(userId: string, bookId: string, startedAt: Date): Promise<ReadingSessionRecord>;

  /** Sempre insere uma nova session `finished` — nunca reaproveita (RF-014, RF-016). */
  createFinished(
    userId: string,
    bookId: string,
    input: { startedAt: Date | null; finishedAt: Date },
  ): Promise<ReadingSessionRecord>;

  findById(sessionId: string): Promise<ReadingSessionRecord | null>;

  /** Lança InvalidReadingSessionStateError se status !== 'reading' (RF-012). */
  updateProgress(sessionId: string, currentPage: number): Promise<ReadingSessionRecord>;

  /** status -> 'finished'; idempotente se já finished (RF-015 + caso de borda). */
  finish(sessionId: string, finishedAt: Date): Promise<ReadingSessionRecord>;

  /** Lança InvalidReadingSessionDatesError se o resultado final tiver finishedAt < startedAt (RF-017). */
  edit(sessionId: string, patch: EditReadingSessionInput): Promise<ReadingSessionRecord>;

  delete(sessionId: string): Promise<void>;

  /** Cursor por createdAt desc, filtro opcional por bookId (RF-019, D4). */
  listByUser(
    userId: string,
    filter: { bookId?: string },
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<ReadingSessionRecord>>;

  /** userId distintos com >=1 session finished deste livro — usado no agregado readerCount. */
  countDistinctFinishedReaders(bookId: string): Promise<number>;
}
```

Implementação: `MongoReadingSessionRepository` em `mongo-reading-session.repository.ts`.

---

## Cursor de paginação — `src/lib/pagination.ts` (função pura, sem I/O)

Pasta transversal de utilidades puras (como `src/auth/` da 002, mas sem nada de segurança —
só codificação/decodificação de cursor). Coberta por **teste unitário**.

```ts
export interface CursorPayload { createdAt: string; id: string } // createdAt em ISO 8601

/** base64url(JSON.stringify(payload)). */
export function encodeCursor(payload: CursorPayload): string;

/** Decodifica; cursor malformado -> ValidationError (borda trata, não a função pura). */
export function decodeCursor(cursor: string): CursorPayload;
```

Repositórios usam `decodeCursor`/`encodeCursor` para montar o filtro
`{ $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }] }`
e o `nextCursor` da última página.

---

## Services — `src/services/books/` (regra de negócio; factory Awilix; um arquivo por operação)

Cobertos por **teste de integração** com `mongodb-memory-server` + `FakeOpenLibraryClient`
(D8) — caminho feliz + ≥1 de erro.

```ts
// search-books.service.ts — makeSearchBooks({ openLibraryClient })
export type SearchBooks = (input: { q: string; page: number; limit: number }) => Promise<BookSearchPageDTO>;
// delega a openLibraryClient.search; falha de rede -> OpenLibraryUnavailableError sobe direto.

// get-book.service.ts — makeGetBook({ bookRepository, openLibraryClient, readingSessionRepository })
export type GetBook = (input: { olid: string }) => Promise<BookDetailDTO>;
// findByOlid; se null -> findByKey (BookNotFoundError se null, OpenLibraryUnavailableError se
// falhar) -> upsertByOlid; monta aggregates (averageRating: null, reviewCount: 0,
// readerCount: countDistinctFinishedReaders).

// mark-want-to-read.service.ts — makeMarkWantToRead({ bookRepository, openLibraryClient, shelfMembershipRepository })
export type MarkWantToRead = (input: { userId: string; olid: string }) => Promise<void>;
// resolve/cacheia o book (mesma lógica de get-book) -> shelfMembershipRepository.add.

// unmark-want-to-read.service.ts — makeUnmarkWantToRead({ bookRepository, shelfMembershipRepository })
export type UnmarkWantToRead = (input: { userId: string; olid: string }) => Promise<void>;
// findByOlid só no cache local (SEM chamar Open Library — D3); achou -> remove; não achou -> no-op.

// list-want-to-read.service.ts — makeListWantToRead({ shelfMembershipRepository, bookRepository })
export type ListWantToRead = (input: { userId: string; cursor: string | null; limit: number }) => Promise<BookCursorPageDTO>;
// lista memberships -> resolve os books por id (findById em lote) -> monta DTO.
```

Registros Awilix: `searchBooksService`, `getBookService`, `markWantToReadService`,
`unmarkWantToReadService`, `listWantToReadService`.

---

## Services — `src/services/reading-sessions/`

```ts
// start-reading.service.ts — makeStartReading({ bookRepository, openLibraryClient, readingSessionRepository, shelfMembershipRepository, clock })
export type StartReading = (input: { userId: string; olid: string }) => Promise<{ session: ReadingSessionDTO; created: boolean }>;
// resolve/cacheia o book -> readingSessionRepository.startReading(userId, bookId, clock.now())
// -> shelfMembershipRepository.remove(userId, bookId) best-effort (RF-010, D7).
// `created` diferencia 201 (nova) de 200 (reaproveitada) no controller.

// mark-finished.service.ts — makeMarkFinished({ bookRepository, openLibraryClient, readingSessionRepository, shelfMembershipRepository })
export type MarkFinished = (input: {
  userId: string; olid: string; startedAt?: Date; finishedAt: Date;
}) => Promise<ReadingSessionDTO>;
// resolve/cacheia o book -> readingSessionRepository.createFinished -> shelfMembershipRepository.remove best-effort.

// update-progress.service.ts — makeUpdateProgress({ readingSessionRepository })
export type UpdateProgress = (input: { userId: string; sessionId: string; currentPage: number }) => Promise<ReadingSessionDTO>;
// findById -> checa posse (D9) -> updateProgress.

// finish-reading-session.service.ts — makeFinishReadingSession({ readingSessionRepository, clock })
export type FinishReadingSession = (input: { userId: string; sessionId: string; finishedAt?: Date }) => Promise<ReadingSessionDTO>;
// findById -> checa posse -> finish(sessionId, finishedAt ?? clock.now()).
// Não precisa remover want_to_read de novo aqui: já foi removido em start-reading; mantido
// best-effort por segurança caso a session tenha sido criada por outro caminho.

// edit-reading-session.service.ts — makeEditReadingSession({ readingSessionRepository })
export type EditReadingSession = (input: {
  userId: string; sessionId: string; patch: { startedAt?: Date; finishedAt?: Date; currentPage?: number };
}) => Promise<ReadingSessionDTO>;
// findById -> checa posse -> edit.

// delete-reading-session.service.ts — makeDeleteReadingSession({ readingSessionRepository })
export type DeleteReadingSession = (input: { userId: string; sessionId: string }) => Promise<void>;
// findById -> checa posse -> delete.

// list-reading-sessions.service.ts — makeListReadingSessions({ readingSessionRepository })
export type ListReadingSessions = (input: {
  userId: string; bookId?: string; cursor: string | null; limit: number;
}) => Promise<ReadingSessionCursorPageDTO>;
```

Registros Awilix: `startReadingService`, `markFinishedService`, `updateProgressService`,
`finishReadingSessionService`, `editReadingSessionService`, `deleteReadingSessionService`,
`listReadingSessionsService`.

---

## HTTP — `src/controllers/books/` e `src/controllers/reading-sessions/`

- `books.routes.ts` — plugin do domínio, `{ prefix: '/v1' }`, todas as rotas com
  `preHandler: app.authenticate` (RF-020):
  - `GET  /books/search` → `search-books.controller.ts`
  - `GET  /books/:olid` → `get-book.controller.ts`
  - `PUT  /books/:olid/want-to-read` → `mark-want-to-read.controller.ts`
  - `DELETE /books/:olid/want-to-read` → `unmark-want-to-read.controller.ts`
  - `POST /books/:olid/start-reading` → `start-reading.controller.ts` (resolve `startReadingService` — status `200`/`201` conforme `created`)
  - `POST /books/:olid/mark-finished` → `mark-finished.controller.ts`
  - `GET  /me/want-to-read` → `list-want-to-read.controller.ts`
- `reading-sessions.routes.ts` — plugin do domínio, `{ prefix: '/v1' }`,
  `preHandler: app.authenticate`:
  - `POST  /reading-sessions/:sessionId/progress` → `update-progress.controller.ts`
  - `POST  /reading-sessions/:sessionId/finish` → `finish-reading-session.controller.ts`
  - `PATCH  /reading-sessions/:sessionId` → `edit-reading-session.controller.ts`
  - `DELETE /reading-sessions/:sessionId` → `delete-reading-session.controller.ts`
  - `GET  /me/reading-sessions` → `list-reading-sessions.controller.ts`

Cada controller: valida entrada com o schema `zod` do domínio (P3), resolve o service do
`request.diScope`, injeta `request.currentUser.id` como `userId`, chama, responde.

Registro Awilix novo em `register-repositories.ts` (`bookRepository`,
`shelfMembershipRepository`, `readingSessionRepository`), `register-infrastructure.ts`
(`openLibraryClient`) e `register-services.ts` (os 12 services). `cradle.ts` ganha os tipos.
