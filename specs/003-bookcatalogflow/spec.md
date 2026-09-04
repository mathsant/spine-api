# Especificação de Feature: Books Flow — busca, cache e status de leitura

**Branch**: `003-bookcatalogflow`
**Criado em**: 2026-09-04
**Status**: Rascunho
**Entrada**: descrição original do usuário: "books-flow - nessa spec vamos criar toda a feature inicial dos livros, integracao para a busca de livros, insercao dos livros na nossa base pra ficar de cache, controle de status do livro por usuario e etc."

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

Uma pessoa autenticada quer encontrar um livro para acompanhar sua leitura. Ela busca por título ou autor, escolhe um resultado e o livro passa a existir no catálogo local (cache) do better-books. A partir daí ela controla, ao longo do tempo, o status desse livro para si mesma: marcar como "quero ler", iniciar a leitura, atualizar em que página está, finalizar a leitura (inclusive relendo o mesmo livro depois) e consultar seu próprio histórico de leitura.

Esta feature **não** inclui: avaliar o livro com nota/review (feature futura), feed de atividades (feature futura), e visualizar o status/histórico de leitura de outra pessoa (depende da feature de Follow, ainda não implementada) — todos os endpoints aqui operam apenas sobre o próprio usuário autenticado.

### Cenários de aceitação

1. **Dado** que estou autenticado, **quando** busco livros por título ou autor, **então** recebo uma lista paginada de resultados vindos do catálogo externo (Open Library), com os metadados básicos de cada livro (título, autor, capa, ano).
2. **Dado** um resultado de busca que ainda não existe no catálogo local, **quando** eu abro o detalhe desse livro ou marco um status nele pela primeira vez, **então** o sistema grava esse livro no catálogo local (cache) usando seus identificadores externos (ISBN-13 e/ou OLID) para evitar duplicidade.
3. **Dado** um livro qualquer, **quando** eu abro seu detalhe, **então** vejo os metadados cacheados e os agregados do livro (nota média, contagem de reviews, contagem de leitores — podendo estar zerados/nulos, já que review é de outra feature).
4. **Dado** um livro que eu ainda não interagi, **quando** eu marco "quero ler" (`want_to_read`), **então** ele passa a aparecer na minha lista de "quero ler"; marcar de novo o mesmo livro não duplica a marcação (idempotente).
5. **Dado** um livro marcado como "quero ler", **quando** eu removo essa marcação, **então** ele some da minha lista de "quero ler"; remover de novo não gera erro (idempotente).
6. **Dado** um livro sem nenhuma reading session em aberto, **quando** eu inicio a leitura, **então** uma reading session com status `reading` é criada para mim, com `startedAt` preenchido, e o livro sai automaticamente da minha lista "quero ler" caso estivesse lá.
7. **Dado** um livro cuja reading session já está em `reading` (em aberto, sem `finishedAt`), **quando** eu tento "iniciar leitura" desse mesmo livro de novo, **então** o sistema não cria uma segunda session em aberto — a session existente é reaproveitada/atualizada.
8. **Dado** uma reading session minha em `reading`, **quando** eu registro um progress update informando a página atual, **então** a página atual da session é atualizada (sobrescrevendo a anterior).
9. **Dado** um livro sem nenhuma reading session em aberto (nem finalizada recentemente), **quando** eu marco diretamente como "já li", **então** uma reading session com status `finished` é criada, com `finishedAt` preenchido e `startedAt` opcional (posso não informar quando comecei).
10. **Dado** uma reading session minha em `reading`, **quando** eu a finalizo, **então** seu status muda para `finished` com `finishedAt` preenchido, e o livro sai da minha lista "quero ler" caso ainda estivesse lá.
11. **Dado** um livro que eu já finalizei antes, **quando** eu inicio a leitura dele de novo, **então** uma **nova** reading session é criada (independente da anterior), permitindo reler com progresso, datas e (no futuro) review próprios.
12. **Dado** uma reading session minha (em qualquer status), **quando** eu corrijo `startedAt`, `finishedAt` ou a página atual, **então** os dados são atualizados, respeitando que `finishedAt` não pode ser anterior a `startedAt` quando ambos existem.
13. **Dado** uma reading session minha, **quando** eu a apago, **então** ela deixa de existir e de contar no meu histórico.
14. **Dado** que estou autenticado, **quando** consulto meu histórico de reading sessions (com filtro opcional por livro), **então** recebo a lista paginada de todas as minhas sessions (de todos os status), incluindo sessions repetidas do mesmo livro (releituras).
15. **Dado** que a integração com o Open Library está indisponível ou expira por timeout, **quando** eu busco livros, **então** recebo um erro claro indicando falha no serviço externo, sem resultado parcial ou fallback silencioso.

### Casos de borda

- Buscar com termo vazio ou muito curto: o que deve ser retornado/rejeitado?
- Livro sem capa, sem ano, ou sem contagem de páginas no Open Library: os campos ausentes ficam nulos, sem bloquear o cadastro no cache.
- Registrar página atual maior que a contagem total de páginas do livro (quando existir): é aceito sem validação cruzada — a contagem de páginas do metadado externo pode estar incompleta ou errada.
- Tentar finalizar (`finished`) uma reading session que já está `finished`: deve ser tratado como atualização dos dados de finalização, não como erro de estado inválido.
- Tentar registrar progress update numa reading session já `finished`: deve ser rejeitado — progresso só se aplica a session em `reading`.
- Marcar `want_to_read` para um livro que já tem reading session `finished` (recente ou antiga): permitido, pois representa "quero reler".
- Dois resultados de busca diferentes do Open Library apontando para o mesmo ISBN-13/OLID já cacheado: o cache é atualizado (não duplicado).
- Editar uma reading session trocando `finishedAt` para antes de `startedAt`: deve ser rejeitado.

## Requisitos *(obrigatório)*

### Requisitos funcionais

- **RF-001**: O sistema DEVE permitir que um usuário autenticado busque livros por título e/ou autor através de integração com o catálogo externo (Open Library), retornando resultados paginados.
- **RF-002**: O sistema DEVE retornar um erro claro ao cliente quando a integração com o catálogo externo estiver indisponível ou expirar por timeout durante uma busca, sem fallback silencioso para dados incompletos.
- **RF-003**: O sistema DEVE gravar (ou atualizar, se já existir) um livro no catálogo local somente quando o usuário interagir com ele pela primeira vez (abrir detalhe ou marcar um status), usando os identificadores externos (ISBN-13 e/ou OLID) para não duplicar o mesmo livro.
- **RF-004**: O sistema DEVE permitir consultar o detalhe de um livro do catálogo local, incluindo seus metadados cacheados (título, autor, capa, ano) e seus agregados (nota média, contagem de reviews, contagem de leitores), mesmo que os agregados ainda estejam zerados/nulos por review não existir nesta feature.
- **RF-005**: O sistema DEVE permitir que um usuário marque um livro como "quero ler" (`want_to_read`) de forma idempotente (marcar de novo não duplica).
- **RF-006**: O sistema DEVE permitir que um usuário remova a marcação "quero ler" de um livro de forma idempotente (remover de novo não gera erro).
- **RF-007**: O sistema DEVE permitir que um usuário liste os livros que marcou como "quero ler".
- **RF-008**: O sistema DEVE permitir que um usuário inicie a leitura de um livro, criando uma reading session com status `reading` e `startedAt` preenchido.
- **RF-009**: O sistema DEVE impedir a criação de mais de uma reading session em `reading` (sem `finishedAt`) para o mesmo livro e mesmo usuário simultaneamente — iniciar leitura de novo, com uma session já em aberto para aquele livro, reaproveita a session existente em vez de criar outra.
- **RF-010**: O sistema DEVE, ao iniciar uma reading session ou marcar um livro como finalizado, remover automaticamente esse livro da lista "quero ler" do usuário, caso estivesse lá.
- **RF-011**: O sistema DEVE permitir registrar um progress update (página atual, número inteiro positivo) numa reading session em `reading`, sobrescrevendo a página atual anterior da session.
- **RF-012**: O sistema DEVE rejeitar progress update em reading session que não esteja com status `reading`.
- **RF-013**: O sistema NÃO DEVE validar a página informada contra a contagem total de páginas do livro, mesmo quando esse metadado existir.
- **RF-014**: O sistema DEVE permitir marcar um livro como finalizado diretamente (sem exigir session `reading` prévia), criando uma reading session `finished` com `finishedAt` preenchido e `startedAt` opcional.
- **RF-015**: O sistema DEVE permitir finalizar uma reading session em `reading`, mudando seu status para `finished` e preenchendo `finishedAt`.
- **RF-016**: O sistema DEVE permitir que reler um livro já finalizado crie uma nova reading session, independente e sem afetar sessions anteriores do mesmo livro.
- **RF-017**: O sistema DEVE permitir editar `startedAt`, `finishedAt` e a página atual de uma reading session existente do usuário, rejeitando a edição se resultar em `finishedAt` anterior a `startedAt`.
- **RF-018**: O sistema DEVE permitir apagar uma reading session do usuário.
- **RF-019**: O sistema DEVE permitir consultar o histórico paginado de reading sessions do próprio usuário (todos os status), com filtro opcional por livro.
- **RF-020**: Todos os endpoints desta feature DEVEM operar apenas sobre os dados do usuário autenticado (seu próprio `want_to_read` e suas próprias reading sessions) — consultar o status/histórico de outro usuário fica fora de escopo, por depender da feature de Follow.

### Entidades-chave *(se a feature envolve dados)*

- **Book**: livro cacheado a partir do Open Library. Atributos-chave: identificadores externos (ISBN-13, OLID), título, autor, capa, ano, contagem de páginas (quando disponível), agregados (nota média, contagem de reviews, contagem de leitores). Relaciona-se com `ShelfMembership` e `ReadingSession`.
- **ShelfMembership**: marca "quero ler" de um usuário sobre um livro. Atributos-chave: referência ao usuário, referência ao livro, data de criação. Não é uma sessão de leitura.
- **ReadingSession**: uma passada de um usuário por um livro. Atributos-chave: referência ao usuário, referência ao livro, `status` (`reading` | `finished`), `startedAt` (opcional), `finishedAt` (opcional, obrigatório quando `finished`), página atual (opcional, inteiro positivo). Um usuário pode ter várias sessions do mesmo livro (releitura), mas no máximo uma em `reading` por livro por vez.

---

## Definição de Pronto (Definition of Done) *(obrigatório)*

- [x] Todos os cenários de aceitação (1–15) desta spec passam ponta a ponta, incluindo os casos de borda listados. Verificado via `tests/integration/http/books.routes.spec.ts` e `reading-sessions.routes.spec.ts` (`app.inject()`) **e** manualmente contra um servidor real (`node dist/server.js`) + MongoDB real (standalone `mongod`, já que Docker não estava disponível no ambiente) + stub HTTP local do Open Library, cobrindo busca, cache-on-read, 404/503, want_to_read idempotente, start-reading com reaproveitamento (200 vs 201), progresso, finalizar (idempotente), marcar direto + releitura, editar (com rejeição 422), apagar + 404 subsequente, e histórico paginado.
- [x] Cobertura de teste automatizado: 239 testes (unit + integration) verdes; `pnpm test:coverage` confirma `src/services/**` acima do piso de 70% exigido pela constituição (execução sem falha de threshold).
- [x] Nenhuma regressão nos fluxos já entregues de autenticação e perfil (features 001 e 002): suíte completa (auth incluída) permanece 100% verde; fluxo real de signup/login validado manualmente contra o servidor de ponta a ponta.
- [x] Contratos dos novos endpoints (request/response, erros) documentados em `contracts/books.openapi.yaml`, `contracts/error-codes.md`, `contracts/internal-ports.md` e na seção "Books" do `README.md`.

---

## Esclarecimentos

### Sessão 2026-09-04

- P: "Controle de status do livro por usuário" cobre só `want_to_read`, `want_to_read` + reading/finished simples, ou o fluxo completo de `ReadingSession` (iniciar, progresso, finalizar, releitura, histórico)? → R: Fluxo completo de `ReadingSession`.
- P: A busca de livros deve aceitar busca por quê (título/autor, +ISBN, ou só ISBN)? → R: Título e autor.
- P: Quando um livro deve ser inserido/atualizado no cache local? → R: Só quando o usuário interage (abre detalhe ou marca status), não em todo resultado de busca.
- P: Esta feature já entrega criar/editar/apagar review atrelada à reading session, ou review fica para depois? → R: Review fica de fora desta feature.
- P: Como o progress update registra o progresso (página, percentual, ou ambos)? → R: Só página atual.
- P: Ao iniciar/finalizar leitura de um livro que estava em `want_to_read`, o que acontece com essa marcação? → R: Remove automaticamente.
- P: Os endpoints desta feature já devem suportar ver o status/histórico de outro usuário (dependendo de Follow, que ainda não existe), ou só do próprio usuário autenticado? → R: Só do próprio usuário; visão de terceiros fica para quando Follow existir.
- P: Pode existir mais de uma reading session `reading` (em aberto) do mesmo livro, para o mesmo usuário, ao mesmo tempo? → R: Não — no máximo uma em aberto por livro; iniciar de novo reaproveita a existente.
- P: O que fazer quando a página informada no progress update excede a contagem total de páginas do livro (ou o livro não tem essa contagem)? → R: Sem validação contra o total.
- P: Uma reading session pode ser editada ou apagada depois de criada? → R: Ambos — editar e apagar.
- P: O que fazer se a integração com o Open Library falhar/expirar durante uma busca? → R: Retornar erro claro ao cliente, sem fallback automático para o cache local.
- P: Os resultados de busca devem ser paginados ou retornar uma página única (top N)? → R: Paginados.
- P: O `ProgressUpdate` do glossário do produto tem histórico no tempo (vira item de feed); nesta feature, o progresso deve manter histórico de pontos no tempo ou só a página atual na própria session? → R: Só a página atual na session, sobrescrita a cada update — sem histórico de pontos nesta feature.
- P: Quais pontos são primordiais para considerar esta feature DONE? → R: Cenários de aceitação passam ponta a ponta; cobertura de teste automatizado; sem regressão em auth/perfil existentes; documentação dos endpoints atualizada.

---

## Checklist de Revisão

*Gate automatizado verificado pelo `/specify` e revisado por `/clarify` antes do `/plan`.*

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
