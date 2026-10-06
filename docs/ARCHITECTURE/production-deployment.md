# Zettaz Cloud – Production Deployment (Frontend: cloud.zettaz.com, Backend: api.zettaz.com)

Follow in order. Keep DB creds only in backend `.env`.

## Phase 0 — Prereqs
- [ ] DNS: `api.zettaz.com` → 185.75.21.46
- [ ] DNS: `cloud.zettaz.com` → shared hosting
- [ ] Access: SSH to VPS (sudo), SFTP to shared hosting
- [ ] TLS plan: Let’s Encrypt on VPS via certbot

## Phase 1 — Frontend env (sanitize)
- [x] Edit `frontend/.env` to only include:
  ```
  VITE_API_BASE_URL=https://api.zettaz.com/api
  VITE_API_URL=https://api.zettaz.com
  ```
- [x] Remove from frontend: `VITE_MYSQL_*`, `VITE_JWT_SECRET` (never ship secrets)

## Phase 2 — VPS base setup (Ubuntu)
- [ ] System update
  ```bash
  sudo apt update && sudo apt -y upgrade
  ```
- [ ] Install Node.js LTS and build tools
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt -y install nodejs build-essential
  ```
- [ ] Install pm2
  ```bash
  sudo npm i -g pm2
  ```
- [ ] Install Nginx + Certbot
  ```bash
  sudo apt -y install nginx certbot python3-certbot-nginx
  ```
- [ ] Enable firewall for web
  ```bash
  sudo ufw allow 'Nginx Full'; sudo ufw --force enable
  ```

## Phase 3 — Backend deploy
- [ ] Upload backend source to `/var/www/zettaz-backend/`
- [ ] Create backend `.env` at `/var/www/zettaz-backend/.env`:
  ```ini
  PORT=3001
  NODE_ENV=production
  DB_HOST=mysql.us.cloudlogin.co
  DB_USER=digitpulse_zcloud
  DB_PASSWORD=MyAntigua!2025
  DB_NAME=digitpulse_zcloud
  JWT_SECRET=change-me
  CORS_ORIGIN_LIST=https://cloud.zettaz.com,https://api.zettaz.com
  ```
- [ ] Install dependencies (and build if applicable)
  ```bash
  cd /var/www/zettaz-backend
  npm ci
  # npm run build
  ```

## Phase 4 — Run backend with pm2
- [ ] Start API
  ```bash
  pm2 start npm --name zettaz-api -- run start
  ```
- [ ] Persist and enable on boot
  ```bash
  pm2 save && pm2 startup
  ```
- [ ] Verify
  ```bash
  pm2 status; pm2 logs zettaz-api --lines 100
  ss -tulpn | grep 3001
  ```

## Phase 5 — Nginx for api.zettaz.com
- [ ] Create `/etc/nginx/sites-available/api.zettaz.com`:
  ```nginx
  server {
    listen 80; server_name api.zettaz.com;
    client_max_body_size 10M;
    location / {
      proxy_pass http://127.0.0.1:3001;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
  ```
- [ ] Enable site and reload Nginx
  ```bash
  sudo ln -s /etc/nginx/sites-available/api.zettaz.com /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  ```
- [ ] Issue TLS with certbot
  ```bash
  sudo certbot --nginx -d api.zettaz.com --redirect -m you@zettaz.com --agree-tos
  ```

## Phase 6 — Frontend build & upload
- [ ] Build SPA
  ```bash
  cd frontend
  npm ci && npm run build
  ```
- [ ] Upload `frontend/dist/` to cloud.zettaz.com web root
- [ ] Add `.htaccess` for SPA fallback
  ```
  Options -MultiViews
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [QSA,L]
  ```

## Phase 7 — Wire and test
- [ ] Confirm `frontend/.env` points to `https://api.zettaz.com`
- [ ] Test app flows on https://cloud.zettaz.com
- [ ] API health check (example)
  ```bash
  curl -I https://api.zettaz.com/api/health
  ```

## Phase 8 — Monitoring & rollback
- [ ] Backend monitoring: `pm2 logs zettaz-api`, `pm2 monit`
- [ ] Nginx logs: `sudo journalctl -u nginx -f`
- [ ] Frontend rollback: keep previous `dist` backup
- [ ] Backend rollback: previous tag + `pm2 restart zettaz-api --update-env`
