#!/usr/bin/env bash
#
# provision-ubuntu.sh — one-shot provisioning for an invoice-saas production host.
#
# Target: a fresh Ubuntu Server LTS 22.04/24.04 with a public IP, SSH access as root,
# and a domain whose A record already points at this host's IP (ports 80/443 open).
#
# What it does:
#   1. installs Docker Engine + compose plugin and nginx + certbot,
#   2. clones the app repo (the C1–C6 code must already be on the chosen branch),
#   3. generates a secrets .env (ADMIN_API_TOKEN + Postgres creds),
#   4. installs the nginx reverse-proxy site and issues a Let's Encrypt cert (TLS),
#   5. brings the Docker stack up and pushes the Prisma schema to Postgres.
#
# It is idempotent where it matters: re-running it will skip already-installed pieces,
# re-use an existing cert, and re-pull the latest code. It is NOT a zero-downtime
# updater — for routine updates use the "Updates" section of DEPLOY.md instead.
#
# Usage:
#   export DOMAIN=invoicing.example.com ADMIN_EMAIL=you@example.com
#   bash provision-ubuntu.sh
# (run from the repo root, or pipe it: bash <(curl -fsSL <raw-url>))

set -euo pipefail

# ---------------------------------------------------------------------------
# Config (override any of these by exporting the env var before running)
# ---------------------------------------------------------------------------
DOMAIN="${DOMAIN:?Set DOMAIN, e.g. export DOMAIN=invoicing.example.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:?Set ADMIN_EMAIL, e.g. export ADMIN_EMAIL=you@example.com}"
REPO_URL="${REPO_URL:-https://github.com/pgiabao0909-oss/invoice-saas.git}"
BRANCH="${BRANCH:-master}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/invoice-saas}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-invoicesaas}"
COMPOSE_FILE="docker-compose.prod.yml"

log()  { printf '\033[1;32m[provision]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[provision]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[provision] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Preflight
# ---------------------------------------------------------------------------
log "Preflight checks"
[ "$(id -u)" -eq 0 ] || die "This script must run as root (use: sudo -i, then run it)."

if ! grep -q 'Ubuntu' /etc/os-release 2>/dev/null; then
    warn "Not detecting Ubuntu in /etc/os-release; continuing anyway, but this script targets Ubuntu LTS."
fi

command -v git >/dev/null 2>&1 || die "git is required (apt-get install -y git)."
command -v curl >/dev/null 2>&1 || die "curl is required (apt-get install -y curl)."
command -v openssl >/dev/null 2>&1 || die "openssl is required (apt-get install -y openssl)."

# Best-effort: confirm the domain resolves to this host before asking certbot to issue.
if command -v dig >/dev/null 2>&1; then
    RESOLVED="$(dig +short "$DOMAIN" A | tail -n1 || true)"
    if [ -n "$RESOLVED" ]; then
        log "DNS: $DOMAIN -> $RESOLVED (make sure this is this server's public IP)."
    else
        warn "$DOMAIN does not resolve to an A record. Point its DNS A record at this server, then re-run."
    fi
else
    log "dig not installed; skipping DNS resolution check (ensure $DOMAIN's A record points here)."
fi

# ---------------------------------------------------------------------------
# 2. Install Docker Engine + compose plugin
# ---------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1; then
    log "Docker already installed ($(docker --version)); skipping install."
else
    log "Installing Docker Engine"
    curl -fsSL https://get.docker.com | sh
fi

# Ensure the compose plugin is present.
if docker compose version >/dev/null 2>&1; then
    log "Docker Compose plugin present ($(docker compose version | head -n1))."
else
    log "Installing docker-compose-plugin"
    apt-get update -y
    apt-get install -y docker-compose-plugin
fi

systemctl enable --now docker.service
docker info >/dev/null 2>&1 || die "Docker daemon is not running."

# ---------------------------------------------------------------------------
# 3. Install nginx + certbot
# ---------------------------------------------------------------------------
if command -v nginx >/dev/null 2>&1; then
    log "nginx already installed; skipping."
else
    log "Installing nginx + certbot"
    apt-get update -y
    apt-get install -y nginx certbot python3-certbot-nginx
fi
systemctl enable --now nginx.service

# ---------------------------------------------------------------------------
# 4. Clone / update the repo
# ---------------------------------------------------------------------------
if [ -d "$DEPLOY_DIR/.git" ]; then
    log "Repo already at $DEPLOY_DIR; pulling latest $BRANCH"
    git -C "$DEPLOY_DIR" fetch --all --quiet
    git -C "$DEPLOY_DIR" checkout "$BRANCH"
    git -C "$DEPLOY_DIR" pull --ff-only
else
    log "Cloning $REPO_URL @ $BRANCH into $DEPLOY_DIR"
    mkdir -p "$(dirname "$DEPLOY_DIR")"
    git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$DEPLOY_DIR"
fi
cd "$DEPLOY_DIR"

[ -f "$COMPOSE_FILE" ] || die "Expected $COMPOSE_FILE in the repo. Is the right branch checked out?"
[ -f deploy/nginx/invoice-saas.conf ] || die "Expected deploy/nginx/invoice-saas.conf. Is the right branch checked out?"

# ---------------------------------------------------------------------------
# 5. Generate .env (only if missing)
# ---------------------------------------------------------------------------
if [ -f .env ]; then
    log ".env already exists; leaving it untouched."
else
    log "Generating .env with fresh secrets"
    PG_PASSWORD="$(openssl rand -hex 24)"
    ADMIN_TOKEN="$(openssl rand -hex 32)"
    cat > .env <<EOF
# Auto-generated by scripts/provision-ubuntu.sh — edit as needed, then:
#   docker compose -f $COMPOSE_FILE restart api worker
# (Changes to Stripe/Resend/ALERT_EMAIL require a container restart to take effect.)

# Database (consumed by docker-compose.prod.yml to build DATABASE_URL; the api/worker
# containers override DATABASE_URL to point at the 'postgres' service).
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$PG_PASSWORD
POSTGRES_DB=$DB_NAME

# Admin API token — REQUIRED. Send as: Authorization: Bearer <token>
ADMIN_API_TOKEN=$ADMIN_TOKEN

# --- Optional: leave blank to run with safe fakes (no Stripe/email) ---
# Stripe (real payment links + webhook). Both must be set together.
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend (real invoice + reminder emails).
RESEND_API_KEY=
RESEND_FROM=invoices@$DOMAIN

# C5 failure-alerting email (worker emails this on sweep failures/holds).
ALERT_EMAIL=
EOF
    log ".env written. ADMIN_API_TOKEN and POSTGRES_PASSWORD were randomly generated."
fi

# ---------------------------------------------------------------------------
# 6. Install the nginx site and reload
# ---------------------------------------------------------------------------
NGINX_AVAILABLE="/etc/nginx/sites-available/invoice-saas.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/invoice-saas.conf"

if [ -f "$NGINX_AVAILABLE" ]; then
    log "nginx site already installed; re-substituting domain and reloading."
else
    log "Installing nginx site config for $DOMAIN"
fi
mkdir -p /var/www/letsencrypt
sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" deploy/nginx/invoice-saas.conf > "$NGINX_AVAILABLE"

# Disable the default site so it doesn't capture :80.
if [ -e /etc/nginx/sites-enabled/default ]; then
    rm -f /etc/nginx/sites-enabled/default
    log "Removed default nginx site."
fi

ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
nginx -t || die "nginx config test failed; not reloading."
systemctl reload nginx.service
log "nginx serving $DOMAIN on :80 (HTTP)."

# ---------------------------------------------------------------------------
# 7. Issue the Let's Encrypt certificate (certbot rewrites the config to TLS)
# ---------------------------------------------------------------------------
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log "Certificate for $DOMAIN already exists; ensuring renewal timer is enabled."
    systemctl enable --now certbot.timer 2>/dev/null || true
else
    log "Requesting Let's Encrypt certificate for $DOMAIN"
    certbot --nginx \
        -d "$DOMAIN" \
        --non-interactive \
        --agree-tos \
        -m "$ADMIN_EMAIL" \
        --redirect \
        --no-eff-email \
        || die "certbot failed. Check that $DOMAIN's A record points here and port 80 is open."
    systemctl enable --now certbot.timer 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# 8. Bring the stack up
# ---------------------------------------------------------------------------
log "Building and starting the Docker stack (postgres, api, worker, web)"
docker compose -f "$COMPOSE_FILE" up -d --build

# Wait for postgres to be healthy before pushing the schema.
log "Waiting for postgres to become healthy..."
for i in $(seq 1 30); do
    if [ "$(docker compose -f "$COMPOSE_FILE" ps -q postgres 2>/dev/null)" != "" ] \
       && docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; then
        log "postgres is healthy."
        break
    fi
    if [ "$i" -eq 30 ]; then
        die "postgres did not become healthy in time. Check: docker compose -f $COMPOSE_FILE logs postgres"
    fi
    sleep 2
done

# ---------------------------------------------------------------------------
# 9. Push the Prisma schema (inside the api container so it reaches 'postgres')
# ---------------------------------------------------------------------------
log "Generating Prisma client + pushing schema"
docker compose -f "$COMPOSE_FILE" run --rm api npm run prisma:generate
docker compose -f "$COMPOSE_FILE" run --rm api npx prisma db push \
    --schema packages/db/prisma/schema.prisma --accept-data-loss

# ---------------------------------------------------------------------------
# 10. Done
# ---------------------------------------------------------------------------
cat <<EOF

============================================================================
 invoice-saas provisioned at https://$DOMAIN
============================================================================
Stack:   docker compose -f $COMPOSE_FILE ps
API:     https://$DOMAIN/api/health
App:     https://$DOMAIN/   (isolation guard UI: https://$DOMAIN/isolation)

Next steps:
  - (Optional) Edit $DEPLOY_DIR/.env to add Stripe keys, RESEND_API_KEY, and
    ALERT_EMAIL, then:  docker compose -f $COMPOSE_FILE restart api worker
  - The app runs end-to-end with fakes if those are left blank.
  - TLS auto-renews via the certbot systemd timer.

See DEPLOY.md for updates, verification, and troubleshooting.
============================================================================
EOF
