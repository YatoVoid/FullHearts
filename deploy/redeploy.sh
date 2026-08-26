#!/usr/bin/env bash
# Pull-based redeploy for the dynamic (Node) FullHearts setup. Replaces the
# old "clone to /tmp, build, rsync into out/" flow entirely, since there is no
# out/ anymore, this builds and restarts a long-running Node process instead.
set -euo pipefail

REPO_DIR=/home/wali/fullhearts-app
REPO_URL=https://github.com/YatoVoid/FullHearts.git
BRANCH=main
SERVICE=fullhearts

if [ ! -d "$REPO_DIR/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

npm ci
NEXT_NODE_SERVER=1 npm run build

sudo systemctl restart "$SERVICE"

# Confirm it actually came back before calling this a success. A build that
# succeeds but a service that fails to start should fail loudly, not silently.
for _ in $(seq 1 10); do
  if curl -fsS http://127.0.0.1:3000/ > /dev/null; then
    echo "fullhearts is up"
    exit 0
  fi
  sleep 1
done

echo "fullhearts did not come back up after restart. Check: journalctl -u $SERVICE -n 50" >&2
exit 1
