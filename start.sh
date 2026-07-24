#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
[ -f "$root/.env" ] || { echo "Missing .env (copy .env.example)" >&2; exit 1; }
[ -d "$root/backend/node_modules" ] && [ -d "$root/frontend/node_modules" ] || { echo "Dependencies missing; run scripts/bootstrap.sh" >&2; exit 1; }
set -a; . "$root/.env"; set +a
backend_port="${BACKEND_PORT:-3001}"
frontend_port="${FRONTEND_PORT:-3000}"
for port in "$backend_port" "$frontend_port"; do
  if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port is already in use; refusing to stop another process." >&2
    exit 1
  fi
done
if [ "${MIGRATE_ON_START:-false}" = true ]; then
  case "${ALLOW_SCHEMA_MIGRATION:-}" in
    1|true) ;;
    *) echo 'Explicit schema migration acknowledgement is required.' >&2; exit 1 ;;
  esac
  bash "$root/scripts/migrate.sh"
  (cd "$root/backend" && npm run create-admin)
fi
(cd "$root/backend" && npm start) & backend_pid=$!
(cd "$root/frontend" && ./node_modules/.bin/vite --host "${HOST:-127.0.0.1}" --port "$frontend_port") & frontend_pid=$!
cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$backend_pid" "$frontend_pid"
