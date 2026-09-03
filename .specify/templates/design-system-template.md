# Design System de [NOME DO PROJETO]

**Origem**: [importado do Claude Design / arquivo de origem]
**Tipo de export**: [imagens PNG/PDF | canvas .html | arquivos .dc.html]
**Última atualização**: [DATA]

<!--
Este arquivo é a fonte da verdade sobre a LINGUAGEM VISUAL do projeto: cores,
tipografia, espaçamento e demais tokens definidos no design. É gerado por
/design-import a partir do export do Claude Design.

/plan, /tasks e /implement leem este arquivo automaticamente em features com UI
(via o vínculo tela↔feature registrado por /specify em design/manifest.md).
Rodar /design-import de novo sobrescreve as seções geradas, mas preserva o que
estiver entre os marcadores SDD:MANUAL:INICIO / SDD:MANUAL:FIM.
-->

## Cores

| Token | Valor | Uso |
|---|---|---|
| [ex.: `--color-primary`] | [ex.: `#2563EB`] | [ex.: botões primários, links] |
| [ex.: `--color-surface`] | [ex.: `#FFFFFF`] | [ex.: fundo de cards] |
| [ex.: `--color-text`] | [ex.: `#111827`] | [ex.: texto padrão] |

## Tipografia

- **Famílias**: [ex.: `Inter` (corpo), `Söhne` (títulos) — com fallback stack]
- **Escala**: [ex.: 12 / 14 / 16 / 20 / 24 / 32 / 48 px]
- **Pesos**: [ex.: 400 regular, 500 medium, 700 bold]
- **Line-height**: [ex.: 1.5 corpo, 1.2 títulos]

## Espaçamento

[ex.: escala de 4px — 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Liste os valores reais
usados no design, não uma escala genérica.]

## Raios de borda

[ex.: 0 / 4 / 8 / 12 / 9999 (pill)]

## Sombras / elevação

| Nível | Valor |
|---|---|
| [ex.: `sm`] | [ex.: `0 1px 2px rgba(0,0,0,0.05)`] |
| [ex.: `md`] | [ex.: `0 4px 12px rgba(0,0,0,0.10)`] |

## Breakpoints

[ex.: mobile `< 640`, tablet `640–1024`, desktop `> 1024`. Só os que o design usa.]

## Grid / layout

[ex.: container máx. 1200px, gutter 24px, 12 colunas. Ou "layout fluido, sem grid fixo".]

## Iconografia

[ex.: stroke-based, grade 24px, 1.5px de traço, estilo linear consistente. Origem dos
ícones se identificável.]

## Estados

- **Hover**: [ex.: escurece o fundo em ~8%]
- **Focus**: [ex.: anel de 2px `--color-primary` com offset]
- **Disabled**: [ex.: opacidade 0.4, cursor `not-allowed`]
- **Erro**: [ex.: borda e texto em `--color-danger`]

## Modo escuro

[Se o design define um tema escuro, liste os overrides de token aqui. Senão: "N/A".]

## Tokens em código

- **Arquivo gerado**: [ex.: `design/tokens.css`]
- **Formato**: [ex.: CSS custom properties / tema Tailwind / tokens JSON]
- **Como consumir**: [ex.: importar `design/tokens.css` no entrypoint de estilos e
  referenciar as variáveis; ou fazer `merge` do objeto em `tailwind.config.js`]

<!-- SDD:MANUAL:INICIO -->
<!-- Anotações manuais preservadas entre re-execuções de /design-import.
     Ex.: decisões de mapeamento, tokens que o design não cobre, exceções. -->
<!-- SDD:MANUAL:FIM -->
