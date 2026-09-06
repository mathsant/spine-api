# Tarefas: Lacunas de contrato de conexões/perfil para o front-end

**Entrada**: `plan.md`, `research.md`, `data-model.md`, `contracts/openapi-delta.md`, `contracts/behavior-checklist.md`, `quickstart.md` de `specs/011-userconnectionscontractgaps/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial. Caminhos e identificadores em inglês; descrição em português. Ordem TDD dentro de cada fase: o teste existe e falha antes da implementação que o cobre.

Tipos de teste (constituição): **INT** = integração com `mongodb-memory-server`; **UNI** = unitário isolado; **DOC** = `docs/` + `pnpm docs:lint`.

---

## Fases

- **Fase 1 — Fundação compartilhada**: peças que D1, D2 e D4 consomem — erro `USER_NOT_FOUND`, índice novo, helper de hidratação do feed extraído, métodos de repositório de relacionamento em lote e o helper `resolveRelationships`. Bloqueia as Fases 2, 3 e 5.
- **Fase 2 — D1: `GET /users/{userId}`**: perfil de uma pessoa. Depende da Fase 1 (erro + `resolveRelationships`).
- **Fase 3 — D2: `GET /users/{userId}/activity`**: atividade de uma pessoa. Depende da Fase 1 (erro + `hydrateActivities`).
- **Fase 4 — D3: `GET /me/stats`**: contadores do próprio usuário. Independente de D1/D2/D4 (só métodos de contagem próprios) — pode andar em paralelo às Fases 2/3/5.
- **Fase 5 — D4: `followState`/`followsYou` nas listas**: campos novos em `UserSearchResult`, `FollowedUser`, `FollowRequestItem` e ajuste dos 4 serviços de lista existentes. Depende da Fase 1 (`resolveRelationships`).
- **Fase 6 — Documentação e fechamento**: `openapi.yaml`, guias de fluxo, catálogo de erros, `docs:lint`, `explain` de índices, quickstart, regressão. Depende das Fases 2–5.

---

## Fase 1 — Fundação compartilhada

- [x] **T001** [P] Criar `UserNotFoundError extends AppError` (`USER_NOT_FOUND`, 404) em `src/errors/user-not-found-error.ts` e exportá-lo em `src/errors/index.ts`.
- [x] **T002** [P] Criar migration `migrations/<timestamp>-add-userconnections-followsYou-index.js` com `up` criando o índice `follows { followeeId: 1, followerId: 1 }` (`name: 'follows_followeeId_followerId'`, não único) e `down` com `dropIndex`.
- [x] **T003** [P] Adicionar o índice `follows_followeeId_followerId` ao helper de testes `tests/helpers/follow-indexes.ts` para que os testes INT que dependem dele não façam collection scan.
- [x] **T004** [P] UNI: teste de `toFeedItemDTO` cobrindo item `started_reading` (contadores zerados) e `review_published` (review viva) em `tests/unit/services/feed/to-dto.spec.ts` (criar se não existir) — protege o formato antes da extração.
- [x] **T005** Extrair a hidratação de `src/services/feed/get-feed.service.ts` para `src/services/feed/hydrate-activities.ts` (`hydrateActivities(page, deps) => FeedCursorPageDTO`), fazer `makeGetFeed` consumi-la, e exportá-la em `src/services/feed/index.ts`. Suíte `tests/integration/services/feed/get-feed.service.spec.ts` deve permanecer verde sem alteração de asserção.
- [x] **T006** [P] INT: testes dos métodos novos de `FollowRepository` em `tests/integration/repositories/follows/mongo-follow.repository.spec.ts` — `filterFollowing` / `filterFollowers` (subconjunto correto; `candidateIds` vazio → `[]` sem tocar o banco), `countFollowers` / `countFollowing`.
- [x] **T007** [P] INT: testes dos métodos novos de `FollowRequestRepository` em `tests/integration/repositories/follow-requests/mongo-follow-request.repository.spec.ts` — `filterPendingTargets` (subconjunto; vazio → `[]`), `countIncoming`.
- [x] **T008** Adicionar `filterFollowing`, `filterFollowers`, `countFollowers`, `countFollowing` à interface `src/repositories/follows/follow.repository.ts` e à implementação `src/repositories/follows/mongo-follow.repository.ts` (projeções mínimas; `$in` guardado contra array vazio). Reexportar tipos alterados em `src/repositories/follows/index.ts` se necessário.
- [x] **T009** Adicionar `filterPendingTargets` e `countIncoming` à interface `src/repositories/follow-requests/follow-request.repository.ts` e à implementação `src/repositories/follow-requests/mongo-follow-request.repository.ts`.
- [x] **T010** [P] INT: teste de `resolveRelationships` em `tests/integration/services/follows/resolve-relationships.spec.ts` — `following` vence `pending` no mesmo par; `followsYou` só com follow aprovado (pedido pendente alvo→viewer não conta); `candidateIds` vazio → `Map` vazio sem query; viewer presente em `candidateIds` → `none`/`false`.
- [x] **T011** Criar `src/services/follows/resolve-relationships.ts` — `resolveRelationships(viewerId, candidateIds, { followRepository, followRequestRepository }) => Promise<Map<string, { followState: 'none'|'pending'|'following'; followsYou: boolean }>>`, usando `filterFollowing` + `filterPendingTargets` + `filterFollowers` (3 queries, sem loop por item). Exportar em `src/services/follows/index.ts`.

---

## Fase 2 — D1: `GET /users/{userId}`

- [x] **T012** N/A — convenção do projeto: path param `:userId` não é validado por zod (só querystring/body); `request.params as { userId }` cru + `ObjectId.isValid` no repo faz o 404 neutro.
- [x] **T013** N/A — sem schema de params (ver T012); D1 não tem querystring.
- [x] **T014** INT: teste de `makeGetUserProfile` em `tests/integration/services/users/get-user-profile.service.spec.ts` — cenários 1–7 da spec: `bio` só com `followState: following`; os 4 estados de relacionamento; `GET` do próprio id (`none`/`false`/`bio` null); id inexistente **e** id malformado → `UserNotFoundError` (mesmo erro); pedido recusado → `followState: none`; resposta sem contadores.
- [x] **T015** Adicionar `UserProfileDTO` a `src/services/users/types.ts` e criar `src/services/users/get-user-profile.service.ts` (`makeGetUserProfile({ userRepository, followRepository, followRequestRepository })`): se `userId === viewerId` responde perfil próprio com `followState: 'none'`, `followsYou: false`, `bio: null`; senão `userRepository.findById` → `null`/inválido lança `UserNotFoundError`; `resolveRelationships(viewerId, [userId])` para `followState`/`followsYou`; `bio` só quando `followState === 'following'`; `avatarUrl` sempre `null`. Reexportar em `src/services/users/index.ts`.
- [x] **T016** Criar `src/controllers/users/get-user-profile.controller.ts` — valida `params` com `getUserProfileSchema`, exige `request.currentUser` (senão `UnauthenticatedError`), resolve `getUserProfileService`, responde 200. Reexportar em `src/controllers/users/index.ts`.
- [x] **T017** Registrar a rota `app.get('/users/:userId', { preHandler: app.authenticate }, getUserProfileController)` em `src/controllers/users/users.routes.ts` (antes de nenhuma rota conflitante — não colide com `POST /users/:userId/follow-request`).
- [x] **T018** Registrar `getUserProfileService` em `src/container/register-services.ts` (`asFunction` com `userRepository`, `followRepository`, `followRequestRepository`).
- [x] **T019** INT: teste de rota em `tests/integration/http/users.routes.spec.ts` — `GET /v1/users/:userId` sem Bearer → 401; id inexistente/malformado → 404 `USER_NOT_FOUND` (corpo idêntico); seguidor aprovado → 200 com `bio` preenchida e `followState: following`.

---

## Fase 3 — D2: `GET /users/{userId}/activity`

- [x] **T020** [P] UNI: teste de `listUserActivitySchema` em `tests/unit/schemas/users/list-user-activity.schema.spec.ts` — `params { userId }` obrigatório; `query` `cursor?` opcional, `limit` coerção inteiro 1..100 default 20; `limit` fora do intervalo → erro.
- [x] **T021** Criar `src/schemas/users/list-user-activity.schema.ts` (params + querystring espelhando `getFeedSchema`) e reexportar em `src/schemas/users/index.ts`.
- [x] **T022** INT: teste de `makeListUserActivity` em `tests/integration/services/users/list-user-activity.service.spec.ts` — cenários 8–15: seguidor aprovado recebe itens no formato `FeedItem`, `createdAt` desc; paginação por cursor sem repetição/omissão (dataset > limit); não-seguidor / pendente / recusado / inexistente / malformado → `UserNotFoundError`; viewer vê a própria atividade; alvo sem atividade → `{ items: [], nextCursor: null }`; item `started_reading` presente; follow desfeito → volta a `UserNotFoundError`.
- [x] **T023** Criar `src/services/users/list-user-activity.service.ts` (`makeListUserActivity({ activityRepository, followRepository, userRepository, bookRepository, reviewRepository, reactionRepository })`): autoriza (`userId === viewerId` OU `followRepository.exists(viewerId, userId)`), senão `UserNotFoundError`; `activityRepository.listForActors([userId], cursor, limit)`; `hydrateActivities(page, deps)` para o resultado. Reexportar em `src/services/users/index.ts`.
- [x] **T024** Criar `src/controllers/users/list-user-activity.controller.ts` — valida `params`+`query`, exige `request.currentUser`, resolve `listUserActivityService`, responde 200. Reexportar em `src/controllers/users/index.ts`.
- [x] **T025** Registrar `app.get('/users/:userId/activity', { preHandler: app.authenticate }, listUserActivityController)` em `src/controllers/users/users.routes.ts`.
- [x] **T026** Registrar `listUserActivityService` em `src/container/register-services.ts` (deps: `activityRepository`, `followRepository`, `userRepository`, `bookRepository`, `reviewRepository`, `reactionRepository`).
- [x] **T027** INT: teste de rota em `tests/integration/http/users.routes.spec.ts` — `GET /v1/users/:userId/activity` sem Bearer → 401; `cursor`/`limit` inválido → 400; não-seguidor → 404 `USER_NOT_FOUND`; seguidor aprovado → 200 `{ items, nextCursor }`.

---

## Fase 4 — D3: `GET /me/stats`

- [x] **T028** [P] INT: teste de `ReadingSessionRepository.countDistinctFinishedBooks` em `tests/integration/repositories/reading-sessions/mongo-reading-session.repository.spec.ts` — 2 sessions `finished` do mesmo `bookId` contam 1; sessions só `reading` → 0.
- [x] **T029** [P] INT: teste de `ShelfMembershipRepository.countForUser` em `tests/integration/repositories/shelf-memberships/mongo-shelf-membership.repository.spec.ts`.
- [x] **T030** Adicionar `countDistinctFinishedBooks(userId)` à interface `src/repositories/reading-sessions/reading-session.repository.ts` e à impl `src/repositories/reading-sessions/mongo-reading-session.repository.ts` (`distinct('bookId', { userId, status: 'finished' })` → `.length`).
- [x] **T031** Adicionar `countForUser(userId)` à interface `src/repositories/shelf-memberships/shelf-membership.repository.ts` e à impl `src/repositories/shelf-memberships/mongo-shelf-membership.repository.ts` (`countDocuments({ userId })`).
- [x] **T032** INT: teste de `makeGetMyStats` em `tests/integration/services/profile/get-my-stats.service.spec.ts` — cenários 16–21: valores corretos; releitura conta 1 em `booksRead`; só `reading` → `booksRead: 0`; pedidos **enviados** não entram em `pendingFollowRequests`; usuário novo → tudo `0`.
- [x] **T033** Adicionar `MyStatsDTO` a `src/services/profile/types.ts` (criar o arquivo se não existir) e criar `src/services/profile/get-my-stats.service.ts` (`makeGetMyStats({ readingSessionRepository, followRepository, followRequestRepository, shelfMembershipRepository })`) resolvendo os 5 contadores em `Promise.all`. Reexportar em `src/services/profile/index.ts`.
- [x] **T034** Criar `src/controllers/profile/get-my-stats.controller.ts` — exige `request.currentUser` (senão `UnauthenticatedError`), resolve `getMyStatsService`, responde 200 (sem schema zod — rota sem entrada externa, ver research D6). Reexportar em `src/controllers/profile/index.ts`.
- [x] **T035** Registrar `app.get('/me/stats', { preHandler: app.authenticate }, getMyStatsController)` em `src/controllers/profile/profile.routes.ts`.
- [x] **T036** Registrar `getMyStatsService` em `src/container/register-services.ts` (deps: `readingSessionRepository`, `followRepository`, `followRequestRepository`, `shelfMembershipRepository`).
- [x] **T037** INT: teste de rota em `tests/integration/http/profile.routes.spec.ts` — `GET /v1/me/stats` sem Bearer → 401; usuário com dados → 200 com os 5 campos `integer >= 0`.

---

## Fase 5 — D4: `followState`/`followsYou` nas listas

- [x] **T038** [P] INT: ajustar `tests/integration/services/users/search-users.service.spec.ts` — cada item traz `followState` (`following`/`pending`/`none` conforme relação) e `followsYou`; asserção do cenário 22.
- [x] **T039** [P] INT: ajustar `tests/integration/services/follows/list-following.service.spec.ts` — itens com `followState` sempre `following` e `followsYou` refletindo reciprocidade (cenário 23).
- [x] **T040** [P] INT: ajustar `tests/integration/services/follows/list-followers.service.spec.ts` — itens com `followsYou` sempre `true` e `followState` indicando follow de volta (cenário 24).
- [x] **T041** [P] INT: ajustar `tests/integration/services/follows/list-follow-requests.service.spec.ts` — `incoming`: `followsYou: false` enquanto não aprovado, `followState` real; `outgoing`: `followState` sempre `pending` (cenários 25, 26).
- [x] **T042** Acrescentar `followState` e `followsYou` a `UserSearchResultDTO` em `src/services/users/types.ts`; adicionar `viewerId` a `SearchUsersInput` em `src/services/users/search-users.service.ts` e preencher os campos via `resolveRelationships(viewerId, ids)` (lote único por página).
- [x] **T043** Passar `request.currentUser.id` como `viewerId` em `src/controllers/users/search-users.controller.ts` (exigir `request.currentUser`); `searchUsersSchema` permanece só com `q`/`page`/`limit`.
- [x] **T044** Acrescentar `followState` e `followsYou` a `FollowedUserDTO` e `FollowRequestDTO` em `src/services/follows/types.ts`.
- [x] **T045** Preencher `followState`/`followsYou` em `src/services/follows/list-following.service.ts` e `src/services/follows/list-followers.service.ts` via `resolveRelationships(userId, otherSideIds)` — uma resolução em lote por página, reaproveitando o `Promise.all` de `userRepository.findById` já existente.
- [x] **T046** Preencher `followState`/`followsYou` em `src/services/follows/list-follow-requests.service.ts` via `resolveRelationships(userId, otherSideIds)`.
- [x] **T047** Registrar `resolveRelationships` (ou suas deps) no wiring do container para os serviços afetados em `src/container/register-services.ts` — `searchUsersService`, `listFollowingService`, `listFollowersService`, `listFollowRequestsService` passam a receber `followRepository` e `followRequestRepository`.

---

## Fase 6 — Documentação e fechamento

- [x] **T048** DOC: aplicar o delta de `contracts/openapi-delta.md` em `docs/openapi.yaml` — 3 paths novos (`getUserProfile`, `listUserActivity`, `getMyStats`), `components.responses.UserNotFound`, schemas `UserProfile` e `MyStats`, `followState`/`followsYou` em `UserSearchResult`/`FollowedUser`/`FollowRequestItem` (em `properties` e `required`), blocos `examples`.
- [x] **T049** DOC: atualizar `docs/flows/follow-flow.md` — remover/revogar a frase "Não existe endpoint de 'ver perfil público de fulano' nesta API"; documentar D1 (`GET /users/{userId}`), D2 (`GET /users/{userId}/activity`), D3 (`GET /me/stats`), D4 (campos nas listas) e a semântica de `followState`/`followsYou`.
- [x] **T050** DOC: atualizar `docs/flows/feed-flow.md` — mencionar `GET /users/{userId}/activity` como a visão de atividade de uma única pessoa, com a regra de autorização por follow aprovado e o mesmo formato de item do feed.
- [x] **T051** DOC: registrar `USER_NOT_FOUND` (404) em `docs/error-catalog.md` — rotas `GET /users/{userId}` e `GET /users/{userId}/activity`; nota de que é neutro (não distingue inexistente de não-visível), nunca 403.
- [x] **T052** Rodar `pnpm docs:lint` e corrigir qualquer erro novo (2 warnings pré-existentes de `/health` toleráveis); conferir cruzamento rota↔schema da seção 5 do `openapi-delta.md`.
- [x] **T053** INT: verificação de índice (`explain`) — em teste ou script, confirmar `IXSCAN` (sem `COLLSCAN`) para: `listForActors([id])` (`activities_actorId_createdAt`), `filterFollowing` (`follows_followerId_followeeId_unique`), `filterFollowers` (`follows_followeeId_followerId`), `filterPendingTargets` (`follow_requests_requesterId_targetId_unique`), e os 5 `count`/`distinct` de `/me/stats`.
- [x] **T054** Rodar a suíte completa (`npm run test`) — suítes `users`, `follows`, `feed`, `profile` verdes; sem regressão; confirmar que os únicos testes existentes alterados são os de D4 (T038–T041) e, se necessário, `get-feed.service.spec.ts` pela extração do helper.
- [~] **T055** Parcial — quickstart manual não executado nesta sessão (exige servidor + Mongo locais). Os testes de rota `tests/integration/http/{users,profile}.routes.spec.ts` exercem os mesmos caminhos D1–D4 ponta a ponta via `app.inject`.
- [x] **T056** Fechar a Definição de Pronto da `spec.md` (marcar os 6 itens) e avisar a sessão de front-end `spine-front` de que `docs/openapi.yaml` está publicado com D1–D4.

---

## Dependências

- **Fase 1 bloqueia Fases 2, 3 e 5**: `UserNotFoundError` (T001) → T014/T015, T022/T023; `hydrateActivities` (T005) → T023; `resolveRelationships` (T011) → T015, T042, T045, T046. T011 depende de T008 e T009; T008/T009 depois de T006/T007 (TDD).
- **Fase 4 é independente** de D1/D2/D4 — só T030/T031 (repos próprios) e T028/T029 antes deles. Pode rodar em paralelo às Fases 2/3/5. T033 depende de T030/T031 e reusa `followRepository`/`followRequestRepository`/`shelfMembershipRepository` já no container.
- **Dentro de cada fase de endpoint**: schema (unit test → impl) → service (int test → impl) → controller → rota → container → teste de rota. Container (T018/T026/T036/T047) antes do teste de rota correspondente (T019/T027/T037).
- **T017 e T025 editam o mesmo arquivo** (`users.routes.ts`) → sequenciais, não `[P]`. Idem T016/T024 e `controllers/users/index.ts`; T015/T023/T042 e `services/users/types.ts` + `services/users/index.ts`.
- **T042–T047 editam arquivos que se sobrepõem** (`services/follows/types.ts`, `register-services.ts`) → sequenciais entre si; os testes T038–T041 são `[P]` (arquivos distintos) e vêm antes.
- **Fase 6 depende das Fases 2–5 completas**. T048 antes de T052. T054 depois de toda implementação. T056 por último.

## Exemplo de execução em paralelo

```
# Início da Fase 1 — arquivos independentes:
T001  src/errors/user-not-found-error.ts (+ index)
T002  migrations/<timestamp>-add-userconnections-followsYou-index.js
T003  tests/helpers/follow-indexes.ts
T004  tests/unit/services/feed/to-dto.spec.ts

# Testes de repositório da Fase 1 (após T005 não — são de repos, independentes de T005):
T006  tests/integration/repositories/follows/mongo-follow.repository.spec.ts
T007  tests/integration/repositories/follow-requests/mongo-follow-request.repository.spec.ts

# Testes de ajuste da Fase 5 (arquivos de teste distintos):
T038  tests/integration/services/users/search-users.service.spec.ts
T039  tests/integration/services/follows/list-following.service.spec.ts
T040  tests/integration/services/follows/list-followers.service.spec.ts
T041  tests/integration/services/follows/list-follow-requests.service.spec.ts
```

## Notas

- Commitar após cada tarefa concluída (ou por grupo coeso de TDD: teste + impl que o faz passar).
- Cada serviço novo (T015, T023, T033) precisa de caminho feliz + ≥1 caminho de erro em INT, cobertura de regra de negócio ≥ 70% (constituição P1).
- Nenhum `db.collection` fora de `src/repositories/**` (P2). Nenhum `createIndex` fora da migration (P4).
- `avatarUrl` sempre `null` — não inventar fonte de avatar.
- Sem dependência nova. Sem coleção nova. Sem migração de dados — só o índice de T002.
