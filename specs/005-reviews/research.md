# Fase 0 — Pesquisa: Reviews

Feature: `005-reviews` · Data: 2026-09-04

Nenhum `[NEEDS CLARIFICATION]` de stack no Contexto Técnico do `plan.md` — toda a stack já
vem decidida por `architecture.md`/`constitution.md` e confirmada nas features 003/004. As
decisões abaixo são de **design da feature**, não de stack, e ficam registradas porque não são
óbvias a partir da spec sozinha.

---

## D1 — Denormalizar `bookId` na `Review`

**Decisão**: `Review` guarda `bookId` diretamente, além de `sessionId`, mesmo que `bookId` seja
tecnicamente derivável via `ReadingSession.bookId`.

**Justificativa**: RF-009 exige calcular `averageRating`/`reviewCount` por livro. Sem `bookId`
na própria `Review`, a agregação exigiria um `$lookup` em `reading_sessions` a cada consulta de
detalhe de livro. Denormalizar evita o join e mantém a agregação uma consulta indexada simples
(`{ $match: { bookId } }` → `$group`), no mesmo espírito de `ReadingSession.bookId` já ser
denormalizado ali (a 003 não fez `Book` carregar a lista de sessions, e sim o inverso).

**Alternativas consideradas**:
- `$lookup` em `reading_sessions` na hora de calcular agregados — rejeitado: mais lento, e
  acopla a consulta de agregado à existência da session (uma `Review` nunca deveria sumir do
  agregado por causa de detalhe de índice de outra coleção).
- Persistir os agregados (`averageRating`, `reviewCount`) diretamente no documento do `Book`,
  atualizados a cada escrita de review — rejeitado por ora: a 003 já decidiu que agregados de
  `Book` são calculados na leitura (não persistidos), para não arriscar dessincronia; esta
  feature mantém essa escolha e só adiciona a agregação de `reviews` ao lado da de
  `reading_sessions` que já existia.

## D2 — Erro de índice único (11000) em `sessionId` vira `ReviewAlreadyExistsError`

**Decisão**: o repositório de reviews captura violação do índice único `{ sessionId: 1 }` e a
traduz para um erro de domínio dedicado, em vez de deixar o código `11000` do driver vazar.

**Justificativa**: mesmo padrão de tradução de erro de infraestrutura já usado no projeto
(constitution, princípio "Erros tipados"). Diferente de `startReading`/`sendFollowRequest`
(003/004), que absorvem a corrida e devolvem o registro existente, aqui o cenário 5 do
`spec.md` pede rejeição explícita (a segunda criação não deve suceder silenciosamente) — então
a violação de índice em condição de corrida deve terminar no mesmo erro que a checagem
"já existe" feita antes no service, não em um retorno de sucesso.

**Alternativas consideradas**:
- Reaproveitar/absorver como em `startReading` (devolver a review existente em vez de erro) —
  rejeitado: contradiz a decisão explícita do usuário na clarificação ("rejeita a 2ª criação").

## D3 — Novo erro `ReadingSessionNotFinishedError`, em vez de reaproveitar `InvalidReadingSessionStateError`

**Decisão**: criar uma classe de erro nova (`READING_SESSION_NOT_FINISHED`, 409) para "criar
review numa session que não é `finished`", em vez de reaproveitar `InvalidReadingSessionStateError`
(`INVALID_READING_SESSION_STATE`, já usada por `update-progress` da 003 para o caso oposto —
"a session precisa estar `reading`").

**Justificativa**: os dois erros são condições opostas (`must be reading` vs. `must be
finished`); um único `code` para ambos obrigaria o cliente a inspecionar a mensagem em vez do
`code` para saber qual violação ocorreu — quebra o contrato de erro estável que a constituição
pede (`code` → tratamento determinístico). Mesmo padrão já usado na 003 entre
`InvalidReadingSessionStateError` e `InvalidReadingSessionDatesError` (duas violações de
`ReadingSession`, duas classes).

**Alternativas consideradas**:
- Reaproveitar `InvalidReadingSessionStateError` com mensagem customizada — rejeitado pelo
  motivo acima (mesmo `code` para duas condições diferentes).

## D4 — Arredondamento de `averageRating`

**Decisão**: `averageRating` é exposto arredondado para 1 casa decimal (ex.: `4.3`), calculado
por `$avg` do MongoDB sobre `rating` das reviews do livro.

**Justificativa**: a spec deixa o formato exato de arredondamento como "detalhe de contrato,
não de produto" (caso de borda do `spec.md`); 1 casa decimal é o padrão comum em produtos de
avaliação (nota 1–5 inteira por review, média fracionária com granularidade útil sem ruído de
ponto flutuante cru do driver).

**Alternativas consideradas**:
- Expor a média crua (ponto flutuante sem arredondar) — rejeitado: risco de valores como
  `4.333333333333333` vazando pra API.
- 2 casas decimais — rejeitado por excesso de precisão sem valor de produto sobre uma escala
  1–5 inteira.

## D5 — `review` embutida via consulta `$in`, não N+1

**Decisão**: `list-reading-sessions.service.ts` busca as reviews da página inteira com uma
única consulta `reviewRepository.findBySessionIds(sessionIds)` (usando `$in` no repositório),
e monta um mapa `sessionId → Review` para embutir em cada `ReadingSessionDTO` — nunca uma
consulta de review por item da página.

**Justificativa**: RF-010 exige embutir a review em cada item de uma lista paginada; buscar uma
por vez criaria N+1 consultas por página, além de já existir o padrão de operação "em lote"
equivalente no projeto (`countDistinctFinishedReaders`/`listByUser` são operações que resolvem
o necessário numa consulta por chamada).

**Alternativas consideradas**:
- Uma consulta de review por `ReadingSessionRecord` da página — rejeitado (N+1).
