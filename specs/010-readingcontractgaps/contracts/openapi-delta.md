# Contrato — delta de `docs/openapi.yaml`

Este arquivo descreve, de forma aplicável e verificável, **tudo** que muda em `docs/openapi.yaml` nesta feature. Ao final da implementação, `pnpm docs:lint` (`npx redocly lint docs/openapi.yaml`) DEVE passar sem erros e o YAML DEVE refletir exatamente o abaixo.

Convenção do arquivo: mesmo estilo compacto já usado no `openapi.yaml` (chaves inline, `additionalProperties: false`, `required` explícito).

---

## 1. `paths` — 2 operações novas

### 1.1 `GET /books/{olid}/reviews` — `operationId: listBookReviewsByFollowing`

```yaml
  /books/{olid}/reviews:
    get:
      tags: [books]
      operationId: listBookReviewsByFollowing
      summary: >
        Reviews deste livro feitas por quem eu sigo (follow aprovado). No máximo uma
        por seguidor — a da reading session `finished` mais recente dele. Não inclui a
        minha própria review. Ordenado por `createdAt` da review desc.
      parameters:
        - { $ref: "#/components/parameters/Olid" }
        - { $ref: "#/components/parameters/Cursor" }
        - { $ref: "#/components/parameters/Limit" }
      responses:
        "200": { description: Página do cursor (vazia se ninguém que eu sigo tem review `finished` deste livro)., content: { application/json: { schema: { $ref: "#/components/schemas/BookReviewByFollowingCursorPage" } } } }
        "400": { $ref: "#/components/responses/ValidationError" }
        "401": { $ref: "#/components/responses/Unauthenticated" }
        "404": { description: "`BOOK_NOT_FOUND` — `olid` não existe no cache nem no Open Library.", content: { application/json: { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        "503": { description: "`OPEN_LIBRARY_UNAVAILABLE` — só pode ocorrer no cache miss ao resolver o `olid`.", content: { application/json: { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
```

### 1.2 `GET /books/popular-among-following` — `operationId: listPopularAmongFollowing`

```yaml
  /books/popular-among-following:
    get:
      tags: [books]
      operationId: listPopularAmongFollowing
      summary: >
        Livros mais populares entre quem eu sigo (follow aprovado), para o estado
        inicial da busca de livros. Ranqueado por nº de seguidos distintos que têm
        qualquer reading session do livro (all-time). Exclui livros que eu já conheço
        (já tenho reading session ou "quero ler"). No máximo 20, sem paginação.
      responses:
        "200": { description: "Até 20 livros (lista vazia se não sigo ninguém, ninguém tem session, ou já conheço todos os populares).", content: { application/json: { schema: { $ref: "#/components/schemas/PopularAmongFollowingResponse" } } } }
        "401": { $ref: "#/components/responses/Unauthenticated" }
```

> Nota de posicionamento: a rota literal `/books/popular-among-following` DEVE ser registrada no Fastify **antes** de `/books/:olid` OU o handler de `:olid` continua intacto porque `popular-among-following` nunca é um `olid` válido — decidir no `/tasks`; hoje `booksRoutes` registra `/books/:olid` cedo, então a rota estática precisa vir antes dela no plugin. (Não afeta o `openapi.yaml`, só a implementação.)

---

## 2. `paths` — 1 operação alterada

### 2.1 `GET /me/reading-sessions` (`operationId: listReadingSessions`) — parâmetro `status` + nota de ordenação + cursor

Substituir o bloco atual por:

```yaml
  /me/reading-sessions:
    get:
      tags: [reading-sessions]
      operationId: listReadingSessions
      summary: >
        Histórico paginado de reading sessions do usuário autenticado. Sem filtro de
        `status`, vêm todas as `reading` antes de todas as `finished`; dentro de cada
        grupo, `createdAt` desc. Cada item embute um resumo do livro (`book`).
      parameters:
        - { name: bookId, in: query, required: false, schema: { type: string }, description: "`id` interno do Book (campo `id` de `BookDetail`), não o `olid`." }
        - { name: status, in: query, required: false, schema: { type: string, enum: [reading, finished] }, description: "Filtra por status. Ausente = todas, agrupadas reading→finished." }
        - { $ref: "#/components/parameters/Cursor" }
        - { $ref: "#/components/parameters/Limit" }
      responses:
        "200": { description: Página do cursor., content: { application/json: { schema: { $ref: "#/components/schemas/ReadingSessionListCursorPage" } } } }
        "400": { description: "`VALIDATION_ERROR` — `status` fora de `reading|finished`, ou cursor malformado / no formato anterior a esta versão (o formato do cursor mudou e não é retrocompatível).", content: { application/json: { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
        "401": { $ref: "#/components/responses/Unauthenticated" }
```

Mudanças vs. hoje: (a) novo parâmetro `status`; (b) `bookId` ganha `description`; (c) resposta `200` passa a referenciar `ReadingSessionListCursorPage` (com `book` embutido) em vez de `ReadingSessionCursorPage`; (d) `400` documentado.

---

## 3. `components/schemas` — schemas novos

```yaml
    BookReviewByFollowing:
      type: object
      additionalProperties: false
      required: [reviewId, author, rating, text, containsSpoiler, createdAt]
      properties:
        reviewId: { type: string }
        author:
          type: object
          additionalProperties: false
          required: [userId, handle, displayName, avatarUrl]
          properties:
            userId: { type: string }
            handle: { type: string }
            displayName: { type: string }
            avatarUrl: { type: [string, "null"], description: "Sempre `null` por enquanto — upload de avatar ainda não existe na API." }
        rating: { type: integer, minimum: 1, maximum: 5 }
        text: { type: [string, "null"] }
        containsSpoiler: { type: boolean }
        createdAt: { type: string, format: date-time, description: "`createdAt` da review." }

    BookReviewByFollowingCursorPage:
      type: object
      additionalProperties: false
      required: [items, nextCursor]
      properties:
        items: { type: array, items: { $ref: "#/components/schemas/BookReviewByFollowing" } }
        nextCursor: { type: [string, "null"] }

    PopularAmongFollowingResponse:
      type: object
      additionalProperties: false
      required: [items]
      properties:
        items:
          type: array
          maxItems: 20
          items: { $ref: "#/components/schemas/BookSearchResult" }

    ReadingSessionBook:
      type: object
      additionalProperties: false
      required: [title, authors, coverUrl, pageCount]
      properties:
        title: { type: string }
        authors: { type: array, items: { type: string } }
        coverUrl: { type: [string, "null"] }
        pageCount: { type: [integer, "null"] }

    ReadingSessionListItem:
      description: "Item de `GET /me/reading-sessions` — `ReadingSession` + `book` embutido. As demais respostas de reading-session usam `ReadingSession` (sem `book`)."
      allOf:
        - $ref: "#/components/schemas/ReadingSession"
        - type: object
          additionalProperties: false
          required: [book]
          properties:
            book: { $ref: "#/components/schemas/ReadingSessionBook" }

    ReadingSessionListCursorPage:
      type: object
      additionalProperties: false
      required: [items, nextCursor]
      properties:
        items: { type: array, items: { $ref: "#/components/schemas/ReadingSessionListItem" } }
        nextCursor: { type: [string, "null"] }
```

> O par `allOf: [ReadingSession, {…}]` segue o mesmo padrão já usado por `BookDetail` neste arquivo — mantido por consistência.

---

## 4. `components/schemas` — schemas alterados

### 4.1 `BookSearchResult` — adicionar `pageCount`

```yaml
    BookSearchResult:
      type: object
      additionalProperties: false
      required: [olid, isbn13, title, authors, coverUrl, firstPublishYear, pageCount]   # + pageCount
      properties:
        olid: { type: string }
        isbn13: { type: [string, "null"] }
        title: { type: string }
        authors: { type: array, items: { type: string } }
        coverUrl: { type: [string, "null"] }
        firstPublishYear: { type: [integer, "null"] }
        pageCount: { type: [integer, "null"], description: "Mediana de nº de páginas do Open Library (`number_of_pages_median`). `null` quando o Open Library não informa, ou quando o livro foi cacheado antes desta versão e ainda não foi re-resolvido." }   # NOVO
```

Efeito em cascata (sem editar os schemas, só ciente):
- `BookDetail` (`allOf` de `BookSearchResult`) passa a exigir `pageCount`.
- `BookSearchPage.items`, `BookCursorPage.items` passam a carregar `pageCount`.
- `PopularAmongFollowingResponse.items` (novo) idem.

### 4.2 `ReadingSession` — **inalterado**

`ReadingSession` **não** muda. `book` só aparece via `ReadingSessionListItem`. `ReadingSessionCursorPage` deixa de ser referenciado por `listReadingSessions`, mas **permanece definido** no arquivo caso outra operação o use (hoje nenhuma o faz além da listagem — pode ser removido se o `redocly lint` acusar schema órfão; verificar no `/tasks`).

---

## 5. Guias em `docs/` a atualizar

| Arquivo | Mudança |
|---|---|
| `docs/flows/reading-flow.md` | Documentar `pageCount` no livro; filtro `status` e a ordenação reading→finished no histórico; `book` embutido nos itens do histórico; `bookId` = id interno. |
| `docs/flows/review-flow.md` | Nova seção "Reviews de um livro por quem eu sigo" (`GET /books/{olid}/reviews`): regra de 1-por-seguidor, exclusão da própria review, filtro P6. |
| `docs/flows/feed-flow.md` | Só se citar "descoberta": referenciar `GET /books/popular-among-following` como superfície de descoberta do círculo. (Opcional — confirmar no `/tasks`.) |
| `docs/pagination-guide.md` | Anotar que o cursor de `GET /me/reading-sessions` mudou de formato nesta versão (passou a carregar o `status`) e **não** é retrocompatível; `GET /books/{olid}/reviews` usa o cursor padrão `{createdAt,id}`; `GET /books/popular-among-following` **não** é paginado. |
| `docs/README.md` | Sem mudança estrutural (nenhum arquivo novo em `docs/`). |

---

## 6. Verificação

1. `pnpm docs:lint` → sem erros.
2. Checklist de cobertura: cada `operationId` novo/alterado tem entrada em `paths`; cada `$ref` novo resolve; `pageCount` aparece em `BookSearchResult`.
3. Cruzar com as rotas reais: `src/controllers/books/books.routes.ts` registra `GET /books/:olid/reviews` e `GET /books/popular-among-following`; `src/schemas/reading-sessions/list-reading-sessions.schema.ts` aceita `status`.
