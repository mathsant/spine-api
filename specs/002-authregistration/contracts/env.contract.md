# Contrato de ambiente — Autenticação e Cadastro

Estende o contrato da 001 (`NODE_ENV`, `PORT`, `HOST`, `MONGO_URI`, `MONGO_DB_NAME`,
`LOG_LEVEL`). `AppConfig` continua sendo a **única** porta para `process.env` (RF-012 da
001); nenhum módulo novo lê `process.env` direto. Validação por `zod` em
`src/config/env.schema.ts`, fail-fast na inicialização.

| Variável | Obrigatória | Default | Regra zod | Uso |
|---|---|---|---|---|
| `ACCESS_TOKEN_SECRET` | **sim** | — | `z.string().min(32)` | segredo HS256 para assinar/verificar o access token |
| `AUTH_RATE_LIMIT_MAX` | não | `10` | `z.coerce.number().int().min(1)` | máx. de requisições por janela em `/v1/auth/login` e `/v1/auth/signup` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | não | `900000` | `z.coerce.number().int().min(1000)` | tamanho da janela do rate limit, em ms (default 15 min) |

Campos derivados no `AppConfig` (camelCase): `accessTokenSecret`, `authRateLimitMax`,
`authRateLimitWindowMs`.

**Não** viram env (fixados pela spec, constantes de código):

| Constante | Valor | Onde | Spec |
|---|---|---|---|
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | `src/auth/access-token.ts` | RF-017 |
| `REFRESH_INACTIVITY_DAYS` | `30` | `src/auth/refresh-token.ts` | RF-025 |

## `.env.example` — linhas adicionadas

```dotenv
# auth (002-authregistration)
ACCESS_TOKEN_SECRET=dev-only-change-me-please-32-chars-min
AUTH_RATE_LIMIT_MAX=10
AUTH_RATE_LIMIT_WINDOW_MS=900000
```

> `ACCESS_TOKEN_SECRET` não tem default no schema de propósito: em qualquer ambiente sem o
> segredo o processo não sobe (mesmo fail-fast das variáveis do Mongo na 001). O valor no
> `.env.example` é só para o dev local.
