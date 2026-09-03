#!/usr/bin/env bash
# Prepara o plan.md da feature atual a partir do template.
# Deve ser rodado com a branch da feature (NNN-nome) já ativa.
#
# Uso: setup-plan.sh [--json]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

JSON_MODE=false
for arg in "$@"; do
    [[ "$arg" == "--json" ]] && JSON_MODE=true
done

eval "$(get_feature_paths)"

if ! check_feature_branch "$CURRENT_BRANCH"; then
    echo "ERRO: branch atual '$CURRENT_BRANCH' não segue o padrão NNN-nome-da-feature." >&2
    echo "Rode /specify primeiro para criar a feature." >&2
    exit 1
fi

if [[ ! -f "$SPEC_FILE" ]]; then
    echo "ERRO: spec.md não encontrado em $SPEC_FILE. Rode /specify primeiro." >&2
    exit 1
fi

TEMPLATE_FILE="$REPO_ROOT/.specify/templates/plan-template.md"
mkdir -p "$FEATURE_DIR" "$CONTRACTS_DIR"

if [[ ! -f "$PLAN_FILE" ]]; then
    if [[ -f "$TEMPLATE_FILE" ]]; then
        cp "$TEMPLATE_FILE" "$PLAN_FILE"
    else
        echo "# Plano de implementação: [FEATURE]" > "$PLAN_FILE"
    fi
fi

if $JSON_MODE; then
    printf '{"FEATURE_DIR":"%s","PLAN_FILE":"%s","SPEC_FILE":"%s","RESEARCH_FILE":"%s","DATA_MODEL_FILE":"%s","QUICKSTART_FILE":"%s","CONTRACTS_DIR":"%s","BRANCH_NAME":"%s"}\n' \
        "$FEATURE_DIR" "$PLAN_FILE" "$SPEC_FILE" "$RESEARCH_FILE" "$DATA_MODEL_FILE" "$QUICKSTART_FILE" "$CONTRACTS_DIR" "$CURRENT_BRANCH"
else
    echo "Feature:  $CURRENT_BRANCH"
    echo "Plan:     $PLAN_FILE"
    echo "Spec:     $SPEC_FILE"
fi
