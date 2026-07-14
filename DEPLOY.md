# Deploying invoice-saas to Production

This runbook deploys invoice-saas to a single **Ubuntu Server LTS 22.04/24.04** host
using **Docker Compose**, fronted by **nginx + Let's Encrypt** for HTTPS on a real
domain. It is the customer-facing companion to `scripts/provision-ubuntu.sh` and the
`deploy/nginx/` config.

## Architecture

```
                 :443 (HTTPS, TLS by Let's Encrypt)
   Browser  ───────────────────────────────────┐
                                                 ▼
        Ubuntu host:  nginx  (deploy/nginx/invoice-saas.conf)
                          │  /api/*  ───────► 127.0.0.1:3001  (api container)
                          │  /*      ───────► 127.0.0.1:3000  (web container)
                                                 │
        Docker Compose (docker-compose.prod.yml) │
                          ├── web    (Next.js)        API_BASE=http://api:3001
                          ├── api    (Fastify :3001)   DATABASE_URL→postgres
                          ├── worker (schedulers)      DATABASE_URL→postgres
                          └── postgres:16  (volume: pgdata)
```

nginx terminates TLS and proxies. The API routes live at the root (no `/api` prefix);
nginx strips `/api` before forwarding, matching the web app's own same-origin rewrite.

---

## 0. Prerequisites

- An **Ubuntu Server LTS 22.04 or 24.04** instance with a public IPv4 and SSH access
  **as root**.
- A **registered domain** (e.g. `invoicing.example.com`) whose **A record points at the
  server's public IP**. Let's Encrypt will not issue a cert until this resolves and port
  **80** is reachable.
- Firewall allows inbound **22** (SSH), **80**, and **443**.
- The application code must be on the branch the server will clone. The C1–C6 hardening
  currently lives on the local `worktree-invoice-ui-build` branch only — see step "Ship
  the code to GitHub" below before deploying.

> **Stripe / Resend are optional.** Left unset, the app runs end-to-end with safe fakes
> (fake payment links, console-only email, console-only alerts). Fill them in after the
> first successful deploy.

---

## 1. Ship the code to GitHub (do this once)

The deploy source of truth is `https://github.com/pgiabao0909-oss/invoice-saas.git`. The
current code is local-only on `worktree-invoice-ui-build`. Push it and merge to `master`
(if you deploy `master`, the default):

```bash
# from the worktree: C:\Users\BAO\claude-project\.claude\worktrees\invoice-ui-build
git push -u origin worktree-invoice-ui-build
# Then open a PR (gh pr create --draft) and merge to master, or merge directly.
```

The server clones whichever branch you set with `BRANCH` in the provision script
(default `master`).

---

## 2. Deploy (automated)

SSH into the server as root, then run the one-shot provision script. It installs
Docker + nginx + certbot, clones the repo, generates secrets, issues the TLS cert, and
brings the stack up.

```bash
ssh root@<your-server-ip>

export DOMAIN=invoicing.example.com
export ADMIN_EMAIL=you@example.com      # cert expiry notices + Let's Encrypt account

bash <(curl -fsSL https://raw.githubusercontent.com/pgiabao0909-oss/invoice-saas/master/scripts/provision-ubuntu.sh)
```

The script is **idempotent**: re-running skips what's already installed and reuses an
existing certificate. Required env vars (`DOMAIN`, `ADMIN_EMAIL`) are checked up front.

At the end it prints the URL, where to add Stripe/Resend, and how to verify.

---

## 3. Deploy (manual, step-by-step)

Use this if you prefer not to pipe a remote script, or to understand each stage.

```bash
# 1. Install Docker + compose plugin
curl -fsSL https://get.docker.com | sh
apt-get update && apt-get install -y docker-compose-plugin
systemctl enable --now docker.service

# 2. Install nginx + certbot
apt-get update && apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx.service

# 3. Clone the app
git clone --branch master --single-branch \
    https://github.com/pgiabao0909-oss/invoice-saas.git /opt/invoice-saas
cd /opt/invoice-saas

# 4. Create .env with fresh secrets
ADMIN_TOKEN=$(openssl rand -hex 32)
PG_PASSWORD=$(openssl rand -hex 24)
cat > .env <<EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$PG_PASSWORD
POSTGRES_DB=invoicesaas
ADMIN_API_TOKEN=$ADMIN_TOKEN
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM=invoices@invoicing.example.com
ALERT_EMAIL=
EOF

# 5. Install the nginx site (substitute your domain)
mkdir -p /var/www/letsencrypt
sed 's/DOMAIN_PLACEHOLDER/invoicing.example.com/g' \
    deploy/nginx/invoice-saas.conf > /etc/nginx/sites-available/invoice-saas.conf
rm -f /etc/nginx/sites-enabled/default
ln -s /etc/nginx/sites-available/invoice-saas.conf /etc/nginx/sites-enabled/invoice-saas.conf
nginx -t && systemctl reload nginx.service

# 6. Issue the TLS certificate (certbot rewrites the nginx config to add :443 + redirect)
certbot --nginx -d invoicing.example.com --non-interactive --agree-tos \
    -m you@example.com --redirect --no-eff-email
systemctl enable --now certbot.timer

# 7. Bring the stack up and push the schema
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm api npm run prisma:generate
docker compose -f docker-compose.prod.yml run --rm api \
    npx prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss
```

> **Prisma gotcha:** the correct push command is
> `npx prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss`.
> The older `npx prisma db push -w @invoice-saas/db` form does **not** work — do not use it.

---

## 4. Post-deploy configuration (optional)

Edit `/opt/invoice-saas/.env` to enable real payments/email, then restart the affected
services:

```bash
nano /opt/invoice-saas/.env
# set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, ALERT_EMAIL
cd /opt/invoice-saas
docker compose -f docker-compose.prod.yml restart api worker
```

- **Stripe** (T3): set both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` together.
  Then point your Stripe webhook at `https://<domain>/webhooks/stripe`.
- **Resend** (T2/T4): set `RESEND_API_KEY`; `RESEND_FROM` defaults to
  `invoices@<domain>` if unset.
- **Alerting** (C5): set `ALERT_EMAIL` to receive worker failure/hold alerts.

Without these, the app still runs fully (fake payment links, console email/alerts).

---

## 5. Verification

```bash
cd /opt/invoice-saas
docker compose -f docker-compose.prod.yml ps          # all 4 services "Up"
docker compose -f docker-compose.prod.yml logs -f api # watch API boot on :3001
curl -fsS https://<domain>/api/health                  # 200 from the API via nginx
```

In a browser:
- Open `https://<domain>/` — the web app.
- Open `https://<domain>/isolation` — the C6 tenant-isolation status page.
- Confirm the browser shows a valid **HTTPS** certificate (Let's Encrypt).

---

## 6. Updates (routine)

The provision script is for first install. To ship new code:

```bash
cd /opt/invoice-saas
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm api \
    npx prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss
```

If you only changed `.env`, a restart suffices:
`docker compose -f docker-compose.prod.yml restart api worker`.

---

## 7. TLS renewal

Let's Encrypt certs last 90 days and **renew automatically** via the certbot systemd
timer (enabled by the script). To confirm and test:

```bash
systemctl status certbot.timer
sudo certbot renew --dry-run     # simulate a renewal
```

On renewal, certbot reloads nginx automatically (the `--nginx` plugin registers the
reload hook). No manual action required.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `certbot ... failed` | DNS A record not pointed at this host, or port 80 blocked | Point the domain's A record at the server IP; open 80/443; re-run the script. |
| `502 Bad Gateway` at the domain | Containers not up, or nginx upstream wrong | `docker compose -f docker-compose.prod.yml ps`; check `logs`; confirm `127.0.0.1:3000/3001` are bound (compose publishes to `127.0.0.1` only). |
| API returns 404 for `/api/...` | `/api` prefix not stripped | The nginx `/api/` location uses `proxy_pass http://127.0.0.1:3001/;` (trailing slash) — verify it's intact and reload nginx. |
| `prisma db push` fails | `postgres` not healthy, or wrong `POSTGRES_*` in `.env` | `docker compose -f docker-compose.prod.yml logs postgres`; ensure `.env` `POSTGRES_USER/PASSWORD/DB` match the container env. |
| `401` on admin routes | `ADMIN_API_TOKEN` unset/wrong | Set `ADMIN_API_TOKEN` in `.env`; restart `api`. Send `Authorization: Bearer <token>`. |

---

## 9. Files reference

- `deploy/nginx/invoice-saas.conf` — nginx reverse-proxy (HTTP; certbot adds TLS).
- `scripts/provision-ubuntu.sh` — one-shot provisioning (this runbook, automated).
- `docker-compose.prod.yml` — the container stack (postgres + api + worker + web).
- `Dockerfile` — single production image building all workspaces.
- `RUN.md` / `CONTEXT.md` — local-dev and architecture notes.
