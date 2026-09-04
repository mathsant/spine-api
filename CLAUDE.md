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
<!-- Gerado automaticamente por update-agent-context.sh a partir de /Users/matheuscunha/Desktop/better-books/specs/003-bookcatalogflow/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 003-bookcatalogflow)



**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova nesta feature** — integração com Open Library via `fetch` nativo do Node 24 (`src/integrations/open-library/`)
**Armazenamento**: MongoDB — coleções `books`, `shelf_memberships`, `reading_sessions` criadas por 3 migrations `migrate-mongo` reversíveis; `mongodb-memory-server` ^11 nos testes de integração (rede do Open Library isolada por um `FakeOpenLibraryClient`, não pela rede real)
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (services de books/reading-sessions) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; `search`/cache-on-read fazem 1 chamada de rede ao Open Library quando o cache não tem o `olid` ainda (aceito — RF-003); timeout de rede configurável (`OPEN_LIBRARY_TIMEOUT_MS`, default 5000ms) evita requisição pendurada
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; `fetch`/rede do Open Library só em `integrations/open-library/**`; services não importam Fastify; nenhum `export default`; no máximo 1 reading session `reading` aberta por livro/usuário (índice único parcial); progresso não valida contra total de páginas (RF-013); session de terceiro responde `404`, nunca `403` (D9)
**Escala/escopo**: 11 endpoints (`GET /v1/books/search`, `GET /v1/books/:olid`, `PUT`/`DELETE /v1/books/:olid/want-to-read`, `POST /v1/books/:olid/start-reading`, `POST /v1/books/:olid/mark-finished`, `GET /v1/me/want-to-read`, `POST /v1/reading-sessions/:id/progress`, `POST /v1/reading-sessions/:id/finish`, `PATCH`/`DELETE /v1/reading-sessions/:id`, `GET /v1/me/reading-sessions`), 3 coleções + 3 migrations, 3 entidades persistidas (Book, ShelfMembership, ReadingSession), 5 classes de erro novas, 12 services, 3 repositories, 2 pastas transversais novas (`src/integrations/open-library/`, `src/lib/` para o cursor)

> **Nota sobre `architecture.md`**: o documento lista `npm` como gerenciador de pacotes, mas o
> repositório já adotou `pnpm` (commit `962fd39`, `package.json` com `"packageManager":
> "pnpm@9.15.4"`, `pnpm-lock.yaml` versionado — feature 002). Este plano segue o estado real
> do repositório (`pnpm`); vale atualizar `architecture.md` numa próxima passada de
> `/architecture` para eliminar a divergência (fora do escopo deste plano).

<!-- SDD:AUTO-GERADO:FIM -->
