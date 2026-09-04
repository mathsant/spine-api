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
- A MongoDB Atlas cluster (connection string via `MONGO_URI`) — or, optionally,
  Docker + Docker Compose to run MongoDB locally instead (legacy path)

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
| `MONGO_URI`     | **yes**  | —             | Atlas `mongodb+srv://…` (or local `mongodb://…`) |
| `MONGO_DB_NAME` | **yes**  | —             | database name                              |
| `LOG_LEVEL`     | no       | `info`        | pino level                                 |
| `ACCESS_TOKEN_SECRET`        | **yes** | —        | HS256 signing secret, ≥ 32 chars           |
| `AUTH_RATE_LIMIT_MAX`        | no      | `10`     | max `login`/`signup` requests per window   |
| `AUTH_RATE_LIMIT_WINDOW_MS`  | no      | `900000` | rate-limit window in ms (15 min)           |
| `OPEN_LIBRARY_BASE_URL`      | no      | `https://openlibrary.org` | book search/lookup base URL   |
| `OPEN_LIBRARY_TIMEOUT_MS`    | no      | `5000`   | Open Library request timeout in ms         |
| `MONGO_PORT`    | no       | `27017`       | `docker-compose` only (legacy local MongoDB), not read by the app |

## Run

```bash
pnpm dev                    # tsx watch, structured logs with reqId
```

`MONGO_URI` in `.env` points at your Atlas cluster, so there's no local
container to start. (Legacy path: `docker compose up -d` still works if you'd
rather point `MONGO_URI` at a local `mongodb://localhost:27017` instead.)

Check it:

```bash
curl -i localhost:3000/health
# 200 {"status":"ok","db":"up","uptime":<n>}
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
| `GET /v1/me`                  | — **Bearer**                                           | `200` `{ id, email, handle, displayName, bio, createdAt }` | `401` `UNAUTHENTICATED` / `INVALID_ACCESS_TOKEN` |

Every error uses the shared envelope `{ "error": { "code", "message", "statusCode", "details?" } }`.

## Books

All endpoints are under `/v1` and require `Authorization: Bearer <accessToken>` — every
route here operates only on the caller's own data (viewing another user's shelf/history
depends on the Follow feature, not built yet). A book is identified by its Open Library
work key (`olid`, e.g. `OL12345W`) and is cached locally (`books` collection) the first
time it's looked up or acted on — search results themselves are not cached, only a
`GET /v1/books/:olid` or a status change is. Run `pnpm migrate:up` once to create the
`books`, `shelf_memberships` and `reading_sessions` collections.

A reading session's `status` is `reading` or `finished`; a user has at most one open
(`reading`) session per book at a time — calling `start-reading` again reuses it (`200`)
instead of creating a duplicate (`201`). Rereading a finished book creates a brand new,
independent session. Progress is a single `currentPage` on the session (no history of
points in time, and no validation against the book's total page count). Editing or
deleting a session — or updating its progress or finishing it — that belongs to another
user returns `404 READING_SESSION_NOT_FOUND`, the same as a nonexistent one.

| Method & path                                | Body / query                              | Success | Errors |
| --------------------------------------------- | ------------------------------------------ | ------- | ------ |
| `GET /v1/books/search`                        | `q`, `page?`, `limit?`                     | `200` `{ items, page, limit, totalItems }` | `400`, `401`, `503` `OPEN_LIBRARY_UNAVAILABLE` |
| `GET /v1/books/:olid`                         | —                                           | `200` book + `aggregates` (cache-on-read) | `401`, `404` `BOOK_NOT_FOUND`, `503` |
| `PUT /v1/books/:olid/want-to-read`            | —                                           | `204` (idempotent) | `401`, `404`, `503` |
| `DELETE /v1/books/:olid/want-to-read`         | —                                           | `204` (idempotent, never calls Open Library) | `401` |
| `POST /v1/books/:olid/start-reading`          | —                                           | `201` new session / `200` reused open one | `401`, `404`, `503` |
| `POST /v1/books/:olid/mark-finished`          | `startedAt?`, `finishedAt`                 | `201` new `finished` session | `400`, `401`, `404`, `503` |
| `GET /v1/me/want-to-read`                     | `cursor?`, `limit?`                        | `200` `{ items, nextCursor }` | `401` |
| `POST /v1/reading-sessions/:sessionId/progress` | `currentPage`                             | `200` updated session | `400`, `401`, `404`, `409` `INVALID_READING_SESSION_STATE` |
| `POST /v1/reading-sessions/:sessionId/finish`   | `finishedAt?` (defaults to now)           | `200` (idempotent) | `400`, `401`, `404` |
| `PATCH /v1/reading-sessions/:sessionId`         | `startedAt?`, `finishedAt?`, `currentPage?` (≥1) | `200` updated session | `400`, `401`, `404`, `422` `INVALID_READING_SESSION_DATES` |
| `DELETE /v1/reading-sessions/:sessionId`        | —                                           | `204` | `401`, `404` |
| `GET /v1/me/reading-sessions`                   | `bookId?`, `cursor?`, `limit?`             | `200` `{ items, nextCursor }` | `401` |

## Profile & Follow

All endpoints are under `/v1` and require `Authorization: Bearer <accessToken>`. `GET /v1/me`
(above) now also returns `bio`; editing the profile is a separate endpoint below. `handle` is
immutable — no endpoint in this feature accepts it. User search is a MongoDB text index over
`displayName`/`handle` (whole-word matches, not substrings), paginated **by page** like book
search — not by cursor, since relevance ranking has no stable cursor key. The follow graph is
two collections, `follow_requests` (pending only — a request is deleted, not marked, once
resolved) and `follows` (approved only); at most one pending request and one approved relation
per ordered pair. Approving a request never creates the reverse relation. Acting on a pending
request or an approved relation that isn't yours (or doesn't exist) returns `404` — never
`403`, so a client can't tell the two cases apart. The followers/following/pending-requests
lists only ever show the caller's own data; there is no endpoint to view another user's. Run
`pnpm migrate:up` once to create the `follow_requests`/`follows` collections and the text index
on `users`.

| Method & path                                | Body / query                     | Success | Errors |
| --------------------------------------------- | ---------------------------------- | ------- | ------ |
| `PATCH /v1/me`                                | `displayName?` (1–50), `bio?` (≤280, nullable) — at least one | `200` `{ id, handle, displayName, bio }` | `400`, `401` |
| `GET /v1/users/search`                        | `q` (≥2), `page?`, `limit?`        | `200` `{ items: [{ id, handle, displayName, avatarUrl }], page, limit, totalItems }` | `400`, `401` |
| `POST /v1/users/:userId/follow-request`       | —                                   | `201` new pending request / `200` already pending | `401`, `404`, `409` `ALREADY_FOLLOWING`, `422` `CANNOT_FOLLOW_SELF` |
| `DELETE /v1/users/:userId/follow-request`     | —                                   | `204` cancels my pending request | `401`, `404` `FOLLOW_REQUEST_NOT_FOUND` |
| `POST /v1/users/:userId/follow-request/approve` | —                                 | `204` creates `:userId` → me, no reciprocity | `401`, `404` |
| `POST /v1/users/:userId/follow-request/reject`  | —                                 | `204` deletes the request | `401`, `404` |
| `DELETE /v1/users/:userId/follow`             | —                                   | `204` I stop following `:userId` | `401`, `404` `FOLLOW_NOT_FOUND` |
| `DELETE /v1/users/:userId/follower`           | —                                   | `204` removes `:userId` as my follower | `401`, `404` |
| `GET /v1/me/follow-requests`                  | `direction?` (`incoming`\|`outgoing`, default `incoming`), `cursor?`, `limit?` | `200` `{ items, nextCursor }` | `400`, `401` |
| `GET /v1/me/followers`                        | `cursor?`, `limit?`                | `200` `{ items, nextCursor }` | `400`, `401` |
| `GET /v1/me/following`                        | `cursor?`, `limit?`                | `200` `{ items, nextCursor }` | `400`, `401` |

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
