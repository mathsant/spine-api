#!/usr/bin/env bash
# Verifica se os artefatos necessários da feature atual existem, conforme as flags.
# Usado por /tasks, /analyze e /implement antes de prosseguir.
#
# Uso: check-prerequisites.sh [--json] [--require-tasks] [--include-tasks]
#   --require-tasks   falha se tasks.md não existir (usado por /implement)
#   --include-tasks   inclui o path de tasks.md na saída JSON mesmo sem exigi-lo

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

JSON_MODE=false
REQUIRE_TASKS=false
INCLUDE_TASKS=false
for arg in "$@"; do
    case "$arg" in
        --json) JSON_MODE=true ;;
        --require-tasks) REQUIRE_TASKS=true ;;
        --include-tasks) INCLUDE_TASKS=true ;;
    esac
done

eval "$(get_feature_paths)"

OK=true

if ! check_feature_branch "$CURRENT_BRANCH"; then
    echo "ERRO: branch atual '$CURRENT_BRANCH' não segue o padrão NNN-nome-da-feature." >&2
    exit 1
fi

echo "Checando pré-requisitos para '$CURRENT_BRANCH':" >&2
check_file "$SPEC_FILE" "spec.md" >&2 || OK=false
check_file "$PLAN_FILE" "plan.md" >&2 || OK=false

if $REQUIRE_TASKS; then
    check_file "$TASKS_FILE" "tasks.md" >&2 || OK=false
fi

if ! $OK; then
    echo "Pré-requisitos ausentes. Rode /specify e/ou /plan antes de continuar." >&2
    exit 1
fi

if $JSON_MODE; then
    if $INCLUDE_TASKS || $REQUIRE_TASKS; then
        printf '{"FEATURE_DIR":"%s","SPEC_FILE":"%s","PLAN_FILE":"%s","TASKS_FILE":"%s","BRANCH_NAME":"%s"}\n' \
            "$FEATURE_DIR" "$SPEC_FILE" "$PLAN_FILE" "$TASKS_FILE" "$CURRENT_BRANCH"
    else
        printf '{"FEATURE_DIR":"%s","SPEC_FILE":"%s","PLAN_FILE":"%s","BRANCH_NAME":"%s"}\n' \
            "$FEATURE_DIR" "$SPEC_FILE" "$PLAN_FILE" "$CURRENT_BRANCH"
    fi
else
    echo "OK." >&2
fi
