# Quickstart — validação manual da feature 006-activityfeed

Passos para confirmar a Definição de Pronto. Rodar da raiz do repositório. Requer o setup das
features 001/002/003/004/005 (Node 24, MongoDB, `ACCESS_TOKEN_SECRET`) e duas contas: uma que vai
gerar atividade (B) e outra que vai segui-la e consultar o feed (A).

## 1. Preparar

```bash
nvm use
pnpm install
pnpm migrate:up        # cria a coleção `activities` + índices
pnpm build
pnpm dev
```

```bash
# duas contas (feature 002)
curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"correct horse","handle":"usera","displayName":"A"}'
curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"b@example.com","password":"correct horse","handle":"userb","displayName":"B"}'

TOKENS_A=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"correct horse"}')
ACCESS_A=$(echo "$TOKENS_A" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
AUTH_A="authorization: Bearer $ACCESS_A"

TOKENS_B=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"b@example.com","password":"correct horse"}')
ACCESS_B=$(echo "$TOKENS_B" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
AUTH_B="authorization: Bearer $ACCESS_B"

USER_B=$(curl -s "localhost:3000/v1/users/search?q=userb" -H "$AUTH_A" \
  | sed -E 's/.*"id":"([^"]+)".*/\1/')
```

## 2. A segue B (com aprovação) — feature 004

```bash
curl -sX POST "localhost:3000/v1/users/$USER_B/follow-request" -H "$AUTH_A" > /dev/null
# B precisa listar/aprovar o pedido pendente de A
REQUEST_ID=$(curl -s localhost:3000/v1/me/follow-requests -H "$AUTH_B" \
  | sed -E 's/.*"userId":"([^"]+)".*/\1/')
curl -sX POST "localhost:3000/v1/follow-requests/$REQUEST_ID/approve" -H "$AUTH_B" > /dev/null
```

## 3. B gera atividade (cenários 1, 4–7, 9)

```bash
OLID=$(curl -s "localhost:3000/v1/books/search?q=duna" -H "$AUTH_B" \
  | sed -E 's/.*"olid":"([^"]+)".*/\1/')

SESSION=$(curl -s -sX POST "localhost:3000/v1/books/$OLID/start-reading" -H "$AUTH_B")
SESSION_ID=$(echo "$SESSION" | sed -E 's/.*"id":"([^"]+)".*/\1/')
# → started_reading

curl -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/progress" -H "$AUTH_B" \
  -H 'content-type: application/json' -d '{"currentPage":120}' > /dev/null
# → progress_update (currentPage: 120)

curl -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/finish" -H "$AUTH_B" > /dev/null
# → finished_reading

REVIEW=$(curl -s -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/review" -H "$AUTH_B" \
  -H 'content-type: application/json' -d '{"rating":4,"text":"Muito bom"}')
REVIEW_ID=$(echo "$REVIEW" | sed -E 's/.*"id":"([^"]+)".*/\1/')
# → review_published
```

## 4. A consulta o feed (RF-006 a RF-009)

```bash
curl -s "localhost:3000/v1/feed" -H "$AUTH_A"
# 200 — 4 itens de B, mais recente primeiro: review_published, finished_reading,
# progress_update (currentPage: 120), started_reading (cenário 1)

curl -si "localhost:3000/v1/feed?cursor=cursor-invalido" -H "$AUTH_A"
# 400 VALIDATION_ERROR (RF-012)
```

## 5. Edição/exclusão refletem no feed (RF-009, RF-010 — cenários 9, 10)

```bash
curl -sX PATCH "localhost:3000/v1/reviews/$REVIEW_ID" -H "$AUTH_B" \
  -H 'content-type: application/json' -d '{"text":"Ainda melhor na 2a leitura"}' > /dev/null
curl -s "localhost:3000/v1/feed" -H "$AUTH_A"
# 200 — o item review_published de B mostra o texto NOVO, não o original (cenário 9)

curl -sX DELETE "localhost:3000/v1/reviews/$REVIEW_ID" -H "$AUTH_B" > /dev/null
curl -s "localhost:3000/v1/feed" -H "$AUTH_A"
# 200 — não há mais item review_published de B; os outros 3 continuam (D4)

curl -sX DELETE "localhost:3000/v1/reading-sessions/$SESSION_ID" -H "$AUTH_B" > /dev/null
curl -s "localhost:3000/v1/feed" -H "$AUTH_A"
# 200 — nenhum item de B restante (cenário 10, cascade completo)
```

## 6. Privacidade (RF-007, P6 — cenários 2, 3, 12)

```bash
# A não segue mais ninguém que gere atividade: cria outro usuário C sem follow e gera atividade
curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"c@example.com","password":"correct horse","handle":"userc","displayName":"C"}'
TOKENS_C=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"c@example.com","password":"correct horse"}')
ACCESS_C=$(echo "$TOKENS_C" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
curl -sX POST "localhost:3000/v1/books/$OLID/mark-finished" -H "authorization: Bearer $ACCESS_C" \
  -H 'content-type: application/json' -d '{"finishedAt":"2026-08-01T00:00:00.000Z"}' > /dev/null

curl -s "localhost:3000/v1/feed" -H "$AUTH_A"
# 200 — nenhum item de C aparece (A não segue C)
```

## 7. Autofeed (RF-008 — cenário 13)

```bash
curl -sX POST "localhost:3000/v1/books/$OLID/mark-finished" -H "$AUTH_A" \
  -H 'content-type: application/json' -d '{"finishedAt":"2026-09-01T00:00:00.000Z"}' > /dev/null
curl -s "localhost:3000/v1/feed" -H "$AUTH_A"
# 200 — a própria atividade de A (finished_reading) aparece no topo do próprio feed
```

## 8. Paginação (RF-011 — cenário 11)

```bash
curl -s "localhost:3000/v1/feed?limit=1" -H "$AUTH_A"
# 200 — 1 item + nextCursor não-nulo; repetir com cursor=<nextCursor> percorre o restante
# sem repetir nem pular itens, mesmo gerando atividade nova entre duas chamadas
```

## 9. Regressão (parte da DoD)

```bash
pnpm test        # unit + integration, inclui os specs pré-existentes de reading-sessions/reviews
pnpm test:coverage  # gate de 70% em src/services/**
```
