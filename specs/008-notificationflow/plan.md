# Plano de Implementação: Fluxo de notificações

**Branch**: `008-notificationflow` | **Data**: 2026-09-05 | **Spec**: [specs/008-notificationflow/spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/008-notificationflow/spec.md`

## Resumo

Notificar o usuário de 5 tipos de evento — pedido de follow recebido, pedido aprovado, comentário
no seu item de feed, resposta a um comentário seu, curtida no seu item — persistindo cada um como
registro append-only numa coleção nova (`notifications`), com leitura por polling (listagem por
cursor, contador de não lidas, marcar como lida individual/em massa). Abordagem técnica: um
service helper genérico (`createNotification`) que centraliza a regra "nunca notificar o próprio
ator" (RF-009) e é chamado a partir de 4 pontos de escrita já existentes (`send-follow-request`,
`approve-follow-request`, `create-comment`, `create-reaction`); a notificação `follow_request`
pendente e a `reaction_on_content` são removidas por chave (par recipiente/ator[/activityId], já
única nas próprias entidades de origem) em vez de guardar um id de referência solto; `Comment`
gera até 2 notificações por escrita (dono do item + autor do comentário-pai), deduplicadas quando
as duas pessoas coincidem (RF-007); cascade de remoção via denormalização de
`readingSessionId`/`activityType` na notificação, mesmo padrão já usado por `Comment`/`Reaction`
(007). Único ajuste em porta existente: `ReactionRepository.add` passa a informar se criou um
registro novo, para não notificar de novo numa re-curtida idempotente. Nenhuma dependência nova.

## Contexto Técnico

<!-- Esta seção é lida pelo update-agent-context.sh para atualizar o CLAUDE.md do projeto. -->

**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova** — notificação é insert/upsert/consulta indexada simples, sem agregação além de contagem/paginação já existentes em outras features
**Armazenamento**: MongoDB — uma coleção nova, `notifications`, criada por migration `migrate-mongo` reversível (índices detalhados em `data-model.md`); `mongodb-memory-server` ^11 nos testes de integração
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (`services/notifications/**` e as extensões de `send-follow-request`, `approve-follow-request`, `reject-follow-request`, `create-comment`, `delete-comment`, `create-reaction`, `delete-reaction`, `delete-reading-session`, `delete-review`) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; toda leitura/escrita nova é indexada por chave exata (`recipientId`, `{recipientId,actorId,type[,activityId]}`, `commentId`, `{readingSessionId,activityType}`) — mesma ordem de grandeza das operações já existentes (005/006/007)
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; services não importam Fastify; nenhum `export default`; `Notification` nunca é editada — só criada, marcada como lida ou removida (sem update de conteúdo); sem agregação de notificações, uma por evento (decisão do `/specify`); sem auto-notificação — ator == destinatário nunca gera registro (RF-009); entrega por polling no MVP, sem push/SSE (já fora de escopo em `product.md`); recusa de follow request nunca notifica (RF-003)
**Escala/escopo**: 4 endpoints novos (`GET /v1/me/notifications`, `GET /v1/me/notifications/unread-count`, `POST /v1/notifications/:notificationId/read`, `POST /v1/notifications/read-all`); 9 services existentes alterados (`send-follow-request`, `approve-follow-request`, `reject-follow-request`, `create-comment`, `delete-comment`, `create-reaction`, `delete-reaction`, `delete-reading-session`, `delete-review`) + 5 services novos (`create-notification`, `list-notifications`, `get-unread-notification-count`, `mark-notification-read`, `mark-all-notifications-read`); 1 repository novo (`notifications`, interface + implementação Mongo) + 1 repository alterado (`ReactionRepository.add` passa a retornar `Promise<boolean>`, D1 do research.md); 1 coleção nova + 1 migration; 1 entidade persistida nova (`Notification`); 1 classe de erro nova (`NotificationNotFoundError`); 4 pastas de domínio novas em `controllers`/`services`/`repositories`/`schemas` (`notifications`)

## Verificação da Constituição

*Gate obrigatório: rodado antes da Fase 0 e novamente após a Fase 1. Consulte `.specify/memory/constitution.md`.*

- [x] Idioma do código: inglês em todo artefato técnico (identificadores, arquivos, branches, commits, schema) — `notifications`, `NotificationRecord`, `NotificationType`, todos os nomes de erro e rota em inglês; só `spec.md`/`plan.md`/`research.md`/`data-model.md`/`quickstart.md` em português (regra do fluxo SDD)
- [x] P1 Testes por tipo de código: `create-notification`/`list-notifications`/`get-unread-notification-count`/`mark-notification-read`/`mark-all-notifications-read` e as 9 extensões são regra de negócio → integração com `mongodb-memory-server`; `to-dto.ts` é função pura → unitário; cobertura ≥ 70% (mesmo gate das features anteriores)
- [x] P2 Acesso a dados só via repositório: `NotificationRepository` como interface + `MongoNotificationRepository`; nenhum service novo importa `mongodb`
- [x] P3 Validação de entrada com `zod` na borda: `listNotificationsSchema` (`cursor`, `limit`, mesmo shape de `listCommentsSchema`); as 2 rotas de ação (`read`, `read-all`) não têm corpo, nada a validar além do `preHandler` de auth já existente
- [x] P4 Mudança de schema/índice apenas via migration versionada e reversível: `create-notifications-collection`
- [x] P5 Erros de domínio estendem o tipo de erro base: `NotificationNotFoundError` estende `AppError` (ver `data-model.md`)

## Estrutura do Projeto

### Documentos desta feature (`specs/008-notificationflow/`)

```
specs/008-notificationflow/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # saída da Fase 0
├── data-model.md         # saída da Fase 1
├── quickstart.md         # saída da Fase 1
├── contracts/            # saída da Fase 1
│   ├── error-codes.md
│   ├── internal-ports.md
│   └── notifications.openapi.yaml
└── tasks.md               # saída da Fase 2 (gerado pelo /tasks, não pelo /plan)
```

### Código-fonte (raiz do repositório)

Segue `.specify/memory/architecture.md` ("Onde cada tipo de código novo deve ir"), monolito em
camadas `controller → service → repository`. Arquivos novos/alterados desta feature:

```
src/
├── controllers/
│   └── notifications/
│       ├── notifications.routes.ts                    # NOVO
│       ├── list-notifications.controller.ts           # NOVO
│       ├── get-unread-notification-count.controller.ts # NOVO
│       ├── mark-notification-read.controller.ts        # NOVO
│       ├── mark-all-notifications-read.controller.ts   # NOVO
│       └── index.ts                                    # NOVO
├── services/
│   ├── notifications/
│   │   ├── create-notification.ts                     # NOVO — sem controller/rota própria
│   │   ├── list-notifications.service.ts              # NOVO
│   │   ├── get-unread-notification-count.service.ts   # NOVO
│   │   ├── mark-notification-read.service.ts           # NOVO
│   │   ├── mark-all-notifications-read.service.ts       # NOVO
│   │   ├── to-dto.ts                                    # NOVO
│   │   ├── types.ts                                     # NOVO
│   │   └── index.ts                                     # NOVO
│   ├── follows/
│   │   ├── send-follow-request.service.ts              # ALTERADO — cria notificação follow_request
│   │   ├── approve-follow-request.service.ts            # ALTERADO — remove pendente + cria follow_approved
│   │   └── reject-follow-request.service.ts             # ALTERADO — remove pendente, sem criar nova
│   ├── comments/
│   │   ├── create-comment.service.ts                    # ALTERADO — cria comment_on_content/comment_reply (dedup RF-007)
│   │   └── delete-comment.service.ts                     # ALTERADO — remove notificação(ões) da origem
│   ├── reactions/
│   │   ├── create-reaction.service.ts                    # ALTERADO — cria reaction_on_content (só se novo)
│   │   └── delete-reaction.service.ts                     # ALTERADO — remove notificação da origem
│   ├── reading-sessions/
│   │   └── delete-reading-session.service.ts             # ALTERADO — cascade de notificação
│   └── reviews/
│       └── delete-review.service.ts                       # ALTERADO — cascade de notificação
├── repositories/
│   ├── notifications/
│   │   ├── notification.repository.ts                    # NOVO
│   │   ├── mongo-notification.repository.ts               # NOVO
│   │   └── index.ts                                        # NOVO
│   └── reactions/
│       ├── reaction.repository.ts                          # ALTERADO — add() retorna Promise<boolean>
│       └── mongo-reaction.repository.ts                    # ALTERADO
├── schemas/
│   └── notifications/
│       ├── list-notifications.schema.ts                    # NOVO
│       └── index.ts                                         # NOVO
├── errors/
│   ├── notification-not-found-error.ts                     # NOVO
│   └── index.ts                                              # ALTERADO — re-exports
├── container/
│   ├── cradle.ts                                             # ALTERADO — + notificationRepository, services novos
│   ├── register-repositories.ts                              # ALTERADO — + notificationRepository
│   └── register-services.ts                                  # ALTERADO — + services novos, deps novas nos existentes
└── app.ts                                                     # ALTERADO — registra notificationsRoutes

migrations/
└── <timestamp>-create-notifications-collection.js  # NOVO

tests/
├── integration/services/
│   ├── notifications/create-notification.spec.ts                      # NOVO
│   ├── notifications/list-notifications.service.spec.ts                # NOVO
│   ├── notifications/get-unread-notification-count.service.spec.ts     # NOVO
│   ├── notifications/mark-notification-read.service.spec.ts            # NOVO
│   ├── notifications/mark-all-notifications-read.service.spec.ts       # NOVO
│   ├── follows/send-follow-request.service.spec.ts                     # ALTERADO — cenário de notificação
│   ├── follows/approve-follow-request.service.spec.ts                  # ALTERADO
│   ├── follows/reject-follow-request.service.spec.ts                   # ALTERADO
│   ├── comments/create-comment.service.spec.ts                         # ALTERADO — cenários de dedup
│   ├── comments/delete-comment.service.spec.ts                          # ALTERADO — cascade
│   ├── reactions/create-reaction.service.spec.ts                        # ALTERADO — idempotência
│   ├── reactions/delete-reaction.service.spec.ts                        # ALTERADO
│   ├── reading-sessions/delete-reading-session.service.spec.ts          # ALTERADO — cascade
│   └── reviews/delete-review.service.spec.ts                            # ALTERADO — cascade
└── unit/services/
    └── notifications/to-dto.spec.ts                                     # NOVO
```

## Fase 0: Pesquisa

Ver `research.md` — 8 decisões registradas (D1 a D8), nenhuma bloqueada por incógnita de stack (a
stack já está travada em `architecture.md`, reaproveitada sem alteração).

**Saída**: `research.md` com todas as incógnitas resolvidas.

## Fase 1: Design & Contratos

Concluída:

1. `data-model.md` — entidade `Notification`, extensão de `ReactionRepository.add`, os 9 services
   alterados, DTOs e tabela de erro novo.
2. `contracts/error-codes.md` + `contracts/internal-ports.md` + `contracts/notifications.openapi.yaml`
   — 4 endpoints, todos os ports/services/erros novos com assinatura completa.
3. Cenários de teste de integração mapeados 1:1 com os 15 cenários de aceitação da spec (ver seção
   `tests/` da estrutura acima).
4. `quickstart.md` — passos cobrindo os 5 tipos de notificação, dedup de resposta, remoção por
   recusa/apagar/descurtir, listagem por cursor, marcar como lida (individual/em massa, idempotente),
   contador de não lidas, e cascade via `delete-reading-session`.
5. Sem `design/` no repositório (API pura, sem UI) — passo de mapeamento de telas não se aplica.
6. `update-agent-context.sh` executado (ver abaixo).

**Saída**: `data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md` atualizado.

## Fase 2: Abordagem de Planejamento de Tarefas

*Esta seção descreve o que o comando `/tasks` fará — NÃO execute isso agora, e NÃO gere `tasks.md` aqui.*

**Estratégia de geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md` como base.
- Uma tarefa por migration (1), pela entidade/repository novo (`Notification`, interface +
  implementação Mongo + 5 índices), pela alteração de `ReactionRepository`/`MongoReactionRepository`
  (1), por service novo (5) e por extensão de service existente (9), por endpoint/contrato (4,
  controller + schema quando aplicável + rota), pelo erro novo (1) e por cenário de integração da
  spec (15 cenários de aceitação + 6 casos de borda).
- `create-notification` é pré-requisito de todo o resto que cria notificação — sua tarefa (e a
  alteração de `ReactionRepository.add`) vem antes das extensões de `send-follow-request`,
  `approve-follow-request`, `create-comment`, `create-reaction`.

**Estratégia de ordenação**:
- Ordem TDD: teste de integração antes do service que ele cobre; teste unitário antes do `to-dto`.
- Ordem de dependência: migration → `NotificationRepository` (+ alteração de `ReactionRepository`)
  → `create-notification` → extensões de `send-follow-request`/`approve-follow-request`/
  `reject-follow-request`/`create-comment`/`delete-comment`/`create-reaction`/`delete-reaction` →
  extensões de `delete-reading-session`/`delete-review` → `list-notifications`/
  `get-unread-notification-count`/`mark-notification-read`/`mark-all-notifications-read` →
  controllers/rotas/schemas → registro no container (Awilix).
- Marcar `[P]` para tarefas em arquivos independentes que podem rodar em paralelo (ex.: os 4
  controllers depois que os services novos existirem; os testes das 9 extensões, que tocam
  services diferentes).

## Rastreio de Complexidade

*Nenhuma violação da Verificação da Constituição — seção não se aplica.*

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — sem `design/` no repositório)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
