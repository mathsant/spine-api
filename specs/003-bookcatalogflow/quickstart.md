# Quickstart — validação manual da feature 003-bookcatalogflow

Passos para confirmar a Definição de Pronto. Rodar da raiz do repositório. Requer o setup das
features 001/002 (Node 24, Docker, `ACCESS_TOKEN_SECRET`) e uma conta já autenticada.

## 1. Preparar

```bash
nvm use
pnpm install
cp .env.example .env   # OPEN_LIBRARY_BASE_URL/OPEN_LIBRARY_TIMEOUT_MS já vêm com default
docker compose up -d
pnpm migrate:up        # cria books, shelf_memberships, reading_sessions + índices
pnpm build
pnpm dev
```

```bash
# conta + login (feature 002)
curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"reader@example.com","password":"correct horse","handle":"reader","displayName":"Reader"}'
TOKENS=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"reader@example.com","password":"correct horse"}')
ACCESS=$(echo "$TOKENS" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
AUTH="authorization: Bearer $ACCESS"
```

## 2. Busca (RF-001, RF-002)

```bash
curl -s "localhost:3000/v1/books/search?q=duna" -H "$AUTH" | head -c 500
# 200 { "items": [{ "olid": "OL...W", "title": "Duna", "authors": [...], ... }], "page": 1, ... }

curl -s "localhost:3000/v1/books/search" -H "$AUTH"          # 400 VALIDATION_ERROR (q ausente)
curl -s "localhost:3000/v1/books/search?q=" -H "$AUTH"       # 400 VALIDATION_ERROR
curl -s "localhost:3000/v1/books/search?q=duna" # sem $AUTH  # 401 UNAUTHENTICATED
```

Pegue um `olid` da resposta acima para os passos seguintes:

```bash
OLID=OL... # substitua pelo olid retornado
```

## 3. Detalhe + cache-on-read (RF-003, RF-004)

```bash
curl -s "localhost:3000/v1/books/$OLID" -H "$AUTH"
# 200 — primeira chamada grava no cache local; aggregates zerados (averageRating: null, reviewCount: 0)

curl -s "localhost:3000/v1/books/nao-existe-no-open-library" -H "$AUTH"
# 404 BOOK_NOT_FOUND
```

## 4. want_to_read (RF-005, RF-006, RF-007, RF-010)

```bash
curl -i -sX PUT "localhost:3000/v1/books/$OLID/want-to-read" -H "$AUTH"     # 204
curl -i -sX PUT "localhost:3000/v1/books/$OLID/want-to-read" -H "$AUTH"     # 204 de novo (idempotente)
curl -s "localhost:3000/v1/me/want-to-read" -H "$AUTH"                      # 200 { "items": [{ "olid": "OL...W", ... }], "nextCursor": null }

curl -i -sX DELETE "localhost:3000/v1/books/$OLID/want-to-read" -H "$AUTH"  # 204
curl -i -sX DELETE "localhost:3000/v1/books/$OLID/want-to-read" -H "$AUTH"  # 204 de novo (idempotente)
curl -s "localhost:3000/v1/me/want-to-read" -H "$AUTH"                      # 200 { "items": [], "nextCursor": null }
```

## 5. Reading session — iniciar, progresso, finalizar (RF-008..RF-013, RF-015)

```bash
curl -i -sX PUT "localhost:3000/v1/books/$OLID/want-to-read" -H "$AUTH"     # 204 (marca de novo p/ testar a remoção automática)

SESSION=$(curl -sX POST "localhost:3000/v1/books/$OLID/start-reading" -H "$AUTH")
echo "$SESSION"   # 201 { "id": "...", "status": "reading", "startedAt": "...", ... }
SESSION_ID=$(echo "$SESSION" | sed -E 's/.*"id":"([^"]+)".*/\1/')

curl -s "localhost:3000/v1/me/want-to-read" -H "$AUTH"                      # 200 { "items": [] } — removido automaticamente (RF-010)

# reaproveita a session aberta em vez de criar outra (RF-009)
curl -i -sX POST "localhost:3000/v1/books/$OLID/start-reading" -H "$AUTH"   # 200 (não 201), mesmo id

curl -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/progress" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"currentPage": 120}'
# 200 { ..., "currentPage": 120 }

curl -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/finish" -H "$AUTH"
# 200 { "status": "finished", "finishedAt": "...", ... }

curl -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/progress" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"currentPage": 200}'
# 409 INVALID_READING_SESSION_STATE (session já finished)
```

## 6. Marcar como lido direto + releitura (RF-014, RF-016)

```bash
curl -sX POST "localhost:3000/v1/books/$OLID/mark-finished" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"finishedAt": "2025-01-10T00:00:00.000Z"}'
# 201 { "status": "finished", "startedAt": null, "finishedAt": "2025-01-10T00:00:00.000Z", ... }
# nova session, independente da criada no passo 5

curl -s "localhost:3000/v1/me/reading-sessions?bookId=<bookId>" -H "$AUTH"
# 200 — 2 sessions finished do mesmo livro (a do passo 5 + esta)
```

## 7. Editar / apagar session (RF-017, RF-018)

```bash
curl -sX PATCH "localhost:3000/v1/reading-sessions/$SESSION_ID" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"currentPage": 150}'
# 200 { ..., "currentPage": 150 }

curl -s "localhost:3000/v1/reading-sessions/$SESSION_ID" -H "$AUTH" # (não existe GET individual — consultar via /me/reading-sessions)

curl -sX PATCH "localhost:3000/v1/reading-sessions/$SESSION_ID" -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{"startedAt": "2026-01-01T00:00:00.000Z", "finishedAt": "2025-01-01T00:00:00.000Z"}'
# 422 INVALID_READING_SESSION_DATES (finishedAt < startedAt)

curl -i -sX DELETE "localhost:3000/v1/reading-sessions/$SESSION_ID" -H "$AUTH"   # 204
curl -sX PATCH "localhost:3000/v1/reading-sessions/$SESSION_ID" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"currentPage": 1}'
# 404 READING_SESSION_NOT_FOUND
```

## 8. Histórico paginado (RF-019)

```bash
curl -s "localhost:3000/v1/me/reading-sessions?limit=1" -H "$AUTH"
# 200 { "items": [...1 item...], "nextCursor": "<cursor opaco>" }
curl -s "localhost:3000/v1/me/reading-sessions?limit=1&cursor=<cursor>" -H "$AUTH"
# 200 — próxima página
```

## 9. Falha do Open Library (RF-002) — simulada

```bash
OPEN_LIBRARY_BASE_URL=http://localhost:1 OPEN_LIBRARY_TIMEOUT_MS=200 pnpm dev &
curl -s "localhost:3000/v1/books/search?q=duna" -H "$AUTH"
# 503 OPEN_LIBRARY_UNAVAILABLE
```

## 10. Testes, cobertura, lint

```bash
pnpm test:unit          # pagination cursor, schemas zod
pnpm test:integration   # services de books/reading-sessions com mongodb-memory-server +
                        # FakeOpenLibraryClient — caminho feliz + >=1 de erro cada
pnpm test:coverage      # falha se src/services/** < 70%
pnpm lint
```

## 11. Migrations reversíveis

```bash
pnpm migrate:up
pnpm migrate:down       # remove reading_sessions
pnpm migrate:down       # remove shelf_memberships
pnpm migrate:down       # remove books
pnpm migrate:up         # tudo de volta
```

## 12. Estrutura

```bash
find src -name index.ts
! grep -rn "export default" src
! grep -rn "from 'mongodb'" src/services src/controllers src/integrations
! grep -rn "fetch(" src/services src/controllers src/repositories   # fetch só em src/integrations/open-library
```
