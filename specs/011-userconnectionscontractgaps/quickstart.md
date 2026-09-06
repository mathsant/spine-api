# Quickstart — validação manual (`011-userconnectionscontractgaps`)

Passos para validar D1–D4 contra um servidor local. Pré-requisitos: MongoDB local (ver `.specify/memory/local-dev.md`), `npm run dev`, e a migration nova aplicada (`npx migrate-mongo up`).

Todas as chamadas usam `Authorization: Bearer <ACCESS>`. Crie 3 usuários (ex.: **ana**, **bruno**, **dora**) via `POST /v1/auth/signup` e guarde os `accessToken`. Descubra ids por `GET /v1/users/search?q=...`.

## Setup de relacionamento

```bash
# ana pede para seguir bruno; bruno aprova
curl -X POST $API/v1/users/$BRUNO_ID/follow-request        -H "Authorization: Bearer $ANA"
curl -X POST $API/v1/users/$ANA_ID/follow-request/approve  -H "Authorization: Bearer $BRUNO"
# ana pede para seguir dora; dora NÃO aprova (fica pendente)
curl -X POST $API/v1/users/$DORA_ID/follow-request         -H "Authorization: Bearer $ANA"
# bruno lê e finaliza 2 livros + rele 1 (para booksRead), publica review
# (use POST /v1/books/{olid}/mark-finished e POST /v1/reading-sessions/{id}/review)
```

## D1 — `GET /users/{userId}`

```bash
# ana vê bruno (segue aprovado): bio presente, followState=following, followsYou depende
curl $API/v1/users/$BRUNO_ID -H "Authorization: Bearer $ANA"
#   → 200 { ..., bio: "<texto>", followState: "following", followsYou: <bool> }

# ana vê dora (pedido pendente): bio null, followState=pending
curl $API/v1/users/$DORA_ID -H "Authorization: Bearer $ANA"
#   → 200 { ..., bio: null, followState: "pending", followsYou: false }

# ana vê alguém que não segue: bio null, followState=none
curl $API/v1/users/$OUTRO_ID -H "Authorization: Bearer $ANA"
#   → 200 { ..., bio: null, followState: "none", followsYou: false }

# ana vê a si mesma
curl $API/v1/users/$ANA_ID -H "Authorization: Bearer $ANA"
#   → 200 { ..., followState: "none", followsYou: false, bio: null }

# id inexistente e id malformado → MESMO 404 neutro
curl -i $API/v1/users/000000000000000000000000 -H "Authorization: Bearer $ANA"   # → 404 USER_NOT_FOUND
curl -i $API/v1/users/nao-e-um-id              -H "Authorization: Bearer $ANA"   # → 404 USER_NOT_FOUND (não 400)

# sem token
curl -i $API/v1/users/$BRUNO_ID   # → 401
```

## D2 — `GET /users/{userId}/activity`

```bash
# ana (segue bruno aprovado) vê a atividade dele — itens no formato de GET /feed
curl "$API/v1/users/$BRUNO_ID/activity?limit=2" -H "Authorization: Bearer $ANA"
#   → 200 { items: [ {id, type, createdAt, actor, book, readingSessionId, currentPage, review, reactionsCount, hasReacted}, ... ], nextCursor: "<cursor>|null" }

# paginação: repetir com ?cursor=<nextCursor> — sem repetição nem buraco
curl "$API/v1/users/$BRUNO_ID/activity?limit=2&cursor=$NEXT" -H "Authorization: Bearer $ANA"

# ana vê a atividade de dora (só pedido pendente) → 404 neutro, NÃO 403
curl -i $API/v1/users/$DORA_ID/activity -H "Authorization: Bearer $ANA"   # → 404 USER_NOT_FOUND

# id inexistente/malformado → 404 USER_NOT_FOUND
curl -i $API/v1/users/nao-e-um-id/activity -H "Authorization: Bearer $ANA" # → 404

# ana vê a própria atividade
curl $API/v1/users/$ANA_ID/activity -H "Authorization: Bearer $ANA"        # → 200 (própria atividade)

# bruno desfaz: ana deixa de seguir bruno, tenta de novo
curl -X DELETE $API/v1/users/$BRUNO_ID/follow -H "Authorization: Bearer $ANA"
curl -i $API/v1/users/$BRUNO_ID/activity -H "Authorization: Bearer $ANA"   # → 404 USER_NOT_FOUND

# cursor/limit inválido → 400
curl -i "$API/v1/users/$BRUNO_ID/activity?limit=999" -H "Authorization: Bearer $ANA"  # → 400
```

## D3 — `GET /me/stats`

```bash
curl $API/v1/me/stats -H "Authorization: Bearer $BRUNO"
#   → 200 { booksRead: <livros distintos finished>, followers, following, pendingFollowRequests, wantToRead }
#   Conferir: bruno releu 1 livro (2 sessions finished do mesmo book) → booksRead conta esse livro 1x.
#   ana tem 2 pedidos enviados não respondidos → o pendingFollowRequests DELA não conta esses (só recebidos).

curl $API/v1/me/stats -H "Authorization: Bearer $USUARIO_NOVO"
#   → 200 { booksRead: 0, followers: 0, following: 0, pendingFollowRequests: 0, wantToRead: 0 }

curl -i $API/v1/me/stats   # → 401
```

## D4 — campos novos nos DTOs de lista

```bash
# busca: cada item traz followState + followsYou
curl "$API/v1/users/search?q=bru" -H "Authorization: Bearer $ANA"
#   → item de bruno: followState: "following"; item de quem tem pedido: "pending"; demais: "none"

# following: followState sempre "following"
curl $API/v1/me/following -H "Authorization: Bearer $ANA"

# followers: followsYou sempre true; followState indica se sigo de volta
curl $API/v1/me/followers -H "Authorization: Bearer $BRUNO"

# follow-requests incoming: followsYou=false enquanto não aprovo; followState = meu estado
curl "$API/v1/me/follow-requests?direction=incoming" -H "Authorization: Bearer $DORA"

# follow-requests outgoing: followState sempre "pending"
curl "$API/v1/me/follow-requests?direction=outgoing" -H "Authorization: Bearer $ANA"
```

## Gate de documentação

```bash
pnpm docs:lint      # redocly lint docs/openapi.yaml — sem erros novos
```

Conferir manualmente que `docs/flows/follow-flow.md` não afirma mais que "não existe endpoint de ver perfil de fulano", que documenta D1–D4, e que `docs/flows/feed-flow.md` menciona `GET /users/{userId}/activity`.

## Índices

```bash
# no shell do mongo / Compass:
db.follows.getIndexes()   # deve conter follows_followeeId_followerId
db.follows.find({ followeeId: "<id>", followerId: { $in: ["<a>","<b>"] } }).explain("queryPlanner")
#   → winningPlan usa IXSCAN follows_followeeId_followerId, sem COLLSCAN
```
