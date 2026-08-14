#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f /usr/local/lib/mochirii-social/production-runtime-lib.sh ]]; then
  # shellcheck source=/dev/null
  source /usr/local/lib/mochirii-social/production-runtime-lib.sh
else
  # shellcheck source=production-runtime-lib.sh
  source "$script_dir/production-runtime-lib.sh"
fi

require_root
umask 077

BACKUP_ROOT="$RUNTIME_ROOT/backups"

payload_path="${1:-}"
confirmation="${2:-}"
[[ "$confirmation" == "RESTORE_social.mochirii.com" ]] || {
  echo "The production restore confirmation is invalid." >&2
  exit 1
}
[[ -f "$payload_path" ]] || {
  echo "The recovery payload is missing." >&2
  exit 1
}

mkdir -p "$(dirname "$LOCK_FILE")" "$BACKUP_ROOT"
exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "Another Mochirii Social deployment or restore is active." >&2
  exit 1
}

stage_dir="$(mktemp -d "$BACKUP_ROOT/.restore.XXXXXX")"
cleanup() {
  if [[ "$stage_dir" == "$BACKUP_ROOT/.restore."* ]]; then
    rm -rf -- "$stage_dir"
  fi
  rm -f "$payload_path"
}
trap cleanup EXIT

mapfile -t payload_entries < <(tar -tf "$payload_path")
expected_entries=(database.sql.gz configuration.tar.gz manifest)
[[ "${#payload_entries[@]}" -eq "${#expected_entries[@]}" ]] || {
  echo "The recovery payload contains unexpected entries." >&2
  exit 1
}
for expected_entry in "${expected_entries[@]}"; do
  printf '%s\n' "${payload_entries[@]}" | grep -Fxq "$expected_entry" || {
    echo "The recovery payload is incomplete." >&2
    exit 1
  }
done
tar -xf "$payload_path" --no-same-owner --no-same-permissions -C "$stage_dir"
gzip -t "$stage_dir/database.sql.gz"
tar -tzf "$stage_dir/configuration.tar.gz" >/dev/null
grep -Fxq 'format=1' "$stage_dir/manifest"
grep -Eq '^release_commit=[0-9a-f]{40}$' "$stage_dir/manifest"
grep -Eq '^release_digest=sha256:[0-9a-f]{64}$' "$stage_dir/manifest"

/usr/local/sbin/mochirii-social-backup "pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
current_release="$(readlink -f "$CURRENT_LINK")"
compose_release "$current_release" config --quiet

docker exec pixelfed-app php artisan down --retry=60 --no-ansi
compose_release "$current_release" stop horizon scheduler pixelfed

restore_failed() {
  echo "The database restore failed; maintenance mode remains active for forward recovery." >&2
}
trap restore_failed ERR

docker exec pixelfed-db sh -ec '
  MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb --user=root --execute="
    DROP DATABASE IF EXISTS \`$MARIADB_DATABASE\`;
    CREATE DATABASE \`$MARIADB_DATABASE\`
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  "
'
gzip -dc "$stage_dir/database.sql.gz" | docker exec \
  --interactive \
  pixelfed-db sh -ec '
    MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb --user=root "$MARIADB_DATABASE"
  '

for table_name in users statuses media oauth_clients; do
  docker exec pixelfed-db sh -ec '
    MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb \
      --user=root \
      --batch \
      --skip-column-names \
      "$MARIADB_DATABASE" \
      --execute="$1"
  ' sh "SELECT COUNT(*) FROM \`$table_name\`;" >/dev/null
done

compose_release "$current_release" up --detach --no-build pixelfed horizon scheduler
wait_for_container_health pixelfed-app 300
docker exec pixelfed-app php artisan optimize:clear --no-ansi >/dev/null
docker exec pixelfed-app php artisan up --no-ansi
verify_runtime

trap - ERR
echo "Production database restore completed and runtime gates passed."
