#!/usr/bin/env bash

set -Eeuo pipefail

umask 077
read -r action confirmation extra <<<"${SSH_ORIGINAL_COMMAND:-}"
[[ "$action" == "restore" && "$confirmation" == "RESTORE_social.mochirii.com" ]] || {
  echo "Unsupported recovery action." >&2
  exit 1
}
[[ -z "${extra:-}" ]] || {
  echo "Unexpected recovery arguments." >&2
  exit 1
}

payload_path="$(mktemp /tmp/mochirii-social-restore.XXXXXX.tar)"
cleanup() {
  rm -f "$payload_path"
}
trap cleanup EXIT

head -c 536870913 >"$payload_path"
[[ "$(stat -c '%s' "$payload_path")" -le 536870912 ]] || {
  echo "The recovery payload is too large." >&2
  exit 1
}

sudo -n /usr/local/sbin/mochirii-social-restore \
  "$payload_path" "$confirmation"
