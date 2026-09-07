#!/bin/sh
set -e

SEED_MARKER="/app/.data/.seeded"

echo "Waiting for database to accept migrations..."
attempt=0
until npx prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Database did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done

mkdir -p /app/.data

if [ ! -f "$SEED_MARKER" ]; then
  echo "Running default seed..."
  npm run db:seed:default
  touch "$SEED_MARKER"
else
  echo "Default seed already applied, skipping."
fi

exec "$@"
