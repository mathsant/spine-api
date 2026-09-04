# better-books

A private social network for readers, delivered as an HTTP API (this repo is the
backend only; a web app will consume it later). Users log what they read, rate it
(1–5 stars) and review it, and follow other readers — profiles are private by
default and follows require approval, so only approved followers see posts,
reviews and progress.

Backend monolith in layers: **controller → service → repository**.
Fastify + native `mongodb` driver + Awilix DI, TypeScript on Node.js 24.

See `.specify/memory/product.md` for what the product is (domain glossary, locked
product decisions, MVP scope, roadmap), `.specify/memory/architecture.md` for
structure and conventions, and `.specify/memory/constitution.md` for the
non-negotiable principles.

## Requirements

- Node.js **24** (`nvm use` reads `.nvmrc`)
- Docker + Docker Compose (for a local MongoDB)

## Setup

```bash
nvm use
pnpm install
cp .env.example .env
```

Environment variables (validated on boot — a missing/invalid one aborts startup):

| Variable        | Required | Default       | Notes                                      |
| --------------- | -------- | ------------- | ------------------------------------------ |
| `NODE_ENV`      | no       | `development` | `development` \| `test` \| `production`    |
| `PORT`          | no       | `3000`        | HTTP port                                  |
| `HOST`          | no       | `0.0.0.0`     | bind interface                             |
| `MONGO_URI`     | **yes**  | —             | `mongodb://…` or `mongodb+srv://…`         |
| `MONGO_DB_NAME` | **yes**  | —             | database name                              |
| `LOG_LEVEL`     | no       | `info`        | pino level                                 |
| `ACCESS_TOKEN_SECRET`        | **yes** | —        | HS256 signing secret, ≥ 32 chars           |
| `AUTH_RATE_LIMIT_MAX`        | no      | `10`     | max `login`/`signup` requests per window   |
| `AUTH_RATE_LIMIT_WINDOW_MS`  | no      | `900000` | rate-limit window in ms (15 min)           |
| `MONGO_PORT`    | no       | `27017`       | `docker-compose` only, not read by the app |

## Run

```bash
docker compose up -d          # local MongoDB (healthcheck: docker compose ps)
pnpm dev                    # tsx watch, structured logs with reqId
```

Check it:

```bash
curl -i localhost:3000/health
# 200 {"status":"ok","db":"up","uptime":<n>}

docker compose stop mongo
curl -i localhost:3000/health
# 503 {"status":"degraded","db":"down","uptime":<n>}   (process stays up)
docker compose start mongo
```

`GET /health` echoes an incoming `x-request-id` header back on the response and
into the request logs.

Production build:

```bash
pnpm build && pnpm start
```

`SIGTERM`/`SIGINT` trigger a graceful shutdown: stop accepting requests, drain
in-flight ones, close the MongoDB connection, exit 0.

## Auth

All endpoints are under `/v1`. Tokens travel in the JSON body (no cookies): the
client stores the pair from `login`/`refresh` and sends
`Authorization: Bearer <accessToken>` on protected routes. The access token lasts
15 minutes; a refresh session expires after 30 days of inactivity and its token
rotates on every use (replaying a rotated token revokes the whole session). Run
`pnpm migrate:up` once to create the `users`, `auth_sessions` and
`refresh_tokens` collections.

| Method & path                 | Body                                                   | Success | Errors |
| ----------------------------- | ------------------------------------------------------ | ------- | ------ |
| `POST /v1/auth/signup`        | `email`, `password` (8–72), `handle` (3–30 `[A-Za-z0-9_]`), `displayName` (1–50) | `201` public user | `400` `VALIDATION_ERROR`, `409` `EMAIL_ALREADY_IN_USE` / `HANDLE_ALREADY_IN_USE`, `429` `TOO_MANY_REQUESTS` |
| `POST /v1/auth/login`         | `email`, `password`                                    | `200` `{ accessToken, refreshToken, tokenType, expiresIn }` | `400`, `401` `INVALID_CREDENTIALS` (same body for wrong password and unknown email), `429` |
| `POST /v1/auth/refresh`       | `refreshToken`                                         | `200` new token pair | `400`, `401` `INVALID_REFRESH_TOKEN` / `REFRESH_TOKEN_EXPIRED` / `REFRESH_TOKEN_REUSE_DETECTED` |
| `POST /v1/auth/logout`        | `refreshToken`                                         | `204` (idempotent) | `400` |
| `POST /v1/auth/change-password` | `currentPassword`, `newPassword` (8–72), `refreshToken?` — **Bearer** | `204`; revokes the other sessions | `400`, `401` `UNAUTHENTICATED` / `INVALID_ACCESS_TOKEN` / `INVALID_CREDENTIALS` |
| `GET /v1/me`                  | — **Bearer**                                           | `200` `{ id, email, handle, displayName, createdAt }` | `401` `UNAUTHENTICATED` / `INVALID_ACCESS_TOKEN` |

Every error uses the shared envelope `{ "error": { "code", "message", "statusCode", "details?" } }`.

## Tests

```bash
pnpm test:unit          # pure functions, no database
pnpm test:integration   # business rules against mongodb-memory-server
pnpm test                # both
pnpm test:coverage      # both + coverage; fails if src/services/** < 70%
```

## Lint & format

```bash
pnpm lint               # eslint — also enforces: no default exports,
                           # no `mongodb` import outside repositories/db,
                           # no `process.env` outside src/config and src/server.ts
pnpm format             # prettier --write
```

## Migrations

Infrastructure only — no data migrations yet.

```bash
pnpm migrate:up
pnpm migrate:down
pnpm migrate:create -- <name>
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request:
`pnpm install → typecheck → lint → test:unit → test:integration → build → coverage gate`.
`typecheck` (`tsc -p tsconfig.eslint.json --noEmit`) covers `src` **and** `tests` —
`build` only compiles `src`.
Any failing stage fails the pipeline.
