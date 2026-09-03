#!/usr/bin/env bash
# Prepara .specify/memory/local-dev.md a partir do template e detecta pistas sobre
# como o projeto sobe localmente (compose, Dockerfile, .env de exemplo, runners, etc.).
# Roda uma vez por projeto (e de novo quando a infra local mudar).
#
# Uso: setup-localdev.sh [--json]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

JSON_MODE=false
for arg in "$@"; do
    [[ "$arg" == "--json" ]] && JSON_MODE=true
done

REPO_ROOT=$(get_repo_root)
MEMORY_DIR="$REPO_ROOT/.specify/memory"
LOCALDEV_FILE="$MEMORY_DIR/local-dev.md"
TEMPLATE_FILE="$REPO_ROOT/.specify/templates/local-dev-template.md"
ARCHITECTURE_FILE="$MEMORY_DIR/architecture.md"
CONSTITUTION_FILE="$MEMORY_DIR/constitution.md"

mkdir -p "$MEMORY_DIR"

FIRST_RUN=true
if [[ -f "$LOCALDEV_FILE" ]]; then
    FIRST_RUN=false
elif [[ -f "$TEMPLATE_FILE" ]]; then
    cp "$TEMPLATE_FILE" "$LOCALDEV_FILE"
else
    echo "# Ambiente de desenvolvimento local: [NOME DO PROJETO]" > "$LOCALDEV_FILE"
fi

# --- Detecção de pistas (raiz + 1 nível abaixo, ignorando o próprio kit) ---
find_hits() {
    local pattern_args=()
    local first=true
    local p
    for p in "$@"; do
        if $first; then first=false; else pattern_args+=( -o ); fi
        pattern_args+=( -iname "$p" )
    done
    find "$REPO_ROOT" -maxdepth 2 \
        -not -path "*/.git/*" \
        -not -path "*/.specify/*" \
        -not -path "*/.claude/*" \
        -not -path "*/node_modules/*" \
        -not -path "*/vendor/*" \
        -type f \( "${pattern_args[@]}" \) 2>/dev/null \
        | sed "s|^$REPO_ROOT/||" | sort | paste -sd, - || true
}

COMPOSE_FILES=$(find_hits 'docker-compose*.yml' 'docker-compose*.yaml' 'compose.yml' 'compose.yaml')
DOCKERFILES=$(find_hits 'Dockerfile' 'Dockerfile.*' '*.dockerfile')
ENV_EXAMPLES=$(find_hits '.env.example' '.env.sample' '.env.template' '.env.dist' '.env.*.example')
STACK_FILES=$(find_hits 'package.json' 'go.mod' 'pyproject.toml' 'requirements.txt' 'Gemfile' 'pom.xml' 'build.gradle' 'build.gradle.kts' 'Cargo.toml' 'composer.json' '*.csproj' 'pubspec.yaml' 'Podfile')
RUNNER_FILES=$(find_hits 'Makefile' 'Procfile' 'Procfile.dev' 'Taskfile.yml' 'Taskfile.yaml' 'justfile')
DEVCONTAINER=$(find "$REPO_ROOT/.devcontainer" -maxdepth 2 -type f -iname 'devcontainer.json' 2>/dev/null | sed "s|^$REPO_ROOT/||" | paste -sd, - || true)

ARCH_EXISTS=false
[[ -f "$ARCHITECTURE_FILE" ]] && ARCH_EXISTS=true

CONST_READY=false
if [[ -f "$CONSTITUTION_FILE" ]] && ! grep -q 'PRINCÍPIO_1_NOME' "$CONSTITUTION_FILE" 2>/dev/null; then
    CONST_READY=true
fi

if $JSON_MODE; then
    printf '{"REPO_ROOT":"%s","LOCALDEV_FILE":"%s","TEMPLATE_FILE":"%s","ARCHITECTURE_FILE":"%s","CONSTITUTION_FILE":"%s","FIRST_RUN":%s,"ARCHITECTURE_EXISTS":%s,"CONSTITUTION_READY":%s,"COMPOSE_FILES":"%s","DOCKERFILES":"%s","ENV_EXAMPLES":"%s","STACK_FILES":"%s","RUNNER_FILES":"%s","DEVCONTAINER":"%s"}\n' \
        "$REPO_ROOT" "$LOCALDEV_FILE" "$TEMPLATE_FILE" "$ARCHITECTURE_FILE" "$CONSTITUTION_FILE" \
        "$FIRST_RUN" "$ARCH_EXISTS" "$CONST_READY" \
        "$COMPOSE_FILES" "$DOCKERFILES" "$ENV_EXAMPLES" "$STACK_FILES" "$RUNNER_FILES" "$DEVCONTAINER"
else
    echo "Local dev file:   $LOCALDEV_FILE"
    echo "Primeira vez:     $FIRST_RUN"
    echo "architecture.md:  $ARCH_EXISTS"
    echo "Compose:          ${COMPOSE_FILES:-nenhum}"
    echo "Dockerfiles:      ${DOCKERFILES:-nenhum}"
    echo "Env de exemplo:   ${ENV_EXAMPLES:-nenhum}"
    echo "Arquivos stack:   ${STACK_FILES:-nenhum}"
    echo "Runners:          ${RUNNER_FILES:-nenhum}"
    echo "devcontainer:     ${DEVCONTAINER:-nenhum}"
fi
