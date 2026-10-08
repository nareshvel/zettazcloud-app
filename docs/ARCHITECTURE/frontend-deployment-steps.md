> **SUPERSEDED (2026-10):** This document describes the pre-migration production layout — backend at `/var/www/app-zettaz-cloud/repo`, remote MySQL `mysql.us.cloudlogin.co` (some docs also show the old shared-hosting frontend and port 3001). Current layout: everything on the VPS at `/var/www/zettazcloud-app` with MySQL `zettazcloud_prod @ localhost:3306`; deploy via `bash /var/www/zettazcloud-app/deploy.sh` or `deploy-quick.sh` (see `AGENTS.md` at the repo root). Kept for historical reference only.
>

# Frontend Deployment Steps for cloud.zettaz.com

## Issue Fixed
- **Problem**: Frontend was calling `https://api.zettaz.com:3001` causing SSL protocol error
- **Solution**: Updated `.env.production` to use `https://api.zettaz.com` (without port)
- **Status**: Frontend rebuilt with correct configuration ✅

## Deployment Instructions

### 1. Files Ready for Upload
Location: `/Users/nareshvelusamy/Herd/app-zettaz-cloud/frontend/dist/`

All files in this folder need to be uploaded to your shared hosting.

### 2. Upload via SFTP/FTP
**Upload ALL contents of `frontend/dist/` to your web root:**
- Connect to your shared hosting via SFTP/FTP
- Navigate to the web root for `cloud.zettaz.com` (usually `public_html` or `www`)
- Upload all files from `frontend/dist/` folder
- **Important**: Include the `.htaccess` file (it's hidden, make sure your FTP client shows hidden files)

### 3. Required Files
Make sure these are uploaded:
- ✅ `index.html`
- ✅ `.htaccess` (for SPA routing)
- ✅ `assets/` folder (all JS, CSS, and other assets)
- ✅ Any other files in the dist folder

### 4. Verify Deployment
After upload, test:
1. Visit `https://cloud.zettaz.com`
2. Try to login with test credentials
3. Check browser console - should NOT see `:3001` in API URLs
4. API calls should go to `https://api.zettaz.com/api/auth/login` (without port)

### 5. Backend Verification
Make sure your backend is accessible at `https://api.zettaz.com`:
```bash
curl -I https://api.zettaz.com/api/health
```

Expected: Should return 200 OK (or 404 if health endpoint doesn't exist, but should connect)

## Troubleshooting

### If you still see SSL errors:
1. Clear browser cache completely
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check that `.htaccess` was uploaded
4. Verify backend is running and accessible via `https://api.zettaz.com`

### If backend is not accessible:
Check that:
1. Nginx is configured for `api.zettaz.com`
2. SSL certificate is installed (Let's Encrypt)
3. Backend is running on port 3001
4. Nginx is proxying to `http://127.0.0.1:3001`

## Backend Deployment Location
According to docs, backend should be at:
- VPS Path: `/var/www/app-zettaz-cloud/repo/backend`
- Running via PM2 as process name: `api`
- Accessible via: `https://api.zettaz.com`

## Quick Commands for Backend Check (SSH to VPS)
```bash
# Check if backend is running
pm2 status

# Check if port 3001 is listening
sudo lsof -i :3001

# Check Nginx configuration
sudo nginx -t

# View backend logs
pm2 logs api --lines 50

# Restart backend if needed
pm2 restart api
```
