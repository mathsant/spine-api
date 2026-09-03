---
description: Importa um design do Claude Design e documenta o Design System, as telas e os componentes reutilizáveis em design/.
---

Caminho do export do Claude Design já baixado (arquivo ou pasta, ex.: `~/Downloads/meu-design` ou `~/Downloads/meu-design.html`):
$ARGUMENTS

## Sua tarefa

O objetivo é trazer um design feito no Claude Design para dentro do repositório e **documentá-lo**: Design System (tokens), catálogo de telas e inventário de componentes reutilizáveis, tudo em `design/`. É conhecimento por-projeto (como `/architecture`) — rode **uma vez por projeto** e de novo só quando o design mudar.

Depois que esta pasta existe, o fluxo passa a consumi-la automaticamente em features com UI: o `/specify` identifica quais telas do catálogo a feature realiza e grava o vínculo tela↔feature no `design/manifest.md`; o `/plan` mapeia cada tela vinculada a uma rota/página e a componentes de `design/components.md`, usando `design/tokens.*` como fonte visual; o `/tasks` cita o arquivo de design em cada tarefa de UI; e o `/implement` lê esses arquivos antes de construir a tela. O design **nunca** sobrepõe a spec: se divergirem, a spec vence e o comando reporta a divergência. Se `design/` não existir ou a feature não tiver UI, o fluxo segue sem — igual a `architecture.md` quando ausente.

### Passo 1 — Copiar e detectar

Rode:
```
.specify/scripts/bash/import-design.sh --json "$ARGUMENTS"
```
Isso cria `design/`, `design/assets/`, `design/screens/`, copia o export para `design/assets/` e detecta o tipo. Capture do JSON: `DESIGN_DIR`, `ASSETS_DIR`, `SCREENS_DIR`, `EXPORT_KIND`, `ASSET_COUNT`.

### Passo 2 — Varredura conforme `EXPORT_KIND`

- **`images`** (PNG/PDF exportados do canvas): análise visual. Leia cada imagem em `design/assets/` e infira os tokens (cores, tipografia, espaçamento, raios, sombras), as telas e os componentes a partir do que se vê. Deixe claro na documentação que os valores são inferidos visualmente e podem precisar de ajuste fino.
- **`canvas-html`** (a página do canvas publicado): localize o bloco `<script id="appifact-doc">` no `.html` em `design/assets/`, parseie o JSON e extraia os `.dc.html`, o `canvas.json` e as imagens embutidas (base64) para `design/assets/extracted/` — decodifique as imagens. Analise o markup e o CSS inline dos `.dc.html`: é a fonte mais precisa de tokens exatos e de quais elementos se repetem entre artboards.
- **`dc-files`** (arquivos `.dc.html` + `canvas.json` soltos): leia-os direto de `design/assets/`. Mesma análise de markup/CSS do caso acima.
- **`unknown`**: o script não reconheceu o export. **Pare e pergunte ao usuário** o que há na pasta / qual formato ele exportou, antes de continuar.

**Regra crítica — dúvida bloqueia, não assume** (mesma de `/specify` e `/architecture`): se o export estiver vazio, incompleto, ambíguo, ou você não tiver confiança sobre um token/tela/componente, pare e pergunte ao usuário na conversa, uma pergunta por vez. Não invente valores "no chute".

### Passo 3 — Gravar a documentação

A partir dos templates, preencha com valores concretos (sem deixar placeholders genéricos):

- `design/design-system.md` — de `.specify/templates/design-system-template.md`.
- `design/screens/<slug-da-tela>.md` — um por artboard/tela, de `.specify/templates/design-screen-template.md`. `slug` em **inglês**, minúsculas com hífen (regra fixa do kit: nomes de arquivo sempre em inglês; ex.: `login.md`, `order-details.md`).
- `design/components.md` — de `.specify/templates/design-components-template.md`. Inclua um componente só se ele aparece em 2+ telas ou o design o marca como reutilizável. Nomeie cada componente em **inglês** (vira nome de componente no código; ex.: `PrimaryButton`, `OrderCard`).
- `design/manifest.md` — de `.specify/templates/design-manifest-template.md`. Preencha as tabelas de Telas e Componentes; deixe a coluna "Feature" com `—` (é preenchida pelo `/specify` quando a tela vira spec) e "Status" com `—` (à mão conforme a implementação avança). Registre a data na seção "Histórico de importações".

**No re-run** (o comando já foi rodado antes): sobrescreva o conteúdo gerado, mas **preserve** tudo que estiver entre `<!-- SDD:MANUAL:INICIO -->` e `<!-- SDD:MANUAL:FIM -->` em cada arquivo. Em `manifest.md`, **acrescente** uma linha nova em "Histórico de importações" com o que mudou (telas novas, tokens alterados, componentes removidos) em vez de substituir o histórico.

### Passo 4 — Tokens em código

1. Leia `.specify/memory/architecture.md`, se existir, para descobrir o formato de estilo do projeto: tema Tailwind (`tailwind.config.*`), CSS custom properties, CSS-in-JS / theme object, ou tokens JSON.
2. Se `architecture.md` não existir, **ou** não deixar o formato claro, **pergunte ao usuário** qual formato ele quer (uma pergunta objetiva com essas opções). Não assuma.
3. Grave o arquivo em `design/tokens.<ext>` conforme o formato escolhido (ex.: `design/tokens.css`, `design/tokens.tailwind.js`, `design/tokens.json`), com os tokens da varredura. É um arquivo de **referência** — não altere código do projeto. Registre em `design/design-system.md` (seção "Tokens em código") o caminho, o formato e como o projeto deve consumi-lo.

### Passo 5 — Reportar

Diga ao usuário: o tipo de export detectado, quantas telas e quantos componentes foram documentados, o caminho do arquivo de tokens, e que a partir daqui `/specify`, `/plan`, `/tasks` e `/implement` passam a consumir `design/` automaticamente em features com UI (o `/specify` é quem grava o vínculo tela↔feature no `manifest.md`).

## Notas

- Não toca em `specs/` nem em código de implementação.
- O vínculo tela↔feature (coluna "Feature" do `manifest.md` e seção "Feature relacionada" de cada `screens/<tela>.md`) não é escrito por este comando — é preenchido depois pelo `/specify`, quando a tela vira spec.
- `design/assets/` pode ficar grande (um `.html` de canvas tem ~2 MB; PDFs pesam). Se não quiser versionar os brutos, adicione `design/assets/` ao `.gitignore` — a documentação `.md` e `design/tokens.*` continuam versionadas.
