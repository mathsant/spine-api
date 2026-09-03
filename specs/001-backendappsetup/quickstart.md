# Quickstart — validação manual da feature 001-backendappsetup

Passos para confirmar a Definição de Pronto. Rodar da raiz do repositório.

## Pré-requisitos

- Node.js v24 (`nvm use` lê o `.nvmrc`)
- Docker + Docker Compose

## 1. Instalar e compilar

```bash
nvm use
npm install
npm run build          # tsc deve terminar sem erro de tipo   (DoD: build limpo)
```

## 2. Subir o MongoDB local

```bash
cp .env.example .env
docker compose up -d
docker compose ps      # serviço "mongo" deve estar healthy
```

## 3. Subir a aplicação e checar o health

```bash
npm run dev            # tsx watch; log estruturado com reqId
```

Em outro terminal:

```bash
curl -i localhost:3000/health
# HTTP/1.1 200 OK
# {"status":"ok","db":"up","uptime":<n>}      (DoD: /health 200 com db "up")

curl -i -H "x-request-id: demo-123" localhost:3000/health
# resposta traz x-request-id: demo-123 e o log da requisição usa reqId "demo-123"
```

## 4. Health com o banco fora

```bash
docker compose stop mongo
curl -i localhost:3000/health
# HTTP/1.1 503 Service Unavailable
# {"status":"degraded","db":"down","uptime":<n>}   (DoD: /health 503 com db "down")
# a aplicação continua no ar — o processo não caiu
docker compose start mongo   # volta a 200 em seguida
```

## 5. Fail-fast de configuração

```bash
MONGO_URI= npm run dev
# processo encerra sem subir; mensagem aponta MONGO_URI como inválida   (DoD: fail-fast)
```

## 6. Encerramento gracioso

```bash
npm run dev
# em outro terminal:
kill -TERM $(pgrep -f "tsx watch")
# logs mostram fechamento do Fastify e da conexão Mongo; exit code 0   (DoD: SIGTERM)
```

## 7. Testes e cobertura

```bash
npm run test:unit          # sem banco                             (DoD: unit passam)
npm run test:integration   # usa mongodb-memory-server             (DoD: integração passa)
npm run test:coverage      # falha se cobertura de src/services/** < 70%   (DoD: gate 70%)
```

## 8. Lint

```bash
npm run lint               # zero erros; barra `export default` e import de `mongodb`
                           # fora de repositories/db                (DoD: lint limpo)
```

## 9. Migrations (infra apenas)

```bash
npm run migrate:up         # nada a aplicar (nenhuma migration nesta feature)
npm run migrate:create -- add-example    # cria arquivo em migrations/ e some com git checkout
```

## 10. CI

Abrir um PR da branch `001-backendappsetup` e conferir o workflow do GitHub Actions:
`install → lint → test:unit → test:integration → build`, todos verdes.   (DoD: CI verde)

## 11. Estrutura

```bash
find src -name index.ts    # cada pasta de domínio tem um
! grep -rn "export default" src   # nenhum resultado                (DoD: sem export default)
```
