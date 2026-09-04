# Tarefas: Profile & Follow — perfil próprio, busca de usuário e grafo de follow

**Entrada**: `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/004-profilefollow/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial (mesmo arquivo ou depende de outra tarefa).

Caminhos seguem a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`,
mais as 3 pastas de domínio novas (`profile`, `users`, `follows`) em `controllers`/`services`
justificadas no `plan.md`. Cada tarefa que cria arquivos numa pasta de domínio também
cria/atualiza o `index.ts` de re-export dessa pasta (exports nomeados, nunca `export default`).
`GET /v1/me` (feature 002) **não** é recriado — só ganha o campo `bio` por tabela (`toPublicUser`).

**Nota sobre índices nos testes de integração**: as migrations (T001–T003) **não** rodam sob
`mongodb-memory-server`. As assertivas que dependem de índice único (`follow_requests.
{requesterId,targetId}`, `follows.{followerId,followeeId}`) ou do índice de texto de `users`
usam os helpers `tests/helpers/auth-indexes.ts` (estendido, T016) e
`tests/helpers/follow-indexes.ts` (novo, T017) no `beforeAll`.

**Nota sobre posse (D7 do research.md)**: toda mutação sobre um par `(eu, :userId)` que não
encontra o registro esperado (`FollowRequest` pendente ou `Follow` aprovado) responde
`404` — nunca `403` — mesmo padrão de `ReadingSessionNotFoundError` na 003.

## Fases (cada uma é um marco entregável)

1. **Fundação** — as 3 migrations novas (2 coleções + 1 índice em `users`). Marco: `pnpm migrate:up` cria `follow_requests`/`follows` com os índices únicos certos e o índice de texto em `users`.
2. **Erros tipados e schemas de entrada** — 4 classes de erro que estendem `AppError` + os 4 schemas `zod` dos endpoints com corpo/querystring. Marco: `pnpm lint`/`pnpm build` limpos; qualquer `ZodError` já vira `400 VALIDATION_ERROR`.
3. **Camada de dados** — helpers de índice para teste + extensão do `UserRepository` (`updateProfile`/`search`) + `FollowRequestRepository`/`FollowRepository` novos (interface + impl Mongo), em ordem TDD. Marco: integração verde com `mongodb-memory-server`, incl. a idempotência de `create` de `FollowRequest` via índice único e a busca por texto.
4. **Perfil** — `edit-profile` (service, controller, rota, fiação, teste HTTP). Marco: `PATCH /v1/me` funcional ponta a ponta; `GET /v1/me` já devolve `bio`.
5. **Busca de usuário** — `search-users` (service, controller, rota, fiação, teste HTTP). Marco: `GET /v1/users/search` funcional ponta a ponta.
6. **Grafo de follow — pedir, aprovar, recusar, cancelar** — os 4 services do ciclo de `FollowRequest`, controllers e as 4 rotas correspondentes. Marco: o ciclo pedir→aprovar (ou recusar/cancelar) funciona ponta a ponta, sem reciprocidade automática.
7. **Grafo de follow — desfazer e listar** — os 5 services restantes (unfollow, remove-follower, e as 3 listagens), controllers, rotas e fiação final do container. Marco: `app.inject()` cobre os 12 cenários de aceitação da spec.
8. **Documentação e fechamento** — README, checagens estruturais e execução do `quickstart.md`. Marco: Definição de Pronto toda verificável.

---

## Fase 1: Fundação

- [x] T001 [P] Gerar via `pnpm migrate:create -- create-follow-requests-collection` e preencher: `up` cria a coleção `follow_requests`, `createIndex({ requesterId: 1, targetId: 1 }, { unique: true })` (RF-008), `createIndex({ targetId: 1, createdAt: -1 })` e `createIndex({ requesterId: 1, createdAt: -1 })` (D6); `down` faz `db.collection('follow_requests').drop()`. Arquivo: `migrations/20260904212220-create-follow-requests-collection.js`
- [x] T002 [P] Gerar via `pnpm migrate:create -- create-follows-collection` e preencher: `up` cria a coleção `follows`, `createIndex({ followerId: 1, followeeId: 1 }, { unique: true })` (RF-007), `createIndex({ followeeId: 1, createdAt: -1 })` (RF-018) e `createIndex({ followerId: 1, createdAt: -1 })` (RF-019); `down` dropa a coleção. Arquivo: `migrations/20260904212228-create-follows-collection.js`
- [x] T003 [P] Gerar via `pnpm migrate:create -- add-users-text-search-index` e preencher: `up` roda `createIndex({ displayName: 'text', handle: 'text' }, { name: 'users_displayName_handle_text' })` em `users` (D2); `down` roda `dropIndex('users_displayName_handle_text')`. Arquivo: `migrations/20260904212229-add-users-text-search-index.js`

## Fase 2: Erros tipados e schemas de entrada

- [x] T004 [P] Criar `CannotFollowSelfError extends AppError` (`code: 'CANNOT_FOLLOW_SELF'`, `statusCode: 422`). Arquivo: `src/errors/cannot-follow-self-error.ts`
- [x] T005 [P] Criar `AlreadyFollowingError extends AppError` (`code: 'ALREADY_FOLLOWING'`, `statusCode: 409`). Arquivo: `src/errors/already-following-error.ts`
- [x] T006 [P] Criar `FollowRequestNotFoundError extends AppError` (`code: 'FOLLOW_REQUEST_NOT_FOUND'`, `statusCode: 404`; usada tanto pra pedido inexistente quanto pra um que não pertence ao par esperado — D7). Arquivo: `src/errors/follow-request-not-found-error.ts`
- [x] T007 [P] Criar `FollowNotFoundError extends AppError` (`code: 'FOLLOW_NOT_FOUND'`, `statusCode: 404`; mesma nota D7). Arquivo: `src/errors/follow-not-found-error.ts`
- [x] T008 Atualizar o barrel de erros reexportando as 4 classes novas junto das existentes. Arquivo: `src/errors/index.ts` (depende de T004–T007)
- [x] T009 [P] Schema `zod` de `editProfile` (body) + teste unitário (TDD): `displayName` opcional (`trim`, `min 1`, `max 50` — mesma régua do signup, D8), `bio` opcional/nullable (`trim`, `max 280`), `.refine` exigindo ao menos 1 campo presente. Arquivos: `src/schemas/profile/edit-profile.schema.ts`, `tests/unit/schemas/profile/edit-profile.schema.spec.ts`
- [x] T010 Criar o barrel `src/schemas/profile/index.ts` reexportando o schema e o tipo inferido. Arquivo: `src/schemas/profile/index.ts` (depende de T009)
- [x] T011 [P] Schema `zod` de `searchUsers` (querystring) + teste unitário (TDD): `q` (`trim`, `min 2`, `max 100` — D2), `page` (int `>= 1`, default `1`), `limit` (int `1..50`, default `20`). Arquivos: `src/schemas/users/search-users.schema.ts`, `tests/unit/schemas/users/search-users.schema.spec.ts`
- [x] T012 Criar o barrel `src/schemas/users/index.ts` reexportando o schema e o tipo inferido. Arquivo: `src/schemas/users/index.ts` (depende de T011)
- [x] T013 [P] Schema `zod` de `listConnections` (querystring, reaproveitado por `list-followers` e `list-following` — mesma forma, D3): `cursor` opcional (string), `limit` (int `1..100`, default `20`) + teste unitário. Arquivos: `src/schemas/follows/list-connections.schema.ts`, `tests/unit/schemas/follows/list-connections.schema.spec.ts`
- [x] T014 [P] Schema `zod` de `listFollowRequests` (querystring) + teste unitário (TDD): `direction` (`enum(['incoming','outgoing'])`, default `'incoming'`), `cursor` opcional, `limit` (int `1..100`, default `20`, D6). Arquivos: `src/schemas/follows/list-follow-requests.schema.ts`, `tests/unit/schemas/follows/list-follow-requests.schema.spec.ts`
- [x] T015 Criar o barrel `src/schemas/follows/index.ts` reexportando os 2 schemas e os tipos inferidos. Arquivo: `src/schemas/follows/index.ts` (depende de T013, T014)

## Fase 3: Camada de dados (TDD)

- [x] T016 [P] Estender `ensureAuthIndexes` com o índice de texto `{ displayName: 'text', handle: 'text' }` em `users` (mesma forma da migration T003). Arquivo: `tests/helpers/auth-indexes.ts` (depende de T003)
- [x] T017 [P] Criar `ensureFollowIndexes(db: Db): Promise<void>` aplicando, sobre um `Db` em memória, os mesmos índices de `follow_requests`/`follows` das migrations T001/T002. Arquivo: `tests/helpers/follow-indexes.ts` (depende de T001, T002)
- [x] T018 [P] Estender o teste de integração de `MongoUserRepository` (TDD, com T016 no `beforeAll`): `updateProfile` atualiza só as chaves presentes no `patch` (`displayName` e/ou `bio`) + `updatedAt`, sem tocar `email`/`handle`/`passwordHash`; `search` via `$text` acha por `displayName` e por `handle`, ordenado por relevância (`textScore`), pagina por `page`/`limit` com `totalItems` correto; termo sem correspondência → `items: []`. Arquivo: `tests/integration/repositories/users/mongo-user.repository.spec.ts` (depende de T016)
- [x] T019 Estender a interface `UserRepository`: adicionar `bio: string | null` a `UserRecord` (RF-001/RF-002, D1 do `research.md`) e os tipos/métodos `UpdateProfileInput`, `UserSearchResult`, `UserSearchPage`, `updateProfile`, `search` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/users/user.repository.ts`
- [x] T020 Estender `MongoUserRepository`: adicionar `bio` a `UserDocument`/`toRecord` (documentos existentes sem o campo lêem como `null`); `updateProfile` = `updateOne({ _id }, { $set: { ...patch, updatedAt: now } })` seguido de `findOne`; `search` = `find({ $text: { $search: query } }, { projection: { score: { $meta: 'textScore' } } }).sort({ score: { $meta: 'textScore' } }).skip((page-1)*limit).limit(limit)` + `countDocuments({ $text: { $search: query } })` pra `totalItems`. Arquivo: `src/repositories/users/mongo-user.repository.ts` (depende de T019; faz T018 passar)
- [x] T019a [P] Estender `PublicUser`/`toPublicUser` com `bio: string | null`, pra `GET /v1/me` (feature 002) passar a devolver o campo (RF-001, D1 do `research.md`). Arquivo: `src/services/auth/types.ts` (depende de T019)
- [x] T019b Atualizar as asserções `toEqual(...)` de `PublicUser` em `tests/integration/services/auth/signup.service.spec.ts` (linha ~42) e `tests/integration/services/auth/authenticate.service.spec.ts` (linha ~47), feature 002, incluindo `bio: null` — sem isso, `toEqual` (igualdade exata) quebra assim que `bio` existir (regressão que a Definição de Pronto proíbe). Arquivos: `tests/integration/services/auth/signup.service.spec.ts`, `tests/integration/services/auth/authenticate.service.spec.ts` (depende de T019a)
- [x] T021 Estender o barrel `src/repositories/users/index.ts` reexportando os 3 tipos novos (`UpdateProfileInput`, `UserSearchResult`, `UserSearchPage`). Arquivo: `src/repositories/users/index.ts` (depende de T019)
- [x] T022 [P] Teste de integração de `MongoFollowRequestRepository` (TDD, com `ensureFollowIndexes` no `beforeAll`): `create` insere um pedido; `create` de novo pro mesmo par `(requesterId, targetId)` → **não** lança, devolve o pedido já existente (RF-008, mesmo padrão de `startReading` na 003); `findByPair` acha/`null`; `deleteByPair` remove e devolve o registro removido, `null` se não achou; `listByTarget`/`listByRequester` paginam por cursor (`createdAt` desc). Arquivo: `tests/integration/repositories/follow-requests/mongo-follow-request.repository.spec.ts` (depende de T017)
- [x] T023 Criar a interface `FollowRequestRepository` e o tipo `FollowRequestRecord` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/follow-requests/follow-request.repository.ts`
- [x] T024 Criar `MongoFollowRequestRepository implements FollowRequestRepository` recebendo `db: Db`: `create` tenta `insertOne`; captura `code 11000` do índice único e busca+retorna o pedido existente em vez de propagar; `deleteByPair`/`listByTarget`/`listByRequester` usam `src/lib` para o cursor. Arquivo: `src/repositories/follow-requests/mongo-follow-request.repository.ts` (depende de T023; faz T022 passar)
- [x] T025 Criar o barrel `src/repositories/follow-requests/index.ts` reexportando a interface, o tipo e `MongoFollowRequestRepository`. Arquivo: `src/repositories/follow-requests/index.ts` (depende de T023, T024)
- [x] T026 [P] Teste de integração de `MongoFollowRepository` (TDD, com `ensureFollowIndexes` no `beforeAll`): `create` insere; `exists` devolve `true`/`false`; `deleteByPair` remove e devolve `null` se não achou; `listByFollowee`/`listByFollower` paginam por cursor (`createdAt` desc). Arquivo: `tests/integration/repositories/follows/mongo-follow.repository.spec.ts` (depende de T017)
- [x] T027 Criar a interface `FollowRepository` e o tipo `FollowRecord` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/follows/follow.repository.ts`
- [x] T028 Criar `MongoFollowRepository implements FollowRepository` recebendo `db: Db`. Arquivo: `src/repositories/follows/mongo-follow.repository.ts` (depende de T027; faz T026 passar)
- [x] T029 Criar o barrel `src/repositories/follows/index.ts` reexportando a interface, o tipo e `MongoFollowRepository`. Arquivo: `src/repositories/follows/index.ts` (depende de T027, T028)

## Fase 4: Perfil

- [x] T030 Criar `ProfileDTO` em `src/services/profile/types.ts` conforme `data-model.md`.
- [x] T031 [P] Teste de integração de `edit-profile.service` (TDD): atualiza `displayName`/`bio`; atualização parcial (só `bio`) preserva o `displayName` atual; `handle` nunca é aceito (não existe no tipo de input). Arquivo: `tests/integration/services/profile/edit-profile.service.spec.ts` (depende de T020)
- [x] T032 Criar `makeEditProfile({ userRepository, clock }): EditProfile` conforme `contracts/internal-ports.md`. Arquivo: `src/services/profile/edit-profile.service.ts` (depende de T019, T030; faz T031 passar)
- [x] T033 Criar o barrel `src/services/profile/index.ts` reexportando `makeEditProfile`, o tipo de função e `ProfileDTO`. Arquivo: `src/services/profile/index.ts` (depende de T032)
- [x] T034 Registrar `editProfileService` (`asFunction`, singleton) no registro de services e estender `AppCradle` com o tipo. Arquivos: `src/container/register-services.ts`, `src/container/cradle.ts` (depende de T032)
- [x] T035 [P] Criar `edit-profile.controller.ts`: valida o corpo com `editProfileSchema`, usa `request.currentUser.id`, resolve `editProfileService`, responde `200`. Arquivo: `src/controllers/profile/edit-profile.controller.ts` (depende de T009, T032)
- [x] T036 Criar o plugin de rotas do domínio `profile`: `PATCH /me` com `preHandler: app.authenticate` (RF-021). Arquivo: `src/controllers/profile/profile.routes.ts` (depende de T035)
- [x] T037 Criar o barrel `src/controllers/profile/index.ts` reexportando `profileRoutes` e `editProfileController`. Arquivo: `src/controllers/profile/index.ts` (depende de T035, T036)
- [x] T038 Registrar `profileRoutes` em `buildApp` sob `{ prefix: '/v1' }` (importado do barrel `./controllers/profile`, mesma convenção de `booksRoutes`/`readingSessionsRoutes` em `src/app.ts`). Arquivo: `src/app.ts` (depende de T037, T034)
- [x] T039 [P] Teste de integração de rotas via `buildApp` + `app.inject()` (TDD — escrito antes de T038 fazer passar) cobrindo os cenários 1–2 e os casos de borda de perfil: `GET /v1/me` devolve `bio` (`null` por padrão); `PATCH /v1/me` atualiza `displayName`/`bio` (`200`); corpo com `handle` → `400` (campo não aceito pelo schema); `displayName` vazio → `400`; sem `Authorization` → `401`. Arquivo: `tests/integration/http/profile.routes.spec.ts` (depende de T038, T019a)

## Fase 5: Busca de usuário

- [x] T040 Criar `UserSearchResultDTO`/`UserSearchPageDTO` em `src/services/users/types.ts` conforme `data-model.md` (D9 — `avatarUrl: null`).
- [x] T041 [P] Teste de integração de `search-users.service` (TDD): delega a `userRepository.search`; monta `avatarUrl: null` em cada item (D9); `page`/`limit`/`totalItems` repassados do repositório. Arquivo: `tests/integration/services/users/search-users.service.spec.ts` (depende de T020)
- [x] T042 Criar `makeSearchUsers({ userRepository }): SearchUsers` conforme `contracts/internal-ports.md`. Arquivo: `src/services/users/search-users.service.ts` (depende de T019, T040; faz T041 passar)
- [x] T043 Criar o barrel `src/services/users/index.ts` reexportando `makeSearchUsers`, o tipo de função e os DTOs. Arquivo: `src/services/users/index.ts` (depende de T042)
- [x] T044 Registrar `searchUsersService` no registro de services e estender `AppCradle`. Arquivos: `src/container/register-services.ts`, `src/container/cradle.ts` (depende de T042; sequencial com T034, mesmos arquivos)
- [x] T045 [P] Criar `search-users.controller.ts`: valida a querystring com `searchUsersSchema`, resolve `searchUsersService`, responde `200`. Arquivo: `src/controllers/users/search-users.controller.ts` (depende de T011, T042)
- [x] T046 Criar o plugin de rotas do domínio `users`: `GET /users/search` com `preHandler: app.authenticate`. Arquivo: `src/controllers/users/users.routes.ts` (depende de T045)
- [x] T047 Criar o barrel `src/controllers/users/index.ts` reexportando `usersRoutes` e `searchUsersController`. Arquivo: `src/controllers/users/index.ts` (depende de T045, T046)
- [x] T048 Registrar `usersRoutes` em `buildApp` sob `{ prefix: '/v1' }` (importado do barrel `./controllers/users`). Arquivo: `src/app.ts` (depende de T047; sequencial com T038, mesmo arquivo)
- [x] T049 [P] Teste de integração de rotas cobrindo o cenário 3 e os casos de borda de busca: `q` válido → `200` com `avatarUrl: null` em cada item; `q` com 1 caractere → `400`; sem `q` → `400`; sem `Authorization` → `401`. Arquivo: `tests/integration/http/users.routes.spec.ts` (depende de T048)

## Fase 6: Grafo de follow — pedir, aprovar, recusar, cancelar

- [x] T050 Criar os DTOs de resposta do domínio `follows` em `src/services/follows/types.ts` conforme `data-model.md` (`FollowRequestDTO`, `FollowRequestCreationDTO`, `FollowRequestCursorPageDTO`, `FollowedUserDTO`, `FollowCursorPageDTO`).
- [x] T051 [P] Teste de integração de `send-follow-request.service` (TDD): cria pedido novo (`created: true`); pedido para o mesmo par de novo → devolve o existente (`created: false`, RF-008); `requesterId === targetId` → `CannotFollowSelfError`; `targetId` inexistente → `NotFoundError`; já existe `Follow` aprovado do remetente pro alvo → `AlreadyFollowingError`. Arquivo: `tests/integration/services/follows/send-follow-request.service.spec.ts` (depende de T024, T028, T004, T005)
- [x] T052 Criar `makeSendFollowRequest({ userRepository, followRepository, followRequestRepository, clock }): SendFollowRequest` conforme `contracts/internal-ports.md`. Arquivo: `src/services/follows/send-follow-request.service.ts` (depende de T019, T023, T027, T050; faz T051 passar)
- [x] T053 [P] Teste de integração de `cancel-follow-request.service` (TDD): cancela um pedido pendente meu; par sem pedido pendente (inexistente ou já resolvido) → `FollowRequestNotFoundError`. Arquivo: `tests/integration/services/follows/cancel-follow-request.service.spec.ts` (depende de T024, T006)
- [x] T054 Criar `makeCancelFollowRequest({ followRequestRepository }): CancelFollowRequest`. Arquivo: `src/services/follows/cancel-follow-request.service.ts` (depende de T023; faz T053 passar)
- [x] T055 [P] Teste de integração de `approve-follow-request.service` (TDD): aprova um pedido pendente recebido — cria `Follow` (requester → target) e apaga o `FollowRequest`; **não** cria a relação inversa (RF-011); par sem pedido pendente → `FollowRequestNotFoundError`. Arquivo: `tests/integration/services/follows/approve-follow-request.service.spec.ts` (depende de T024, T028, T006)
- [x] T056 Criar `makeApproveFollowRequest({ followRequestRepository, followRepository, clock }): ApproveFollowRequest`. Arquivo: `src/services/follows/approve-follow-request.service.ts` (depende de T023, T027; faz T055 passar)
- [x] T057 [P] Teste de integração de `reject-follow-request.service` (TDD): recusa apaga o `FollowRequest` sem criar `Follow`; par sem pedido pendente → `FollowRequestNotFoundError`. Arquivo: `tests/integration/services/follows/reject-follow-request.service.spec.ts` (depende de T024, T006)
- [x] T058 Criar `makeRejectFollowRequest({ followRequestRepository }): RejectFollowRequest`. Arquivo: `src/services/follows/reject-follow-request.service.ts` (depende de T023; faz T057 passar)
- [x] T059 Registrar `followRequestRepository`/`followRepository` no registro de repositories, `sendFollowRequestService`/`cancelFollowRequestService`/`approveFollowRequestService`/`rejectFollowRequestService` no registro de services, e estender `AppCradle` com os 6 tipos novos. Arquivos: `src/container/register-repositories.ts`, `src/container/register-services.ts`, `src/container/cradle.ts` (depende de T024, T028, T052, T054, T056, T058; sequencial com T044, mesmos 2 últimos arquivos)
- [x] T060 [P] Criar `send-follow-request.controller.ts`: usa `request.currentUser.id` + param `userId`, resolve `sendFollowRequestService`, responde `201` se `created`, senão `200`. Arquivo: `src/controllers/follows/send-follow-request.controller.ts` (depende de T052)
- [x] T061 [P] Criar `cancel-follow-request.controller.ts`: resolve `cancelFollowRequestService`, responde `204`. Arquivo: `src/controllers/follows/cancel-follow-request.controller.ts` (depende de T054)
- [x] T062 [P] Criar `approve-follow-request.controller.ts`: resolve `approveFollowRequestService`, responde `204`. Arquivo: `src/controllers/follows/approve-follow-request.controller.ts` (depende de T056)
- [x] T063 [P] Criar `reject-follow-request.controller.ts`: resolve `rejectFollowRequestService`, responde `204`. Arquivo: `src/controllers/follows/reject-follow-request.controller.ts` (depende de T058)
- [x] T064 Criar o plugin de rotas do domínio `follows` com as 4 rotas do ciclo de pedido: `POST`/`DELETE /users/:userId/follow-request`, `POST /users/:userId/follow-request/approve`, `POST /users/:userId/follow-request/reject` — todas com `preHandler: app.authenticate`. Arquivo: `src/controllers/follows/follows.routes.ts` (depende de T060–T063)
- [x] T064a Criar o barrel `src/controllers/follows/index.ts` reexportando `followsRoutes` e os 4 controllers do ciclo de pedido (`sendFollowRequestController`, `cancelFollowRequestController`, `approveFollowRequestController`, `rejectFollowRequestController`) — necessário pra `app.ts` importar `followsRoutes` (mesma convenção de `./controllers/books`). Arquivo: `src/controllers/follows/index.ts` (depende de T060–T064)
- [x] T065 Registrar `followsRoutes` em `buildApp` sob `{ prefix: '/v1' }` (importado do barrel `./controllers/follows`). Arquivo: `src/app.ts` (depende de T064a; sequencial com T048, mesmo arquivo)

## Fase 7: Grafo de follow — desfazer e listar

- [x] T066 [P] Teste de integração de `unfollow.service` (TDD): remove uma `Follow` existente (`followerId = eu`); par sem relação aprovada → `FollowNotFoundError`. Arquivo: `tests/integration/services/follows/unfollow.service.spec.ts` (depende de T028, T007)
- [x] T067 Criar `makeUnfollow({ followRepository }): Unfollow`. Arquivo: `src/services/follows/unfollow.service.ts` (depende de T027; faz T066 passar)
- [x] T068 [P] Teste de integração de `remove-follower.service` (TDD): remove uma `Follow` na direção oposta (`followerId = :userId`, `followeeId = eu`); par sem relação → `FollowNotFoundError`. Arquivo: `tests/integration/services/follows/remove-follower.service.spec.ts` (depende de T028, T007)
- [x] T069 Criar `makeRemoveFollower({ followRepository }): RemoveFollower`. Arquivo: `src/services/follows/remove-follower.service.ts` (depende de T027; faz T068 passar)
- [x] T070 [P] Teste de integração de `list-follow-requests.service` (TDD): `direction: 'incoming'` lista pedidos recebidos (`targetId = eu`); `'outgoing'` lista os enviados (`requesterId = eu`); cada item resolve `handle`/`displayName` do outro lado; pagina por cursor. Arquivo: `tests/integration/services/follows/list-follow-requests.service.spec.ts` (depende de T024, T020)
- [x] T071 Criar `makeListFollowRequests({ followRequestRepository, userRepository }): ListFollowRequests`. Arquivo: `src/services/follows/list-follow-requests.service.ts` (depende de T023, T019, T050; faz T070 passar)
- [x] T072 [P] Teste de integração de `list-followers.service` (TDD): lista quem segue `userId` (aprovado), resolve `handle`/`displayName` de cada seguidor, pagina por cursor. Arquivo: `tests/integration/services/follows/list-followers.service.spec.ts` (depende de T028, T020)
- [x] T073 Criar `makeListFollowers({ followRepository, userRepository }): ListFollowers`. Arquivo: `src/services/follows/list-followers.service.ts` (depende de T027, T019, T050; faz T072 passar)
- [x] T074 [P] Teste de integração de `list-following.service` (TDD): lista quem `userId` segue (aprovado), resolve `handle`/`displayName` de cada seguido, pagina por cursor. Arquivo: `tests/integration/services/follows/list-following.service.spec.ts` (depende de T028, T020)
- [x] T075 Criar `makeListFollowing({ followRepository, userRepository }): ListFollowing`. Arquivo: `src/services/follows/list-following.service.ts` (depende de T027, T019, T050; faz T074 passar)
- [x] T076 Criar/estender o barrel `src/services/follows/index.ts` reexportando os 9 `makeXxx` (Fase 6 + Fase 7), os tipos de função e os DTOs de `types.ts`. Arquivo: `src/services/follows/index.ts` (depende de T052, T054, T056, T058, T067, T069, T071, T073, T075)
- [x] T077 Registrar `unfollowService`, `removeFollowerService`, `listFollowRequestsService`, `listFollowersService`, `listFollowingService` no registro de services e estender `AppCradle` com os 5 tipos. Arquivos: `src/container/register-services.ts`, `src/container/cradle.ts` (depende de T067, T069, T071, T073, T075; sequencial com T059, mesmos arquivos)
- [x] T078 [P] Criar `unfollow.controller.ts`: resolve `unfollowService`, responde `204`. Arquivo: `src/controllers/follows/unfollow.controller.ts` (depende de T067)
- [x] T079 [P] Criar `remove-follower.controller.ts`: resolve `removeFollowerService`, responde `204`. Arquivo: `src/controllers/follows/remove-follower.controller.ts` (depende de T069)
- [x] T080 [P] Criar `list-follow-requests.controller.ts`: valida a querystring com `listFollowRequestsSchema`, usa `request.currentUser.id`, resolve `listFollowRequestsService`, responde `200`. Arquivo: `src/controllers/follows/list-follow-requests.controller.ts` (depende de T014, T071)
- [x] T081 [P] Criar `list-followers.controller.ts`: valida a querystring com `listConnectionsSchema`, resolve `listFollowersService`, responde `200`. Arquivo: `src/controllers/follows/list-followers.controller.ts` (depende de T013, T073)
- [x] T082 [P] Criar `list-following.controller.ts`: valida a querystring com `listConnectionsSchema`, resolve `listFollowingService`, responde `200`. Arquivo: `src/controllers/follows/list-following.controller.ts` (depende de T013, T075)
- [x] T083 Estender o barrel `src/controllers/follows/index.ts` (criado em T064a) reexportando também os 5 controllers novos desta fase. Arquivo: `src/controllers/follows/index.ts` (depende de T064a, T078–T082)
- [x] T084 Estender `follows.routes.ts` com as 5 rotas restantes: `DELETE /users/:userId/follow`, `DELETE /users/:userId/follower`, `GET /me/follow-requests`, `GET /me/followers`, `GET /me/following` — todas com `preHandler: app.authenticate` (RF-020: nenhuma delas aceita `:userId` de terceiro para as listagens). Arquivo: `src/controllers/follows/follows.routes.ts` (depende de T078–T082; sequencial com T064, mesmo arquivo)
- [x] T085 [P] Teste de integração de rotas via `app.inject()` (TDD — escrito antes de T084 completar fazê-lo passar) cobrindo os cenários 4–12 e os casos de borda do grafo de follow: ciclo pedir→cancelar→pedir de novo (RF-009/RF-013); pedir pra si mesmo → `422`; pedir duplicado pendente → `200` (não `201`); aprovar cria só requester→target (RF-011 — `GET /me/following` do alvo não lista o remetente); recusar apaga o pedido (`404` numa nova tentativa de aprovar/recusar); pedir de novo depois de recusado → `201`; pedir quando já se segue → `409`; deixar de seguir → `204` + `404` numa segunda tentativa; remover seguidor → `204` + `404` numa segunda tentativa; `GET /me/follow-requests`, `/me/followers`, `/me/following` só devolvem dados do próprio usuário autenticado (RF-020). Arquivo: `tests/integration/http/follows.routes.spec.ts` (depende de T065, T083)

## Fase 8: Documentação e fechamento

- [x] T086 [P] Acrescentar ao `README.md` a seção **Profile & Follow**: os 10 endpoints novos + a extensão de `GET /v1/me` (corpo/respostas de sucesso e erro), a tabela de códigos de erro novos (de `contracts/error-codes.md`) e o passo `pnpm migrate:up`. Arquivo: `README.md`
- [x] T087 Rodar `pnpm lint`, `pnpm test` (unit + integration), `pnpm test:coverage` e `pnpm build`; conferir `grep -rn "export default" src` vazio, `grep -rn "from 'mongodb'" src/services src/controllers` vazio, e um `index.ts` em cada uma das 6 pastas de domínio novas (`schemas/profile`, `schemas/users`, `schemas/follows`, `services/profile`, `services/users`, `services/follows`, `controllers/profile`, `controllers/users`, `controllers/follows`, `repositories/follow-requests`, `repositories/follows`); sanar o que falhar. Sem arquivo fixo (ajustes pontuais onde o comando apontar). (depende de T001–T085)
- [x] T088 Executar `specs/004-profilefollow/quickstart.md` de ponta a ponta (`MONGO_URI` do Atlas configurado, `pnpm migrate:up`) e marcar cada item da "Definição de Pronto" no `spec.md`. Arquivo: `specs/004-profilefollow/spec.md` (depende de T087)

---

## Dependências

- **Fase 1 → todas**: as migrations (T001–T003) definem os índices que os helpers de teste (T016, T017) replicam e que o `quickstart` aplica de verdade.
- **Fase 2 → Fases 3–7**: as 4 classes de erro (T004–T007) são usadas pelos repositories e pelos services; os 4 schemas (T009, T011, T013, T014) são usados pelos controllers com body/querystring.
- **Fase 3 → Fases 4–7**: `UserRepository` estendido (T019/T020) sustenta `edit-profile`, `search-users` e as 3 listagens de `follows` (resolver `handle`/`displayName` do outro lado); `FollowRequestRepository`/`FollowRepository` (T023/T024, T027/T028) sustentam todos os 9 services de `follows`. T019a/T019b (extensão de `PublicUser` + correção das 2 suítes de auth da 002) são independentes do resto da Fase 3/4 — só dependem de T019 — mas T039 (teste HTTP de perfil) precisa de T019a pra `GET /v1/me` devolver `bio`.
- **Fase 4 e Fase 5 são independentes entre si** — só compartilham `UserRepository` (Fase 3) — mas ambas editam `src/container/register-services.ts`/`cradle.ts`/`src/app.ts`, então suas tarefas de fiação (T034/T038 vs. T044/T048) são sequenciais entre fases, não paralelas.
- **Fase 6 → Fase 7**: os 4 services do ciclo de pedido (T052–T058), o `follows.routes.ts` inicial (T064) e o barrel inicial (T064a) precisam existir antes de T084/T083 estendê-los; a fiação do container de Fase 7 (T077) é sequencial com a de Fase 6 (T059), mesmos arquivos.
- **Fase 7 → Fase 8**: `app.ts` completo (todas as 3 rotas registradas) e `follows.routes.ts` completo são pré-requisito do `quickstart` e das checagens finais.
- Internas relevantes:
  - T004–T007 → T008
  - T009 → T010; T011 → T012; T013, T014 → T015
  - T003 → T016; T001, T002 → T017
  - T016 → T018 (teste); T019 → T020 (faz T018 passar) → T021
  - T019 → T019a → T019b
  - T017 → T022 (teste); T023 → T024 (faz T022 passar) → T025
  - T017 → T026 (teste); T027 → T028 (faz T026 passar) → T029
  - T020 → T031 (teste) → T032 → T033 → T034 → T035 (com T009) → T036 → T037; T034 + T037 → T038 (+ T019a) → T039 (teste HTTP)
  - T020 → T041 (teste) → T042 → T043 → T044 (seq. com T034) → T045 (com T011) → T046 → T047; T044 + T047 → T048 (seq. com T038) → T049 (teste HTTP)
  - T024 + T028 + T004 + T005 → T051 (teste) → T052; T024 + T006 → T053 (teste) → T054
  - T024 + T028 + T006 → T055 (teste) → T056; T024 + T006 → T057 (teste) → T058
  - T024/T028/T052/T054/T056/T058 → T059 (seq. com T044) → T060–T063 → T064 → T064a → T065 (seq. com T048)
  - T028 + T007 → T066 (teste) → T067; T028 + T007 → T068 (teste) → T069
  - T024 + T020 → T070 (teste) → T071; T028 + T020 → T072 (teste) → T073; T028 + T020 → T074 (teste) → T075
  - T052/T054/T056/T058/T067/T069/T071/T073/T075 → T076
  - T067/T069/T071/T073/T075 → T077 (seq. com T059)
  - T078–T082 → T083 (com T064a), T084 (seq. com T064)
  - T065 + T083 → T085 (teste HTTP, faz T084 completar passar)
  - T001–T085, T019a, T019b, T064a → T086, T087 → T088

## Exemplo de execução em paralelo

```
# Fase 1 — as 3 migrations (arquivos distintos):
T001 create-follow-requests-collection | T002 create-follows-collection | T003 add-users-text-search-index

# Fase 2 — as 4 classes de erro (arquivos distintos, sem dependência entre si):
T004 cannot-follow-self-error.ts | T005 already-following-error.ts
T006 follow-request-not-found-error.ts | T007 follow-not-found-error.ts

# Fase 2 — os 4 schemas + specs (pares independentes):
T009 edit-profile | T011 search-users | T013 list-connections | T014 list-follow-requests

# Fase 3 — os 3 testes de integração de repositório (arquivos distintos; T018 após T016, T022/T026 após T017):
T018 mongo-user.repository.spec.ts (extensão) | T022 mongo-follow-request.repository.spec.ts | T026 mongo-follow.repository.spec.ts

# Fase 6 — os 4 testes de integração de service do ciclo de pedido (arquivos distintos):
T051 send-follow-request | T053 cancel-follow-request | T055 approve-follow-request | T057 reject-follow-request

# Fase 6 — os 4 controllers (arquivos distintos, após seus services):
T060 send-follow-request.controller | T061 cancel-follow-request.controller
T062 approve-follow-request.controller | T063 reject-follow-request.controller

# Fase 7 — os 5 testes de integração de service restantes (arquivos distintos):
T066 unfollow | T068 remove-follower | T070 list-follow-requests | T072 list-followers | T074 list-following

# Fase 7 — os 5 controllers restantes (arquivos distintos, após seus services):
T078 unfollow.controller | T079 remove-follower.controller
T080 list-follow-requests.controller | T081 list-followers.controller | T082 list-following.controller

# Fase 8 — T086 (README) corre em paralelo ao restante; T087/T088 são sequenciais e finais.
```

## Notas

- Ordem TDD: T018→T020, T022→T024, T026→T028, T031→T032, T041→T042, T051→T052, T053→T054,
  T055→T056, T057→T058, T066→T067, T068→T069, T070→T071, T072→T073, T074→T075,
  T039/T049/T085→T038/T048/T084 (o teste HTTP é escrito para falhar antes da fiação que o
  satisfaz — mesmo padrão da 003, T092/T093→T094).
- `follow_requests` e `follows` nunca têm um campo `status` — a existência do documento é o
  estado (D4). Nenhuma migration cria índice parcial por status nesta feature (diferente do
  índice parcial de `reading_sessions` na 003) — a unicidade é simples, por par ordenado.
- Nenhum service de `profile`/`users`/`follows` importa `mongodb` diretamente — só as
  implementações Mongo (`repositories/**`).
- Posse por par `(eu, :userId)` (D7): `cancel`/`approve`/`reject` (T054/T056/T058) e
  `unfollow`/`remove-follower` (T067/T069) resolvem sempre pelo par exato e usam
  `FollowRequestNotFoundError`/`FollowNotFoundError` tanto para "nunca existiu" quanto para
  "não pertence a esse par" — nunca `403`.
- `search-users` (T042) é a única operação de leitura paginada **por página**, não cursor
  (D3) — resultado ordenado por relevância (`textScore`), não por `createdAt`.
- `app.ts` importa a rota de cada domínio pelo barrel (`./controllers/<domain>`), nunca do
  arquivo `*.routes.ts` direto — confirmado em `src/app.ts` (`import { booksRoutes } from
  './controllers/books'`). Por isso T038/T048/T065 dependem do barrel do domínio (T037/T047/
  T064a), não só do arquivo de rotas.
- `bio` (RF-001) exige tocar dois domínios: `UserRepository`/`MongoUserRepository` (T019/T020,
  usado por `edit-profile`) **e** `PublicUser`/`toPublicUser` em `src/services/auth/types.ts`
  (T019a, usado por `GET /v1/me` da feature 002). T019b atualiza as 2 asserções `toEqual`
  exatas em `signup.service.spec.ts`/`authenticate.service.spec.ts` que, sem isso, quebrariam
  assim que `bio` passasse a existir em `PublicUser` (regressão real, confirmada lendo os
  testes existentes — achado do `/analyze`).
- Commitar após cada tarefa concluída.
