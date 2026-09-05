<!-- title: Prompt para o Claude Design -->

# Prompt para o Claude Design — protótipo do better-books

> **Status**: rascunho pronto para revisão e aprovação do usuário (RF-019). Depois de
> aprovado, copie o conteúdo da seção "Prompt" abaixo (só ela, do início ao fim) e cole
> no Claude Design para gerar o protótipo.

## Prompt

```
Quero um protótipo de design de ponta a ponta para o "better-books", uma rede social
para leitores. Contexto do produto, para você não precisar de mais nada além deste
prompt:

- A pessoa se cadastra, registra os livros que está lendo e já leu, avalia cada um com
  nota de 1 a 5 estrelas (estrela cheia, sem meia-estrela) e uma review opcional, e
  acompanha a atividade de leitura de quem ela segue.
- O perfil é PRIVADO por padrão. O modelo social é "seguir com aprovação": a pessoa A
  pede para seguir B, e só depois que B aprova, A passa a ver o que B posta (reviews,
  progresso de leitura, atividade). É o equivalente a um Instagram privado, mas focado
  em livros — um clube de leitura fechado, não uma rede aberta de descoberta.
- É um produto pessoal e íntimo, não uma vitrine pública. O tom deve refletir isso.

PLATAFORMA E DIREÇÃO VISUAL

- Web responsivo, mobile-first: desenhe cada tela primeiro pensando em uma viewport
  estreita (smartphone), e garanta que o mesmo layout se adapte bem a uma tela larga
  (desktop/tablet) sem parecer um app mobile esticado — mas a prioridade de design é a
  experiência mobile.
- Direção estética: aconchegante e literária (warm, editorial). Pense em algo entre um
  diário de leitura físico e uma revista literária independente — tipografia com
  caráter para títulos, bastante espaço em branco, paleta quente (tons terrosos,
  creme, um acento quente — não uma paleta fria/corporativa de SaaS). Cantos suaves,
  nada de visual "gamificado" ou cheio de badges brilhantes.
- Apenas TEMA CLARO nesta rodada — não gere variação escura.
- Use dados fictícios plausíveis em todas as telas: nomes de pessoas, capas de livro
  (pode usar blocos coloridos com o título do livro escrito por cima como placeholder
  de capa, já que não há acesso a imagens reais de capas), avatares (iniciais ou
  ilustração simples), textos de review de exemplo. Nenhum dado deve parecer "Lorem
  Ipsum" — escreva textos curtos e plausíveis em português.

O QUE PROJETAR — exatamente estas 9 áreas, cada uma com as telas/estados descritos.
Não inclua nenhuma tela ou funcionalidade fora desta lista.

1) AUTENTICAÇÃO / ONBOARDING
   - Tela de login (e-mail + senha).
   - Tela de cadastro (e-mail, senha, @handle, nome de exibição).
   - Estado de erro de credenciais inválidas no login.

2) PERFIL
   - Tela do meu próprio perfil: nome, @handle, bio, e um resumo da minha atividade
     (ex.: quantos livros lidos, seguidores/seguindo — só visível pra mim mesmo).
   - Tela de edição de perfil (nome de exibição e bio; o @handle aparece mas NÃO é
     editável — deixe isso visualmente claro, ex.: campo desabilitado com uma
     explicação curta de que o @handle é permanente).
   - Tela de busca de usuário (buscar por @handle ou nome), com resultado mínimo:
     avatar, nome, @handle, e um botão de "seguir" — sem prévia de conteúdo da pessoa
     (perfil é privado, lembre-se).

3) FOLLOW
   - Estado de "perfil bloqueado": ao tentar ver alguém que ainda não aprovou meu
     follow, mostrar um estado claro de "conteúdo privado — peça para seguir" em vez
     do feed dessa pessoa.
   - Lista de pedidos de follow recebidos, com ação de aprovar/recusar por item.
   - Lista de seguidores e lista de quem eu sigo (duas abas ou duas telas).
   - Um botão de follow com os três estados possíveis: "seguir", "pedido enviado"
     (pendente), "seguindo" (aprovado) — deixe visualmente óbvio qual é qual.

4) CATÁLOGO DE LIVROS
   - Tela de busca de livro (por título/autor), com resultados em grade ou lista
     mostrando capa, título, autor.
   - Tela de detalhe de um livro: capa, título, autor, ano, nota média da comunidade,
     quantos leitores, e as ações "quero ler" / "começar a ler" / "marcar como lido".

5) READING SESSION (ciclo de leitura)
   - Tela de "livro em andamento": mostra a página atual, e um jeito rápido de
     atualizar o progresso (ex.: campo numérico + botão).
   - Tela/ação de finalizar a leitura (com opção de já deixar uma review no mesmo
     fluxo, ou pular).
   - Tela de histórico de leitura do usuário (lista de livros lidos/lendo, com status
     visualmente distinto entre "lendo" e "lido").
   - Lista de "quero ler" (want-to-read), separada do histórico de leitura.

6) REVIEW
   - Componente/tela de criar review: seletor de 1 a 5 estrelas (estrela cheia), campo
     de texto opcional, e um toggle "contém spoiler".
   - Como uma review com `containsSpoiler` marcado é exibida: o texto continua visível
     por padrão com um aviso sutil de spoiler (ex.: uma etiqueta "contém spoiler"), OU
     desenhe também uma variante com o texto borrado/recolhido e um botão "mostrar
     mesmo assim" — a decisão de ocultar é do cliente (app), não da API, então mostre
     essa camada de interação no protótipo.

7) FEED
   - Tela principal de feed: lista cronológica (mais recente primeiro) misturando os
     tipos de evento: "começou a ler X", "terminou de ler X", "avaliou X com N
     estrelas" (mostrando a review), "atualizou o progresso de X para a página N".
     Cada tipo de card deve ser visualmente diferente o suficiente para reconhecer o
     tipo de evento rapidamente ao rolar a lista.
   - Estado de feed vazio (usuário novo ou que ainda não segue ninguém aprovado) — uma
     mensagem convidativa, não um erro.
   - Indicador de "carregar mais" ao chegar ao fim da página atual (paginação).

8) INTERAÇÕES
   - Botão de curtir num item de feed, com contagem, e um estado visualmente diferente
     quando o próprio usuário já curtiu.
   - Seção de comentários de um item de feed: lista de comentários, campo para
     comentar, e a possibilidade de responder a um comentário específico (só 1 nível
     de resposta — não desenhe respostas aninhadas dentro de respostas).
   - Estado de um comentário apagado: aparece como "[removido]" no lugar do texto
     original, não desaparece da lista.

9) NOTIFICAÇÕES
   - Ícone de sino com contador de não lidas (badge numérico).
   - Painel/tela de notificações listando os tipos: pedido de follow recebido, follow
     aprovado, comentário no meu conteúdo, resposta ao meu comentário, curtida no meu
     conteúdo — cada tipo com um texto e ícone que deixe claro do que se trata.
   - Diferença visual clara entre notificação lida e não lida.
   - Ação de "marcar todas como lidas".

REGRAS DE NEGÓCIO QUE PRECISAM APARECER NA INTERFACE

- Perfil é privado por padrão: sem follow aprovado, nada do conteúdo de outra pessoa
  aparece — só o resultado de busca (avatar, nome, @handle) e o botão de seguir.
- Nota é sempre estrela CHEIA de 1 a 5 — nunca desenhe meia-estrela ou um sistema de
  10 pontos.
- Uma review pode ter só a nota, sem texto — o design deve comportar esse caso sem
  parecer "quebrado" ou incompleto visualmente.
- `containsSpoiler` é uma flag de interface, não uma trava de acesso — o texto sempre
  existe por trás; o app decide como escondê-lo (ver item 6 acima).
- O feed mostra só atividade de quem eu sigo E foi aprovado, mais a minha própria.
- Recusar um pedido de follow não gera nenhum aviso pra quem pediu — não desenhe uma
  tela ou notificação de "seu pedido foi recusado".
- @handle nunca é editável depois do cadastro.

Gere o protótipo cobrindo as 9 áreas acima, com navegação coerente entre elas (ex.: da
tela de feed dá pra chegar ao detalhe de um livro, ao perfil de quem postou, aos
comentários do item). Não inclua nenhuma funcionalidade fora desta lista (ex.: nada de
clubes de leitura, metas de leitura anuais, citações favoritas, modo escuro, ou posts
de texto livre — está tudo fora do escopo desta versão).
```
