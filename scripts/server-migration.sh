#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"

log() {
  printf '[server-migration] %s\n' "$*"
}

fail() {
  printf '[server-migration] erro: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
Uso:
  bash scripts/server-migration.sh backup
  bash scripts/server-migration.sh restore <diretorio-do-backup>
  bash scripts/server-migration.sh prepare
  bash scripts/server-migration.sh smoke

Comandos:
  backup   Gera dump do PostgreSQL e arquivo compactado do storage.
  restore  Restaura banco e storage a partir de um backup existente.
  prepare  Instala dependencias, gera Prisma Client, aplica migrations e builda.
  smoke    Valida a URL configurada em APP_URL.

Variaveis lidas do .env:
  DATABASE_URL
  APP_URL
  STORAGE_ROOT_DIR (opcional, padrao: ./storage)
  BACKUP_ROOT_DIR  (opcional, padrao: ./backups)
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "comando nao encontrado: $1"
}

resolve_path() {
  node -e 'const path = require("node:path"); console.log(path.resolve(process.argv[1], process.argv[2]));' \
    "$1" \
    "$2"
}

get_database_name() {
  node -e 'const url = new URL(process.argv[1]); console.log(url.pathname.replace(/^\//, ""));' \
    "$DATABASE_URL"
}

get_pg_compatible_database_url() {
  node -e 'const url = new URL(process.argv[1]); url.searchParams.delete("schema"); console.log(url.toString());' \
    "$DATABASE_URL"
}

get_maintenance_database_url() {
  node -e 'const url = new URL(process.argv[1]); url.searchParams.delete("schema"); url.pathname = "/postgres"; console.log(url.toString());' \
    "$DATABASE_URL"
}

load_env() {
  [[ -f "$ENV_FILE" ]] || fail "arquivo de ambiente nao encontrado: $ENV_FILE"

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  : "${DATABASE_URL:?DATABASE_URL nao configurado em $ENV_FILE}"

  STORAGE_ROOT_DIR="${STORAGE_ROOT_DIR:-./storage}"
  STORAGE_ROOT_DIR="$(resolve_path "$PROJECT_ROOT" "$STORAGE_ROOT_DIR")"
  BACKUP_ROOT_DIR="${BACKUP_ROOT_DIR:-${PROJECT_ROOT}/backups}"
  BACKUP_ROOT_DIR="$(resolve_path "$PROJECT_ROOT" "$BACKUP_ROOT_DIR")"
}

backup() {
  load_env
  require_command pg_dump
  require_command tar
  require_command node

  local timestamp
  timestamp="$(date '+%Y%m%d-%H%M%S')"

  local backup_dir="${BACKUP_ROOT_DIR}/${timestamp}"
  local dump_file="${backup_dir}/database.dump"
  local storage_archive="${backup_dir}/storage.tar.gz"
  local database_url

  database_url="$(get_pg_compatible_database_url)"

  mkdir -p "$backup_dir"

  log "gerando dump do PostgreSQL em ${dump_file}"
  pg_dump \
    --format=custom \
    --clean \
    --create \
    --no-owner \
    --no-privileges \
    --file "$dump_file" \
    "$database_url"

  if [[ -d "$STORAGE_ROOT_DIR" ]]; then
    log "compactando storage em ${storage_archive}"
    tar -czf "$storage_archive" -C "$(dirname "$STORAGE_ROOT_DIR")" "$(basename "$STORAGE_ROOT_DIR")"
  else
    log "storage nao encontrado em ${STORAGE_ROOT_DIR}; backup de arquivos ignorado"
  fi

  {
    printf 'created_at=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    printf 'database_name=%s\n' "$(get_database_name)"
    printf 'app_url=%s\n' "${APP_URL:-}"
    printf 'storage_root_dir=%s\n' "$STORAGE_ROOT_DIR"
    printf 'source_host=%s\n' "$(hostname)"
  } > "${backup_dir}/manifest.txt"

  log "backup concluido em ${backup_dir}"
}

restore() {
  load_env
  require_command pg_restore
  require_command tar
  require_command node

  local backup_dir="${1:-}"
  [[ -n "$backup_dir" ]] || fail "informe o diretorio do backup para restaurar"
  [[ -d "$backup_dir" ]] || fail "diretorio de backup invalido: $backup_dir"

  local resolved_backup_dir
  resolved_backup_dir="$(cd "$backup_dir" && pwd)"

  local dump_file="${resolved_backup_dir}/database.dump"
  local storage_archive="${resolved_backup_dir}/storage.tar.gz"
  local maintenance_database_url
  maintenance_database_url="$(get_maintenance_database_url)"

  [[ -f "$dump_file" ]] || fail "arquivo de dump nao encontrado: $dump_file"

  log "restaurando PostgreSQL usando ${dump_file}"
  pg_restore \
    --clean \
    --if-exists \
    --create \
    --no-owner \
    --no-privileges \
    --dbname "$maintenance_database_url" \
    "$dump_file"

  if [[ -f "$storage_archive" ]]; then
    if [[ -d "$STORAGE_ROOT_DIR" ]] && find "$STORAGE_ROOT_DIR" -mindepth 1 -maxdepth 1 | read -r _; then
      local previous_storage_dir="${STORAGE_ROOT_DIR}.pre-restore-$(date '+%Y%m%d-%H%M%S')"
      log "movendo storage atual para ${previous_storage_dir}"
      mv "$STORAGE_ROOT_DIR" "$previous_storage_dir"
    fi

    mkdir -p "$(dirname "$STORAGE_ROOT_DIR")"
    log "extraindo storage em $(dirname "$STORAGE_ROOT_DIR")"
    tar -xzf "$storage_archive" -C "$(dirname "$STORAGE_ROOT_DIR")"
  else
    log "storage.tar.gz nao encontrado; restauracao de arquivos ignorada"
  fi

  log "restore concluido"
}

prepare() {
  load_env
  require_command npm
  require_command npx

  log "instalando dependencias"
  npm ci

  log "gerando Prisma Client"
  npm run db:generate

  log "aplicando migrations"
  npx prisma migrate deploy

  log "gerando build de producao"
  npm run build

  log "prepare concluido"
}

smoke() {
  load_env
  require_command curl

  : "${APP_URL:?APP_URL nao configurado em $ENV_FILE}"

  log "validando ${APP_URL}/entrar"
  curl --fail --silent --show-error --location --max-time 15 "${APP_URL}/entrar" >/dev/null
  log "smoke test concluido"
}

main() {
  local command="${1:-help}"

  case "$command" in
    backup)
      backup
      ;;
    restore)
      shift || true
      restore "${1:-}"
      ;;
    prepare)
      prepare
      ;;
    smoke)
      smoke
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      fail "comando invalido: ${command}"
      ;;
  esac
}

main "$@"
