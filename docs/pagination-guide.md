# Guia de paginação

Toda lista que cresce ou muda ao longo do tempo é paginada por **cursor opaco**, nunca por número de página/offset. Isso vale para: `GET /feed`, `GET /me/notifications`, `GET /me/followers`, `GET /me/following`, `GET /me/follow-requests`, `GET /me/reading-sessions`, `GET /me/want-to-read`, `GET /activities/{activityId}/comments`.

(`GET /books/search` e `GET /users/search` são a exceção — usam `page`/`limit` tradicionais, porque são buscas num catálogo externo/estático, não um feed que muda sob o pé do usuário.)

## Formato do cursor

O cursor é uma string opaca: **não tente decodificar, montar ou inspecionar seu conteúdo no cliente** — trate como um token. Internamente é `base64url` de `{"createdAt": "<ISO 8601>", "id": "<hex>"}`, mas isso é um detalhe de implementação que pode mudar sem aviso.

## Como pedir a próxima página

Toda resposta paginada por cursor tem a mesma forma:

```json
{ "items": [ /* ... */ ], "nextCursor": "eyJjcmVhdGVkQXQiOi..." }
```

1. Na primeira chamada, **não envie** o parâmetro `cursor` (ou envie vazio) — a API retorna a página mais recente.
2. Para a próxima página, chame o mesmo endpoint passando `?cursor=<nextCursor da resposta anterior>`.
3. Repita até `nextCursor` vir `null` — não há mais itens.

```
GET /feed?limit=20
→ { items: [...20 itens...], nextCursor: "abc..." }

GET /feed?cursor=abc...&limit=20
→ { items: [...20 itens...], nextCursor: "def..." }

GET /feed?cursor=def...&limit=20
→ { items: [...últimos itens...], nextCursor: null }   // fim da lista
```

## `limit`

- Parâmetro opcional, inteiro, padrão `20`, máximo `100` (a validação varia o teto conforme o endpoint — ver `docs/openapi.yaml` de cada um; a maioria usa 1–100).
- Fora do intervalo, ou não-numérico → `400 VALIDATION_ERROR`.

## Cursor malformado

Um `cursor` que não decodifica para o formato esperado (string arbitrária, cursor de outro endpoint, valor adulterado) responde `400 VALIDATION_ERROR` — o cliente nunca deve construir um cursor manualmente, só repassar o que a API devolveu em `nextCursor`.
