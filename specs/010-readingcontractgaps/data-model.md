# Modelo de Dados — Fase 1: `010-readingcontractgaps`

Esta feature **não cria entidade nem coleção nova**. Ela adiciona um campo opcional a uma entidade existente, adiciona índices de apoio, e introduz DTOs de resposta. Abaixo, o delta por entidade e os DTOs novos.

---

## Entidades persistidas

### Book (coleção `books`) — **alterada**

| Campo | Tipo | Novo? | Regras |
|---|---|---|---|
| `_id` | ObjectId | não | — |
| `olid` | string | não | único |
| `isbn13` | string \| ausente | não | índice único esparso; ausente quando não há ISBN |
| `title` | string | não | — |
| `authors` | string[] | não | — |
| `coverUrl` | string \| null | não | — |
| `firstPublishYear` | number \| null | não | — |
| **`pageCount`** | **number \| ausente** | **sim** | inteiro ≥ 1 quando presente; **ausente** quando o Open Library não informou `number_of_pages_median`. `toRecord()` normaliza ausência → `null` no `BookRecord`. Gravado só por `upsertByOlid` (preenchimento lazy — ver research D2). Sem índice. Sem backfill. |

**`BookRecord`** (forma de aplicação) ganha `pageCount: number | null`.
**`UpsertBookInput`** ganha `pageCount: number | null` (vindo de `OpenLibrarySearchResult`).

Migration: **nenhuma** para este campo (schemaless, sem índice, sem backfill).

---

### ReadingSession (coleção `reading_sessions`) — **inalterada na persistência**

Nenhum campo novo. Muda apenas:
- **Consulta**: `listByUser` passa a aceitar `status?: 'reading' | 'finished'` no filtro e ordena por `{ status: -1, createdAt: -1, _id: -1 }` (antes: `{ createdAt: -1, _id: -1 }`).
- **Índices novos** (migration D7):
  - `{ userId: 1, status: -1, createdAt: -1 }` → `reading_sessions_userId_status_createdAt`
  - `{ bookId: 1, status: 1, userId: 1 }` → `reading_sessions_bookId_status_userId`

Não confundir com `updatedAt`/`currentPage` — permanecem como estão.

---

### Review (coleção `reviews`) — **inalterada na persistência**

Nenhum campo novo. Muda apenas:
- **Índice novo** (migration D7): `{ bookId: 1, userId: 1 }` → `reviews_bookId_userId`.

---

### Follow (coleção `follows`) — **inalterada**

Usada só para leitura via `followRepository.listFolloweeIds(followerId)` (já existente) — devolve os IDs de quem o solicitante segue **com follow aprovado**. É o filtro de visibilidade P6 dos dois endpoints novos.

### ShelfMembership (coleção `shelf_memberships`) — **inalterada na persistência**

Muda apenas: novo método de leitura `listBookIdsForUser(userId): string[]` (`distinct('bookId', { userId })`) para a exclusão de "livros que o solicitante já conhece" no endpoint de populares.

---

## Métodos de repositório novos

### `ReadingSessionRepository`

```
listByUser(
  userId: string,
  filter: { bookId?: string; status?: 'reading' | 'finished' },   // status é novo
  cursor: string | null,
  limit: number,
): Promise<CursorPage<ReadingSessionRecord>>
```
- Ordenação `{ status: -1, createdAt: -1, _id: -1 }`.
- Cursor decodifica `{ status, createdAt, id }`; predicado keyset de 3 chaves (ver research D6).
- Cursor no formato antigo (`{ createdAt, id }` sem `status`) → `ValidationError` (400).

```
findLatestFinishedPerUserForBook(
  bookId: string,
  userIds: string[],
): Promise<ReadingSessionRecord[]>
```
- Aggregation: `$match { bookId, status: 'finished', userId: { $in: userIds } }`
  → `$sort { finishedAt: -1, createdAt: -1, _id: -1 }`
  → `$group { _id: '$userId', doc: { $first: '$$ROOT' } }`.
- `userIds` vazio → `[]` sem tocar o banco.

```
aggregatePopularBookIdsForReaders(
  readerIds: string[],
  excludeBookIds: string[],
  limit: number,
): Promise<Array<{ bookId: string; readerCount: number; lastActivityAt: Date }>>
```
- `$match { userId: { $in: readerIds }, bookId: { $nin: excludeBookIds } }`
  → `$group { _id: '$bookId', readers: { $addToSet: '$userId' }, lastActivityAt: { $max: '$createdAt' } }`
  → `$project { readerCount: { $size: '$readers' }, lastActivityAt: 1 }`
  → `$sort { readerCount: -1, lastActivityAt: -1 }`
  → `$limit: limit`.
- `readerIds` vazio → `[]` sem tocar o banco.
- Desempate final por `title` asc é aplicado **na aplicação**, depois do `bookRepository.findById` em batch (o `$sort` do Mongo cobre `readerCount` + `lastActivityAt`; `title` não está nesta coleção).

```
listBookIdsForUser(userId: string): Promise<string[]>     // distinct('bookId', { userId })
```

### `ShelfMembershipRepository`

```
listBookIdsForUser(userId: string): Promise<string[]>     // distinct('bookId', { userId })
```

### `BookRepository` — inalterada
`findById` / `findByOlid` / `upsertByOlid` já servem; só passam a carregar `pageCount`.

---

## DTOs de resposta (camada de serviço)

### `BookSearchResultDTO` — **alterado** (`src/services/books/types.ts`)
```
{
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  pageCount: number | null;        // NOVO
}
```
`BookDetailDTO extends BookSearchResultDTO` → herda `pageCount` automaticamente.
`BookCursorPageDTO` / `BookSearchPageDTO` → itens agora carregam `pageCount`.

### `ReadingSessionDTO` — **alterado** só na listagem (`src/services/reading-sessions/types.ts`)
O tipo ganha o campo opcional `book`, preenchido **apenas** por `list-reading-sessions.service`:
```
{
  id: string;
  bookId: string;
  status: 'reading' | 'finished';
  startedAt: string | null;
  finishedAt: string | null;
  currentPage: number | null;
  createdAt: string;
  review: ReviewDTO | null;
  book: ReadingSessionBookDTO | null;   // NOVO — não-null na listagem; ausente/null nas demais respostas
}

ReadingSessionBookDTO = {
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
}
```
`toReadingSessionDTO(record, review, book?)` — terceiro parâmetro opcional; quando omitido (start-reading, progress, finish, edit, mark-finished), o campo `book` sai como `null` e é **omitido do contrato dessas respostas** (documentar que só a listagem traz `book`).
> Alternativa aceitável na implementação: um `toReadingSessionListItemDTO` separado, para não colocar `book: null` nas outras respostas. Decidir no `/tasks`; o contrato exige apenas que `book` apareça **na listagem** e **não** nas demais.

### `BookReviewByFollowingDTO` — **novo** (`src/services/books/types.ts` ou arquivo próprio)
Item de `GET /books/{olid}/reviews`:
```
{
  reviewId: string;
  author: {
    userId: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;      // sempre null por ora (research D4)
  };
  rating: number;                  // inteiro 1–5
  text: string | null;
  containsSpoiler: boolean;
  createdAt: string;               // ISO-8601, da review
}
```
Página: `{ items: BookReviewByFollowingDTO[]; nextCursor: string | null }`.

### `PopularAmongFollowingDTO` — **novo**
Resposta de `GET /books/popular-among-following`:
```
{ items: BookSearchResultDTO[] }    // até 20 itens, sem nextCursor
```

---

## Erros

Nenhum erro de domínio novo. Reuso:
- `BookNotFoundError` (404) — `olid` inexistente em `GET /books/{olid}/reviews` (via `resolveBook`).
- `ValidationError` (400) — `status` fora do enum; cursor malformado ou no formato antigo.
- `UnauthenticatedError` (401) — sem/《inválido》 access token (já aplicado pelo `preHandler: app.authenticate`).
- `DatabaseUnavailableError` (503) — transversal, como em qualquer endpoint.
