#!/usr/bin/env bash
# Cria uma nova feature: calcula o próximo número, cria a branch NNN-nome-curto,
# cria specs/NNN-nome-curto/spec.md a partir do template e imprime o resultado em JSON.
#
# Uso: create-new-feature.sh [--json] [--slug <slug-em-ingles>] "descrição da feature em linguagem natural"
#
# --slug: slug curto EM INGLÊS para o nome da branch/pasta (regra fixa do kit:
#         nomes de pasta e branch sempre em inglês). Se omitido, o slug é derivado
#         da descrição — o que só serve quando a descrição já está em inglês.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

JSON_MODE=false
SLUG_OVERRIDE=""
ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --json) JSON_MODE=true; shift ;;
        --slug) SLUG_OVERRIDE="${2:-}"; shift 2 ;;
        *) ARGS+=("$1"); shift ;;
    esac
done

if [[ ${#ARGS[@]} -eq 0 ]]; then
    echo "ERRO: descreva a feature. Uso: create-new-feature.sh [--json] \"descrição\"" >&2
    exit 1
fi

DESCRIPTION="${ARGS[*]}"
REPO_ROOT=$(get_repo_root)
SPECS_DIR="$REPO_ROOT/specs"
mkdir -p "$SPECS_DIR"

# Próximo número: maior NNN existente em specs/ + 1.
LAST_NUM=0
if [[ -d "$SPECS_DIR" ]]; then
    for dir in "$SPECS_DIR"/*/; do
        [[ -d "$dir" ]] || continue
        base=$(basename "$dir")
        if [[ "$base" =~ ^([0-9]{3})- ]]; then
            num=$((10#${BASH_REMATCH[1]}))
            if (( num > LAST_NUM )); then
                LAST_NUM=$num
            fi
        fi
    done
fi
NEXT_NUM=$(printf "%03d" $((LAST_NUM + 1)))

# Slug curto (até 4 palavras, minúsculo, separado por hífen).
# Preferir o --slug em inglês passado pelo /specify; senão, derivar da descrição.
SLUG_SOURCE="${SLUG_OVERRIDE:-$DESCRIPTION}"
SLUG=$(echo "$SLUG_SOURCE" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9 ]//g' \
    | tr -s ' ' '\n' \
    | head -n 4 \
    | tr '\n' '-' \
    | sed -E 's/-+$//')

if [[ -z "$SLUG" ]]; then
    SLUG="feature"
fi

BRANCH_NAME="${NEXT_NUM}-${SLUG}"
FEATURE_DIR="$SPECS_DIR/$BRANCH_NAME"
SPEC_FILE="$FEATURE_DIR/spec.md"
TEMPLATE_FILE="$REPO_ROOT/.specify/templates/spec-template.md"

mkdir -p "$FEATURE_DIR"

if [[ -f "$TEMPLATE_FILE" ]]; then
    cp "$TEMPLATE_FILE" "$SPEC_FILE"
else
    echo "# Especificação: [FEATURE]" > "$SPEC_FILE"
fi

# Cria a branch a partir do estado atual (só se estivermos num repo git com commits).
if git rev-parse --verify HEAD >/dev/null 2>&1; then
    git checkout -b "$BRANCH_NAME" >/dev/null 2>&1 || {
        echo "AVISO: não foi possível criar a branch '$BRANCH_NAME' (talvez já exista)." >&2
    }
else
    echo "AVISO: repositório sem commits ainda; branch não foi criada automaticamente." >&2
fi

if $JSON_MODE; then
    printf '{"BRANCH_NAME":"%s","SPEC_FILE":"%s","FEATURE_DIR":"%s","FEATURE_NUM":"%s"}\n' \
        "$BRANCH_NAME" "$SPEC_FILE" "$FEATURE_DIR" "$NEXT_NUM"
else
    echo "Branch:    $BRANCH_NAME"
    echo "Spec:      $SPEC_FILE"
    echo "Diretório: $FEATURE_DIR"
fi
