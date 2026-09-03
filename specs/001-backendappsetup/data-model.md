# Fase 1 — Modelo de Dados: Backend App Setup

Feature: `001-backendappsetup` · Data: 2026-09-03

Esta feature **não persiste dados** (a infra de migrations é entregue vazia). As "entidades"
aqui são objetos de valor em memória e a hierarquia de erros. Todos os identificadores em
inglês (regra fixa do kit).

---

## AppConfig

Configuração validada da aplicação, derivada das variáveis de ambiente. Criada **uma vez** na
inicialização; se a validação falhar, o processo aborta (fail-fast — RF-010).

| Campo | Tipo | Origem (env) | Obrigatório | Default | Regra |
|---|---|---|---|---|---|
| `nodeEnv` | `'development' \| 'test' \| 'production'` | `NODE_ENV` | não | `'development'` | enum |
| `port` | `number` (int) | `PORT` | não | `3000` | `1..65535`, coerção de string |
| `host` | `string` | `HOST` | não | `'0.0.0.0'` | não vazio |
| `mongoUri` | `string` | `MONGO_URI` | **sim** | — | começa com `mongodb://` ou `mongodb+srv://` |
| `mongoDbName` | `string` | `MONGO_DB_NAME` | **sim** | — | não vazio, sem `/ \ . " $` |
| `logLevel` | `'fatal' \| 'error' \| 'warn' \| 'info' \| 'debug' \| 'trace' \| 'silent'` | `LOG_LEVEL` | não | `'info'` | enum |

- Validado por um schema `zod` (`src/config/env.schema.ts`); o valor exportado é
  `type AppConfig = z.infer<typeof envSchema>`.
- Nenhum outro módulo lê `process.env` — todos recebem `config` via Awilix (RF-012).
- Erro de validação → mensagem listando cada campo inválido e o motivo; `process.exit(1)`.

---

## HealthStatus

Resultado do health-check. Objeto de valor, montado a cada requisição a `GET /health`. Não
persistido.

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | `'ok' \| 'degraded'` | `ok` sse todas as dependências estão de pé; senão `degraded` |
| `db` | `'up' \| 'down'` | resultado do `ping` ao MongoDB |
| `uptime` | `number` | segundos inteiros desde o start do processo (`process.uptime()` truncado) |

Regra de composição (no `health` service):
- `db = 'up'` ⇒ `status = 'ok'` ⇒ HTTP `200`.
- `db = 'down'` ⇒ `status = 'degraded'` ⇒ HTTP `503`.
- O processo nunca cai por conta de `db = 'down'`.

---

## Hierarquia de erros

### AppError (tipo base)

`src/errors/app-error.ts` — classe abstrata que estende `Error`.

| Campo | Tipo | Descrição |
|---|---|---|
| `code` | `string` | identificador estável em `SCREAMING_SNAKE_CASE` |
| `message` | `string` | texto legível (não exibido ao cliente em erro `500`) |
| `statusCode` | `number` | status HTTP que o error handler deve usar |
| `details` | `unknown \| undefined` | contexto estruturado opcional (usado na validação) |
| `isOperational` | `boolean` (`true`) | marca erro esperado vs. bug |

Todos os erros de domínio **estendem** `AppError`. O error handler global mapeia
`instanceof AppError` → resposta; qualquer outro erro → `500` genérico (RF-025/027).

### Subtipos entregues nesta feature

| Classe | `code` | `statusCode` | Quando |
|---|---|---|---|
| `ValidationError` | `VALIDATION_ERROR` | `400` | corpo/params/query reprovados por schema `zod`; `details` = issues achatadas do `ZodError` |
| `NotFoundError` | `NOT_FOUND` | `404` | recurso inexistente (base para as próximas features; não usada pelo `health`) |
| `DatabaseUnavailableError` | `DATABASE_UNAVAILABLE` | `503` | repository não conseguiu falar com o Mongo; **capturado** dentro do `health` repo e traduzido em `db: 'down'`, não propagado à borda |

> `DatabaseUnavailableError` existe como tipo de domínio (P5) para o repository converter a
> exceção crua do driver. No caminho do health-check ela é tratada internamente; em features
> futuras que **exijam** o banco, ela sobe até o error handler e vira `503`.

> **`INTERNAL_ERROR` não tem classe.** É apenas o `code` literal do corpo genérico que o
> error handler devolve para qualquer erro **não** `instanceof AppError`. Não faz parte da
> hierarquia — a hierarquia cobre só erros esperados/operacionais.

### Formato da resposta de erro (contrato de saída)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body is invalid",
    "statusCode": 400,
    "details": [{ "path": "title", "message": "Required" }]
  }
}
```

- `details` presente **apenas** quando o erro carrega contexto (hoje: `ValidationError`).
- Erro não tratado → `{ "error": { "code": "INTERNAL_ERROR", "message": "Internal Server Error", "statusCode": 500 } }`, sem stack, sem mensagem interna, sem detalhe do driver.

Schema completo em `contracts/error-response.schema.json`.
