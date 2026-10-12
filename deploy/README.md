# Dynamic deploy (droplet)

FullHearts runs as a Node process: `/server` sign-in, registration, billing
and `/admin` need a server and SQLite. This is the one-time setup on the
droplet (pull-based, systemd-managed, like the minecraft server).

## Requirements

- Node **22.5+** with `node:sqlite` available (unflagged from Node 24 on).
  Check first: `node -v`.
- If this droplet runs anything else on Node (check before assuming it
  doesn't), do **not** replace the system-wide Node to satisfy this
  requirement. Install Node 24 scoped to this user via `nvm` instead, so
  every other service's Node install is untouched:
  ```
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install 24
  node -e "require('node:sqlite'); console.log('node:sqlite OK')"
  ```
  `deploy/fullhearts.service` and `deploy/redeploy.sh` are already written to
  use this nvm-managed Node (via `deploy/run-node24.sh`) rather than
  `/usr/bin/node`. Nothing else to configure for that part.

## One-time setup

1. **Persistent SQLite directory**, owned by the service user, outside the
   repo so a redeploy never touches it:
   ```
   sudo mkdir -p /var/lib/fullhearts
   sudo chown whaletale:whaletale /var/lib/fullhearts
   ```

2. **Secrets file**, root-only, never committed:
   ```
   sudo install -m 600 -o root -g root /dev/null /etc/fullhearts.env
   sudo tee /etc/fullhearts.env <<'EOF'
   ADMIN_PASSWORD_HASH=<from: node scripts/hash-admin-password.mjs "yourpassword">
   ADMIN_SESSION_SECRET=<from: openssl rand -hex 32>
   NEXT_PUBLIC_SITE_URL=https://fullhearts.app
   LOGIN_CODE_PEPPER=<from: openssl rand -hex 32>
   PAY_LINK_SECRET=<from: openssl rand -hex 32>
   RESEND_API_KEY=
   MAIL_FROM=EduCraft <hello@send.fullhearts.app>
   MAIL_REPLY_TO=
   EDUCRAFT_CONTACT_EMAIL=
   ADMIN_ALERT_EMAILS=
   BILLING_ENABLED=0
   STRIPE_SECRET_KEY=
   STRIPE_PRICE_ID=
   STRIPE_WEBHOOK_SECRET=
   EOF
   ```
   `.env.example` says what each one is for. Changing `LOGIN_CODE_PEPPER`
   only cancels codes already sent; changing `PAY_LINK_SECRET` breaks pay
   links already emailed (admins can resend).

3. **systemd service**:
   ```
   sudo cp deploy/fullhearts.service /etc/systemd/system/fullhearts.service
   sudo systemctl daemon-reload
   sudo systemctl enable fullhearts
   ```

4. **nginx**: open the existing server block for fullhearts.app (the one
   with your TLS cert config already in it) and replace the static `root` /
   `try_files` directive with the contents of `nginx-fullhearts.conf`, then:
   ```
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Passwordless restart for the deploy script** (or run `redeploy.sh` as
   root instead):
   ```
   echo "whaletale ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart fullhearts" | sudo tee /etc/sudoers.d/fullhearts-deploy
   ```

6. **Nightly database backup**, as `whaletale`:
   ```
   (crontab -l 2>/dev/null; echo "15 3 * * * /home/whaletale/fullhearts-app/deploy/backup-db.sh") | crontab -
   ```
   It keeps 14 copies in `/var/lib/fullhearts/backups/`, on the same disk.
   Copy them off the droplet too. Every migration also saves a
   `pre-migrate-*.db` copy there before it changes anything.

7. First deploy:
   ```
   bash deploy/redeploy.sh
   ```

## Every deploy after that

```
bash deploy/redeploy.sh
```

Clones once, then `git reset --hard` on top for every run after (pull-based,
same idea as the old rsync command, just against a live process instead of
static files). It builds first and only restarts the service if the build
succeeds, then confirms the process actually answers on port 3001 before
declaring success. A build that succeeds but a broken service won't be
silently reported as a working deploy.

## Notes

- `next start` serves everything from `$REPO_DIR/.next`. Nothing is rsynced.
- Database migrations run on the first request after a deploy, each in its
  own transaction, after copying the database to `backups/pre-migrate-*.db`.
  To undo a bad one: stop the service, copy that file back over
  `fullhearts.db`, deploy the previous commit.
- The SQLite file at `/var/lib/fullhearts/fullhearts.db` is the one and only
  copy of every registration. Back it up like you would any real database.
  It is not disposable the way a static build output is.
