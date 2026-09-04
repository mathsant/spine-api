# Fase 1 — Modelo de Dados: Books Flow

Feature: `003-bookcatalogflow` · Data: 2026-09-04

Todos os identificadores em inglês (regra fixa do kit). Persistência via MongoDB; toda
criação de coleção/índice vem de uma migration `migrate-mongo` (P4). Nenhum acesso ao driver
fora de `src/repositories/**` e `src/db/**` (P2).

---

## Book

Livro cacheado a partir do Open Library (glossário de `product.md`, P2/P3 — uma única camada,
sem distinção obra/edição). Coleção `books`.

| Campo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `_id` | `ObjectId` | sim | gerado pelo Mongo; exposto às camadas como `id: string` (hex) |
| `olid` | `string` | sim | chave de obra do Open Library sem o prefixo `/works/` (ex. `OL12345W`); **único**; identificador nas rotas (D3) |
| `isbn13` | `string \| null` | não | primeiro ISBN-13 do resultado do Open Library, se houver; **único esparso** |
| `title` | `string` | sim | do resultado do Open Library |
| `authors` | `string[]` | sim | `author_name` do Open Library; pode ser `[]` se ausente |
| `coverUrl` | `string \| null` | não | computada uma vez a partir de `cover_i` (`https://covers.openlibrary.org/b/id/<cover_i>-M.jpg`); `null` se sem capa |
| `firstPublishYear` | `number \| null` | não | `first_publish_year` do Open Library |
| `createdAt` | `Date` | sim | definido no primeiro cache (RF-003) |
| `updatedAt` | `Date` | sim | atualizado a cada re-cache (dois resultados de busca apontando pro mesmo `olid`/`isbn13`) |

**Índices** (migration `create-books-collection`):
- `{ olid: 1 }` único
- `{ isbn13: 1 }` único esparso

**Regras**:
- `upsertByOlid` é a única forma de escrita: `updateOne({ olid }, { $set: {...}, $setOnInsert: { createdAt: now } }, { upsert: true })`. Nunca há dois documentos para o mesmo `olid` (D3).
- Agregados (`averageRating`, `reviewCount`, `readerCount`) **não são campos persistidos** —
  são calculados na leitura (ver `GetBookDTO` abaixo), porque review é de outra feature e
  `readerCount` é derivável de `reading_sessions` sem risco de ficar dessincronizado.

---

## ShelfMembership

Marca "quero ler" de um usuário sobre um livro (glossário de `product.md` — não é sessão de
leitura). Coleção `shelf_memberships`.

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `_id` | `ObjectId` | sim | exposto como `id: string` |
| `userId` | `ObjectId` | sim | dono da marcação |
| `bookId` | `ObjectId` | sim | referência a `books._id` |
| `createdAt` | `Date` | sim | instante da marcação (ou da última reinserção, se removida e marcada de novo) |

**Índices** (migration `create-shelf-memberships-collection`):
- `{ userId: 1, bookId: 1 }` único composto

**Regras**:
- `add(userId, bookId)`: upsert idempotente (D6, RF-005).
- `remove(userId, bookId)`: `deleteOne` idempotente (RF-006).
- Removida automaticamente por `start-reading`/`mark-finished` quando presente (RF-010, D7).

---

## ReadingSession

Uma passada de um usuário por um livro (glossário de `product.md`, P4/P10). Coleção
`reading_sessions`.

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `_id` | `ObjectId` | sim | exposto como `id: string` |
| `userId` | `ObjectId` | sim | dono da session |
| `bookId` | `ObjectId` | sim | referência a `books._id` |
| `status` | `'reading' \| 'finished'` | sim | `reading` ao iniciar; `finished` ao finalizar ou ao marcar direto (RF-014) |
| `startedAt` | `Date \| null` | não | preenchido ao iniciar leitura; opcional em `finished` direto (RF-014, "li ano passado" — P10) |
| `finishedAt` | `Date \| null` | condicional | obrigatório quando `status = 'finished'`; `null` enquanto `reading` |
| `currentPage` | `number \| null` | não | inteiro positivo; sobrescrito a cada progress update (RF-011); **sem validação contra total de páginas do livro** (RF-013) |
| `createdAt` | `Date` | sim | instante de criação do registro — **não é o mesmo que `startedAt`** (uma session `finished` direto pode ter `startedAt` de meses atrás mas `createdAt` de agora); usado para ordenar o histórico (D4) |
| `updatedAt` | `Date` | sim | atualizado em qualquer escrita (progresso, finalizar, editar) |

**Índices** (migration `create-reading-sessions-collection`):
- `{ userId: 1, bookId: 1 }` único **parcial**, `partialFilterExpression: { status: 'reading' }` — no máximo uma session aberta por livro/usuário (D5, RF-009)
- `{ userId: 1, createdAt: -1 }` — paginação do histórico (RF-019)
- `{ userId: 1, bookId: 1 }` — filtro por livro no histórico (RF-019)

**Regras**:
- `startReading(userId, bookId, startedAt)`: tenta inserir `{ status: 'reading', startedAt, finishedAt: null, currentPage: null }`; violação do índice único parcial (código `11000`) ⇒ **não propaga** — busca e retorna a session `reading` já existente (RF-009, D5).
- `createFinished(userId, bookId, { startedAt?, finishedAt })`: sempre insere uma **nova** session `finished` — não reaproveita nenhuma anterior, mesmo que o livro já tenha sido lido antes (RF-014, RF-016, releitura).
- `updateProgress(sessionId, currentPage)`: rejeitado (`InvalidReadingSessionStateError`) se `status !== 'reading'` (RF-012).
- `finish(sessionId, finishedAt)`: `status: 'reading' → 'finished'`, `finishedAt` preenchido; idempotente se já `finished` (atualiza `finishedAt` de novo em vez de erro — caso de borda da spec).
- `edit(sessionId, { startedAt?, finishedAt?, currentPage? })`: rejeitado (`InvalidReadingSessionDatesError`) se o resultado final tiver `finishedAt < startedAt` com ambos presentes (RF-017).
- `delete(sessionId)`: remove o documento (RF-018).
- Posse: toda operação sobre um `sessionId` verifica `session.userId === currentUser.id`; não bateu ⇒ `ReadingSessionNotFoundError` (D9) — mesmo tratamento de "não existe".

---

## DTOs de resposta (camada HTTP)

Construídos pelo service a partir dos records acima; nunca expõem `_id`/`ObjectId` cru.

```ts
export interface BookSearchResultDTO {
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
}

export interface BookDetailDTO extends BookSearchResultDTO {
  id: string; // id interno — usado para filtrar GET /v1/me/reading-sessions?bookId=
  aggregates: {
    averageRating: number | null; // sempre null nesta feature (review é de outra feature)
    reviewCount: number;          // sempre 0 nesta feature
    readerCount: number;          // contagem de userId distintos com ao menos 1 ReadingSession finished deste livro
  };
}

export interface ReadingSessionDTO {
  id: string;
  bookId: string;
  status: 'reading' | 'finished';
  startedAt: string | null;   // ISO 8601
  finishedAt: string | null;  // ISO 8601
  currentPage: number | null;
  createdAt: string;          // ISO 8601
}
```

---

## Objetos de valor (schemas de entrada — `src/schemas/books/`, `src/schemas/reading-sessions/`)

Validados por `zod` no controller antes de qualquer service (P3).

| Schema | Campos | Regras |
|---|---|---|
| `searchBooks` (querystring) | `q`, `page?`, `limit?` | `q` string 1–200 chars (não vazio); `page` int ≥ 1, default 1; `limit` int 1–50, default 20 |
| `listWantToRead` (querystring) | `cursor?`, `limit?` | `cursor` string opaca opcional; `limit` int 1–100, default 20 |
| `markFinished` (body) | `startedAt?`, `finishedAt` | ambos ISO 8601 datetime; `finishedAt` obrigatório |
| `updateProgress` (body) | `currentPage` | int positivo (≥ 1) |
| `finishReadingSession` (body) | `finishedAt?` | ISO 8601 datetime opcional (default = agora no service) |
| `editReadingSession` (body) | `startedAt?`, `finishedAt?`, `currentPage?` | ISO 8601 datetime / int positivo; ao menos 1 campo presente |
| `listReadingSessions` (querystring) | `bookId?`, `cursor?`, `limit?` | `bookId` string (ObjectId hex) opcional; `cursor` opaca opcional; `limit` int 1–100, default 20 |

`startReading` não tem corpo (o `olid` já vem na URL). Falha de qualquer schema ⇒ `ZodError`
→ `ValidationError` (`400 VALIDATION_ERROR`, com `details`) pelo error handler global já
existente (001).

---

## Hierarquia de erros — subtipos novos

Todos estendem `AppError` (`src/errors/app-error.ts`), `code` em `SCREAMING_SNAKE_CASE`.
Serializados no envelope único `{ error: { code, message, statusCode, details? } }`.

| Classe | `code` | `statusCode` | Quando |
|---|---|---|---|
| `BookNotFoundError` | `BOOK_NOT_FOUND` | `404` | `olid` não está no cache e o Open Library também não tem nenhum resultado exato pra essa chave |
| `OpenLibraryUnavailableError` | `OPEN_LIBRARY_UNAVAILABLE` | `503` | timeout, erro de rede ou `5xx` do Open Library durante busca ou resolução de `olid` (RF-002) |
| `ReadingSessionNotFoundError` | `READING_SESSION_NOT_FOUND` | `404` | `sessionId` não existe **ou** pertence a outro usuário (D9) |
| `InvalidReadingSessionStateError` | `INVALID_READING_SESSION_STATE` | `409` | progress update numa session que não está `reading` (RF-012) |
| `InvalidReadingSessionDatesError` | `INVALID_READING_SESSION_DATES` | `422` | edição resultaria em `finishedAt < startedAt` (RF-017) |

`VALIDATION_ERROR` (400), `UNAUTHENTICATED`/`INVALID_ACCESS_TOKEN` (401) e `INTERNAL_ERROR`
(500) são reaproveitados das features 001/002 sem alteração.

---

## Diagrama de relações

```
User (1) ──< ShelfMembership (N)     userId
User (1) ──< ReadingSession (N)      userId
Book (1) ──< ShelfMembership (N)     bookId
Book (1) ──< ReadingSession (N)      bookId  (várias sessions do mesmo livro = releitura)
```
