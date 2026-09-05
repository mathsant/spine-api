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
<!-- Gerado automaticamente por update-agent-context.sh a partir de E:/projetos/better-books/specs/009-frontendintegrationdocs/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 009-frontendintegrationdocs)


**Linguagem/versão**: sem código de aplicação novo — os artefatos são Markdown + OpenAPI 3.1 (YAML). O projeto em si continua TypeScript ~5.9 (strict, `module: commonjs`, `target: es2016`) sobre Node.js v24 (inalterado por esta feature).
**Dependências principais**: nenhuma dependência de runtime nova. **1 devDependency nova**: `@redocly/cli`, usada só para `lint`/validação estática do OpenAPI unificado (exigência direta da Definição de Pronto da spec — "valida sem erros num validador de schema"). Ver justificativa em `research.md`.
**Armazenamento**: N/A — esta feature não toca MongoDB, não cria coleção nem migration.
**Testes**: não há regra de negócio nova, logo não há teste `vitest` novo. A "verificação" desta feature é: (a) `npx redocly lint docs/openapi.yaml` sem erros; (b) checklist de cobertura cruzando `docs/openapi.yaml` contra as rotas reais em `src/controllers/**/*.routes.ts` (43 endpoints); (c) checklist de cobertura do catálogo de erros contra as classes em `src/errors/*.error.ts`. Passos detalhados em `quickstart.md`.
**Plataforma-alvo**: N/A para execução — os artefatos são consumidos por humanos (dev do front-end) e por ferramentas de OpenAPI (ex.: geração de client, Swagger UI), não por um runtime próprio.
**Tipo de projeto**: single (mesmo monolito backend); esta feature não altera a estrutura de camadas `controller → service → repository`, só documenta o que já existe nela.
**Metas de performance**: N/A.
**Restrições**: nenhuma mudança em `src/**` (leitura apenas, para extrair a verdade atual); nenhum endpoint, schema, migration ou índice novo; exemplos de request/response nos documentos usam dados fictícios (nenhum token, e-mail ou credencial real); nomes de arquivo/pasta em `docs/` em inglês (regra fixa do kit), conteúdo/prosa em português (mesma convenção já usada em `specs/*/contracts/error-codes.md`).
**Escala/escopo**: 1 documento OpenAPI unificado cobrindo **43 endpoints** em **12 domínios** de controller (`auth`, `books`, `follows`, `profile`, `users`, `reading-sessions`, `reviews`, `feed`, `comments`, `reactions`, `notifications`, `health`); **7 guias de fluxo** (auth, follow, reading, review, feed, interactions, notifications); 1 catálogo de erros único; 1 guia de autenticação; 1 guia de paginação; 1 referência do bloco `viewer`; 1 prompt de design; 1 devDependency nova (`@redocly/cli`) + 1 npm script novo (`docs:lint`).

<!-- SDD:AUTO-GERADO:FIM -->
