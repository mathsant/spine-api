# better-books

Backend monolith in layers: **controller → service → repository**.
Fastify + native `mongodb` driver + Awilix DI, TypeScript on Node.js 24.

See `.specify/memory/architecture.md` for structure and conventions and
`.specify/memory/constitution.md` for the non-negotiable principles.

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
`pnpm install → lint → test:unit → test:integration → build → coverage gate`.
Any failing stage fails the pipeline.
