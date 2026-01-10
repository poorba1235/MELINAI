#!/usr/bin/env bash
set -euo pipefail

export DEBUG_SERVER_PORT="${DEBUG_SERVER_PORT:-4000}"
export CODE_PATH="${CODE_PATH:-/app/data}"
export PGLITE_DATA_DIR="${PGLITE_DATA_DIR:-/app/data/pglite}"
export PORT="${PORT:-3002}"

# mkdir -p "${CODE_PATH}" "${PGLITE_DATA_DIR}"

# Start soul-engine (internal only)
(
  cd /app/opensouls/packages/soul-engine-cloud
  exec bun run scripts/run-server.ts "${CODE_PATH}"
) &

# Give the engine a moment to boot (pglite bootstrap + worker pool).
sleep 3

# Register the soul blueprint with the running engine on every boot.
# This is intentionally in start.sh (not Dockerfile) because the CLI requires a live websocket connection.
echo "[boot] registering tanaki-speaks blueprint..."
(
  cd /app/packages/tanaki-speaks
  echo "[boot] using local CLI: /app/opensouls/packages/cli/bin/run.js"
  if [ ! -f /app/opensouls/packages/cli/bin/run.js ]; then
    echo "[boot] ERROR: missing /app/opensouls/packages/cli/bin/run.js"
    ls -la /app/opensouls/packages/cli || true
    exit 1
  fi

  # Avoid `bunx soul-engine` which may try to download `soul-engine@latest`.
  # Execute the local CLI entrypoint directly (shebang uses bun).
  chmod +x /app/opensouls/packages/cli/bin/run.js || true
  /app/opensouls/packages/cli/bin/run.js dev --once --noopen \
    || bun /app/opensouls/packages/cli/bin/run.js dev --once --noopen
)

# Start the Bun front server (public)
cd /app/packages/tanaki-speaks-web
exec bun run ./bun-server.ts

