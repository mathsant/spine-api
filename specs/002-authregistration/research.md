# Fase 0 — Pesquisa: Autenticação e Cadastro

Feature: `002-authregistration` · Data: 2026-09-03

A stack já está fixada em `.specify/memory/architecture.md` (Fastify + Awilix + driver
`mongodb` + zod + Vitest + migrate-mongo). Esta pesquisa resolve **como** implementar auth
dentro dessa stack e registra a única dependência nova. Nenhum `[NEEDS CLARIFICATION]` restou
do Contexto Técnico — comportamento fixado pela spec + esclarecimentos de 2026-09-03.

---

## D1 — Hashing de senha: `scrypt` do `node:crypto`

**Decisão**: derivar a senha com `crypto.scrypt` (N=2^15, r=8, p=1), sal aleatório de 16
bytes por usuário, saída de 64 bytes. Persistir como string única
`scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>`. Verificação com `crypto.timingSafeEqual`. Um
`verifyPassword` sempre roda o KDF mesmo quando o usuário não existe (login), para não
distinguir os casos por tempo (RF-014).

**Justificativa**: `scrypt` é memory-hard, recomendado pela OWASP, e vem embutido no Node —
**zero dependência nova** (a constituição exige justificar cada dependência nova). O formato
com parâmetros embutidos permite migrar o custo depois sem quebrar hashes existentes.

**Alternativas**: `argon2` (Argon2id é o padrão-ouro atual, mas é dependência nativa com
build) e `bcrypt` (dependência nativa, teto de 72 bytes na senha) — ambas rejeitadas por
adicionar dependência com binário nativo quando `scrypt` já cobre o requisito. Teto de 72
caracteres na senha (RF-003) foi mantido mesmo com `scrypt` (não tem o limite do bcrypt) só
para padronizar e limitar custo de DoS por senha gigante.

---

## D2 — Access token: JWT HS256 com `node:crypto` (módulo interno)

**Decisão**: um módulo interno `src/auth/access-token.ts` assina/verifica um JWT compacto
`HS256` usando `crypto.createHmac` + `crypto.timingSafeEqual`, sem biblioteca. Payload:
`{ sub: <userId>, iat, exp }`, `exp = iat + 900` (15 min — RF-017, constante
`ACCESS_TOKEN_TTL_SECONDS`). Segredo vem de `ACCESS_TOKEN_SECRET` (env, ≥ 32 chars).
`verifyAccessToken(token, secret, now)` valida `alg`, assinatura (comparação de tempo
constante), presença de `sub` e `exp > now`; retorna `{ userId }` ou lança.

**Justificativa**: é uma função pura, testável em unidade sem subir Fastify. A arquitetura
proíbe um **service** importar tipos do Fastify (`architecture.md`), então usar
`app.jwt.sign()` do `@fastify/jwt` dentro dos services de login/refresh violaria a regra. Um
JWT HS256 é ~50 linhas de `node:crypto` e evita dependência. Nenhum uso de claims exóticos
que justifique uma lib.

**Alternativas**: `@fastify/jwt` (acopla Fastify aos services — rejeitado), `jose` (ótima
lib, mas dependência nova para HS256 trivial — rejeitado), `jsonwebtoken` (manutenção morna,
histórico de CVEs de `alg:none` — rejeitado). O módulo interno **força `alg: "HS256"`** e
recusa qualquer outro, incluindo `none`.

---

## D3 — Refresh token: opaco, aleatório, guardado como hash

**Decisão**: refresh token = `base64url(32 bytes aleatórios)` (256 bits de entropia),
opaco para o cliente. No banco guarda-se apenas `sha256(token)` em hex
(`src/auth/refresh-token.ts`: `generateRefreshToken()` → `{ token, tokenHash }`,
`hashRefreshToken(token)`). Como a entropia é alta, `sha256` basta — não precisa de KDF lento.

**Justificativa**: token opaco (RF-022) não carrega significado e é revogável no servidor
(P8). Guardar só o hash impede uso direto de um dump do banco. `sha256` é adequado para
segredo de alta entropia (diferente de senha).

**Alternativas**: JWT como refresh (não revogável sem lista de bloqueio — contraria P8);
guardar o token em claro (rejeitado); `scrypt` no refresh (custo desnecessário dada a
entropia).

---

## D4 — Modelo de sessão e cadeia de rotação

**Decisão**: duas coleções.

- `auth_sessions` — uma por login. `{ _id, userId, status: 'active'|'revoked', createdAt,
  lastUsedAt, inactivityExpiresAt, revokedAt?, revokedReason?: 'logout'|'reuse_detected'|
  'password_changed'|'expired' }`.
- `refresh_tokens` — um elo por rotação. `{ _id, sessionId, userId, tokenHash (único),
  createdAt, rotatedAt: Date|null, expiresAt }`. `rotatedAt = null` ⇒ é o token corrente da
  sessão.

Fluxo de `POST /v1/auth/refresh` com token cru `T`:

1. `hash = sha256(T)`; busca em `refresh_tokens` por `tokenHash`. Não achou → `401
   INVALID_REFRESH_TOKEN`.
2. Carrega a `auth_sessions` do elo. `status = 'revoked'` → `401 INVALID_REFRESH_TOKEN`.
3. `rotatedAt != null` (elo já usado) → **reuso**: `revokeSession(sessionId,
   'reuse_detected')` e `401 REFRESH_TOKEN_REUSE_DETECTED` (RF-026).
4. `session.inactivityExpiresAt <= now` → `revokeSession(sessionId, 'expired')` e `401
   REFRESH_TOKEN_EXPIRED` (RF-025).
5. Rotaciona **atomicamente**: `updateOne({ _id: elo._id, rotatedAt: null }, { $set: {
   rotatedAt: now } })`. Se `modifiedCount === 0` (corrida — outro refresh já rotacionou),
   trata como reuso (passo 3). Se `=== 1`: insere novo `refresh_tokens` (novo `T'`) na mesma
   `sessionId`; `updateOne` na sessão `{ $set: { lastUsedAt: now, inactivityExpiresAt: now +
   30d } }` (RF-024); emite novo access token; devolve `{ accessToken, refreshToken: T',
   tokenType: 'Bearer', expiresIn: 900 }`.

**Justificativa**: coleção separada de tokens deixa a detecção de reuso (RF-026) e a corrida
(caso de borda da spec) resolvíveis com um `updateOne` condicional, sem transação. Um array
embutido na sessão cresceria a cada rotação e complicaria o filtro condicional. `userId`
desnormalizado no `refresh_tokens` evita um lookup em `logout`.

**Alternativas**: transações multi-documento (exigiria replica set no compose — fora de
escopo da 001/002); TTL index em `inactivityExpiresAt` para expirar a sessão sozinha —
rejeitado porque a limpeza do TTL é eventual (~60 s) e apagaria a sessão antes do check
explícito, transformando `REFRESH_TOKEN_EXPIRED` em `INVALID_REFRESH_TOKEN`. Limpeza de
sessões velhas fica como item de manutenção no roadmap.

---

## D5 — Autenticação na borda: decorator + service `authenticate`

**Decisão**: `src/http/authenticate.ts` registra um `preHandler` `app.authenticate`:

1. Lê `Authorization`. Ausente, ou esquema ≠ `Bearer`, ou `Bearer` sem valor → lança
   `UnauthenticatedError` (`401 UNAUTHENTICATED`, RF-019).
2. Resolve `authenticateService` do `request.diScope`, passa o token cru.
3. O service (`src/services/auth/authenticate.service.ts`) verifica o JWT
   (`verifyAccessToken`) e **carrega o usuário** por `sub` no `userRepository`. Assinatura/
   exp inválida, ou conta inexistente → `InvalidAccessTokenError` (`401 INVALID_ACCESS_TOKEN`,
   RF-018).
4. Decora `request.currentUser = { id, email, handle, displayName, createdAt }` (RF-020).

`GET /v1/me` fica trivial: o controller devolve `request.currentUser` (RF-032). Nenhum
service extra.

**Justificativa**: `authenticate` toca o banco (checar existência da conta — RF-018), logo é
**regra de negócio** e entra na cobertura de integração com `mongodb-memory-server` (P1). O
`preHandler` só faz o parsing do header (função de borda, unitária). Deixar a identidade em
`request.currentUser` dá a RF-020 "de graça" para as próximas features.

**Alternativas**: verificação puramente stateless (não carregar o usuário) — mais rápida,
mas não cumpre RF-018; cache de usuários em memória — otimização prematura para tokens de 15
min.

---

## D6 — Rate limiting: `@fastify/rate-limit` (dependência nova, justificada)

**Decisão**: adicionar **`@fastify/rate-limit` ^10** (única dependência nova desta feature).
Registro global com `global: false`; ativado por rota só em `POST /v1/auth/login` e `POST
/v1/auth/signup` via `config.rateLimit`. Store em memória (padrão). `hook: 'preHandler'` na
rota de login para que o `keyGenerator` enxergue `request.body.email`.

- `signup`: chave = IP de origem.
- `login`: chave = `IP + '|' + normalizeEmail(body.email)` (RF-037 — por IP **e** por e-mail
  alvo).
- `max` = `AUTH_RATE_LIMIT_MAX` (env, default **10**); `timeWindow` = `AUTH_RATE_LIMIT_WINDOW_MS`
  (env, default **900000** = 15 min). Janela desliza e expira sozinha (RF-038).
- `errorResponseBuilder` devolve o envelope padrão do projeto: `{ error: { code:
  'TOO_MANY_REQUESTS', message, statusCode: 429 } }`.

**Justificativa**: é o plugin oficial do ecossistema Fastify, mantido pela org Fastify;
implementar sliding window + varredura correta à mão é fonte clássica de bug. Store em
memória é aceitável para o MVP single-instance; o plugin aceita store Redis depois sem mudar
as rotas. Registrado em `research.md` conforme a constituição ("nenhuma dependência nova sem
justificativa").

**Alternativas**: `@fastify/rate-limit` com Redis agora (infra a mais, sem necessidade);
implementação caseira com `Map` + timestamps (rejeitada — reinventa o plugin e erra na
varredura); rate limit no proxy/edge (não existe ainda no projeto).

---

## D7 — Novas variáveis de ambiente

**Decisão**: estender `src/config/env.schema.ts` (o `AppConfig` continua sendo a única porta
para `process.env` — RF-012 da 001) com:

| Var | Obrigatória | Default | Regra |
|---|---|---|---|
| `ACCESS_TOKEN_SECRET` | **sim** | — | string, ≥ 32 chars (segredo HS256) |
| `AUTH_RATE_LIMIT_MAX` | não | `10` | int ≥ 1 (coerção de string) |
| `AUTH_RATE_LIMIT_WINDOW_MS` | não | `900000` | int ≥ 1000 (coerção de string) |

TTL do access token (900 s) e janela de inatividade do refresh (30 dias) ficam como
**constantes de código** (`ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_INACTIVITY_DAYS`) porque a
spec os fixou (RF-017/RF-025); os testes de expiração forjam o instante direto no módulo/no
banco em vez de depender de env.

**Justificativa**: mantém o fail-fast da 001 (segredo ausente → app não sobe) e não
multiplica knobs. `.env.example` ganha as três linhas.

**Alternativas**: TTLs em env (rejeitado — spec fixou os valores; menos superfície de
configuração incorreta); segredo com default de dev (rejeitado — esconde erro de deploy).

---

## D8 — Migrations das coleções de auth (`migrate-mongo`)

**Decisão**: três migrations reversíveis em `migrations/` (P4 — nada de `createIndex` no
bootstrap):

1. `create-users-collection` — `createCollection('users')`; índice **único** em `email`;
   índice **único** em `handle`. `down`: `drop`.
2. `create-auth-sessions-collection` — `createCollection('auth_sessions')`; índice em
   `userId`. `down`: `drop`.
3. `create-refresh-tokens-collection` — `createCollection('refresh_tokens')`; índice
   **único** em `tokenHash`; índice em `sessionId`. `down`: `drop`.

`email` e `handle` são gravados **já normalizados** (trim + minúsculas), então um índice
único simples resolve a unicidade case-insensitive — sem `collation`.

**Justificativa**: uma migration por coleção deixa o `down` óbvio. Normalizar na aplicação (e
não via `collation` no índice) é mais rápido na consulta e alinhado ao fato de a spec já
exigir normalização de e-mail/handle.

**Alternativas**: índice único com `collation: { locale: 'en', strength: 2 }` sem normalizar
na app (rejeitado — some com a forma canônica exibível e complica buscas futuras); uma única
migration "create auth collections" (rejeitada — `down` menos granular).

---

## D9 — Divergência spec ↔ design: caixa do `@handle` na entrada

**Contexto**: a spec **RF-004** diz "apenas `[a-z0-9_]`", mas o **cenário de aceitação 3**
manda `POST /signup` com `handle: "Alice"` (maiúscula) resultar em `409 HANDLE_ALREADY_IN_USE`
— o que só acontece se a entrada com maiúscula **passar** pela validação e for normalizada,
em vez de tomar `400`.

**Decisão** (o cenário de aceitação vence): o schema de entrada aceita `^[A-Za-z0-9_]{3,30}$`
e o service **normaliza para minúsculas** antes de checar unicidade e persistir. O `handle`
canônico (e imutável — P11) é a forma minúscula. `"Alice"` no cadastro cria/colide com
`alice`.

**Impacto**: nenhum princípio da constituição é afetado. Anotado aqui e no `plan.md`
("Rastreio de Complexidade" → nota de divergência). Se o produto quiser preservar a caixa
digitada para exibição, isso é um campo `displayHandle` separado numa feature futura — fora
do escopo desta.

---

## Telas de design

N/A — não existe pasta `design/` e a feature não tem UI (API HTTP).

## Impacto na constituição

Nenhuma decisão de design viola um princípio. Uma dependência nova (`@fastify/rate-limit`,
D6) — justificada aqui, conforme exigido. Ver "Verificação da Constituição" no `plan.md`
(rodadas inicial e pós-Fase 1, ambas aprovadas).
