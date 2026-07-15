#!/bin/sh
set -eu

DATA_DIR="/app/data"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  if ! chown -R node:node "$DATA_DIR"; then
    echo "Unable to make $DATA_DIR writable by the node user. Check the mounted volume permissions." >&2
    exit 1
  fi
  exec su-exec node "$@"
fi

exec "$@"
