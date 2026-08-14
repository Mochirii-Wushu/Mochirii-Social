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

if [[ "${1:-}" == "--verify-online-hosting" ]]; then
  [[ "$#" -eq 1 ]] || {
    echo "Online-hosting verification accepts no additional arguments." >&2
    exit 1
  }

  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  flock -n 9 || {
    echo "Another Mochirii Social deployment is active." >&2
    exit 1
  }

  verify_online_hosting
  exit 0
fi

bundle_path="${1:-}"
commit="${2:-}"
digest="${3:-}"
migration_approval="${4:-NONE}"

validate_commit "$commit"
validate_digest "$digest"
[[ "$migration_approval" == "NONE" || "$migration_approval" == "MIGRATIONS_APPROVED" ]] || {
  echo "Migration approval must be NONE or MIGRATIONS_APPROVED." >&2
  exit 1
}
[[ -f "$bundle_path" ]] || {
  echo "The release bundle is missing." >&2
  exit 1
}

mkdir -p "$(dirname "$LOCK_FILE")" "$RELEASES_ROOT"
exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "Another Mochirii Social deployment is active." >&2
  exit 1
}

stage_dir="$(mktemp -d "$RUNTIME_ROOT/.release-${commit}.XXXXXX")"
cleanup() {
  rm -rf "$stage_dir"
  rm -f "$bundle_path"
}
trap cleanup EXIT

mapfile -t bundle_entries < <(tar -tzf "$bundle_path")
expected_entries=(docker-compose.production.yml release.meta)
if [[ "${#bundle_entries[@]}" -ne "${#expected_entries[@]}" ]]; then
  echo "The release bundle contains an unexpected number of files." >&2
  exit 1
fi
for expected in "${expected_entries[@]}"; do
  printf '%s\n' "${bundle_entries[@]}" | grep -Fxq "$expected" || {
    echo "The release bundle is missing $expected." >&2
    exit 1
  }
done

tar -xzf "$bundle_path" --no-same-owner --no-same-permissions -C "$stage_dir"
[[ "$(find "$stage_dir" -mindepth 1 -maxdepth 1 -type f | wc -l)" -eq 2 ]] || {
  echo "The release bundle contains an unsupported file type." >&2
  exit 1
}
grep -Fxq "commit=$commit" "$stage_dir/release.meta"
grep -Fxq "digest=$digest" "$stage_dir/release.meta"
grep -Fxq "repository=Mochirii-Wushu/Mochirii" "$stage_dir/release.meta"

accepted_compose="$SHARED_ROOT/docker-compose.production.yml"
[[ -f "$accepted_compose" ]] || {
  echo "The root-owned production Compose template is missing." >&2
  exit 1
}
cmp -s "$stage_dir/docker-compose.production.yml" "$accepted_compose" || {
  echo "The release Compose file does not match the approved host template." >&2
  exit 1
}

if grep -Eq '^[[:space:]]*build:' "$stage_dir/docker-compose.production.yml"; then
  echo "Production Compose must not contain build directives." >&2
  exit 1
fi

release_dir="$(release_dir_for "$commit")"
if [[ -e "$release_dir" ]]; then
  grep -Fxq "digest=$digest" "$release_dir/release.meta" || {
    echo "The existing release directory has a different digest." >&2
    exit 1
  }
else
  install -d -m 0750 -o root -g root "$release_dir"
  install -m 0644 -o root -g root \
    "$accepted_compose" \
    "$release_dir/docker-compose.production.yml"
  install -m 0644 -o root -g root "$stage_dir/release.meta" "$release_dir/release.meta"
  cat >"$release_dir/release.env" <<EOF
PIXELFED_IMAGE=$REGISTRY_IMAGE@$digest
PIXELFED_ENV_FILE=$SHARED_ROOT/pixelfed.env
PIXELFED_DATA_ROOT=$DATA_ROOT
EOF
  chmod 0640 "$release_dir/release.env"
fi

[[ -f "$SHARED_ROOT/pixelfed.env" ]] || {
  echo "The root-owned Pixelfed environment is missing." >&2
  exit 1
}
[[ -L "$CURRENT_LINK" ]] || {
  echo "The online runtime must be bootstrapped before GitHub deployments." >&2
  exit 1
}

previous_release="$(readlink -f "$CURRENT_LINK")"
[[ -f "$previous_release/release.env" ]] || {
  echo "The current release metadata is incomplete." >&2
  exit 1
}

pull_release_image "$REGISTRY_IMAGE@$digest"
compose_release "$release_dir" config --quiet

pending_output="$(
  compose_release "$release_dir" run \
    --rm \
    --no-deps \
    --env AUTORUN_ENABLED=false \
    --env AUTORUN_LARAVEL_MIGRATION=false \
    pixelfed php artisan migrate:status --pending --no-ansi --no-interaction
)"
migrations_applied=false
if ! grep -Fq 'No pending migrations.' <<<"$pending_output"; then
  [[ "$migration_approval" == "MIGRATIONS_APPROVED" ]] || {
    echo "Pending migrations require MIGRATIONS_APPROVED." >&2
    exit 1
  }
  [[ -x /usr/local/sbin/mochirii-social-backup ]] || {
    echo "A verified online backup command is required before migrations." >&2
    exit 1
  }

  /usr/local/sbin/mochirii-social-backup "pre-deploy-$commit"
  docker exec pixelfed-app php artisan down --retry=60 --no-ansi
  compose_release "$release_dir" run \
    --rm \
    --no-deps \
    --env AUTORUN_ENABLED=false \
    --env AUTORUN_LARAVEL_MIGRATION=false \
    pixelfed php artisan migrate --force --isolated --no-interaction
  migrations_applied=true
fi

rollback_image() {
  if [[ "$migrations_applied" == true ]]; then
    docker exec pixelfed-app php artisan down --retry=60 --no-ansi >/dev/null 2>&1 || true
    echo "A migration was applied; maintenance mode remains active for forward-fix or restore." >&2
    return
  fi

  echo "Runtime verification failed; restoring the previous image release." >&2
  compose_release "$previous_release" up \
    --detach \
    --no-build \
    --remove-orphans \
    pixelfed horizon scheduler
  verify_runtime
}

if ! compose_release "$release_dir" up \
  --detach \
  --no-build \
  --remove-orphans \
  db redis pixelfed horizon scheduler; then
  rollback_image
  exit 1
fi

if [[ "$migrations_applied" == true ]]; then
  wait_for_container_health pixelfed-app 300
  docker exec pixelfed-app php artisan up --no-ansi
fi
if ! verify_runtime; then
  rollback_image
  exit 1
fi

ln -sfn "$release_dir" "$CURRENT_LINK"

echo "Deployed $commit at $digest."
