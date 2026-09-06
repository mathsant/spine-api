# Fluxo: catálogo de livros, want-to-read e reading session

Cobre desde encontrar um livro até registrar que foi lido. `ReadingSession` é uma **entidade própria** (decisão de produto P4): cada passada de um usuário por um livro é uma session independente, com seu próprio progresso, datas e (no máximo) uma review. Reler o mesmo livro cria uma **nova** session, sem afetar a anterior.

## Passo a passo

0. **Descobrir (estado inicial da busca, sem query)** — `GET /books/popular-among-following` (`listPopularAmongFollowing`) devolve até **20** livros mais populares entre quem você segue (follow aprovado), ranqueados por nº de seguidos distintos com qualquer reading session do livro. Exclui livros que você já tem session ou marcou como "quero ler". **Sem paginação** (não devolve `nextCursor`). Lista vazia se você não segue ninguém ou ninguém do círculo tem atividade.
1. **Buscar** — `GET /books/search?q=...` (`searchBooks`) consulta o Open Library. Resultado paginado por `page`/`limit` (não por cursor — é busca num catálogo externo).
2. **Abrir um livro** — `GET /books/{olid}` (`getBook`). Na primeira vez que alguém abre um `olid`, a API cacheia o livro localmente (cache-on-read) — chamadas seguintes são mais rápidas e não dependem do Open Library estar no ar. O livro traz `pageCount` (mediana de páginas do Open Library, `integer | null`): use como denominador de "% lido" / barra de progresso quando não for `null`.
3. **Marcar "quero ler"** (opcional, fora de uma reading session) — `PUT /books/{olid}/want-to-read` (`markWantToRead`) / `DELETE .../want-to-read` (`unmarkWantToRead`). Os dois são idempotentes. Ver a lista em `GET /me/want-to-read` (`listWantToRead`).
4. **Iniciar a leitura** — `POST /books/{olid}/start-reading` (`startReading`). Se já existir uma session `reading` aberta para esse livro, a mesma é reaproveitada (não duplica) — resposta `200` em vez de `201`. Remove o livro de want-to-read, se estava lá.
5. **Registrar progresso** (enquanto `reading`) — `POST /reading-sessions/{sessionId}/progress` (`updateReadingSessionProgress`) com `currentPage`. Sem teto — a API não valida contra o total de páginas do livro (o cliente pode, se tiver essa informação).
6. **Finalizar** — `POST /reading-sessions/{sessionId}/finish` (`finishReadingSession`). `finishedAt` é opcional (assume "agora" se omitido).
7. **Marcar como lido direto** (sem passar por `reading`) — `POST /books/{olid}/mark-finished` (`markFinished`), exige `finishedAt` (e opcionalmente `startedAt`). Cria uma session `finished` **nova**, mesmo que já exista outra session para o mesmo livro — permite releitura e registrar "li ano passado" sem simular um progresso que não aconteceu.
8. **Corrigir depois** — `PATCH /reading-sessions/{sessionId}` (`editReadingSession`) para ajustar datas/página; `DELETE /reading-sessions/{sessionId}` (`deleteReadingSession`) para apagar.
9. **Histórico** — `GET /me/reading-sessions` (`listReadingSessions`). Filtros opcionais: `bookId` (o **`id` interno** do Book — campo `id` de `BookDetail`, não o `olid`) e `status` (`reading` | `finished`; valor inválido → `400`). **Sem filtro de `status`**, a listagem vem com todas as sessions `reading` antes de todas as `finished` e, dentro de cada grupo, da mais recente para a mais antiga. Cada item embute um objeto `book` (`title`, `authors`, `coverUrl`, `pageCount`) — não é preciso chamar `GET /books/{olid}` por linha do histórico.

## Regras de negócio não óbvias

- **Sem fluxo linear obrigatório** (decisão de produto P10): não é preciso "iniciar" antes de "finalizar" — `mark-finished` cria a session `finished` direto. Um `progress` update **também** cria a session `reading` automaticamente se ainda não existir uma.
- **Toda resposta no formato `ReadingSession`** (de `startReading` a `listReadingSessions`) inclui um campo `review` (`null` até existir uma) — não é preciso outra chamada só para saber se a session já tem review.
- **Sem status "abandonado"** (`abandoned`) neste MVP (P7) — só `reading` e `finished` existem.
- **A API não diz se o usuário já marcou o livro como want-to-read ou já está lendo** dentro de `GET /books/{olid}` — ver `viewer-block.md`: é preciso cruzar com `GET /me/want-to-read` e `GET /me/reading-sessions?bookId=...` no cliente.
- **`updateProgress` só funciona em session `reading`** — chamar numa session já `finished` responde `409 INVALID_READING_SESSION_STATE`.
- **O `book` embutido só aparece em `GET /me/reading-sessions`** — as demais respostas no formato `ReadingSession` (`startReading`, `progress`, `finish`, `edit`, `mark-finished`) trazem só `bookId`.
- **O cursor de `GET /me/reading-sessions` mudou de formato nesta versão** e **não** é compatível com cursores emitidos antes — ver `pagination-guide.md`.
- **`pageCount` pode ser `null`** mesmo para livros reais: o Open Library nem sempre informa, e livros cacheados antes desta versão só passam a ter o valor após serem reabertos. O cliente deve tratar `null` (ex.: mostrar "p. X" sem denominador).

## Erros específicos deste fluxo

`BOOK_NOT_FOUND`, `OPEN_LIBRARY_UNAVAILABLE`, `READING_SESSION_NOT_FOUND`, `INVALID_READING_SESSION_STATE`, `INVALID_READING_SESSION_DATES` — detalhes em `error-catalog.md`.
