# Contrato — checklist de comportamento (RF/RNF → verificação)

Cada requisito da spec mapeado para o teste (ou checagem de doc) que o comprova. Base para o `/tasks` gerar tarefas TDD e para o `/implement` fechar a Definição de Pronto.

Legenda: **INT** = integração com `mongodb-memory-server` (regra de negócio, sem mock de banco); **UNI** = unitário isolado (função pura / schema zod); **DOC** = verificação em `docs/` + `pnpm docs:lint`; **MIG** = migration + verificação `explain`.

## Definições compartilhadas

| RF | Verificação | Tipo |
|---|---|---|
| RF-001 | `followState`: `following` quando follow aprovado viewer→alvo; `pending` quando follow request pendente viewer→alvo e sem follow; `none` caso contrário. | INT (`get-user-profile`, `list-*` de follows/users) |
| RF-002 | `followsYou` true só com follow **aprovado** alvo→viewer; pedido pendente alvo→viewer → `followsYou: false`. | INT |
| RF-003 | Follow aprovado + (hipotético) request pendente no mesmo par → `followState: following`. | INT (`get-user-profile`) |

## D1 — `GET /users/{userId}`

| RF | Verificação | Tipo |
|---|---|---|
| RF-004 | Rota `GET /v1/users/:userId` autenticada; resolve `getUserProfileService`. | INT (service) + INT (rota, se houver padrão) |
| RF-005 | Resposta sempre com `id`,`handle`,`displayName`,`avatarUrl`; `avatarUrl` sempre `null`. | INT + UNI (mapper) |
| RF-006 | `bio` = texto real só com `followState: following`; `none`/`pending` → `bio: null` (cenários 1,2,3,4). | INT |
| RF-007 | `followState` e `followsYou` presentes e corretos nos 4 estados (cenários 1–4). | INT |
| RF-008 | `GET /users/{meuId}` → 200, `followState: none`, `followsYou: false`, `bio: null` (cenário 5). | INT |
| RF-009 | Resposta **não** contém nenhum contador. | INT (asserção de forma) + UNI |
| RF-010 | `userId` inexistente **e** `userId` malformado → `404 USER_NOT_FOUND`, mesmo corpo; nunca `403`/`400` (cenário 6). | INT |
| RF-011 | Sem Bearer → `401`. | INT (rota) |
| RF-012 | `follow-flow.md` deixa de afirmar que não existe endpoint de perfil de terceiro. | DOC |
| cenário 7 | Após rejeição do pedido (request apagado) → `followState: none`. | INT |

## D2 — `GET /users/{userId}/activity`

| RF | Verificação | Tipo |
|---|---|---|
| RF-013 | Rota `GET /v1/users/:userId/activity` autenticada, paginada por cursor. | INT |
| RF-014 | Autoriza só follow aprovado viewer→alvo ou viewer===alvo; não-seguidor / pendente / recusado / inexistente / malformado → `404 USER_NOT_FOUND` idêntico ao D1; nunca `403` (cenários 10,11,15). | INT (**cobre DoD P6**) |
| RF-015 | Cada item tem exatamente a forma de `FeedItem` de `GET /feed` (mesmo helper de hidratação); `id` do item usável como `activityId` (cenário 8). | INT + UNI (`toFeedItemDTO`) |
| RF-016 | Ordenação `createdAt` desc; cursor estável — 2ª página sem repetição nem omissão (dataset N>limit); `limit` 1..100 default 20 (cenário 9). | INT + UNI (schema) |
| RF-017 | Os 4 tipos aparecem; item `started_reading` presente com `reactionsCount: 0`/`hasReacted: false` (cenário 14). | INT |
| RF-018 | Item `review_published` reflete o texto/rating atual da review (editar review depois muda o item). | INT |
| RF-019 | Alvo acessível sem atividade → `{ items: [], nextCursor: null }` (cenário 13). | INT |
| RF-020 | `cursor`/`limit` malformado → `400 VALIDATION_ERROR`; sem Bearer → `401`. | UNI (schema) + INT (rota) |
| cenário 12 | `GET /users/{meuId}/activity` → 200 com a própria atividade. | INT |

## D3 — `GET /me/stats`

| RF | Verificação | Tipo |
|---|---|---|
| RF-021 | Rota `GET /v1/me/stats` autenticada; resolve `getMyStatsService`; retorna `MyStats`. | INT |
| RF-022 | `GET /me` continua sem contadores (nenhuma mudança no `getMeController`/resposta). | INT (regressão) + revisão de código |
| RF-023 | `booksRead` = nº de `bookId` distintos com ≥1 session `finished`; 2 sessions `finished` do mesmo livro → conta 1 (cenários 16,17). | INT |
| RF-023 | Só sessions `reading` → `booksRead: 0` (cenário 18). | INT |
| RF-024 | `followers`/`following` = follows aprovados nos dois sentidos (cenário 16). | INT |
| RF-025 | `pendingFollowRequests` conta só `targetId = eu`; 2 pedidos **enviados** por mim não entram (cenário 19). | INT |
| RF-026 | `wantToRead` = nº de shelf memberships do usuário. | INT |
| RF-027 | Todos os campos `integer >= 0`; usuário novo → tudo `0` (cenário 20); sem Bearer → `401` (cenário 21). | INT |

## D4 — `followState`/`followsYou` nos DTOs de lista

| RF | Verificação | Tipo |
|---|---|---|
| RF-028 | `UserSearchResult`, `FollowedUser` (followers+following), `FollowRequestItem` (incoming+outgoing) trazem `followState` e `followsYou` como campos soltos (cenários 22–26). | INT (um por endpoint) |
| RF-028 | `GET /me/following`: `followState` sempre `following`; `GET /me/followers`: `followsYou` sempre `true`; `follow-requests?direction=outgoing`: `followState` sempre `pending` (cenários 23,24,26). | INT |
| RF-028 | `follow-requests?direction=incoming`: `followsYou: false` enquanto não aprovado; `followState` reflete meu estado real (cenário 25). | INT |
| RF-029 | Resolução em lote: nº fixo de queries por página, independente de N (revisão de código: 2–3 `find` com `$in` + 0 loop de query por item) (cenário 27). | INT + revisão de código |
| RF-030 | `docs/openapi.yaml` cobre os 3 paths novos, `UserProfile`, `MyStats`, `UserNotFound`, +2 campos em 3 schemas, blocos `examples`; `pnpm docs:lint` sem erro novo. | DOC |
| RF-031 | `follow-flow.md` revoga a linha do "não existe perfil de fulano" e documenta D1–D4 + semântica de `followState`/`followsYou`; `feed-flow.md` menciona `GET /users/{userId}/activity` + regra de autorização. | DOC |
| RF-032 | `docs/error-catalog.md` registra `USER_NOT_FOUND` (404) como neutro. | DOC |
| cenário 28 | Campos adicionados não quebram consumo (adição retrocompatível); schema publicado passa a exigi-los. | DOC + revisão |

## Não funcionais

| RNF | Verificação | Tipo |
|---|---|---|
| RNF-001 | `explain` das queries: atividade por ator único usa `activities_actorId_createdAt`; `filterFollowing` usa `follows_followerId_followeeId_unique`; `filterFollowers` usa o índice novo `follows_followeeId_followerId`; `filterPendingTargets` usa `follow_requests_requesterId_targetId_unique`; contadores de D3 usam prefixo de índice existente. Nenhum `COLLSCAN`. | MIG + INT (`explain`) |
| RNF-002 | Diretório `migrations/` só ganha 1 migration, de **índice** (`follows_followeeId_followerId`); nenhuma mexe em documento. Nenhuma coleção nova. | Revisão de código |
| RNF-003 | Suítes `users`/`follows`/`feed` verdes; suíte completa verde. Únicos testes existentes ajustados: asserção de forma dos DTOs de lista de D4 + (possível) `get-feed.service.spec` se a extração do helper exigir. | INT (suíte completa) |

## Constituição

| Princípio | Verificação |
|---|---|
| Idioma inglês | Todos os identificadores/arquivos novos em inglês. |
| P1 testes por tipo | Serviços + métodos de repositório → INT; schemas zod + mapper → UNI; cobertura de regra de negócio ≥ 70%, caminho feliz + ≥1 erro por serviço novo. |
| P2 repositório | Nenhum `db.collection` fora de `src/repositories/**`. |
| P3 zod na borda | `getUserProfileSchema` (params), `listUserActivitySchema` (params+query) no controller antes do service; `/me/stats` sem entrada externa. |
| P4 migration | Índice `follows_followeeId_followerId` via `migrate-mongo`, com `down`. |
| P5 erros tipados | `UserNotFoundError extends AppError`; sem exceção crua do driver vazando. |
