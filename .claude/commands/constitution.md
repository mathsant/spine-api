---
description: Cria ou atualiza a constituição do projeto (princípios que governam toda feature).
---

O usuário quer estabelecer ou atualizar a constituição do projeto em `.specify/memory/constitution.md`.

Argumentos do usuário (podem estar vazios — nesse caso, pergunte interativamente):
$ARGUMENTS

## Sua tarefa

1. Leia o arquivo atual em `.specify/memory/constitution.md`. Se ele ainda tem placeholders (`[PRINCÍPIO_N_NOME]`, `[NOME DO PROJETO]`, etc.), trate como uma criação inicial; senão, trate como uma atualização incremental.

2. Determine os princípios do projeto:
   - Se o usuário já descreveu os princípios nos argumentos, use-os como base.
   - Caso contrário, pergunte ao usuário (uma pergunta por vez, via texto) quais são os 3-5 princípios não-negociáveis deste projeto específico. Evite sugerir princípios genéricos ("escreva código limpo") — busque regras concretas e verificáveis (ex.: "toda mudança de schema precisa de migration reversível", "nenhuma tela nova sem estado de loading e de erro tratados").

   - **Regra fixa do kit — não mexer**: o princípio "Idioma do código: inglês" já vem preenchido no template e **não** é um placeholder. Mantenha-o intacto (texto e justificativa), não o renumere para fora, não o remova e não peça ao usuário para validá-lo. Ele sempre existe além dos 3-5 princípios específicos do projeto. Só registre exceção se o usuário pedir explicitamente — e nesse caso a exceção vai na seção "Restrições Adicionais", não na alteração do princípio.

3. Preencha `.specify/memory/constitution.md` substituindo todos os placeholders (o princípio fixo "Idioma do código: inglês" não tem placeholder — deixe como está):
   - Nome do projeto.
   - Cada princípio com nome + descrição concreta + justificativa.
   - Restrições adicionais e fluxo de desenvolvimento, se aplicável (ou remova essas seções se não houver nada a declarar).
   - Seção de Governança.
   - Versão: siga semver. MAJOR se um princípio foi removido/redefinido de forma incompatível, MINOR se um princípio foi adicionado, PATCH para redação/clarificação. Datas em formato ISO (AAAA-MM-DD); "Ratificada em" só muda na criação inicial.

4. Atualize o "Sync Impact Report" no comentário HTML do topo do arquivo: versão antiga → nova, lista de princípios alterados, e quais templates (`spec-template.md`, `plan-template.md`, `tasks-template.md`) podem precisar de revisão manual por causa da mudança.

5. Depois de salvar, revise rapidamente `.specify/templates/plan-template.md` — a seção "Verificação da Constituição" deve referenciar os princípios reais, não genéricos. Se não bater, avise o usuário quais linhas ajustar (não edite templates sem confirmação).

6. Reporte ao usuário: versão nova, princípios definidos, e qualquer template que precisa de atenção manual.

**Não** invente princípios que o usuário não validou. Prefira perguntar a assumir.

**Nota**: a constituição define POR QUÊ/O QUÊ é inegociável (princípios). COMO o projeto é estruturado (stack, pastas, convenções) é papel do `/architecture`, gravado em `.specify/memory/architecture.md` — não misture os dois arquivos.
