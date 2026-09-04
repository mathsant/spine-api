# Produto: better-books

**Origem**: definido interativamente com o usuário (ideia nova, sem pesquisa de mercado prévia)
**Última atualização**: 2026-09-03

<!--
Este arquivo é a fonte da verdade sobre O QUE o better-books é como produto:
propósito, domínio, escopo e decisões de produto travadas.
/specify, /plan e /clarify devem ler este arquivo e ancorar cada feature aqui
em vez de reinventar o contexto do produto.
COMO o código é estruturado → .specify/memory/architecture.md
Princípios inegociáveis → .specify/memory/constitution.md
Se a direção do produto mudar, edite este arquivo à mão (não é gerado por script).
-->

## O que é

**better-books é uma rede social para leitores.** A pessoa se cadastra, registra os
livros que está lendo e já leu, avalia cada um com nota e review, e acompanha a
atividade de leitura de quem ela segue. O consumo do conteúdo é fechado: você só
vê posts, reviews e progresso de quem você segue e teve o follow aprovado.

Este repositório é **somente a API HTTP** (backend). Um app web separado vai
consumir essa API no futuro; um app mobile é uma possibilidade posterior. Nenhum
código de interface mora aqui.

## Para quem e qual problema

- **Público**: leitores que querem registrar o que leem e trocar recomendações e
  opiniões dentro de um círculo escolhido, sem o ruído e a exposição pública de
  redes maiores.
- **Problema**: apps de leitura consolidados são públicos por padrão e
  otimizados para escala/descoberta aberta. Falta um espaço fechado, de círculo
  pequeno, onde review e progresso são compartilhados só com quem você aceitou.

## Conceitos do domínio (glossário)

Nomes em inglês (regra do kit); a descrição em português é o significado no contexto do produto.

| Conceito | Significado |
|---|---|
| **User** | Conta de uma pessoa. Tem `displayName`, `@handle` único e **imutável** (P11), avatar. Perfil é **privado por padrão** (ver decisão P6). |
| **Follow** | Relação **direcional e com aprovação**: A pede para seguir B, B aprova. A aprovação não cria o follow inverso. Só seguidores aprovados de B enxergam o conteúdo de B. |
| **Follow request** | Pedido de follow pendente de aprovação/recusa pelo alvo. |
| **Book** | Registro de um livro no banco. É uma **projeção em cache do Open Library** (ver P2): guarda os IDs externos (ISBN-13, OLID), metadados (título, autor, capa, ano) e os **agregados próprios** (nota média, contagem de reviews, contagem de leitores). Uma única camada — sem distinção obra/edição no MVP (P3). |
| **Shelf membership** | Marca que um usuário quer ler um livro (`want_to_read`). Não é uma sessão de leitura. Listas customizadas ficam para depois. |
| **Reading session** | **Entidade própria** (P4). Representa uma passada de um usuário por um livro: `status` (`reading` \| `finished`), `startedAt`, `finishedAt`, progresso atual (página ou %), e opcionalmente uma review. Não exige fluxo linear (P10): `finishedAt` sem `startedAt` é válido ("li ano passado"); um progress update cria a session `reading` se ainda não houver. Reler o mesmo livro cria uma nova session — datas, progresso e review independentes. |
| **Progress update** | Ponto no tempo do progresso de uma reading session (ex.: "página 120", "60%"), opcionalmente com um texto curto e flag de spoiler. Vira item de feed. |
| **Review** | Avaliação de um livro feita numa reading session: `rating` (inteiro **1–5**, P5) + texto opcional + `containsSpoiler`. Nota sem texto é permitida. Ocultar spoiler é responsabilidade do cliente (P9): a API sempre devolve o texto junto da flag. A "nota do usuário para o livro" exibida é a da sessão finalizada mais recente. |
| **Comment** | Comentário de texto num item de feed (review, progress update, post). Aninhamento raso (1 nível) no MVP. |
| **Reaction** | Curtida simples (um tipo só) num item de feed no MVP. |
| **Post / Activity** | Item que aparece no feed. Tipos no MVP: começou a ler, terminou de ler, publicou review, progress update. Texto livre avulso fica para depois. Modelado como log append-only de eventos. |
| **Feed** | Lista, ordenada no tempo e paginada por cursor, da atividade das pessoas que o usuário segue (e que aprovaram o follow). Gerado por consulta na hora (fan-out on read) no MVP. |
| **Notification** | Registro persistido de um evento relevante para o usuário (follow request, follow aprovado, comentário/curtida no seu conteúdo). Entrega por polling no MVP; mecanismo trocável depois. |

## Decisões de produto travadas

Confirmadas com o usuário em 2026-09-03. Mudar qualquer uma exige revisar as features afetadas.

| # | Decisão | Escolha | Por quê / implicação |
|---|---|---|---|
| **P1** | Modelo de relação social | **Seguir, assimétrico, com aprovação** | Escala melhor no feed que amizade mútua e abre espaço para perfis de autor/curador depois. Como o perfil é privado (P6), seguir exige aprovação do alvo (modelo "perfil privado" de rede social). |
| **P2** | Fonte do catálogo de livros | **Open Library + cache local** | Gratuito, sem chave de API, cobre ISBN/capa/autor. `Book` no banco é cache + IDs externos; agregados (nota média, contagens) são calculados por cima. Evita duplicação de "o mesmo livro". |
| **P3** | Obra (work) vs. edição (edition) | **Uma camada só (`Book`) no MVP** | Simplifica modelo, busca e import. Camada de edição entra depois, só se houver necessidade de formato/nº de páginas exatos. |
| **P4** | Modelagem do ato de ler | **`ReadingSession` como entidade própria** | Suporta releitura, histórico completo e estatísticas/retrospectiva corretas. `want_to_read` fica como shelf membership, fora da session. |
| **P5** | Granularidade da nota | **Estrela cheia, inteiro 1–5** | Mais simples de implementar e exibir. Migrar para meia-estrela depois não quebra dados existentes. |
| **P6** | Visibilidade / descoberta de perfil | **Perfil totalmente privado por padrão** | Para quem não segue (aprovado), a única superfície é o resultado de busca (ver P14). Todo endpoint de leitura filtra pelo espectador. |
| **P7** | Livro abandonado (DNF) | **Fora do MVP** | Status de session no MVP é só `reading` \| `finished`. `abandoned` (com motivo, e talvez sinal para recomendação) entra no roadmap. |
| **P8** | Autenticação da API | **Access token curto + refresh token** | Access JWT (~15 min) + refresh rotativo persistido no servidor (para revogação). Adequado a cliente web em outra origem e a mobile futuro. Cliente guarda os tokens. |
| **P9** | Tratamento de spoiler | **Cliente oculta; API devolve texto + flag** | A API sempre retorna o texto da review junto de `containsSpoiler`. Nenhuma listagem de review precisa cruzar as reading sessions do espectador — menos acoplamento e menos custo por request. |
| **P10** | Ciclo da reading session | **Sem fluxo linear obrigatório** | Marcar "li" cria uma session `finished` direto (`finishedAt` sem `startedAt`); um progress update cria a session `reading` se não existir. Comporta import de histórico e uso real ("li ano passado"). |
| **P11** | Mutabilidade do `@handle` | **Imutável após o cadastro** | Zero necessidade de tabela de histórico, redirect ou invalidação de menções/links. Trocar handle vira feature de roadmap se houver demanda. |
| **P12** | Sessões de refresh token | **Sem limite; rotativo, expira por inatividade (~30 dias)** | Cada login gera um refresh token; rotaciona a cada uso; logout revoga o token atual. Suporta web + mobile + vários navegadores sem gestão de "N dispositivos". |
| **P13** | Reciprocidade ao aprovar follow | **Aprovar só cria A→B** | Nenhuma ação automática ou opcional em B→A. Se B quiser seguir A, é um follow request separado. Menos lógica no handler, comportamento previsível. |
| **P14** | Superfície da busca de usuário | **`displayName` + `@handle` + `avatar`** | O suficiente para identificar a pessoa certa e mandar o follow request. Nenhum conteúdo de leitura nem contadores (seguidores/livros) para quem não é seguidor aprovado. |

### Consequência combinada de P1 + P6

O modelo efetivo é **"perfil privado com follow por aprovação"** (como um Instagram
privado): a relação é direcional (A seguir B não implica B seguir A), e **nenhum
conteúdo** de B (posts, reviews, progresso, reading sessions, shelves) é visível
sem follow aprovado. A descoberta acontece só por busca, que devolve apenas
`displayName` + `@handle` + `avatar` (P14) — o suficiente para mandar o pedido.

## Escopo do MVP

O menor conjunto que ainda é "rede social de leitores":

1. **Auth**: cadastro, login, refresh, logout (revogação do refresh).
2. **Perfil**: ler/editar o próprio; busca de usuários por `@handle`/nome (resultado mínimo).
3. **Follow**: enviar pedido, aprovar/recusar, deixar de seguir, remover seguidor; listar seguidores/seguindo.
4. **Livros**: buscar no catálogo (via Open Library), abrir um livro (metadados + agregados), marcar `want_to_read`.
5. **Reading session**: iniciar leitura, registrar progress update, finalizar; releitura cria nova session; histórico do usuário.
6. **Review**: criar/editar/apagar review (nota 1–5 + texto opcional + flag de spoiler) atrelada a uma session.
7. **Feed**: atividade só de quem o usuário segue (aprovado), paginada por cursor.
8. **Interações**: comentar e curtir itens de feed (review, progress update, "terminou de ler").
9. **Notificações**: follow request, follow aprovado, comentário/curtida no seu conteúdo; listar e marcar como lida (polling).

## Fora do MVP — roadmap

**Fast-follow (alto encaixe, baixo custo):**
- Metas de leitura ("N livros em 2026") com progresso visível para seguidores.
- Citações/trechos favoritos como item de feed.
- Estantes/listas customizadas (depois: compartilháveis/colaborativas).
- Retrospectiva anual (páginas lidas, gêneros, nota média) — recap compartilhável.
- Reações múltiplas (além da curtida única).

**Roadmap (esforço médio):**
- DNF/`abandoned` como status de primeira classe, com motivo (P7).
- Clubes de leitura / leitura conjunta com discussão segmentada por capítulo.
- Tags de humor/ritmo aplicadas pela comunidade.
- Recomendação social ("3 pessoas que você segue deram 5★").
- Content warnings colaborativos por livro.
- Import de histórico do Goodreads (CSV) — o modelo já deve comportar datas passadas e nota sem review.
- Meia-estrela na nota (P5).

**Posterior / a decidir:**
- Perfis de autor e seguir autor.
- Post de texto livre avulso.
- Camada de edição (edition) sobre `Book` (P3).
- App mobile (a estratégia de auth em P8 já contempla).
- Entrega de notificação em tempo real (SSE/WebSocket).
- Feed materializado (fan-out on write) se a escala exigir.

## Implicações para a API

Decorrem das decisões acima e do fato de a API ser consumida por um cliente web separado.

- **Versionamento**: prefixo `/v1` desde o primeiro endpoint — cliente externo depende do contrato.
- **Auth (P8)**: `Authorization: Bearer <access>`; endpoint de refresh troca o refresh token (rotação) e permite revogação no servidor. CORS configurado para a origem do app web.
- **Contexto do espectador**: todo recurso de leitura é resolvido **relativo ao usuário autenticado** e respeita P6 (privacidade). DTOs carregam um bloco `viewer` (ex.: `isFollowing`, `followState`, `hasReacted`, `myReadingStatus`).
- **Paginação por cursor** (não offset) em feed e em toda lista que cresce/muda — o formato do cursor faz parte do contrato.
- **Feed**: fan-out on read no MVP. `Activity` é log append-only para permitir migrar para feed materializado sem reescrever o domínio.
- **Idempotência**: operações como marcar `want_to_read`, seguir, curtir têm semântica idempotente (repetir não duplica).
- **Rate limiting** nos writes de conteúdo (review, comentário, follow request) para conter spam.
- **Soft delete** em review e comentário (moderação; placeholder "[removido]" em thread).
- **Moderação**: report de review/comentário/usuário como entidade simples desde o MVP evita retrofit.
- **Mídia**: capa de livro vem como URL do Open Library (avaliar proxy/cache depois). Upload de avatar precisa de object storage — provavelmente fora do primeiro corte da API; desenhar o fluxo antes de implementar.
- **Busca de livros**: proxy para o Open Library primeiro, indexação própria depois. Busca de usuários: índice de texto do MongoDB é suficiente no início.

## Perguntas em aberto

Nenhuma decisão de produto pendente. Detalhes deixados para o `/plan` da feature correspondente:

- Valor exato da janela de inatividade do refresh token (P12 assume ~30 dias) e do TTL do access token (P8 assume ~15 min).
- Formato concreto do cursor de paginação (opaco base64 de `{timestamp, id}` é o candidato).
- Forma do bloco `viewer` em cada DTO (campos por tipo de recurso).
- Se o upload de avatar entra já na primeira versão da API ou fica para depois (depende de ter object storage disponível).
