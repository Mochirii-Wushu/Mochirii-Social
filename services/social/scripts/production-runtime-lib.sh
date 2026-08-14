#!/usr/bin/env bash

set -Eeuo pipefail

RUNTIME_ROOT="${MOCHIRII_SOCIAL_ROOT:-/opt/mochirii-social}"
RELEASES_ROOT="$RUNTIME_ROOT/releases"
SHARED_ROOT="$RUNTIME_ROOT/shared"
DATA_ROOT="$RUNTIME_ROOT/data"
CURRENT_LINK="$RUNTIME_ROOT/current"
LOCK_FILE="${MOCHIRII_SOCIAL_LOCK:-/run/lock/mochirii-social-deploy.lock}"
REGISTRY_IMAGE="ghcr.io/mochirii-wushu/mochirii-pixelfed-ops"
PULL_USER="${MOCHIRII_SOCIAL_PULL_USER:-mochirii}"

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "This operation must run as root." >&2
    exit 1
  fi
}

validate_commit() {
  [[ "$1" =~ ^[0-9a-f]{40}$ ]] || {
    echo "The release commit must be a full lowercase Git SHA." >&2
    exit 1
  }
}

validate_digest() {
  [[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]] || {
    echo "The release image must use a sha256 digest." >&2
    exit 1
  }
}

release_dir_for() {
  printf '%s/%s\n' "$RELEASES_ROOT" "$1"
}

pull_release_image() {
  local image_ref="$1"
  id "$PULL_USER" >/dev/null 2>&1 || {
    echo "The configured GHCR pull user does not exist." >&2
    exit 1
  }
  sudo -H -u "$PULL_USER" -- docker pull "$image_ref" >/dev/null
}

compose_release() {
  local release_dir="$1"
  shift
  docker compose \
    --project-directory "$release_dir" \
    --env-file "$SHARED_ROOT/pixelfed.env" \
    --env-file "$release_dir/release.env" \
    --file "$release_dir/docker-compose.production.yml" \
    "$@"
}

wait_for_container_health() {
  local container_name="$1"
  local timeout_seconds="$2"
  local deadline=$((SECONDS + timeout_seconds))

  while ((SECONDS < deadline)); do
    local status
    status="$(
      docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$container_name" 2>/dev/null || true
    )"

    case "$status" in
      healthy | running)
        return 0
        ;;
      unhealthy | exited | dead)
        echo "$container_name entered terminal state: $status" >&2
        docker logs --tail 100 "$container_name" >&2 || true
        return 1
        ;;
    esac

    sleep 5
  done

  echo "$container_name did not become healthy within ${timeout_seconds}s." >&2
  docker logs --tail 100 "$container_name" >&2 || true
  return 1
}

verify_runtime() {
  wait_for_container_health pixelfed-db 180
  wait_for_container_health pixelfed-redis 90
  wait_for_container_health pixelfed-app 300
  wait_for_container_health pixelfed-horizon 180
  wait_for_container_health pixelfed-scheduler 180

  docker exec pixelfed-horizon php artisan horizon:status --no-ansi
  docker exec pixelfed-scheduler php artisan schedule:list --no-ansi >/dev/null
  curl \
    --fail \
    --silent \
    --show-error \
    --max-time 20 \
    --header 'Host: social.mochirii.com' \
    http://127.0.0.1:8080/ >/dev/null
  curl \
    --fail \
    --silent \
    --show-error \
    --location \
    --max-time 30 \
    https://social.mochirii.com/ >/dev/null

  docker exec pixelfed-app php artisan tinker --execute="
    if (
      config('pixelfed.open_registration') ||
      !config('pixelfed.oauth_enabled') ||
      config('federation.activitypub.enabled') ||
      !config('pixelfed.cloud_storage') ||
      config('filesystems.cloud') !== 's3' ||
      !config('media.delete_local_after_cloud')
    ) {
      throw new RuntimeException('Runtime policy gate failed.');
    }
  " >/dev/null

  echo "Pixelfed runtime gates passed."
}

verify_spaces_round_trip() {
  docker exec pixelfed-app php artisan tinker --execute='
    $disk = \Illuminate\Support\Facades\Storage::disk("s3");
    $key = "hosted-verification/" . bin2hex(random_bytes(16)) . ".txt";
    $payload = bin2hex(random_bytes(32));

    try {
      if (!$disk->put($key, $payload)) {
        throw new \RuntimeException("Spaces write failed.");
      }
      if (!$disk->exists($key)) {
        throw new \RuntimeException("Spaces read-after-write failed.");
      }
      if (!hash_equals($payload, $disk->get($key))) {
        throw new \RuntimeException("Spaces content verification failed.");
      }
    } finally {
      $disk->delete($key);
    }

    if ($disk->exists($key)) {
      throw new \RuntimeException("Spaces delete verification failed.");
    }
  ' >/dev/null

  echo "Spaces write, read, and delete gates passed."
}

verify_online_hosting() {
  verify_runtime
  verify_spaces_round_trip
  echo "Online-hosted Pixelfed independence gates passed."
}
