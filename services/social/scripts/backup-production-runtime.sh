#!/usr/bin/env bash

set -Eeuo pipefail

umask 077

RUNTIME_ROOT="${MOCHIRII_SOCIAL_ROOT:-/opt/mochirii-social}"
BACKUP_ROOT="$RUNTIME_ROOT/backups"
BACKUP_ENV="${MOCHIRII_SOCIAL_BACKUP_ENV:-$RUNTIME_ROOT/shared/backup.env}"
RECIPIENT_FILE="${MOCHIRII_SOCIAL_BACKUP_RECIPIENT:-$RUNTIME_ROOT/shared/backup-recipient.pub}"
LOCK_FILE="${MOCHIRII_SOCIAL_BACKUP_LOCK:-/run/lock/mochirii-social-backup.lock}"
MARIADB_IMAGE="mariadb:11.4@sha256:a794d9eb009e20de605858a11f32f63b4075cbd197c650436f0e3b457e4caed7"
RESTORE_TABLES=(users statuses media oauth_clients)

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "The production backup must run as root." >&2
  exit 1
fi

label="${1:-nightly}"
[[ "$label" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || {
  echo "The backup label is invalid." >&2
  exit 1
}
verify_only=false
[[ "$label" == "verify-local" ]] && verify_only=true

for command_name in docker flock gzip od tar; do
  command -v "$command_name" >/dev/null || {
    echo "Missing backup dependency: $command_name" >&2
    exit 1
  }
done

if [[ "$verify_only" == false ]]; then
  for command_name in age rclone; do
    command -v "$command_name" >/dev/null || {
      echo "Missing backup dependency: $command_name" >&2
      exit 1
    }
  done
  [[ -f "$BACKUP_ENV" ]] || {
    echo "The root-owned backup environment is missing." >&2
    exit 1
  }
  [[ "$(stat -c '%u:%a' "$BACKUP_ENV")" == "0:600" ]] || {
    echo "The backup environment must be owned by root with mode 600." >&2
    exit 1
  }
  [[ -f "$RECIPIENT_FILE" && "$(stat -c '%u' "$RECIPIENT_FILE")" == "0" ]] || {
    echo "The root-owned backup recipient is missing." >&2
    exit 1
  }

  set -a
  # shellcheck source=/dev/null
  source "$BACKUP_ENV"
  set +a

  required_variables=(
    BACKUP_S3_ACCESS_KEY_ID
    BACKUP_S3_SECRET_ACCESS_KEY
    BACKUP_S3_BUCKET
    BACKUP_S3_ENDPOINT
    BACKUP_S3_REGION
  )
  for variable_name in "${required_variables[@]}"; do
    [[ -n "${!variable_name:-}" ]] || {
      echo "Missing required backup setting: $variable_name" >&2
      exit 1
    }
  done
  [[ "$BACKUP_S3_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || {
    echo "The backup bucket name is invalid." >&2
    exit 1
  }
  [[ "$BACKUP_S3_ENDPOINT" =~ ^https://[a-z0-9-]+\.digitaloceanspaces\.com$ ]] || {
    echo "The backup endpoint is invalid." >&2
    exit 1
  }

  export RCLONE_CONFIG_MOCHIRII_BACKUP_TYPE=s3
  export RCLONE_CONFIG_MOCHIRII_BACKUP_PROVIDER=DigitalOcean
  export RCLONE_CONFIG_MOCHIRII_BACKUP_ENV_AUTH=false
  export RCLONE_CONFIG_MOCHIRII_BACKUP_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
  export RCLONE_CONFIG_MOCHIRII_BACKUP_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_MOCHIRII_BACKUP_ENDPOINT="$BACKUP_S3_ENDPOINT"
  export RCLONE_CONFIG_MOCHIRII_BACKUP_REGION="$BACKUP_S3_REGION"
  remote_root="MOCHIRII_BACKUP:$BACKUP_S3_BUCKET"
fi

install -d -m 0700 -o root -g root "$BACKUP_ROOT" "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "Another Mochirii Social backup is active." >&2
  exit 1
}

available_kib="$(df --output=avail "$BACKUP_ROOT" | tail -n 1 | tr -d ' ')"
[[ "$available_kib" =~ ^[0-9]+$ && "$available_kib" -ge 2097152 ]] || {
  echo "At least 2 GiB of free disk is required for backup validation." >&2
  exit 1
}

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
work_dir="$(mktemp -d "$BACKUP_ROOT/.work-${timestamp}.XXXXXX")"
restore_container="mochirii-backup-verify-${timestamp,,}-$$"

cleanup() {
  docker rm --force "$restore_container" >/dev/null 2>&1 || true
  if [[ "$work_dir" == "$BACKUP_ROOT/.work-"* ]]; then
    rm -rf -- "$work_dir"
  fi
}
trap cleanup EXIT

database_dump="$work_dir/database.sql.gz"
config_archive="$work_dir/configuration.tar.gz"
payload_archive="$work_dir/recovery.tar"
encrypted_archive="$work_dir/recovery.tar.age"

docker exec pixelfed-db sh -ec '
  MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump \
    --user=root \
    --single-transaction \
    --quick \
    --routines \
    --events \
    --triggers \
    --hex-blob \
    "$MARIADB_DATABASE"
' | gzip -9 >"$database_dump"
gzip -t "$database_dump"
echo "Transactional database dump created."

restore_password="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
docker run \
  --detach \
  --rm \
  --name "$restore_container" \
  --network none \
  --memory 768m \
  --tmpfs /var/lib/mysql:rw,noexec,nosuid,size=640m \
  --env MARIADB_DATABASE=restore_check \
  --env MARIADB_ROOT_PASSWORD="$restore_password" \
  "$MARIADB_IMAGE" >/dev/null

restore_ready=false
for _ in {1..60}; do
  if docker exec \
    --env MYSQL_PWD="$restore_password" \
    "$restore_container" \
    mariadb \
      --user=root \
      --batch \
      --skip-column-names \
      --execute='SELECT 1;' >/dev/null 2>&1; then
    restore_ready=true
    break
  fi
  sleep 2
done
[[ "$restore_ready" == true ]] || {
  echo "The isolated restore database did not become ready." >&2
  exit 1
}
echo "Isolated restore database is ready."

gzip -dc "$database_dump" | docker exec \
  --interactive \
  --env MYSQL_PWD="$restore_password" \
  "$restore_container" \
  mariadb --user=root restore_check

read_source_count() {
  local table_name="$1"
  docker exec pixelfed-db sh -ec '
    MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb \
      --user=root \
      --batch \
      --skip-column-names \
      "$MARIADB_DATABASE" \
      --execute="$1"
  ' sh "SELECT COUNT(*) FROM \`$table_name\`;"
}

read_restore_count() {
  local table_name="$1"
  docker exec \
    --env MYSQL_PWD="$restore_password" \
    "$restore_container" \
    mariadb \
    --user=root \
    --batch \
    --skip-column-names \
    restore_check \
    --execute="SELECT COUNT(*) FROM \`$table_name\`;"
}

for table_name in "${RESTORE_TABLES[@]}"; do
  source_count="$(read_source_count "$table_name")"
  restore_count="$(read_restore_count "$table_name")"
  [[ "$source_count" =~ ^[0-9]+$ && "$source_count" == "$restore_count" ]] || {
    echo "Restore verification failed for a critical table." >&2
    exit 1
  }
done
docker rm --force "$restore_container" >/dev/null
echo "Critical table counts match the isolated restore."

if [[ "$verify_only" == true ]]; then
  echo "Transactional dump and isolated restore verification passed."
  exit 0
fi

release_dir="$(readlink -f "$RUNTIME_ROOT/current")"
[[ "$release_dir" == "$RUNTIME_ROOT/releases/"* ]] || {
  echo "The current release link is invalid." >&2
  exit 1
}
config_files=(
  "${BACKUP_ENV#/}"
  "${RECIPIENT_FILE#/}"
  "${RUNTIME_ROOT#/}/shared/pixelfed.env"
  "${release_dir#/}/docker-compose.production.yml"
  "${release_dir#/}/release.env"
  "${release_dir#/}/release.meta"
  "etc/caddy/Caddyfile"
  "etc/ssh/sshd_config.d/99-mochirii-hardening.conf"
)
for optional_file in \
  etc/systemd/system/mochirii-social-backup.service \
  etc/systemd/system/mochirii-social-backup.timer; do
  [[ -f "/$optional_file" ]] && config_files+=("$optional_file")
done
for relative_file in "${config_files[@]}"; do
  [[ -f "/$relative_file" ]] || {
    echo "Required recovery configuration is missing." >&2
    exit 1
  }
done
tar \
  --create \
  --gzip \
  --file "$config_archive" \
  --directory / \
  --owner 0 \
  --group 0 \
  --numeric-owner \
  "${config_files[@]}"
tar -tzf "$config_archive" >/dev/null

release_commit="$(awk -F= '$1 == "commit" { print $2 }' "$release_dir/release.meta")"
release_digest="$(awk -F= '$1 == "digest" { print $2 }' "$release_dir/release.meta")"
[[ "$release_commit" =~ ^[0-9a-f]{40}$ && "$release_digest" =~ ^sha256:[0-9a-f]{64}$ ]] || {
  echo "The release metadata is invalid." >&2
  exit 1
}
cat >"$work_dir/manifest" <<EOF
format=1
created_utc=$timestamp
release_commit=$release_commit
release_digest=$release_digest
EOF
tar \
  --create \
  --file "$payload_archive" \
  --directory "$work_dir" \
  database.sql.gz configuration.tar.gz manifest
age \
  --encrypt \
  --recipients-file "$RECIPIENT_FILE" \
  --output "$encrypted_archive" \
  "$payload_archive"
rm -f "$database_dump" "$config_archive" "$payload_archive" "$work_dir/manifest"

upload_object() {
  local retention_class="$1"
  local object_name="$2"
  rclone \
    --config /dev/null \
    --quiet \
    copyto \
    --s3-acl private \
    --s3-no-check-bucket \
    "$encrypted_archive" \
    "$remote_root/$retention_class/$object_name"
  rclone \
    --config /dev/null \
    --quiet \
    lsf \
    --files-only \
    "$remote_root/$retention_class" \
    | grep -Fxq "$object_name"
}

prune_retention() {
  local retention_class="$1"
  local keep_count="$2"
  local object_name
  local index
  mapfile -t objects < <(
    rclone \
      --config /dev/null \
      lsf \
      --files-only \
      "$remote_root/$retention_class" \
      | LC_ALL=C sort -r
  )
  for ((index = keep_count; index < ${#objects[@]}; index++)); do
    object_name="${objects[$index]}"
    [[ "$object_name" =~ ^[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9._-]+\.tar\.age$ ]] || {
      echo "Refusing to prune an unexpected backup object name." >&2
      exit 1
    }
    rclone \
      --config /dev/null \
      --quiet \
      deletefile "$remote_root/$retention_class/$object_name"
  done
}

object_name="$timestamp-$label.tar.age"
if [[ "$label" == "nightly" ]]; then
  upload_object daily "$object_name"
  if [[ "$(date -u +%u)" == "7" ]]; then
    upload_object weekly "$object_name"
  fi
  if [[ "$(date -u +%d)" == "01" ]]; then
    upload_object monthly "$object_name"
  fi
  prune_retention daily 14
  prune_retention weekly 8
  prune_retention monthly 6
  echo "Verified encrypted nightly recovery point uploaded."
else
  upload_object manual "$object_name"
  prune_retention manual 8
  echo "Verified encrypted manual recovery point uploaded."
fi
