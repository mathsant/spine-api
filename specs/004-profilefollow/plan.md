# Plano de Implementação: Profile & Follow — perfil próprio, busca de usuário e grafo de follow

**Branch**: `004-profilefollow` | **Data**: 2026-09-04 | **Spec**: [specs/004-profilefollow/spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/004-profilefollow/spec.md`

## Resumo

A pessoa autenticada edita o próprio perfil (`displayName` + `bio` novos; `handle` continua
imutável), busca outros usuários por `@handle`/`displayName` (retorno mínimo, P14) e opera o
grafo de follow assimétrico com aprovação (P1/P13): pedir, cancelar, aprovar, recusar, deixar
de seguir, remover seguidor, e listar as próprias listas de seguidores/seguindo/pedidos
pendentes. Abordagem técnica (Fase 0): duas coleções novas (`follow_requests` só pendentes,
`follows` só aprovados — D4) chaveadas pelo par de usuários em vez de um id de recurso
intermediário (D5); busca de usuário via índice de texto do MongoDB já decidido em
`product.md` (D2), paginada por página como `books/search` por não ter chave de cursor
estável em resultados ordenados por relevância (D3); listas internas (seguidores/seguindo/
pedidos) por cursor, mesmo mecanismo de `src/lib/pagination.ts` já usado em 003. `GET /v1/me`
(feature 002) só ganha o campo `bio`, sem endpoint de leitura novo (D1).

## Contexto Técnico

<!-- Esta seção é lida pelo update-agent-context.sh para atualizar o CLAUDE.md do projeto. -->

**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova nesta feature** — busca de usuário via índice de texto nativo do MongoDB (`$text`/`$meta: 'textScore'`), sem lib de busca externa
**Armazenamento**: MongoDB — coleções novas `follow_requests` e `follows` criadas por 2 migrations `migrate-mongo` reversíveis; `users` ganha um índice de texto (`displayName`+`handle`) por uma 3ª migration; `mongodb-memory-server` ^11 nos testes de integração (inclusive do `$text` — suportado em memória)
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (services de profile/users/follows) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; busca de usuário é uma consulta com índice de texto (sem chamada de rede externa, diferente de `books/search`); paginação cursor/página evita `skip` profundo nas listas que crescem (mesmo padrão de 003)
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; services não importam Fastify; nenhum `export default`; `handle` nunca é aceito em nenhum payload de escrita desta feature (imutabilidade, P11); no máximo um `FollowRequest` pendente por par ordenado `(requester, target)` e uma `Follow` por par ordenado `(follower, followee)` (índices únicos compostos); recurso de terceiro (pedido/relação que não é meu) responde `404`, nunca `403` (D7, mesmo padrão D9 da 003); listas de seguidores/seguindo só existem para o próprio dono — nenhuma rota aceita `:userId` de terceiro para essas listas (RF-020)
**Escala/escopo**: 10 endpoints (`PATCH /v1/me`, `GET /v1/users/search`, `POST`/`DELETE /v1/users/:userId/follow-request`, `POST /v1/users/:userId/follow-request/approve`, `POST /v1/users/:userId/follow-request/reject`, `DELETE /v1/users/:userId/follow`, `DELETE /v1/users/:userId/follower`, `GET /v1/me/follow-requests`, `GET /v1/me/followers`, `GET /v1/me/following`) + extensão de `GET /v1/me` já existente; 2 coleções novas + 1 índice novo em coleção existente, 3 migrations; 2 entidades persistidas novas (`FollowRequest`, `Follow`) + extensão de `User`; 4 classes de erro novas; 10 services novos; 2 repositories novos (`follow-requests`, `follows`) + extensão do `UserRepository`; 3 pastas de domínio novas em `controllers`/`services` (`profile`, `users`, `follows`)

## Verificação da Constituição

*Gate obrigatório: rodado antes da Fase 0 e novamente após a Fase 1. Consulte `.specify/memory/constitution.md`.*

- [x] Idioma do código: inglês em todo artefato técnico (identificadores, arquivos, branches, commits, schema) — `FollowRequest`/`Follow`/`ProfileDTO` etc., branch `004-profilefollow`
- [x] P1 Testes por tipo de código: regra de negócio (os 10 services) coberta por integração com `mongodb-memory-server` (sem mock de banco); `search-users`/`send-follow-request`/etc. testam caminho feliz + ≥1 erro (self-follow, already-following, not-found); cobertura ≥ 70% mantida
- [x] P2 Acesso a dados só via repositório: `FollowRequestRepository`/`FollowRepository` novos (interface + `Mongo*` impl); `UserRepository` só ganha métodos, mesma interface/impl já existente; nenhum service toca o driver
- [x] P3 Validação de entrada com `zod` na borda: `edit-profile.schema.ts`, `search-users.schema.ts`, `list-follow-requests.schema.ts` (query `direction`), reaproveitando os schemas de cursor/limit já existentes de 003 onde aplicável
- [x] P4 Mudança de schema/índice apenas via migration: `create-follow-requests-collection`, `create-follows-collection`, `add-users-text-search-index` — todas reversíveis (`down` remove coleção/índice)
- [x] P5 Erros de domínio estendem o tipo de erro base: `CannotFollowSelfError`, `AlreadyFollowingError`, `FollowRequestNotFoundError`, `FollowNotFoundError` estendem `AppError`; `NotFoundError` genérica (já existe) reaproveitada para `:userId` inexistente

Nenhuma violação — nada a registrar em "Rastreio de Complexidade".

## Estrutura do Projeto

### Documentos desta feature (`specs/004-profilefollow/`)

```
specs/004-profilefollow/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # saída da Fase 0
├── data-model.md         # saída da Fase 1
├── quickstart.md         # saída da Fase 1
├── contracts/            # saída da Fase 1
│   ├── profile-follow.openapi.yaml
│   ├── error-codes.md
│   └── internal-ports.md
└── tasks.md               # saída da Fase 2 (gerado pelo /tasks, não pelo /plan)
```

### Código-fonte (raiz do repositório)

Segue `.specify/memory/architecture.md` (monolito em camadas, um arquivo por operação,
kebab-case + sufixo de camada, `pnpm` na prática). Três pastas de domínio novas em
`controllers`/`services` (`profile`, `users`, `follows`); `repositories` ganha duas
(`follow-requests`, `follows`); `users` (repository) só ganha métodos.

```
src/
├── controllers/
│   ├── profile/
│   │   ├── profile.routes.ts
│   │   ├── edit-profile.controller.ts
│   │   └── index.ts
│   ├── users/
│   │   ├── users.routes.ts
│   │   ├── search-users.controller.ts
│   │   └── index.ts
│   └── follows/
│       ├── follows.routes.ts
│       ├── send-follow-request.controller.ts
│       ├── cancel-follow-request.controller.ts
│       ├── approve-follow-request.controller.ts
│       ├── reject-follow-request.controller.ts
│       ├── unfollow.controller.ts
│       ├── remove-follower.controller.ts
│       ├── list-follow-requests.controller.ts
│       ├── list-followers.controller.ts
│       ├── list-following.controller.ts
│       └── index.ts
├── services/
│   ├── profile/
│   │   ├── edit-profile.service.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── users/
│   │   ├── search-users.service.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── follows/
│       ├── send-follow-request.service.ts
│       ├── cancel-follow-request.service.ts
│       ├── approve-follow-request.service.ts
│       ├── reject-follow-request.service.ts
│       ├── unfollow.service.ts
│       ├── remove-follower.service.ts
│       ├── list-follow-requests.service.ts
│       ├── list-followers.service.ts
│       ├── list-following.service.ts
│       ├── types.ts
│       └── index.ts
├── repositories/
│   ├── users/                        # existente — user.repository.ts + mongo-user.repository.ts ganham updateProfile/search
│   ├── follow-requests/
│   │   ├── follow-request.repository.ts
│   │   ├── mongo-follow-request.repository.ts
│   │   └── index.ts
│   └── follows/
│       ├── follow.repository.ts
│       ├── mongo-follow.repository.ts
│       └── index.ts
├── schemas/
│   ├── profile/
│   │   ├── edit-profile.schema.ts
│   │   └── index.ts
│   ├── users/
│   │   ├── search-users.schema.ts
│   │   └── index.ts
│   └── follows/
│       ├── list-follow-requests.schema.ts
│       └── index.ts
└── errors/
    ├── cannot-follow-self-error.ts
    ├── already-following-error.ts
    ├── follow-request-not-found-error.ts
    └── follow-not-found-error.ts
migrations/
├── <timestamp>-create-follow-requests-collection.js
├── <timestamp>-create-follows-collection.js
└── <timestamp>-add-users-text-search-index.js
tests/
├── unit/schemas/{profile,users,follows}/**
└── integration/
    ├── services/{profile,users,follows}/**
    └── http/{profile,users,follows}.routes.spec.ts
```

## Fase 0: Pesquisa

Nenhum `[NEEDS CLARIFICATION]` restou no Contexto Técnico acima — a stack é 100% herdada de
`architecture.md`/`CLAUDE.md`. A pesquisa desta fase resolveu decisões de desenho que a spec
deixou para o `/plan` (onde cada endpoint mora entre domínios, formato de rota do grafo de
follow, paginação da busca vs. das listas internas). Decisões D1–D9 documentadas em
`research.md`.

**Saída**: `research.md` ✅

## Fase 1: Design & Contratos

1. Entidades extraídas da spec → `data-model.md`: extensão de `User` (`bio`), `FollowRequest`,
   `Follow`, erros de domínio, DTOs.
2. Contratos gerados a partir dos RF-001..RF-021 → `contracts/profile-follow.openapi.yaml`,
   `contracts/error-codes.md`, `contracts/internal-ports.md`.
3. Cenários de teste de integração: um arquivo `*.routes.spec.ts` por domínio HTTP novo
   (`profile`, `users`, `follows`), cobrindo os 12 cenários de aceitação + casos de borda da
   spec (rejeitar self-follow, duplicado, 404 de posse, etc.).
4. `quickstart.md` com os passos manuais (duas contas, ciclo completo pedir → cancelar → pedir
   → aprovar → recusar (ciclo oposto) → desfazer pelos dois lados).
5. Sem `design/` no repositório — passo de mapeamento de telas não se aplica (feature é só
   API).
6. `update-agent-context.sh` rodado para propagar a stack desta seção ao `CLAUDE.md`.

**Saída**: `data-model.md` ✅, `contracts/` ✅, `quickstart.md` ✅, `CLAUDE.md` atualizado ✅

### Verificação da Constituição (pós-design)

Nenhuma decisão da Fase 1 introduziu violação nova — `follow_requests`/`follows` como
coleções separadas (D4) e a paginação por página na busca (D3) são escolhas de modelagem
dentro dos princípios já vigentes (repositório com interface própria, migration por mudança
de schema, cursor só onde há chave estável). Gate permanece ✅ igual ao inicial.

## Fase 2: Abordagem de Planejamento de Tarefas

*Esta seção descreve o que o comando `/tasks` fará — NÃO execute isso agora, e NÃO gere `tasks.md` aqui.*

**Estratégia de geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md` como base.
- Uma tarefa por migration (3), por método novo de repositório (`UserRepository.updateProfile`/
  `.search`, `FollowRequestRepository`, `FollowRepository` completos), por service (10), por
  schema `zod` (3), por controller/rota (10 handlers + 3 arquivos `*.routes.ts` + registro em
  `app.ts`), por erro de domínio (4), por registro no container (`register-repositories.ts`,
  `register-services.ts`, `cradle.ts`).
- Uma tarefa de teste de integração HTTP por domínio (`profile`, `users`, `follows`),
  cobrindo os 12 cenários de aceitação + casos de borda listados na spec.
- Atualizar `README.md`/contratos publicados ao final, como em 003.

**Estratégia de ordenação**:
- Ordem TDD: teste de integração do service antes da implementação do service; teste unitário
  do schema antes do schema.
- Ordem de dependência: migrations → repositórios → services → schemas/controllers/rotas →
  registro no container → testes HTTP de ponta a ponta.
- `[P]` para tarefas em arquivos independentes: os 3 domínios (`profile`, `users`, `follows`)
  não têm dependência entre si (só compartilham `UserRepository` já existente e
  `src/lib/pagination.ts`), então migrations/repositórios/services/testes dos três podem
  avançar em paralelo depois que `UserRepository.updateProfile`/`.search` existirem.

## Rastreio de Complexidade

*Preencher SOMENTE se a Verificação da Constituição tiver violações que precisam de justificativa.*

Nenhuma violação — tabela vazia.

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — sem `design/` no repositório, feature é só API)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
