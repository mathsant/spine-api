# Contrato de variáveis de ambiente — Backend App Setup

spec RF-009..RF-012. Espelhado em `.env.example` (versionado). Validado por `zod` no boot;
variável obrigatória ausente/inválida ⇒ processo **não sobe** e imprime o motivo.

| Variável | Obrigatória | Tipo / formato | Default | Notas |
|---|---|---|---|---|
| `NODE_ENV` | não | `development \| test \| production` | `development` | controla transport de log e checagens |
| `PORT` | não | inteiro `1..65535` (string coerced) | `3000` | porta HTTP |
| `HOST` | não | string não vazia | `0.0.0.0` | interface de bind |
| `MONGO_URI` | **sim** | `mongodb://…` ou `mongodb+srv://…` | — | string de conexão |
| `MONGO_DB_NAME` | **sim** | string não vazia, sem `/ \ . " $` | — | nome do banco |
| `LOG_LEVEL` | não | `fatal \| error \| warn \| info \| debug \| trace \| silent` | `info` | nível do logger (pino) |

Extras só para ferramentas locais (não lidas pela app, ficam no `.env.example` comentadas):

| Variável | Usada por | Default |
|---|---|---|
| `MONGO_PORT` | `docker-compose.yml` (porta publicada do container) | `27017` |

## `.env.example` (conteúdo alvo)

```dotenv
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=better_books
LOG_LEVEL=info

# docker-compose only
MONGO_PORT=27017
```
