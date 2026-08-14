#!/usr/bin/env bash

set -Eeuo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run the installer as root." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
public_key_file="${1:-}"
deploy_user="${MOCHIRII_SOCIAL_DEPLOY_USER:-github-deploy}"
runtime_root="${MOCHIRII_SOCIAL_ROOT:-/opt/mochirii-social}"

[[ -f "$public_key_file" ]] || {
  echo "Usage: install-production-runtime.sh <deploy-public-key-file>" >&2
  exit 1
}
[[ "$(wc -l <"$public_key_file")" -eq 1 ]] || {
  echo "The deploy public-key file must contain exactly one key." >&2
  exit 1
}
grep -Eq '^ssh-ed25519 [A-Za-z0-9+/=]+( .*)?$' "$public_key_file" || {
  echo "The deploy key must be an Ed25519 public key." >&2
  exit 1
}

for command_name in docker flock rsync visudo; do
  command -v "$command_name" >/dev/null || {
    echo "Missing required command: $command_name" >&2
    exit 1
  }
done
docker compose version >/dev/null

install -d -m 0750 -o root -g root \
  "$runtime_root" \
  "$runtime_root/releases" \
  "$runtime_root/shared" \
  "$runtime_root/data" \
  "$runtime_root/backups"
install -m 0644 -o root -g root \
  "$repo_root/docker-compose.production.yml" \
  "$runtime_root/shared/docker-compose.production.yml"
install -d -m 0755 -o root -g root /usr/local/lib/mochirii-social
install -m 0644 -o root -g root \
  "$repo_root/scripts/production-runtime-lib.sh" \
  /usr/local/lib/mochirii-social/production-runtime-lib.sh
install -m 0755 -o root -g root \
  "$repo_root/scripts/deploy-production-runtime.sh" \
  /usr/local/sbin/mochirii-social-deploy
install -m 0755 -o root -g root \
  "$repo_root/scripts/deploy-production-entrypoint.sh" \
  /usr/local/sbin/mochirii-social-deploy-entry

if ! id "$deploy_user" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$deploy_user"
fi
passwd --lock "$deploy_user" >/dev/null

deploy_home="$(getent passwd "$deploy_user" | cut -d: -f6)"
install -d -m 0700 -o "$deploy_user" -g "$deploy_user" "$deploy_home/.ssh"
{
  printf '%s ' 'restrict,command="/usr/local/sbin/mochirii-social-deploy-entry"'
  cat "$public_key_file"
} >"$deploy_home/.ssh/authorized_keys"
chown "$deploy_user:$deploy_user" "$deploy_home/.ssh/authorized_keys"
chmod 0600 "$deploy_home/.ssh/authorized_keys"

sudoers_file="/etc/sudoers.d/mochirii-social-deploy"
cat >"$sudoers_file" <<EOF
$deploy_user ALL=(root) NOPASSWD: /usr/local/sbin/mochirii-social-deploy *
EOF
chmod 0440 "$sudoers_file"
visudo -cf "$sudoers_file" >/dev/null

echo "Installed the restricted Mochirii Social deployment runtime."
