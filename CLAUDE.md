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
<!-- Gerado automaticamente por update-agent-context.sh a partir de E:/projetos/better-books/specs/007-interactions/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 007-interactions)



**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova** — comentar/curtir são inserts/upserts/consultas indexadas simples, sem agregação nova além de um `$group` de contagem
**Armazenamento**: MongoDB — duas coleções novas, `comments` e `reactions`, criadas por migrations `migrate-mongo` reversíveis (índices detalhados em `data-model.md`); `mongodb-memory-server` ^11 nos testes de integração
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (`services/comments/**`, `services/reactions/**`, `services/activities/**`, e as extensões de `delete-reading-session`, `delete-review`, `get-feed`) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; toda leitura/escrita nova é indexada por chave exata (`activityId`, `{activityId,userId}`, `{readingSessionId,activityType}`) — mesma ordem de grandeza das operações por id já existentes (003/004/005)
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; services não importam Fastify; nenhum `export default`; `ActivityRepository` ganha só `findById` (nenhuma outra alteração de assinatura, D3 do research.md — cascade via denormalização, não via retorno de ids); comentário só tem soft delete, sem edição (decisão do `/specify`); curtida só existe em itens de feed, nunca em comentários (decisão do `/specify`)
**Escala/escopo**: 5 endpoints novos (`POST`/`DELETE /v1/activities/:activityId/reactions`, `POST`/`GET /v1/activities/:activityId/comments`, `DELETE /v1/comments/:commentId`); 3 services existentes alterados (`delete-reading-session`, `delete-review`, `get-feed`) + 6 services novos (`resolve-visible-activity`, `create-comment`, `list-comments`, `delete-comment`, `create-reaction`, `delete-reaction`); 2 repositories novos (`comments`, `reactions`) + 1 método novo em `ActivityRepository` (`findById`); 2 coleções novas + 2 migrations; 2 entidades persistidas novas (`Comment`, `Reaction`); 5 classes de erro novas (`ActivityNotFoundError`, `UnsupportedActivityInteractionError`, `CommentNotFoundError`, `CommentNestingTooDeepError`, `ReactionNotFoundError`); 3 pastas de domínio novas em `controllers`/`services`/`repositories`/`schemas` (`comments`, `reactions`, e `activities` só em `services`, sem controller/rota própria)

<!-- SDD:AUTO-GERADO:FIM -->
