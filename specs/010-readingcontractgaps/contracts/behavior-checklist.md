# Contrato — checklist de comportamento (RF → verificação)

Cada requisito funcional da spec mapeado para o teste (ou checagem de doc) que o comprova. Serve de base para o `/tasks` gerar tarefas TDD e para o `/implement` fechar a Definição de Pronto.

Legenda de tipo de teste (constituição): **INT** = integração com `mongodb-memory-server` (regra de negócio, sem mock de banco); **UNI** = unitário isolado (função pura); **DOC** = verificação em `docs/` + `redocly lint`.

## pageCount

| RF | Verificação | Tipo |
|---|---|---|
| RF-001 | `HttpOpenLibraryClient.toResult` mapeia `number_of_pages_median` → `pageCount`; `MongoBookRepository.upsertByOlid` grava `pageCount`; `findByOlid`/`findById` devolvem. | UNI (mapper) + INT (repo) |
| RF-002 | `getBook`, `searchBooks`, `listWantToRead`, `listPopularAmongFollowing` e o `book` embutido no histórico expõem `pageCount`. | INT (por serviço) |
| RF-003 | Open Library sem `number_of_pages_median` → `pageCount: null` em toda superfície. | UNI + INT |
| RF-004 | Livro pré-existente no cache sem `pageCount` → `BookRecord.pageCount === null`; após `upsertByOlid` com valor → passa a vir preenchido. Nenhuma migration de dados no diretório `migrations/` mexe em `books`. | INT + revisão de código |
| RF-005 | `updateProgress` aceita `currentPage` acima de `pageCount` sem erro (comportamento atual preservado). | INT |

## GET /books/{olid}/reviews

| RF | Verificação | Tipo |
|---|---|---|
| RF-006 | Rota autenticada; devolve página cursor das reviews do livro por seguidos aprovados. | INT (service) + INT (rota, se houver teste de rota) |
| RF-007 | Seguidor com 2 sessions `finished` c/ review do mesmo livro → só a review da session `finished` mais recente aparece. | INT |
| RF-008 | Review do próprio solicitante para o livro → ausente da lista. | INT |
| RF-009 | Review de usuário não-seguido / follow pendente / recusado → ausente. | INT (**cobre DoD P6**) |
| RF-010 | Item traz `author{userId,handle,displayName,avatarUrl}`, `rating`, `text`, `containsSpoiler`, `createdAt`; `avatarUrl` sempre `null`. | INT + UNI (to-dto) |
| RF-011 | Ordenação `createdAt` desc; paginação por cursor sem repetição nem omissão ao pedir a 2ª página. | INT |
| RF-012 | `olid` inexistente → 404 `BOOK_NOT_FOUND`; livro existe mas nenhum seguidor com review `finished` → `{items:[], nextCursor:null}`. | INT |

## GET /books/popular-among-following

| RF | Verificação | Tipo |
|---|---|---|
| RF-013 | Rota autenticada; devolve livros populares no círculo. | INT |
| RF-014 | Ranking por nº de `userId` **distintos** (seguidos aprovados) com qualquer session do livro; 2 seguidos no livro Y, 1 no Z → Y antes de Z. | INT |
| RF-015 | Empate de contagem → desempata por atividade mais recente, depois `title` asc. | INT |
| RF-016 | Livro que o solicitante já tem session **ou** want-to-read → excluído. | INT |
| RF-017 | Mais de 20 elegíveis → no máximo 20 itens; resposta sem `nextCursor`. | INT |
| RF-018 | Item no formato `BookSearchResult` com `pageCount`. | INT + UNI |
| RF-019 | Sem followees / followees sem session / todos já conhecidos → `{items:[]}`. | INT |
| RF-020 | Sessions de usuário não-seguido não entram no ranking. | INT (**cobre DoD P6**) |

## GET /me/reading-sessions — filtro/ordenação

| RF | Verificação | Tipo |
|---|---|---|
| RF-021 | `?status=reading` e `?status=finished` filtram no servidor. | INT + UNI (schema) |
| RF-022 | `?status=xpto` → 400 `VALIDATION_ERROR`. | UNI (schema) + INT (rota) |
| RF-023 | Sem `status`: todas as `reading` antes de todas as `finished`; cada grupo `createdAt` desc. | INT |
| RF-024 | Com `status`: `createdAt` desc dentro do grupo. | INT |
| RF-025 | Paginação por cursor atravessando a fronteira reading→finished: sem repetição nem omissão (dataset com N>limit em ambos os grupos). | INT |
| RF-026 | `?bookId=<id>&status=reading` aplica os dois. | INT |
| RF-027 | Cursor no formato antigo (`{createdAt,id}` sem `status`) → 400. `docs/pagination-guide.md` registra a quebra. | UNI (cursor codec) + DOC |

## GET /me/reading-sessions — book embutido

| RF | Verificação | Tipo |
|---|---|---|
| RF-028 | Cada item da listagem traz `book{title,authors,coverUrl,pageCount}`. | INT + UNI (to-dto) |
| RF-029 | `start-reading`, `progress`, `finish`, `edit`, `mark-finished` **não** trazem `book`. | INT (por operação) + DOC (contrato usa `ReadingSession`, não `ReadingSessionListItem`) |
| RF-030 | O `book` é resolvido em lote (1 query de books por página, não 1 por item). | INT (espionar chamadas ao repo) ou revisão de código |

## Documentação

| RF | Verificação | Tipo |
|---|---|---|
| RF-031 | `docs/openapi.yaml` cobre os 2 endpoints, `pageCount`, `status`, ordenação, `book`; `pnpm docs:lint` sem erro. | DOC |
| RF-032 | `docs/flows/reading-flow.md` e `docs/flows/review-flow.md` (e `pagination-guide.md`) atualizados. | DOC |

## Regressão (DoD)

| Item | Verificação |
|---|---|
| Sem regressão | Suíte existente (`pnpm test`) verde após as mudanças em `BookSearchResultDTO`, `listByUser`, `to-dto` de reading-sessions e OpenLibrary client. |
| Cursor do histórico | Os testes atuais de `listReadingSessions` que dependiam da ordenação `createdAt`-only são atualizados para a nova ordenação (esperado — RF-023/RF-027). |
