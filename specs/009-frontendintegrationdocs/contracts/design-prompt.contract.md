# Contrato: `docs/design-prompt.md`

## Critério de aceite (RF-013 a RF-019)

O prompt só é considerado completo quando contém, nesta ordem lógica (não precisa ser esta ordem literal no texto):

1. **Contexto do produto** — auto-suficiente: alguém sem acesso a `product.md` entende que é uma rede social de leitores, privada por padrão, com follow por aprovação.
2. **Plataforma e direção visual** — web responsivo mobile-first; direção estética aconchegante/literária (warm, editorial); apenas tema claro.
3. **As 9 áreas do MVP, cada uma com as telas que a compõem** — nem uma a mais, nem uma a menos:
   - Autenticação/onboarding (cadastro, login)
   - Perfil (ver/editar o próprio perfil; busca de usuário por `@handle`/nome)
   - Follow (enviar pedido, aprovar/recusar, listar seguidores/seguindo)
   - Catálogo de livros (buscar, abrir um livro, marcar `want_to_read`)
   - Reading session (iniciar leitura, registrar progresso, finalizar)
   - Review (criar/ver nota 1–5 + texto opcional + flag de spoiler)
   - Feed (lista paginada de atividade de quem o usuário segue)
   - Interações (comentar e curtir um item de feed)
   - Notificações (listar, marcar como lida)
4. **Regras de negócio que afetam a interface** — perfil bloqueado até follow aprovado; nota é estrela cheia (sem meia-estrela); review pode não ter texto; spoiler é uma flag/toggle visual, o texto sempre existe por trás; feed mostra só quem segue e foi aprovado.
5. **Orientação de dados mockados** — usar capas de livro, nomes e avatares fictícios plausíveis, já que o Claude Design não acessa a API real.
6. **Nenhuma menção a área fora do MVP** — nada de DNF, clubes de leitura, metas de leitura, citações favoritas, retrospectiva anual (todas em "fora do MVP" no `product.md`).

## Como verificar

Apresentar o texto final ao usuário nesta conversa/feature e obter aprovação explícita antes de marcar a tarefa correspondente como concluída (RF-019) — checklist automatizado não substitui essa aprovação.
