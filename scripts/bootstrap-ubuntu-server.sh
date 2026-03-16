#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$PROJECT_ROOT}"
ENV_FILE="${ENV_FILE:-${PROJECT_DIR}/.env}"
NODE_MAJOR="${NODE_MAJOR:-22}"
COMMAND="all"
RUN_SEED=0
TARGET_DOCKER_USER="${SUDO_USER:-${USER:-}}"
DOCKER_GROUP_CHANGED=0
ENV_FILE_EXPLICIT=0

log() {
  printf '[bootstrap-server] %s\n' "$*"
}

warn() {
  printf '[bootstrap-server] aviso: %s\n' "$*" >&2
}

fail() {
  printf '[bootstrap-server] erro: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
Uso:
  bash scripts/bootstrap-ubuntu-server.sh system
  bash scripts/bootstrap-ubuntu-server.sh app [--seed]
  bash scripts/bootstrap-ubuntu-server.sh all [--seed]

Comandos:
  system  Instala pacotes base, Node.js ${NODE_MAJOR}, Docker Engine e Docker Compose.
  app     Sobe o PostgreSQL, roda prepare e opcionalmente seed no projeto atual.
  all     Executa system e app em sequencia.

Opcoes:
  --seed                 Roda npm run db:seed apos o prepare.
  --project-dir <path>   Define o diretorio do projeto. Padrao: ${PROJECT_DIR}
  --env-file <path>      Define o arquivo .env. Padrao: ${ENV_FILE}
  --docker-user <user>   Usuario a ser adicionado ao grupo docker.
  -h, --help             Exibe esta ajuda.

Exemplos:
  bash scripts/bootstrap-ubuntu-server.sh system
  bash scripts/bootstrap-ubuntu-server.sh app
  bash scripts/bootstrap-ubuntu-server.sh app --seed
  bash scripts/bootstrap-ubuntu-server.sh all --seed
EOF
}

run_as_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    command -v sudo >/dev/null 2>&1 || fail "sudo nao encontrado. Execute como root ou instale sudo."
    sudo "$@"
  fi
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando nao encontrado: $1"
}

ensure_ubuntu() {
  [[ -f /etc/os-release ]] || fail "/etc/os-release nao encontrado"
  # shellcheck disable=SC1091
  source /etc/os-release

  if [[ "${ID:-}" != "ubuntu" ]]; then
    fail "este script foi feito para Ubuntu 22.04/24.04. Sistema atual: ${PRETTY_NAME:-desconhecido}"
  fi
}

apt_install() {
  run_as_root apt-get install -y "$@"
}

write_file_as_root() {
  local target_path="$1"
  local temp_file
  temp_file="$(mktemp)"
  cat >"$temp_file"
  run_as_root install -D -m 0644 "$temp_file" "$target_path"
  rm -f "$temp_file"
}

install_base_packages() {
  log "instalando pacotes base"
  run_as_root apt-get update
  apt_install ca-certificates curl git gnupg lsb-release postgresql-client
}

configure_nodesource_repo() {
  log "configurando repositorio NodeSource para Node.js ${NODE_MAJOR}.x"
  run_as_root install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    run_as_root gpg --dearmor --batch --yes -o /etc/apt/keyrings/nodesource.gpg
  run_as_root chmod a+r /etc/apt/keyrings/nodesource.gpg

  write_file_as_root /etc/apt/sources.list.d/nodesource.list <<EOF
deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main
EOF
}

install_nodejs() {
  local installed_major=""

  if command -v node >/dev/null 2>&1; then
    installed_major="$(node -p 'process.versions.node.split(".")[0]')"
  fi

  if [[ -n "$installed_major" && "$installed_major" == "$NODE_MAJOR" ]]; then
    log "Node.js ${NODE_MAJOR} ja esta instalado: $(node -v)"
    return
  fi

  configure_nodesource_repo
  run_as_root apt-get update
  apt_install nodejs
  log "Node instalado: $(node -v)"
  log "npm instalado: $(npm -v)"
}

remove_conflicting_docker_packages() {
  local packages=(
    docker.io
    docker-doc
    docker-compose
    podman-docker
    containerd
    runc
  )

  local installed=()
  local package_name

  for package_name in "${packages[@]}"; do
    if dpkg -s "$package_name" >/dev/null 2>&1; then
      installed+=("$package_name")
    fi
  done

  if ((${#installed[@]} > 0)); then
    log "removendo pacotes Docker conflitantes: ${installed[*]}"
    run_as_root apt-get remove -y "${installed[@]}"
  fi
}

configure_docker_repo() {
  log "configurando repositorio oficial do Docker"
  run_as_root install -m 0755 -d /etc/apt/keyrings
  run_as_root curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  run_as_root chmod a+r /etc/apt/keyrings/docker.asc

  write_file_as_root /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker ja esta instalado: $(docker --version)"
    log "Docker Compose ja esta instalado: $(docker compose version)"
  else
    remove_conflicting_docker_packages
    configure_docker_repo
    run_as_root apt-get update
    apt_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  fi

  run_as_root systemctl enable --now docker
}

configure_docker_group() {
  if [[ -z "$TARGET_DOCKER_USER" ]]; then
    warn "nao foi possivel determinar o usuario para o grupo docker"
    return
  fi

  if [[ "$TARGET_DOCKER_USER" == "root" ]]; then
    warn "usuario atual e root; grupo docker nao precisa ser ajustado"
    return
  fi

  if ! id "$TARGET_DOCKER_USER" >/dev/null 2>&1; then
    warn "usuario informado para o grupo docker nao existe: $TARGET_DOCKER_USER"
    return
  fi

  if id -nG "$TARGET_DOCKER_USER" | tr ' ' '\n' | grep -qx 'docker'; then
    log "usuario ${TARGET_DOCKER_USER} ja pertence ao grupo docker"
    return
  fi

  log "adicionando ${TARGET_DOCKER_USER} ao grupo docker"
  run_as_root usermod -aG docker "$TARGET_DOCKER_USER"
  DOCKER_GROUP_CHANGED=1
}

print_system_summary() {
  log "resumo do sistema preparado"
  log "node: $(node -v)"
  log "npm: $(npm -v)"
  log "docker: $(docker --version)"
  log "docker compose: $(docker compose version)"

  if [[ "$DOCKER_GROUP_CHANGED" -eq 1 ]]; then
    warn "faça logout/login antes de usar Docker sem sudo com o usuario ${TARGET_DOCKER_USER}"
  fi
}

run_docker() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  else
    run_as_root docker "$@"
  fi
}

resolve_project_dir() {
  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"

  if [[ "$ENV_FILE_EXPLICIT" -eq 1 ]]; then
    ENV_FILE="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"
  else
    ENV_FILE="${PROJECT_DIR}/.env"
  fi
}

ensure_project_files() {
  resolve_project_dir
  [[ -f "${PROJECT_DIR}/package.json" ]] || fail "package.json nao encontrado em ${PROJECT_DIR}"
  [[ -f "${PROJECT_DIR}/docker-compose.yml" ]] || fail "docker-compose.yml nao encontrado em ${PROJECT_DIR}"
  [[ -f "${PROJECT_DIR}/scripts/server-migration.sh" ]] || fail "scripts/server-migration.sh nao encontrado em ${PROJECT_DIR}"
}

ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  if [[ -f "${PROJECT_DIR}/.env.example" ]]; then
    log "arquivo .env ausente; criando a partir do exemplo"
    cp "${PROJECT_DIR}/.env.example" "$ENV_FILE"
    warn "revise ${ENV_FILE} antes de rodar o bootstrap do app em producao"
    return
  fi

  fail "arquivo .env nao encontrado e .env.example inexistente"
}

extract_env_value() {
  local key="$1"

  node -e '
    const fs = require("node:fs");
    const path = process.argv[1];
    const key = process.argv[2];
    const text = fs.readFileSync(path, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.startsWith(`${key}=`)) continue;
      const value = line.slice(key.length + 1).trim().replace(/^"(.*)"$/, "$1").replace(/^'\''(.*)'\''$/, "$1");
      console.log(value);
      process.exit(0);
    }
  ' "$ENV_FILE" "$key"
}

validate_env_for_app_bootstrap() {
  local app_url
  local auth_secret
  local database_url

  app_url="$(extract_env_value APP_URL || true)"
  auth_secret="$(extract_env_value AUTH_SECRET || true)"
  database_url="$(extract_env_value DATABASE_URL || true)"

  [[ -n "$database_url" ]] || fail "DATABASE_URL nao configurado em ${ENV_FILE}"

  if [[ -z "$app_url" || "$app_url" == "http://localhost:3000" ]]; then
    fail "APP_URL ainda nao parece configurado para producao em ${ENV_FILE}"
  fi

  if [[ -z "$auth_secret" || "$auth_secret" == "troque-esta-chave-antes-de-subir" ]]; then
    fail "AUTH_SECRET ainda esta com valor de exemplo em ${ENV_FILE}"
  fi
}

start_postgres() {
  log "subindo PostgreSQL com Docker Compose"
  (
    cd "$PROJECT_DIR"
    run_docker compose up -d
    run_docker compose ps
  )
}

prepare_app() {
  log "executando prepare da aplicacao"
  (
    cd "$PROJECT_DIR"
    bash scripts/server-migration.sh prepare
  )
}

seed_app() {
  log "executando seed inicial"
  (
    cd "$PROJECT_DIR"
    npm run db:seed
  )
}

print_app_summary() {
  log "bootstrap do app concluido"
  log "proximo passo sugerido: npm run start:tunnel"
  log "depois publique o dominio via Cloudflare Tunnel ou Nginx apontando para 127.0.0.1:300"
}

run_system_bootstrap() {
  ensure_ubuntu
  install_base_packages
  install_nodejs
  install_docker
  configure_docker_group
  print_system_summary
}

run_app_bootstrap() {
  ensure_project_files
  ensure_env_file
  validate_env_for_app_bootstrap
  start_postgres
  prepare_app

  if [[ "$RUN_SEED" -eq 1 ]]; then
    seed_app
  fi

  print_app_summary
}

parse_args() {
  while (($# > 0)); do
    case "$1" in
      system|app|all)
        COMMAND="$1"
        shift
        ;;
      --seed)
        RUN_SEED=1
        shift
        ;;
      --project-dir)
        [[ $# -ge 2 ]] || fail "--project-dir exige um valor"
        PROJECT_DIR="$2"
        shift 2
        ;;
      --env-file)
        [[ $# -ge 2 ]] || fail "--env-file exige um valor"
        ENV_FILE="$2"
        ENV_FILE_EXPLICIT=1
        shift 2
        ;;
      --docker-user)
        [[ $# -ge 2 ]] || fail "--docker-user exige um valor"
        TARGET_DOCKER_USER="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "argumento invalido: $1"
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  case "$COMMAND" in
    system)
      run_system_bootstrap
      ;;
    app)
      run_app_bootstrap
      ;;
    all)
      run_system_bootstrap
      run_app_bootstrap
      ;;
    *)
      fail "comando invalido: ${COMMAND}"
      ;;
  esac
}

main "$@"
