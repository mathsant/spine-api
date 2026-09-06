# Fluxo: review

Uma review é a avaliação (nota + texto opcional + flag de spoiler) de **uma reading session finalizada** — não do livro em si. Uma session admite no máximo uma review.

## Passo a passo

1. **Criar** — `POST /reading-sessions/{sessionId}/review` (`createReview`) com `rating` (obrigatório) e opcionalmente `text`/`containsSpoiler`. Só funciona se a session for a **do próprio usuário** e estiver `finished`.
2. **Editar** — `PATCH /reviews/{reviewId}` (`editReview`), parcial (ao menos 1 campo).
3. **Apagar** — `DELETE /reviews/{reviewId}` (`deleteReview`).

A review aparece embutida em toda resposta de `ReadingSession` (campo `review`) e, quando publicada, também como um item de feed (`type: review_published`) — ver `feed-flow.md`.

## Reviews de um livro por quem eu sigo

`GET /books/{olid}/reviews` (`listBookReviewsByFollowing`) — lista paginada por **cursor** das reviews de um livro feitas por usuários que **eu sigo com follow aprovado** (respeita a privacidade P6). Para a tela de detalhe do livro ("o que meu círculo achou").

- **No máximo uma review por seguidor**: a da reading session `finished` mais recente daquele seguidor para aquele livro (mesma regra da "nota do usuário para o livro").
- **Não inclui a minha própria review** — para essa, use `GET /me/reading-sessions?bookId=...`.
- Cada item: `reviewId`, `author` (`userId`, `handle`, `displayName`, `avatarUrl`), `rating`, `text`, `containsSpoiler`, `createdAt`. Ordenado por `createdAt` da review, mais recente primeiro.
- **`author.avatarUrl` vem sempre `null`** nesta versão — upload de avatar ainda não existe na API. O cliente deve usar inicial do nome / placeholder, nunca imagem.
- `404 BOOK_NOT_FOUND` se o `olid` não existe nem no cache nem no Open Library. Página vazia (`items: []`, `nextCursor: null`) se o livro existe mas ninguém que eu sigo tem review `finished` dele.

## Regras de negócio não óbvias

- **Nota é estrela cheia, inteiro 1–5** (decisão de produto P5) — não existe meia-estrela.
- **Nota sem texto é permitida** — `text` é opcional em `createReview`; o campo pode vir `null`.
- **Uma session, no máximo uma review** — tentar criar uma segunda responde `409 REVIEW_ALREADY_EXISTS`. Para "reescrever", use `editReview`, não crie outra.
- **A session precisa estar `finished`** — criar review numa session `reading` responde `409 READING_SESSION_NOT_FINISHED`.
- **Spoiler é só uma flag** (decisão de produto P9): `containsSpoiler` é informativo — a API **sempre** retorna o `text` completo junto da flag, mesmo quando `true`. Ocultar/desfocar o texto na tela é responsabilidade inteira do cliente; a API nunca filtra o conteúdo com base em quem está vendo.
- **A "nota do usuário para o livro"**, se o front quiser mostrar isso num perfil ou no detalhe do livro, é a review da session `finished` mais recente daquele usuário para aquele livro — a API não expõe esse agregado por usuário diretamente; hoje só agrega nota média/contagens por livro (`BookDetail.aggregates`, agregando todos os usuários).

## Erros específicos deste fluxo

`READING_SESSION_NOT_FOUND`, `READING_SESSION_NOT_FINISHED`, `REVIEW_ALREADY_EXISTS`, `REVIEW_NOT_FOUND` — detalhes em `error-catalog.md`. Em `GET /books/{olid}/reviews`: `BOOK_NOT_FOUND`, `OPEN_LIBRARY_UNAVAILABLE`.
