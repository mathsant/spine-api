# Quickstart — validação manual da feature 007-interactions

Passos para confirmar a Definição de Pronto. Rodar da raiz do repositório. Requer o setup das
features 001–006 (Node 24, MongoDB, `ACCESS_TOKEN_SECRET`) e três contas: uma que gera atividade
(B), uma que a segue com follow aprovado (A), e uma sem relação nenhuma com B (D, cenário 9).

## 1. Preparar

```bash
nvm use
pnpm install
pnpm migrate:up        # cria as coleções `comments` e `reactions` + índices
pnpm build
pnpm dev
```

```bash
# três contas (feature 002)
for u in a b d; do
  curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
    -d "{\"email\":\"$u@example.com\",\"password\":\"correct horse\",\"handle\":\"user$u\",\"displayName\":\"$u\"}" > /dev/null
done

login() {
  curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
    -d "{\"email\":\"$1@example.com\",\"password\":\"correct horse\"}" \
    | sed -E 's/.*"accessToken":"([^"]+)".*/\1/'
}
AUTH_A="authorization: Bearer $(login a)"
AUTH_B="authorization: Bearer $(login b)"
AUTH_D="authorization: Bearer $(login d)"

USER_B=$(curl -s "localhost:3000/v1/users/search?q=userb" -H "$AUTH_A" \
  | sed -E 's/.*"id":"([^"]+)".*/\1/')
```

## 2. A segue B (com aprovação) — feature 004

```bash
curl -sX POST "localhost:3000/v1/users/$USER_B/follow-request" -H "$AUTH_A" > /dev/null
REQUESTER_ID=$(curl -s localhost:3000/v1/me/follow-requests -H "$AUTH_B" \
  | sed -E 's/.*"userId":"([^"]+)".*/\1/')
curl -sX POST "localhost:3000/v1/users/$REQUESTER_ID/follow-request/approve" -H "$AUTH_B" > /dev/null
```

## 3. B gera atividade — feature 006

```bash
OLID=$(curl -s "localhost:3000/v1/books/search?q=duna" -H "$AUTH_B" \
  | sed -E 's/.*"olid":"([^"]+)".*/\1/')

SESSION=$(curl -s -sX POST "localhost:3000/v1/books/$OLID/start-reading" -H "$AUTH_B")
SESSION_ID=$(echo "$SESSION" | sed -E 's/.*"id":"([^"]+)".*/\1/')
curl -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/progress" -H "$AUTH_B" \
  -H 'content-type: application/json' -d '{"currentPage":120}' > /dev/null

FEED=$(curl -s "localhost:3000/v1/feed" -H "$AUTH_A")
STARTED_ID=$(echo "$FEED" | grep -o '"id":"[^"]*","type":"started_reading"' | sed -E 's/"id":"([^"]*)".*/\1/')
PROGRESS_ID=$(echo "$FEED" | grep -o '"id":"[^"]*","type":"progress_update"' | sed -E 's/"id":"([^"]*)".*/\1/')
```

## 4. Curtir (RF-001 a RF-004 — cenários 1–3)

```bash
curl -si -X POST "localhost:3000/v1/activities/$PROGRESS_ID/reactions" -H "$AUTH_A"
# 204

curl -si -X POST "localhost:3000/v1/activities/$PROGRESS_ID/reactions" -H "$AUTH_A"
# 204 — repetir não duplica (idempotente)

curl -s "localhost:3000/v1/feed" -H "$AUTH_A"
# 200 — o item progress_update mostra reactionsCount: 1, hasReacted: true

curl -si -X DELETE "localhost:3000/v1/activities/$PROGRESS_ID/reactions" -H "$AUTH_A"
# 204 — reactionsCount volta a 0, hasReacted: false

curl -si -X DELETE "localhost:3000/v1/activities/$PROGRESS_ID/reactions" -H "$AUTH_A"
# 404 REACTION_NOT_FOUND — nada para remover
```

## 5. Comentar e responder (RF-005 a RF-008, RF-010 — cenários 4–6)

```bash
curl -sX POST "localhost:3000/v1/activities/$PROGRESS_ID/reactions" -H "$AUTH_A" > /dev/null

COMMENT=$(curl -s -X POST "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_A" \
  -H 'content-type: application/json' -d '{"text":"Boa, continua assim!"}')
COMMENT_ID=$(echo "$COMMENT" | sed -E 's/.*"id":"([^"]+)".*/\1/')
# 201

REPLY=$(curl -s -X POST "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_D" \
  -H 'content-type: application/json' -d "{\"text\":\"valeu!\",\"parentCommentId\":\"$COMMENT_ID\"}")
# 404 COMMENT_NOT_FOUND esperado aqui se D não segue B — ver passo 7; repita como B respondendo:
REPLY=$(curl -s -X POST "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_B" \
  -H 'content-type: application/json' -d "{\"text\":\"valeu!\",\"parentCommentId\":\"$COMMENT_ID\"}")
REPLY_ID=$(echo "$REPLY" | sed -E 's/.*"id":"([^"]+)".*/\1/')
# 201 — parentCommentId aponta para o comentário de A (RF-014, B comentando no próprio post)

curl -si -X POST "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_A" \
  -H 'content-type: application/json' -d "{\"text\":\"não dá\",\"parentCommentId\":\"$REPLY_ID\"}"
# 422 COMMENT_NESTING_TOO_DEEP — responder a uma resposta (cenário 6)

curl -s "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_A"
# 200 — ordem cronológica ascendente: comentário de A, depois a resposta de B aninhada nele
```

## 6. Apagar comentário (RF-009 — cenário 7)

```bash
curl -si -X DELETE "localhost:3000/v1/comments/$COMMENT_ID" -H "$AUTH_A"
# 204

curl -s "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_A"
# 200 — o comentário de A aparece com text: "[removido]", deleted: true; a resposta de B continua visível

curl -si -X DELETE "localhost:3000/v1/comments/$COMMENT_ID" -H "$AUTH_B"
# 404 COMMENT_NOT_FOUND — B não é o autor
```

## 7. Privacidade P6 (RF-012 — cenário 9)

```bash
curl -si -X POST "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_D" \
  -H 'content-type: application/json' -d '{"text":"oi"}'
# 404 ACTIVITY_NOT_FOUND — D não segue B (nem é o dono)

curl -si -X POST "localhost:3000/v1/activities/$PROGRESS_ID/reactions" -H "$AUTH_D"
# 404 ACTIVITY_NOT_FOUND

curl -si "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_D"
# 404 ACTIVITY_NOT_FOUND
```

## 8. `started_reading` fora de escopo (RF-011 — cenário 11)

```bash
curl -si -X POST "localhost:3000/v1/activities/$STARTED_ID/reactions" -H "$AUTH_A"
# 422 UNSUPPORTED_ACTIVITY_INTERACTION
```

## 9. Cascade sem órfão (RF-013 — cenário 10)

```bash
curl -sX DELETE "localhost:3000/v1/reading-sessions/$SESSION_ID" -H "$AUTH_B" > /dev/null
curl -s "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_A"
# 404 ACTIVITY_NOT_FOUND — o item, e com ele os comentários/curtidas, sumiu junto com a session
```

## 10. Regressão e cobertura (parte da DoD)

```bash
pnpm test              # unit + integration, inclui os specs pré-existentes das features 003/005/006
pnpm test:coverage      # gate de 70% em src/services/**, incluindo comments/ e reactions/ novos
```
