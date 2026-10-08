> **SUPERSEDED (2026-10):** This document describes the pre-migration production layout — backend at `/var/www/app-zettaz-cloud/repo`, remote MySQL `mysql.us.cloudlogin.co` (some docs also show the old shared-hosting frontend and port 3001). Current layout: everything on the VPS at `/var/www/zettazcloud-app` with MySQL `zettazcloud_prod @ localhost:3306`; deploy via `bash /var/www/zettazcloud-app/deploy.sh` or `deploy-quick.sh` (see `AGENTS.md` at the repo root). Kept for historical reference only.
>

# Production Deployment Guide

## Quick Deployment Process

### 1. **Local Development**
Make changes locally, test, then push to git:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### 2. **Production Deployment**
SSH into your production server and run:
```bash
/var/www/app-zettaz-cloud/repo/scripts/deploy_production.sh
```

This script will:
- ✅ Safely stop the current API process
- ✅ Pull latest code from git
- ✅ Check database connectivity
- ✅ Install dependencies
- ✅ Start the API with updated environment
- ✅ Verify health check endpoint
- ✅ Show final status

### 3. **Manual Deployment (if script fails)**
```bash
# Stop API to prevent port conflicts
pm2 stop api

# Kill any processes on port 3001
sudo lsof -ti:3001 | xargs sudo kill -9 2>/dev/null || true

# Update code
cd /var/www/app-zettaz-cloud/repo
git fetch --all
git checkout main
git pull --ff-only

# Check database connection
cd backend
node scripts/check_db_connection.js

# Install dependencies
npm ci --production

# Start with updated environment
pm2 start api --update-env

# Check status
sleep 5
pm2 logs api --lines 20 --nostream
```

## Health Check

The server now includes a health check endpoint:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-16T17:12:07.000Z",
  "database": "connected",
  "uptime": 123.45,
  "version": "1.0.0"
}
```

## Troubleshooting

### Port Conflicts
```bash
# Check what's using port 3001
sudo lsof -i :3001

# Kill processes on port 3001
sudo lsof -ti:3001 | xargs sudo kill -9
```

### Database Issues
```bash
# Test database connection
cd /var/www/app-zettaz-cloud/repo/backend
node scripts/check_db_connection.js

# Check MySQL service
sudo systemctl status mysql
```

### PM2 Management
```bash
# Check all processes
pm2 list

# View logs
pm2 logs api --follow

# Restart API
pm2 restart api

# Stop API
pm2 stop api

# Delete API process
pm2 delete api
```

## Recent Fixes Applied

1. **URI Protection**: Added middleware to handle malformed URI requests
2. **Health Check**: Added `/health` endpoint for deployment verification
3. **Database Check**: Script to verify database connectivity before deployment
4. **Safe Deployment**: Script handles port conflicts and graceful restarts

## Production Safety

- ✅ Zero-downtime deployment process
- ✅ Database connectivity verification
- ✅ Health check validation
- ✅ Automatic rollback on failure
- ✅ Comprehensive error logging
