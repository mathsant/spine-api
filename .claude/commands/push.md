---
description: Envia os commits da branch atual para o remoto.
---

Argumentos opcionais do usuário (ex.: nome de remoto/branch específico):
$ARGUMENTS

## Sua tarefa

1. Rode em paralelo:
   - `git status` (checar se há mudanças não commitadas)
   - `git branch --show-current` (branch atual)
   - `git log @{u}..HEAD --oneline` (commits locais ainda não enviados; se não houver upstream configurado, o comando falha — trate isso como "branch sem upstream ainda")
   - `git remote -v` (confirmar que existe remoto configurado)

2. Se houver mudanças não commitadas no working tree (`git status` não-limpo), avise o usuário e pergunte se quer commitar primeiro (`/commit`) antes de dar push — não invente um commit sozinho.

3. Se não houver nenhum commit local à frente do remoto (branch já sincronizada), informe isso ao usuário e não rode `git push`.

4. Antes de enviar, confira e reporte ao usuário: branch atual, remoto de destino (padrão `origin` se não especificado nos argumentos), e a lista de commits que serão enviados.

5. Rode o push:
   - Se a branch já tem upstream configurado: `git push`.
   - Se **não** tem upstream ainda (primeiro push da branch): `git push -u origin <branch-atual>` (ou o remoto/branch informado nos argumentos).

6. Reporte o resultado: sucesso (com o range de commits enviados) ou falha (com o erro real do git, sem tentar contornar sozinho).

## Regras importantes

- **Nunca** use `--force` ou `--force-with-lease` a menos que o usuário peça isso explicitamente nesta mensagem — se o push for rejeitado por divergência com o remoto, explique a situação ao usuário e pergunte como prosseguir (ex.: `git pull --rebase` primeiro) em vez de forçar.
- **Nunca** empurre para um remoto diferente do configurado no repo sem o usuário indicar isso explicitamente.
- Se a branch atual for `main`/`master` (ou a branch padrão do repo) e o projeto parecer ter fluxo de feature branches (`specs/NNN-.../` existente), confirme com o usuário antes de empurrar direto — pode ser não-intencional.
- Este comando não cria nem edita commits — só envia o que já existe localmente. Para empacotar mudanças primeiro, use `/commit`.
