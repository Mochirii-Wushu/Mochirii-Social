#!/usr/bin/env bash

set -Eeuo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repository_root"

image="${PIXELFED_IMAGE:-mochirii-pixelfed:production-check}"
expected_revision="${GITHUB_SHA:-$(git rev-parse HEAD)}"
expected_upstream="$(tr -d '\r\n' < UPSTREAM_REVISION)"
expected_version="$(
  sed -n "s/^[[:space:]]*'version'[[:space:]]*=>[[:space:]]*'\([^']*\)'.*/\1/p" \
    services/social/config/pixelfed.php |
    head -n 1
)"

[[ "$expected_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_upstream" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_version" =~ ^[0-9]+[.][0-9]+[.][0-9]+$ ]]

label() {
  docker image inspect \
    --format "${2}" \
    "$image"
}

[[ "$(label "$image" '{{ index .Config.Labels "org.opencontainers.image.source" }}')" == \
  "https://github.com/Mochirii-Wushu/Mochirii-Social" ]]
[[ "$(label "$image" '{{ index .Config.Labels "org.opencontainers.image.revision" }}')" == \
  "$expected_revision" ]]
[[ "$(label "$image" '{{ index .Config.Labels "org.opencontainers.image.version" }}')" == \
  "$expected_version" ]]
[[ "$(label "$image" '{{ index .Config.Labels "org.opencontainers.image.licenses" }}')" == \
  "AGPL-3.0-only" ]]
[[ "$(label "$image" '{{ index .Config.Labels "com.mochirii.social.upstream.revision" }}')" == \
  "$expected_upstream" ]]

echo "Production image OCI labels match the exact Social release identity."
