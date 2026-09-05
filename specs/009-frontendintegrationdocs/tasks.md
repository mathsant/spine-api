# Tarefas: Documentação de Integração para o Front-end + Prompt de Design

**Entrada**: `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/009-frontendintegrationdocs/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial.

Esta feature não adiciona código em `src/`, `tests/` nem `migrations/` — todas as tarefas tocam `package.json` ou a nova pasta `docs/`. Não há regra de negócio nova, então não há tarefa de teste `mongodb-memory-server`/unitário nesta lista; a verificação equivalente é o lint do OpenAPI e os checklists de cobertura cruzados contra o código-fonte (ver `quickstart.md`), tratados como as "tarefas de teste" desta feature — cada bloco de conteúdo é seguido por uma tarefa de verificação antes de a próxima fase começar.

Fases (cada uma é um marco entregável):

1. **Setup** — ferramenta de validação do OpenAPI. Marco: `npm run docs:lint` existe e roda (mesmo que ainda sem `docs/openapi.yaml`, falha de forma esperada por "arquivo não encontrado").
2. **Contrato único (OpenAPI)** — `docs/openapi.yaml` cobrindo os 43 endpoints em 12 domínios. Marco: `npm run docs:lint` passa sem erro; 43/43 endpoints presentes.
3. **Catálogo de erros** — `docs/error-catalog.md`. Marco: toda classe de `src/errors/*.error.ts` está na tabela; nenhum `code` diverge do OpenAPI.
4. **Guias transversais** — autenticação, paginação, bloco `viewer`. Marco: os três guias existem e referenciam corretamente endpoints/erros já catalogados.
5. **Guias de fluxo de negócio** — os 7 fluxos do RF-005. Marco: cada fluxo é seguível ponta a ponta sem abrir `product.md` nem o código.
6. **Índice** — `docs/README.md`. Marco: um único ponto de entrada linka todo o resto de `docs/`.
7. **Prompt de design** — `docs/design-prompt.md`. Marco: prompt auto-suficiente, apresentado e aprovado explicitamente pelo usuário.
8. **Verificação final** — checklist completo do `quickstart.md` e registro de divergências (RF-020). Marco: Definição de Pronto do `spec.md` toda marcável.

---

## Fase 1: Setup

- [x] T001 Adicionar `@redocly/cli` em `devDependencies` e o script `"docs:lint": "redocly lint docs/openapi.yaml"` em `scripts`; rodar `npm install`. Arquivo: `package.json`

## Fase 2: Contrato único (OpenAPI)

*Todas as tarefas abaixo editam o mesmo arquivo `docs/openapi.yaml` — sequenciais, sem `[P]`, exceto a leitura de origem que é só consulta.*

- [x] T002 Criar o esqueleto de `docs/openapi.yaml` (OpenAPI 3.1): `info` (título "better-books API", versão `v1`), `servers` (`/v1`), `components.securitySchemes.bearerAuth` (`http`/`bearer`/`JWT`), e as 12 `tags` de domínio (`auth`, `books`, `follows`, `profile`, `users`, `reading-sessions`, `reviews`, `feed`, `comments`, `reactions`, `notifications`, `health`) conforme `data-model.md` (seção "API Contract"). Arquivo: `docs/openapi.yaml`
- [x] T003 Consolidar o domínio `auth` (6 rotas) em `docs/openapi.yaml`: cross-check `src/controllers/auth/auth.routes.ts` + `src/schemas/auth/*.schema.ts` contra `specs/002-authregistration/contracts/auth.openapi.yaml`; corrigir a favor do código qualquer divergência encontrada. Arquivo: `docs/openapi.yaml` (depende de T002)
- [x] T004 Consolidar o domínio `books` (7 rotas): cross-check `src/controllers/books/books.routes.ts` + `src/schemas/books/*.schema.ts` contra `specs/003-bookcatalogflow/contracts/books.openapi.yaml`. Arquivo: `docs/openapi.yaml` (depende de T002)
- [x] T005 Consolidar o domínio `follows` (9 rotas): cross-check `src/controllers/follows/follows.routes.ts` contra `specs/004-profilefollow/contracts/profile-follow.openapi.yaml` (parte de follow). Arquivo: `docs/openapi.yaml` (depende de T002)
- [x] T006 Consolidar os domínios `profile` (1 rota) e `users` (1 rota): cross-check `src/controllers/profile/profile.routes.ts` + `src/controllers/users/users.routes.ts` + `src/schemas/profile/edit-profile.schema.ts` + `src/schemas/users/search-users.schema.ts` contra a parte de perfil/busca em `specs/004-profilefollow/contracts/profile-follow.openapi.yaml`. Arquivo: `docs/openapi.yaml` (depende de T002)
- [x] T007 Consolidar o domínio `reading-sessions` (5 rotas): cross-check `src/controllers/reading-sessions/reading-sessions.routes.ts` + `src/schemas/reading-sessions/*.schema.ts` + `src/controllers/books/{mark-want-to-read,unmark-want-to-read,start-reading,mark-finished,list-want-to-read}.controller.ts` contra `specs/003-bookcatalogflow/contracts/books.openapi.yaml`. Arquivo: `docs/openapi.yaml` (depende de T004)
- [x] T008 Consolidar o domínio `reviews` (3 rotas): cross-check `src/controllers/reviews/reviews.routes.ts` + `src/schemas/reviews/*.schema.ts` contra `specs/005-reviews/contracts/reviews.openapi.yaml`. Arquivo: `docs/openapi.yaml` (depende de T002)
- [x] T009 Consolidar o domínio `feed` (1 rota): cross-check `src/controllers/feed/feed.routes.ts` + `src/schemas/feed/get-feed.schema.ts` contra `specs/006-activityfeed/contracts/feed.openapi.yaml`, incluindo o formato do cursor de paginação. Arquivo: `docs/openapi.yaml` (depende de T002)
- [x] T010 Consolidar os domínios `comments` (3 rotas) e `reactions` (2 rotas): cross-check `src/controllers/comments/comments.routes.ts` + `src/controllers/reactions/reactions.routes.ts` + `src/schemas/comments/*.schema.ts` contra `specs/007-interactions/contracts/interactions.openapi.yaml`. Arquivo: `docs/openapi.yaml` (depende de T002)
- [x] T011 Consolidar o domínio `notifications` (4 rotas): cross-check `src/controllers/notifications/notifications.routes.ts` + `src/schemas/notifications/list-notifications.schema.ts` contra `specs/008-notificationflow/contracts/notifications.openapi.yaml`. Arquivo: `docs/openapi.yaml` (depende de T002)
- [x] T012 Consolidar o domínio `health` (1 rota): cross-check `src/controllers/health/health.routes.ts` contra `specs/001-backendappsetup/contracts/health.openapi.yaml`. Arquivo: `docs/openapi.yaml` (depende de T002)
- [x] T013 Verificação (`contracts/openapi-coverage.contract.md`): rodar `npm run docs:lint` até passar sem erro; contar `paths.*` em `docs/openapi.yaml` e confirmar 43/43 contra a tabela de `research.md`. Sem arquivo fixo — ajustes pontuais em `docs/openapi.yaml` onde o lint ou a contagem apontarem (depende de T003–T012)

## Fase 3: Catálogo de erros

- [x] T014 Listar todas as classes em `src/errors/*.error.ts` (exceto `app-error.ts`) e redigir `docs/error-catalog.md`: envelope padrão (`{ error: { code, message, statusCode, details? } }`), invariantes (RF-011), e a tabela única (`code`, HTTP status, classe, endpoints, quando ocorre), consolidando os 7 `error-codes.md` existentes por feature. Arquivo: `docs/error-catalog.md` (pode rodar em paralelo à Fase 2 — arquivo diferente, mesma fonte de origem)
- [x] T015 Verificação (`contracts/error-catalog-coverage.contract.md`): cruzar `ls src/errors/*.error.ts` contra as linhas da tabela (nenhuma classe faltando) e confirmar que todo `code` em `docs/error-catalog.md` existe em `docs/openapi.yaml` e vice-versa. Sem arquivo fixo — ajustes pontuais em `docs/error-catalog.md` e/ou `docs/openapi.yaml` (depende de T013, T014)

## Fase 4: Guias transversais

- [x] T016 [P] Criar `docs/auth-guide.md`: obtenção de access/refresh token, quando/como renovar via refresh, o que fazer com `INVALID_ACCESS_TOKEN`/`REFRESH_TOKEN_EXPIRED`, o que acontece em `REFRESH_TOKEN_REUSE_DETECTED`, e o formato do header `Authorization: Bearer` — referenciando os `code` já catalogados em `docs/error-catalog.md` (RF-007). Arquivo: `docs/auth-guide.md` (depende de T013, T015)
- [x] T017 [P] Criar `docs/pagination-guide.md`: formato do cursor opaco usado no feed e nas demais listas, como pedir a próxima página, como detectar o fim da lista (RF-008). Arquivo: `docs/pagination-guide.md` (depende de T013)
- [x] T018 [P] Criar `docs/viewer-block.md`: tabela por tipo de recurso (usuário, livro, review, item de feed, notificação) × campos de `viewer` (`isFollowing`, `followState`, `hasReacted`, `myReadingStatus` etc.) × significado (RF-009). Arquivo: `docs/viewer-block.md` (depende de T013)

## Fase 5: Guias de fluxo de negócio

*Cada arquivo é independente dos demais — todos em `[P]` entre si.*

- [x] T019 [P] Criar `docs/flows/auth-flow.md`: cadastro, login, refresh, logout — passo a passo + regras não óbvias (RF-005a, RF-006). Arquivo: `docs/flows/auth-flow.md` (depende de T016)
- [x] T020 [P] Criar `docs/flows/follow-flow.md`: enviar/aprovar/recusar pedido, deixar de seguir, remover seguidor — follow assimétrico com aprovação, recusa nunca notifica (RF-005b, RF-006, P1/P13 de `product.md`). Arquivo: `docs/flows/follow-flow.md` (depende de T013, T015)
- [x] T021 [P] Criar `docs/flows/reading-flow.md`: buscar livro, `want_to_read`, iniciar leitura, progresso, finalizar (com e sem review) — sem fluxo linear obrigatório (RF-005c, RF-006, P10 de `product.md`). Arquivo: `docs/flows/reading-flow.md` (depende de T013, T015)
- [x] T022 [P] Criar `docs/flows/review-flow.md`: criar/editar/apagar review — nota estrela cheia 1–5, texto opcional, spoiler como flag (RF-005d, RF-006, P5/P9 de `product.md`). Arquivo: `docs/flows/review-flow.md` (depende de T013, T015)
- [x] T023 [P] Criar `docs/flows/feed-flow.md`: consumir o feed paginado — referencia `docs/pagination-guide.md` (RF-005e). Arquivo: `docs/flows/feed-flow.md` (depende de T017)
- [x] T024 [P] Criar `docs/flows/interactions-flow.md`: comentar e curtir item de feed (RF-005f). Arquivo: `docs/flows/interactions-flow.md` (depende de T013, T015)
- [x] T025 [P] Criar `docs/flows/notifications-flow.md`: listar e marcar notificação como lida — sem auto-notificação, recusa de follow nunca notifica (RF-005g, RF-006). Arquivo: `docs/flows/notifications-flow.md` (depende de T013, T015)

## Fase 6: Índice

- [x] T026 Criar `docs/README.md` linkando `openapi.yaml`, `auth-guide.md`, `pagination-guide.md`, `viewer-block.md`, `error-catalog.md`, `design-prompt.md` e os 7 arquivos de `docs/flows/` — ponto de entrada único (`contracts/docs-structure.contract.md`). Arquivo: `docs/README.md` (depende de T016–T025)

## Fase 7: Prompt de design

- [x] T027 Redigir `docs/design-prompt.md` seguindo `contracts/design-prompt.contract.md`: contexto do produto, plataforma web responsivo mobile-first, direção estética aconchegante/literária, tema claro, as 9 áreas do MVP com telas (RF-014), regras de negócio que afetam a UI extraídas de `docs/flows/*.md` (RF-017), orientação de dados mockados (RF-018) — nenhuma área fora do MVP. Arquivo: `docs/design-prompt.md` (depende de T019–T025)
- [x] T028 Apresentar o texto final de `docs/design-prompt.md` ao usuário nesta conversa e obter aprovação explícita (RF-019) — bloqueia a Fase 8 até a aprovação. Sem arquivo (gate humano; ajustar `docs/design-prompt.md` conforme o feedback, se houver) (depende de T027)

## Fase 8: Verificação final

- [x] T029 Executar `specs/009-frontendintegrationdocs/quickstart.md` de ponta a ponta (lint do OpenAPI, cobertura de 43 endpoints, cobertura de classes de erro, leitura crítica dos 7 flows) e registrar, como nota em `docs/openapi.yaml` e/ou `docs/error-catalog.md`, toda divergência encontrada entre uma spec antiga (`specs/00N/`) e o código atual (RF-020); marcar cada item da Definição de Pronto em `spec.md`. Arquivos: `specs/009-frontendintegrationdocs/spec.md`, `docs/openapi.yaml`, `docs/error-catalog.md` (depende de T013, T015, T026, T028)

---

## Dependências

- **Fase 1 → Fase 2 (T013)**: o script `docs:lint` (T001) só precisa existir antes da tarefa de verificação T013 — T002–T012 (redigir o conteúdo) não dependem de T001.
- **Fase 2 e Fase 3 podem rodar em paralelo entre si**: `docs/openapi.yaml` (Fase 2) e `docs/error-catalog.md` (T014) partem de fontes diferentes (`src/controllers`+`src/schemas` vs. `src/errors`) e só precisam ser cruzadas uma contra a outra em T015.
- **Fase 2 + Fase 3 → Fase 4**: os três guias transversais referenciam endpoints (T013) e/ou `code` de erro (T015) já catalogados.
- **Fase 4 → Fase 5**: os guias de fluxo referenciam auth-guide/pagination-guide/error-catalog/openapi já prontos (ver dependências específicas de cada `flow.md`).
- **Fase 5 → Fase 6**: o índice só pode linkar arquivos que já existem.
- **Fase 5 → Fase 7**: o prompt de design deriva as regras de UI dos guias de fluxo, para não divergir deles.
- **Fase 7 → Fase 8**: a verificação final assume o prompt já aprovado (T028) e todo o resto do pacote fechado (T026).
- Internas relevantes:
  - T002 → T003–T012 (todas no mesmo arquivo `docs/openapi.yaml`, sequenciais)
  - T004 → T007 (reading-flow de livro depende do domínio `books` já consolidado)
  - T003–T012 → T013 (lint + contagem)
  - T013 + T014 → T015 (cross-check dos dois catálogos)
  - T013 + T015 → T016, T017, T018
  - T016 → T019; T017 → T023; T013+T015 → T020, T021, T022, T024, T025
  - T019–T025 → T026, T027
  - T027 → T028 → T029

## Exemplo de execução em paralelo

```
# Fase 2 vs. Fase 3 — fontes de origem diferentes, sem dependência mútua até o cross-check:
T002→T012 docs/openapi.yaml (sequencial, mesmo arquivo)
T014 docs/error-catalog.md

# Fase 4 — após T013/T015, os três guias transversais em paralelo:
T016 docs/auth-guide.md | T017 docs/pagination-guide.md | T018 docs/viewer-block.md

# Fase 5 — os 7 flows em paralelo (cada um seu próprio arquivo):
T019 docs/flows/auth-flow.md
T020 docs/flows/follow-flow.md
T021 docs/flows/reading-flow.md
T022 docs/flows/review-flow.md
T023 docs/flows/feed-flow.md
T024 docs/flows/interactions-flow.md
T025 docs/flows/notifications-flow.md
```

## Notas

- Nenhuma tarefa toca `src/`, `tests/` ou `migrations/` — todo o trabalho é em `docs/` + `package.json`.
- T028 é um gate humano (aprovação explícita do prompt de design), não uma tarefa de arquivo — não marcar como concluída sem a aprovação ter de fato acontecido na conversa.
- Nomes de arquivo/pasta em `docs/` são em inglês; a prosa dentro deles é em português (mesma convenção de `specs/*/contracts/error-codes.md`).
- Cada tarefa de domínio na Fase 2 (T003–T012) deve corrigir a favor do código quando encontrar divergência com o `*.openapi.yaml` antigo da feature correspondente — não copiar cegamente.
- Commitar após cada fase concluída (ou após cada tarefa, se preferir granularidade maior).
