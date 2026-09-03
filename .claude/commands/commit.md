---
description: Cria um commit git com as mudanças atuais do projeto.
---

Argumentos opcionais do usuário (ex.: contexto extra sobre o que foi feito, ou pedido para focar só em parte das mudanças):
$ARGUMENTS

## Sua tarefa

1. Rode em paralelo:
   - `git status` (para ver arquivos não rastreados/modificados — nunca use `-uall`)
   - `git diff` (mudanças não staged) e `git diff --staged` (mudanças já staged)
   - `git log --oneline -10` (para seguir o estilo de mensagens de commit já usado neste repo)

2. Analise o diff e monte um resumo do que mudou (feature nova, correção, refactor, docs, config, etc.). A mensagem deve focar no **porquê**, não só listar arquivos.

3. Antes de dar `git add`, revise a lista de arquivos modificados/não rastreados:
   - Nunca inclua arquivos que parecem segredo/credencial (`.env`, chaves, tokens) — se aparecer algo assim, avise o usuário em vez de commitar.
   - Prefira `git add <arquivos específicos>` a `git add -A`/`git add .` quando der para ser preciso, especialmente se houver arquivos não relacionados à mudança atual no working tree.

4. Monte a mensagem de commit:
   - Primeira linha curta e no imperativo (ex.: "Adiciona validação de e-mail no cadastro"), sem exceder ~72 caracteres.
   - Corpo opcional (linha em branco + 1-3 frases) só se o "porquê" não for óbvio pela primeira linha.
   - Siga a convenção de mensagens já usada no histórico do repo (`git log`), se houver uma clara (ex.: Conventional Commits, prefixos de área).

5. Crie o commit via heredoc para preservar a formatação:
   ```
   git commit -m "$(cat <<'EOF'
   <mensagem aqui>
   EOF
   )"
   ```

6. Rode `git status` de novo para confirmar que o commit foi criado e não sobrou nada inesperado staged.

7. Reporte ao usuário: hash curto do commit, mensagem usada, e arquivos incluídos.

## Regras importantes

- **Só commite as mudanças que já existem no working tree** — este comando não implementa nada, só empacota o que já foi feito.
- **Nunca** rode `git commit --amend` a menos que o usuário peça explicitamente nos argumentos.
- **Nunca** pule hooks (`--no-verify`) nem use `--no-gpg-sign`, a menos que pedido explicitamente.
- Se o hook de pre-commit falhar, corrija o problema indicado e crie um **novo** commit — não tente `--amend` em cima de um commit que não foi criado.
- Se não houver nada para commitar (`git status` limpo), diga isso ao usuário e não crie um commit vazio.
- Este comando **não** dá push. Para enviar ao remoto, use `/push` depois.
