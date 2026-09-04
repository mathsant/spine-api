# Tarefas: Autenticação e Cadastro

**Entrada**: `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/002-authregistration/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial (mesmo arquivo ou depende de outra tarefa).

Caminhos seguem a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`.
Cada tarefa que cria arquivos numa pasta de domínio também cria/atualiza o `index.ts` de re-export dessa pasta (exports nomeados, nunca `export default`).

**Nota de nomenclatura**: as classes de erro seguem o padrão já existente em `src/errors/*` da
feature 001 (`validation-error.ts`, `not-found-error.ts`) — sufixo `-error.ts` na forma de
palavra. Isso diverge do exemplo `*.error.ts` de `architecture.md`; não renomeamos os
arquivos da 001 aqui para não misturar dois esquemas na mesma pasta.

**Nota sobre índices nos testes de integração**: as migrations (T005–T007) **não** rodam sob
`mongodb-memory-server`. As assertivas que dependem de índice único (tradução de `code 11000`)
usam o helper `ensureAuthIndexes` (T031) no `beforeAll`. As demais assertivas de `409`
funcionam pela checagem prévia no service e não exigem o índice.

## Fases (cada uma é um marco entregável)

1. **Fundação** — dependência nova, variáveis de ambiente e migrations das 3 coleções. Marco: `pnpm install` ok; `pnpm migrate:up` cria `users`/`auth_sessions`/`refresh_tokens` com índices; boot aborta sem `ACCESS_TOKEN_SECRET`.
2. **Erros tipados e schemas de entrada** — 8 classes de erro que estendem `AppError` + os 5 schemas `zod` dos endpoints. Marco: `pnpm lint`/`pnpm build` limpos; `ZodError` de qualquer schema já vira `400 VALIDATION_ERROR` pelo handler global da 001.
3. **Primitivos de segurança (`src/auth/`)** — funções puras: normalização de identificador, hash de senha (`scrypt`), JWT HS256, refresh token opaco. Marco: unitários verdes; `verifyAccessToken` recusa `alg` ≠ HS256 (incl. `none`).
4. **Camada de dados** — helper de índices para teste + `UserRepository` e `AuthSessionRepository` (interface + impl Mongo) em ordem TDD. Marco: integração verde com `mongodb-memory-server`, incl. tradução de `code 11000` e rotação atômica de refresh token.
5. **Regras de negócio + container** — os 6 services de `src/services/auth/` em ordem TDD e a fiação Awilix (`clock`, repositories, services). Marco: cobertura de `src/services/**` ≥ 70%; cada service com caminho feliz + ≥1 de erro.
6. **Borda HTTP** — decorator `authenticate`, os 6 controllers, o plugin de rotas com rate limit, e `app.ts` sob `{ prefix: '/v1' }`. Marco: `app.inject()` cobre os 19 cenários de aceitação, incl. `429` em `login` e `signup` e o reset da janela.
7. **Documentação e fechamento** — README, teste de não-vazamento de segredo em log, checagens estruturais e execução do `quickstart.md`. Marco: Definição de Pronto toda verificável.

---

## Fase 1: Fundação

- [x] T001 Adicionar `@fastify/rate-limit` `^10` a `dependencies` do `package.json` (confirmar o major atual no registro npm) e rodar `pnpm install` (atualiza `pnpm-lock.yaml`). Arquivos: `package.json`, `pnpm-lock.yaml`
- [x] T002 [P] Acrescentar ao `.env.example` o bloco `# auth (002-authregistration)` com `ACCESS_TOKEN_SECRET`, `AUTH_RATE_LIMIT_MAX=10`, `AUTH_RATE_LIMIT_WINDOW_MS=900000` (ver `contracts/env.contract.md`). Arquivo: `.env.example`
- [x] T003 Estender o teste unitário do carregador de config (TDD — escrito antes de T004, que o faz passar): `ACCESS_TOKEN_SECRET` ausente → `process.exit(1)` com mensagem citando o campo; segredo com menos de 32 chars → inválido; `AUTH_RATE_LIMIT_MAX`/`AUTH_RATE_LIMIT_WINDOW_MS` ausentes → defaults `10`/`900000` no `AppConfig`. Arquivo: `tests/unit/config/load-config.spec.ts`
- [x] T004 Estender o schema `zod` de ambiente conforme `contracts/env.contract.md`: `ACCESS_TOKEN_SECRET` (`z.string().min(32)`, sem default), `AUTH_RATE_LIMIT_MAX` (`z.coerce.number().int().min(1).default(10)`), `AUTH_RATE_LIMIT_WINDOW_MS` (`z.coerce.number().int().min(1000).default(900000)`); no `transform`, mapear para `accessTokenSecret`, `authRateLimitMax`, `authRateLimitWindowMs`. Arquivo: `src/config/env.schema.ts` (faz T003 passar)
- [x] T005 [P] Gerar via `pnpm migrate:create -- create-users-collection` e preencher: `up` cria a coleção `users`, `createIndex({ email: 1 }, { unique: true })` e `createIndex({ handle: 1 }, { unique: true })`; `down` faz `db.collection('users').drop()`. Arquivo: `migrations/<timestamp>-create-users-collection.js`
- [x] T006 [P] Gerar via `pnpm migrate:create -- create-auth-sessions-collection` e preencher: `up` cria `auth_sessions` e `createIndex({ userId: 1 })`; `down` dropa a coleção. Arquivo: `migrations/<timestamp>-create-auth-sessions-collection.js`
- [x] T007 [P] Gerar via `pnpm migrate:create -- create-refresh-tokens-collection` e preencher: `up` cria `refresh_tokens`, `createIndex({ tokenHash: 1 }, { unique: true })` e `createIndex({ sessionId: 1 })`; `down` dropa a coleção. Arquivo: `migrations/<timestamp>-create-refresh-tokens-collection.js`

## Fase 2: Erros tipados e schemas de entrada

- [x] T008 [P] Criar `EmailAlreadyInUseError extends AppError` (`code: 'EMAIL_ALREADY_IN_USE'`, `statusCode: 409`). Arquivo: `src/errors/email-already-in-use-error.ts`
- [x] T009 [P] Criar `HandleAlreadyInUseError extends AppError` (`code: 'HANDLE_ALREADY_IN_USE'`, `statusCode: 409`). Arquivo: `src/errors/handle-already-in-use-error.ts`
- [x] T010 [P] Criar `InvalidCredentialsError extends AppError` (`code: 'INVALID_CREDENTIALS'`, `statusCode: 401`, `message` genérica fixa como `'Invalid email or password'`, idêntica para os dois casos — RF-014). Arquivo: `src/errors/invalid-credentials-error.ts`
- [x] T011 [P] Criar `UnauthenticatedError extends AppError` (`code: 'UNAUTHENTICATED'`, `statusCode: 401`). Arquivo: `src/errors/unauthenticated-error.ts`
- [x] T012 [P] Criar `InvalidAccessTokenError extends AppError` (`code: 'INVALID_ACCESS_TOKEN'`, `statusCode: 401`). Arquivo: `src/errors/invalid-access-token-error.ts`
- [x] T013 [P] Criar `InvalidRefreshTokenError extends AppError` (`code: 'INVALID_REFRESH_TOKEN'`, `statusCode: 401`). Arquivo: `src/errors/invalid-refresh-token-error.ts`
- [x] T014 [P] Criar `RefreshTokenExpiredError extends AppError` (`code: 'REFRESH_TOKEN_EXPIRED'`, `statusCode: 401`). Arquivo: `src/errors/refresh-token-expired-error.ts`
- [x] T015 [P] Criar `RefreshTokenReuseDetectedError extends AppError` (`code: 'REFRESH_TOKEN_REUSE_DETECTED'`, `statusCode: 401`). Arquivo: `src/errors/refresh-token-reuse-detected-error.ts`
- [x] T016 Atualizar o barrel de erros reexportando as 8 classes novas junto das existentes. Arquivo: `src/errors/index.ts` (depende de T008–T015)
- [x] T017 [P] Schema `zod` de `signup` + teste unitário (TDD): `email` (e-mail válido, `max 254`), `password` (`min 8`, `max 72`), `handle` (`regex /^[A-Za-z0-9_]{3,30}$/` — aceita maiúsculas na entrada, D9), `displayName` (`trim`, `min 1`, `max 50`). Cobre bordas 7/8/72/73 chars de senha e handle `"Alice"`. Arquivos: `src/schemas/auth/signup.schema.ts`, `tests/unit/schemas/auth/signup.schema.spec.ts`
- [x] T018 [P] Schema `zod` de `login` + teste unitário (TDD): `email` (e-mail válido), `password` (`min 1`, `max 72`). Arquivos: `src/schemas/auth/login.schema.ts`, `tests/unit/schemas/auth/login.schema.spec.ts`
- [x] T019 [P] Schema `zod` de `refresh` + teste unitário (TDD): `refreshToken` (`min 1`). Arquivos: `src/schemas/auth/refresh.schema.ts`, `tests/unit/schemas/auth/refresh.schema.spec.ts`
- [x] T020 [P] Schema `zod` de `logout` + teste unitário (TDD): `refreshToken` (`min 1`). Arquivos: `src/schemas/auth/logout.schema.ts`, `tests/unit/schemas/auth/logout.schema.spec.ts`
- [x] T021 [P] Schema `zod` de `changePassword` + teste unitário (TDD): `currentPassword` (`min 1`, `max 72`), `newPassword` (`min 8`, `max 72`), `refreshToken` opcional (`min 1` se presente). Arquivos: `src/schemas/auth/change-password.schema.ts`, `tests/unit/schemas/auth/change-password.schema.spec.ts`
- [x] T022 Criar o barrel `src/schemas/auth/index.ts` reexportando os 5 schemas e seus tipos inferidos; remover `src/schemas/.gitkeep`. Arquivos: `src/schemas/auth/index.ts`, `src/schemas/.gitkeep` (depende de T017–T021)

## Fase 3: Primitivos de segurança (`src/auth/`)

- [x] T023 [P] Criar `normalizeEmail` (`trim().toLowerCase()`) e `normalizeHandle` (`toLowerCase()`) + teste unitário (TDD). Arquivos: `src/auth/normalize.ts`, `tests/unit/auth/normalize.spec.ts`
- [x] T024 [P] Teste unitário de `password` (TDD): `hashPassword` produz string no formato `scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>`; dois hashes da mesma senha diferem (sal); `verifyPassword` `true` para a senha certa, `false` para a errada; `stored` malformado → `false` sem lançar. Arquivo: `tests/unit/auth/password.spec.ts`
- [x] T025 Criar `hashPassword(plain): Promise<string>` e `verifyPassword(plain, stored): Promise<boolean>` com `crypto.scrypt` (N=2^15, r=8, p=1), sal aleatório de 16 B, saída de 64 B, `crypto.timingSafeEqual`; `verifyPassword` roda o KDF mesmo com `stored` inválido (anti-timing). Arquivo: `src/auth/password.ts` (faz T024 passar)
- [x] T026 [P] Teste unitário de `access-token` (TDD): `signAccessToken` → `verifyAccessToken` devolve `{ userId }`; `exp` no passado → `InvalidAccessTokenError`; assinatura adulterada → erro; header com `alg` ≠ `HS256` (incl. `"none"`) → erro; token malformado → erro; `ACCESS_TOKEN_TTL_SECONDS === 900`. Arquivo: `tests/unit/auth/access-token.spec.ts` (depende de T012)
- [x] T027 Criar `signAccessToken(claims, secret, nowSeconds?)` e `verifyAccessToken(token, secret, nowSeconds?)` — JWT compacto HS256 com `crypto.createHmac` + `crypto.timingSafeEqual`, `exp = iat + ACCESS_TOKEN_TTL_SECONDS` (900), recusa qualquer `alg` que não seja `HS256`; falhas lançam `InvalidAccessTokenError`. Exportar `ACCESS_TOKEN_TTL_SECONDS`. Arquivo: `src/auth/access-token.ts` (depende de T012; faz T026 passar)
- [x] T028 [P] Teste unitário de `refresh-token` (TDD): `generateRefreshToken()` devolve `{ token, tokenHash }` com `token` em `base64url` (32 B) e `tokenHash` = `sha256` hex de 64 chars; chamadas sucessivas dão tokens distintos; `hashRefreshToken(token)` é estável e igual ao `tokenHash`; `REFRESH_INACTIVITY_DAYS === 30`. Arquivo: `tests/unit/auth/refresh-token.spec.ts`
- [x] T029 Criar `generateRefreshToken(): { token; tokenHash }` (`crypto.randomBytes(32)` → `base64url`; `tokenHash = sha256(token)` hex) e `hashRefreshToken(token): string`. Exportar `REFRESH_INACTIVITY_DAYS`. Arquivo: `src/auth/refresh-token.ts` (faz T028 passar)
- [x] T030 Criar o barrel `src/auth/index.ts` reexportando `normalizeEmail`, `normalizeHandle`, `hashPassword`, `verifyPassword`, `signAccessToken`, `verifyAccessToken`, `ACCESS_TOKEN_TTL_SECONDS`, `generateRefreshToken`, `hashRefreshToken`, `REFRESH_INACTIVITY_DAYS`. Arquivo: `src/auth/index.ts` (depende de T023, T025, T027, T029)

## Fase 4: Camada de dados (TDD)

- [x] T031 Criar `ensureAuthIndexes(db: Db): Promise<void>` que aplica, sobre um `Db`, os mesmos índices das migrations T005–T007 (`users` `{email:1}`/`{handle:1}` únicos, `auth_sessions` `{userId:1}`, `refresh_tokens` `{tokenHash:1}` único/`{sessionId:1}`). Usado no `beforeAll` dos testes de integração que dependem de índice único. Arquivo: `tests/helpers/auth-indexes.ts`
- [x] T032 [P] Teste de integração de `MongoUserRepository` (TDD, `mongodb-memory-server` via `tests/helpers/mongo-memory.ts` + `ensureAuthIndexes` no `beforeAll`): `create` retorna `UserRecord` com `id: string`; `create` com `email` já usado → `EmailAlreadyInUseError`; com `handle` já usado → `HandleAlreadyInUseError` (traduzidos do `code 11000`); `findByEmail`/`findByHandle`/`findById` acham e retornam `null` quando não há; `updatePasswordHash` troca `passwordHash` e atualiza `updatedAt`. Arquivo: `tests/integration/repositories/users/mongo-user.repository.spec.ts` (depende de T016, T031)
- [x] T033 Criar a interface `UserRepository` e os tipos `UserRecord`, `CreateUserInput` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/users/user.repository.ts`
- [x] T034 Criar `MongoUserRepository implements UserRepository` recebendo `db: Db`: mapeia `_id` ↔ `id` (hex), insere, captura violação de índice único do driver (`code 11000`) e traduz por `keyPattern` (`email` → `EmailAlreadyInUseError`, `handle` → `HandleAlreadyInUseError`), `findBy*`, `updatePasswordHash`. Nenhuma exceção crua do driver escapa (P5). Arquivo: `src/repositories/users/mongo-user.repository.ts` (depende de T033, T016; faz T032 passar)
- [x] T035 Criar o barrel `src/repositories/users/index.ts` reexportando a interface, os tipos e `MongoUserRepository`. Arquivo: `src/repositories/users/index.ts` (depende de T033, T034)
- [x] T036 [P] Teste de integração de `MongoAuthSessionRepository` (TDD, com `ensureAuthIndexes` no `beforeAll`): `createSession` grava a sessão `active` + o primeiro elo `refresh_tokens` com `rotatedAt: null`; `findRefreshTokenByHash` e `findSessionById` retornam o registrado / `null`; `rotate` casa uma vez (`{ rotated: true }`), grava `rotatedAt` no elo antigo, insere o novo elo e faz `touch` na sessão (`lastUsedAt`, `inactivityExpiresAt`); `rotate` no mesmo elo de novo → `{ rotated: false }`; `revokeSession` é idempotente e grava `revokedReason`; `revokeAllUserSessions` respeita `exceptSessionId`. Arquivo: `tests/integration/repositories/auth-sessions/mongo-auth-session.repository.spec.ts` (depende de T016, T031)
- [x] T037 Criar a interface `AuthSessionRepository` e os tipos `RevokedReason`, `AuthSessionRecord`, `RefreshTokenRecord`, `CreateSessionInput`, `RotateInput` conforme `contracts/internal-ports.md`. Arquivo: `src/repositories/auth-sessions/auth-session.repository.ts`
- [x] T038 Criar `MongoAuthSessionRepository implements AuthSessionRepository` recebendo `db: Db`: opera sobre `auth_sessions` e `refresh_tokens`; `rotate` = `updateOne({ _id: currentTokenId, rotatedAt: null }, { $set: { rotatedAt: now } })` e, se `modifiedCount === 1`, insere o novo elo + `touch` na sessão; converte exceção crua do driver em `DatabaseUnavailableError`. Arquivo: `src/repositories/auth-sessions/mongo-auth-session.repository.ts` (depende de T037, T016; faz T036 passar)
- [x] T039 Criar o barrel `src/repositories/auth-sessions/index.ts` reexportando a interface, os tipos e `MongoAuthSessionRepository`. Arquivo: `src/repositories/auth-sessions/index.ts` (depende de T037, T038)

## Fase 5: Regras de negócio + container

- [x] T040 Registrar `clock` (`asValue({ now: () => new Date() })`) no registro de infraestrutura do Awilix. Arquivo: `src/container/register-infrastructure.ts` (depende de nada além da Fase 1)
- [x] T041 Registrar `userRepository` (`asFunction((c) => new MongoUserRepository(c.db))`, singleton) e `authSessionRepository` (idem `MongoAuthSessionRepository`) no registro de repositories. Arquivo: `src/container/register-repositories.ts` (depende de T034, T038)
- [x] T042 Estender `AppCradle` com `userRepository: UserRepository`, `authSessionRepository: AuthSessionRepository` e `clock: { now: () => Date }`. Arquivo: `src/container/cradle.ts` (depende de T033, T037; sequencial com T057 — mesmo arquivo)
- [x] T043 [P] Teste de integração de `authenticate.service` (TDD): access token válido de um usuário existente → `PublicUser` do dono (sem `passwordHash`); `sub` de conta inexistente → `InvalidAccessTokenError`; token expirado → `InvalidAccessTokenError`; token com assinatura adulterada → `InvalidAccessTokenError`. Arquivo: `tests/integration/services/auth/authenticate.service.spec.ts` (depende de T027, T034)
- [x] T044 Criar `makeAuthenticate({ userRepository, config }): Authenticate` — `verifyAccessToken(token, config.accessTokenSecret)` → `{ userId }`; `userRepository.findById(userId)`; conta ausente → `InvalidAccessTokenError`; retorna `PublicUser`. Arquivo: `src/services/auth/authenticate.service.ts` (depende de T027, T033; faz T043 passar)
- [x] T045 [P] Teste de integração de `signup.service` (TDD, com `ensureAuthIndexes` no `beforeAll` para o caso de corrida): entrada válida → `PublicUser` sem `passwordHash`, `email`/`handle` normalizados; `email` já existente (checagem prévia) → `EmailAlreadyInUseError`; `handle: "Alice"` quando `alice` existe → `HandleAlreadyInUseError` (D9); repo lançando `code 11000` (corrida) → o erro traduzido propaga; não retorna tokens. Arquivo: `tests/integration/services/auth/signup.service.spec.ts` (depende de T025, T034, T031)
- [x] T046 Criar `makeSignup({ userRepository }): Signup` — `normalizeEmail`/`normalizeHandle`; `findByEmail`/`findByHandle` → erros amigáveis; `hashPassword`; `userRepository.create` (a violação de índice único cobre a corrida); retorna `PublicUser`. Arquivo: `src/services/auth/signup.service.ts` (depende de T023, T025, T033; faz T045 passar)
- [x] T047 [P] Teste de integração de `login.service` (TDD): credenciais válidas → `TokenPair` (`tokenType: 'Bearer'`, `expiresIn: 900`) + `auth_sessions` `active` e `refresh_tokens` com `rotatedAt: null` gravados; senha errada → `InvalidCredentialsError`; e-mail inexistente → `InvalidCredentialsError` com a **mesma** `message` (e `verifyPassword` foi chamado — anti-timing). Arquivo: `tests/integration/services/auth/login.service.spec.ts` (depende de T025, T027, T029, T038)
- [x] T048 Criar `makeLogin({ userRepository, authSessionRepository, config, clock }): Login` — `normalizeEmail`; `findByEmail`; `verifyPassword` **sempre** (hash dummy quando não achou); `InvalidCredentialsError` nos dois casos; `generateRefreshToken`; `authSessionRepository.createSession` (`inactivityExpiresAt = now + 30d`); `signAccessToken`. Arquivo: `src/services/auth/login.service.ts` (depende de T023, T025, T027, T029, T033, T037; faz T047 passar)
- [x] T049 [P] Teste de integração de `refresh.service` (TDD): rotação ok → novo par, elo antigo com `rotatedAt`, sessão com `lastUsedAt`/`inactivityExpiresAt` renovados; reapresentar o elo antigo → `RefreshTokenReuseDetectedError` e sessão `revoked`/`reuse_detected`; sessão com `inactivityExpiresAt` no passado → `RefreshTokenExpiredError`; token desconhecido → `InvalidRefreshTokenError`; sessão já `revoked` → `InvalidRefreshTokenError`; `rotate` retornando `{ rotated: false }` (corrida) → `RefreshTokenReuseDetectedError`. Arquivo: `tests/integration/services/auth/refresh.service.spec.ts` (depende de T027, T029, T038)
- [x] T050 Criar `makeRefresh({ authSessionRepository, config, clock }): Refresh` — `hashRefreshToken`; `findRefreshTokenByHash`; regras D4 (`INVALID` / `EXPIRED` / `REUSE_DETECTED` + `revokeSession`); `generateRefreshToken` novo; `authSessionRepository.rotate` (`rotated: false` → reuso + `revokeSession`); `signAccessToken`. Arquivo: `src/services/auth/refresh.service.ts` (depende de T027, T029, T037; faz T049 passar)
- [x] T051 [P] Teste de integração de `logout.service` (TDD): elo válido → sessão `revoked`/`logout`, e `refresh` posterior → `InvalidRefreshTokenError`; token desconhecido → resolve `void` sem erro; segundo `logout` do mesmo token → resolve `void` (idempotente). Arquivo: `tests/integration/services/auth/logout.service.spec.ts` (depende de T029, T038)
- [x] T052 Criar `makeLogout({ authSessionRepository }): Logout` — `hashRefreshToken`; `findRefreshTokenByHash`; se achou → `revokeSession(sessionId, 'logout')`; sempre resolve `void`. Arquivo: `src/services/auth/logout.service.ts` (depende de T029, T037; faz T051 passar)
- [x] T053 [P] Teste de integração de `change-password.service` (TDD): senha atual correta → `updatePasswordHash` e `revokeAllUserSessions('password_changed', { exceptSessionId })` da sessão do `refreshToken` enviado — a sessão corrente sobrevive, as demais não; sem `refreshToken` → todas revogadas; `refreshToken` de outra conta → ignorado (todas revogadas); senha atual errada → `InvalidCredentialsError` e `passwordHash` inalterado. Arquivo: `tests/integration/services/auth/change-password.service.spec.ts` (depende de T025, T029, T034, T038)
- [x] T054 Criar `makeChangePassword({ userRepository, authSessionRepository, clock }): ChangePassword` — `findById`; `verifyPassword(currentPassword)` → `InvalidCredentialsError`; `hashPassword(newPassword)`; `updatePasswordHash`; resolver `exceptSessionId` via `hashRefreshToken` + `findRefreshTokenByHash` (só se o elo for do mesmo `userId` e a sessão estiver `active`); `revokeAllUserSessions(userId, 'password_changed', { exceptSessionId })`. Arquivo: `src/services/auth/change-password.service.ts` (depende de T025, T029, T033, T037; faz T053 passar)
- [x] T055 Criar o barrel `src/services/auth/index.ts` reexportando `makeAuthenticate`, `makeSignup`, `makeLogin`, `makeRefresh`, `makeLogout`, `makeChangePassword` e os tipos `Authenticate`, `Signup`, `Login`, `Refresh`, `Logout`, `ChangePassword`, `PublicUser`, `TokenPair`. Arquivo: `src/services/auth/index.ts` (depende de T044, T046, T048, T050, T052, T054)
- [x] T056 Registrar `authenticateService`, `signupService`, `loginService`, `refreshService`, `logoutService`, `changePasswordService` (`asFunction`, cada um puxando suas deps do cradle) no registro de services. Arquivo: `src/container/register-services.ts` (depende de T055)
- [x] T057 Estender `AppCradle` com os 6 tipos de service (`Authenticate`, `Signup`, `Login`, `Refresh`, `Logout`, `ChangePassword`). Arquivo: `src/container/cradle.ts` (depende de T055; sequencial com T042 — mesmo arquivo)

## Fase 6: Borda HTTP

- [x] T058 [P] Teste unitário do parsing do header em `authenticate` (TDD): sem `Authorization` → `UnauthenticatedError`; `Authorization: Basic x` → `UnauthenticatedError`; `Authorization: Bearer ` (valor vazio) → `UnauthenticatedError`; `Authorization: Bearer abc` → resolve `authenticateService` do `request.diScope` com `'abc'` e popula `request.currentUser`. Usa `request`/`diScope` fakes. Arquivo: `tests/unit/http/authenticate.spec.ts` (depende de T011)
- [x] T059 Criar `registerAuthentication(app)` que decora `app.authenticate` (`preHandler`) e faz o `declare module 'fastify'` de `request.currentUser` e `app.authenticate`; lê `Authorization: Bearer <t>` (erros → `UnauthenticatedError`), resolve `authenticateService`, popula `request.currentUser`. Arquivo: `src/http/authenticate.ts` (depende de T011, T044; faz T058 passar)
- [x] T060 Atualizar o barrel de HTTP reexportando `registerAuthentication` (junto de `registerErrorHandler`, `toErrorResponse`, etc.). Arquivo: `src/http/index.ts` (depende de T059)
- [x] T061 [P] Criar `signupController`: valida o corpo com `signupSchema`, resolve `signupService` do `request.diScope`, responde `201` com o `PublicUser`. Arquivo: `src/controllers/auth/signup.controller.ts` (depende de T017, T046)
- [x] T062 [P] Criar `loginController`: valida com `loginSchema`, resolve `loginService`, responde `200` com o `TokenPair`. Arquivo: `src/controllers/auth/login.controller.ts` (depende de T018, T048)
- [x] T063 [P] Criar `refreshController`: valida com `refreshSchema`, resolve `refreshService`, responde `200` com o `TokenPair`. Arquivo: `src/controllers/auth/refresh.controller.ts` (depende de T019, T050)
- [x] T064 [P] Criar `logoutController`: valida com `logoutSchema`, resolve `logoutService`, responde `204` sem corpo. Arquivo: `src/controllers/auth/logout.controller.ts` (depende de T020, T052)
- [x] T065 [P] Criar `changePasswordController`: valida com `changePasswordSchema`, usa `request.currentUser.id`, resolve `changePasswordService`, responde `204`. Arquivo: `src/controllers/auth/change-password.controller.ts` (depende de T021, T054)
- [x] T066 [P] Criar `getMeController`: responde `200` com `request.currentUser` (sem service). Arquivo: `src/controllers/auth/get-me.controller.ts` (depende de T059)
- [x] T067 Criar o plugin de rotas do domínio `auth`: `POST /auth/signup` (com `config.rateLimit` por IP), `POST /auth/login` (com `config.rateLimit` por IP + e-mail alvo, `hook: 'preHandler'` para enxergar o corpo), `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/change-password` (`preHandler: app.authenticate`), `GET /me` (`preHandler: app.authenticate`). Arquivo: `src/controllers/auth/auth.routes.ts` (depende de T061–T066)
- [x] T068 Criar o barrel `src/controllers/auth/index.ts` reexportando `authRoutes` e os 6 controllers. Arquivo: `src/controllers/auth/index.ts` (depende de T067)
- [x] T069 [P] Teste de integração de rotas via `buildApp` + `app.inject()` (TDD — escrito antes de T070, que faz a fiação e o torna verde; setup chama `ensureAuthIndexes` sobre o Db em memória) cobrindo os 19 cenários de aceitação da spec:
  - `signup`: `201` / `409 EMAIL_ALREADY_IN_USE` / `409 HANDLE_ALREADY_IN_USE` / `400` / **`429 TOO_MANY_REQUESTS` após exceder `authRateLimitMax` por IP**.
  - `login`: `200` / `401 INVALID_CREDENTIALS` (senha errada e e-mail inexistente com a **mesma** resposta) / **`429` após exceder o limite** / **dois e-mails distintos do mesmo IP contam em chaves separadas** (o 2º ainda responde `401`, não `429`).
  - **reset da janela (RF-038)**: com `authRateLimitWindowMs` curto na config de teste, após aguardar a janela o `login` volta a `401` (não fica `429` para sempre).
  - `refresh`: `200` + rotação / `401 REFRESH_TOKEN_REUSE_DETECTED` (elo antigo, sessão revogada) / `401 REFRESH_TOKEN_EXPIRED` (grava `inactivityExpiresAt` no passado) / `401 INVALID_REFRESH_TOKEN`.
  - `logout`: `204` + `204` idempotente; **o access token emitido antes do `logout` ainda responde `200` em `GET /v1/me` até expirar (aceito por design — o logout revoga o refresh, não o access)**.
  - `GET /me`: `200` / `401 UNAUTHENTICATED` (sem header e com esquema `Basic`) / `401 INVALID_ACCESS_TOKEN` (expirado/adulterado).
  - `change-password`: `204` (revoga as outras sessões, preserva a corrente) / `401 INVALID_CREDENTIALS` / `400`.
  Arquivo: `tests/integration/http/auth.routes.spec.ts` (depende de T068, T031)
- [x] T070 Atualizar `buildApp`: registrar `@fastify/rate-limit` (`global: false`, `errorResponseBuilder` devolvendo `{ error: { code: 'TOO_MANY_REQUESTS', message, statusCode: 429 } }`, `keyGenerator` — `signup` por IP, `login` por `IP + '|' + normalizeEmail(request.body.email)`); chamar `registerAuthentication(app)`; registrar `authRoutes` com `{ prefix: '/v1' }`. Arquivo: `src/app.ts` (depende de T060, T068, T004; faz T069 passar)

## Fase 7: Documentação e fechamento

- [x] T071 [P] Acrescentar ao `README.md` a seção **Auth**: os 6 endpoints (`POST /v1/auth/signup|login|refresh|logout|change-password`, `GET /v1/me`) com corpo e respostas de sucesso/erro, a tabela de códigos de erro novos (de `contracts/error-codes.md`), as 3 variáveis de ambiente novas e o passo `pnpm migrate:up`. Arquivo: `README.md`
- [x] T072 Teste de integração de não-vazamento de segredo em log (RF-042 / DoD item 4): com `buildApp` e um transport de `pino` capturando as linhas de log em memória (ou `logLevel: 'trace'` + coletor), exercer `signup` → `login` → `refresh` → `logout` → `change-password` e assertar que **nenhuma** linha de log contém o `accessToken`, o `refreshToken`, o `passwordHash` ou a senha em texto puro. Arquivo: `tests/integration/http/auth-logging.spec.ts` (depende de T070)
- [x] T073 Rodar `pnpm lint`, `pnpm test` (unit + integration), `pnpm test:coverage` e `pnpm build`; conferir `grep -rn "export default" src` vazio, `grep -rn "from 'mongodb'" src/services src/controllers src/auth src/schemas` vazio, e um `index.ts` em cada pasta de domínio nova (`src/auth`, `src/schemas/auth`, `src/repositories/users`, `src/repositories/auth-sessions`, `src/services/auth`, `src/controllers/auth`); sanar o que falhar. Sem arquivo fixo (ajustes pontuais onde o comando apontar). (depende de T001–T072)
- [~] T074 Executar `specs/002-authregistration/quickstart.md` de ponta a ponta (Docker + `pnpm migrate:up`) e marcar cada item da "Definição de Pronto" no `spec.md`. Arquivo: `specs/002-authregistration/spec.md` (depende de T073)

---

## Dependências

- **Fase 1 → todas**: `env.schema` (T004) alimenta `app.ts` e os services; as migrations (T005–T007) definem os índices que o helper de teste (T031) replica e que o `quickstart` aplica.
- **Fase 2 → Fases 3, 5, 6**: as 8 classes de erro (T008–T016) são usadas pelos primitivos de `src/auth`, pelos repositories, pelos services e pelos controllers; os 5 schemas (T017–T022) são usados pelos controllers.
- **Fase 3 → Fases 4, 5, 6**: `src/auth/*` (normalização, senha, token, refresh) é dependência direta dos services e do `authenticate.service`.
- **Fase 4 → Fase 5**: os repositories (interface + impl) são injetados nos services; `ensureAuthIndexes` (T031) é pré-requisito dos testes de integração que asseram a tradução de `code 11000` (T032, T045).
- **Fase 5 → Fase 6**: `authenticate.service` sustenta o decorator `app.authenticate`; os demais services sustentam os controllers; o `register-services`/`cradle` precisam do barrel `src/services/auth/index.ts`.
- **Fase 6 → Fase 7**: `app.ts` completo (T070) é pré-requisito do teste de log (T072), do `quickstart` e das checagens finais.
- Internas relevantes:
  - T003 (teste) escrito antes de T004; T004 faz T003 passar; T004 → T070
  - T008–T015 → T016
  - T017–T021 → T022
  - T012 → T026 → T027; T023/T025/T027/T029 → T030
  - T031 → T032, T036, T045, T069 (setup de índice)
  - T016 → T032, T036 (testes de repo); T033 → T034 → T035; T037 → T038 → T039
  - T034 + T038 → T041; T033 + T037 → T042
  - T027 + T034 → T043 (teste); T027 + T033 → T044 (faz T043 passar)
  - T025 + T034 + T031 → T045 (teste); T023 + T025 + T033 → T046 (faz T045 passar)
  - T023/T025/T027/T029 + T033/T037/T038 → T047/T048
  - T027 + T029 + T037/T038 → T049/T050; T029 + T037/T038 → T051/T052
  - T025 + T029 + T033/T034 + T037/T038 → T053/T054
  - T043–T054 → T055 → T056; T055 → T057 (sequencial com T042, mesmo arquivo `cradle.ts`)
  - T011 → T058 (teste) → T059 → T060
  - T061–T066 → T067 → T068
  - T060 + T068 + T004 → T070; T068 + T031 → T069 (escrito para falhar; T070 o faz passar)
  - T070 → T072; T001–T072 → T073 → T074

## Exemplo de execução em paralelo

```
# Fase 1 — após T001 (pnpm install), arquivos distintos:
T002 .env.example | T005 migration users | T006 migration auth_sessions | T007 migration refresh_tokens
# (T003 → T004 é um par sequencial: teste antes, schema depois)

# Fase 2 — as 8 classes de erro (arquivos distintos, sem dependência entre si):
T008 email-already-in-use-error.ts | T009 handle-already-in-use-error.ts
T010 invalid-credentials-error.ts  | T011 unauthenticated-error.ts
T012 invalid-access-token-error.ts | T013 invalid-refresh-token-error.ts
T014 refresh-token-expired-error.ts| T015 refresh-token-reuse-detected-error.ts

# Fase 2 — os 5 schemas + specs (pares independentes):
T017 signup.schema | T018 login.schema | T019 refresh.schema | T020 logout.schema | T021 change-password.schema

# Fase 3 — primitivos independentes (cada par teste→impl é sequencial internamente):
T023 normalize | T024→T025 password | T026→T027 access-token | T028→T029 refresh-token

# Fase 4 — os testes de integração dos dois repositories (arquivos distintos; ambos após T031):
T032 mongo-user.repository.spec.ts | T036 mongo-auth-session.repository.spec.ts

# Fase 5 — os testes de integração dos 6 services (arquivos distintos):
T043 authenticate | T045 signup | T047 login | T049 refresh | T051 logout | T053 change-password

# Fase 6 — os 6 controllers (arquivos distintos):
T061 signup.controller | T062 login.controller | T063 refresh.controller
T064 logout.controller | T065 change-password.controller | T066 get-me.controller

# Fase 7 — T071 (README) corre em paralelo ao restante; T072/T073/T074 são sequenciais e finais.
```

## Notas

- Ordem TDD: T003→T004, T024→T025, T026→T027, T028→T029, T032→T034, T036→T038, T043→T044, T045→T046, T047→T048, T049→T050, T051→T052, T053→T054, T058→T059, T069→T070 (o teste é escrito para falhar antes da implementação que o satisfaz).
- `src/auth/` é pasta transversal (utilidades sem estado, sem Fastify, sem `mongodb`), como `src/http/` e `src/lifecycle/` da 001 — ver `plan.md`.
- `GET /me` fica no domínio `auth` (`src/controllers/auth/get-me.controller.ts`) para não colidir com o futuro `src/controllers/users/` da feature de Perfil.
- `TOO_MANY_REQUESTS` (429) não tem classe de erro — é montado pelo `errorResponseBuilder` do `@fastify/rate-limit` no envelope padrão (ver `contracts/error-codes.md`).
- Divergência D9 (caixa do `@handle`): o schema aceita `[A-Za-z0-9_]` e o service normaliza para minúsculas; o cenário de aceitação 3 é a referência.
- Índices nos testes: as migrations não rodam sob `mongodb-memory-server`; os testes que dependem de índice único chamam `ensureAuthIndexes` (T031). O `quickstart` (T074) valida o caminho real com `pnpm migrate:up`.
- "Refresh token de conta apagada → `INVALID_REFRESH_TOKEN`" é marcado na spec como cenário futuro (não há endpoint de exclusão de conta nesta feature); T049 não o cobre por ora.
- `mongodb` só pode ser importado em `src/repositories/**` e `src/db/**`; `process.env` só em `src/config/**` e `src/server.ts` (ambos cercados pela regra de ESLint da 001).
- `ACCESS_TOKEN_TTL_SECONDS` (900) e `REFRESH_INACTIVITY_DAYS` (30) são constantes de código, não env — os testes de expiração forjam o instante direto no módulo/no banco.
- Commitar após cada tarefa concluída.
