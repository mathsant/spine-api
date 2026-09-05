# Fluxo: feed

O feed é a lista de atividade — do próprio usuário e de quem ele segue com follow aprovado — ordenada do mais recente para o mais antigo. É o "log append-only" da rede social: cada linha é um evento (`started_reading`, `finished_reading`, `review_published`, `progress_update`), nunca editado, só criado.

## Passo a passo

1. **Buscar a página mais recente** — `GET /feed` (`getFeed`), sem `cursor`.
2. **Paginar** — usar `nextCursor` da resposta anterior; ver `pagination-guide.md` para o mecanismo genérico de cursor.
3. **Reagir/comentar em um item** — usar o `id` do item de feed como `activityId` nos endpoints de `interactions-flow.md`.

## Regras de negócio não óbvias

- **Só aparece atividade de quem segue e foi aprovado** (mais o próprio usuário) — perfil privado por padrão (P6) se aplica também ao feed: seguir sem aprovação não traz nada dessa pessoa para o feed.
- **Calculado na hora (fan-out on read)** neste MVP — não é uma coleção pré-materializada por usuário; isso é um detalhe de implementação, mas explica por que não existe (ainda) um jeito de "assinar" atualizações em tempo real além de repetir a consulta.
- **`progress_update`**: `currentPage` só vem preenchido quando `type === 'progress_update'` — nos outros tipos vem `null`.
- **`review_published`**: `review` só vem preenchido (com o estado **atual**, ao vivo) quando `type === 'review_published'` — se a review for editada depois, o item de feed antigo mostra a versão atual, não a de quando foi publicada.
- **`reactionsCount`/`hasReacted`** vêm em todo item, não só nos que aceitam reação — ver a ressalva de `interactions-flow.md` sobre `started_reading` não aceitar curtida/comentário mesmo assim aparecendo no feed com `reactionsCount: 0`.
- **Feed pode vir vazio** (`items: []`, `nextCursor: null`) — é um estado normal (usuário novo, ou não segue ninguém ainda), não um erro.

## Erros específicos deste fluxo

Só os genéricos: `VALIDATION_ERROR` (cursor malformado ou `limit` fora do intervalo), `UNAUTHENTICATED`/`INVALID_ACCESS_TOKEN` — detalhes em `error-catalog.md`.
