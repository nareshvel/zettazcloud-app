# Infrastructure Analysis - Current Deployment Architecture

## Current Infrastructure Setup

### **Server Architecture**
1. **VPS Server (185.75.21.46)** - BACKEND ONLY
   - Backend Node.js application (port 3001 internal)
   - Nginx reverse proxy for API
   - SSL: Let's Encrypt certificates managed by Nginx
   - Process Manager: PM2 for backend
   - Domain: `api.zettaz.com`

2. **Shared Hosting Server (separate)** - FRONTEND & DATABASE
   - Frontend static files (React build)
   - MySQL Database: `mysql.us.cloudlogin.co`
   - Database: `digitpulse_zcloud`
   - Domain: `cloud.zettaz.com`
   - Web server: Apache (based on curl response)

3. **Domain Registrar Server (third server)**
   - Only DNS management
   - Domain: `zettaz.com` registered here
   - Points subdomains to respective servers

### **DNS Configuration**
- `api.zettaz.com` → 185.75.21.46 (VPS - Backend)
- `cloud.zettaz.com` → Shared Hosting IP (Frontend)
- Database host: `mysql.us.cloudlogin.co` (Shared Hosting - MySQL)

### **SSL/HTTPS Setup**
- **Nginx on VPS (api.zettaz.com)**: Handles SSL termination for API only
  - `api.zettaz.com:443` → proxies to `http://localhost:3001` (backend API)
  - Let's Encrypt certificates at `/etc/letsencrypt/live/api.zettaz.com/`

- **Backend on VPS**: Runs HTTP only
  - Port 3001 (internal, not exposed to internet)
  - Nginx handles all SSL/TLS termination
  - Backend should NOT try to run HTTPS

- **Shared Hosting (cloud.zettaz.com)**: Handles SSL for frontend
  - Apache web server serves frontend static files
  - SSL managed by shared hosting provider
  - Frontend files deployed via FTP/SFTP

## What Was Working (Commit a006d29 - "lets encrypt creation")

### **Backend Configuration (WORKING)**
```
# Backend ran HTTP on port 3001
# Nginx proxied HTTPS → HTTP
```

### **Frontend Configuration (WORKING)**
```env
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
```

### **Request Flow (WORKING)**
```
Browser (cloud.zettaz.com)
    ↓ HTTPS
    → api.zettaz.com:443 (Nginx with SSL)
        ↓ HTTP (internal)
        → localhost:3001 (Backend Node.js)
            ↓
            → mysql.us.cloudlogin.co (Database)
```

## What Went Wrong (Commit 3b0764b - "signup process fix1")

### **Frontend Configuration (BROKEN)**
```env
VITE_API_URL=https://api.zettaz.com:3001  ❌ WRONG
VITE_API_BASE_URL=https://api.zettaz.com:3001  ❌ WRONG
```

### **Problem**
- Frontend tried to connect to `https://api.zettaz.com:3001`
- Port 3001 is NOT exposed for HTTPS (only Nginx on port 443)
- Backend was also trying to run HTTPS on port 3001 (conflict with Nginx proxy setup)
- Result: `net::ERR_SSL_PROTOCOL_ERROR`

## Root Cause Analysis

### **Issue 1: Backend SSL Configuration**
The backend code automatically detects Let's Encrypt certificates and tries to run HTTPS:
```javascript
// Backend server.js
if (fsSync.existsSync(sslKeyPath) && fsSync.existsSync(sslCertPath)) {
  // Backend tries to run HTTPS on port 3001
  useHttps = true;
}
```

**Problem**: This conflicts with the Nginx proxy architecture where:
- Nginx should handle SSL on port 443
- Backend should only run HTTP on port 3001

### **Issue 2: Frontend Environment Variables**
Someone added `:3001` to the production URLs, breaking the proxy setup:
```env
# WRONG - tries to bypass Nginx and connect directly to backend
VITE_API_URL=https://api.zettaz.com:3001

# CORRECT - goes through Nginx proxy
VITE_API_URL=https://api.zettaz.com
```

## Correct Architecture

### **Backend Should Run**
- HTTP only on port 3001 (internal)
- No SSL certificates in backend
- Let Nginx handle all SSL

### **Nginx Configuration**
```nginx
server {
    listen 443 ssl http2;
    server_name api.zettaz.com;
    
    # SSL handled by Nginx
    ssl_certificate /etc/letsencrypt/live/api.zettaz.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.zettaz.com/privkey.pem;
    
    # Proxy to HTTP backend
    location / {
        proxy_pass http://localhost:3001;  # HTTP, not HTTPS
    }
}
```

### **Frontend Configuration**
```env
# Production - goes through Nginx on standard HTTPS port (443)
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
```

## Fixes Applied

### **1. Backend .env (on VPS)**
Added to force HTTP mode:
```env
SSL_KEY_PATH=/nonexistent/path
SSL_CERT_PATH=/nonexistent/path
```

This prevents backend from detecting Let's Encrypt certificates and trying to run HTTPS.

### **2. Frontend .env.production (local)**
Fixed and committed:
```env
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
```

### **3. Frontend Rebuild Required**
- Rebuild frontend with correct configuration
- Upload to shared hosting at `cloud.zettaz.com`

## Deployment Process

### **Backend Deployment (VPS)**
```bash
# SSH to VPS
ssh root@185.75.21.46

# Navigate to repo
cd /var/www/app-zettaz-cloud/repo

# Pull latest code
git pull origin main

# Restart backend
cd backend
pm2 restart api

# Verify
pm2 logs api --lines 20
curl http://localhost:3001/api/health
```

### **Frontend Deployment (VPS)**
```bash
# SSH to VPS
ssh root@185.75.21.46

# Navigate to repo
cd /var/www/app-zettaz-cloud/repo

# Pull latest code
git pull origin main

# Build frontend
cd frontend
npm ci
npm run build

# Copy build to Nginx web root (check Nginx config for exact path)
# Common locations:
# - /var/www/cloud.zettaz.com/
# - /var/www/html/
# - /usr/share/nginx/html/

# Example:
sudo cp -r dist/* /var/www/cloud.zettaz.com/

# Restart Nginx to pick up changes
sudo systemctl reload nginx
```

## Verification Steps

### **1. Backend Health Check**
```bash
# From VPS
curl http://localhost:3001/api/health

# From external
curl https://api.zettaz.com/api/health
```

### **2. Frontend Check**
- Visit `https://cloud.zettaz.com`
- Open browser console
- Verify API calls go to `https://api.zettaz.com` (without :3001)
- Test login functionality

### **3. Database Connection**
```bash
# From VPS backend
cd /var/www/app-zettaz-cloud/repo/backend
node scripts/check_db_connection.js
```

## Current Status

✅ **Backend**: Fixed - running HTTP on port 3001
✅ **Frontend .env**: Fixed - removed :3001 from URLs
✅ **Git**: Committed and pushed fix
✅ **Build**: Frontend rebuilt with correct config
⏳ **Deployment**: Frontend needs to be uploaded to shared hosting

## Next Steps

1. **Check Nginx configuration for cloud.zettaz.com**
   ```bash
   ssh root@185.75.21.46
   cat /etc/nginx/sites-available/cloud.zettaz.com
   # or
   cat /etc/nginx/sites-enabled/cloud.zettaz.com
   ```
   This will show where frontend files should be deployed.

2. **Deploy frontend to VPS**
   ```bash
   # On VPS
   cd /var/www/app-zettaz-cloud/repo
   git pull origin main
   cd frontend
   npm run build
   # Copy to Nginx web root (path from step 1)
   ```

3. **Test the application**
   - Visit `https://cloud.zettaz.com`
   - Test login functionality
   - Verify no SSL errors in console

4. **Monitor logs**
   - Backend: `pm2 logs api --follow`
   - Nginx: `sudo tail -f /var/log/nginx/access.log`
   - Nginx errors: `sudo tail -f /var/log/nginx/error.log`
