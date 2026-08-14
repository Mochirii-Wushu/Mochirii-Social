#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=production-runtime-lib.sh
source "$script_dir/production-runtime-lib.sh"

require_root
umask 077

legacy_root="${1:-/opt/pixelfed-staging/pixelfed}"
commit="${2:-}"
digest="${3:-}"
validate_commit "$commit"
validate_digest "$digest"

[[ -d "$legacy_root" && -f "$legacy_root/.env" ]] || {
  echo "The legacy Pixelfed runtime was not found." >&2
  exit 1
}
[[ -f "$legacy_root/docker-compose.yml" ]] || {
  echo "The legacy Compose definition is missing." >&2
  exit 1
}
install -d -m 0750 -o root -g root \
  "$RUNTIME_ROOT" "$RELEASES_ROOT" "$SHARED_ROOT" "$DATA_ROOT" "$RUNTIME_ROOT/backups"
install -m 0600 -o root -g root "$legacy_root/.env" "$SHARED_ROOT/pixelfed.env"

release_dir="$(release_dir_for "$commit")"
install -d -m 0750 -o root -g root "$release_dir"
[[ -f "$SHARED_ROOT/docker-compose.production.yml" ]] || {
  echo "Install the reviewed online runtime before migrating data." >&2
  exit 1
}
install -m 0644 -o root -g root \
  "$SHARED_ROOT/docker-compose.production.yml" \
  "$release_dir/docker-compose.production.yml"
cat >"$release_dir/release.meta" <<EOF
commit=$commit
digest=$digest
repository=Mochirii-Wushu/Mochirii
EOF
cat >"$release_dir/release.env" <<EOF
PIXELFED_IMAGE=$REGISTRY_IMAGE@$digest
PIXELFED_ENV_FILE=$SHARED_ROOT/pixelfed.env
PIXELFED_DATA_ROOT=$DATA_ROOT
EOF
chmod 0640 "$release_dir/release.env" "$release_dir/release.meta"

pull_release_image "$REGISTRY_IMAGE@$digest"
compose_release "$release_dir" config --quiet

legacy_compose=(docker compose --project-directory "$legacy_root" --file "$legacy_root/docker-compose.yml")
backup_path="$RUNTIME_ROOT/backups/pre-online-runtime-${commit}.sql.gz"

echo "Creating a transactional pre-migration database backup."
docker exec pixelfed-db sh -ec \
  'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb-dump --user=root --single-transaction --quick --routines --events --triggers --hex-blob "$MARIADB_DATABASE"' \
  | gzip -9 >"$backup_path"
gzip -t "$backup_path"
chmod 0600 "$backup_path"

docker exec pixelfed-app php artisan down --retry=60 --no-ansi
"${legacy_compose[@]}" stop pixelfed horizon scheduler
"${legacy_compose[@]}" stop db redis

rollback_legacy() {
  trap - ERR
  echo "Restoring the legacy runtime after bootstrap failure." >&2
  compose_release "$release_dir" down --remove-orphans >/dev/null 2>&1 || true
  "${legacy_compose[@]}" up --detach --no-build db redis pixelfed horizon scheduler
  wait_for_container_health pixelfed-db 180
  wait_for_container_health pixelfed-redis 90
  wait_for_container_health pixelfed-app 300
  docker exec pixelfed-app php artisan up --no-ansi || true
}
trap rollback_legacy ERR

rsync -aHAX --numeric-ids --delete "$legacy_root/storage/" "$DATA_ROOT/storage/"
rsync -aHAX --numeric-ids --delete "$legacy_root/mysql-9-data/" "$DATA_ROOT/mariadb/"
rsync -aHAX --numeric-ids --delete "$legacy_root/redis-data/" "$DATA_ROOT/redis/"

"${legacy_compose[@]}" down --remove-orphans
compose_release "$release_dir" up --detach --no-build db redis pixelfed horizon scheduler
wait_for_container_health pixelfed-app 300
docker exec pixelfed-app php artisan up --no-ansi
verify_runtime
ln -sfn "$release_dir" "$CURRENT_LINK"

trap - ERR
echo "Bootstrapped the online runtime at $release_dir."
