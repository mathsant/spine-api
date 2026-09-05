# CLAUDE.md

Contexto do projeto para o Claude Code. Este arquivo tem duas partes:

1. Conteúdo abaixo desta linha e acima do marcador `SDD:AUTO-GERADO`: **edição manual livre** — convenções do time, links úteis, avisos para o agente. Nunca é sobrescrito pelos scripts do kit SDD.
2. Bloco entre `<!-- SDD:AUTO-GERADO:INICIO -->` e `<!-- SDD:AUTO-GERADO:FIM -->`: gerado por `.specify/scripts/bash/update-agent-context.sh` a partir do `plan.md` da feature ativa. Não edite essa parte à mão — ela é substituída a cada rodada do `/plan`.

## Sobre o projeto

**better-books é uma rede social para leitores**, entregue como **API HTTP** (este repo é só o backend; um app web vai consumir a API depois). A pessoa registra o que está lendo/leu, avalia com nota (estrela cheia 1–5) e review, e acompanha a atividade de quem segue. **Perfil é privado por padrão** e o modelo social é **seguir com aprovação** (assimétrico): só seguidores aprovados veem posts, reviews e progresso.

Contexto completo — glossário de domínio, decisões de produto travadas (P1–P8), escopo do MVP, roadmap e implicações para a API — em **`.specify/memory/product.md`**. Toda feature nova (`/specify`, `/plan`) deve se ancorar nesse arquivo.

## Convenções do projeto

[Preencha manualmente: estilo de código, padrões de commit, o que evitar, etc.]

## Comandos úteis

[Preencha manualmente: como rodar, testar, buildar este projeto.]

<!-- O bloco AUTO-GERADO é anexado abaixo na primeira vez que /plan rodar. -->

<!-- SDD:AUTO-GERADO:INICIO -->
<!-- Gerado automaticamente por update-agent-context.sh a partir de E:/projetos/better-books/specs/008-notificationflow/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 008-notificationflow)



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

<!-- SDD:AUTO-GERADO:FIM -->
