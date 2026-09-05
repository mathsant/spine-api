# Quickstart — validação manual da feature 008-notificationflow

Passos para confirmar a Definição de Pronto. Rodar da raiz do repositório. Requer o setup das
features 001–007 (Node 24, MongoDB, `ACCESS_TOKEN_SECRET`) e três contas: A (dona do conteúdo), B
(seguidora aprovada de A, gera comentários/curtidas), C (também seguidora aprovada de A, usada nos
cenários de resposta a comentário).

## 1. Preparar

```bash
nvm use
pnpm install
pnpm migrate:up        # cria a coleção `notifications` + índices
pnpm build
pnpm dev
```

```bash
for u in a b c; do
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
AUTH_C="authorization: Bearer $(login c)"

USER_A=$(curl -s "localhost:3000/v1/users/search?q=usera" -H "$AUTH_B" | sed -E 's/.*"id":"([^"]+)".*/\1/')
```

## 2. Follow request e aprovação (RF-001, RF-002, RF-004 — cenários 1–2)

```bash
curl -sX POST "localhost:3000/v1/users/$USER_A/follow-request" -H "$AUTH_B" > /dev/null
curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A"
# 200 — item type: "follow_request", actorId: id de B, read: false

curl -s "localhost:3000/v1/me/notifications/unread-count" -H "$AUTH_A"
# {"count":1}

USER_B=$(curl -s localhost:3000/v1/me/follow-requests -H "$AUTH_A" | sed -E 's/.*"requesterId":"([^"]+)".*/\1/')
curl -sX POST "localhost:3000/v1/users/$USER_B/follow-request/approve" -H "$AUTH_A" > /dev/null

curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A"
# 200 — a notificação follow_request de A sumiu (RF-004)

curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_B"
# 200 — B tem uma notificação nova, type: "follow_approved", actorId: id de A
```

## 3. Recusa é silenciosa (RF-003 — cenário 3)

```bash
curl -sX POST "localhost:3000/v1/users/$USER_A/follow-request" -H "$AUTH_C" > /dev/null
USER_C=$(curl -s localhost:3000/v1/me/follow-requests -H "$AUTH_A" | sed -E 's/.*"requesterId":"([^"]+)".*/\1/')
curl -sX POST "localhost:3000/v1/users/$USER_C/follow-request/reject" -H "$AUTH_A" > /dev/null

curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_C"
# 200 — items: [] (C não recebe nenhuma notificação de recusa)

# C precisa ser seguidora aprovada de A para os próximos passos — envia de novo e A aprova:
curl -sX POST "localhost:3000/v1/users/$USER_A/follow-request" -H "$AUTH_C" > /dev/null
USER_C=$(curl -s localhost:3000/v1/me/follow-requests -H "$AUTH_A" | sed -E 's/.*"requesterId":"([^"]+)".*/\1/')
curl -sX POST "localhost:3000/v1/users/$USER_C/follow-request/approve" -H "$AUTH_A" > /dev/null
```

## 4. A gera atividade e B comenta (RF-005 — cenário 4)

```bash
OLID=$(curl -s "localhost:3000/v1/books/search?q=duna" -H "$AUTH_A" | sed -E 's/.*"olid":"([^"]+)".*/\1/')
SESSION=$(curl -s -X POST "localhost:3000/v1/books/$OLID/start-reading" -H "$AUTH_A")
SESSION_ID=$(echo "$SESSION" | sed -E 's/.*"id":"([^"]+)".*/\1/')
curl -sX POST "localhost:3000/v1/reading-sessions/$SESSION_ID/progress" -H "$AUTH_A" \
  -H 'content-type: application/json' -d '{"currentPage":120}' > /dev/null

FEED=$(curl -s "localhost:3000/v1/feed" -H "$AUTH_B")
PROGRESS_ID=$(echo "$FEED" | grep -o '"id":"[^"]*","type":"progress_update"' | sed -E 's/"id":"([^"]*)".*/\1/')

COMMENT=$(curl -s -X POST "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_B" \
  -H 'content-type: application/json' -d '{"text":"Boa!"}')
COMMENT_ID=$(echo "$COMMENT" | sed -E 's/.*"id":"([^"]+)".*/\1/')

curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A"
# 200 — item type: "comment_on_content", actorId: id de B, commentId: $COMMENT_ID
```

## 5. Resposta a comentário: duas notificações separadas (RF-006 — cenário 6)

```bash
REPLY=$(curl -s -X POST "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_C" \
  -H 'content-type: application/json' -d "{\"text\":\"concordo\",\"parentCommentId\":\"$COMMENT_ID\"}")

curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_B"
# 200 — B (autor do comentário-pai) recebe type: "comment_reply", actorId: id de C

curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A"
# 200 — A (dona do item) recebe TAMBÉM type: "comment_on_content" para o novo comentário de C
# (duas notificações, dois destinatários — B e A — cenário 6)
```

## 6. Dedup quando o dono do item é o autor do comentário-pai (RF-007 — cenário 7)

```bash
OWN_COMMENT=$(curl -s -X POST "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_A" \
  -H 'content-type: application/json' -d '{"text":"gente, leiam este trecho"}')
OWN_COMMENT_ID=$(echo "$OWN_COMMENT" | sed -E 's/.*"id":"([^"]+)".*/\1/')
# A comentando no próprio item: nenhuma notificação para A (RF-009, sem auto-notificação)

curl -sX POST "localhost:3000/v1/activities/$PROGRESS_ID/comments" -H "$AUTH_B" \
  -H 'content-type: application/json' -d "{\"text\":\"boa!\",\"parentCommentId\":\"$OWN_COMMENT_ID\"}" > /dev/null

curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A"
# 200 — A recebe SÓ 1 notificação nova (comment_reply) para essa resposta, não 2 (RF-007)
```

## 7. Apagar comentário remove a notificação (RF-010 — cenário 5)

```bash
curl -sX DELETE "localhost:3000/v1/comments/$COMMENT_ID" -H "$AUTH_B" > /dev/null

curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A"
# 200 — a notificação comment_on_content referente a $COMMENT_ID não aparece mais
```

## 8. Curtida idempotente e remoção ao descurtir (RF-008, RF-010 — cenários 8–9)

```bash
curl -si -X POST "localhost:3000/v1/activities/$PROGRESS_ID/reactions" -H "$AUTH_B"
curl -si -X POST "localhost:3000/v1/activities/$PROGRESS_ID/reactions" -H "$AUTH_B"
# 204 nas duas — repetir não duplica a notificação (D1 do research.md)

curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A"
# 200 — só 1 notificação type: "reaction_on_content" de B, mesmo com o POST repetido

curl -sX DELETE "localhost:3000/v1/activities/$PROGRESS_ID/reactions" -H "$AUTH_B" > /dev/null
curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A"
# 200 — a notificação de curtida sumiu
```

## 9. Marcar como lida — individual, em massa, idempotente (RF-012 a RF-015 — cenários 11–14)

```bash
NOTIF_ID=$(curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A" | sed -E 's/.*"id":"([^"]+)".*/\1/')

curl -si -X POST "localhost:3000/v1/notifications/$NOTIF_ID/read" -H "$AUTH_A"
# 204
curl -si -X POST "localhost:3000/v1/notifications/$NOTIF_ID/read" -H "$AUTH_A"
# 204 de novo — idempotente, readAt original preservado

curl -si -X POST "localhost:3000/v1/notifications/$NOTIF_ID/read" -H "$AUTH_B"
# 404 NOTIFICATION_NOT_FOUND — a notificação não é de B

curl -s "localhost:3000/v1/me/notifications/unread-count" -H "$AUTH_A"
# count diminuiu em 1

curl -sX POST "localhost:3000/v1/notifications/read-all" -H "$AUTH_A" > /dev/null
curl -s "localhost:3000/v1/me/notifications/unread-count" -H "$AUTH_A"
# {"count":0}
```

## 10. Cascade via `delete-reading-session` (RF-010 — caso de borda)

```bash
curl -sX DELETE "localhost:3000/v1/reading-sessions/$SESSION_ID" -H "$AUTH_A" > /dev/null
curl -s "localhost:3000/v1/me/notifications" -H "$AUTH_A"
# 200 — nenhuma notificação restante referente a comentários/curtidas daquela session
```

## 11. Regressão e cobertura (parte da DoD)

```bash
pnpm test              # unit + integration, inclui os specs pré-existentes das features 003/004/005/007
pnpm test:coverage      # gate de 70% em src/services/**, incluindo notifications/ novo
```
