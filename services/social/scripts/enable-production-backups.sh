#!/usr/bin/env bash

set -Eeuo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run the backup activation as root." >&2
  exit 1
fi

backup_env="${MOCHIRII_SOCIAL_BACKUP_ENV:-/opt/mochirii-social/shared/backup.env}"
recipient_file="${MOCHIRII_SOCIAL_BACKUP_RECIPIENT:-/opt/mochirii-social/shared/backup-recipient.pub}"
[[ -f "$backup_env" && "$(stat -c '%u:%a' "$backup_env")" == "0:600" ]] || {
  echo "The root-owned mode-600 backup environment is not ready." >&2
  exit 1
}
[[ -f "$recipient_file" && "$(stat -c '%u' "$recipient_file")" == "0" ]] || {
  echo "The root-owned backup recipient is not ready." >&2
  exit 1
}

/usr/local/sbin/mochirii-social-backup bootstrap
systemctl enable --now mochirii-social-backup.timer
systemctl is-enabled --quiet mochirii-social-backup.timer
systemctl is-active --quiet mochirii-social-backup.timer

echo "Online backup validation passed and the nightly timer is active."
