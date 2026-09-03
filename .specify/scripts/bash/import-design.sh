#!/usr/bin/env bash
# Importa um export do Claude Design: copia os arquivos para design/assets/,
# detecta o tipo de export e imprime o resultado em JSON.
#
# Uso: import-design.sh [--json] "caminho/para/o/export"
#   O caminho pode ser um arquivo (ex.: um .html de canvas, um .pdf) ou uma
#   pasta (ex.: ~/Downloads/meu-design/ com imagens e/ou .dc.html dentro).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

JSON_MODE=false
ARGS=()
for arg in "$@"; do
    case "$arg" in
        --json) JSON_MODE=true ;;
        *) ARGS+=("$arg") ;;
    esac
done

if [[ ${#ARGS[@]} -eq 0 ]]; then
    echo "ERRO: informe o caminho do export. Uso: import-design.sh [--json] \"caminho\"" >&2
    exit 1
fi

SRC="${ARGS[*]}"
# Expande um ~ inicial (o shell não expande dentro de aspas).
case "$SRC" in
    "~") SRC="$HOME" ;;
    "~/"*) SRC="$HOME/${SRC#\~/}" ;;
esac

if [[ ! -e "$SRC" ]]; then
    echo "ERRO: caminho não encontrado: $SRC" >&2
    exit 1
fi

REPO_ROOT=$(get_repo_root)
DESIGN_DIR="$REPO_ROOT/design"
ASSETS_DIR="$DESIGN_DIR/assets"
SCREENS_DIR="$DESIGN_DIR/screens"

mkdir -p "$ASSETS_DIR" "$SCREENS_DIR"

# Copia o conteúdo do export para design/assets/ (sobrescreve o que já existir).
if [[ -d "$SRC" ]]; then
    cp -R "$SRC"/. "$ASSETS_DIR"/
else
    cp "$SRC" "$ASSETS_DIR"/
fi

# Detecta o tipo de export varrendo o que foi copiado.
EXPORT_KIND="unknown"

# canvas-html: um .html que contém o bloco de estado do canvas (id="appifact-doc").
while IFS= read -r html_file; do
    if grep -q "appifact-doc" "$html_file" 2>/dev/null; then
        EXPORT_KIND="canvas-html"
        break
    fi
done < <(find "$ASSETS_DIR" -type f -iname '*.html' 2>/dev/null)

# dc-files: arquivos .dc.html soltos (com ou sem canvas.json).
if [[ "$EXPORT_KIND" == "unknown" ]]; then
    if [[ -n "$(find "$ASSETS_DIR" -type f -iname '*.dc.html' 2>/dev/null | head -n 1)" ]]; then
        EXPORT_KIND="dc-files"
    fi
fi

# images: PNG/JPG/WEBP/PDF exportados do canvas.
if [[ "$EXPORT_KIND" == "unknown" ]]; then
    if [[ -n "$(find "$ASSETS_DIR" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.pdf' \) 2>/dev/null | head -n 1)" ]]; then
        EXPORT_KIND="images"
    fi
fi

ASSET_COUNT=$(find "$ASSETS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')

if $JSON_MODE; then
    printf '{"DESIGN_DIR":"%s","ASSETS_DIR":"%s","SCREENS_DIR":"%s","EXPORT_KIND":"%s","ASSET_COUNT":%s}\n' \
        "$DESIGN_DIR" "$ASSETS_DIR" "$SCREENS_DIR" "$EXPORT_KIND" "$ASSET_COUNT"
else
    echo "Design dir:      $DESIGN_DIR"
    echo "Assets:          $ASSETS_DIR"
    echo "Tipo detectado:  $EXPORT_KIND"
    echo "Arquivos:        $ASSET_COUNT"
fi
