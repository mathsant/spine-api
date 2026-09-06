# Tarefas: Sugestões de quem seguir (`GET /users/suggestions`)

**Entrada**: `plan.md`, `research.md`, `data-model.md`, `contracts/suggestions.openapi.yaml`, `quickstart.md` de `specs/012-followsuggestions/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial. Caminhos e identificadores em inglês; descrição em português. Ordem TDD dentro de cada fase: o teste existe e falha antes da implementação que o cobre.

Tipos de teste (constituição): **INT** = integração com `mongodb-memory-server`; **UNI** = unitário isolado; **DOC** = `docs/` + `pnpm docs:lint`.

---

## Fases

- **Fase 1 — Fundação: leitura batelada + ordenação pura**: as folhas que o service consome — 3 métodos de agregação novos em `FollowRepository`, `findByIds` em `UserRepository`, e o comparador puro de ordenação (RF-006). Nenhuma peça depende das outras; bloqueia a Fase 2.
- **Fase 2 — Service `getFollowSuggestions`**: as duas trilhas do algoritmo (amigos-de-amigos + cold start), os DTOs de resposta e o registro no container. É o marco em que a regra de negócio fica completa e testada por integração. Depende da Fase 1.
- **Fase 3 — Endpoint HTTP**: controller sem schema (sem entrada externa), rota estática e testes de rota (200/401/não-sombreamento por `/users/:userId`). Depende da Fase 2.
- **Fase 4 — Contrato, documentação e fechamento**: delta no `docs/openapi.yaml`, guias de fluxo, catálogo de erros, `quickstart` + `explain`, e a checagem final contra a Definição de Pronto da spec. Depende das Fases 2–3.

---

## Fase 1 — Fundação: leitura batelada + ordenação pura

- [x] **T001** [P] UNI: teste do comparador em `tests/unit/services/users/compare-suggestion-candidates.spec.ts` — `compareSuggestionCandidates(a, b)` ordena por `mutualFollowersCount` desc, depois `followerCount` desc, depois `createdAt` desc, depois `userId` desc; ordena uma lista de exemplo de forma determinística; empate total em tudo menos `userId` resolvido por `userId`.
- [x] **T002** Criar `src/services/users/compare-suggestion-candidates.ts` — função pura `compareSuggestionCandidates(a: SuggestionCandidate, b: SuggestionCandidate): number` implementando RF-006 (ver `data-model.md`); definir/exportar o tipo `SuggestionCandidate`. Reexportar em `src/services/users/index.ts`. (depende de T001)
- [x] **T003** [P] INT: testes dos métodos novos de `FollowRepository` em `tests/integration/repositories/follows/mongo-follow.repository.spec.ts` — (a) `listFollowSuggestionCandidates(followeeIds)` conta seguidores **distintos** em comum por candidato e `followeeIds: []` → `[]` sem tocar o banco; (b) `countFollowersByUser(userIds)` devolve `Map<userId, count>` correto e `[]` → `Map` vazio; (c) `listMostFollowedUsers(limit, excludeUserIds)` ordena por contagem desc + desempate `_id` desc, respeita `limit` e aplica `$nin excludeUserIds`; (d) `.explain()` das três agregações **não** contém estágio `COLLSCAN` (usa `ensureFollowIndexes` no `beforeAll`, que já cria `follows_followerId_followeeId_unique` e `follows_followeeId_followerId`).
- [x] **T004** Adicionar à interface `src/repositories/follows/follow.repository.ts` e à implementação `src/repositories/follows/mongo-follow.repository.ts`: `listFollowSuggestionCandidates(followeeIds: string[]): Promise<{ userId: string; mutualFollowersCount: number }[]>` (`$match { followerId: { $in } }` + `$group { _id: '$followeeId', mutualFollowersCount: { $sum: 1 } }`), `countFollowersByUser(userIds: string[]): Promise<Map<string, number>>` (`$match { followeeId: { $in } }` + `$group`), `listMostFollowedUsers(limit: number, excludeUserIds: string[]): Promise<{ userId: string; mutualFollowersCount: 0 }[]>` (`$match { followeeId: { $nin: excludeUserIds } }` + `$group` + `$sort { count: -1, _id: -1 }` + `$limit`). Entrada `[]` guardada sem query onde fizer sentido. (depende de T003)
- [x] **T005** [P] INT: teste de `UserRepository.findByIds` em `tests/integration/repositories/users/mongo-user.repository.spec.ts` — devolve os `UserRecord` dos ids dados (ordem não garantida); ids inexistentes são ignorados; `[]` → `[]` sem tocar o banco; id malformado (não-ObjectId) é filtrado sem lançar.
- [x] **T006** Adicionar `findByIds(ids: string[]): Promise<UserRecord[]>` à interface `src/repositories/users/user.repository.ts` e à implementação `src/repositories/users/mongo-user.repository.ts` — `find({ _id: { $in: objectIds } })`, converte hex → `ObjectId` ignorando inválidos, guarda entrada vazia. (depende de T005)

---

## Fase 2 — Service `getFollowSuggestions`

- [x] **T007** Adicionar `FollowSuggestionDTO` e `FollowSuggestionsResponseDTO` a `src/services/users/types.ts` conforme `data-model.md` (`avatarUrl` sempre `null`, `followState` sempre `'none'`, `mutualFollowersCount: number`, envelope `{ items }`). Reexportar em `src/services/users/index.ts`.
- [x] **T008** INT: teste de `makeGetFollowSuggestions` em `tests/integration/services/users/get-follow-suggestions.service.spec.ts` — cenários 1–9 da spec: (1) ranking por `mutualFollowersCount` desc; (2) desempate por nº de seguidores, depois `createdAt`; (3) cap de 4; (4) cold start (viewer segue ninguém) → popularidade global com `mutualFollowersCount: 0`; (5) viewer segue alguém mas rede rende 0 candidatos → `{ items: [] }` **sem** cair para popularidade; (6) `followsYou: true` para quem já segue o viewer; (7) follow-request pendente exclui o alvo; (8) recusa passada **não** exclui; (9) viewer nunca aparece na própria lista. `beforeAll` aplica `ensureFollowIndexes`. (depende de T007; TDD — falha antes de T009)
- [x] **T009** Criar `src/services/users/get-follow-suggestions.service.ts` — `makeGetFollowSuggestions({ userRepository, followRepository, followRequestRepository }) => ({ viewerId }) => Promise<FollowSuggestionsResponseDTO>` seguindo `research.md` D1: `followRepository.listFolloweeIds(viewerId)` → se vazio, **trilha B** (`follow_requests` pendentes do viewer via `filterPendingTargets`/distinct → `listMostFollowedUsers(4 + exclusões, [viewerId, ...pendentes])` → `findByIds` → `mutualFollowersCount: 0`); senão **trilha A** (`listFollowSuggestionCandidates(followeeIds)` → remove `viewerId` + `followeeIds` + `filterPendingTargets` → se vazio `{ items: [] }` → `countFollowersByUser` + `findByIds` → `compareSuggestionCandidates` → top 4) → `filterFollowers(viewerId, top4Ids)` para `followsYou` → monta `FollowSuggestionDTO[]`. Reexportar em `src/services/users/index.ts`. (depende de T002, T004, T006, T007, T008)
- [x] **T010** Registrar `getFollowSuggestionsService` em `src/container/register-services.ts` (`asFunction` com `userRepository`, `followRepository`, `followRequestRepository`). (depende de T009)

---

## Fase 3 — Endpoint HTTP

- [x] **T011** INT: teste de rota em `tests/integration/http/users.routes.spec.ts` — `GET /v1/users/suggestions`: sem `Bearer` → 401 `UNAUTHENTICATED`; com token válido → 200 com corpo `{ items: [...] }` (`items.length ≤ 4`, cada item com `avatarUrl: null`, `followState: 'none'`, `mutualFollowersCount` inteiro ≥ 0); a rota **não** é resolvida por `/users/:userId` (não retorna `404 USER_NOT_FOUND` para "usuário `suggestions`"). (depende de T010; TDD — falha antes de T012/T013)
- [x] **T012** Criar `src/controllers/users/get-follow-suggestions.controller.ts` — exige `request.currentUser` (senão `UnauthenticatedError`), resolve `getFollowSuggestionsService`, chama com `{ viewerId: currentUser.id }`, responde `200` com o envelope `{ items }`. Sem schema `zod` (a rota não tem query/path/body — ver `research.md` D4). Reexportar em `src/controllers/users/index.ts`. (depende de T011)
- [x] **T013** Registrar `app.get('/users/suggestions', { preHandler: app.authenticate }, getFollowSuggestionsController)` em `src/controllers/users/users.routes.ts` — colocar a linha **antes** de `app.get('/users/:userId', ...)` por clareza (o find-my-way prioriza rota estática de qualquer forma). (depende de T012)

---

## Fase 4 — Contrato, documentação e fechamento

- [x] **T014** [P] DOC: aplicar o delta de `specs/012-followsuggestions/contracts/suggestions.openapi.yaml` em `docs/openapi.yaml` — operação `GET /users/suggestions` (`operationId: getFollowSuggestions`, tag `users`, `200` + `401`) logo após `/users/search`; schemas `FollowSuggestion` e `FollowSuggestionsResponse` na seção `# --- users ---`; um item novo nas "Notas de consolidação" do topo. Rodar `pnpm docs:lint` — sem novo warning (os 2 pré-existentes de `info-license` e `health 4xx` permanecem).
- [x] **T015** [P] DOC: adicionar a `docs/flows/follow-flow.md` uma seção "Sugestões de quem seguir (`GET /users/suggestions`)" — as duas trilhas (amigos-de-amigos ordenado por `mutualFollowersCount`; cold start → popularidade global), as exclusões (self / já segue / pedido pendente; recusa não exclui), o cap de 4, e lista vazia = `200 { items: [] }` com o cliente escondendo a seção. Acrescentar uma linha em `docs/flows/feed-flow.md` apontando dessa seção do trilho direito para a rota.
- [x] **T016** [P] DOC: conferir `docs/error-catalog.md` — a linha `UNAUTHENTICATED` já cobre "qualquer endpoint protegido"; nenhum código de erro novo. Se o catálogo listar rotas por erro em algum ponto que valha citar `GET /users/suggestions`, acrescentar; caso contrário, nenhuma mudança.
- [x] **T017** Rodar os cenários 1–8 de `quickstart.md` contra a API local e o check de `explain` das três agregações novas (estágio `IXSCAN`, sem `COLLSCAN`, sem `FETCH` antes do `$group`); registrar qualquer desvio. (depende de T013, T014, T015, T016)
- [x] **T018** Rodar `pnpm test`, `pnpm typecheck` e `pnpm lint` (tudo verde) e confirmar, item a item, o checklist da "Definição de Pronto" da spec: contrato no `openapi.yaml` + testes cobrindo ranking/exclusões/cap/cold-start/lista-vazia; sem collection scan; resposta não vaza além de search + `mutualFollowersCount`; guias de fluxo atualizados; sem regressão em follow/busca/feed. (depende de T017)

---

## Dependências

- **Fase 1 → Fase 2 → Fase 3 → Fase 4** (marcos sequenciais).
- Dentro da Fase 1: T001→T002; T003→T004; T005→T006. T001/T003/T005 são os testes (TDD), independentes entre si.
- Fase 2: T007 antes de T008 e T009; T008 antes de T009 (TDD); T009 antes de T010. T009 também depende de T002, T004, T006.
- Fase 3: T011 antes de T012 (TDD); T012 antes de T013. T011 depende de T010.
- Fase 4: T014, T015, T016 são independentes entre si (arquivos diferentes) e podem começar assim que a Fase 2 estiver verde; T017 depende de T013–T016; T018 depende de T017.

## Exemplo de execução em paralelo

```
# Fase 1 — os três testes-folha, arquivos diferentes, sem dependência entre si:
Tarefa T001: "UNI comparador em tests/unit/services/users/compare-suggestion-candidates.spec.ts"
Tarefa T003: "INT métodos de FollowRepository em tests/integration/repositories/follows/mongo-follow.repository.spec.ts"
Tarefa T005: "INT UserRepository.findByIds em tests/integration/repositories/users/mongo-user.repository.spec.ts"

# Fase 4 — documentação, arquivos diferentes:
Tarefa T014: "delta do openapi.yaml + docs:lint"
Tarefa T015: "seção em docs/flows/follow-flow.md + linha em feed-flow.md"
Tarefa T016: "conferência do docs/error-catalog.md"
```

## Notas

- `[P]` = arquivos diferentes, sem dependências entre as tarefas marcadas.
- Caminhos de arquivo/pasta e identificadores em **inglês** (regra fixa do kit); descrição em português.
- Verificar que cada teste falha antes de implementar o código correspondente.
- Commitar após cada tarefa concluída (mensagem em inglês, escopo `feat(users)` ou `docs(012-followsuggestions)`).
- **Zero migration**: se alguma tarefa parecer exigir índice novo, revisar `research.md` D3 antes — todas as queries são servidas por índice existente.
- Sem schema `zod` nesta feature (a rota não tem entrada externa) — não criar `src/schemas/users/*suggestions*`.
- Nenhuma tarefa ficou bloqueada por lacuna em `plan.md`/`data-model.md`.
