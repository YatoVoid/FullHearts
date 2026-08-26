#!/usr/bin/env bash
# Wrapper so systemd (which doesn't source shell rc files or nvm's shell
# function) can still run FullHearts under an nvm-managed Node, without
# touching the system-wide node/npm other services on this box may depend on.
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 24 > /dev/null

exec npm run start -- -p 3000
