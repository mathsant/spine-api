# Plano de Implementação: Autenticação e Cadastro

**Branch**: `002-authregistration` | **Data**: 2026-09-03 | **Spec**: [spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/002-authregistration/spec.md`

## Resumo

Entregar a fatia de autenticação do MVP (`product.md` escopo 1 + P8 + P11 + P12): cadastro
(`email` + `password` + `handle` + `displayName`), login por e-mail/senha, refresh token
rotativo com detecção de reuso, logout, troca de senha, e o **primitivo de autenticação**
(verificar o access token, anexar `request.currentUser`, proteger rotas) consumido primeiro
por `GET /v1/me`. Rate limit básico em `login`/`signup`. Nada de verificação de e-mail,
reset de senha, troca de e-mail, revogar-todas ou papéis (fora de escopo pela spec).

Abordagem técnica (Fase 0, `research.md`, decisões D1–D9):
- **Senha**: `scrypt` do `node:crypto`, sal por usuário, formato com parâmetros embutidos — sem dependência nova (D1).
- **Access token**: JWT `HS256` num módulo interno `src/auth/access-token.ts` com `node:crypto` (função pura, sem Fastify — os services não podem importar Fastify) (D2). TTL fixo de 15 min.
- **Refresh token**: opaco `base64url(32B)`, guardado só como `sha256` hex; cadeia de rotação em coleção própria `refresh_tokens`; rotação atômica por `updateOne` condicional; `modifiedCount 0` ⇒ reuso ⇒ revoga a sessão (D3, D4).
- **Borda**: `preHandler` `app.authenticate` (parsing do header, unitário) + `authenticate.service` que carrega o usuário (regra de negócio, integração) (D5).
- **Rate limit**: `@fastify/rate-limit` (única dependência nova, justificada) por rota, chave IP / IP+email, `errorResponseBuilder` no envelope do projeto (D6).
- **Config**: `ACCESS_TOKEN_SECRET` (obrigatória, fail-fast), `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS` no `AppConfig` (D7).
- **Persistência**: coleções `users`, `auth_sessions`, `refresh_tokens` via 3 migrations `migrate-mongo` reversíveis; `email`/`handle` normalizados + índice único simples (D8).
- **Divergência spec**: o cenário de aceitação 3 vence a RF-004 — a entrada de `handle` aceita `[A-Za-z0-9_]` e é normalizada para minúsculas (D9).

## Contexto Técnico

<!-- Esta seção é lida pelo update-agent-context.sh para atualizar o CLAUDE.md do projeto. -->

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

## Verificação da Constituição

*Gate obrigatório: rodado antes da Fase 0 e novamente após a Fase 1. Consulte `.specify/memory/constitution.md`.*

- [x] **Idioma do código: inglês** — toda pasta/arquivo/identificador/contrato/entidade/erro deste plano está em inglês (`users`, `auth_sessions`, `refresh_tokens`, `signupService`, `RefreshTokenReuseDetectedError`, …); artefatos SDD seguem em português. Conforme.
- [x] **P1 Testes por tipo de código** — regra de negócio = os 6 services de `src/services/auth/` (leem/escrevem `users`, `auth_sessions`, `refresh_tokens`): cobertos por **integração** com `mongodb-memory-server`, sem mock de banco, caminho feliz + ≥1 de erro cada (ex.: `signup` ok / e-mail duplicado; `refresh` ok / reuso / expirado; `authenticate` ok / conta inexistente). Funções puras — `hashPassword`/`verifyPassword`, `signAccessToken`/`verifyAccessToken`, `generateRefreshToken`, schemas `zod`, parsing do header `Authorization` — por **unitário**. Gate `src/services/**` ≥ 70% no CI (já configurado na 001). Conforme.
- [x] **P2 Acesso a dados só via repositório** — `UserRepository` + `MongoUserRepository`, `AuthSessionRepository` + `MongoAuthSessionRepository`, ambos injetados por Awilix. Services e `src/auth/*` não importam `mongodb` (regra ESLint da 001 barra o import fora de `repositories/**` e `db/**`). Conforme.
- [x] **P3 Validação de entrada com Zod na borda** — um schema `zod` por endpoint em `src/schemas/auth/`, validado no controller antes do service; `ZodError` → `ValidationError` (400 + `details`) pelo handler global da 001. Services recebem só dados já validados. Conforme.
- [x] **P4 Mudança de schema/índice apenas via migration** — 3 migrations `migrate-mongo` reversíveis criam as coleções e **todos** os índices (`users.email` único, `users.handle` único, `auth_sessions.userId`, `refresh_tokens.tokenHash` único, `refresh_tokens.sessionId`). Nenhum `createIndex` no bootstrap. Conforme.
- [x] **P5 Erros tipados com hierarquia** — 8 classes novas estendem `AppError` (`app-error.ts`), cada uma com `code` SCREAMING_SNAKE_CASE + `statusCode`. `MongoUserRepository.create` captura `code 11000` do driver e traduz em `EmailAlreadyInUseError`/`HandleAlreadyInUseError`; `MongoAuthSessionRepository` converte exceção crua em `DatabaseUnavailableError` (da 001). Nada do driver vaza para a borda. Conforme.

**Dependência nova**: `@fastify/rate-limit` — justificada em `research.md` D6 (RF-037/038; plugin oficial do ecossistema; hand-roll de sliding window é fonte de bug). A constituição exige apenas o registro da justificativa em `research.md` — cumprido.

Resultado: **sem violações** nas duas rodadas (inicial e pós-Fase 1). "Rastreio de Complexidade" só registra a divergência interna da spec (D9), que não fere princípio.

## Estrutura do Projeto

### Documentos desta feature (`specs/002-authregistration/`)

```
specs/002-authregistration/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # Fase 0 — decisões D1–D9
├── data-model.md        # Fase 1 — User, AuthSession, RefreshToken, AccessToken, erros
├── quickstart.md        # Fase 1 — validação manual (10 passos)
├── contracts/           # Fase 1
│   ├── auth.openapi.yaml       # 6 endpoints, /v1
│   ├── internal-ports.md       # interfaces entre camadas (auth/, repositories, services, http)
│   ├── error-codes.md          # 8 códigos novos + 429/500 + invariantes
│   └── env.contract.md         # ACCESS_TOKEN_SECRET, AUTH_RATE_LIMIT_*
└── tasks.md             # Fase 2 — gerado pelo /tasks, não por este comando
```

### Código-fonte (raiz do repositório)

Segue a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`.
Arquivos que esta feature cria (C) ou altera (M):

```
better-books/
├── src/
│   ├── app.ts                                   # M: registra @fastify/rate-limit, registerAuthentication, authRoutes com { prefix: '/v1' }
│   ├── config/
│   │   └── env.schema.ts                        # M: + ACCESS_TOKEN_SECRET, AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS
│   ├── auth/                                     # C: pasta transversal — utilidades de segurança sem estado (sem Fastify, sem mongodb)
│   │   ├── password.ts                          # C: hashPassword / verifyPassword (scrypt)
│   │   ├── access-token.ts                      # C: signAccessToken / verifyAccessToken (JWT HS256), ACCESS_TOKEN_TTL_SECONDS
│   │   ├── refresh-token.ts                     # C: generateRefreshToken / hashRefreshToken, REFRESH_INACTIVITY_DAYS
│   │   └── index.ts                             # C
│   ├── container/
│   │   ├── cradle.ts                            # M: + userRepository, authSessionRepository, clock, os 6 services de auth
│   │   ├── register-infrastructure.ts           # M: + clock (asValue { now: () => new Date() })
│   │   ├── register-repositories.ts             # M: + userRepository, authSessionRepository
│   │   └── register-services.ts                 # M: + signup/login/refresh/logout/changePassword/authenticate services
│   ├── errors/                                   # nomes seguem o padrão *-error.ts já usado na 001 (não o *.error.ts do architecture.md)
│   │   ├── email-already-in-use-error.ts        # C: 409 EMAIL_ALREADY_IN_USE
│   │   ├── handle-already-in-use-error.ts       # C: 409 HANDLE_ALREADY_IN_USE
│   │   ├── invalid-credentials-error.ts         # C: 401 INVALID_CREDENTIALS
│   │   ├── unauthenticated-error.ts             # C: 401 UNAUTHENTICATED
│   │   ├── invalid-access-token-error.ts        # C: 401 INVALID_ACCESS_TOKEN
│   │   ├── invalid-refresh-token-error.ts       # C: 401 INVALID_REFRESH_TOKEN
│   │   ├── refresh-token-expired-error.ts       # C: 401 REFRESH_TOKEN_EXPIRED
│   │   ├── refresh-token-reuse-detected-error.ts# C: 401 REFRESH_TOKEN_REUSE_DETECTED
│   │   └── index.ts                             # M: re-exporta os novos
│   ├── http/
│   │   ├── authenticate.ts                      # C: registerAuthentication(app) — preHandler app.authenticate + decorate request.currentUser
│   │   └── index.ts                             # M: + registerAuthentication
│   ├── schemas/
│   │   └── auth/
│   │       ├── signup.schema.ts                 # C
│   │       ├── login.schema.ts                  # C
│   │       ├── refresh.schema.ts                # C
│   │       ├── logout.schema.ts                 # C
│   │       ├── change-password.schema.ts        # C
│   │       └── index.ts                         # C   (remove src/schemas/.gitkeep)
│   ├── controllers/
│   │   └── auth/
│   │       ├── auth.routes.ts                   # C: plugin do domínio; rate limit por rota; preHandler app.authenticate em /me e /change-password
│   │       ├── signup.controller.ts             # C
│   │       ├── login.controller.ts              # C
│   │       ├── refresh.controller.ts            # C
│   │       ├── logout.controller.ts             # C
│   │       ├── change-password.controller.ts    # C
│   │       ├── get-me.controller.ts             # C: responde request.currentUser (sem service)
│   │       └── index.ts                         # C
│   ├── services/
│   │   └── auth/
│   │       ├── signup.service.ts                # C
│   │       ├── login.service.ts                 # C
│   │       ├── refresh.service.ts               # C
│   │       ├── logout.service.ts                # C
│   │       ├── change-password.service.ts       # C
│   │       ├── authenticate.service.ts          # C
│   │       └── index.ts                         # C
│   └── repositories/
│       ├── users/
│       │   ├── user.repository.ts               # C: interface UserRepository
│       │   ├── mongo-user.repository.ts         # C: impl + tradução de 11000
│       │   └── index.ts                         # C
│       └── auth-sessions/
│           ├── auth-session.repository.ts       # C: interface AuthSessionRepository (sessão + cadeia de refresh)
│           ├── mongo-auth-session.repository.ts # C: impl (rotação atômica, revogações)
│           └── index.ts                         # C
├── migrations/
│   ├── <ts>-create-users-collection.js          # C: users + índice único email + índice único handle
│   ├── <ts>-create-auth-sessions-collection.js  # C: auth_sessions + índice userId
│   └── <ts>-create-refresh-tokens-collection.js # C: refresh_tokens + índice único tokenHash + índice sessionId
├── tests/
│   ├── unit/
│   │   ├── auth/password.spec.ts                        # C: hash != plain; verify ok/erro; stored inválido não lança
│   │   ├── auth/access-token.spec.ts                    # C: sign→verify; exp no passado; assinatura adulterada; alg!=HS256/none
│   │   ├── auth/refresh-token.spec.ts                   # C: formato base64url; hash estável; tokens distintos
│   │   ├── http/authenticate.spec.ts                    # C: parsing do header (sem header / Basic / "Bearer " vazio → UnauthenticatedError)
│   │   └── schemas/auth/*.spec.ts                       # C: um por schema (bordas: senha 7/8/72/73, handle caixa/charset, displayName trim/vazio)
│   └── integration/
│       ├── services/auth/signup.service.spec.ts         # C: ok; e-mail dup (checagem); handle dup; corrida → 11000 traduzido
│       ├── services/auth/login.service.spec.ts          # C: ok cria sessão+elo; senha errada; e-mail inexistente (mesma resposta)
│       ├── services/auth/refresh.service.spec.ts        # C: rotação ok + janela renovada; reuso revoga sessão; expirado; desconhecido; corrida (2 refresh) → reuso
│       ├── services/auth/logout.service.spec.ts         # C: revoga sessão; token desconhecido resolve; 2º logout idempotente
│       ├── services/auth/change-password.service.spec.ts# C: ok revoga outras / preserva a corrente; senha atual errada; sem refreshToken revoga todas
│       ├── services/auth/authenticate.service.spec.ts   # C: token válido → PublicUser; conta apagada → INVALID_ACCESS_TOKEN; token expirado
│       └── http/auth.routes.spec.ts                     # C: app.inject() — signup 201/409/400; login 200/401; /me 200/401; refresh 200/401 (reuso); logout 204x2; change-password 204/401; rate limit → 429
├── .env.example                                 # M: + 3 linhas de auth
└── README.md                                    # M: seção "Auth" com os 6 endpoints e códigos de erro
```

> `src/auth/` não está listado em `architecture.md`, mas segue a mesma lógica de `src/http/`
> e `src/lifecycle/` da 001: concentra utilidades transversais sem estado (hash de senha,
> assinar/verificar token, gerar refresh token). Não é camada de domínio; sem subpastas por
> domínio. É importável por services (são funções puras, sem Fastify e sem `mongodb`).
>
> `GET /me` fica no domínio `auth` (identidade da sessão) para não colidir com o futuro
> `controllers/users/` da feature de Perfil.

## Fase 0: Pesquisa

Concluída — ver [research.md](./research.md). Nenhum `[NEEDS CLARIFICATION]` remanescente: a
stack está fixada por `architecture.md` e o comportamento pela spec + esclarecimentos de
2026-09-03. Decisões: D1 `scrypt` · D2 JWT HS256 interno · D3 refresh opaco + `sha256` · D4
modelo de sessão e rotação atômica · D5 `authenticate` (decorator + service) · D6
`@fastify/rate-limit` (dep nova justificada) · D7 novas envs · D8 migrations das coleções ·
D9 divergência da caixa do `@handle` (cenário de aceitação vence a RF-004).

**Saída**: `research.md`.

## Fase 1: Design & Contratos

Concluída.

1. `data-model.md` — `User`, `AuthSession`, `RefreshToken` (coleções + índices + regras),
   `AccessToken` efêmero, schemas de entrada e as 8 classes de erro novas.
2. `contracts/` — `auth.openapi.yaml` (6 endpoints sob `/v1`), `internal-ports.md`
   (interfaces `src/auth/*`, `UserRepository`, `AuthSessionRepository`, assinaturas dos 6
   services, decorator `authenticate`), `error-codes.md` (tabela código→status→origem +
   invariantes), `env.contract.md` (novas variáveis + fail-fast).
3. Cenários de teste extraídos dos 19 cenários de aceitação da spec → mapeados em
   `tests/unit/**` e `tests/integration/**` na Estrutura do Projeto acima (com destaque para
   reuso de refresh, corrida de rotação, e paridade da resposta de `INVALID_CREDENTIALS`).
4. `quickstart.md` — 10 passos cobrindo cada área da Definição de Pronto.
5. Design/telas: N/A (sem `design/`, sem UI).
6. `update-agent-context.sh` — executado para propagar a stack desta feature ao `CLAUDE.md`.

**Saída**: `data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md` atualizado.

## Fase 2: Abordagem de Planejamento de Tarefas

*Descrição do que o `/tasks` fará — não executar agora, não gerar `tasks.md` aqui.*

**Estratégia de geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md` como base.
- **Bloco A — fundação** (sequencial, precede o resto): adicionar `@fastify/rate-limit` ao
  `package.json`; teste unitário de `load-config` para `ACCESS_TOKEN_SECRET` ausente/curto
  **antes** de estender `env.schema.ts` + `.env.example` (D7); as 3 migrations `migrate-mongo`
  (D8).
- **Bloco B — `src/auth/` (funções puras, TDD, vários `[P]`)**: por utilidade, teste
  unitário antes → implementação: `password.ts`, `access-token.ts`, `refresh-token.ts`, mais
  o `index.ts` da pasta.
- **Bloco C — erros** (`[P]` entre si): uma tarefa por classe em `src/errors/*-error.ts`
  (padrão da 001) + atualizar `src/errors/index.ts`. Teste unitário do mapeamento só se
  fugir do padrão da 001.
- **Bloco D — schemas `zod`** (`[P]` entre si): um arquivo + um `*.spec.ts` unitário por
  schema em `src/schemas/auth/`; criar `src/schemas/auth/index.ts` e remover
  `src/schemas/.gitkeep`.
- **Bloco E — repositories, ordem TDD**: (0) helper `tests/helpers/auth-indexes.ts`
  (`ensureAuthIndexes(db)`) que replica os índices das migrations no Db em memória — as
  migrations não rodam sob `mongodb-memory-server`, mas a tradução de `11000` depende dos
  índices únicos; (1) teste de integração de `MongoUserRepository` (create + tradução de
  11000, findBy*) → implementação `user.repository.ts` + `mongo-user.repository.ts` +
  `index.ts`; (2) teste de integração de `MongoAuthSessionRepository` (createSession,
  findRefreshTokenByHash, rotate atômico, revokeSession, revokeAllUserSessions) →
  implementação `auth-session.repository.ts` + `mongo-auth-session.repository.ts` + `index.ts`.
- **Bloco F — services, ordem TDD** (teste de integração com `mongodb-memory-server` antes de
  cada um; dependências: repositories + `src/auth/*` prontos): `authenticate.service` →
  `signup.service` → `login.service` → `refresh.service` → `logout.service` →
  `change-password.service`; criar `src/services/auth/index.ts`.
- **Bloco G — container**: `cradle.ts`, `register-infrastructure.ts` (+ `clock`),
  `register-repositories.ts`, `register-services.ts` — uma tarefa cada (sequencial, tocam
  arquivos compartilhados).
- **Bloco H — borda HTTP, ordem TDD**: teste unitário do parsing do header →
  `src/http/authenticate.ts` + `src/http/index.ts`; depois os controllers (`[P]` entre si) e
  `auth.routes.ts` (rate limit por rota, `preHandler` nas protegidas); `src/controllers/auth/index.ts`.
- **Bloco I — composição**: alterar `src/app.ts` (registrar `@fastify/rate-limit`,
  `registerAuthentication`, `authRoutes` com `{ prefix: '/v1' }`); teste de integração
  `tests/integration/http/auth.routes.spec.ts` cobrindo os 19 cenários de aceitação via
  `app.inject()` — incl. `429` em `login` **e** `signup`, contagem por chave (IP / IP+email),
  reset da janela (RF-038, `window` curto por config de teste) e access token ainda válido
  após `logout`.
- **Bloco J — docs e fechamento**: `README.md` (seção Auth); teste de integração
  `tests/integration/http/auth-logging.spec.ts` garantindo que nenhum token/hash/senha
  aparece em log (RF-042 / DoD item 4); checagens estruturais; executar `quickstart.md` e
  marcar a Definição de Pronto.
- Cada pasta de domínio nova termina com `index.ts` de re-export (dobrado na tarefa que cria
  os arquivos da pasta).

**Estratégia de ordenação**:
- Fundação (A) antes de tudo; `src/auth/*` (B) e erros (C) antes dos services.
- Dependência: `env`/migrations → repositories → services → container → controllers →
  `app.ts`.
- TDD: teste antes da implementação em B, E, F e H.
- `[P]` para arquivos independentes (utilidades de `src/auth/` entre si, classes de erro,
  schemas, controllers).
- O teste `auth.routes.spec.ts` (I) por último, quando todas as peças existem.

**Estimativa**: ~74 tarefas (ver `tasks.md`).

## Rastreio de Complexidade

*Sem violações da Verificação da Constituição. Registro único: divergência interna da spec.*

| Item | O que é | Resolução |
|---|---|---|
| Caixa do `@handle` na entrada (D9) | RF-004 diz charset `[a-z0-9_]`, mas o cenário de aceitação 3 exige que `handle: "Alice"` resulte em `409 HANDLE_ALREADY_IN_USE` (não `400`) | O cenário de aceitação vence: schema aceita `[A-Za-z0-9_]{3,30}`, o service normaliza para minúsculas antes de checar unicidade e persistir. `handle` canônico e imutável = forma minúscula. Sem impacto em princípio da constituição. |
| `src/auth/` fora de `architecture.md` | pasta transversal nova | mesma justificativa de `src/http/`/`src/lifecycle/` da 001: utilidades sem estado, sem camada de domínio; anotado na Estrutura do Projeto |
| `@fastify/rate-limit` (dependência nova) | rate limit de `login`/`signup` | justificada em `research.md` D6 conforme exige a constituição |

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — sem `design/`, sem UI)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
- [ ] Fase 2: `/tasks` (`tasks.md`) — próximo comando
