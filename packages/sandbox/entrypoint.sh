#!/bin/bash
# Fix workspace permissions — volume may have been created by a root container
chown -R sandbox:sandbox /workspace 2>/dev/null || true

# Drop to sandbox user and run the app
exec gosu sandbox node dist/entry.js
