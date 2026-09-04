# Quickstart — validação manual da feature 005-reviews

Passos para confirmar a Definição de Pronto. Rodar da raiz do repositório. Requer o setup das
features 001/002/003 (Node 24, MongoDB, `ACCESS_TOKEN_SECRET`) e uma conta já autenticada com
um livro finalizado.

## 1. Preparar

```bash
nvm use
pnpm install
pnpm migrate:up        # cria a coleção `reviews` + índices (sessionId único, bookId)
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

# livro + reading session finalizada (feature 003)
OLID=$(curl -s "localhost:3000/v1/books/search?q=duna" -H "$AUTH" | sed -E 's/.*"olid":"([^"]+)".*/\1/')
SESSION=$(curl -sX POST "localhost:3000/v1/books/$OLID/mark-finished" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"finishedAt":"2026-08-01T00:00:00.000Z"}')
SESSION_ID=$(echo "$SESSION" | sed -E 's/.*"id":"([^"]+)".*/\1/')

# uma 2ª session ainda em `reading`, para o caso de rejeição (RF-002)
curl -sX POST "localhost:3000/v1/books/$OLID/start-reading" -H "$AUTH" > /dev/null
```

## 2. Criar review (RF-001, RF-002, RF-003, RF-004, RF-011)

```bash
curl -si -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/review" -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{"rating":4,"text":"Ótimo, com spoiler leve no final","containsSpoiler":true}'
# 201 { "id": "...", "sessionId": "...", "rating": 4, "text": "...", "containsSpoiler": true, ... }

curl -si -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/review" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"rating":5}'
# 409 REVIEW_ALREADY_EXISTS (cenário 5 — mesma session)

curl -si -sX POST "localhost:3000/v1/reading-sessions/nao-existe/review" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"rating":3}'
# 404 READING_SESSION_NOT_FOUND

curl -s -sX POST "localhost:3000/v1/books/$OLID/start-reading" -H "$AUTH"
# copie o "id" da resposta como $READING_SESSION_ID e tente:
curl -si -sX POST "localhost:3000/v1/reading-sessions/$READING_SESSION_ID/review" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"rating":3}'
# 409 READING_SESSION_NOT_FINISHED (cenário 4 — session ainda `reading`)

curl -si -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/review" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"rating":6}'
# 400 VALIDATION_ERROR (rating fora de 1-5)
```

Pegue o `id` da review criada com sucesso:

```bash
REVIEW_ID=... # substitua pelo id retornado no passo anterior
```

## 3. Editar parcialmente (RF-005)

```bash
curl -si -sX PATCH "localhost:3000/v1/reviews/$REVIEW_ID" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"rating":5}'
# 200 — só rating muda; text e containsSpoiler continuam como estavam (cenário 6)

curl -si -sX PATCH "localhost:3000/v1/reviews/$REVIEW_ID" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"text":null}'
# 200 — text vira null (cenário 7)

curl -si -sX PATCH "localhost:3000/v1/reviews/$REVIEW_ID" -H "$AUTH" \
  -H 'content-type: application/json' -d '{}'
# 400 VALIDATION_ERROR (nenhum campo enviado)

curl -si -sX PATCH "localhost:3000/v1/reviews/nao-existe" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"rating":1}'
# 404 REVIEW_NOT_FOUND
```

## 4. Agregados reais no detalhe do livro (RF-009, RF-010)

```bash
curl -s "localhost:3000/v1/books/$OLID" -H "$AUTH"
# 200 aggregates.averageRating: 5, aggregates.reviewCount: 1 (cenário 9)

curl -s "localhost:3000/v1/me/reading-sessions" -H "$AUTH"
# 200 — o item com id == $SESSION_ID tem "review": { ... }; os demais têm "review": null
# (cenário 13)
```

## 5. Apagar review e cascade (RF-006, RF-007)

```bash
curl -si -sX DELETE "localhost:3000/v1/reviews/$REVIEW_ID" -H "$AUTH"     # 204
curl -s "localhost:3000/v1/books/$OLID" -H "$AUTH"
# 200 aggregates.averageRating: null, aggregates.reviewCount: 0 de novo (cenário 7, 10)

# recriar e apagar via a reading session (cascade — cenário 8)
curl -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/review" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"rating":3}' > /dev/null
curl -si -sX DELETE "localhost:3000/v1/reading-sessions/$SESSION_ID" -H "$AUTH"    # 204
curl -si -sX PATCH "localhost:3000/v1/reviews/$REVIEW_ID" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"rating":1}'
# 404 REVIEW_NOT_FOUND — a review foi apagada em cascata junto com a session
```

## 6. Regressão (parte da DoD)

```bash
pnpm test        # unit + integration, inclui os specs pré-existentes de reading-sessions/books
pnpm test:coverage  # gate de 70% em src/services/**
```
