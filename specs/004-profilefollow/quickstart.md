# Quickstart — validação manual da feature 004-profilefollow

Passos para confirmar a Definição de Pronto. Rodar da raiz do repositório. Requer o setup das
features 001/002/003 (Node 24, `ACCESS_TOKEN_SECRET`) e duas contas autenticadas (A e B).

Banco: `MONGO_URI` em `.env` aponta para o cluster MongoDB Atlas (`development`) usado no
dev local desta máquina — não é mais `mongodb://localhost:27017` (ver
`.specify/memory/local-dev.md` e `README.md`). `docker compose up -d` continua funcionando
como caminho legado/opcional se `MONGO_URI` for apontado para um Mongo local em vez do Atlas;
não é um passo obrigatório.

## 1. Preparar

```bash
nvm use
pnpm install
# .env já deve ter MONGO_URI apontando para o Atlas (ou, no caminho legado, docker compose up -d)
pnpm migrate:up        # cria follow_requests, follows + índice de texto em users
pnpm build
pnpm dev
```

```bash
# conta A
curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"correct horse","handle":"alice","displayName":"Alice"}'
TOKENS_A=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"correct horse"}')
ACCESS_A=$(echo "$TOKENS_A" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
AUTH_A="authorization: Bearer $ACCESS_A"

# conta B
curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"b@example.com","password":"correct horse","handle":"bob","displayName":"Bob"}'
TOKENS_B=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"b@example.com","password":"correct horse"}')
ACCESS_B=$(echo "$TOKENS_B" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
AUTH_B="authorization: Bearer $ACCESS_B"

USER_A=$(curl -s localhost:3000/v1/me -H "$AUTH_A" | sed -E 's/.*"id":"([^"]+)".*/\1/')
USER_B=$(curl -s localhost:3000/v1/me -H "$AUTH_B" | sed -E 's/.*"id":"([^"]+)".*/\1/')
```

## 2. Perfil (RF-001, RF-002, RF-003 — cenários 1, 2)

```bash
curl -s localhost:3000/v1/me -H "$AUTH_A"
# 200 { "id":..., "email":..., "handle":"alice", "displayName":"Alice", "bio": null, ... }

curl -sX PATCH localhost:3000/v1/me -H "$AUTH_A" -H 'content-type: application/json' \
  -d '{"displayName":"Alice Reader","bio":"Lendo ficção científica"}'
# 200 { "id":..., "handle":"alice", "displayName":"Alice Reader", "bio":"Lendo ficção científica" }

curl -sX PATCH localhost:3000/v1/me -H "$AUTH_A" -H 'content-type: application/json' -d '{"handle":"nova-handle"}'
# 400 VALIDATION_ERROR (handle não é um campo aceito)

curl -sX PATCH localhost:3000/v1/me -H "$AUTH_A" -H 'content-type: application/json' -d '{"displayName":""}'
# 400 VALIDATION_ERROR (displayName vazio)
```

## 3. Busca de usuário (RF-004 — cenário 3)

```bash
curl -s "localhost:3000/v1/users/search?q=bob" -H "$AUTH_A"
# 200 { "items": [{ "id":"...", "handle":"bob", "displayName":"Bob", "avatarUrl": null }], "page":1, ... }

curl -s "localhost:3000/v1/users/search?q=b" -H "$AUTH_A"     # 400 VALIDATION_ERROR (min 2 chars)
curl -s "localhost:3000/v1/users/search?q=bob"                 # sem $AUTH_A -> 401 UNAUTHENTICATED
```

## 4. Ciclo de follow request — pedir, cancelar, pedir de novo (RF-005, RF-006, RF-008, RF-009, RF-013 — cenários 4, 5, 11)

```bash
curl -i -sX POST "localhost:3000/v1/users/$USER_A/follow-request" -H "$AUTH_A"
# 422 CANNOT_FOLLOW_SELF

curl -i -sX POST "localhost:3000/v1/users/$USER_B/follow-request" -H "$AUTH_A"
# 201 { "requesterId": "'$USER_A'", "targetId": "'$USER_B'", "createdAt": ... }

curl -i -sX POST "localhost:3000/v1/users/$USER_B/follow-request" -H "$AUTH_A"
# 200 (mesmo pedido, idempotente — RF-008)

curl -s "localhost:3000/v1/me/follow-requests?direction=outgoing" -H "$AUTH_A"
# 200 { "items": [{ "userId": "'$USER_B'", "handle":"bob", ..., "direction":"outgoing" }], "nextCursor": null }
curl -s "localhost:3000/v1/me/follow-requests?direction=incoming" -H "$AUTH_B"
# 200 { "items": [{ "userId": "'$USER_A'", "handle":"alice", ..., "direction":"incoming" }], "nextCursor": null }

curl -i -sX DELETE "localhost:3000/v1/users/$USER_B/follow-request" -H "$AUTH_A"
# 204 (cancelado)
curl -i -sX DELETE "localhost:3000/v1/users/$USER_B/follow-request" -H "$AUTH_A"
# 404 FOLLOW_REQUEST_NOT_FOUND (já foi cancelado)

curl -i -sX POST "localhost:3000/v1/users/$USER_B/follow-request" -H "$AUTH_A"
# 201 (novo pedido depois de cancelar — RF-013)
```

## 5. Aprovar (RF-010, RF-011 — cenário 6)

```bash
curl -i -sX POST "localhost:3000/v1/users/$USER_A/follow-request/approve" -H "$AUTH_B"
# 204 — cria a relação A -> B

curl -s "localhost:3000/v1/me/followers" -H "$AUTH_B"
# 200 { "items": [{ "userId": "'$USER_A'", "handle":"alice", ... }], "nextCursor": null }
curl -s "localhost:3000/v1/me/following" -H "$AUTH_A"
# 200 { "items": [{ "userId": "'$USER_B'", "handle":"bob", ... }], "nextCursor": null }

curl -s "localhost:3000/v1/me/following" -H "$AUTH_B"
# 200 { "items": [], "nextCursor": null } — sem reciprocidade automática (RF-011, P13)
```

## 6. Duplicado e recusa (RF-007, RF-012, RF-013 — cenário 12, 7)

```bash
curl -i -sX POST "localhost:3000/v1/users/$USER_B/follow-request" -H "$AUTH_A"
# 409 ALREADY_FOLLOWING (A já segue B)

# B pede pra seguir A também (direção oposta, ciclo independente)
curl -i -sX POST "localhost:3000/v1/users/$USER_A/follow-request" -H "$AUTH_B"
# 201

curl -i -sX POST "localhost:3000/v1/users/$USER_B/follow-request/reject" -H "$AUTH_A"
# 204 — recusado, pedido apagado

curl -s "localhost:3000/v1/me/follow-requests?direction=incoming" -H "$AUTH_A"
# 200 { "items": [], "nextCursor": null }

curl -i -sX POST "localhost:3000/v1/users/$USER_A/follow-request" -H "$AUTH_B"
# 201 — B pode pedir de novo depois da recusa (RF-013)
```

## 7. Desfazer a relação (RF-014, RF-015, RF-017 — cenários 8, 9)

```bash
curl -i -sX DELETE "localhost:3000/v1/users/$USER_B/follow" -H "$AUTH_A"
# 204 — A deixa de seguir B
curl -i -sX DELETE "localhost:3000/v1/users/$USER_B/follow" -H "$AUTH_A"
# 404 FOLLOW_NOT_FOUND (não segue mais)

# refazer o follow A -> B pra testar remoção pelo outro lado
curl -sX POST "localhost:3000/v1/users/$USER_B/follow-request" -H "$AUTH_A" > /dev/null
curl -sX POST "localhost:3000/v1/users/$USER_A/follow-request/approve" -H "$AUTH_B" > /dev/null

curl -i -sX DELETE "localhost:3000/v1/users/$USER_A/follower" -H "$AUTH_B"
# 204 — B remove A como seguidor (mesmo efeito de A deixar de seguir B)
curl -s "localhost:3000/v1/me/following" -H "$AUTH_A"
# 200 { "items": [], "nextCursor": null }
```

## 8. Privacidade das listas (RF-020)

```bash
# não existe endpoint para consultar seguidores/seguindo de outro usuário nesta feature —
# confirmar que só /v1/me/followers e /v1/me/following existem (nenhuma rota com :userId
# equivalente foi registrada em follows.routes.ts).
```

## 9. Regressão

```bash
pnpm test          # unit + integration, inclui as suítes de 002/003 sem quebra
pnpm test:coverage # confirma src/services/** >= 70%
pnpm lint
pnpm exec tsc --noEmit
```
