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
<!-- Gerado automaticamente por update-agent-context.sh a partir de E:/projetos/better-books/specs/011-userconnectionscontractgaps/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 011-userconnectionscontractgaps)


**Linguagem/versão**: TypeScript ~5.9 (`strict`, `module: commonjs`, `target: es2016`) sobre Node.js v24. Sem mudança.
**Dependências principais**: Fastify 5, Awilix (`@fastify/awilix`) para DI, driver nativo `mongodb`, `zod` 4. **Nenhuma dependência nova.**
**Armazenamento**: MongoDB (driver nativo, sem ODM), migrations com `migrate-mongo`. Esta feature **não cria coleção** e **não faz migração de dados**; adiciona **1 índice** (1 migration).
**Testes**: Vitest, dois *projects* (`unit` / `integration`). Regra de negócio → integração com `mongodb-memory-server` (sem mock de banco), ≥ 70% cobertura, caminho feliz + ≥1 erro. Funções puras (mappers, schemas zod) → unitário.
**Plataforma-alvo**: servidor (API HTTP), consumida pelo app web da feature de front-end `004-userconnections` e por ferramentas OpenAPI.
**Tipo de projeto**: single (monolito backend em camadas `controller → service → repository`).
**Metas de performance**: N/A explícito. RNF-001: as queries novas não podem fazer collection scan — ver research D4.
**Restrições**: sem mudança em auth, em `follow-requests`/aprovação, nem no modelo persistido de `User`/`Follow`/`FollowRequest`/`Activity`/`Review`/`ReadingSession` (só consulta/serialização). `avatarUrl` continua sempre `null`. Nomes de arquivo/identificador em inglês; prosa dos artefatos SDD em português. Exemplos nos docs com dados fictícios.
**Escala/escopo**: 3 endpoints novos (`GET /users/{userId}`, `GET /users/{userId}/activity`, `GET /me/stats`) + 4 campos novos em 3 schemas de lista. ~9 arquivos de service/controller/schema novos, ~10 arquivos existentes tocados, 6 métodos de repositório novos, 1 helper de feed extraído, 1 migration de índice, delta no `docs/openapi.yaml` + 2 guias de fluxo + catálogo de erros.

<!-- SDD:AUTO-GERADO:FIM -->
