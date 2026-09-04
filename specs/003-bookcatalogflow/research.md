# Fase 0 — Pesquisa: Books Flow

Feature: `003-bookcatalogflow` · Data: 2026-09-04

A stack já está fixada em `.specify/memory/architecture.md` (Fastify + Awilix + driver
`mongodb` + zod + Vitest + migrate-mongo, `pnpm` na prática — ver nota no plan.md). Esta
pesquisa resolve **como** implementar busca/cache/status de livros dentro dessa stack.
Nenhum `[NEEDS CLARIFICATION]` restou do Contexto Técnico — comportamento fixado pela spec +
esclarecimentos de 2026-09-04.

---

## D1 — Cliente Open Library: só a API de busca, reaproveitada também para lookup por chave

**Decisão**: um único port `OpenLibraryClient` com dois métodos, ambos sobre
`GET https://openlibrary.org/search.json`:

- `search(query, page, limit)` — busca livre por título/autor (`q=<query>`), usada por
  `GET /v1/books/search` (RF-001).
- `findByKey(olid)` — busca exata por identificador (`q=key:/works/<olid>`, `limit=1`),
  usada para resolver/cachear um livro pelo `olid` quando ele ainda não está no cache local
  (RF-003, RF-004).

Os dois métodos mapeiam a mesma forma de documento de resposta (`title`, `author_name`,
`cover_i`, `first_publish_year`, `isbn`, `key`) para `OpenLibrarySearchResult`. Nenhuma
chamada a `works/{id}.json` ou `authors/{id}.json` — esses endpoints têm formas de resposta
diferentes (autores só por referência) e não são necessários: `search.json` já devolve nome
do autor, ano e capa embutidos no mesmo documento.

**Justificativa**: uma única forma de resposta para mapear reduz a superfície de parsing e
elimina N+1 chamadas para resolver nome de autor. `q=key:...` é a forma documentada de buscar
um documento exato por chave na API de busca do Open Library.

**Alternativas consideradas**: `GET /works/{id}.json` + `GET /authors/{id}.json` por autor
(mais fiel aos dados "canônicos" da obra, mas N+1 chamadas e uma segunda forma de resposta
para mapear e testar — rejeitado pelo custo); indexação própria do catálogo via dump do Open
Library (fora de escopo do MVP, P2 do `product.md` já decidiu "Open Library + cache local"
via API, não dump).

---

## D2 — Transporte HTTP: `fetch` nativo do Node 24, sem dependência nova

**Decisão**: `HttpOpenLibraryClient` usa o `fetch` global do Node.js v24 com `AbortController`
para timeout (`OPEN_LIBRARY_TIMEOUT_MS`, default **5000 ms** — D10). Qualquer erro de rede,
abort por timeout, ou status HTTP ≥ 500 vira `OpenLibraryUnavailableError` (RF-002). Um
`numFound: 0` na resposta **não** é erro — é lista vazia (`search`) ou `null` (`findByKey`).

**Justificativa**: Node 24 já expõe `fetch`/`AbortController` nativamente — zero dependência
nova (a constituição exige justificar cada dependência nova, e aqui não há nenhuma). O volume
de chamadas (proxy simples de busca) não justifica um cliente HTTP dedicado (`undici`
custom, `got`, `axios`).

**Alternativas**: `undici` (já é a base do `fetch` nativo no Node — redundante); `axios`/`got`
(dependência nova sem necessidade — `fetch` + `AbortController` cobrem timeout e erro de rede).

---

## D3 — Identificador externo do livro nas rotas: `olid`, cache-on-read

**Decisão**: as rotas que operam sobre um livro específico usam o **OLID** (chave de obra do
Open Library, ex. `OL12345W`, extraída de `key` removendo o prefixo `/works/`) como parâmetro
de caminho (`/v1/books/:olid/...`) — não o `id` interno do Mongo. Em toda operação que
recebe um `olid`, o service resolve o `Book` local:

1. `bookRepository.findByOlid(olid)` — achou, usa o registro cacheado (nenhuma chamada
   externa).
2. Não achou → `openLibraryClient.findByKey(olid)`. Resultado `null` → `BookNotFoundError`
   (404). Falha de rede/timeout/5xx → `OpenLibraryUnavailableError` (503, RF-002). Achou →
   `bookRepository.upsertByOlid(...)` grava o cache (RF-003) e segue com o registro recém-criado.

A única exceção é **remover** `want_to_read` (`DELETE /books/:olid/want-to-read`): como não
existe membership sem o livro já ter sido cacheado antes, essa rota só consulta o cache local
(`findByOlid`) — se o livro nunca foi cacheado, não há nada a remover e a resposta é `204` sem
nenhuma chamada externa (RF-006, idempotência sem efeito colateral de rede).

O `Book` cacheado expõe tanto o `id` interno (usado como `bookId` em `ShelfMembership` e
`ReadingSession`, e como filtro em `GET /v1/me/reading-sessions?bookId=`) quanto o `olid`
(usado nas rotas).

**Justificativa**: o resultado de busca do Open Library só tem o `olid` como identificador
estável natural — ISBN pode não existir (livro sem edição catalogada) mas o `key`/OLID de obra
sempre existe. Rotear por `olid` evita o cliente precisar reenviar o payload inteiro da busca
para "abrir o detalhe" ou "marcar status": o servidor resolve/cacheia de forma independente
(RF-003), o que também cobre o caso de um `olid` conhecido de uma busca antiga que ainda não
virou `Book` local.

**Alternativas**: exigir que o cliente reenvie os metadados completos no corpo da requisição
ao marcar status pela primeira vez (acopla o contrato ao payload do Open Library, e duplica a
lógica de cache-on-read que o `GET /v1/books/:olid` já precisa ter de qualquer forma —
rejeitado); rotear por ISBN (rejeitado — nem todo resultado tem ISBN).

---

## D4 — Paginação: cursor opaco nas listas internas, `page`/`limit` na busca externa

**Decisão**: dois esquemas de paginação, conforme a origem dos dados:

- **Listas internas** (`GET /v1/me/want-to-read`, `GET /v1/me/reading-sessions`): cursor
  opaco `base64url(JSON.stringify({ createdAt: <ISO>, id: <hex> }))`, ordenado por
  `createdAt` decrescente. `limit` (query) default **20**, máx **100**. Resposta traz
  `nextCursor: string | null`. Mesmo formato-candidato já apontado em `product.md` ("Perguntas
  em aberto").
- **Busca externa** (`GET /v1/books/search`): `page` (default 1) + `limit` (default 20, máx
  50) repassados ao `search.json` do Open Library, que é paginado por offset/página, não por
  cursor. Resposta traz `page`, `limit`, `totalItems` (do `numFound` do Open Library).

**Justificativa**: a busca é um proxy sem estado de uma API externa que já é paginada por
página/offset — inventar um cursor sobre um recurso que não é nosso (não cresce/muda no nosso
banco) só adicionaria uma tradução sem ganho. As listas internas seguem a convenção de cursor
do `product.md` ("Implicações para a API") porque são coleções próprias que crescem/mudam.

**Alternativas**: cursor também na busca (rejeitado — a API de origem não expõe cursor, só
`offset`/`page`, então o cursor seria uma casca sobre um offset, sem ganho real); offset/página
também nas listas internas (rejeitado — contraria a convenção já registrada em `product.md`
para toda lista interna que cresce/muda).

---

## D5 — No máximo uma reading session `reading` por livro/usuário: índice único parcial

**Decisão**: índice único parcial em `reading_sessions` — `{ userId: 1, bookId: 1 }` com
`partialFilterExpression: { status: 'reading' }`. `ReadingSessionRepository.startReading`
tenta inserir; se o driver rejeitar por violação desse índice (`code 11000`), o repositório
**não propaga o erro** — busca e retorna a session `reading` já existente para aquele
`userId`+`bookId` (RF-009, "reaproveitada").

**Justificativa**: mesmo padrão já usado com sucesso na feature 002 (índice único +
tradução de `code 11000` no repositório, sem transação multi-documento) — resolve a corrida
de duas requisições simultâneas de "iniciar leitura" do mesmo livro de forma atômica no banco,
sem lock aplicativo.

**Alternativas**: checar no service (`findOpenSession` antes de inserir) sem índice único no
banco — vulnerável a corrida (duas requisições simultâneas passam pela checagem antes de
qualquer uma inserir); transação multi-documento (não necessária — um único `insertOne` com
índice parcial já é atômico).

---

## D6 — `want_to_read` idempotente: índice único + upsert

**Decisão**: índice único composto em `shelf_memberships` — `{ userId: 1, bookId: 1 }`.
`ShelfMembershipRepository.add` faz `updateOne(filter, { $setOnInsert }, { upsert: true })` —
marcar de novo é uma operação sem efeito (RF-005). `remove` é um `deleteOne` — apagar algo que
não existe não é erro (RF-006).

**Justificativa**: upsert com índice único é idempotente por construção, sem checagem prévia
(evita corrida de "marcar duas vezes ao mesmo tempo" criar duplicata).

---

## D7 — Remoção automática de `want_to_read` ao iniciar/finalizar leitura: melhor esforço, sem transação

**Decisão**: `start-reading.service.ts` e `mark-finished.service.ts` chamam
`shelfMembershipRepository.remove(userId, bookId)` **depois** de criar a reading session com
sucesso (RF-010). Não há transação multi-documento amarrando as duas escritas.

**Justificativa**: mesma decisão da 002 (D4, alternativa de transação rejeitada por exigir
replica set — fora de escopo). O pior cenário de uma falha entre as duas escritas é uma
entrada `want_to_read` remanescente para um livro que já tem reading session — inofensivo
(o próprio usuário pode remover manualmente) e não compromete nenhum outro dado.

**Alternativas**: transação multi-documento (rejeitada — mesma razão da 002); remover
`want_to_read` **antes** de criar a session (pior: se a criação falhar depois, perde-se a
marcação sem ganhar a session — o resultado atual, "criar primeiro, remover depois",
minimiza o dano de uma falha no meio).

---

## D8 — Cliente externo como port injetável (para não vazar rede nos testes de regra de negócio)

**Decisão**: `OpenLibraryClient` é uma **interface** (`src/integrations/open-library/`,
pasta transversal nova — mesma lógica de `src/auth/` da 002, fora da tabela de
`architecture.md` mas seguindo o mesmo padrão porta+adaptador) com implementação
`HttpOpenLibraryClient` (fetch real) injetada via Awilix. Os testes de **integração** dos
services que dependem dele (`get-book`, `mark-want-to-read`, `start-reading`,
`mark-finished`) usam uma `FakeOpenLibraryClient` (dublê determinístico em memória) no lugar
da implementação HTTP — o MongoDB, esse sim, continua real via `mongodb-memory-server` (a
constituição proíbe mockar o **banco**, não uma integração HTTP de terceiro).

**Justificativa**: a constituição (P1) exige regra de negócio testada contra Mongo real, não
contra a rede de um serviço externo — subir uma dependência de rede real em CI é frágil e
lento. Separar por interface é o mesmo princípio já aplicado a repositórios (P2):
regra de negócio depende de porta, nunca da implementação concreta.

**Alternativas**: mockar `fetch` global por teste (acopla o teste aos detalhes HTTP do
Open Library em vez do contrato do port — mais frágil a mudanças de implementação); chamar o
Open Library real em teste de integração (lento, instável em CI, viola o espírito de teste
determinístico).

---

## D9 — Erros de posse: session de outro usuário responde `404`, não `403`

**Decisão**: toda operação sobre uma `ReadingSession` existente (progresso, finalizar, editar,
apagar) verifica `session.userId === currentUser.id` no service; se não bater, lança
`ReadingSessionNotFoundError` (**404**), igual a quando o `sessionId` simplesmente não existe.

**Justificativa**: RF-020 fixa que todo endpoint desta feature só opera sobre o próprio
usuário — devolver `403` revelaria que o `sessionId` existe e pertence a outra pessoa
(vazamento de informação sobre dados privados de terceiros, o que contraria P6 do
`product.md`, "perfil totalmente privado por padrão"). `404` uniforme não distingue
"não existe" de "não é seu".

---

## D10 — Novas variáveis de ambiente

**Decisão**: estender `src/config/env.schema.ts` com:

| Var | Obrigatória | Default | Regra |
|---|---|---|---|
| `OPEN_LIBRARY_BASE_URL` | não | `https://openlibrary.org` | URL válida |
| `OPEN_LIBRARY_TIMEOUT_MS` | não | `5000` | int ≥ 100 (coerção de string) |

**Justificativa**: configurável por ambiente sem exigir presença (tem default sensato,
diferente de `ACCESS_TOKEN_SECRET` que é segredo obrigatório) — em teste de integração,
`OPEN_LIBRARY_BASE_URL` pode apontar para um stub HTTP local se algum teste quiser exercitar
`HttpOpenLibraryClient` de ponta a ponta (fora dos testes de service, que usam o fake — D8).

---

## D11 — Migrations das novas coleções (`migrate-mongo`)

**Decisão**: três migrations reversíveis (P4):

1. `create-books-collection` — `createCollection('books')`; índice **único** em `olid`;
   índice **único esparso** em `isbn13` (esparso porque nem todo livro tem ISBN-13). `down`:
   `drop`.
2. `create-shelf-memberships-collection` — `createCollection('shelf_memberships')`; índice
   **único composto** em `{ userId: 1, bookId: 1 }`. `down`: `drop`.
3. `create-reading-sessions-collection` — `createCollection('reading_sessions')`; índice
   **único parcial** em `{ userId: 1, bookId: 1 }` com `partialFilterExpression: { status:
   'reading' }` (D5); índice em `{ userId: 1, createdAt: -1 }` (paginação do histórico —
   D4); índice em `{ userId: 1, bookId: 1 }` (filtro por livro no histórico). `down`: `drop`.

**Justificativa**: uma migration por coleção, mesmo padrão da 002 — `down` granular.

---

## Telas de design

N/A — não existe pasta `design/` e a feature não tem UI (API HTTP).

## Impacto na constituição

Nenhuma decisão de design viola um princípio. Nenhuma dependência nova (D1/D2 usam `fetch`
nativo do Node 24). Ver "Verificação da Constituição" no `plan.md` (rodadas inicial e
pós-Fase 1).
