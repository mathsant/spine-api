# Pesquisa — Fase 0: `010-readingcontractgaps`

Todas as incógnitas do Contexto Técnico foram resolvidas abaixo. Nenhum `[NEEDS CLARIFICATION]` remanescente.

---

## D1 — Origem do `pageCount`: campo do Open Library e propagação

**Decisão**: `pageCount` vem de `number_of_pages_median` do documento do Open Library (`/search.json`), mapeado defensivamente para `number | null` no `HttpOpenLibraryClient.toResult()`. Passa a integrar `OpenLibrarySearchResult`, `BookRecord`/`UpsertBookInput`/`BookDocument`, e os DTOs `BookSearchResultDTO` (logo `BookDetailDTO`, que o estende) e o objeto `book` embutido na listagem de reading-sessions.

**Justificativa**: `/search.json` já é a única chamada ao Open Library usada pelo projeto (tanto `search()` quanto `findByKey()`), e `number_of_pages_median` é o campo de contagem de páginas que ela retorna por padrão. Mapear no `toResult()` faz o valor fluir por busca **e** lookup por `olid` sem duplicar lógica. Mapeamento defensivo (`doc.number_of_pages_median ?? null`) satisfaz RF-003 quando o Open Library omite o campo.

**Alternativas consideradas**:
- *Chamar o endpoint de works/editions do Open Library para nº de páginas exato*: rejeitado — P3 adia a "camada de edição" e páginas exatas; `number_of_pages_median` (aproximado, no nível de work) é suficiente para barra de progresso e "% lido", e não exige nova integração.
- *Persistir `pageCount` também no fluxo de busca*: rejeitado — `searchBooks` não escreve no cache hoje (não há `upsert`), e mudar isso é escopo maior. O valor de busca vem direto do Open Library na resposta; o cache recebe `pageCount` quando o livro é resolvido por um fluxo que já faz `upsertByOlid` (`resolveBook`).

---

## D2 — `pageCount` de livros já cacheados: sem migration, preenchimento lazy

**Decisão**: nenhuma migration de dados. O campo `pageCount` só é gravado quando `MongoBookRepository.upsertByOlid` roda (isto é, quando um livro é resolvido do Open Library por `resolveBook` num cache miss, ou re-resolvido). Livros já no cache ficam sem o campo (`pageCount` ausente → serializado como `null` no DTO) até serem re-resolvidos.

**Justificativa**: decisão explícita do usuário no `/specify`. MongoDB é schemaless: adicionar um campo opcional novo, sem índice e sem backfill, não dispara o princípio P4 da constituição (que cobre criação/alteração de índice, criação/remoção de coleção, e backfill/transformação de documentos existentes — nada disso ocorre aqui). O `toRecord()` do repositório normaliza ausência para `null`, então o contrato (`pageCount: integer | null`) é honrado desde o primeiro deploy.

**Alternativas consideradas**:
- *Migration de backfill chamando o Open Library para cada livro cacheado*: rejeitada pelo usuário — custo de N chamadas externas, risco de rate limit, e o valor lazy converge sozinho conforme os livros são reabertos.

---

## D3 — `GET /books/{olid}/reviews`: "uma review por seguidor (a mais recente finished)"

**Decisão**: o serviço resolve, para cada usuário que o solicitante segue com follow aprovado, **a reading session `finished` mais recente daquele usuário para aquele livro**, e então a review vinculada a essa session (se houver). Seguidores cuja session `finished` mais recente não tem review são omitidos. A lista final é ordenada por `createdAt` da review desc e paginada por cursor `{ createdAt, id }` (o mesmo codec `encodeCursor`/`decodeCursor` já usado no projeto).

Novo método de repositório em `ReadingSessionRepository`:
`findLatestFinishedPerUserForBook(bookId: string, userIds: string[]): Promise<ReadingSessionRecord[]>` — aggregation `$match { bookId, status: 'finished', userId: { $in } }` → `$sort { finishedAt: -1, createdAt: -1, _id: -1 }` → `$group { _id: '$userId', doc: { $first: '$$ROOT' } }`.

Reuso: `followRepository.listFolloweeIds(userId)` (já existe — devolve followees **aprovados**), `reviewRepository.findBySessionIds(sessionIds)` (já existe — batch, sem N+1), `userRepository.findById` em batch para o bloco de autor, `resolveBook` para o 404.

**Justificativa**: espelha a regra de produto "a nota do usuário para o livro exibida é a da sessão finalizada mais recente" (product.md), evita listar N reviews de releituras do mesmo seguidor, e reaproveita a infra de batch-load do feed (`get-feed.service.ts`). `listFolloweeIds` é exatamente o filtro P6 que o feed usa.

**Alternativas consideradas**:
- *Todas as reviews de todas as sessions dos seguidores*: rejeitada no `/specify` (poluição por releitura).
- *Cursor com paginação sobre reading sessions em vez de reviews*: rejeitado — a unidade exibida é a review; paginar por `createdAt` da review é o que o cliente espera.
- *Query só em `reviews` (sem passar por sessions)*: rejeitada — `reviews` não guarda qual é a "mais recente por session finished"; precisa da session para aplicar a regra de dedupe. `ReviewRecord` tem `userId` e `bookId`, mas escolher "a da última finished" exige o `finishedAt`/ordenação da session.

---

## D4 — Bloco de autor: `avatarUrl` sempre presente, valor `null` (convenção do projeto)

**Decisão**: cada item de `GET /books/{olid}/reviews` traz `author: { userId, handle, displayName, avatarUrl }`, com `avatarUrl` sempre `null` por enquanto.

**Justificativa**: `UserRecord` não tem campo de avatar (upload de avatar está fora do primeiro corte — product.md). O projeto já resolve isso expondo `avatarUrl: null` fixo em `UserSearchResult` (`src/services/users/types.ts`, `docs/openapi.yaml` linha ~872). Seguir a mesma convenção mantém o contrato estável para quando o avatar existir, sem tocar no modelo de `User` (fora de escopo desta feature). Difere levemente do `FeedActorDTO`, que hoje não expõe `avatarUrl` — não vamos alterar o feed aqui, mas o bloco novo adota a forma mais completa (a de `UserSearchResult`).

**Alternativas consideradas**:
- *Omitir `avatarUrl` do bloco de autor*: rejeitada — o front-end (`002-reading-books`) pediu avatar explicitamente; expor o campo como `null` evita uma mudança de contrato later.
- *Adicionar `avatarUrl` ao `User`*: rejeitada — fora de escopo (spec: "não mexer em auth/profile"), e depende de object storage ainda não decidido.

---

## D5 — `GET /books/popular-among-following`: ranking, exclusões, forma

**Decisão**: agregação sobre `reading_sessions`:
1. `followeeIds = followRepository.listFolloweeIds(userId)` (aprovados). Vazio → resposta `{ items: [] }`.
2. `$match { userId: { $in: followeeIds } }` → `$group { _id: '$bookId', readers: { $addToSet: '$userId' } }` → `$project { count: { $size: '$readers' }, lastActivity: ... }`.
3. Excluir os `bookId` que o solicitante já conhece: união de `reading_sessions.distinct('bookId', { userId })` e `shelfMembershipRepository`-equivalente `distinct('bookId', { userId })`. Novo método de repositório em cada um: `listBookIdsForUser(userId): Promise<string[]>`.
4. Ordenar por `count` desc, desempate por `lastActivity` desc, depois `title` asc; `limit(20)`; **sem cursor**.
5. `bookRepository.findById` em batch → itens no formato `BookSearchResultDTO` (com `pageCount`).

Novo método em `ReadingSessionRepository`:
`aggregatePopularBookIdsForReaders(readerIds: string[], excludeBookIds: string[], limit: number): Promise<{ bookId: string; readerCount: number; lastActivityAt: Date }[]>`.

**Justificativa**: "leitores distintos entre seguidos, all-time" foi a métrica escolhida no `/specify` — `$addToSet` + `$size` a implementa direto, sem janela temporal nem decaimento. Excluir o que o solicitante já conhece é o comportamento de descoberta pedido (RF-016). Top-20 sem paginação (RF-017) evita cursor sobre ranking computado (que seria instável). `lastActivity` no desempate exige carregar `createdAt`/`finishedAt` máximo do grupo — barato no mesmo `$group`.

**Alternativas consideradas**:
- *Contar sessions (não leitores distintos)*: rejeitada no `/specify` — infla o ranking com releituras de uma pessoa só.
- *Janela de N dias / meia-vida*: rejeitada no `/specify` — mais parâmetros, comportamento menos previsível para o MVP.
- *Cursor sobre o ranking*: rejeitada — ranking computado muda a cada request; top-20 fixo é estável e suficiente para o estado inicial da busca.
- *Incluir livros só com want-to-read de seguidos (sem session)*: rejeitada — "popular" = quem está lendo/leu; want-to-read de terceiros não conta.

---

## D6 — `GET /me/reading-sessions`: filtro `status` + ordenação "reading antes de finished" com cursor estável

**Decisão**:
- Schema `listReadingSessionsSchema` ganha `status: z.enum(['reading', 'finished']).optional()`. Valor inválido → `ZodError` → `ValidationError` (400), já mapeado pela borda.
- `ReadingSessionRepository.listByUser` passa a aceitar `filter: { bookId?: string; status?: 'reading' | 'finished' }`.
- **Ordenação**: `sort({ status: -1, createdAt: -1, _id: -1 })`. Com `status: -1`, `'reading'` (lexicograficamente > `'finished'`) vem primeiro; dentro de cada grupo, `createdAt` desc, desempate `_id` desc. Comentário no código fixa a dependência da grafia do enum.
- **Cursor**: codec dedicado carregando `{ status, createdAt, id }` (novo campo `status`). Predicado keyset para "próxima página" sob `sort({ status: -1, createdAt: -1, _id: -1 })`:
  ```
  { $or: [
    { status: { $lt: cursor.status } },
    { status: cursor.status, createdAt: { $lt: cursor.createdAt } },
    { status: cursor.status, createdAt: cursor.createdAt, _id: { $lt: new ObjectId(cursor.id) } },
  ]}
  ```
  Quando `status` é filtrado, o primeiro ramo do `$or` nunca casa outro grupo (todos têm o mesmo `status`), então o mesmo predicado serve para os três casos (sem filtro, `status=reading`, `status=finished`).
- **Quebra de compatibilidade** (RF-027): cursores emitidos pela versão anterior (`{ createdAt, id }`, sem `status`) são rejeitados como cursor inválido (400). Documentado no `pagination-guide.md` e no `openapi.yaml`.

**Justificativa**: manter o cursor no formato opaco base64url+JSON já usado (`encodeCursor`/`decodeCursor`), só com um campo a mais, evita introduzir um segundo mecanismo de paginação. `sort({ status: -1 })` é a forma mais barata de agrupar sem `$addFields`/aggregation. O keyset de 3 chaves é o padrão já usado em `listByUser` (hoje com 2 chaves), estendido.

**Alternativas consideradas**:
- *`$addFields { statusRank: { $cond: ... } }` + sort por `statusRank`*: mais robusto a renomear o enum, mas força usar aggregation pipeline no lugar de `find().sort()` e complica o keyset; adiado — um comentário no código cobre o risco.
- *Duas queries (uma por grupo) concatenadas na aplicação*: rejeitada — quebra o `limit`+1 do keyset e a contagem de `hasMore` fica confusa na fronteira.
- *Widening do `CursorPayload` global*: rejeitada — `CursorPayload` é compartilhado com want-to-read e listas de follows; um codec local à reading-session isola a mudança.

---

## D7 — Índices novos: uma migration `migrate-mongo`

**Decisão**: uma migration nova, `NNNNNNNNNNNNNN-add-reading-contract-gaps-indexes.js`, criando:
- `reading_sessions`: `{ userId: 1, status: -1, createdAt: -1 }` — nome `reading_sessions_userId_status_createdAt` — serve a nova ordenação/keyset de `GET /me/reading-sessions`.
- `reading_sessions`: `{ bookId: 1, status: 1, userId: 1 }` — nome `reading_sessions_bookId_status_userId` — serve `findLatestFinishedPerUserForBook` e a agregação de populares.
- `reviews`: `{ bookId: 1, userId: 1 }` — nome `reviews_bookId_userId` — serve o batch de reviews por livro+seguidores.

`down()` derruba os três índices por nome. Nenhuma coleção nova, nenhum backfill.

**Justificativa**: P4 da constituição exige que **qualquer** criação/alteração de índice passe por migration versionada e reversível. As três queries novas filtram por combinações não cobertas pelos índices atuais (`reading_sessions` só tem `{userId,bookId}`, `{userId,createdAt}` e o parcial único; `reviews` só tem `{sessionId}` único e `{bookId}`). Sem esses índices as queries fazem collection scan conforme a base cresce.

**Alternativas consideradas**:
- *Não criar índice (confiar no volume pequeno do MVP)*: rejeitada — violaria a intenção de P4 (índice "no ar" é proibido; a ausência deliberada de índice para query de produção é dívida silenciosa) e o custo de escrever a migration é baixo.
- *Índice `{ bookId, status, finishedAt }` em vez de terminar em `userId`*: o `$group` por `userId` se beneficia mais de `userId` na chave; `finishedAt` entra no `$sort` pós-`$match` mas o volume por (book,status) é pequeno.

---

## D8 — Camada/pasta de cada peça nova (segue `architecture.md`)

**Decisão**:
| Peça | Caminho |
|---|---|
| Rota `GET /books/:olid/reviews` e `GET /books/popular-among-following` | `src/controllers/books/books.routes.ts` (adicionar as 2 linhas) |
| Handler | `src/controllers/books/list-book-reviews.controller.ts`, `src/controllers/books/list-popular-among-following.controller.ts` |
| Regra de negócio | `src/services/books/list-book-reviews.service.ts`, `src/services/books/list-popular-among-following.service.ts` |
| Schema zod (querystring) | `src/schemas/books/list-book-reviews.schema.ts` (`cursor?`, `limit`), `src/schemas/books/list-popular-among-following.schema.ts` (sem params ou só um `limit` fixo) |
| Alteração de `status` + ordenação | `src/schemas/reading-sessions/list-reading-sessions.schema.ts`, `src/services/reading-sessions/list-reading-sessions.service.ts`, `src/services/reading-sessions/to-dto.ts` (embutir `book`), `src/repositories/reading-sessions/*` |
| `pageCount` | `src/integrations/open-library/*`, `src/repositories/books/*`, `src/services/books/types.ts`, `src/services/books/get-book.service.ts`, `src/services/books/list-want-to-read.service.ts` |
| Cursor codec da reading-session | `src/lib/reading-session-cursor.ts` + export no `src/lib/index.ts` |
| Registro DI | `src/container/register-services.ts` (2 serviços novos com suas deps) |
| Migration | `migrations/` via `npx migrate-mongo create add-reading-contract-gaps-indexes` |
| Testes | `tests/integration/services/**`, `tests/integration/repositories/**` (regra de negócio, `mongodb-memory-server`); `tests/unit/schemas/**`, `tests/unit/lib/reading-session-cursor.spec.ts` (funções puras) |

**Justificativa**: `architecture.md` fixa "um arquivo por operação" em controller e service, sufixo por camada, `index.ts` por pasta de domínio, e a tabela "Onde cada tipo de código novo deve ir". Os dois endpoints novos são do domínio `books` (recurso sob `/books/...`, precisam de `resolveBook`). O cursor da reading-session vira função pura testável isoladamente, logo `src/lib/`.

**Alternativas consideradas**:
- *Serviço de reviews-por-livro no domínio `reviews`*: descartado — o recurso HTTP é `/books/{olid}/reviews`, o 404 é de livro, e o controller vive em `controllers/books/`. Manter serviço no mesmo domínio evita import cruzado controller(books)→service(reviews).

---

## Telas cobertas / divergências design↔spec

Não se aplica: o projeto **não tem** pasta `design/` e esta feature não tem UI (é backend + documentação). Passo de mapeamento de telas pulado, conforme o template do `/plan`.

## Nova dependência

Nenhuma. `@redocly/cli` (usada por `pnpm docs:lint`) já é devDependency (adicionada na feature 009). Nenhum pacote de runtime novo.
