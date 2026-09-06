# Plano de Implementação: Sugestões de quem seguir (`GET /users/suggestions`)

**Branch**: `012-followsuggestions` | **Data**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/012-followsuggestions/spec.md`

## Resumo

Adicionar **um endpoint de leitura autenticado** — `GET /users/suggestions` — que devolve
até **4** contas para o usuário autenticado seguir. Trilha principal: **amigos-de-amigos**
(candidatos são quem é seguido por pessoas que o viewer segue, ordenados por número de
seguidores em comum — `mutualFollowersCount`). Trilha de **cold start** (viewer não segue
ninguém): **popularidade global** com `mutualFollowersCount = 0`. Exclui o próprio viewer,
quem ele já segue e follow-requests pendentes; recusa passada não exclui. Lista vazia é
resposta `200` normal.

Abordagem técnica (Fase 0): **nenhuma migration** — todas as queries são servidas por
índices já existentes em `follows` / `follow_requests`, com agregações `$match`+`$group`
que rodam index-only (sem COLLSCAN, sem FETCH). Novos métodos batelados nos repositórios
`follows` e `users`; um service novo no domínio `users`; um controller e uma rota; sem
schema `zod` (o endpoint não tem entrada externa). Ordenação/desempate num comparador
puro testável por unitário.

## Contexto Técnico

**Linguagem/versão**: TypeScript ~5.9 (`strict`, `module: commonjs`, `target: es2016`) sobre Node.js v24. Sem mudança.
**Dependências principais**: Fastify 5, Awilix (`@fastify/awilix`) para DI, driver nativo `mongodb`, `zod` 4. **Nenhuma dependência nova.**
**Armazenamento**: MongoDB (driver nativo, sem ODM), migrations com `migrate-mongo`. Esta feature **não cria coleção**, **não altera schema** e **não adiciona índice** — só leitura sobre `follows`, `follow_requests`, `users`.
**Testes**: Vitest, dois *projects* (`unit` / `integration`). O service (orquestra repositórios) → integração com `mongodb-memory-server` (sem mock de banco), ≥ 70% cobertura, caminho feliz + ≥ 1 erro. Comparador de ordenação e montagem de DTO (funções puras) → unitário.
**Plataforma-alvo**: servidor (API HTTP), consumida pelo app web `spine-app` (feature de front-end `005-paginatedfeed`, seção "Pessoas para seguir" do trilho direito) e por ferramentas OpenAPI.
**Tipo de projeto**: single (monolito backend em camadas `controller → service → repository`).
**Metas de performance**: N/A explícito. RNF/DoD: as queries novas não podem fazer collection scan — ver research D3 (todas usam índice existente; a agregação de cold start é `IXSCAN` completo, não `COLLSCAN`).
**Restrições**: sem mudança em auth, no fluxo de `follow-requests`/aprovação, nem no modelo persistido de `User`/`Follow`/`FollowRequest` (só consulta/serialização). `avatarUrl` sempre `null`. `followState` sempre `none` nesta rota. Sem paginação, sem `limit`, sem query param. "Dispensar sugestão" fora de escopo. Nomes de arquivo/identificador em inglês; prosa dos artefatos SDD em português. Exemplos com dados fictícios.
**Escala/escopo**: 1 endpoint novo, 1 schema de resposta novo (`FollowSuggestion` + `FollowSuggestionsResponse`). ~4 arquivos novos (service, controller, 1 helper puro, testes), ~6 arquivos existentes tocados (2 interfaces + 2 impls de repositório, `users.routes.ts`, `services/users/index.ts` + `types.ts`, `register-services.ts`), delta no `docs/openapi.yaml` + nota nos guias de fluxo. Zero migration.

## Verificação da Constituição

*Gate rodado antes da Fase 0 e de novo após a Fase 1.*

- [x] **Idioma do código: inglês** — todos os identificadores novos em inglês: `getFollowSuggestions`, `FollowSuggestionDTO`, `mutualFollowersCount`, `compareSuggestionCandidates`, `listFollowSuggestionCandidates`, `countFollowersByUser`, `listMostFollowedUsers`, `findByIds`. Prosa SDD em português.
- [x] **P1 Testes por tipo de código** — `makeGetFollowSuggestions` orquestra repositórios ⇒ **regra de negócio** ⇒ teste de **integração** com `mongodb-memory-server` (sem mock): cobre as duas trilhas, as três exclusões, o cap de 4, a lista vazia sem fallback, `followsYou`, recusa não-exclui, e o erro `401` (via teste de rota). Comparador `compareSuggestionCandidates` e montagem de DTO são **funções puras** ⇒ teste **unitário**. Meta ≥ 70% + caminho feliz + ≥ 1 erro atendida.
- [x] **P2 Acesso a dados só via repositório** — nenhum acesso ao driver fora de `repositories/**`. Métodos novos entram nas **interfaces** `FollowRepository` / `UserRepository` e nas implementações `Mongo*`; o service depende só das interfaces resolvidas pelo cradle do Awilix.
- [x] **P3 Validação com `zod` na borda** — N/A com justificativa (research D4): o endpoint não tem query/path/body; a única entrada é a identidade autenticada, já validada pelo `preHandler: app.authenticate`. Nenhum schema novo, consistente com o princípio ("entrada vinda de fora do processo").
- [x] **P4 Mudança de schema/índice só via migration** — N/A: a feature não cria coleção, não altera documento e **não adiciona índice** (research D3). Nada a migrar.
- [x] **P5 Erros de domínio a partir do tipo base** — o único erro é `UnauthenticatedError` (já existe, estende `AppError`). Lista vazia **não** é erro (RF-011). Nenhum erro novo. Exceção crua do driver continua contida nas implementações de repositório.

Sem violações. "Rastreio de Complexidade" vazio. Ponto de atenção (não-violação): a
agregação de popularidade global é O(nº total de follows) — aceitável no MVP, caminho de
escala anotado em research D3.

## Estrutura do Projeto

### Documentos desta feature (`specs/012-followsuggestions/`)

```
specs/012-followsuggestions/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # Fase 0 — D1..D6
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── suggestions.openapi.yaml   # Fase 1 — delta para docs/openapi.yaml
└── tasks.md             # Fase 2 (gerado pelo /tasks)
```

### Código-fonte (raiz do repositório)

Segue a tabela "Onde cada tipo de código novo deve ir" de `architecture.md`.

```
src/
├── controllers/users/
│   ├── get-follow-suggestions.controller.ts   # NOVO — handler (request, reply)
│   ├── users.routes.ts                         # EDIT — + app.get('/users/suggestions', ...)
│   └── index.ts                                # EDIT — re-export do controller novo
├── services/users/
│   ├── get-follow-suggestions.service.ts       # NOVO — makeGetFollowSuggestions (factory Awilix)
│   ├── compare-suggestion-candidates.ts        # NOVO — comparador puro (RF-006)
│   ├── types.ts                                # EDIT — + FollowSuggestionDTO, FollowSuggestionsResponseDTO
│   └── index.ts                                # EDIT — re-exports
├── repositories/follows/
│   ├── follow.repository.ts                    # EDIT — + listFollowSuggestionCandidates, countFollowersByUser, listMostFollowedUsers
│   └── mongo-follow.repository.ts              # EDIT — implementações (agregações)
├── repositories/users/
│   ├── user.repository.ts                      # EDIT — + findByIds(ids): Promise<UserRecord[]>
│   └── mongo-user.repository.ts                # EDIT — implementação ($in _id)
└── container/
    └── register-services.ts                    # EDIT — + getFollowSuggestionsService

tests/
├── unit/services/users/
│   └── compare-suggestion-candidates.spec.ts   # NOVO — ordenação/desempate determinístico
└── integration/
    ├── services/users/
    │   └── get-follow-suggestions.service.spec.ts   # NOVO — regra de negócio (mongodb-memory-server)
    └── http/
        └── get-follow-suggestions.routes.spec.ts    # NOVO — rota: 200 shape, 401, não sombreada por :userId

docs/
├── openapi.yaml                                # EDIT — nova operação + schemas (aplicar contracts/suggestions.openapi.yaml)
└── flows/
    ├── follow-flow.md                          # EDIT — parágrafo sobre a rota de sugestões + degradação
    └── feed-flow.md                            # EDIT (opcional) — link para a seção "Pessoas para seguir"
```

Sem `design/` neste repo (backend puro) — passo de mapeamento de telas não se aplica.

## Fase 0: Pesquisa

Concluída — `research.md`. Decisões:

- **D1** — algoritmo em duas trilhas (amigos-de-amigos com `$group` de `mutualFollowersCount`; cold start com popularidade global). Ordenação/corte fora do banco.
- **D2** — expor só `mutualFollowersCount` (inteiro), nunca a lista de nomes em comum.
- **D3** — **sem migration**: todas as queries usam índice existente; a agregação de cold start é `IXSCAN` completo (não `COLLSCAN`), sem `FETCH`. Escala futura = contador desnormalizado (fora de escopo).
- **D4** — sem `zod`: o endpoint não tem entrada externa.
- **D5** — rota estática `/users/suggestions` no `users.routes.ts`; find-my-way prioriza estático sobre `/users/:userId` (padrão já usado por `/users/search`).
- **D6** — resposta `{ items: [...] }` com `maxItems: 4` (espelha `PopularAmongFollowingResponse`).

Nenhum `[NEEDS CLARIFICATION]` restante.

## Fase 1: Design & Contratos

Concluída.

1. **`data-model.md`** — entidades persistidas lidas (`follows`, `follow_requests`, `users`); estruturas derivadas `SuggestionCandidate` (interno), `FollowSuggestionDTO`, `FollowSuggestionsResponseDTO`; invariantes.
2. **`contracts/suggestions.openapi.yaml`** — `GET /users/suggestions` (`operationId: getFollowSuggestions`, tag `users`, `200` + `401`), schemas `FollowSuggestion` e `FollowSuggestionsResponse`. Delta a aplicar em `docs/openapi.yaml`.
3. **Cenários de teste** — extraídos dos cenários de aceitação da spec para o `get-follow-suggestions.service.spec.ts` (ver quickstart 1–6) e para o teste de rota (quickstart 7–8).
4. **`quickstart.md`** — 8 cenários manuais + checagem de `explain` (IXSCAN, sem COLLSCAN/FETCH).
5. **Design** — sem `design/` no repo; N/A.
6. **`update-agent-context.sh`** — rodar para propagar o Contexto Técnico ao `CLAUDE.md`.

### Contratos das interfaces de repositório (novos métodos)

`FollowRepository`:
- `listFollowSuggestionCandidates(followeeIds: string[]): Promise<{ userId: string; mutualFollowersCount: number }[]>`
  — `$match { followerId: { $in: followeeIds } }` + `$group { _id: '$followeeId', n: { $sum: 1 } }`. `followeeIds` vazio ⇒ `[]` sem tocar o banco.
- `countFollowersByUser(userIds: string[]): Promise<Map<string, number>>`
  — `$match { followeeId: { $in: userIds } }` + `$group { _id: '$followeeId', n: { $sum: 1 } }`. Vazio ⇒ `Map` vazio.
- `listMostFollowedUsers(limit: number, excludeUserIds: string[]): Promise<{ userId: string; mutualFollowersCount: 0 }[]>`
  — `$match { followeeId: { $nin: excludeUserIds } }` + `$group` + `$sort { n: -1, _id: -1 }` + `$limit`. Cold start (D1 trilha B).

`UserRepository`:
- `findByIds(ids: string[]): Promise<UserRecord[]>` — `find({ _id: { $in: objectIds } })`. `ids` vazio ⇒ `[]` sem tocar o banco. Ordem não garantida (o service indexa por `id`).

### Contrato do service

`makeGetFollowSuggestions({ userRepository, followRepository, followRequestRepository }) => (input: { viewerId: string }) => Promise<FollowSuggestionsResponseDTO>`

Fluxo: `listFolloweeIds(viewer)` → se vazio, **trilha B**; senão **trilha A** (candidatos →
exclui self + followees + `filterPendingTargets` → se vazio, `{ items: [] }` → senão
`countFollowersByUser` + `findByIds` → `compareSuggestionCandidates` → top 4 →
`filterFollowers(viewer, top4)` para `followsYou` → monta DTOs).

## Fase 2: Abordagem de Planejamento de Tarefas

*Descrição da estratégia que o `/tasks` vai seguir — não executar aqui.*

**Geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md`.
- Uma tarefa por método novo de repositório (interface + impl + teste de integração do método via service que o exercita).
- Uma tarefa para o comparador puro + seu unitário (TDD: teste primeiro).
- Uma tarefa para `types.ts` (DTOs) — sem teste próprio (tipo).
- Uma tarefa para o service `makeGetFollowSuggestions` + seu `*.service.spec.ts` de integração (TDD: cenários da spec como testes primeiro).
- Uma tarefa para controller + rota + `get-follow-suggestions.routes.spec.ts` (200/401/não-sombreamento).
- Uma tarefa para registro no Awilix (`register-services.ts`).
- Uma tarefa para o delta no `docs/openapi.yaml` + `redocly lint`.
- Uma tarefa para os guias de fluxo (`follow-flow.md`, `feed-flow.md`).
- Uma tarefa final: rodar suíte completa + `typecheck` + `lint` + conferir o checklist da Definição de Pronto da spec.

**Ordenação**:
- TDD: comparador unitário e cenários do service (integração) escritos antes da implementação.
- Dependência: `types.ts` + métodos de repositório → service → controller/rota → registro DI → contrato/docs.
- `[P]` para arquivos independentes: interface/impl de `follows` e de `users` podem ir em paralelo; comparador puro em paralelo com os métodos de repositório; guias de fluxo em paralelo com o delta do openapi.

## Rastreio de Complexidade

Sem violações da constituição. Nada a justificar.

| Violação | Por que é necessária | Alternativa mais simples rejeitada e por quê |
|---|---|---|
| — | — | — |

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — sem `design/` no repo)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
