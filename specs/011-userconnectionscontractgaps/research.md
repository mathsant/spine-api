# Pesquisa — Fase 0 (`011-userconnectionscontractgaps`)

Decisões de design que dependeram de inspeção do código existente. Formato: Decisão / Justificativa / Alternativas consideradas.

---

## D1 — Erro `USER_NOT_FOUND`: novo tipo vs. reuso de `NOT_FOUND`

**Decisão**: criar `UserNotFoundError extends AppError` em `src/errors/user-not-found-error.ts`, código `USER_NOT_FOUND`, status `404`. Exportar em `src/errors/index.ts`.

**Justificativa**:
- O padrão do projeto para "recurso não encontrado / não visível" é um erro tipado dedicado por recurso: `BookNotFoundError`, `ReadingSessionNotFoundError`, `FollowNotFoundError`, `ActivityNotFoundError`, `ReviewNotFoundError`, `NotificationNotFoundError` — todos com código `*_NOT_FOUND`.
- `NotFoundError` (código genérico `NOT_FOUND`) hoje só é usado em `POST /users/{userId}/follow-request` quando o `:userId` não existe. Manter o genérico ali e usar `USER_NOT_FOUND` nas rotas novas é aceitável (o catálogo já lista os dois padrões); consolidar `NOT_FOUND` → `USER_NOT_FOUND` na rota de follow-request fica **fora do escopo** desta feature (mudaria contrato de outra rota).
- O `error-handler.ts` mapeia `instanceof AppError` genericamente — **nenhuma mudança no handler**.
- `MongoUserRepository.findById` já faz `if (!ObjectId.isValid(id)) return null` → um `userId` malformado vira `null` → o serviço lança `UserNotFoundError` → 404. RF-010 (malformado = neutro, não 400) sai de graça.

**Alternativas**:
- Reusar `NotFoundError` (`NOT_FOUND`): rejeitada — quebra a convenção `*_NOT_FOUND` por recurso e deixa o cliente sem um código específico para distinguir "usuário" de outros 404 genéricos.
- Validar o formato do `userId` no schema zod e devolver 400 quando malformado: rejeitada — viola P6 (vazaria que "esse id nunca poderia existir"); a spec fixou malformado = `404 USER_NOT_FOUND`.

---

## D2 — Reuso da máquina de feed: extrair helper de hidratação

**Decisão**: extrair o bloco de hidratação de `src/services/feed/get-feed.service.ts` (resolução em lote de actors/books/reviews/reaction-counts/reacted-set + `map(toFeedItemDTO)`) para `src/services/feed/hydrate-activities.ts`, exportando `hydrateActivities(page, deps) → FeedCursorPageDTO`. `makeGetFeed` passa a chamá-lo; `makeListUserActivity` (novo, em `src/services/users/`) também.

A query de atividade por ator único reusa `ActivityRepository.listForActors([targetId], cursor, limit)` **sem método novo** — `actorId: { $in: [targetId] }` é servido pelo índice existente `activities_actorId_createdAt` (`{ actorId: 1, createdAt: -1, _id: -1 }`).

O cursor é o mesmo opaco `{ createdAt, id }` de `GET /feed` (`encodeCursor`/`decodeCursor` de `src/lib`). O schema de querystring espelha `getFeedSchema` (`cursor` opcional, `limit` 1..100 default 20).

**Autorização** (RF-014): o serviço, antes de listar, resolve:
- se `input.userId === input.viewerId` → permitido (o próprio);
- senão `followRepository.exists(viewerId, targetId)` (follow **aprovado** do viewer para o alvo) → se `false`, lança `UserNotFoundError` (mesmo 404 neutro do D1). Um alvo inexistente também cai aqui: não há follow aprovado → 404. Não é preciso um `findById` extra.

**Justificativa**: `toFeedItemDTO` já é função pura compartilhada (`src/services/feed/to-dto.ts`); só a orquestração de lote estava presa dentro de `makeGetFeed`. Extrair evita ~35 linhas duplicadas e garante que os dois endpoints sirvam **exatamente** o mesmo formato de item (RF-015). Item `started_reading` aparece com `reactionsCount: 0`/`hasReacted: false` como no feed (RF-017); `review_published` reflete o estado atual da review (RF-018) — comportamento herdado do helper.

**Alternativas**:
- Duplicar a hidratação no serviço novo: rejeitada — dois pontos para manter em sincronia; risco de divergência silenciosa do formato de item.
- Método de repositório `listForActor(actorId, ...)` dedicado: rejeitada — `listForActors([id], ...)` já resolve e usa o mesmo índice; um método a mais sem ganho.
- Colocar `makeListUserActivity` em `src/services/feed/`: rejeitada — a operação pertence ao domínio `users` (rota `/users/:userId/activity`, erro `USER_NOT_FOUND`); ela **importa** de `services/feed` o helper, mantendo o fluxo de dependência limpo.

---

## D3 — `GET /me/stats`: domínio e definição operacional dos contadores

**Decisão**: rota no domínio **`profile`** (`src/controllers/profile/profile.routes.ts`, ao lado de `PATCH /me`), serviço `makeGetMyStats` em `src/services/profile/`. Tag OpenAPI `profile`. `GET /me` (domínio `auth`) permanece intocado (RF-022).

Definição operacional de cada campo (todos `integer >= 0`, resolvidos em paralelo):

| Campo | Fonte | Método de repositório | Índice que cobre |
|---|---|---|---|
| `booksRead` | nº de `bookId` **distintos** em `reading_sessions` com `{ userId, status: 'finished' }` | `ReadingSessionRepository.countDistinctFinishedBooks(userId)` (`collection.distinct('bookId', {...})` → `.length`) | `reading_sessions_userId_status_createdAt` (`{userId,status,createdAt}`) — prefixo `userId+status` |
| `followers` | `follows.countDocuments({ followeeId: userId })` | `FollowRepository.countFollowers(userId)` | `follows_followeeId_createdAt` — prefixo `followeeId` |
| `following` | `follows.countDocuments({ followerId: userId })` | `FollowRepository.countFollowing(userId)` | `follows_followerId_createdAt` — prefixo `followerId` |
| `pendingFollowRequests` | `follow_requests.countDocuments({ targetId: userId })` | `FollowRequestRepository.countIncoming(userId)` | `follow_requests_targetId_createdAt` — prefixo `targetId` |
| `wantToRead` | `shelf_memberships.countDocuments({ userId })` | `ShelfMembershipRepository.countForUser(userId)` | `shelf_memberships_userId_bookId_unique` — prefixo `userId` |

`booksRead` conta **livro distinto**, então duas sessions `finished` do mesmo `bookId` contam 1 (RF-023, cenário 17). `pendingFollowRequests` usa `targetId` (recebidos), nunca `requesterId` (RF-025, cenário 19).

**Justificativa**: contadores são derivados e podem mudar sozinhos (aprovar um pedido muda `pendingFollowRequests` e `followers`); mantê-los fora de `GET /me` deixa a sonda de identidade barata e permite à tela `my-profile` revalidar só os números — mesmo racional de `listNotifications` vs. `unread-count`. Todos os cinco `count`/`distinct` batem em prefixo de índice existente → **sem índice novo para D3**.

**Alternativas**:
- Ampliar `GET /me` com um objeto `counters`: rejeitada — encareceria toda chamada de contexto de auth; o front pediu explicitamente rota dedicada ou ampliação, e a rota dedicada é a escolha registrada na spec `004`.
- `booksRead` = nº de sessions `finished` (contando releitura N vezes): rejeitada — a spec define "livros distintos"; "N livros lidos" num perfil significa livros, não passadas.
- Domínio `auth` (junto de `GET /me`): rejeitada — `profile` já é o domínio de "dados do próprio perfil" (`PATCH /me`); `auth` é sessão/credencial.

---

## D4 — Cobertura de índice e resolução em lote de `followState`/`followsYou`

**Decisão**: um **único índice novo** — `follows { followeeId: 1, followerId: 1 }` (não único), por migration. Todo o resto é coberto por índice existente.

Resolução em lote (RF-029), para uma página com ids `[u1..uN]` e viewer `me`:

| Sinal | Query | Índice |
|---|---|---|
| `followState = following` (subconjunto de `[u1..uN]` que `me` segue aprovado) | `follows.find({ followerId: me, followeeId: { $in: ids } }, { projection: { followeeId: 1 } })` | `follows_followerId_followeeId_unique` (`{followerId,followeeId}`) — equality + `$in`, ambos no índice ✅ |
| `followState = pending` (subconjunto com pedido pendente de `me`) | `follow_requests.find({ requesterId: me, targetId: { $in: ids } }, { projection: { targetId: 1 } })` | `follow_requests_requesterId_targetId_unique` (`{requesterId,targetId}`) — equality + `$in` ✅ |
| `followsYou` (subconjunto que segue `me` aprovado) | `follows.find({ followeeId: me, followerId: { $in: ids } }, { projection: { followerId: 1 } })` | **novo** `follows { followeeId: 1, followerId: 1 }` — equality + `$in` ✅ |

O serviço monta dois `Set` (following, pending) e um `Set` (followsYou) e deriva cada item: `following` vence `pending` (RF-003); ausente dos dois → `none`.

Para **D1** (perfil único, N = 1) não há lote: o serviço chama `followRepository.exists(me, target)`, `followRepository.exists(target, me)` e `followRequestRepository.findByPair(me, target)` — todos já existentes, cobertos pelos índices `{followerId,followeeId}` e `{requesterId,targetId}`. `exists(target, me)` usa o índice `{followerId,followeeId}` (equality nos dois campos) — o índice novo não é necessário para D1, mas o serviço de D1 pode opcionalmente usar os mesmos helpers de lote com array de 1 elemento para não duplicar lógica; a decisão de implementação fica para o `/tasks`.

**Por que o índice novo**: sem ele, `followsYou` em lote (`followeeId: me` + `$in` em `followerId`) usaria `follows_followeeId_createdAt` — resolve a igualdade `followeeId: me` por índice, mas o `$in` em `followerId` vira filtro em memória sobre **todos os seguidores de `me`**. Para um usuário com muitos seguidores, cada página de busca/lista percorreria essa lista inteira. Não é collection scan (RNF-001 já estaria tecnicamente satisfeito), mas é O(seguidores do alvo) por página. O índice `{followeeId, followerId}` torna a query um index scan limitado a `min(N, matches)` e é simétrico ao `{followerId,followeeId}` unique já existente. Custo de escrita: `follows` é coleção de baixa escrita (um insert por follow aprovado); trade-off favorável.

**Contadores de D3**: todos batem em prefixo de índice existente (ver tabela em D3) → nenhum índice novo.

**Atividade por ator único (D2)**: `activities_actorId_createdAt` já cobre → nenhum índice novo.

**Alternativas**:
- Nenhum índice novo, aceitar o filtro em memória para `followsYou`: rejeitada — degrada linearmente com o nº de seguidores do alvo; a DoD (item 6) pede verificação de ausência de scan e o design deve ser são por construção, não "tecnicamente não é scan".
- Índice `follow_requests { targetId: 1, requesterId: 1 }` também: rejeitada — `followsYou`/`followState` não precisam de pedidos no sentido alvo→viewer (pedido pendente não conta como `followsYou`); nenhuma query desta feature usa esse padrão.
- Resolver `followState`/`followsYou` com uma agregação `$lookup` por página: rejeitada — mais complexa que 3 `find` com `$in`; o projeto favorece queries simples por repositório.

---

## D5 — `followState`/`followsYou` como campos soltos

**Decisão**: campos soltos no nível do item/DTO, **sem** objeto `viewer` aninhado. `followState: 'none' | 'pending' | 'following'`; `followsYou: boolean`. Adicionados a `UserProfileDTO` (D1) e aos itens de `UserSearchResultDTO`, `FollowedUserDTO`, `FollowRequestDTO` (D4).

**Justificativa**: `docs/viewer-block.md` documenta que o projeto **rejeitou** o bloco `viewer` genérico previsto no `product.md` — o único precedente de campo relativo ao espectador (`hasReacted`/`reactionsCount` em `FeedItem`) é campo solto. Seguir o que existe de fato.

**Alternativas**: objeto `viewer: { followState, followsYou }` — rejeitada por contradizer `viewer-block.md` e o precedente do feed.

---

## D6 — Schema zod para `GET /me/stats` (rota sem entrada)

**Decisão**: `GET /me/stats` não recebe path param, querystring nem body — só o Bearer token, já validado por `app.authenticate`. **Não criar** schema zod para essa rota; o controller resolve `request.currentUser` (lança `UnauthenticatedError` se ausente, como `getMeController`) e chama o serviço. Nenhuma violação de P3: não há entrada externa a validar.

`GET /users/{userId}` valida `params` (`{ userId: z.string().min(1) }`) — a checagem de existência/formato real é do repositório (`ObjectId.isValid` → 404 neutro), não do schema (P6). `GET /users/{userId}/activity` valida `params` + `query` (`cursor?`, `limit` coerção 1..100 default 20), espelhando `getFeedSchema`.

**Alternativas**: schema zod vazio (`z.object({})`) por consistência mecânica — rejeitada: nada a validar, adiciona ruído; `getMeController` já é o precedente de rota `/me/*` sem schema.

---

## Telas cobertas / divergências design ↔ spec

N/A — repositório é backend-only, sem `design/`. A feature de front-end `004-userconnections` (outro repositório) é a consumidora; o alinhamento de contrato foi feito e congelado com aquela sessão antes desta spec.
