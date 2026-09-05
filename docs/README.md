<!-- title: better-books API docs -->

# Documentação da API — better-books

Ponto de entrada único para quem vai construir o front-end que consome esta API. Consolida o que antes vivia espalhado, um pedaço por feature, em `specs/00N-*/contracts/`.

## Por onde começar

1. **[`openapi.yaml`](./openapi.yaml)** — contrato completo: os 43 endpoints, organizados por domínio de negócio, com request/response e todo código de erro possível. Fonte única da verdade para forma de dado.
2. **[`auth-guide.md`](./auth-guide.md)** — como obter, usar e renovar o access/refresh token. Leia antes de implementar qualquer chamada autenticada.
3. **[`pagination-guide.md`](./pagination-guide.md)** — como paginar qualquer lista por cursor.
4. **[`viewer-block.md`](./viewer-block.md)** — quais campos de resposta dependem de quem está autenticado (e quais **não** existem ainda, apesar de aparecerem em `product.md`).
5. **[`error-catalog.md`](./error-catalog.md)** — todo `code` de erro possível, o que significa e em quais endpoints aparece.

## Guias de fluxo (regra de negócio por trás de cada jornada)

- [`flows/auth-flow.md`](./flows/auth-flow.md) — cadastro, login, refresh, logout, troca de senha.
- [`flows/follow-flow.md`](./flows/follow-flow.md) — pedido de follow, aprovação/recusa, seguidores/seguindo.
- [`flows/reading-flow.md`](./flows/reading-flow.md) — buscar livro, want-to-read, reading session (iniciar/progresso/finalizar).
- [`flows/review-flow.md`](./flows/review-flow.md) — criar/editar/apagar review.
- [`flows/feed-flow.md`](./flows/feed-flow.md) — consumir o feed paginado.
- [`flows/interactions-flow.md`](./flows/interactions-flow.md) — comentar e curtir um item de feed.
- [`flows/notifications-flow.md`](./flows/notifications-flow.md) — notificações, contagem não lida, polling.

## Prototipagem de design

- [`design-prompt.md`](./design-prompt.md) — prompt pronto para colar no Claude Design e gerar o protótipo visual do app de ponta a ponta (as 9 áreas do MVP).

## Como este pacote foi construído

Toda informação aqui foi conferida contra o **código-fonte atual** (`src/`), não contra a intenção original de cada spec por feature — onde uma spec antiga (`specs/00N-*/`) e o código divergiam, o código venceu, e a divergência foi anotada explicitamente (ver notas de consolidação no topo de `openapi.yaml` e em `viewer-block.md`). Os contratos antigos por feature em `specs/00N-*/contracts/` continuam existindo como registro histórico, mas deixam de ser a referência — use sempre os arquivos desta pasta.
