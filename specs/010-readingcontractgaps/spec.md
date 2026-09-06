# Especificação de Feature: Lacunas de contrato de leitura/descoberta para o front-end

**Branch**: `010-readingcontractgaps`
**Criado em**: 2026-09-05
**Status**: Rascunho
**Entrada**: descrição original do usuário: "Lacunas de contrato do backend descobertas pela feature de frontend 002-reading-books. Adicionar ao backend: (1) campo pageCount no Book cacheado a partir do Open Library; (2) endpoint de reviews de um livro por quem o solicitante segue; (3) endpoint de livros populares entre quem o solicitante segue; (4) filtro status + nova ordenação em GET /me/reading-sessions; (5) embutir um resumo do livro na listagem de reading-sessions."

## Contexto

A feature de front-end `002-reading-books` (outro repositório) descobriu, ao desenhar as telas de Busca de Livros, Detalhe do Livro e Histórico de Leitura, que o contrato atual da API (`docs/openapi.yaml`) não expõe alguns dados de que as telas dependem. Esta feature fecha essas lacunas **no backend** e atualiza a documentação. Ela se ancora no `.specify/memory/product.md` — em especial P2 (catálogo = Open Library + cache), P4 (ReadingSession como entidade própria), P6 (perfil privado; todo endpoint de leitura filtra pelo espectador) e P13 (follow assimétrico com aprovação).

Nenhuma mudança em autenticação, no fluxo de aprovação de follow ou no modelo de `Review`. Nenhuma entidade nova, nenhuma coleção nova, nenhuma migration.

## Cenários de Usuário & Testes *(obrigatório)*

### História principal

Uma pessoa usando o app web quer descobrir o que o seu círculo (quem ela segue e teve o follow aprovado) está lendo e o que achou dos livros, e quer revisitar o próprio histórico de leitura de forma organizada. Para isso as telas precisam de: o total de páginas de um livro (para barra de progresso e "% lido"), a lista de reviews de um livro feitas por quem ela segue, uma lista de livros populares no seu círculo como ponto de partida da busca, e um histórico próprio que possa ser filtrado por status ("lendo" / "lido") e venha já ordenado com o que está em andamento no topo — sem que o cliente precise fazer uma chamada extra por linha para descobrir título e capa.

### Cenários de aceitação

**pageCount no livro**

1. **Dado** um livro no Open Library cujo `number_of_pages_median` é 320, **quando** o solicitante busca esse livro (`GET /books/search`) ou abre o detalhe dele (`GET /books/{olid}`) e o livro ainda não estava no cache, **então** a resposta inclui `pageCount: 320` e o livro é cacheado com esse valor.
2. **Dado** um livro cujo Open Library não informa número de páginas, **quando** o solicitante abre o detalhe dele, **então** a resposta inclui `pageCount: null`.
3. **Dado** um livro que já estava no cache local antes desta feature (portanto sem `pageCount`), **quando** o solicitante abre o detalhe dele e o livro é re-resolvido do Open Library, **então** `pageCount` passa a vir preenchido; **enquanto** não for re-resolvido, `pageCount` vem `null`.

**Reviews de um livro por quem eu sigo**

4. **Dado** que sigo (follow aprovado) Ana e Bruno, e ambos têm uma reading session `finished` com review para o livro X, **quando** chamo `GET /books/{olid}/reviews` para o livro X, **então** recebo uma página com a review de Ana e a review de Bruno, cada uma com autor (`displayName`, `handle`, `avatar`), `rating`, `text`, `containsSpoiler` e `createdAt`, ordenadas da mais recente para a mais antiga.
5. **Dado** que sigo Ana, e Ana leu o livro X duas vezes (duas sessions `finished`, cada uma com review), **quando** chamo `GET /books/{olid}/reviews`, **então** recebo **uma única** review de Ana: a da session `finished` mais recente dela para o livro X.
6. **Dado** que eu mesmo tenho uma review para o livro X, **quando** chamo `GET /books/{olid}/reviews`, **então** a minha review **não** aparece na lista.
7. **Dado** que não sigo ninguém, ou nenhum de quem sigo tem review `finished` para o livro X, **quando** chamo `GET /books/{olid}/reviews`, **então** recebo uma página vazia (`items: []`, `nextCursor: null`).
8. **Dado** um usuário Carlos que tem review para o livro X mas que eu **não** sigo (ou cujo follow ainda está pendente), **quando** chamo `GET /books/{olid}/reviews`, **então** a review de Carlos **não** aparece.
9. **Dado** que quem sigo tem mais reviews do livro X do que cabe em uma página, **quando** pagino com o `cursor` retornado, **então** recebo o restante sem repetição e sem buraco.
10. **Dado** um `olid` que não corresponde a nenhum livro (nem no cache nem no Open Library), **quando** chamo `GET /books/{olid}/reviews`, **então** recebo o mesmo erro `404` que `GET /books/{olid}` retorna nesse caso.

**Populares entre quem eu sigo**

11. **Dado** que sigo Ana, Bruno e Dora, e o livro Y tem reading session de Ana e de Bruno enquanto o livro Z só tem de Dora, **quando** chamo `GET /books/popular-among-following`, **então** recebo uma lista ordenada por número de leitores distintos entre quem sigo, com Y antes de Z, cada item no formato de resultado de busca de livro (incluindo `pageCount`).
12. **Dado** que já tenho reading session ou marquei "quero ler" para o livro Y, **quando** chamo `GET /books/popular-among-following`, **então** o livro Y **não** aparece na lista (é uma superfície de descoberta).
13. **Dado** que quem sigo interagiu com mais de 20 livros que eu ainda não conheço, **quando** chamo `GET /books/popular-among-following`, **então** recebo no máximo 20 livros e a resposta não traz cursor de paginação.
14. **Dado** que não sigo ninguém, ou quem sigo não tem nenhuma reading session, ou todos os livros populares eu já conheço, **quando** chamo `GET /books/popular-among-following`, **então** recebo uma lista vazia.
15. **Dado** um usuário que eu não sigo, **quando** ele tem várias reading sessions de um livro, **então** essas sessions **não** contam para o ranking.

**Histórico com filtro e ordenação**

16. **Dado** que tenho sessions `reading` e `finished` misturadas, **quando** chamo `GET /me/reading-sessions` sem `status`, **então** recebo primeiro todas as `reading` e depois as `finished`, e dentro de cada grupo da mais recente (`createdAt`) para a mais antiga.
17. **Dado** o mesmo histórico, **quando** chamo `GET /me/reading-sessions?status=reading`, **então** recebo só as sessions `reading`, ordenadas por `createdAt` desc.
18. **Dado** o mesmo histórico, **quando** chamo `GET /me/reading-sessions?status=finished`, **então** recebo só as sessions `finished`, ordenadas por `createdAt` desc.
19. **Dado** que tenho mais sessions do que cabe em uma página e as duas categorias aparecem na listagem sem filtro, **quando** pagino com o `cursor` retornado atravessando a fronteira entre `reading` e `finished`, **então** não perco nem repito nenhuma session.
20. **Dado** um valor de `status` fora de `reading` | `finished`, **quando** chamo o endpoint, **então** recebo erro de validação `400`.
21. **Dado** que passo `bookId` e `status` juntos, **quando** chamo o endpoint, **então** os dois filtros se aplicam em conjunto.

**Resumo do livro embutido na listagem**

22. **Dado** que tenho reading sessions no histórico, **quando** chamo `GET /me/reading-sessions`, **então** cada item traz um objeto `book` com `title`, `authors`, `coverUrl` e `pageCount`, além do `bookId` que já existia.
23. **Dado** que chamo `POST /books/{olid}/start-reading`, `POST /reading-sessions/{id}/progress`, `POST /reading-sessions/{id}/finish`, `PATCH /reading-sessions/{id}` ou `POST /books/{olid}/mark-finished`, **então** a resposta continua **sem** o objeto `book` embutido (só `bookId`) — o embutido é exclusivo da listagem.

### Casos de borda

- **Livro sem páginas no Open Library**: `pageCount` é `null` em todas as superfícies; o cliente é quem decide exibir "p. X" sem denominador ou percentual.
- **Review de session `reading` (não `finished`)**: não entra em `GET /books/{olid}/reviews` — a regra é "review da session `finished` mais recente de cada seguidor". Se um seguidor só tem review em session `reading`, ele não aparece.
- **Empate no ranking de populares**: livros com o mesmo número de leitores distintos entre seguidos são desempatados pela atividade mais recente de um seguido com aquele livro (mais recente primeiro) e, persistindo o empate, por `title` ascendente.
- **Autor de review depois deixou de ser seguido / follow foi desfeito**: a review some da lista na próxima chamada (a filtragem é sempre relativa ao estado atual de follows aprovados).
- **`GET /me/reading-sessions` sem nenhuma session**: página vazia, sem erro.
- **`nextCursor` do histórico**: continua sendo `null` na última página; o formato do cursor muda para carregar a nova chave de ordenação e **não** é compatível com cursores emitidos pela versão anterior do endpoint.

## Requisitos *(obrigatório)*

### Requisitos funcionais

**pageCount**

- **RF-001**: O sistema DEVE registrar, para cada `Book` cacheado, um atributo `pageCount` inteiro e anulável, obtido do campo de mediana de número de páginas do Open Library no momento em que o livro é resolvido do Open Library.
- **RF-002**: O sistema DEVE incluir `pageCount` em toda representação de livro devolvida por `GET /books/search`, `GET /books/{olid}`, `GET /books/popular-among-following` e no objeto `book` embutido em `GET /me/reading-sessions`.
- **RF-003**: O sistema DEVE definir `pageCount` como `null` quando o Open Library não informar número de páginas para o livro.
- **RF-004**: O sistema NÃO DEVE executar migração de dados para livros já cacheados; `pageCount` desses livros permanece `null` até o livro ser re-resolvido do Open Library, quando então passa a ser preenchido (comportamento "lazy").
- **RF-005**: O sistema NÃO DEVE validar o progresso de leitura (`currentPage`) contra `pageCount` — segue valendo a regra atual de não haver limite superior no progresso.

**GET /books/{olid}/reviews**

- **RF-006**: O sistema DEVE expor `GET /books/{olid}/reviews`, autenticado, que devolve uma lista paginada por cursor das reviews do livro identificado por `olid` feitas por usuários que o solicitante segue com follow **aprovado**.
- **RF-007**: O sistema DEVE incluir, para cada seguidor com review do livro, **no máximo uma** review: a review vinculada à reading session `finished` mais recente daquele seguidor para aquele livro.
- **RF-008**: O sistema NÃO DEVE incluir a review do próprio solicitante nessa lista.
- **RF-009**: O sistema NÃO DEVE incluir reviews de usuários que o solicitante não segue ou cujo follow esteja pendente/recusado (P6).
- **RF-010**: Cada item da lista DEVE conter: dados do autor (`displayName`, `handle`, `avatar`), `rating`, `text`, `containsSpoiler` e `createdAt` da review.
- **RF-011**: O sistema DEVE ordenar a lista por `createdAt` da review, da mais recente para a mais antiga, e paginar por cursor de forma estável (sem repetição nem omissão ao paginar).
- **RF-012**: O sistema DEVE responder `404` quando o `olid` não corresponder a nenhum livro conhecido (mesmo comportamento de `GET /books/{olid}`), e uma página vazia quando o livro existe mas nenhum seguidor aprovado tem review `finished` dele.

**GET /books/popular-among-following**

- **RF-013**: O sistema DEVE expor `GET /books/popular-among-following`, autenticado, que devolve os livros mais populares entre os usuários que o solicitante segue com follow **aprovado**, para servir de estado inicial da busca de livros (sem query).
- **RF-014**: O sistema DEVE classificar os livros por número de usuários **distintos**, dentre os seguidos aprovados, que possuem **qualquer** reading session (`reading` ou `finished`) do livro — sem recorte temporal (all-time).
- **RF-015**: O sistema DEVE desempatar por atividade mais recente de um seguido com o livro (mais recente primeiro) e, persistindo o empate, por `title` ascendente.
- **RF-016**: O sistema DEVE excluir da lista os livros para os quais o solicitante já possui reading session ou marcação "quero ler".
- **RF-017**: O sistema DEVE limitar a resposta a no máximo 20 livros e NÃO DEVE oferecer paginação (sem cursor).
- **RF-018**: Cada item DEVE ter o mesmo formato de um resultado de busca de livro, incluindo `pageCount`.
- **RF-019**: O sistema DEVE devolver lista vazia quando o solicitante não segue ninguém, quando nenhum seguido tem reading session, ou quando todos os livros populares já são conhecidos pelo solicitante.
- **RF-020**: O sistema NÃO DEVE contar, no ranking, reading sessions de usuários que o solicitante não segue com aprovação.

**GET /me/reading-sessions — filtro e ordenação**

- **RF-021**: O sistema DEVE aceitar um parâmetro de query opcional `status` em `GET /me/reading-sessions`, com valores `reading` ou `finished`, filtrando as sessions no servidor.
- **RF-022**: O sistema DEVE responder `400` (erro de validação) quando `status` vier com valor fora de `reading` | `finished`.
- **RF-023**: O sistema DEVE, na listagem **sem** filtro de `status`, ordenar as sessions com todas as `reading` antes de todas as `finished` e, dentro de cada grupo, por `createdAt` decrescente.
- **RF-024**: O sistema DEVE, na listagem **com** `status=reading` ou `status=finished`, ordenar por `createdAt` decrescente dentro do grupo filtrado.
- **RF-025**: O sistema DEVE manter a paginação por cursor estável sob a nova ordenação, inclusive ao atravessar a fronteira entre sessions `reading` e `finished` (sem repetição nem omissão).
- **RF-026**: O sistema DEVE aplicar `status` e `bookId` em conjunto quando ambos forem informados.
- **RF-027**: A mudança de formato do cursor DEVE ser tratada como incompatível com cursores emitidos pela versão anterior do endpoint (documentar a quebra; não há garantia de continuidade de cursores em trânsito).

**GET /me/reading-sessions — resumo do livro embutido**

- **RF-028**: O sistema DEVE incluir, em cada item de `GET /me/reading-sessions`, um objeto `book` com `title`, `authors`, `coverUrl` e `pageCount`, além do `bookId` já existente.
- **RF-029**: O sistema NÃO DEVE incluir o objeto `book` embutido nas demais respostas que devolvem uma reading session (`start-reading`, `progress`, `finish`, `edit`, `mark-finished`) — elas continuam com `bookId` apenas.
- **RF-030**: O objeto `book` embutido DEVE ser resolvido em lote (sem uma consulta por item) para a página retornada.

**Documentação**

- **RF-031**: `docs/openapi.yaml` DEVE ser atualizado para cobrir os dois endpoints novos, o campo `pageCount`, o parâmetro `status` e a nova ordenação, e o objeto `book` embutido na listagem — e DEVE validar sem erros no linter de OpenAPI usado pelo projeto.
- **RF-032**: Os guias em `docs/flows/` afetados (fluxo de leitura, fluxo de review) e, se aplicável, o guia de paginação DEVEM ser atualizados para refletir os novos comportamentos.

### Entidades-chave *(se a feature envolve dados)*

- **Book**: projeção em cache de um livro do Open Library. Ganha o atributo `pageCount` (inteiro, anulável) — mediana de número de páginas informada pelo Open Library, ou `null`. Nenhum outro atributo muda.
- **ReadingSession**: entidade própria já existente (P4). Não muda a persistência. Apenas a **resposta** de `GET /me/reading-sessions` passa a carregar um objeto `book` (projeção de leitura: `title`, `authors`, `coverUrl`, `pageCount`) por item, além do parâmetro de filtro `status` e da nova ordenação.
- **Review**: já existente. Não muda. É apenas exposta por uma nova rota de leitura (`GET /books/{olid}/reviews`) com um bloco de autor.
- **Follow (aprovado)**: relação já existente. É o filtro de visibilidade (P6) dos dois endpoints novos: só contam/aparecem dados de usuários que o solicitante segue com follow aprovado.

Nenhuma entidade nova. Nenhuma coleção nova. Nenhuma migration.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [ ] **Todos os cenários de aceitação acima passam** com testes automatizados (`vitest`): testes unitários e de integração para os dois endpoints novos e para o endpoint de listagem modificado (`GET /me/reading-sessions`), cobrindo filtro, ordenação, paginação e o objeto `book` embutido.
- [ ] **`docs/` atualizado e lint limpo**: `docs/openapi.yaml` cobre os 2 endpoints novos + `pageCount` + parâmetro `status` + nova ordenação + `book` embutido; `npx redocly lint docs/openapi.yaml` passa sem erros; os guias em `docs/flows/` afetados atualizados; os nomes finais de rota e schema comunicados à sessão de front-end (`spine-frontend`).
- [ ] **Sem regressão nos fluxos existentes de leitura e review**: `books`, `reading-sessions`, `reviews` e `feed` mantêm o comportamento atual; a suíte de testes existente permanece verde; a paginação por cursor do histórico continua correta apesar da mudança de ordenação.
- [ ] **Privacidade P6 garantida**: `GET /books/{olid}/reviews` e `GET /books/popular-among-following` só retornam/contabilizam dados de usuários seguidos com follow aprovado; um não-seguidor ou um follow pendente não vaza nenhuma informação; há testes explícitos cobrindo esse recorte.

---

## Esclarecimentos

*Preenchido pelo comando `/clarify`. Cada rodada adiciona uma subseção com data.*

### Sessão 2026-09-05 (durante o `/specify`)

- P: Quando um seguidor tem várias reading sessions do mesmo livro (releitura), qual review aparece em `GET /books/{olid}/reviews`? → R: Uma por seguidor — a review da session `finished` mais recente daquele seguidor.
- P: `GET /books/{olid}/reviews` inclui a review do próprio solicitante? → R: Não, apenas de quem ele segue.
- P: Como ranquear "populares entre quem eu sigo"? → R: Por número de usuários distintos, dentre os seguidos aprovados, que têm qualquer reading session do livro; all-time.
- P: Formato da resposta de "populares"? → R: Top 20, sem paginação, excluindo livros que o solicitante já conhece (já tem reading session ou "quero ler").
- P: `pageCount` de livros já cacheados antes desta feature? → R: Lazy — sem migração; preenche só quando o livro é re-resolvido do Open Library.
- P: Embutir resumo do livro nas respostas de reading-session — onde? → R: Só em `GET /me/reading-sessions` (listagem); as demais respostas continuam com `bookId` apenas.
- P: Definição de Pronto? → R: (1) todos os cenários de aceitação passam com testes; (2) `docs/` atualizado e `redocly lint` limpo; (3) sem regressão nos fluxos existentes; (4) privacidade P6 garantida com testes.

---

## Checklist de Revisão

### Qualidade do conteúdo

- [x] Sem detalhes de implementação (linguagens, frameworks, APIs)
- [x] Focado em valor para o usuário e necessidades de negócio
- [x] Escrito para stakeholders não-técnicos
- [x] Todas as seções obrigatórias preenchidas

### Completude dos requisitos

- [x] Nenhum marcador `[NEEDS CLARIFICATION]` remanescente
- [x] Requisitos são testáveis e não-ambíguos
- [x] Critérios de sucesso são mensuráveis
- [x] Escopo está claramente delimitado
- [x] Dependências e premissas identificadas
- [x] Definição de Pronto preenchida, com critérios objetivos e verificáveis (não vagos)
