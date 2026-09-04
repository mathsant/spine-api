# Plano de Implementação: Reviews

**Branch**: `005-reviews` | **Data**: 2026-09-04 | **Spec**: [specs/005-reviews/spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/005-reviews/spec.md`

## Resumo

Permitir que o usuário avalie um livro (nota 1–5 + texto opcional + flag de spoiler) atrelada
a uma `ReadingSession` própria `finished`; editar parcialmente e apagar essa review; e fazer o
detalhe do `Book` (`GET` já existente da 003) parar de sempre devolver `averageRating: null` e
`reviewCount: 0`, passando a calculá-los a partir das reviews reais. Abordagem: novo domínio
`reviews` (coleção `reviews`, 1:1 com `reading_sessions` via índice único em `sessionId`),
seguindo exatamente o padrão em camadas já usado por `reading-sessions` (003) e `follows` (004)
— nenhuma dependência nova, nenhuma decisão de stack em aberto.

## Contexto Técnico

**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova nesta feature** — média e contagem de rating são uma agregação nativa do MongoDB (`$group` com `$avg`/`$sum`) sobre a nova coleção `reviews`
**Armazenamento**: MongoDB — coleção nova `reviews` criada por 1 migration `migrate-mongo` reversível (índice único em `sessionId` para a relação 1:1 com `ReadingSession`, índice em `bookId` para a agregação do detalhe do livro); `mongodb-memory-server` ^11 nos testes de integração (inclusive da agregação `$group`)
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (services de `reviews`, extensão de `get-book`/`delete-reading-session`) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; agregação de nota média/contagem é uma consulta indexada por `bookId` sobre `reviews` (mesmo custo de ordem de grandeza que `countDistinctFinishedReaders` já usado no detalhe do livro); embutir a review no histórico de reading sessions usa uma única consulta `$in` por página (sem N+1)
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; services não importam Fastify; nenhum `export default`; no máximo uma `Review` por `sessionId` (índice único); toda operação de review sobre uma `ReadingSession`/`Review` que não pertence ao usuário autenticado (ou não existe) responde `404` (`ReadingSessionNotFoundError`/`ReviewNotFoundError`), nunca `403` (D7/D9, mesmo padrão das features 003/004); criar review exige `ReadingSession.status === 'finished'` (senão `409`); apagar uma `ReadingSession` apaga sua `Review` em cascata
**Escala/escopo**: 3 endpoints novos (`POST /v1/reading-sessions/:sessionId/review`, `PATCH /v1/reviews/:reviewId`, `DELETE /v1/reviews/:reviewId`) + extensão de 2 endpoints existentes (`GET` de book detail da 003 ganha agregados reais; `GET /v1/me/reading-sessions` da 003 ganha `review` embutido); 1 coleção nova + 1 migration; 1 entidade persistida nova (`Review`); 3 classes de erro novas (`ReviewNotFoundError`, `ReadingSessionNotFinishedError`, `ReviewAlreadyExistsError`) + reuso de `ReadingSessionNotFoundError`; 3 services novos (`create-review`, `edit-review`, `delete-review`) + 2 services estendidos (`get-book`, `delete-reading-session`) + 1 mapeamento estendido (`list-reading-sessions`/`to-dto` de reading-sessions); 1 repository novo (`reviews`); 1 pasta de domínio nova em `controllers`/`services`/`repositories`/`schemas` (`reviews`)

## Verificação da Constituição

*Gate obrigatório: rodado antes da Fase 0 e novamente após a Fase 1. Consulte `.specify/memory/constitution.md`.*

- [x] Idioma do código: inglês em todo artefato técnico (identificadores, arquivos, branches, commits, schema)
- [x] P1 Testes por tipo de código: regra de negócio coberta por integração com `mongodb-memory-server` (sem mock de banco), demais funções por unitário; cobertura de regra de negócio ≥ 70% com caminho feliz + ≥1 caminho de erro
- [x] P2 Acesso a dados só via repositório: interface + implementação separadas e injetadas; domínio não toca o driver do MongoDB
- [x] P3 Validação de entrada com `zod` na borda antes de alcançar a regra de negócio
- [x] P4 Mudança de schema/índice apenas via migration versionada e reversível
- [x] P5 Erros de domínio estendem o tipo de erro base; exceção crua de infra não vaza para a borda

Nenhuma violação — feature segue exatamente os padrões já estabelecidos por `reading-sessions`
(003) e `follows` (004). Nada para registrar em "Rastreio de Complexidade".

## Estrutura do Projeto

### Documentos desta feature (`specs/005-reviews/`)

```
specs/005-reviews/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # saída da Fase 0
├── data-model.md         # saída da Fase 1
├── quickstart.md         # saída da Fase 1
├── contracts/            # saída da Fase 1
└── tasks.md               # saída da Fase 2 (gerado pelo /tasks, não pelo /plan)
```

### Código-fonte (raiz do repositório)

Segue a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`,
com um domínio novo (`reviews`) e extensões pontuais em `books`/`reading-sessions` existentes:

```
src/
├── controllers/
│   └── reviews/
│       ├── reviews.routes.ts               # POST .../review, PATCH/DELETE /reviews/:reviewId
│       ├── create-review.controller.ts
│       ├── edit-review.controller.ts
│       ├── delete-review.controller.ts
│       └── index.ts
├── services/
│   ├── reviews/
│   │   ├── create-review.service.ts
│   │   ├── edit-review.service.ts
│   │   ├── delete-review.service.ts
│   │   ├── to-dto.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── books/
│   │   └── get-book.service.ts             # ALTERADO: aggregates reais via reviewRepository
│   └── reading-sessions/
│       ├── delete-reading-session.service.ts  # ALTERADO: cascade via reviewRepository
│       ├── list-reading-sessions.service.ts   # ALTERADO: embute review por sessionId
│       ├── to-dto.ts                          # ALTERADO: ReadingSessionDTO ganha `review`
│       └── types.ts                           # ALTERADO: `review: ReviewDTO | null`
├── repositories/
│   └── reviews/
│       ├── review.repository.ts
│       ├── mongo-review.repository.ts
│       └── index.ts
├── schemas/
│   └── reviews/
│       ├── create-review.schema.ts
│       ├── edit-review.schema.ts
│       └── index.ts
└── errors/
    ├── review-not-found-error.ts
    ├── review-already-exists-error.ts
    └── reading-session-not-finished-error.ts

migrations/
└── <timestamp>-create-reviews-collection.js

tests/
├── unit/schemas/reviews/{create-review,edit-review}.schema.spec.ts
└── integration/
    ├── repositories/reviews/mongo-review.repository.spec.ts
    ├── services/reviews/{create-review,edit-review,delete-review}.service.spec.ts
    ├── services/books/get-book.service.spec.ts          # caso novo: aggregates reais
    ├── services/reading-sessions/delete-reading-session.service.spec.ts  # caso novo: cascade
    ├── services/reading-sessions/list-reading-sessions.service.spec.ts   # caso novo: review embutida
    └── http/reviews.routes.spec.ts
```

## Fase 0: Pesquisa

Nenhum `[NEEDS CLARIFICATION]` no Contexto Técnico — toda decisão de stack já veio de
`architecture.md`/`constitution.md` e das features anteriores. As únicas decisões de design
específicas desta feature (nenhuma é incógnita de stack, mas merecem registro por não serem
óbvias) estão em `research.md`: denormalizar `bookId` em `Review`, tradução de erro de índice
único (11000) em `ReviewAlreadyExistsError`... (ver arquivo).

**Saída**: `research.md`.

## Fase 1: Design & Contratos

1. `data-model.md`: entidade `Review`, índices, DTOs (`ReviewDTO`, extensão de `ReadingSessionDTO`
   e `BookDetailDTO`), regras de transição.
2. `contracts/`: `reviews.openapi.yaml` (3 endpoints novos + 2 alterados), `error-codes.md`,
   `internal-ports.md` (interfaces `ReviewRepository`, services novos, extensões).
3. Casos de teste de integração extraídos dos 14 cenários de aceitação + casos de borda do
   `spec.md`.
4. `quickstart.md` com os passos manuais (curl) para validar a feature ponta a ponta.
5. `design/` não existe neste projeto (API pura, sem UI) — passo de mapeamento de telas não
   se aplica.
6. Rodar `.specify/scripts/bash/update-agent-context.sh` para atualizar `CLAUDE.md`.

**Saída**: `data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md` atualizado.

## Fase 2: Abordagem de Planejamento de Tarefas

*Esta seção descreve o que o comando `/tasks` fará — não executado aqui.*

**Estratégia de geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md` como base.
- 1 tarefa de migration (coleção + 2 índices) antes de tudo que toca `reviews`.
- 1 tarefa por classe de erro nova (`ReviewNotFoundError`, `ReadingSessionNotFinishedError`).
- Repository `ReviewRepository` (interface + `MongoReviewRepository` + teste de integração)
  antes dos services que dependem dele.
- Por operação nova (`create`, `edit`, `delete` review): schema zod (+ teste unitário) → service
  (+ teste de integração, TDD: teste antes) → controller → wiring de rota/DI → teste HTTP.
- Extensões (`get-book`, `delete-reading-session`, `list-reading-sessions`/`to-dto`): teste de
  integração do caso novo antes do ajuste no código, mesmo padrão TDD.
- Tarefa final: registro no container (`register-repositories.ts`/`register-services.ts`),
  barrel `index.ts` de cada camada, `app.ts` importando `reviewsRoutes`.

**Estratégia de ordenação**:
- Ordem TDD: teste antes do código que o satisfaz, em cada operação.
- Ordem de dependência: migration → erros → repository → services → controllers → rotas → DI.
- Marcar `[P]` tarefas em arquivos distintos sem dependência entre si (ex.: os 2 schemas zod;
  os 3 controllers, depois de seus services prontos).

## Rastreio de Complexidade

*Vazio — nenhuma violação da Verificação da Constituição.*

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — sem `design/` no projeto)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
