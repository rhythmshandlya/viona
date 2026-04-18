#!/bin/bash
# Entrypoint works on:
#   - Docker/Railway: starts as root, fixes workspace perms, drops to sandbox user
#   - E2B: starts as `user` (non-root), runs node directly (microVM provides isolation)

cd /app

if [ "$(id -u)" = "0" ]; then
  chown -R sandbox:sandbox /workspace 2>/dev/null || true
  exec gosu sandbox node /app/dist/entry.js
else
  exec node /app/dist/entry.js
fi
