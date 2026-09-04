# Quickstart — validação manual da feature 002-authregistration

Passos para confirmar a Definição de Pronto. Rodar da raiz do repositório. Requer o setup da
001 (Node 24, Docker).

## 1. Preparar

```bash
nvm use
pnpm install                      # inclui @fastify/rate-limit (nova dep)
cp .env.example .env              # já traz ACCESS_TOKEN_SECRET de dev
docker compose up -d
pnpm migrate:up                   # cria users, auth_sessions, refresh_tokens + índices
pnpm build                        # tsc sem erro de tipo
pnpm dev
```

Sem `ACCESS_TOKEN_SECRET` a app não sobe:

```bash
ACCESS_TOKEN_SECRET= pnpm dev     # aborta apontando ACCESS_TOKEN_SECRET (fail-fast da 001)
```

## 2. Cadastro (RF-001..RF-011)

```bash
curl -i -sX POST localhost:3000/v1/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"Alice@Example.com ","password":"correct horse","handle":"Alice","displayName":"Alice"}'
# 201 {"id":"...","email":"alice@example.com","handle":"alice","displayName":"Alice","createdAt":"..."}
# sem passwordHash, sem token

# e-mail duplicado (qualquer caixa)
curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"another one!","handle":"bob","displayName":"Bob"}'
# 409 {"error":{"code":"EMAIL_ALREADY_IN_USE",...}}

# handle duplicado (caixa diferente)
curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"bob@example.com","password":"another one!","handle":"ALICE","displayName":"Bob"}'
# 409 {"error":{"code":"HANDLE_ALREADY_IN_USE",...}}

# corpo inválido
curl -sX POST localhost:3000/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"x@y.z","password":"short","handle":"!!","displayName":""}'
# 400 {"error":{"code":"VALIDATION_ERROR","details":[...]}}
```

## 3. Login e /me (RF-012..RF-020, RF-032)

```bash
TOKENS=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"correct horse"}')
echo "$TOKENS"   # {"accessToken":"...","refreshToken":"...","tokenType":"Bearer","expiresIn":900}
ACCESS=$(echo "$TOKENS"  | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
REFRESH=$(echo "$TOKENS" | sed -E 's/.*"refreshToken":"([^"]+)".*/\1/')

curl -i -s localhost:3000/v1/me -H "authorization: Bearer $ACCESS"
# 200 {"id":"...","email":"alice@example.com","handle":"alice","displayName":"Alice","createdAt":"..."}

curl -s localhost:3000/v1/me                              # 401 UNAUTHENTICATED
curl -s localhost:3000/v1/me -H 'authorization: Bearer x' # 401 INVALID_ACCESS_TOKEN
curl -s localhost:3000/v1/me -H 'authorization: Basic x'  # 401 UNAUTHENTICATED

# senha errada e e-mail inexistente → mesma resposta
curl -s localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"nope"}'          # 401 INVALID_CREDENTIALS
curl -s localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"ghost@example.com","password":"nope"}'          # 401 INVALID_CREDENTIALS (idêntica)
```

## 4. Refresh + rotação (RF-021..RF-024)

```bash
NEW=$(curl -sX POST localhost:3000/v1/auth/refresh -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}")
echo "$NEW"   # novo par; expiresIn 900
NEW_REFRESH=$(echo "$NEW" | sed -E 's/.*"refreshToken":"([^"]+)".*/\1/')

# o refresh antigo agora é reuso → sessão inteira revogada (RF-026)
curl -s localhost:3000/v1/auth/refresh -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}"
# 401 {"error":{"code":"REFRESH_TOKEN_REUSE_DETECTED",...}}

# e o refresh "novo" também deixou de valer (a sessão foi revogada)
curl -s localhost:3000/v1/auth/refresh -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$NEW_REFRESH\"}"
# 401 {"error":{"code":"INVALID_REFRESH_TOKEN",...}}

# token forjado
curl -s localhost:3000/v1/auth/refresh -H 'content-type: application/json' \
  -d '{"refreshToken":"deadbeef"}'                        # 401 INVALID_REFRESH_TOKEN
```

Expiração por inatividade (RF-025) não dá para observar em 30 dias no curl — coberta por
teste de integração que grava `inactivityExpiresAt` no passado.

## 5. Logout idempotente (RF-029..RF-031)

```bash
L=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"correct horse"}')
LR=$(echo "$L" | sed -E 's/.*"refreshToken":"([^"]+)".*/\1/')

curl -i -sX POST localhost:3000/v1/auth/logout -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$LR\"}"                          # 204
curl -sX POST localhost:3000/v1/auth/refresh -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$LR\"}"                          # 401 INVALID_REFRESH_TOKEN
curl -i -sX POST localhost:3000/v1/auth/logout -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$LR\"}"                          # 204 de novo (idempotente)
curl -i -sX POST localhost:3000/v1/auth/logout -H 'content-type: application/json' \
  -d '{"refreshToken":"whatever"}'                         # 204 (token desconhecido)
```

## 6. Troca de senha revoga as demais sessões (RF-033..RF-036)

```bash
# duas sessões
A=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"correct horse"}')
B=$(curl -sX POST localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"correct horse"}')
A_ACCESS=$(echo  "$A" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
A_REFRESH=$(echo "$A" | sed -E 's/.*"refreshToken":"([^"]+)".*/\1/')
B_REFRESH=$(echo "$B" | sed -E 's/.*"refreshToken":"([^"]+)".*/\1/')

# troca de senha pela sessão A, preservando A
curl -i -sX POST localhost:3000/v1/auth/change-password \
  -H "authorization: Bearer $A_ACCESS" -H 'content-type: application/json' \
  -d "{\"currentPassword\":\"correct horse\",\"newPassword\":\"a brand new one\",\"refreshToken\":\"$A_REFRESH\"}"
# 204

curl -s localhost:3000/v1/auth/refresh -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$B_REFRESH\"}"                   # 401 INVALID_REFRESH_TOKEN (sessão B revogada)
curl -s localhost:3000/v1/auth/refresh -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$A_REFRESH\"}"                   # 200 (sessão A preservada)

# senha atual errada
curl -s localhost:3000/v1/auth/change-password -H "authorization: Bearer $A_ACCESS" \
  -H 'content-type: application/json' \
  -d '{"currentPassword":"wrong","newPassword":"whatever else"}'   # 401 INVALID_CREDENTIALS

# login com a senha nova funciona; com a antiga, não
curl -s localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"a brand new one"}'  # 200
curl -s localhost:3000/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"correct horse"}'    # 401 INVALID_CREDENTIALS
```

## 7. Rate limit (RF-037, RF-038)

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/v1/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"alice@example.com","password":"nope"}'
done
# primeiras respostas 401; depois de AUTH_RATE_LIMIT_MAX (default 10), 429 TOO_MANY_REQUESTS
# esperar a janela (AUTH_RATE_LIMIT_WINDOW_MS) e voltar a 401
```

## 8. Testes, cobertura, lint

```bash
pnpm test:unit          # password/token/refresh-token puros, schemas zod, parsing do header
pnpm test:integration   # signup/login/refresh/logout/change-password/authenticate com
                        # mongodb-memory-server — caminho feliz + ≥1 de erro cada
pnpm test:coverage      # falha se src/services/** < 70%
pnpm lint               # sem erros; barra import de mongodb fora de repositories/db,
                        # process.env fora de src/config, export default
```

## 9. Migrations reversíveis

```bash
pnpm migrate:up
pnpm migrate:down       # remove refresh_tokens
pnpm migrate:down       # remove auth_sessions
pnpm migrate:down       # remove users
pnpm migrate:up         # tudo de volta
```

## 10. Estrutura

```bash
find src -name index.ts             # cada pasta de domínio nova tem um
! grep -rn "export default" src     # nenhum resultado
! grep -rn "from 'mongodb'" src/services src/controllers src/auth   # driver só em repositories/db
```
