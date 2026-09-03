#!/usr/bin/env bash
# Funções compartilhadas pelos scripts do kit SDD.
# Este arquivo é sourceado pelos outros scripts, não é executado diretamente.

set -euo pipefail

# Raiz do repositório git (falha se não estiver dentro de um repo).
get_repo_root() {
    git rev-parse --show-toplevel 2>/dev/null || {
        echo "ERRO: não está dentro de um repositório git." >&2
        exit 1
    }
}

# Branch atual.
get_current_branch() {
    git rev-parse --abbrev-ref HEAD 2>/dev/null || {
        echo "ERRO: não foi possível determinar a branch atual." >&2
        exit 1
    }
}

# Confere se a branch atual segue o padrão NNN-nome-da-feature.
# Retorna 0 (sucesso) se sim, 1 se não.
check_feature_branch() {
    local branch="$1"
    if [[ "$branch" =~ ^[0-9]{3}-.+ ]]; then
        return 0
    fi
    return 1
}

# Dado o repo root e a branch atual, resolve o diretório da feature em specs/.
get_feature_dir() {
    local repo_root="$1"
    local branch="$2"
    echo "$repo_root/specs/$branch"
}

# Monta e exporta (via echo de variáveis) os paths principais de uma feature.
# Uso: eval "$(get_feature_paths)"
get_feature_paths() {
    local repo_root
    local current_branch
    repo_root=$(get_repo_root)
    current_branch=$(get_current_branch)
    local feature_dir
    feature_dir=$(get_feature_dir "$repo_root" "$current_branch")

    cat <<EOF
REPO_ROOT='$repo_root'
CURRENT_BRANCH='$current_branch'
FEATURE_DIR='$feature_dir'
SPEC_FILE='$feature_dir/spec.md'
PLAN_FILE='$feature_dir/plan.md'
TASKS_FILE='$feature_dir/tasks.md'
RESEARCH_FILE='$feature_dir/research.md'
DATA_MODEL_FILE='$feature_dir/data-model.md'
QUICKSTART_FILE='$feature_dir/quickstart.md'
CONTRACTS_DIR='$feature_dir/contracts'
EOF
}

check_file() {
    local path="$1"
    local label="$2"
    if [[ -f "$path" ]]; then
        echo "  ✓ $label"
        return 0
    else
        echo "  ✗ $label (não encontrado: $path)"
        return 1
    fi
}

check_dir() {
    local path="$1"
    local label="$2"
    if [[ -d "$path" ]] && [[ -n "$(ls -A "$path" 2>/dev/null)" ]]; then
        echo "  ✓ $label"
        return 0
    else
        echo "  ✗ $label (não encontrado ou vazio: $path)"
        return 1
    fi
}
