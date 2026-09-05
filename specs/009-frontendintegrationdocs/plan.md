# Plano de Implementação: Documentação de Integração para o Front-end + Prompt de Design

**Branch**: `009-frontendintegrationdocs` | **Data**: 2026-09-05 | **Spec**: [spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/009-frontendintegrationdocs/spec.md`

## Resumo

Esta feature não adiciona endpoint, entidade nem regra de negócio nova ao backend. Ela **consolida** os 8 `*.openapi.yaml` + `error-codes.md` hoje espalhados por `specs/001-backendappsetup/` a `specs/008-notificationflow/` (um por feature de implementação) em um pacote único, versionado em `docs/` na raiz do repo, organizado por domínio de negócio e escrito para quem vai construir o front-end — sem precisar ler spec antiga nem código-fonte. O pacote cobre: um OpenAPI único (43 endpoints, 12 domínios de controller), 7 guias de fluxo de negócio, um catálogo de erros único, um guia de autenticação, um guia de paginação por cursor, uma referência do bloco `viewer`, e um prompt de texto auto-suficiente para gerar o protótipo visual do app no Claude Design (9 áreas do MVP, web responsivo mobile-first, direção estética aconchegante/literária, tema claro). Todo o conteúdo é validado contra o comportamento atual do código em `src/` — não contra a intenção original de cada spec — e qualquer divergência encontrada é sinalizada, não silenciada.

## Contexto Técnico

**Linguagem/versão**: sem código de aplicação novo — os artefatos são Markdown + OpenAPI 3.1 (YAML). O projeto em si continua TypeScript ~5.9 (strict, `module: commonjs`, `target: es2016`) sobre Node.js v24 (inalterado por esta feature).
**Dependências principais**: nenhuma dependência de runtime nova. **1 devDependency nova**: `@redocly/cli`, usada só para `lint`/validação estática do OpenAPI unificado (exigência direta da Definição de Pronto da spec — "valida sem erros num validador de schema"). Ver justificativa em `research.md`.
**Armazenamento**: N/A — esta feature não toca MongoDB, não cria coleção nem migration.
**Testes**: não há regra de negócio nova, logo não há teste `vitest` novo. A "verificação" desta feature é: (a) `npx redocly lint docs/openapi.yaml` sem erros; (b) checklist de cobertura cruzando `docs/openapi.yaml` contra as rotas reais em `src/controllers/**/*.routes.ts` (43 endpoints); (c) checklist de cobertura do catálogo de erros contra as classes em `src/errors/*.error.ts`. Passos detalhados em `quickstart.md`.
**Plataforma-alvo**: N/A para execução — os artefatos são consumidos por humanos (dev do front-end) e por ferramentas de OpenAPI (ex.: geração de client, Swagger UI), não por um runtime próprio.
**Tipo de projeto**: single (mesmo monolito backend); esta feature não altera a estrutura de camadas `controller → service → repository`, só documenta o que já existe nela.
**Metas de performance**: N/A.
**Restrições**: nenhuma mudança em `src/**` (leitura apenas, para extrair a verdade atual); nenhum endpoint, schema, migration ou índice novo; exemplos de request/response nos documentos usam dados fictícios (nenhum token, e-mail ou credencial real); nomes de arquivo/pasta em `docs/` em inglês (regra fixa do kit), conteúdo/prosa em português (mesma convenção já usada em `specs/*/contracts/error-codes.md`).
**Escala/escopo**: 1 documento OpenAPI unificado cobrindo **43 endpoints** em **12 domínios** de controller (`auth`, `books`, `follows`, `profile`, `users`, `reading-sessions`, `reviews`, `feed`, `comments`, `reactions`, `notifications`, `health`); **7 guias de fluxo** (auth, follow, reading, review, feed, interactions, notifications); 1 catálogo de erros único; 1 guia de autenticação; 1 guia de paginação; 1 referência do bloco `viewer`; 1 prompt de design; 1 devDependency nova (`@redocly/cli`) + 1 npm script novo (`docs:lint`).

## Verificação da Constituição

*Gate obrigatório: rodado antes da Fase 0 e novamente após a Fase 1. Consulte `.specify/memory/constitution.md`.*

- [x] **Idioma do código**: nomes de arquivo/pasta em `docs/` em inglês (`openapi.yaml`, `error-catalog.md`, `auth-flow.md` etc.); prosa em português — permitido pela constituição para "documentação de produto" e para o próprio fluxo SDD. Identificadores citados dentro dos documentos (campos, `code` de erro, nomes de endpoint) reproduzem exatamente o que já está em inglês no código — nenhum é traduzido ou inventado.
- [x] **P1 Testes por tipo de código**: **N/A** — esta feature não introduz regra de negócio nem função nova em `src/**`; não há o que cobrir com `mongodb-memory-server` nem teste unitário. A verificação equivalente (lint do OpenAPI + checklist de cobertura contra código) está descrita em `quickstart.md`.
- [x] **P2 Acesso a dados só via repositório**: **N/A** — nenhum acesso a dado novo é introduzido; a feature só lê o código-fonte existente para documentá-lo, não adiciona código de persistência.
- [x] **P3 Validação de entrada com zod**: **N/A** — nenhum endpoint novo, logo nenhuma entrada nova para validar.
- [x] **P4 Mudança de schema/índice só via migration**: **N/A** — nenhuma coleção, campo ou índice é criado, alterado ou removido.
- [x] **P5 Erros de domínio estendem o tipo base**: **N/A** — nenhuma classe de erro nova é criada; a feature apenas documenta as já existentes em `src/errors/*.error.ts`.

Nenhuma violação — os 5 princípios de código não se aplicam porque esta feature não adiciona código de aplicação, só documentação derivada do código já existente. Nenhuma entrada necessária em "Rastreio de Complexidade".

## Estrutura do Projeto

### Documentos desta feature (`specs/009-frontendintegrationdocs/`)

```
specs/009-frontendintegrationdocs/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # saída da Fase 0
├── data-model.md         # saída da Fase 1 — forma de cada artefato de documentação (não é schema de banco)
├── quickstart.md         # saída da Fase 1 — passos para validar a feature manualmente
├── contracts/            # saída da Fase 1 — "contrato" de estrutura/conteúdo mínimo de cada artefato
│   ├── docs-structure.contract.md
│   ├── openapi-coverage.contract.md
│   ├── error-catalog-coverage.contract.md
│   └── design-prompt.contract.md
└── tasks.md               # saída da Fase 2 (gerado pelo /tasks, não pelo /plan)
```

### Artefatos entregues (raiz do repositório)

`architecture.md` não tem uma entrada para "documentação voltada ao front-end" — a tabela "Onde cada tipo de código novo deve ir" cobre camadas de `src/`, não aplicável aqui. A estrutura abaixo é definida por esta feature (decisão já validada com o usuário no `/specify`: pasta `docs/` na raiz, persistente, fora do padrão `specs/00N/contracts/`):

```
better-books/
├── docs/
│   ├── README.md                 # índice: o que tem aqui e por onde começar
│   ├── openapi.yaml               # RF-001 a RF-004 — contrato único, 12 domínios, 43 endpoints
│   ├── auth-guide.md              # RF-007 — obtenção/renovação de token, reuso de refresh
│   ├── pagination-guide.md        # RF-008 — formato do cursor, próxima página, fim de lista
│   ├── viewer-block.md            # RF-009 — campos de `viewer` por tipo de recurso
│   ├── error-catalog.md           # RF-010 a RF-012 — catálogo único de `code` de erro
│   ├── design-prompt.md           # RF-013 a RF-019 — prompt para o Claude Design
│   └── flows/
│       ├── auth-flow.md           # RF-005(a), RF-006
│       ├── follow-flow.md         # RF-005(b), RF-006
│       ├── reading-flow.md        # RF-005(c) — busca, want_to_read, reading session, progresso, finalizar
│       ├── review-flow.md         # RF-005(d)
│       ├── feed-flow.md           # RF-005(e)
│       ├── interactions-flow.md   # RF-005(f)
│       └── notifications-flow.md  # RF-005(g)
├── package.json                   # + devDependency `@redocly/cli`, + script `docs:lint`
```

Nenhum arquivo em `src/`, `tests/` ou `migrations/` é criado ou alterado por esta feature.

## Fase 0: Pesquisa

Nenhum `[NEEDS CLARIFICATION]` restou no Contexto Técnico acima — as duas únicas decisões técnicas em aberto (ferramenta de validação do OpenAPI e abordagem de consolidação) foram resolvidas nesta fase e registradas em `research.md`:

1. Ferramenta de lint/validação do OpenAPI unificado (impacta a Definição de Pronto da spec).
2. Abordagem de consolidação dos 8 OpenAPI + 8 catálogos de erro existentes (edição manual cross-referenciada vs. geração automática a partir dos schemas `zod`).

**Saída**: `research.md` com as duas decisões, justificativa e alternativas consideradas.

## Fase 1: Design & Contratos

*Pré-requisito: `research.md` completo.*

1. `data-model.md`: descreve a forma de cada uma das 4 entidades da spec (API Contract, Flow Guide, Error Catalog, Design Prompt) — não é schema de banco, é a estrutura mínima que cada artefato de documentação deve conter para satisfazer os RFs.
2. `contracts/`: em vez de contratos de endpoint HTTP (esta feature não cria endpoint), cada arquivo descreve o "contrato de conteúdo" que um artefato de documentação deve cumprir para ser considerado completo — usado como checklist objetiva nas tarefas do `/tasks` e na Definição de Pronto.
3. `quickstart.md`: passos manuais para (a) rodar `npx redocly lint docs/openapi.yaml`, (b) conferir cobertura de 100% dos 43 endpoints, (c) conferir cobertura de 100% das classes de erro, (d) checklist de leitura do prompt de design antes de submeter para aprovação do usuário.
4. **Mapeamento contra `design/`**: não se aplica — a pasta `design/` não existe neste repositório ainda (confirmado no `/specify`). Esta feature é, ao contrário, quem *produz* o prompt que dará origem a um design a ser importado por uma feature futura via `design-import`.
5. Rodar `.specify/scripts/bash/update-agent-context.sh` para refletir o contexto técnico desta feature no `CLAUDE.md`.

**Saída**: `data-model.md`, `contracts/*.md`, `quickstart.md`, `CLAUDE.md` atualizado.

## Fase 2: Abordagem de Planejamento de Tarefas

*Esta seção descreve o que o comando `/tasks` fará — NÃO execute isso agora, e NÃO gere `tasks.md` aqui.*

**Estratégia de geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md` como base.
- Uma tarefa por artefato de `docs/` listado na "Estrutura do Projeto" acima (README, openapi.yaml, cada guia, cada flow, error-catalog, design-prompt) — cada uma referenciando o RF e o contrato de conteúdo (`contracts/*.md`) correspondente.
- Uma tarefa de setup para a devDependency `@redocly/cli` + script `docs:lint`.
- Uma tarefa final de verificação cruzada: rodar `docs:lint`, conferir os dois checklists de cobertura (endpoints e erros) do `quickstart.md`, e listar toda divergência encontrada entre spec/código antigo e a doc nova (RF-020).
- Uma tarefa explícita de apresentar o `design-prompt.md` ao usuário para aprovação (RF-019) — não é considerada concluída automaticamente.

**Estratégia de ordenação**:
- Setup (`@redocly/cli` + script) antes de qualquer conteúdo.
- `openapi.yaml` e `error-catalog.md` antes dos guias de fluxo (os guias referenciam endpoints e códigos de erro já catalogados).
- Guias de fluxo antes do `design-prompt.md` (o prompt deriva as regras de negócio dos mesmos guias, para não duplicar/divergir).
- Tarefa de verificação cruzada e aprovação do prompt por último.
- `[P]` nas tarefas de arquivo independente dentro de `docs/flows/` (cada flow é um arquivo próprio, sem dependência entre si além de já existirem `openapi.yaml`/`error-catalog.md`).

## Rastreio de Complexidade

*Vazio — nenhuma violação da Verificação da Constituição.*

| Violação | Por que é necessária | Alternativa mais simples rejeitada e por quê |
|---|---|---|
| — | — | — |

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — pasta `design/` ainda não existe neste repositório)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
