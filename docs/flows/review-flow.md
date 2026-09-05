# Fluxo: review

Uma review é a avaliação (nota + texto opcional + flag de spoiler) de **uma reading session finalizada** — não do livro em si. Uma session admite no máximo uma review.

## Passo a passo

1. **Criar** — `POST /reading-sessions/{sessionId}/review` (`createReview`) com `rating` (obrigatório) e opcionalmente `text`/`containsSpoiler`. Só funciona se a session for a **do próprio usuário** e estiver `finished`.
2. **Editar** — `PATCH /reviews/{reviewId}` (`editReview`), parcial (ao menos 1 campo).
3. **Apagar** — `DELETE /reviews/{reviewId}` (`deleteReview`).

A review aparece embutida em toda resposta de `ReadingSession` (campo `review`) e, quando publicada, também como um item de feed (`type: review_published`) — ver `feed-flow.md`.

## Regras de negócio não óbvias

- **Nota é estrela cheia, inteiro 1–5** (decisão de produto P5) — não existe meia-estrela.
- **Nota sem texto é permitida** — `text` é opcional em `createReview`; o campo pode vir `null`.
- **Uma session, no máximo uma review** — tentar criar uma segunda responde `409 REVIEW_ALREADY_EXISTS`. Para "reescrever", use `editReview`, não crie outra.
- **A session precisa estar `finished`** — criar review numa session `reading` responde `409 READING_SESSION_NOT_FINISHED`.
- **Spoiler é só uma flag** (decisão de produto P9): `containsSpoiler` é informativo — a API **sempre** retorna o `text` completo junto da flag, mesmo quando `true`. Ocultar/desfocar o texto na tela é responsabilidade inteira do cliente; a API nunca filtra o conteúdo com base em quem está vendo.
- **A "nota do usuário para o livro"**, se o front quiser mostrar isso num perfil ou no detalhe do livro, é a review da session `finished` mais recente daquele usuário para aquele livro — a API não expõe esse agregado por usuário diretamente; hoje só agrega nota média/contagens por livro (`BookDetail.aggregates`, agregando todos os usuários).

## Erros específicos deste fluxo

`READING_SESSION_NOT_FOUND`, `READING_SESSION_NOT_FINISHED`, `REVIEW_ALREADY_EXISTS`, `REVIEW_NOT_FOUND` — detalhes em `error-catalog.md`.
