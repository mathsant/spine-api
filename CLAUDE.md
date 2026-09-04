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
<!-- Gerado automaticamente por update-agent-context.sh a partir de /Users/matheuscunha/Desktop/better-books/specs/002-authregistration/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 002-authregistration)



**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nova nesta feature**: @fastify/rate-limit ^10 (rate limit de `login`/`signup`); auth sem lib — `scrypt` e HMAC-SHA256 via `node:crypto`
**Armazenamento**: MongoDB — coleções `users`, `auth_sessions`, `refresh_tokens` criadas por 3 migrations `migrate-mongo` reversíveis; `mongodb-memory-server` ^11 nos testes de integração
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (services de auth) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; `authenticate` faz 1 leitura de `users` por request protegida (aceito — RF-018 exige checar existência da conta); rate limit em memória (single-instance no MVP)
**Restrições**: access token TTL 15 min e inatividade do refresh 30 dias são constantes de código (spec fixou); `ACCESS_TOKEN_SECRET` ausente ⇒ fail-fast; senha só como hash `scrypt`, nunca em log; erro de login idêntico para e-mail inexistente e senha errada (roda `verifyPassword` sempre); `mongodb` só em `repositories/**` e `db/**`; services não importam Fastify; nenhum `export default`; JWT força `alg: HS256` (recusa `none`)
**Escala/escopo**: 6 endpoints (`POST /v1/auth/signup|login|refresh|logout|change-password`, `GET /v1/me`), 3 coleções + 3 migrations, 3 entidades persistidas (User, AuthSession, RefreshToken) + AccessToken efêmero, 8 classes de erro novas, 6 services, 2 repositories, 1 pasta transversal nova (`src/auth/`)

<!-- SDD:AUTO-GERADO:FIM -->
