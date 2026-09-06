# Quickstart — validação manual da feature `010-readingcontractgaps`

Pré-requisitos: MongoDB local rodando (ou `mongodb-memory-server` nos testes), `.env` configurado, `pnpm install` feito.

## 0. Migrations e build

```bash
pnpm migrate:up          # aplica a migration de índices (add-reading-contract-gaps-indexes)
pnpm typecheck
pnpm test                # toda a suíte verde (inclui os testes novos)
pnpm docs:lint           # redocly lint docs/openapi.yaml — sem erros
```

## 1. Semente de dados

Com dois usuários (A = solicitante, B = seguido por A com follow **aprovado**) e um terceiro C **não** seguido por A. Use os fluxos existentes (`/v1/auth/register`, follow request + approve) ou o script de seed de e2e.

1. A e B logam; A envia follow request para B; B aprova. A **não** segue C.
2. B abre o livro `OL45804W` (`POST /v1/books/OL45804W/start-reading`), registra progresso, finaliza, e cria review (`rating: 5`, `text: "..."`, `containsSpoiler: false`).
3. C faz o mesmo com `OL45804W` (session + review) — C não é seguido por A.
4. B abre e finaliza também `OL66554W` (com review) e `OL2657958W` (sem review).
5. A já tem uma reading session de `OL2657958W` (para testar exclusão em "populares").

## 2. `pageCount`

```bash
# Livro novo (cache miss) — deve vir com pageCount preenchido se o Open Library informar
curl -s -H "Authorization: Bearer $A_TOKEN" "$BASE/v1/books/OL45804W" | jq '{title, pageCount}'
# Busca — itens trazem pageCount
curl -s -H "Authorization: Bearer $A_TOKEN" "$BASE/v1/books/search?q=dune" | jq '.items[0] | {title, pageCount}'
```
Esperado: `pageCount` é inteiro ou `null` (nunca ausente). Um livro que já estava no cache antes desta versão vem `null` até ser reaberto.

## 3. `GET /books/{olid}/reviews`

```bash
curl -s -H "Authorization: Bearer $A_TOKEN" "$BASE/v1/books/OL45804W/reviews" | jq
```
Esperado:
- Contém a review de **B**, com `author.handle`, `author.displayName`, `author.avatarUrl: null`, `rating`, `text`, `containsSpoiler`, `createdAt`, `reviewId`.
- **Não** contém a review de **C** (A não segue C).
- **Não** contém a review de **A** (se A tiver uma para esse livro).
- `nextCursor: null` (poucos itens).
- `GET /v1/books/OL_INEXISTENTE_W/reviews` → `404 BOOK_NOT_FOUND`.
- Se B tiver relido `OL45804W` (2 sessions `finished` com review), a resposta traz **uma só** review de B — a da session finalizada mais recente.

## 4. `GET /books/popular-among-following`

```bash
curl -s -H "Authorization: Bearer $A_TOKEN" "$BASE/v1/books/popular-among-following" | jq
```
Esperado:
- `OL45804W` e `OL66554W` aparecem (B tem session dos dois); ordenados por nº de seguidos distintos.
- `OL2657958W` **não** aparece (A já tem session dele — exclusão de "já conhecido").
- Sessions de **C** não influenciam o ranking.
- No máximo 20 itens; resposta é `{ "items": [...] }` sem `nextCursor`.
- Itens no formato de resultado de busca, com `pageCount`.
- Se A não seguisse ninguém: `{ "items": [] }`.

## 5. `GET /me/reading-sessions` — `status` e ordenação

Logado como **B** (que tem sessions `reading` e `finished`):

```bash
curl -s -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/me/reading-sessions" | jq '.items[] | {status, createdAt, book: .book.title}'
```
Esperado: todos os itens `status: "reading"` vêm antes de qualquer `status: "finished"`; dentro de cada grupo, `createdAt` decrescente. Cada item tem `book` com `title`, `authors`, `coverUrl`, `pageCount`.

```bash
curl -s -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/me/reading-sessions?status=reading"  | jq '.items[].status'   # só "reading"
curl -s -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/me/reading-sessions?status=finished" | jq '.items[].status'   # só "finished"
curl -s -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/me/reading-sessions?status=xpto"     # 400 VALIDATION_ERROR
```

Paginação atravessando a fronteira (com `limit` pequeno):
```bash
FIRST=$(curl -s -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/me/reading-sessions?limit=2")
CURSOR=$(echo "$FIRST" | jq -r '.nextCursor')
curl -s -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/me/reading-sessions?limit=2&cursor=$CURSOR" | jq '.items[] | {status, createdAt}'
```
Esperado: nenhuma session repetida entre as páginas, nenhuma pulada; a ordem global (reading→finished, createdAt desc) se mantém.

Cursor antigo:
```bash
OLD=$(node -e "console.log(Buffer.from(JSON.stringify({createdAt:new Date().toISOString(), id:'000000000000000000000000'})).toString('base64url'))")
curl -s -H "Authorization: Bearer $B_TOKEN" "$BASE/v1/me/reading-sessions?cursor=$OLD"   # 400 — formato de cursor mudou
```

## 6. Não-regressão do `book` embutido

```bash
# As respostas abaixo NÃO devem ter o campo "book":
curl -s -H "Authorization: Bearer $B_TOKEN" -X POST "$BASE/v1/books/OL45804W/start-reading"        | jq 'has("book")'   # false
curl -s -H "Authorization: Bearer $B_TOKEN" -X POST "$BASE/v1/reading-sessions/$SID/progress" -d '{"currentPage":10}' -H 'Content-Type: application/json' | jq 'has("book")'   # false
```

## 7. Fechamento

- [ ] `pnpm test` verde.
- [ ] `pnpm docs:lint` sem erro.
- [ ] Todos os passos 2–6 batem com o esperado.
- [ ] Nomes finais de rota/schema comunicados à sessão `spine-frontend`.
