#!/usr/bin/env bash
# Nightly copy of the FullHearts database, keeping the last 14. Run from
# whaletale's crontab:
#   15 3 * * * /home/whaletale/fullhearts-app/deploy/backup-db.sh
# These copies live on the same disk as the database. Pull them off the box
# too (rsync/scp from another machine), or a dead droplet takes both.
set -euo pipefail

DB=${FULLHEARTS_DB_PATH:-/var/lib/fullhearts/fullhearts.db}
DEST=${BACKUP_DIR:-/var/lib/fullhearts/backups}
KEEP=14

mkdir -p "$DEST"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sqlite3 "$DB" ".backup '$DEST/nightly-$stamp.db'"
sqlite3 "$DEST/nightly-$stamp.db" "PRAGMA integrity_check;" | grep -qx ok

ls -1t "$DEST"/nightly-*.db | tail -n +$((KEEP + 1)) | xargs -r rm --
