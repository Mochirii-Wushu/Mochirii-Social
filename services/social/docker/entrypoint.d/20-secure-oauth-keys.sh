#!/bin/sh

set -eu

app_dir="${APP_BASE_DIR:-/var/www/html}"

for key_path in \
    "$app_dir/storage/oauth-private.key" \
    "$app_dir/storage/oauth-public.key"
do
    [ -e "$key_path" ] || continue

    if [ -L "$key_path" ] || [ ! -f "$key_path" ]; then
        echo "Refusing invalid OAuth key path: $key_path" >&2
        exit 1
    fi

    chmod 600 "$key_path"
done
