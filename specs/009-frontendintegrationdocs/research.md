# Pesquisa — Documentação de Integração para o Front-end + Prompt de Design

## Decisão 1: ferramenta de validação do OpenAPI unificado

**Decisão**: adicionar `@redocly/cli` como devDependency e criar o script `npm run docs:lint` → `redocly lint docs/openapi.yaml`.

**Justificativa**: a Definição de Pronto da spec exige explicitamente que o OpenAPI unificado "valide sem erros num validador de schema" (RF da DoD). `@redocly/cli` é mantido ativamente, valida OpenAPI 3.0/3.1 completo (não só sintaxe JSON Schema), dá mensagens de erro específicas por linha, e a mesma ferramenta pode depois gerar uma página de referência navegável (`redocly build-docs`) sem exigir nova dependência caso o usuário queira isso no futuro. Custo: 1 devDependency nova, sem impacto em runtime nem em `src/`.

**Alternativas consideradas**:
- `swagger-cli validate`: mais simples, mas só valida sintaticamente contra o schema do OpenAPI, sem lint de boas práticas (ex.: resposta de erro sem `description`, endpoint sem `operationId`). Rejeitada por dar sinal mais fraco.
- `@stoplight/spectral-cli`: também viável e popular, mas exige um arquivo de ruleset próprio (`.spectral.yaml`) para ativar as regras de OpenAPI — passo extra sem benefício sobre o preset já embutido do `@redocly/cli` para este caso de uso pontual.
- Validação manual (abrir no Swagger Editor à mão): rejeitada — não é repetível nem verificável em CI/tarefa, viola o critério objetivo da DoD.

## Decisão 2: abordagem de consolidação dos 8 OpenAPI + 8 catálogos de erro existentes

**Decisão**: consolidação **editorial manual, cross-referenciada contra o código-fonte atual** (`src/controllers/**/*.routes.ts`, `src/schemas/**`, `src/errors/*.error.ts`) — não construir um gerador automático de OpenAPI a partir dos schemas `zod`.

**Justificativa**: os 8 OpenAPI e `error-codes.md` por feature já têm ~90% do conteúdo correto (foram escritos por spec, e o código evoluiu a partir deles); o trabalho real é reorganizar por domínio, remover duplicação, e corrigir os pontos onde o código diverge do que a spec previu — não gerar do zero. Construir um pipeline `zod → OpenAPI` seria uma dependência nova (`zod-to-openapi` ou similar) e uma peça de automação permanente para resolver um problema que é, nesta rodada, um trabalho de edição único. Nenhuma feature futura foi pedida para manter esse pipeline vivo.

**Alternativas consideradas**:
- Gerar o OpenAPI automaticamente a partir dos schemas `zod` (ex.: `@fastify/swagger` + `zod-to-openapi`): mais "correto" a longo prazo (o contrato nunca fica desatualizado), mas é uma mudança de arquitetura do backend (novo plugin Fastify, novos schemas anotados) fora do escopo desta spec, que é só de documentação. Rejeitada por escopo — pode virar uma feature própria no futuro se o time sentir a dor de manter `docs/openapi.yaml` manualmente.
- Concatenar os 8 arquivos sem cross-check contra o código: rejeitada explicitamente pela spec (RF-002, RF-012) — herdaria qualquer divergência não corrigida durante a implementação.

## Cobertura verificada nesta fase

- **Endpoints**: 43 rotas HTTP em 12 arquivos `*.routes.ts` (`auth`: 6, `books`: 7, `comments`: 3, `feed`: 1, `follows`: 9, `health`: 1, `notifications`: 4, `profile`: 1, `reactions`: 2, `reading-sessions`: 5, `reviews`: 3, `users`: 1). Todos devem aparecer no `docs/openapi.yaml` (RF-001).
- **Contratos já existentes a consolidar**: `specs/001-backendappsetup/contracts/health.openapi.yaml`, `specs/002-authregistration/contracts/auth.openapi.yaml`, `specs/003-bookcatalogflow/contracts/books.openapi.yaml`, `specs/004-profilefollow/contracts/profile-follow.openapi.yaml`, `specs/005-reviews/contracts/reviews.openapi.yaml`, `specs/006-activityfeed/contracts/feed.openapi.yaml`, `specs/007-interactions/contracts/interactions.openapi.yaml`, `specs/008-notificationflow/contracts/notifications.openapi.yaml`.
- **Catálogos de erro já existentes a consolidar**: um `error-codes.md` por pasta acima (exceto `001-backendappsetup`, que define só o envelope genérico em `error-response.schema.json`).
- **Classes de erro no código** (fonte da verdade para o catálogo consolidado): `src/errors/*.error.ts` — a varredura completa da lista é tarefa de implementação (`/tasks`), não desta fase de pesquisa.

## Nenhum `[NEEDS CLARIFICATION]` restante

Todas as incógnitas técnicas do Contexto Técnico do `plan.md` foram resolvidas acima.
