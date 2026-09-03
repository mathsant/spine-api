# CLAUDE.md

Contexto do projeto para o Claude Code. Este arquivo tem duas partes:

1. Conteúdo abaixo desta linha e acima do marcador `SDD:AUTO-GERADO`: **edição manual livre** — convenções do time, links úteis, avisos para o agente. Nunca é sobrescrito pelos scripts do kit SDD.
2. Bloco entre `<!-- SDD:AUTO-GERADO:INICIO -->` e `<!-- SDD:AUTO-GERADO:FIM -->`: gerado por `.specify/scripts/bash/update-agent-context.sh` a partir do `plan.md` da feature ativa. Não edite essa parte à mão — ela é substituída a cada rodada do `/plan`.

## Convenções do projeto

[Preencha manualmente: estilo de código, padrões de commit, o que evitar, etc.]

## Comandos úteis

[Preencha manualmente: como rodar, testar, buildar este projeto.]

<!-- O bloco AUTO-GERADO é anexado abaixo na primeira vez que /plan rodar. -->

<!-- SDD:AUTO-GERADO:INICIO -->
<!-- Gerado automaticamente por update-agent-context.sh a partir de E:/projetos/better-books/specs/001-backendappsetup/plan.md. -->
<!-- Não edite esta seção manualmente; edite o plan.md e rode o script de novo. -->

## Stack ativa (feature: 001-backendappsetup)



**Linguagem/versão**: TypeScript ~7.x (strict, `module: commonjs`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5
**Armazenamento**: MongoDB — local via `docker-compose` (`mongo:7`); `mongodb-memory-server` ^11 nos testes de integração; sem migration de dados nesta feature
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); `mongodb-memory-server` para regra de negócio
**Ferramentas**: migrate-mongo ^14 (só infra), ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino (embutido no Fastify) + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas)
**Metas de performance**: N/A (feature de setup); `GET /health` deve responder mesmo com o banco fora, `ping` com timeout de 1 s
**Restrições**: fail-fast em config inválida; nenhuma exceção crua do driver além do repository; cobertura de `src/services/**` ≥ 70% quebra o CI; nenhum `export default`; `mongodb` só importável em `repositories/**` e `db/**`
**Escala/escopo**: 1 endpoint (`GET /health`), 3 entidades conceituais (AppConfig, HealthStatus, hierarquia AppError), ~8 pastas de camada

<!-- SDD:AUTO-GERADO:FIM -->
