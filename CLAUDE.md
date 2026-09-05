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
<!-- Gerado automaticamente por update-agent-context.sh a partir de E:/projetos/better-books/specs/006-activityfeed/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 006-activityfeed)


**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova** — o feed é uma consulta indexada (`$in` + sort), não uma agregação
**Armazenamento**: MongoDB — coleção nova `activities` criada por 1 migration `migrate-mongo` reversível (índice composto `{ actorId: 1, createdAt: -1, _id: -1 }` para o filtro `$in`+cursor do feed, índice `{ readingSessionId: 1 }` para os cascades de deleção); `mongodb-memory-server` ^11 nos testes de integração
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (`services/feed/**` e as 6 extensões — start-reading, mark-finished, update-progress, finish-reading-session, delete-reading-session, create-review, delete-review) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; a consulta do feed é um `$in` de atores + sort por índice composto (D7 do research.md) — mesma ordem de grandeza das listas por cursor já existentes (003/004); nenhuma agregação nova
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; services não importam Fastify; nenhum `export default`; `activities` não tem índice único (múltiplos eventos por session são esperados); nenhuma escrita em `activities` acontece fora dos 5 pontos de gravação e 2 pontos de cascade já mapeados em `data-model.md`/`internal-ports.md`; feed nunca resolve `404`/`403` — lista vazia é resposta válida (RF-013)
**Escala/escopo**: 1 endpoint novo (`GET /v1/feed`); 6 services existentes alterados (start-reading, mark-finished, update-progress, finish-reading-session, delete-reading-session, create-review, delete-review) + 1 service novo (`get-feed`); 1 repository novo (`activities`) + 1 método novo em `FollowRepository` (`listFolloweeIds`); 1 coleção nova + 1 migration; 1 entidade persistida nova (`Activity`); 0 classes de erro novas (reaproveita `ValidationError`/`UnauthenticatedError`); 1 pasta de domínio nova em `controllers`/`services`/`repositories`/`schemas` (`feed`)

<!-- SDD:AUTO-GERADO:FIM -->
