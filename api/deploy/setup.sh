#!/usr/bin/env bash
# One-time server setup for the API. Run as root on the server (Ubuntu):
#
#   ssh <host> "DOMAIN=api.example.com bash -s" < api/deploy/setup.sh
#
# It creates a locked-down service user, the systemd units (API + nightly
# backup), installs Caddy for HTTPS and opens ports 80/443. It is safe to run
# again. Ship the code afterwards with deploy.sh.
#
#   DOMAIN  host name the API answers on; it must already point at this server
#   BIND    optional: addresses Caddy listens on, e.g. "203.0.113.5 [2001:db8::1]"
#           (needed when something else on the server already uses port 443
#           on another address)
#   PORT    optional: local port for the API (default 4310)
set -euo pipefail

: "${DOMAIN:?Set DOMAIN to the host name the API will answer on}"
BIND="${BIND:-}"
PORT="${PORT:-4310}"

APP_USER=whowhenwhere
APP_DIR=/srv/who-when-where/api
ENV_FILE=/etc/who-when-where/api.env
NODE_BIN="$(command -v node)"

node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' ||
  { echo "Node.js 24 or newer is required (found $(node -v))" >&2; exit 1; }

echo "== user and directories"
id "$APP_USER" >/dev/null 2>&1 ||
  useradd --system --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin "$APP_USER"
install -d -m 0755 "$APP_DIR"
install -d -m 0750 -g "$APP_USER" "$(dirname "$ENV_FILE")"

if [ ! -f "$ENV_FILE" ]; then
  cat >"$ENV_FILE" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=$PORT
DATABASE_PATH=/var/lib/who-when-where/app.db
TRUST_PROXY=1
# Behind the Vercel rewrite every request reaches Caddy from a Vercel address, so
# rate limits would share one bucket. Once the site is served only through Vercel,
# uncomment to key limits on the visitor instead:
# CLIENT_IP_HEADER=x-vercel-forwarded-for
# Web Push (streak reminders, challenges, invitations): run
# "node scripts/vapid-keys.ts" in the API folder and paste its three lines here.
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
# VAPID_SUBJECT=mailto:you@example.com
# Plans: refuse what an account's plan lacks (402, practice allowance, party seats).
# Off until Pro launches; see shared/plans.ts and README.
# PRO_GATING=on
EOF
  chown root:"$APP_USER" "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
fi

echo "== systemd units"
HARDENING="NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=true
LockPersonality=true
CapabilityBoundingSet=
StateDirectory=who-when-where
StateDirectoryMode=0750
UMask=0027"

cat >/etc/systemd/system/who-when-where-api.service <<EOF
[Unit]
Description=Who When Where API
After=network.target

[Service]
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN src/server.ts
Restart=always
RestartSec=2
MemoryMax=1G
$HARDENING

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/who-when-where-backup.service <<EOF
[Unit]
Description=Who When Where database backup

[Service]
Type=oneshot
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN scripts/backup.ts
$HARDENING
EOF

cat >/etc/systemd/system/who-when-where-backup.timer <<EOF
[Unit]
Description=Nightly Who When Where database backup

[Timer]
OnCalendar=*-*-* 04:15:00
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --quiet who-when-where-api.service
systemctl try-restart who-when-where-api.service # pick up unit changes if it is running
systemctl enable --quiet --now who-when-where-backup.timer

echo "== firewall"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

echo "== Caddy (HTTPS)"
MARKER="# Managed by who-when-where api/deploy/setup.sh"
CADDYFILE=/etc/caddy/Caddyfile
if [ -f "$CADDYFILE" ] && ! grep -qF "$MARKER" "$CADDYFILE"; then
  echo "!! $CADDYFILE already exists and is not ours; leaving it alone." >&2
  echo "!! Add a site that does: reverse_proxy 127.0.0.1:$PORT" >&2
else
  install -d -m 0755 /etc/caddy
  {
    echo "$MARKER"
    if [ -n "$BIND" ]; then
      printf '{\n\tdefault_bind %s\n}\n\n' "$BIND"
    fi
    printf '%s {\n\tencode gzip\n\treverse_proxy 127.0.0.1:%s\n}\n\n' "$DOMAIN" "$PORT"
    # Spelled out because older Caddy releases open the automatic redirect on
    # only one of several bind addresses.
    printf 'http://%s {\n\tredir https://{host}{uri} permanent\n}\n' "$DOMAIN"
  } >"$CADDYFILE"

  if ! command -v caddy >/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    # Keep the Caddyfile written above instead of the package's sample.
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq -o Dpkg::Options::=--force-confold caddy
  fi

  # Come back by itself if an address is not ready when the server boots.
  install -d /etc/systemd/system/caddy.service.d
  printf '[Service]\nRestart=on-failure\nRestartSec=5\n' >/etc/systemd/system/caddy.service.d/restart.conf
  systemctl daemon-reload

  caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null
  systemctl enable --quiet caddy
  systemctl restart caddy
fi

echo "Done. Now ship the code: api/deploy/deploy.sh <host>"
