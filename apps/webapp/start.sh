#!/bin/sh -ex

# Docker entrypoint.
#
# Runs pending database migrations first (idempotent — skips already-applied
# ones), then starts the production server.
#
# NOTE: We call `node` directly instead of `pnpm run start` because the
# production Docker image does not include pnpm-workspace.yaml. Without it,
# pnpm cannot resolve the workspace and the server fails to start.

node /src/packages/database/src/migrate.cjs

NODE_ENV=production node ./build/server/index.js
