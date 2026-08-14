#!/usr/bin/env bash

set -Eeuo pipefail

app_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repository_root="$(cd "$app_root/../.." && pwd)"
cd "$app_root"

image="${PIXELFED_IMAGE:-mochirii-pixelfed:production-check}"
revision="${GITHUB_SHA:-$(git -C "$repository_root" rev-parse HEAD)}"
source_url="https://github.com/Mochirii-Wushu/Mochirii-Social"
upstream_revision="$(tr -d '\r\n' < "$repository_root/UPSTREAM_REVISION")"
application_version="$(
  sed -n "s/^[[:space:]]*'version'[[:space:]]*=>[[:space:]]*'\([^']*\)'.*/\1/p" \
    config/pixelfed.php |
    head -n 1
)"

[[ "$revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$upstream_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$application_version" =~ ^[0-9]+[.][0-9]+[.][0-9]+$ ]]

build_args=(
  docker buildx build
  --load
  --tag "$image"
  --label "org.opencontainers.image.source=$source_url"
  --label "org.opencontainers.image.revision=$revision"
  --label "org.opencontainers.image.version=$application_version"
  --label "org.opencontainers.image.licenses=AGPL-3.0-only"
  --label "com.mochirii.social.upstream.revision=$upstream_revision"
)

if [[ -n "${BUILD_CACHE_FROM:-}" ]]; then
  build_args+=(--cache-from "$BUILD_CACHE_FROM")
fi
if [[ -n "${BUILD_CACHE_TO:-}" ]]; then
  build_args+=(--cache-to "$BUILD_CACHE_TO")
fi

"${build_args[@]}" .
