# Plano de Implementação: Lacunas de contrato de conexões/perfil para o front-end

**Branch**: `011-userconnectionscontractgaps` | **Data**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/011-userconnectionscontractgaps/spec.md`

## Resumo

Fechar quatro lacunas de contrato no backend, todas de **leitura/serialização** — nenhuma mudança em modelo persistido, auth ou fluxo de follow:

- **D1** `GET /users/{userId}` — perfil de uma pessoa (`getUserProfile`), com `bio` sob gate de follow aprovado e `followState`/`followsYou`. Erro `USER_NOT_FOUND` (404 neutro).
- **D2** `GET /users/{userId}/activity` — atividade de uma pessoa (`listUserActivity`), paginada por cursor, autorizada só para seguidor aprovado ou o próprio; item idêntico ao de `GET /feed`.
- **D3** `GET /me/stats` — contadores do próprio usuário (`getMyStats`): `booksRead`, `followers`, `following`, `pendingFollowRequests`, `wantToRead`.
- **D4** `followState`/`followsYou` como campos soltos em `UserSearchResult`, `FollowedUser`, `FollowRequestItem` — resolução em lote por página.

**Abordagem técnica** (Fase 0): reaproveitar ao máximo o que já existe. D2 reusa a máquina do feed — o índice `activities_actorId_createdAt` já cobre a query por ator único, e a hidratação de `get-feed.service.ts` é extraída para um helper compartilhado. D1 reusa `userRepository.findById`, `followRepository.exists` (nos dois sentidos) e `followRequestRepository.findByPair`. D3 usa contagens simples cobertas por prefixos de índices existentes. Só **um índice novo**: `follows { followeeId: 1, followerId: 1 }`, para o lote de `followsYou` (D1+D4) ser um index scan limitado em vez de filtrar em memória todos os seguidores do alvo.

## Contexto Técnico

**Linguagem/versão**: TypeScript ~5.9 (`strict`, `module: commonjs`, `target: es2016`) sobre Node.js v24. Sem mudança.
**Dependências principais**: Fastify 5, Awilix (`@fastify/awilix`) para DI, driver nativo `mongodb`, `zod` 4. **Nenhuma dependência nova.**
**Armazenamento**: MongoDB (driver nativo, sem ODM), migrations com `migrate-mongo`. Esta feature **não cria coleção** e **não faz migração de dados**; adiciona **1 índice** (1 migration).
**Testes**: Vitest, dois *projects* (`unit` / `integration`). Regra de negócio → integração com `mongodb-memory-server` (sem mock de banco), ≥ 70% cobertura, caminho feliz + ≥1 erro. Funções puras (mappers, schemas zod) → unitário.
**Plataforma-alvo**: servidor (API HTTP), consumida pelo app web da feature de front-end `004-userconnections` e por ferramentas OpenAPI.
**Tipo de projeto**: single (monolito backend em camadas `controller → service → repository`).
**Metas de performance**: N/A explícito. RNF-001: as queries novas não podem fazer collection scan — ver research D4.
**Restrições**: sem mudança em auth, em `follow-requests`/aprovação, nem no modelo persistido de `User`/`Follow`/`FollowRequest`/`Activity`/`Review`/`ReadingSession` (só consulta/serialização). `avatarUrl` continua sempre `null`. Nomes de arquivo/identificador em inglês; prosa dos artefatos SDD em português. Exemplos nos docs com dados fictícios.
**Escala/escopo**: 3 endpoints novos (`GET /users/{userId}`, `GET /users/{userId}/activity`, `GET /me/stats`) + 4 campos novos em 3 schemas de lista. ~9 arquivos de service/controller/schema novos, ~10 arquivos existentes tocados, 6 métodos de repositório novos, 1 helper de feed extraído, 1 migration de índice, delta no `docs/openapi.yaml` + 2 guias de fluxo + catálogo de erros.

## Verificação da Constituição

*Gate inicial — antes da Fase 0.*

- [x] **Idioma do código: inglês** — todos os identificadores novos (`getUserProfile`, `listUserActivity`, `getMyStats`, `UserProfileDTO`, `MyStatsDTO`, `followState`, `followsYou`, `UserNotFoundError`, nomes de arquivo) em inglês. Prosa SDD em português.
- [x] **P1 Testes por tipo de código** — serviços novos (`get-user-profile`, `list-user-activity`, `get-my-stats`) e os métodos de repositório novos são regra de negócio/acesso a dados → **integração** com `mongodb-memory-server`. Schemas zod novos (path param, querystring de atividade) e o helper de hidratação extraído (`toFeedItemDTO` já é unitário) → **unitário**. Cobertura de regra de negócio ≥ 70%, caminho feliz + ≥1 erro por serviço (ex.: `USER_NOT_FOUND` neutro; `booksRead` com releitura).
- [x] **P2 Acesso a dados só via repositório** — nenhum `db.collection` fora de `src/repositories/**`. Os novos métodos entram nas interfaces `FollowRepository`, `FollowRequestRepository`, `ReadingSessionRepository`, `ShelfMembershipRepository` + implementações `mongo-*`. Serviços dependem só das interfaces resolvidas pelo cradle do Awilix.
- [x] **P3 Validação com zod na borda** — `GET /users/{userId}` e `GET /users/{userId}/activity` validam o path param `userId` e a querystring (`cursor`, `limit`) com schema zod no controller antes do service. `GET /me/stats` não tem entrada além do token.
- [x] **P4 Mudança de índice só via migration** — o índice `follows { followeeId: 1, followerId: 1 }` entra por migration `migrate-mongo` versionada e reversível (`up`/`down`). Nada de `createIndex` em bootstrap.
- [x] **P5 Erros tipados a partir do tipo base** — `UserNotFoundError extends AppError` (`src/errors/user-not-found-error.ts`), código `USER_NOT_FOUND`, status 404. O error handler já mapeia `instanceof AppError` — sem mudança nele. Nenhuma exceção crua do driver vaza (os métodos de repositório novos são leitura simples; `findById` já trata `ObjectId` inválido devolvendo `null`).

**Resultado**: conforme. Nenhuma violação. Sem entradas em "Rastreio de Complexidade".

## Estrutura do Projeto

### Documentos desta feature (`specs/011-userconnectionscontractgaps/`)

```
spec.md
plan.md              # este arquivo
research.md           # Fase 0
data-model.md         # Fase 1
quickstart.md         # Fase 1
contracts/            # Fase 1 — openapi-delta.md + behavior-checklist.md
tasks.md              # Fase 2 (gerado pelo /tasks)
```

### Código-fonte (segue `architecture.md` → "Onde cada tipo de código novo deve ir")

**Novos arquivos**

```
src/errors/user-not-found-error.ts                         # UserNotFoundError (USER_NOT_FOUND, 404)

src/schemas/users/get-user-profile.schema.ts               # zod: params { userId }
src/schemas/users/list-user-activity.schema.ts             # zod: params { userId } + query { cursor?, limit }
src/schemas/profile/get-my-stats.schema.ts                 # (sem entrada; presente por consistência ou omitido — ver research D5)

src/services/users/get-user-profile.service.ts             # makeGetUserProfile
src/services/users/list-user-activity.service.ts           # makeListUserActivity (usa hidratação do feed)
src/services/profile/get-my-stats.service.ts               # makeGetMyStats
src/services/feed/hydrate-activities.ts                    # helper extraído de get-feed.service.ts

src/controllers/users/get-user-profile.controller.ts
src/controllers/users/list-user-activity.controller.ts
src/controllers/profile/get-my-stats.controller.ts

migrations/<timestamp>-add-userconnections-followsYou-index.js
```

**Arquivos existentes tocados**

```
src/controllers/users/users.routes.ts        # + GET /users/:userId , + GET /users/:userId/activity
src/controllers/users/index.ts               # re-exports
src/controllers/profile/profile.routes.ts    # + GET /me/stats
src/controllers/profile/index.ts             # re-exports
src/schemas/users/index.ts                   # re-exports
src/schemas/profile/index.ts                 # re-exports (criar se não existir)
src/services/users/index.ts                  # re-exports + tipos
src/services/users/types.ts                  # + UserProfileDTO ; + followState/followsYou em UserSearchResultDTO
src/services/profile/index.ts + types.ts     # + MyStatsDTO
src/services/follows/types.ts                # + followState/followsYou em FollowedUserDTO e FollowRequestDTO
src/services/follows/list-following.service.ts / list-followers.service.ts / list-follow-requests.service.ts  # preencher os 2 campos em lote
src/services/feed/get-feed.service.ts        # passa a usar hydrateActivities
src/services/feed/index.ts                   # export do helper
src/repositories/follows/follow.repository.ts + mongo-follow.repository.ts          # + filterFollowing, filterFollowers, countFollowers, countFollowing
src/repositories/follow-requests/follow-request.repository.ts + mongo-*.ts          # + filterPendingTargets, countIncoming
src/repositories/reading-sessions/reading-session.repository.ts + mongo-*.ts        # + countDistinctFinishedBooks
src/repositories/shelf-memberships/shelf-membership.repository.ts + mongo-*.ts      # + countForUser
src/container/register-services.ts           # registrar getUserProfileService, listUserActivityService, getMyStatsService
docs/openapi.yaml                            # ver contracts/openapi-delta.md
docs/flows/follow-flow.md , docs/flows/feed-flow.md , docs/error-catalog.md
```

**Testes** (espelham `src/`)

```
tests/unit/schemas/users/get-user-profile.schema.spec.ts
tests/unit/schemas/users/list-user-activity.schema.spec.ts
tests/integration/services/users/get-user-profile.service.spec.ts
tests/integration/services/users/list-user-activity.service.spec.ts
tests/integration/services/profile/get-my-stats.service.spec.ts
tests/integration/services/follows/list-following.service.spec.ts     # ajuste: asserção dos campos novos
tests/integration/services/follows/list-followers.service.spec.ts     # idem
tests/integration/services/follows/list-follow-requests.service.spec.ts # idem
tests/integration/services/users/search-users.service.spec.ts         # ajuste: asserção dos campos novos
tests/integration/repositories/**                                     # métodos novos de repositório
tests/integration/controllers/** (se houver testes de rota no padrão do projeto)
```

## Fase 0: Pesquisa

Sem `[NEEDS CLARIFICATION]` no Contexto Técnico. A pesquisa registra as decisões de design que dependeram de inspeção do código existente. Ver [research.md](./research.md):

- **D1** — `USER_NOT_FOUND`: novo erro tipado vs. reuso de `NOT_FOUND`.
- **D2** — reuso da máquina de feed: extrair helper de hidratação vs. duplicar.
- **D3** — `GET /me/stats` como rota do domínio `profile`; definição operacional de cada contador.
- **D4** — cobertura de índice das queries de `followState`/`followsYou` e contadores; decisão do único índice novo.
- **D5** — `followState`/`followsYou` como campos soltos (segue `viewer-block.md`); forma de resolução em lote.
- **D6** — schema zod para rota sem entrada (`/me/stats`).

**Saída**: `research.md` com todas as decisões.

## Fase 1: Design & Contratos

1. **`data-model.md`** — DTOs novos (`UserProfileDTO`, `MyStatsDTO`), campos novos nos DTOs de lista, e a assinatura de cada método de repositório novo. Nenhuma entidade/coleção nova. (Ver [data-model.md](./data-model.md).)
2. **`contracts/`**:
   - `openapi-delta.md` — texto exato a aplicar em `docs/openapi.yaml`: 3 paths novos, schemas `UserProfile` e `MyStats`, campos `followState`/`followsYou` em `UserSearchResult`/`FollowedUser`/`FollowRequestItem`, resposta 404 `USER_NOT_FOUND`, blocos `examples`.
   - `behavior-checklist.md` — cada RF/RNF → teste (INT/UNI/DOC) que o comprova.
3. **Cenários de teste** — derivados dos 28 cenários de aceitação da spec; mapeados no `behavior-checklist.md`.
4. **`quickstart.md`** — passos `curl` para validar D1–D4 manualmente contra um servidor local.
5. **Design/UI** — N/A (repo backend-only, sem `design/`).
6. **`update-agent-context.sh`** — roda para propagar a stack ao `CLAUDE.md`.

**Repetição da Verificação da Constituição pós-design**: sem novas violações — o design não introduz acesso a driver fora de repositório, não mistura camadas, e o único índice entra por migration. Gate mantém-se verde.

## Fase 2: Abordagem de Planejamento de Tarefas

*Descrição do que o `/tasks` fará — não executar agora.*

**Estratégia de geração**:
- Uma trilha por entrega (D1, D2, D3, D4), cada uma em ordem TDD: schema/erro → teste unitário → método(s) de repositório + teste de integração → serviço + teste de integração → controller + rota → registro no container.
- D4 gera também tarefas de **ajuste** nos serviços de lista existentes (`list-following`, `list-followers`, `list-follow-requests`, `search-users`) e nos seus testes.
- Tarefas de documentação (`openapi.yaml`, `follow-flow.md`, `feed-flow.md`, `error-catalog.md`) + `pnpm docs:lint` como gate final.
- Tarefa da migration do índice + verificação `explain` (DoD item 6).
- Tarefa de extração do `hydrateActivities` antes das tarefas de D2 (dependência).

**Ordenação**:
- `[P]` para arquivos independentes: os 3 blocos de schema, os 4 arquivos de erro/DTO, os métodos de repositório em coleções diferentes.
- Sequencial: helper de feed → serviço D2; DTO/tipos → serviços → controllers → container; tudo antes do gate de docs.
- Ajustes de D4 nos serviços existentes depois dos métodos de repositório de lote e antes do gate de regressão.

## Rastreio de Complexidade

*Sem violações da constituição — nada a justificar.*

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — backend, sem `design/`)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
