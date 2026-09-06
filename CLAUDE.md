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
<!-- Gerado automaticamente por update-agent-context.sh a partir de /Users/matheuscunha/Desktop/better-books/specs/012-followsuggestions/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 012-followsuggestions)


**Linguagem/versão**: TypeScript ~5.9 (`strict`, `module: commonjs`, `target: es2016`) sobre Node.js v24. Sem mudança.
**Dependências principais**: Fastify 5, Awilix (`@fastify/awilix`) para DI, driver nativo `mongodb`, `zod` 4. **Nenhuma dependência nova.**
**Armazenamento**: MongoDB (driver nativo, sem ODM), migrations com `migrate-mongo`. Esta feature **não cria coleção**, **não altera schema** e **não adiciona índice** — só leitura sobre `follows`, `follow_requests`, `users`.
**Testes**: Vitest, dois *projects* (`unit` / `integration`). O service (orquestra repositórios) → integração com `mongodb-memory-server` (sem mock de banco), ≥ 70% cobertura, caminho feliz + ≥ 1 erro. Comparador de ordenação e montagem de DTO (funções puras) → unitário.
**Plataforma-alvo**: servidor (API HTTP), consumida pelo app web `spine-app` (feature de front-end `005-paginatedfeed`, seção "Pessoas para seguir" do trilho direito) e por ferramentas OpenAPI.
**Tipo de projeto**: single (monolito backend em camadas `controller → service → repository`).
**Metas de performance**: N/A explícito. RNF/DoD: as queries novas não podem fazer collection scan — ver research D3 (todas usam índice existente; a agregação de cold start é `IXSCAN` completo, não `COLLSCAN`).
**Restrições**: sem mudança em auth, no fluxo de `follow-requests`/aprovação, nem no modelo persistido de `User`/`Follow`/`FollowRequest` (só consulta/serialização). `avatarUrl` sempre `null`. `followState` sempre `none` nesta rota. Sem paginação, sem `limit`, sem query param. "Dispensar sugestão" fora de escopo. Nomes de arquivo/identificador em inglês; prosa dos artefatos SDD em português. Exemplos com dados fictícios.
**Escala/escopo**: 1 endpoint novo, 1 schema de resposta novo (`FollowSuggestion` + `FollowSuggestionsResponse`). ~4 arquivos novos (service, controller, 1 helper puro, testes), ~6 arquivos existentes tocados (2 interfaces + 2 impls de repositório, `users.routes.ts`, `services/users/index.ts` + `types.ts`, `register-services.ts`), delta no `docs/openapi.yaml` + nota nos guias de fluxo. Zero migration.

<!-- SDD:AUTO-GERADO:FIM -->
