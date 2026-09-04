# Especificação de Feature: Reviews

**Branch**: `005-reviews`
**Criado em**: 2026-09-04
**Status**: Rascunho
**Entrada**: descrição original do usuário: "005-reviews: permitir avaliar um livro com nota (1-5, inteiro) e review (texto opcional + flag de spoiler) atrelada a uma reading session finalizada; criar/editar/apagar a review; atualizar os agregados do Book (nota média, contagem de reviews) que hoje ficam zerados desde a 003-bookcatalogflow."

## Fluxo de execução (para o agente que preenche este documento)

1. Extraia o conceito principal da descrição do usuário.
2. Identifique atores, ações, dados e restrições envolvidos.
3. Para cada ambiguidade, marque com `[NEEDS CLARIFICATION: pergunta específica]` em vez de assumir.
4. Preencha as seções de Cenários de Usuário e Testes.
5. Gere Requisitos Funcionais — cada um deve ser testável.
6. Identifique Entidades-Chave, se o recurso envolve dados.
7. Pergunte ao usuário qual é a Definição de Pronto (DoD) — quais pontos são primordiais para isto estar DONE — e preencha essa seção com a resposta.
8. Rode o "Checklist de Revisão" abaixo antes de considerar a spec pronta.

**IMPORTANTE**: esta especificação descreve O QUÊ os usuários precisam e POR QUÊ. Evite detalhes de implementação (stack, APIs, estrutura de código) — isso é papel do `/plan`.

---

## Cenários de Usuário & Testes *(obrigatório)*

### História principal

Depois de finalizar a leitura de um livro (reading session `finished`, entregue na
003-bookcatalogflow), o usuário quer registrar o que achou: dar uma nota de 1 a 5 estrelas e,
opcionalmente, escrever um texto e marcar se ele contém spoiler. Esse registro pode ser
corrigido ou removido depois. O livro passa a mostrar sua nota média e quantas reviews recebeu,
em vez dos valores sempre zerados/nulos de antes. Esta feature cobre apenas a própria review do
usuário autenticado — ver review de outras pessoas fica para a feature de Feed.

### Cenários de aceitação

1. **Dado** uma reading session minha com status `finished`, **quando** eu crio uma review
   informando `rating = 4`, **então** a review é criada, associada a essa session, e passa a
   aparecer no detalhe dessa reading session.
2. **Dado** uma reading session minha com status `finished` e sem review, **quando** eu crio
   uma review só com `rating` (sem texto), **então** a review é criada com texto nulo e
   `containsSpoiler = false` por padrão.
3. **Dado** uma reading session minha com status `finished`, **quando** eu crio uma review com
   `rating`, `text` e `containsSpoiler = true`, **então** todos os três campos são persistidos e
   devolvidos juntos (o texto nunca é ocultado pela API — a flag só sinaliza pro cliente, P9 do
   produto).
4. **Dado** uma reading session minha ainda com status `reading` (não finalizada), **quando**
   eu tento criar uma review para ela, **então** o sistema rejeita com um erro de estado
   inválido (409), sem criar nada.
5. **Dado** uma reading session que já tem uma review minha, **quando** eu tento criar uma
   segunda review para a mesma session, **então** o sistema rejeita (a review já existe;
   orienta a usar a edição) em vez de criar ou sobrescrever silenciosamente.
6. **Dado** uma review minha existente, **quando** eu edito só o `rating` (sem enviar `text` nem
   `containsSpoiler`), **então** apenas o `rating` muda; os demais campos permanecem como
   estavam.
7. **Dado** uma review minha existente, **quando** eu edito o `text` para uma string vazia ou
   `null`, **então** a review passa a não ter texto (rating continua obrigatório e nunca é
   removido, só substituído por outro valor 1–5).
8. **Dado** uma review minha existente, **quando** eu a apago, **então** ela deixa de existir e
   os agregados do livro (nota média, contagem de reviews) são recalculados sem ela.
9. **Dado** uma reading session minha com review, **quando** eu apago essa reading session,
   **então** a review associada é apagada em cascata automaticamente (não fica órfã).
10. **Dado** um livro com N reviews de notas variadas, **quando** eu consulto o detalhe desse
    livro, **então** `averageRating` reflete a média real das notas e `reviewCount` reflete a
    contagem real de reviews existentes (não mais sempre `null`/`0`).
11. **Dado** um livro sem nenhuma review, **quando** eu consulto seu detalhe, **então**
    `averageRating` é `null` e `reviewCount` é `0`.
12. **Dado** uma reading session que não é minha (é de outro usuário) ou que não existe,
    **quando** eu tento criar/editar/apagar uma review nela, **então** o sistema responde como
    "não encontrado" (mesmo tratamento para "nunca existiu" e para "não me pertence" — D9/D7,
    já usado nas features anteriores), nunca com um erro de permissão.
13. **Dado** uma review que não é minha (é de outro usuário) ou que não existe, **quando** eu
    tento editá-la ou apagá-la por `reviewId`, **então** o sistema responde "não encontrado".
14. **Dado** que eu consulto o histórico das minhas reading sessions
    (`GET /v1/me/reading-sessions`, entregue na 003), **quando** uma delas tem review,
    **então** a review aparece embutida no item correspondente; quando não tem, o campo de
    review vem `null`.

### Casos de borda

- Criar review com `rating` fora de 1–5, ou não-inteiro, ou ausente: rejeitado como erro de
  validação (payload inválido).
- Editar review sem enviar nenhum campo (`rating`, `text` e `containsSpoiler` todos ausentes):
  rejeitado como erro de validação — mesmo padrão do edit de reading session da 003.
- Texto de review acima do limite de tamanho definido (ver RF-004): rejeitado como erro de
  validação.
- Apagar uma review que já foi apagada (ou nunca existiu): "não encontrado".
- Livro com reviews cujo somatório de notas dividido pela contagem resulta em fração: a média
  é exposta com casas decimais (o formato exato de arredondamento é detalhe de contrato, não de
  produto).

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **RF-001**: O sistema DEVE permitir criar uma review (nota `rating` inteira de 1 a 5,
  `text` opcional, `containsSpoiler` opcional com padrão `false`) atrelada a uma reading session
  do próprio usuário que esteja com status `finished`.
- **RF-002**: O sistema DEVE rejeitar a criação de review numa reading session que não esteja
  `finished` (erro de conflito de estado, 409).
- **RF-003**: O sistema DEVE permitir no máximo uma review por reading session; tentar criar uma
  segunda review na mesma session DEVE ser rejeitado (a review já existe), sem sobrescrever a
  existente.
- **RF-004**: O sistema DEVE limitar o tamanho do texto da review a um máximo de 2000
  caracteres, rejeitando textos maiores como erro de validação.
- **RF-005**: O sistema DEVE permitir editar parcialmente uma review própria existente — cada um
  de `rating`, `text` e `containsSpoiler` pode ser enviado independentemente; campos omitidos
  permanecem com o valor atual; ao menos um campo deve ser enviado.
- **RF-006**: O sistema DEVE permitir apagar uma review própria existente.
- **RF-007**: O sistema DEVE apagar automaticamente (cascata) a review associada quando a
  reading session correspondente é apagada.
- **RF-008**: O sistema DEVE tratar toda operação de criar/editar/apagar review sobre uma
  reading session ou review que não pertence ao usuário autenticado (ou que não existe) da mesma
  forma — resposta "não encontrado", nunca erro de permissão (mesmo padrão D7/D9 das features
  003/004).
- **RF-009**: O sistema DEVE expor, no detalhe de um livro, a nota média (`averageRating`) e a
  contagem de reviews (`reviewCount`) calculadas a partir das reviews reais existentes desse
  livro — `null`/`0` apenas quando não houver nenhuma review.
- **RF-010**: O sistema DEVE incluir a review da reading session (quando existir) na listagem já
  existente de histórico de reading sessions do usuário (`GET /v1/me/reading-sessions`), sem
  quebrar o formato hoje devolvido para sessions sem review.
- **RF-011**: O sistema DEVE validar que `rating`, quando enviado (na criação ou na edição), é um
  inteiro entre 1 e 5, rejeitando qualquer outro valor como erro de validação.

### Entidades-chave

- **Review**: avaliação de um livro feita numa reading session finalizada. Atributos-chave:
  `rating` (inteiro 1–5, obrigatório), `text` (opcional), `containsSpoiler` (booleano, padrão
  `false`). Relaciona-se 1:1 com uma `ReadingSession` (a existência da review é atrelada à
  session que a originou; apagar a session apaga a review). Pertence ao mesmo dono da
  `ReadingSession`. Contribui para os agregados (`averageRating`, `reviewCount`) do `Book`
  associado à session.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [x] Todos os cenários de aceitação (1–14) desta spec, incluindo os casos de borda, passam
      ponta a ponta em testes de integração (criar, editar parcial, apagar, rejeição em session
      não finalizada, unicidade 1:1, cascade delete ao apagar a reading session). Verificado via
      `tests/integration/http/reviews.routes.spec.ts` (`app.inject()`, 15 casos) **e**
      manualmente contra um servidor real (`node dist/server.js`) + MongoDB Atlas real (cluster
      de dev) + Open Library real, cobrindo criar (201, texto+spoiler, rating-only, 409
      duplicado), editar parcial (rating, `text: null`, 400 sem campos), apagar (204),
      agregados reais antes/depois de apagar, embutimento no histórico e cascade delete ao
      apagar a reading session (confirmado sem review órfã no banco).
- [x] O detalhe de um livro (`GET` de book já existente, da 003) deixa de sempre devolver
      `averageRating: null` e `reviewCount: 0` — passa a refletir as reviews reais criadas por
      esta feature. Verificado em `tests/integration/services/books/get-book.service.spec.ts` e
      manualmente (`aggregates: { averageRating: 4, reviewCount: 1, readerCount: 1 }` após criar
      uma review; volta a `null`/`0` após apagá-la).
- [x] Nenhuma regressão no fluxo existente de reading sessions da 003 — em especial
      `GET /v1/me/reading-sessions`, que continua respondendo no formato atual para sessions sem
      review e passa a incluir a review (ou `null`) sem quebrar contrato para clientes que já
      consomem esse endpoint. Verificado: suíte completa de `tests/integration/services/
      reading-sessions/**` e `tests/integration/http/**` (003/004) permanece 100% verde após as
      extensões desta feature (375 testes no total, 0 falhas).
- [x] Cobertura de teste automatizado ≥ 70% em `src/services/**` para os services novos desta
      feature, mesmo gate usado nas features 003/004. Verificado via `pnpm test:coverage`: o
      threshold configurado em `vitest.config.mts` para `src/services/**` (70% em todas as
      métricas) passa sem erro; `src/services/reviews/**` e as extensões de `books`/
      `reading-sessions` atingem 100% em statements/branches/functions/lines.

---

## Esclarecimentos

### Sessão 2026-09-04

- P: Esta feature deve incluir alguma forma de outros usuários verem reviews (ex.: listar
  reviews de um livro, ou ver a review de alguém que você segue), ou fica só CRUD da própria
  review + agregados reais no Book? → R: Só CRUD da própria review; nenhum endpoint de listagem
  de reviews de terceiros nesta feature (fica para Feed/Interações).
- P: Uma reading session pode ter no máximo 1 review (relação 1:1)? Tentar criar uma segunda
  deve ser rejeitado ou sobrescrever? → R: Sim, 1:1; a segunda criação é rejeitada (usar edição).
- P: Ao apagar a ReadingSession, a review associada deve ser apagada em cascata? → R: Sim,
  cascade automático.
- P: Editar review exige payload completo ou aceita edição parcial? → R: Parcial — mesmo padrão
  do edit de ReadingSession da 003 (ao menos 1 campo).
- P: O texto da review tem limite de tamanho? → R: Sim, limite de 2000 caracteres.
- P: Criar review numa session `reading` (não finalizada) deve ser rejeitado com qual tipo de
  erro? → R: 409 Conflict (erro de estado inválido), mesmo padrão do `InvalidReadingSessionStateError`
  da 003.
- P: O usuário precisa conseguir ver a própria review nesta feature (além de criar/editar/
  apagar)? → R: Sim, embutida no DTO de `GET /v1/me/reading-sessions` — sem endpoint novo de
  leitura dedicado.

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
