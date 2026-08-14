#!/usr/bin/env bash

set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

image="${PIXELFED_IMAGE:-mochirii-pixelfed:production-check}"
project_name="pixelfed-clean-db-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
temp_dir="$(mktemp -d)"
env_file="$temp_dir/pixelfed-ci.env"
expected_pulse_tables=(pulse_values pulse_entries pulse_aggregates)

cat > "$env_file" <<'EOF'
APP_NAME="Mochirii Social CI"
APP_ENV=testing
APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
APP_DEBUG=false
APP_URL=http://localhost
APP_DOMAIN=localhost
ADMIN_DOMAIN=localhost
SESSION_DOMAIN=localhost
TRUST_PROXIES=*
OPEN_REGISTRATION=false
OAUTH_ENABLED=false
ACTIVITY_PUB=false
AP_REMOTE_FOLLOW=false
AP_INBOX=false
AP_OUTBOX=false
AP_SHAREDINBOX=false
DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=pixelfed_ci
DB_USERNAME=pixelfed_ci
DB_PASSWORD=ci-database-password
DB_ROOT_PASSWORD=ci-root-password
REDIS_CLIENT=phpredis
REDIS_SCHEME=tcp
REDIS_HOST=redis
REDIS_PASSWORD=null
REDIS_PORT=6379
SESSION_DRIVER=database
CACHE_DRIVER=redis
QUEUE_DRIVER=redis
BROADCAST_DRIVER=log
LOG_CHANNEL=stderr
MAIL_DRIVER=log
PF_ENABLE_CLOUD=false
FILESYSTEM_CLOUD=local
EOF

export PIXELFED_ENV_FILE="$env_file"
export PIXELFED_IMAGE="$image"

compose=(
  docker compose
  --project-name "$project_name"
  --env-file "$env_file"
  --file docker-compose.yml
  --file docker-compose.ci.yml
)

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$temp_dir"
}
trap cleanup EXIT

wait_for_health() {
  local service="$1"
  local timeout_seconds="$2"
  local container_id
  local deadline=$((SECONDS + timeout_seconds))

  container_id="$("${compose[@]}" ps --quiet "$service")"
  if [[ -z "$container_id" ]]; then
    echo "No container was created for $service." >&2
    return 1
  fi

  while ((SECONDS < deadline)); do
    local status
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
    case "$status" in
      healthy)
        return 0
        ;;
      unhealthy | exited | dead)
        "${compose[@]}" logs --no-color --tail 100 "$service" >&2
        echo "$service entered terminal state: $status" >&2
        return 1
        ;;
    esac
    sleep 5
  done

  "${compose[@]}" logs --no-color --tail 100 "$service" >&2
  echo "$service did not become healthy within ${timeout_seconds}s." >&2
  return 1
}

docker image inspect "$image" >/dev/null

"${compose[@]}" config --quiet
"${compose[@]}" up --detach --no-build db redis
wait_for_health db 180
wait_for_health redis 90

"${compose[@]}" up --detach --no-build pixelfed
wait_for_health pixelfed 600

"${compose[@]}" up --detach --no-build horizon scheduler
wait_for_health horizon 180
wait_for_health scheduler 180

"${compose[@]}" exec --no-TTY pixelfed \
  php artisan migrate --force --isolated --no-interaction

pending_output="$(
  "${compose[@]}" exec --no-TTY pixelfed \
    php artisan migrate:status --pending --no-ansi --no-interaction
)"
if ! grep -Fq 'No pending migrations.' <<<"$pending_output"; then
  printf '%s\n' "$pending_output" >&2
  echo "Clean database still reports pending migrations." >&2
  exit 1
fi

"${compose[@]}" exec --no-TTY horizon php artisan horizon:status
"${compose[@]}" exec --no-TTY scheduler php artisan schedule:list --no-ansi >/dev/null

pulse_table_count="$(
  "${compose[@]}" exec --no-TTY db sh -ec \
    'mariadb --batch --skip-column-names --user="$MARIADB_USER" --password="$MARIADB_PASSWORD" "$MARIADB_DATABASE" --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (0x70756c73655f76616c756573, 0x70756c73655f656e7472696573, 0x70756c73655f61676772656761746573);"'
)"

if [[ "$pulse_table_count" != "${#expected_pulse_tables[@]}" ]]; then
  echo "Expected all three Laravel Pulse tables; found $pulse_table_count." >&2
  exit 1
fi

echo "Clean MariaDB migration, Pulse, Horizon, and scheduler checks passed."
