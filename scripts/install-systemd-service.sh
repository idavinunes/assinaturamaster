#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$PROJECT_ROOT}"
SERVICE_NAME="${SERVICE_NAME:-assinaura}"
SERVICE_DESCRIPTION="${SERVICE_DESCRIPTION:-Assinaura Next.js service}"
APP_USER="${APP_USER:-${SUDO_USER:-${USER:-root}}}"
APP_GROUP="${APP_GROUP:-}"
START_SCRIPT="${START_SCRIPT:-start:lan}"
NODE_ENV_VALUE="${NODE_ENV_VALUE:-production}"
NPM_BIN="${NPM_BIN:-}"
START_NOW=1

log() {
  printf '[systemd-install] %s\n' "$*"
}

warn() {
  printf '[systemd-install] aviso: %s\n' "$*" >&2
}

fail() {
  printf '[systemd-install] erro: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
Uso:
  bash scripts/install-systemd-service.sh
  bash scripts/install-systemd-service.sh --user root

Opcoes:
  --service-name <nome>     Nome do servico. Padrao: ${SERVICE_NAME}
  --description <texto>     Description do unit file.
  --project-dir <path>      Diretorio do projeto. Padrao: ${PROJECT_DIR}
  --user <usuario>          Usuario que executara o servico. Padrao: ${APP_USER}
  --group <grupo>           Grupo do servico. Padrao: grupo primario do usuario.
  --script <npm-script>     Script do package.json. Padrao: ${START_SCRIPT}
  --npm-path <path>         Caminho absoluto do npm. Padrao: detectado automaticamente.
  --node-env <valor>        Valor de NODE_ENV no servico. Padrao: ${NODE_ENV_VALUE}
  --no-start                Cria/atualiza o servico, mas nao inicia agora.
  -h, --help                Exibe esta ajuda.

Exemplos:
  bash scripts/install-systemd-service.sh
  bash scripts/install-systemd-service.sh --user root
  bash scripts/install-systemd-service.sh --service-name assinaura --script start:tunnel
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

resolve_project_dir() {
  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
}

resolve_npm_bin() {
  if [[ -n "$NPM_BIN" ]]; then
    [[ "$NPM_BIN" = /* ]] || fail "--npm-path precisa ser um caminho absoluto"
    [[ -x "$NPM_BIN" ]] || fail "npm nao executavel em ${NPM_BIN}"
    return
  fi

  NPM_BIN="$(command -v npm || true)"
  [[ -n "$NPM_BIN" ]] || fail "npm nao encontrado no PATH"
}

ensure_project_files() {
  [[ -f "${PROJECT_DIR}/package.json" ]] || fail "package.json nao encontrado em ${PROJECT_DIR}"
  [[ -f "${PROJECT_DIR}/.env" ]] || fail ".env nao encontrado em ${PROJECT_DIR}"
  [[ -f "${PROJECT_DIR}/.next/BUILD_ID" ]] || fail "build de producao ausente em ${PROJECT_DIR}/.next. Rode o prepare antes."
}

ensure_user_and_group() {
  id "$APP_USER" >/dev/null 2>&1 || fail "usuario inexistente: ${APP_USER}"

  if [[ -z "$APP_GROUP" ]]; then
    APP_GROUP="$(id -gn "$APP_USER")"
  fi

  getent group "$APP_GROUP" >/dev/null 2>&1 || fail "grupo inexistente: ${APP_GROUP}"

  if [[ "$APP_USER" == "root" ]]; then
    warn "o servico sera executado como root"
  fi
}

ensure_start_script() {
  node -e '
    const fs = require("node:fs");
    const packagePath = process.argv[1];
    const scriptName = process.argv[2];
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

    if (!pkg.scripts || !pkg.scripts[scriptName]) {
      process.exit(1);
    }
  ' "${PROJECT_DIR}/package.json" "$START_SCRIPT" || fail "script npm nao encontrado: ${START_SCRIPT}"
}

write_unit_file() {
  local unit_file="/etc/systemd/system/${SERVICE_NAME}.service"
  local temp_file

  temp_file="$(mktemp)"

  cat >"$temp_file" <<EOF
[Unit]
Description=${SERVICE_DESCRIPTION}
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${PROJECT_DIR}
Environment=NODE_ENV=${NODE_ENV_VALUE}
Environment=NEXT_TELEMETRY_DISABLED=1
ExecStart=${NPM_BIN} run ${START_SCRIPT}
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF

  run_as_root install -D -m 0644 "$temp_file" "$unit_file"
  rm -f "$temp_file"
  log "unit file escrito em ${unit_file}"
}

reload_and_enable_service() {
  run_as_root systemctl daemon-reload
  run_as_root systemctl enable "${SERVICE_NAME}.service"

  if [[ "$START_NOW" -eq 1 ]]; then
    run_as_root systemctl restart "${SERVICE_NAME}.service"
    run_as_root systemctl status "${SERVICE_NAME}.service" --no-pager
  else
    log "servico habilitado, mas nao iniciado"
  fi
}

print_summary() {
  log "servico pronto"
  log "status: systemctl status ${SERVICE_NAME} --no-pager"
  log "logs: journalctl -u ${SERVICE_NAME} -f"
}

parse_args() {
  while (($# > 0)); do
    case "$1" in
      --service-name)
        [[ $# -ge 2 ]] || fail "--service-name exige um valor"
        SERVICE_NAME="$2"
        shift 2
        ;;
      --description)
        [[ $# -ge 2 ]] || fail "--description exige um valor"
        SERVICE_DESCRIPTION="$2"
        shift 2
        ;;
      --project-dir)
        [[ $# -ge 2 ]] || fail "--project-dir exige um valor"
        PROJECT_DIR="$2"
        shift 2
        ;;
      --user)
        [[ $# -ge 2 ]] || fail "--user exige um valor"
        APP_USER="$2"
        shift 2
        ;;
      --group)
        [[ $# -ge 2 ]] || fail "--group exige um valor"
        APP_GROUP="$2"
        shift 2
        ;;
      --script)
        [[ $# -ge 2 ]] || fail "--script exige um valor"
        START_SCRIPT="$2"
        shift 2
        ;;
      --npm-path)
        [[ $# -ge 2 ]] || fail "--npm-path exige um valor"
        NPM_BIN="$2"
        shift 2
        ;;
      --node-env)
        [[ $# -ge 2 ]] || fail "--node-env exige um valor"
        NODE_ENV_VALUE="$2"
        shift 2
        ;;
      --no-start)
        START_NOW=0
        shift
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
  resolve_project_dir
  resolve_npm_bin
  ensure_project_files
  ensure_user_and_group
  ensure_start_script
  write_unit_file
  reload_and_enable_service
  print_summary
}

main "$@"
