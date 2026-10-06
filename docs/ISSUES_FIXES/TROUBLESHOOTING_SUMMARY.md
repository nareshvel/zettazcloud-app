# Deployment Troubleshooting Summary

## What Went Wrong

### The Problem
Login was failing on production (`https://cloud.zettaz.com`) with the error:
```
POST https://api.zettaz.com:3001/api/auth/login net::ERR_SSL_PROTOCOL_ERROR
```

### Root Causes

1. **Frontend Configuration Error**
   - `.env.production` had `:3001` in API URLs
   - Frontend was trying to connect to `https://api.zettaz.com:3001`
   - Port 3001 is NOT exposed to the internet (only Nginx on port 443 is)

2. **Backend SSL Mode Error**
   - Backend detected Let's Encrypt SSL certificates
   - Started in HTTPS mode on port 3001
   - Conflicted with Nginx SSL termination architecture

3. **Duplicate CORS Headers**
   - Both Nginx and Express were adding CORS headers
   - Browser rejected responses with duplicate headers

---

## What We Fixed

### Fix #1: Frontend Environment Variables
**File**: `/frontend/.env.production`

**Before** (Broken):
```env
VITE_API_URL=https://api.zettaz.com:3001
VITE_API_BASE_URL=https://api.zettaz.com:3001
```

**After** (Fixed):
```env
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
```

**Why**: Nginx listens on standard HTTPS port 443, not 3001

### Fix #2: Backend SSL Disable
**File**: `/backend/.env`

**Added**:
```env
SSL_KEY_PATH=/nonexistent/path
SSL_CERT_PATH=/nonexistent/path
```

**Why**: Forces backend to run HTTP only (Nginx handles SSL)

### Fix #3: Backend CORS Disable
**File**: `/backend/.env`

**Added**:
```env
ENABLE_EXPRESS_CORS=false
```

**Why**: Nginx already handles CORS, no need for Express to add it

### Fix #4: Frontend Rebuild & Deploy
```bash
# Build with correct config
cd frontend
npm run build --mode production

# Deploy to shared hosting
# Upload dist/* to cloud.zettaz.com via FTP/SFTP
```

---

## Architecture Clarification

### Actual Infrastructure

```
┌─────────────────────┐         ┌──────────────────────┐
│   VPS SERVER        │         │  SHARED HOSTING      │
│  185.75.21.46       │         │                      │
├─────────────────────┤         ├──────────────────────┤
│ • Backend (Node.js) │◄────────┤ • Frontend (Apache)  │
│ • Nginx Proxy       │  API    │ • MySQL Database     │
│ • Port 3001 (HTTP)  │  Calls  │ • cloud.zettaz.com   │
│ • api.zettaz.com    │         │                      │
└─────────────────────┘         └──────────────────────┘
```

### SSL/HTTPS Flow

```
Browser → https://api.zettaz.com:443 (HTTPS)
              ↓
         Nginx (SSL termination)
              ↓
         http://localhost:3001 (HTTP - internal)
              ↓
         Backend responds
```

**Key Point**: Users access HTTPS, but backend runs HTTP internally

---

## Quick Reference

### Backend Configuration (VPS)
```env
# /var/www/app-zettaz-cloud/repo/backend/.env

# Force HTTP mode
SSL_KEY_PATH=/nonexistent/path
SSL_CERT_PATH=/nonexistent/path

# Disable Express CORS
ENABLE_EXPRESS_CORS=false
```

### Frontend Configuration (Local)
```env
# /frontend/.env.production

# NO PORT NUMBERS!
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
```

### Verification Commands
```bash
# Check backend is running HTTP
pm2 logs api | grep "Server listening"
# Should show: "HTTP Server listening on port 3001"

# Check CORS is disabled
pm2 logs api | grep "CORS"
# Should show: "Express CORS is disabled"

# Test API
curl https://api.zettaz.com/api/health
# Should return: {"status":"ok",...}
```

---

## Key Lessons

1. **Never include port numbers in production API URLs** when using reverse proxy
2. **Let the reverse proxy handle SSL** - backend runs HTTP internally
3. **Handle CORS in ONE place only** - either Nginx or Express, not both
4. **Understand your infrastructure** - know where each component is hosted
5. **Use git history** - helps identify when issues were introduced

---

## Related Documentation

- [Full Issue Resolution](./production-issue-resolution-nov2025.md) - Complete troubleshooting details
- [Infrastructure Architecture](./infrastructure-architecture.md) - Infrastructure diagrams
- [Frontend Deployment Steps](./frontend-deployment-steps.md) - Deployment procedures
- [Production Deployment Guide](./production-deployment.md) - General deployment guide

---

**Status**: ✅ Resolved - Login working, application operational

**Date**: November 1, 2025
