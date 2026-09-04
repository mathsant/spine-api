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
<!-- Gerado automaticamente por update-agent-context.sh a partir de E:/projetos/better-books/specs/005-reviews/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 005-reviews)


**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova nesta feature** — média e contagem de rating são uma agregação nativa do MongoDB (`$group` com `$avg`/`$sum`) sobre a nova coleção `reviews`
**Armazenamento**: MongoDB — coleção nova `reviews` criada por 1 migration `migrate-mongo` reversível (índice único em `sessionId` para a relação 1:1 com `ReadingSession`, índice em `bookId` para a agregação do detalhe do livro); `mongodb-memory-server` ^11 nos testes de integração (inclusive da agregação `$group`)
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (services de `reviews`, extensão de `get-book`/`delete-reading-session`) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; agregação de nota média/contagem é uma consulta indexada por `bookId` sobre `reviews` (mesmo custo de ordem de grandeza que `countDistinctFinishedReaders` já usado no detalhe do livro); embutir a review no histórico de reading sessions usa uma única consulta `$in` por página (sem N+1)
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; services não importam Fastify; nenhum `export default`; no máximo uma `Review` por `sessionId` (índice único); toda operação de review sobre uma `ReadingSession`/`Review` que não pertence ao usuário autenticado (ou não existe) responde `404` (`ReadingSessionNotFoundError`/`ReviewNotFoundError`), nunca `403` (D7/D9, mesmo padrão das features 003/004); criar review exige `ReadingSession.status === 'finished'` (senão `409`); apagar uma `ReadingSession` apaga sua `Review` em cascata
**Escala/escopo**: 3 endpoints novos (`POST /v1/reading-sessions/:sessionId/review`, `PATCH /v1/reviews/:reviewId`, `DELETE /v1/reviews/:reviewId`) + extensão de 2 endpoints existentes (`GET` de book detail da 003 ganha agregados reais; `GET /v1/me/reading-sessions` da 003 ganha `review` embutido); 1 coleção nova + 1 migration; 1 entidade persistida nova (`Review`); 3 classes de erro novas (`ReviewNotFoundError`, `ReadingSessionNotFinishedError`, `ReviewAlreadyExistsError`) + reuso de `ReadingSessionNotFoundError`; 3 services novos (`create-review`, `edit-review`, `delete-review`) + 2 services estendidos (`get-book`, `delete-reading-session`) + 1 mapeamento estendido (`list-reading-sessions`/`to-dto` de reading-sessions); 1 repository novo (`reviews`); 1 pasta de domínio nova em `controllers`/`services`/`repositories`/`schemas` (`reviews`)

<!-- SDD:AUTO-GERADO:FIM -->
