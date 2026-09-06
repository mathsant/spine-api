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
<!-- Gerado automaticamente por update-agent-context.sh a partir de E:/projetos/better-books/specs/010-readingcontractgaps/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 010-readingcontractgaps)


**Linguagem/versão**: TypeScript ~5.9 (`strict`, `module: commonjs`, `target: es2016`) sobre Node.js v24. Sem mudança.
**Dependências principais**: Fastify 5, Awilix (`@fastify/awilix`) para DI, driver nativo `mongodb` 7, `zod` 4. Nenhuma dependência de runtime nova. `@redocly/cli` (devDependency já existente, da feature 009) é usada por `pnpm docs:lint`.
**Armazenamento**: MongoDB (driver nativo, sem ODM), migrations com `migrate-mongo`. Esta feature **não cria coleção**; adiciona **3 índices** (1 migration) e **1 campo opcional** sem índice (`books.pageCount`, sem migration — schemaless, preenchimento lazy).
**Testes**: Vitest, dois *projects* (`unit` / `integration`). Regra de negócio → integração com `mongodb-memory-server` (sem mock de banco), ≥ 70% cobertura, caminho feliz + ≥1 erro. Funções puras (mappers, schemas zod, cursor codec) → unitário isolado. Verificação de docs: `pnpm docs:lint` + cruzamento de rotas/schemas.
**Plataforma-alvo**: servidor (API HTTP), consumida pelo app web da `002-reading-books` e por ferramentas OpenAPI.
**Tipo de projeto**: single (monolito backend em camadas `controller → service → repository`). Esta feature não altera as camadas, só adiciona operações e um campo.
**Metas de performance**: N/A explícito. Os índices novos (research D7) evitam collection scan nas 3 queries novas conforme a base cresce.
**Restrições**: sem mudança em auth, em `follow-requests`/aprovação, nem no modelo persistido de `Review` e `ReadingSession` (só consulta/serialização). Nomes de arquivo/identificador em inglês; prosa dos artefatos SDD em português. Exemplos nos docs com dados fictícios.
**Escala/escopo**: 2 endpoints novos + 1 alterado + 1 campo novo em 4 superfícies de livro. ~6 arquivos de serviço/controller novos, ~10 arquivos existentes tocados, 3 métodos de repositório novos, 1 migration, 1 codec de cursor, delta no `docs/openapi.yaml` + 3 guias em `docs/`.

<!-- SDD:AUTO-GERADO:FIM -->
