---
description: Identifica ambiguidades no spec.md da feature atual e faz perguntas direcionadas para resolvê-las.
---

Argumentos opcionais do usuário (ex.: focar em uma área específica):
$ARGUMENTS

**Nota**: o `/specify` já pergunta qualquer dúvida real no momento em que escreve a spec, então normalmente ela já chega aqui sem pendências. Use este comando para uma segunda passada de revisão, para reabrir uma spec antiga, ou quando o usuário quiser revisitar uma decisão já tomada.

## Sua tarefa

1. Rode:
   ```
   .specify/scripts/bash/check-prerequisites.sh --json
   ```
   para localizar o `SPEC_FILE` da feature atual. Se falhar, avise o usuário para rodar `/specify` primeiro.

2. Leia o `spec.md` completo. Liste todas as ambiguidades, tanto os marcadores explícitos `[NEEDS CLARIFICATION: ...]` quanto lacunas implícitas (requisito vago, critério de sucesso não-mensurável, entidade sem relação clara, comportamento de erro não definido).

3. Priorize até 5 perguntas de maior impacto (as que mais mudam o design se respondidas diferente). Não pergunte sobre detalhes triviais.

4. Faça **uma pergunta por vez**, aguardando a resposta do usuário antes de seguir para a próxima. Prefira perguntas de múltipla escolha ou sim/não quando possível, para facilitar a resposta.

5. Depois de cada resposta:
   - Remova o marcador `[NEEDS CLARIFICATION: ...]` correspondente do corpo da spec, se existir, e ajuste o requisito/cenário afetado com a informação nova.
   - Adicione uma linha em "Esclarecimentos" no `spec.md`, sob uma subseção com a data de hoje:
     ```
     ### Sessão AAAA-MM-DD
     - P: [pergunta] → R: [resposta]
     ```

6. Ao final, reporte um resumo: quantas ambiguidades foram resolvidas, quais (se houver) ficaram em aberto e por quê, e se a spec já está pronta para `/plan`.

Não gere `plan.md` neste comando — o objetivo é só deixar a spec inequívoca.
