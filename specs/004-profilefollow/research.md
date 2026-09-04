# Fase 0 — Pesquisa: Profile & Follow

Feature: `004-profilefollow` · Data: 2026-09-04

A stack já está fixada em `.specify/memory/architecture.md` (Fastify + Awilix + driver
`mongodb` + zod + Vitest + migrate-mongo, `pnpm` na prática). Esta pesquisa resolve **como**
implementar perfil, busca de usuário e o grafo de follow dentro dessa stack, e fecha as
decisões de desenho que a spec deixou para o `/plan` (formato de rota, paginação, onde cada
endpoint mora entre os domínios existentes).

Nenhum `[NEEDS CLARIFICATION]` restou no Contexto Técnico do `plan.md` — a stack é 100%
herdada de `architecture.md`/`CLAUDE.md` (features 002/003).

---

## D1 — Perfil: estende `users`/`auth` em vez de criar um domínio de leitura próprio

**Decisão**: `GET /v1/me` já existe (feature 002, domínio `auth`, `getMeController`) e devolve
`request.currentUser` (`PublicUser`). Em vez de criar um segundo endpoint de leitura, esta
feature:
- adiciona `bio: string | null` a `UserRecord` (`src/repositories/users/user.repository.ts`)
  e a `PublicUser`/`toPublicUser` (`src/services/auth/types.ts`) — `GET /v1/me` passa a
  devolver `bio` automaticamente, sem tocar no controller/rota existente (RF-001);
- adiciona um domínio novo **`profile`** só para a escrita: `PATCH /v1/me`
  (`src/controllers/profile/`, `src/services/profile/edit-profile.service.ts`), que chama um
  método novo do `UserRepository` (`updateProfile`) (RF-002).

**Justificativa**: evita duplicar a leitura do próprio usuário (que já é testada e usada pelo
cliente desde a 002) e mantém o princípio de um arquivo por operação — a escrita é uma
operação nova, a leitura não é.

**Alternativas consideradas**: mover `GET /v1/me` inteiro para um novo domínio `profile`
(rejeitado — quebraria import/rota já estável da 002 sem necessidade); embutir `bio` só na
resposta do `PATCH` sem estender `GET /v1/me` (rejeitado — violaria RF-001, que exige `bio` na
leitura do próprio perfil).

---

## D2 — Busca de usuário: índice de texto do MongoDB (decisão de produto já travada)

**Decisão**: `db.users.createIndex({ displayName: 'text', handle: 'text' })` (migration
nova). `search-users.service.ts` roda `$text: { $search: q }` projetando `score` e ordenando
por ele. Query mínima de 2 caracteres (`q: z.string().trim().min(2).max(100)`), rejeitada com
`VALIDATION_ERROR` abaixo disso — evita varrer a coleção inteira com termo vazio/1 char
(caso de borda da spec).

**Justificativa**: `product.md` já trava essa escolha ("Busca de usuários: índice de texto do
MongoDB é suficiente no início"). Índice de texto dá relevância básica (título/handle) sem
depender de serviço externo de busca.

**Alternativas consideradas**: regex `^prefix` em `handle`/`displayName` (mais previsível para
autocomplete, mas não estava na decisão de produto e não ranqueia por relevância quando o
termo bate em `displayName` no meio da string); Atlas Search (fora de escopo — exige Atlas,
constituição não lista essa dependência).

---

## D3 — Paginação da busca de usuário: por página, não por cursor

**Decisão**: `GET /v1/users/search` devolve `{ items, page, limit, totalItems }` (mesmo
formato de `GET /v1/books/search`, D-books-003), não cursor.

**Justificativa**: resultado de busca por texto é ordenado por `score` (relevância), que não é
uma chave estável para cursor (`$or` com `score`/`_id` não é sustentado por um índice único
crescente como `createdAt`). `product.md` exige cursor "em toda lista que **cresce/muda**" —
busca por relevância não é uma lista que cresce, é uma consulta pontual, e o precedente já
existe em `books/search` (relevância do Open Library) usando página. Segue o mesmo precedente
para não introduzir dois formatos de paginação para o mesmo tipo de consulta (relevância).

Já `GET /v1/me/followers`, `GET /v1/me/following` e `GET /v1/me/follow-requests` **usam
cursor** (`src/lib/pagination.ts`, mesmo mecanismo de `want_to_read`/`reading_sessions`) —
são listas ordenadas por `createdAt` que crescem/mudam ao longo do tempo.

**Alternativas consideradas**: cursor opaco sobre `(score, _id)` (rejeitado — instável entre
requisições porque o texto pesquisado pode mudar de ranking com escrita concorrente, e o
próprio driver não garante ordenação estável de `score` empatado sem um segundo campo
monotônico confiável).

---

## D4 — Uma pessoa por request: `FollowRequest` e `Follow` como coleções separadas

**Decisão**: duas coleções, `follow_requests` (só pendentes — apagada ao resolver, RF-009/
RF-010/RF-012) e `follows` (só relações aprovadas, RF-010/RF-014/RF-015), cada uma com seu
próprio repository (`src/repositories/follow-requests/`, `src/repositories/follows/`),
seguindo o mesmo padrão de `shelf-memberships` ser uma coleção/repositório à parte de `books`.

**Justificativa**: bate com o glossário do `product.md`, que já separa "Follow" de "Follow
request" como conceitos distintos. Como um pedido recusado/cancelado é apagado (decisão da
spec, não fica histórico), não há necessidade de um campo `status` numa única coleção — a
existência do documento já é o estado. Simplifica os índices: `follow_requests` só precisa de
unicidade por par `(requesterId, targetId)`; `follows` só por par `(followerId, followeeId)`;
nenhuma das duas precisa de índice parcial por status.

**Alternativas consideradas**: uma coleção `follow_edges` com campo `status` (`pending` |
`approved`) (rejeitado — exigiria índice único parcial por status pendente, mais uma
migração de estado ao aprovar em vez de mover o documento entre coleções, e complica listar
"só pendentes recebidos" vs. "só aprovados" com o mesmo índice).

---

## D5 — Rotas do grafo de follow: identificadas pelo par `(eu, :userId)`, sem expor `requestId`

**Decisão**: como só pode existir **um** `FollowRequest` pendente por par ordenado
`(requester, target)` (RF-008) e **uma** `Follow` por par ordenado `(follower, followee)`, as
rotas de mutação usam `:userId` (o outro lado da relação) em vez de um id de recurso
intermediário:

- `POST   /v1/users/:userId/follow-request` — RF-005/RF-006/RF-007/RF-008 (eu → `:userId`)
- `DELETE /v1/users/:userId/follow-request` — RF-009, cancelar meu pedido pendente a `:userId`
- `POST   /v1/users/:userId/follow-request/approve` — RF-010/RF-011, aprovar pedido pendente
  de `:userId` para mim
- `POST   /v1/users/:userId/follow-request/reject` — RF-012/RF-013, recusar pedido pendente de
  `:userId` para mim
- `DELETE /v1/users/:userId/follow` — RF-014, eu deixo de seguir `:userId`
- `DELETE /v1/users/:userId/follower` — RF-015, eu removo `:userId` como meu seguidor

Todas exigem `app.authenticate` (RF-021) e resolvem o outro lado a partir do `:userId` da
rota + `request.currentUser.id`.

**Justificativa**: evita um endpoint de listagem só para descobrir o id de um pedido antes de
poder agir sobre ele — o cliente já sabe quem é `:userId` (veio da busca ou de uma lista). É
consistente com o resto da API (`want_to_read` é chaveado por `olid`, não por um id de
membership). `GET /v1/me/follow-requests` (abaixo, D6) continua existindo para exibir os
pedidos, mas nenhuma mutação depende de um id que só existe ali.

**Alternativas consideradas**: `POST /v1/follow-requests` + `PATCH /v1/follow-requests/:id`
(mais "recurso" no estilo REST clássico, mas obriga o cliente a listar antes de agir e expõe
um id que não aparece em nenhum outro lugar do domínio — rejeitado por complexidade extra sem
ganho, dado que o par é sempre único).

---

## D6 — Listagem de pedidos pendentes: necessária mesmo sem RF própria

**Decisão**: `GET /v1/me/follow-requests?direction=incoming|outgoing` (cursor, D3), listando
os `FollowRequest` onde eu sou `target` (`incoming`, default) ou `requester` (`outgoing`).

**Justificativa**: o cenário de aceitação 4 da spec ("pedido... visível para B como recebido e
para mim como enviado") exige uma forma de consultar pedidos pendentes — sem isso, RF-010/
RF-012 (aprovar/recusar) e RF-009 (cancelar) não têm como ser exercitados por um cliente real,
mesmo operando por `:userId` (D5) e não por id de pedido. Não havia um RF numerado
explicitamente para "listar pedidos" na spec; esta decisão preenche essa lacuna de
implementação sem contradizer nenhum requisito — é uma consequência direta do cenário 4.

**Alternativas consideradas**: nenhuma — sem listagem, o cenário 4 não é implementável.

---

## D7 — Posse de recurso: 404, nunca 403 (mesmo precedente da feature 003)

**Decisão**: `DELETE .../follow-request`, `.../approve`, `.../reject`, `DELETE .../follow`,
`DELETE .../follower` respondem `404 FOLLOW_REQUEST_NOT_FOUND`/`FOLLOW_NOT_FOUND` tanto quando
o recurso nunca existiu quanto quando existe mas não pertence ao par esperado (ex.: tentar
aprovar um pedido que não foi endereçado a mim). Mesmo padrão de
`READING_SESSION_NOT_FOUND` (D9 da 003): nunca confirma a um cliente que um recurso de
terceiro existe.

**Justificativa**: consistência de contrato de erro entre features; reduz a superfície de
enumeração (um cliente não descobre, pela diferença 403 vs. 404, se um pedido/relação existe
para outra pessoa).

**Alternativas consideradas**: `403 Forbidden` para "existe mas não é seu" (rejeitado pelo
mesmo motivo que a 003 rejeitou — vaza existência do recurso de terceiro).

---

## D8 — `displayName`/`bio`: mesma política de não-vazio do cadastro

**Decisão**: `displayName` no `PATCH /v1/me` usa o mesmo schema `zod` de não-vazio já usado no
signup (`z.string().trim().min(1).max(120)`, ajustando o max ao que já existe em
`signup.schema.ts`); `bio` é opcional, `z.string().trim().max(280).nullable()` (texto curto —
280 é um teto arbitrário mas explícito, alinhado ao "texto curto" do glossário de
`product.md`; pode ser revisto sem quebrar dado existente).

**Justificativa**: RF-002 exige rejeitar `displayName` vazio "mesmo requisito do cadastro" —
reaproveita a régua já validada em produção pela 002 em vez de inventar uma nova.

**Alternativas consideradas**: nenhuma — a spec já aponta a régua a seguir (caso de borda:
"mesmo requisito de não-vazio que vale no cadastro").

---

## D9 — Avatar: campo não existe ainda; busca devolve `null`

**Decisão**: `avatarUrl` não é persistido nem editável nesta feature (spec, esclarecimento
"Avatar entra no escopo?" → "Fica de fora"). `GET /v1/users/search` devolve `avatarUrl: null`
no DTO para já fixar o contrato de resposta que a P14 do `product.md` promete, sem quebrar o
cliente quando avatar for implementado depois (troca de `null` por string, não adição de
campo novo).

**Justificativa**: fixa o contrato do DTO desde já (evita um `PATCH` de contrato quando avatar
entrar) sem implementar upload/armazenamento agora, que é o que a spec deixou de fora.

**Alternativas consideradas**: omitir o campo `avatarUrl` totalmente do DTO agora (rejeitado —
forçaria mudança de contrato, não só de valor, quando avatar existir).
