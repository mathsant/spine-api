# Campos relativos ao espectador ("viewer")

> **Nota de consolidação (RF-020 — divergência entre `product.md` e o código atual).**
> `product.md` (seção "Implicações para a API") descreve um bloco genérico `viewer` em
> todo DTO de leitura, com campos como `isFollowing`, `followState`, `hasReacted` e
> `myReadingStatus`. **Isso nunca foi implementado dessa forma.** O código hoje não tem
> nenhum objeto aninhado `viewer` em nenhum DTO. O único campo relativo ao espectador que
> existe de fato é `hasReacted` (+ `reactionsCount`), como campos **soltos** em
> `FeedItemDTO` (`src/services/feed/types.ts`). Este documento descreve o que existe de
> verdade — não o que o `product.md` havia planejado.

## O que existe hoje

| Recurso | Campo | Tipo | Significado |
|---|---|---|---|
| Item de feed (`FeedItem`, em `GET /feed`) | `hasReacted` | `boolean` | Se o usuário autenticado (quem fez a chamada) já curtiu este item. |
| Item de feed (`FeedItem`, em `GET /feed`) | `reactionsCount` | `integer` | Contagem **total** de curtidas do item (de todos os usuários que podem vê-lo), não só do espectador. |

Nenhum outro recurso da API (`User`, `Book`, `ReadingSession`, `Review`, `Comment`, `Notification`) carrega hoje um campo relativo a "o que o espectador vê/fez" — nem sob um nome `viewer`, nem como campo solto.

## Implicações práticas para o front-end

- **Follow**: não existe um campo `isFollowing` em `UserSearchResult` nem em nenhum outro DTO de usuário. Para saber se o usuário autenticado já segue (ou pediu para seguir) outro usuário, o cliente precisa cruzar o resultado de `GET /me/following` e/ou `GET /me/follow-requests` (`direction: outgoing`) com a lista que está exibindo — a API não faz esse cruzamento para você.
- **Status de leitura de um livro** (`myReadingStatus`): `GET /books/{olid}` (`BookDetail`) não informa se o usuário autenticado já marcou aquele livro como `want_to_read` ou já tem uma reading session para ele. O cliente precisa cruzar com `GET /me/want-to-read` e `GET /me/reading-sessions?bookId=...`.
- **Curtida** (`hasReacted`): é o único caso já resolvido pela própria API — `GET /feed` já devolve, por item, se o espectador curtiu ou não. Não é necessário cruzar com nenhuma outra chamada para isso.

Se um bloco `viewer` genérico (com `isFollowing`, `myReadingStatus` etc.) vier a ser implementado no futuro, ele deve ganhar sua própria feature/spec — este documento deve ser atualizado nesse momento para refletir o novo comportamento real.
