# Contrato: cobertura do `docs/error-catalog.md`

## Critério de aceite (RF-010 a RF-012)

`docs/error-catalog.md` só é considerado completo quando:

1. Toda classe de erro em `src/errors/*.error.ts` (exceto o tipo base, `app-error.ts`) aparece na tabela do catálogo, com: `code`, HTTP status, nome da classe, endpoints onde pode ocorrer, e explicação de quando acontece.
2. O formato do envelope de erro (`{ error: { code, message, statusCode, details? } }`) está descrito uma única vez no topo do documento, junto das invariantes já estabelecidas nos catálogos por feature (`details` só em erro de validação; nenhum dado sensível vaza).
3. Nenhum `code` aparece duas vezes com significados diferentes (conflito entre features antigas deve ser resolvido e, se necessário, anotado).
4. Todo `code` referenciado em `docs/openapi.yaml` existe no catálogo, e vice-versa — os dois documentos não podem divergir entre si.

## Como verificar (ver `quickstart.md`)

Listar as classes de erro do código-fonte e cruzar manualmente contra as linhas da tabela do catálogo:

```bash
ls src/errors/*.error.ts
```
