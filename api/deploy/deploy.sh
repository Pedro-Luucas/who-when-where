#!/usr/bin/env bash
# Ships the API to the server and restarts it. Run from anywhere (Git Bash on
# Windows works); the server must have been prepared once with setup.sh.
#
#   api/deploy/deploy.sh <ssh-host>        e.g. root@203.0.113.5, or an ssh alias
set -euo pipefail

HOST="${1:?Usage: deploy.sh <ssh-host>}"
APP_DIR=/srv/who-when-where/api

cd "$(dirname "$0")/.."

echo "== tests"
npm test --silent

echo "== upload"
tar -czf - package.json package-lock.json src scripts |
  ssh "$HOST" "set -e
    cd $APP_DIR
    rm -rf src scripts
    tar -xzf - --no-same-owner
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund --silent
    systemctl restart who-when-where-api
    . /etc/who-when-where/api.env
    for attempt in 1 2 3 4 5 6 7 8 9 10; do
      sleep 1
      if curl -fsS \"http://127.0.0.1:\$PORT/health\" >/dev/null 2>&1; then
        echo 'API is up.'
        exit 0
      fi
    done
    echo 'API did not come up:' >&2
    journalctl -u who-when-where-api -n 30 --no-pager >&2
    exit 1"
