# Plano de Implementação: Lacunas de contrato de leitura/descoberta para o front-end

**Branch**: `010-readingcontractgaps` | **Data**: 2026-09-05 | **Spec**: [spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/010-readingcontractgaps/spec.md`

## Resumo

Fechar cinco lacunas de contrato do backend que a feature de front-end `002-reading-books` descobriu, sem tocar em auth, aprovação de follow ou no modelo de `Review`:

1. **`pageCount`** (inteiro, anulável) no `Book` cacheado, vindo de `number_of_pages_median` do Open Library, com preenchimento **lazy** (sem migration de dados).
2. **`GET /books/{olid}/reviews`** — reviews de um livro por quem o solicitante segue (aprovado), no máximo uma por seguidor (a da session `finished` mais recente), sem a própria review, paginado por cursor.
3. **`GET /books/popular-among-following`** — top-20 livros por nº de seguidos distintos com qualquer reading session do livro (all-time), excluindo o que o solicitante já conhece, sem paginação.
4. **`GET /me/reading-sessions`** — parâmetro `status` (`reading|finished`) e ordenação `reading`→`finished`, `createdAt` desc, com cursor estável (formato de cursor muda, sem retrocompatibilidade).
5. **`book` embutido** (`title`, `authors`, `coverUrl`, `pageCount`) só nos itens de `GET /me/reading-sessions`.

Abordagem técnica (detalhe em [research.md](./research.md)): mapear `number_of_pages_median` no `HttpOpenLibraryClient` e propagar `pageCount` pelo `BookRecord`/DTOs; dois serviços novos no domínio `books` que reaproveitam `followRepository.listFolloweeIds` (filtro P6, igual ao feed) e o batch-load de `get-feed.service.ts`; três métodos de agregação novos no `ReadingSessionRepository`; codec de cursor dedicado à reading-session carregando `status`; uma migration `migrate-mongo` só de índices.

## Contexto Técnico

**Linguagem/versão**: TypeScript ~5.9 (`strict`, `module: commonjs`, `target: es2016`) sobre Node.js v24. Sem mudança.
**Dependências principais**: Fastify 5, Awilix (`@fastify/awilix`) para DI, driver nativo `mongodb` 7, `zod` 4. Nenhuma dependência de runtime nova. `@redocly/cli` (devDependency já existente, da feature 009) é usada por `pnpm docs:lint`.
**Armazenamento**: MongoDB (driver nativo, sem ODM), migrations com `migrate-mongo`. Esta feature **não cria coleção**; adiciona **3 índices** (1 migration) e **1 campo opcional** sem índice (`books.pageCount`, sem migration — schemaless, preenchimento lazy).
**Testes**: Vitest, dois *projects* (`unit` / `integration`). Regra de negócio → integração com `mongodb-memory-server` (sem mock de banco), ≥ 70% cobertura, caminho feliz + ≥1 erro. Funções puras (mappers, schemas zod, cursor codec) → unitário isolado. Verificação de docs: `pnpm docs:lint` + cruzamento de rotas/schemas.
**Plataforma-alvo**: servidor (API HTTP), consumida pelo app web da `002-reading-books` e por ferramentas OpenAPI.
**Tipo de projeto**: single (monolito backend em camadas `controller → service → repository`). Esta feature não altera as camadas, só adiciona operações e um campo.
**Metas de performance**: N/A explícito. Os índices novos (research D7) evitam collection scan nas 3 queries novas conforme a base cresce.
**Restrições**: sem mudança em auth, em `follow-requests`/aprovação, nem no modelo persistido de `Review` e `ReadingSession` (só consulta/serialização). Nomes de arquivo/identificador em inglês; prosa dos artefatos SDD em português. Exemplos nos docs com dados fictícios.
**Escala/escopo**: 2 endpoints novos + 1 alterado + 1 campo novo em 4 superfícies de livro. ~6 arquivos de serviço/controller novos, ~10 arquivos existentes tocados, 3 métodos de repositório novos, 1 migration, 1 codec de cursor, delta no `docs/openapi.yaml` + 3 guias em `docs/`.

## Verificação da Constituição

*Gate rodado antes da Fase 0 e revalidado após a Fase 1.*

- [x] **Idioma do código: inglês** — todos os identificadores/arquivos novos em inglês (`listBookReviewsByFollowing`, `list-popular-among-following.service.ts`, `reading-session-cursor.ts`, índice `reading_sessions_userId_status_createdAt`). Prosa SDD em português (permitido). ✅
- [x] **P1 Testes por tipo de código** — regra de negócio nova (`listBookReviewsByFollowing`, `listPopularAmongFollowing`, `listReadingSessions` alterado, e os 3 métodos de repositório) coberta por integração com `mongodb-memory-server`; mappers/`to-dto`, schemas zod e o cursor codec por unitário. Cada regra com caminho feliz + ≥1 erro (404, filtro P6 vazio, cursor inválido). Alvo ≥ 70%. Detalhado em [contracts/behavior-checklist.md](./contracts/behavior-checklist.md). ✅
- [x] **P2 Acesso a dados só via repositório** — nenhum acesso ao driver fora de `src/repositories/**`. Os serviços novos dependem de interfaces (`ReadingSessionRepository`, `ReviewRepository`, `FollowRepository`, `UserRepository`, `BookRepository`, `ShelfMembershipRepository`) resolvidas pelo cradle do Awilix. As agregações novas ficam **dentro** das implementações `mongo-*`. ✅
- [x] **P3 Validação com `zod` na borda** — `list-book-reviews.schema.ts` (`cursor?`, `limit`) e a alteração de `list-reading-sessions.schema.ts` (`status` como `z.enum`). `popular-among-following` não tem input de cliente (ou só um `limit` fixo no serviço). Cursor malformado → `ValidationError` no `decodeReadingSessionCursor`. ✅
- [x] **P4 Mudança de schema/índice só via migration** — os 3 índices novos vão numa migration `migrate-mongo` reversível (`add-reading-contract-gaps-indexes`, `up`/`down` por nome). O campo `books.pageCount` **não** dispara P4: MongoDB é schemaless, não há índice sobre ele e não há backfill/transformação de documentos existentes (preenchimento lazy no próximo `upsertByOlid`). Justificativa completa em research D2/D7. ✅
- [x] **P5 Erros de domínio a partir do tipo base** — nenhum erro novo. Reuso de `BookNotFoundError` (404), `ValidationError` (400), `UnauthenticatedError` (401), todos já estendendo `AppError`. Exceção crua do driver continua capturada nas implementações de repositório. ✅

**Resultado**: sem violações. Seção "Rastreio de Complexidade" vazia.

## Estrutura do Projeto

### Documentos desta feature (`specs/010-readingcontractgaps/`)

```
specs/010-readingcontractgaps/
├── spec.md
├── plan.md                      # este arquivo
├── research.md                  # Fase 0 — 8 decisões (D1–D8)
├── data-model.md                # Fase 1 — delta de entidades + DTOs + métodos de repo
├── quickstart.md                # Fase 1 — validação manual
├── contracts/
│   ├── openapi-delta.md         # tudo que muda em docs/openapi.yaml
│   └── behavior-checklist.md    # RF → teste/checagem
└── tasks.md                     # Fase 2 (gerado pelo /tasks — não por este comando)
```

### Código-fonte (raiz do repositório)

Segue a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`. Monolito em camadas, um arquivo por operação, `index.ts` por pasta de domínio, exports nomeados.

```
src/
├── integrations/open-library/
│   ├── open-library-client.ts            # [M] + pageCount em OpenLibrarySearchResult
│   └── http-open-library-client.ts       # [M] toResult() mapeia number_of_pages_median
├── repositories/
│   ├── books/
│   │   ├── book.repository.ts             # [M] pageCount em BookRecord / UpsertBookInput
│   │   └── mongo-book.repository.ts       # [M] $set de pageCount no upsertByOlid; toRecord
│   ├── reading-sessions/
│   │   ├── reading-session.repository.ts  # [M] listByUser(filter.status); +2 métodos novos
│   │   └── mongo-reading-session.repository.ts  # [M] sort/keyset; findLatestFinishedPerUserForBook; aggregatePopularBookIdsForReaders; listBookIdsForUser
│   └── shelf-memberships/
│       ├── shelf-membership.repository.ts # [M] +listBookIdsForUser
│       └── mongo-shelf-membership.repository.ts # [M]
├── services/
│   ├── books/
│   │   ├── types.ts                       # [M] pageCount em BookSearchResultDTO; +BookReviewByFollowingDTO; +PopularAmongFollowingDTO
│   │   ├── get-book.service.ts            # [M] toDTO inclui pageCount
│   │   ├── list-want-to-read.service.ts   # [M] toResultDTO inclui pageCount
│   │   ├── list-book-reviews.service.ts   # [N] regra de negócio de GET /books/{olid}/reviews
│   │   ├── list-popular-among-following.service.ts  # [N]
│   │   └── index.ts                       # [M] re-exports
│   └── reading-sessions/
│       ├── types.ts                       # [M] ReadingSessionBookDTO; book no item de listagem
│       ├── to-dto.ts                      # [M] toReadingSessionDTO aceita book?; (ou to-dto de listagem separado)
│       └── list-reading-sessions.service.ts  # [M] passa status; batch-load de books
├── schemas/
│   ├── books/
│   │   ├── list-book-reviews.schema.ts    # [N] cursor?, limit
│   │   ├── list-popular-among-following.schema.ts  # [N] (vazio ou limit fixo)
│   │   └── index.ts                       # [M]
│   └── reading-sessions/
│       └── list-reading-sessions.schema.ts  # [M] + status: z.enum(['reading','finished']).optional()
├── controllers/books/
│   ├── books.routes.ts                    # [M] GET /books/popular-among-following (ANTES de /books/:olid) e GET /books/:olid/reviews
│   ├── list-book-reviews.controller.ts    # [N]
│   ├── list-popular-among-following.controller.ts  # [N]
│   └── index.ts                           # [M]
├── lib/
│   ├── reading-session-cursor.ts          # [N] encode/decodeReadingSessionCursor ({status,createdAt,id})
│   └── index.ts                           # [M] re-export
└── container/
    └── register-services.ts               # [M] registra listBookReviewsByFollowingService, listPopularAmongFollowingService com deps

migrations/
└── <ts>-add-reading-contract-gaps-indexes.js   # [N] via `npx migrate-mongo create`

tests/
├── unit/
│   ├── lib/reading-session-cursor.spec.ts
│   ├── schemas/books/list-book-reviews.schema.spec.ts
│   ├── schemas/reading-sessions/list-reading-sessions.schema.spec.ts       # [M] casos de status
│   ├── integrations/open-library/http-open-library-client.spec.ts         # [M] mapeamento pageCount (se já existir)
│   └── services/**/to-dto.spec.ts                                         # book embutido, author block
└── integration/
    ├── services/books/list-book-reviews.service.spec.ts
    ├── services/books/list-popular-among-following.service.spec.ts
    ├── services/books/get-book.service.spec.ts                            # [M] pageCount
    ├── services/reading-sessions/list-reading-sessions.service.spec.ts    # [M] status, ordenação, cursor, book
    └── repositories/reading-sessions/mongo-reading-session.repository.spec.ts  # [M] os 3 métodos

docs/
├── openapi.yaml                 # [M] ver contracts/openapi-delta.md
├── flows/reading-flow.md        # [M]
├── flows/review-flow.md         # [M]
└── pagination-guide.md          # [M]
```

`[N]` novo, `[M]` modificado.

## Fase 0: Pesquisa

Concluída — ver [research.md](./research.md). 8 decisões, nenhum `[NEEDS CLARIFICATION]` remanescente:

- **D1** origem/propagação de `pageCount` (`number_of_pages_median`, mapear no `toResult`, sem cache no fluxo de busca).
- **D2** `pageCount` lazy, sem migration de dados (não dispara P4).
- **D3** `GET /books/{olid}/reviews`: 1 review por seguidor (session `finished` mais recente); novo método `findLatestFinishedPerUserForBook`.
- **D4** bloco de autor com `avatarUrl: null` fixo (convenção já usada em `UserSearchResult`).
- **D5** `popular-among-following`: `$addToSet`+`$size`, exclui já-conhecidos, top-20 sem cursor.
- **D6** `GET /me/reading-sessions`: `sort({status:-1,createdAt:-1,_id:-1})`, cursor `{status,createdAt,id}`, keyset de 3 chaves, quebra de compatibilidade documentada.
- **D7** 1 migration com 3 índices de apoio.
- **D8** caminho de cada peça (domínio `books` para os 2 endpoints; cursor codec em `src/lib`).

## Fase 1: Design & Contratos

Concluída — artefatos gerados:

- **[data-model.md](./data-model.md)** — delta de `Book` (+`pageCount`), índices novos em `reading_sessions`/`reviews`, 3 métodos de repositório novos, DTOs (`BookReviewByFollowingDTO`, `PopularAmongFollowingDTO`, `ReadingSessionBookDTO`), reuso de erros.
- **[contracts/openapi-delta.md](./contracts/openapi-delta.md)** — 2 `paths` novos, 1 alterado, 6 schemas novos, `BookSearchResult` + `pageCount`, guias de `docs/` a atualizar, passos de verificação (`pnpm docs:lint`).
- **[contracts/behavior-checklist.md](./contracts/behavior-checklist.md)** — cada RF-001..032 → teste (INT/UNI) ou checagem DOC; marca os dois checks de privacidade P6 da DoD.
- **[quickstart.md](./quickstart.md)** — semente de dados (A segue B aprovado, C não seguido) e `curl` de validação para as 5 mudanças + não-regressão do `book` embutido.
- **Telas contra `design/`**: N/A — não há pasta `design/` e a feature não tem UI (registrado em research.md).
- **`CLAUDE.md`**: atualizado via `.specify/scripts/bash/update-agent-context.sh` (bloco `SDD:AUTO-GERADO`).

**Revalidação da Constituição pós-design**: sem violação nova. O par `allOf: [ReadingSession, {…}]` do `ReadingSessionListItem` replica um padrão já presente no `openapi.yaml` (`BookDetail`) — decisão de consistência, não de complexidade. `ReadingSessionCursorPage` pode ficar órfão no schema após a listagem passar a usar `ReadingSessionListCursorPage`; o `/tasks` decide entre manter (documentado) ou remover se o lint acusar.

## Fase 2: Abordagem de Planejamento de Tarefas

*Descrição do que o `/tasks` fará — não executar agora.*

**Estratégia de geração**:
- Uma trilha por bloco funcional: (A) `pageCount`, (B) `GET /books/{olid}/reviews`, (C) `GET /books/popular-among-following`, (D) `status`+ordenação de `/me/reading-sessions`, (E) `book` embutido, (F) migration de índices, (G) `docs/`.
- Dentro de cada trilha, ordem TDD: teste (unit/integration conforme o tipo) antes da implementação.
- Ordem entre camadas: schema/tipos → repositório (interface antes de implementação) → serviço → controller/rota → registro no container → docs.
- Dependências entre trilhas: (A) antes de (C) e (E) (ambas expõem `pageCount`); (F) antes das trilhas que dependem dos índices em integração ser rápida, mas não bloqueia correção; (D) e (E) tocam os mesmos arquivos (`list-reading-sessions.service.ts`, `to-dto.ts`, `types.ts`) — mesma trilha sequencial, sem `[P]` entre elas.
- `[P]` para arquivos independentes: os schemas zod novos, o cursor codec + seu teste, os mappers `to-dto`, os guias de `docs/` distintos.

**Estratégia de ordenação (resumo)**:
1. `pageCount` ponta a ponta (integration client → repo → DTOs → 4 superfícies) + testes.
2. Migration de índices.
3. Cursor codec (`src/lib/reading-session-cursor.ts`) + unit.
4. `ReadingSessionRepository`: `listByUser(status)` + keyset; `findLatestFinishedPerUserForBook`; `aggregatePopularBookIdsForReaders`; `listBookIdsForUser` (+ `ShelfMembershipRepository.listBookIdsForUser`) + integration.
5. Serviços `list-book-reviews` e `list-popular-among-following` + controllers + rotas + registro DI + integration.
6. `list-reading-sessions.service` (status + batch `book`) + `to-dto` + integration; ajustar testes existentes da ordenação.
7. `docs/openapi.yaml` delta + guias + `pnpm docs:lint`.
8. `quickstart.md` manual + fechamento da DoD; enviar nomes finais para `spine-frontend`.

**Não** gerar `tasks.md` aqui.

## Rastreio de Complexidade

*Vazio — nenhuma violação da Constituição a justificar.*

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — sem `design/`, feature sem UI)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
