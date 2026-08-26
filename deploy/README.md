# Dynamic deploy (droplet)

Static export (the default `npm run build`) can't serve `/register` or
`/admin` (no server, no SQLite). This is the one-time setup for running
FullHearts as a real Node process instead, matching how the minecraft
server's droplet stays up to date (pull-based, systemd-managed).

## Requirements

- Node **22.5+** with `node:sqlite` available. It's unflagged (no
  `--experimental-sqlite` needed) from Node 24 on. Check first:
  ```
  node -v
  node -e "require('node:sqlite')"
  ```
  If that throws `ERR_UNKNOWN_BUILTIN_MODULE`, upgrade Node before anything
  else here, since nothing below will work otherwise.

## One-time setup

1. **Persistent SQLite directory**, owned by the service user, outside the
   repo so a redeploy never touches it:
   ```
   sudo mkdir -p /var/lib/fullhearts
   sudo chown wali:wali /var/lib/fullhearts
   ```

2. **Secrets file**, root-only, never committed:
   ```
   sudo install -m 600 -o root -g root /dev/null /etc/fullhearts.env
   sudo tee /etc/fullhearts.env <<'EOF'
   ADMIN_PASSWORD_HASH=<from: node scripts/hash-admin-password.mjs "yourpassword">
   ADMIN_SESSION_SECRET=<from: openssl rand -hex 32>
   NEXT_PUBLIC_SITE_URL=https://fullhearts.app
   TELNYX_API_KEY=
   TELNYX_FROM_NUMBER=
   EOF
   ```

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
   echo "wali ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart fullhearts" | sudo tee /etc/sudoers.d/fullhearts-deploy
   ```

6. First deploy:
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
succeeds, then confirms the process actually answers on port 3000 before
declaring success. A build that succeeds but a broken service won't be
silently reported as a working deploy.

## What's different from the static setup

- No `out/` directory, nothing gets rsynced. `next start` serves everything
  directly from `$REPO_DIR/.next`.
- `/register` and `/admin` work now. They did not exist as functioning routes
  under static export regardless of what the build did.
- The SQLite file at `/var/lib/fullhearts/fullhearts.db` is the one and only
  copy of every registration. Back it up like you would any real database.
  It is not disposable the way a static build output is.
