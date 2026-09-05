# Contrato: cobertura do `docs/openapi.yaml`

## Critério de aceite (RF-001 a RF-004)

`docs/openapi.yaml` só é considerado completo quando **todas** as condições abaixo forem verdadeiras:

1. `npx redocly lint docs/openapi.yaml` termina sem erro (avisos podem ser aceitos caso a caso, mas devem ser justificados no PR — não silenciados).
2. Para cada um dos 12 arquivos `src/controllers/<domain>/<domain>.routes.ts`, todo método+path registrado nele aparece em `docs/openapi.yaml` com o mesmo path e método. Lista de referência (contagem por domínio, extraída em `research.md`):

   | Domínio | Rotas |
   |---|---|
   | `auth` | 6 |
   | `books` | 7 |
   | `comments` | 3 |
   | `feed` | 1 |
   | `follows` | 9 |
   | `health` | 1 |
   | `notifications` | 4 |
   | `profile` | 1 |
   | `reactions` | 2 |
   | `reading-sessions` | 5 |
   | `reviews` | 3 |
   | `users` | 1 |
   | **Total** | **43** |

3. Cada endpoint documentado tem: `operationId`, `tags` (domínio de negócio, não número de feature), `security` quando protegido, request/response com exemplo, e todo `code` de erro possível referenciado por `$ref` ou nome idêntico ao `error-catalog.md`.
4. Nenhum endpoint está documentado com um comportamento (campo, status, regra) que contradiz o código atual em `src/` — qualquer divergência encontrada em relação a um `*.openapi.yaml` antigo é corrigida a favor do código, e citada como nota de migração no `docs/openapi.yaml` ou no PR desta feature (RF-002, RF-020).

## Como verificar (ver `quickstart.md` para o passo a passo completo)

```bash
npx redocly lint docs/openapi.yaml
```

E uma conferência manual (ou script ad hoc de uma linha) contando `paths.*` no YAML contra a soma de rotas acima.
