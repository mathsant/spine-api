# Quickstart — validar a feature 009 manualmente

Esta feature não sobe servidor nem banco — a validação é sobre os arquivos de `docs/`.

## 1. Instalar a ferramenta de lint do OpenAPI

```bash
npm install --save-dev @redocly/cli
```

Confirme que o script `docs:lint` foi adicionado ao `package.json`:

```json
"scripts": {
  "docs:lint": "redocly lint docs/openapi.yaml"
}
```

## 2. Validar o OpenAPI unificado

```bash
npm run docs:lint
```

Critério de sucesso: sai sem erro (ver `contracts/openapi-coverage.contract.md`).

## 3. Conferir cobertura de endpoints (100% dos 43)

```bash
# conta as rotas reais no código
grep -rEc "\.(get|post|put|patch|delete)\(" src/controllers/**/*.routes.ts

# conta os métodos documentados no OpenAPI (aproximado — cada path pode ter mais de um método)
grep -E "^\s+(get|post|put|patch|delete):" docs/openapi.yaml | wc -l
```

Os dois números devem bater (43). Qualquer divergência precisa ser resolvida antes de seguir (endpoint no código sem doc, ou doc de endpoint que não existe mais).

## 4. Conferir cobertura do catálogo de erros

```bash
ls src/errors/*.error.ts
```

Cada classe listada (exceto `app-error.ts`) deve ter uma linha correspondente em `docs/error-catalog.md`, com o mesmo `code` usado em `docs/openapi.yaml`.

## 5. Ler os guias de fluxo como se fosse alguém de fora do projeto

Abrir cada arquivo em `docs/flows/*.md` e checar, para cada um, se dá pra seguir o fluxo ponta a ponta (quais chamadas fazer, em que ordem, o que esperar) sem abrir `product.md` nem o código-fonte.

## 6. Apresentar o `docs/design-prompt.md` para aprovação

Este passo é manual e obrigatório (RF-019): o texto final do prompt deve ser mostrado ao usuário nesta feature, e só é considerado pronto após aprovação explícita — não basta o arquivo existir.

## 7. Checklist final de divergência (RF-020)

Ao terminar os passos acima, listar (no PR ou na conversa) qualquer ponto em que a documentação nova corrigiu algo que uma spec antiga (`specs/00N/`) descrevia de forma diferente do código atual. Não deixar isso implícito.
