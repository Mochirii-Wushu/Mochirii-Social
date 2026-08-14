#!/usr/bin/env bash

set -Eeuo pipefail

umask 077
read -r action argument_one argument_two argument_three argument_four extra \
  <<<"${SSH_ORIGINAL_COMMAND:-}"

if [[ "$action" == "verify" ]]; then
  [[ "$argument_one" == "VERIFY_social.mochirii.com" ]] || {
    echo "The verification confirmation is invalid." >&2
    exit 1
  }
  [[ -z "${argument_two:-}" && -z "${argument_three:-}" && -z "${argument_four:-}" && -z "${extra:-}" ]] || {
    echo "Unexpected verification arguments." >&2
    exit 1
  }

  exec sudo -n /usr/local/sbin/mochirii-social-deploy --verify-online-hosting
fi

[[ "$action" == "deploy" ]] || {
  echo "Unsupported deployment action." >&2
  exit 1
}
[[ -z "${extra:-}" ]] || {
  echo "Unexpected deployment arguments." >&2
  exit 1
}

commit="$argument_one"
digest="$argument_two"
confirmation="$argument_three"
migration_approval="$argument_four"

[[ "$confirmation" == "DEPLOY_social.mochirii.com" ]] || {
  echo "The deployment confirmation is invalid." >&2
  exit 1
}
[[ "$commit" =~ ^[0-9a-f]{40}$ ]]
[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]
[[ "$migration_approval" == "NONE" || "$migration_approval" == "MIGRATIONS_APPROVED" ]]

bundle_path="$(mktemp /tmp/mochirii-social-release.XXXXXX.tar.gz)"
cleanup() {
  rm -f "$bundle_path"
}
trap cleanup EXIT

head -c 1048577 >"$bundle_path"
[[ "$(stat -c '%s' "$bundle_path")" -le 1048576 ]] || {
  echo "The release bundle is too large." >&2
  exit 1
}

sudo -n /usr/local/sbin/mochirii-social-deploy \
  "$bundle_path" "$commit" "$digest" "$migration_approval"
