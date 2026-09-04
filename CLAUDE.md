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
<!-- Gerado automaticamente por update-agent-context.sh a partir de E:/projetos/better-books/specs/004-profilefollow/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 004-profilefollow)



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

<!-- SDD:AUTO-GERADO:FIM -->
