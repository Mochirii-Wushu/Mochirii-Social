#!/usr/bin/env bash

set -Eeuo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run the Caddy installer as root." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_config="$repo_root/caddy/Caddyfile"
target_config=/etc/caddy/Caddyfile
rollback_config=/etc/caddy/Caddyfile.pre-upload-limit

for command_name in caddy curl systemctl; do
  command -v "$command_name" >/dev/null || {
    echo "Missing Caddy deployment dependency: $command_name" >&2
    exit 1
  }
done
[[ -f "$source_config" && -f "$target_config" ]] || {
  echo "The tracked or active Caddy configuration is missing." >&2
  exit 1
}

caddy validate --config "$source_config" --adapter caddyfile >/dev/null
changed=false
if ! cmp -s "$source_config" "$target_config"; then
  install -m 0644 -o root -g root "$target_config" "$rollback_config"
  install -m 0644 -o root -g root "$source_config" "$target_config"
  changed=true
fi

rollback() {
  echo "Caddy verification failed; restoring the prior configuration." >&2
  if [[ "$changed" == true && -f "$rollback_config" ]]; then
    install -m 0644 -o root -g root "$rollback_config" "$target_config"
    caddy validate --config "$target_config" --adapter caddyfile >/dev/null
    systemctl reload caddy
  fi
}
trap rollback ERR

caddy validate --config "$target_config" --adapter caddyfile >/dev/null
systemctl reload caddy
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

trap - ERR
echo "Validated and reloaded the tracked Caddy upload limit."
