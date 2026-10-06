# Production Deployment Issue Resolution - November 2025

## Executive Summary

**Issue**: Login functionality was broken on production (`https://cloud.zettaz.com`) with `net::ERR_SSL_PROTOCOL_ERROR`.

**Resolution Time**: ~2 hours of systematic troubleshooting

**Status**: ✅ **RESOLVED** - Login working, application fully functional

---

## Problem Description

### Initial Symptoms
- Frontend loaded successfully at `https://cloud.zettaz.com`
- Login page displayed correctly
- Login attempts failed with browser console error:
  ```
  POST https://api.zettaz.com:3001/api/auth/login net::ERR_SSL_PROTOCOL_ERROR
  ```

### User Impact
- Complete inability to log in to the application
- All authenticated features inaccessible
- Production system effectively down

---

## Root Cause Analysis

### Issue #1: Incorrect Frontend API URLs
**Problem**: Frontend was configured to call `https://api.zettaz.com:3001` instead of `https://api.zettaz.com`

**Location**: `/frontend/.env.production`

**Incorrect Configuration**:
```env
VITE_API_URL=https://api.zettaz.com:3001
VITE_API_BASE_URL=https://api.zettaz.com:3001
```

**Why This Failed**:
- Port 3001 is NOT exposed to the internet
- Only Nginx on port 443 (standard HTTPS) is accessible
- Attempting to connect to port 3001 externally results in connection failure

**Git History**:
- Introduced in commit `3b0764b` ("signup process fix1")
- Previous working state at commit `27c6011`

### Issue #2: Backend Running HTTPS Instead of HTTP
**Problem**: Backend was detecting Let's Encrypt SSL certificates and starting in HTTPS mode on port 3001

**Why This Failed**:
- Nginx is configured to handle SSL termination
- Backend should only run HTTP internally
- HTTPS on port 3001 conflicts with the Nginx proxy architecture

**Backend Logs Showed**:
```
HTTPS Server error: Error: listen EADDRINUSE: address already in use :::3001
```

### Issue #3: Duplicate CORS Headers
**Problem**: Both Nginx and Express backend were adding CORS headers

**Browser Error**:
```
The 'Access-Control-Allow-Origin' header contains multiple values 
'https://cloud.zettaz.com, https://cloud.zettaz.com', but only one is allowed.
```

**Why This Failed**:
- Nginx configuration includes comprehensive CORS handling
- Express backend also had CORS middleware enabled
- Duplicate headers caused browser to reject the response

---

## Infrastructure Architecture (Clarified)

### Actual Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    DOMAIN REGISTRAR                         │
│                  (Third Server)                             │
│  - DNS Management Only                                      │
│  - api.zettaz.com → 185.75.21.46                           │
│  - cloud.zettaz.com → Shared Hosting IP                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────┐                    ┌──────────────────────┐
│   VPS SERVER     │                    │  SHARED HOSTING      │
│  185.75.21.46    │                    │   (Separate IP)      │
├──────────────────┤                    ├──────────────────────┤
│ • Backend Only   │                    │ • Frontend (Apache)  │
│ • Node.js/PM2    │◄───────────────────┤ • MySQL Database     │
│ • Nginx Proxy    │   API Calls        │ • cloud.zettaz.com   │
│ • Port 3001      │                    │ • mysql.us.cloud...  │
│   (internal)     │                    └──────────────────────┘
│ • api.zettaz.com │
└──────────────────┘
```

### Request Flow (Correct)

```
User Browser
    │
    ├─→ https://cloud.zettaz.com (Frontend)
    │       │
    │       └─→ Apache on Shared Hosting
    │           (Serves React static files)
    │
    └─→ https://api.zettaz.com (API Calls)
            │
            └─→ Nginx on VPS (Port 443 - HTTPS)
                    │ SSL Termination
                    │
                    └─→ Backend on localhost:3001 (HTTP)
                            │
                            └─→ MySQL on mysql.us.cloudlogin.co
```

### Key Architecture Points

1. **Frontend Deployment**: Shared hosting server (NOT on VPS)
2. **Backend Deployment**: VPS server at 185.75.21.46
3. **Database**: Shared hosting server (same as frontend)
4. **SSL Termination**: 
   - Nginx handles SSL for `api.zettaz.com`
   - Apache handles SSL for `cloud.zettaz.com`
5. **Backend Mode**: HTTP only (Nginx handles HTTPS)

---

## Solutions Implemented

### Fix #1: Frontend Environment Variables

**File**: `/frontend/.env.production`

**Change**:
```diff
- VITE_API_URL=https://api.zettaz.com:3001
- VITE_API_BASE_URL=https://api.zettaz.com:3001
+ VITE_API_URL=https://api.zettaz.com
+ VITE_API_BASE_URL=https://api.zettaz.com
  VITE_JWT_SECRET=***REMOVED***
```

**Commit**: `9a59ab5` - "Fix production API URLs - remove :3001 port for Nginx SSL termination"

### Fix #2: Force Backend HTTP Mode

**File**: `/backend/.env`

**Addition**:
```env
# Disable SSL in backend (Nginx handles SSL termination)
SSL_KEY_PATH=/nonexistent/path
SSL_CERT_PATH=/nonexistent/path
```

**Effect**: Backend no longer detects Let's Encrypt certificates and runs in HTTP mode

**Verification**:
```bash
pm2 logs api --lines 20
# Output shows:
# ⚠️  SSL certificates not found. Starting HTTP server...
# 🚀 HTTP Server listening on port 3001
# 🔓 Running HTTP server - SSL certificates not available
```

### Fix #3: Disable Express CORS

**File**: `/backend/.env`

**Addition**:
```env
ENABLE_EXPRESS_CORS=false
```

**Effect**: Express CORS middleware disabled, Nginx handles all CORS headers

**Backend Log Confirmation**:
```
[API] Express CORS is disabled (ENABLE_EXPRESS_CORS=false). Assuming proxy handles CORS.
```

### Fix #4: Frontend Rebuild and Deployment

**Build Process**:
```bash
cd /var/www/app-zettaz-cloud/repo/frontend
npm run build --mode production
```

**Deployment**:
- Built `dist/` folder uploaded to shared hosting
- Deployed to `cloud.zettaz.com` web root via FTP/SFTP

**Verification**:
```bash
# Verified no :3001 in deployed files
grep -r "3001" /path/to/deployed/assets/*.js
# (No results = success)
```

---

## Verification Steps

### 1. Backend Health Check
```bash
# On VPS
curl http://localhost:3001/api/health
# Expected: {"status":"ok",...}

# External
curl https://api.zettaz.com/api/health
# Expected: {"status":"ok",...}
```

### 2. Frontend Access
- Navigate to `https://cloud.zettaz.com`
- Verify login page loads
- Check browser console for errors (should be none)

### 3. Login Test
- Enter valid credentials
- Submit login form
- Expected: Successful login, redirect to dashboard
- Browser console should show:
  ```
  POST https://api.zettaz.com/api/auth/login 200 (OK)
  ```

### 4. CORS Verification
- Check Network tab in browser DevTools
- Verify response headers show single `Access-Control-Allow-Origin` header
- No duplicate header errors

---

## Lessons Learned

### 1. Port Numbers in Production URLs
**Rule**: Never include port numbers in production API URLs when using reverse proxy

**Correct**:
```env
VITE_API_URL=https://api.zettaz.com
```

**Incorrect**:
```env
VITE_API_URL=https://api.zettaz.com:3001
```

**Reason**: Reverse proxy (Nginx) handles routing on standard HTTPS port (443)

### 2. SSL Termination Architecture
**Principle**: Let the reverse proxy handle SSL, backend runs HTTP internally

**Benefits**:
- Centralized SSL certificate management
- Better performance (backend doesn't do encryption)
- Easier to update SSL certificates
- Industry standard practice

### 3. CORS Configuration
**Rule**: Handle CORS in ONE place only

**Options**:
- Option A: Nginx handles CORS (our choice)
- Option B: Backend handles CORS (disable Nginx CORS)

**Never**: Both handling CORS simultaneously

### 4. Infrastructure Documentation
**Importance**: Maintain accurate infrastructure diagrams

**This incident revealed**:
- Initial assumption: Frontend on VPS
- Reality: Frontend on shared hosting
- Impact: Wasted time troubleshooting wrong server

### 5. Git History for Troubleshooting
**Value**: Git commits helped identify when issue was introduced

**Process**:
```bash
git log --oneline -20
git show <commit>:path/to/file
```

---

## Prevention Measures

### 1. Environment Variable Validation
**Recommendation**: Add startup validation in frontend

```typescript
// src/config/validateEnv.ts
export function validateEnv() {
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (apiUrl.includes(':3001')) {
    throw new Error(
      'VITE_API_URL should not include :3001 in production. ' +
      'Use https://api.zettaz.com instead.'
    );
  }
  
  if (!apiUrl.startsWith('https://')) {
    console.warn('VITE_API_URL should use HTTPS in production');
  }
}
```

### 2. Pre-Deployment Checklist
Create `/docs/9-deployment/pre-deployment-checklist.md`:

- [ ] Frontend `.env.production` has correct API URLs (no :3001)
- [ ] Backend `.env` has SSL disabled (`SSL_KEY_PATH=/nonexistent/path`)
- [ ] Backend `.env` has CORS disabled (`ENABLE_EXPRESS_CORS=false`)
- [ ] Frontend build completed successfully
- [ ] Backend health check passes
- [ ] PM2 shows backend running in HTTP mode
- [ ] Nginx configuration tested (`nginx -t`)

### 3. Deployment Script Enhancement
Update `/scripts/deploy_production.sh` to validate configuration:

```bash
# Add validation step
echo "🔍 Validating configuration..."

# Check frontend .env.production
if grep -q ":3001" frontend/.env.production; then
    echo "❌ ERROR: frontend/.env.production contains :3001"
    echo "   Remove port number from API URLs"
    exit 1
fi

# Check backend .env
if ! grep -q "ENABLE_EXPRESS_CORS=false" backend/.env; then
    echo "⚠️  WARNING: ENABLE_EXPRESS_CORS not set to false"
fi
```

### 4. Monitoring and Alerts
**Recommendation**: Set up monitoring for:
- Backend health endpoint (`/api/health`)
- Login endpoint success rate
- CORS errors in logs
- SSL certificate expiration

---

## Quick Reference

### Backend Configuration (VPS)
```env
# /var/www/app-zettaz-cloud/repo/backend/.env

# Force HTTP mode (Nginx handles SSL)
SSL_KEY_PATH=/nonexistent/path
SSL_CERT_PATH=/nonexistent/path

# Disable Express CORS (Nginx handles CORS)
ENABLE_EXPRESS_CORS=false
```

### Frontend Configuration (Local/Build)
```env
# /frontend/.env.production

# Production API URLs (NO PORT NUMBERS)
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
VITE_JWT_SECRET=<your-jwt-secret>
```

### Deployment Commands
```bash
# Backend (on VPS)
cd /var/www/app-zettaz-cloud/repo
git pull origin main
cd backend
pm2 restart api --update-env
pm2 logs api --lines 20

# Frontend (local build, then upload)
cd frontend
npm run build --mode production
# Upload dist/* to shared hosting via FTP/SFTP
```

### Troubleshooting Commands
```bash
# Check backend mode
pm2 logs api | grep "Server listening"
# Should show: "HTTP Server listening on port 3001"

# Check CORS setting
pm2 logs api | grep "CORS"
# Should show: "Express CORS is disabled"

# Check for :3001 in deployed frontend
grep -r "3001" /path/to/frontend/assets/*.js
# Should return nothing

# Test API connectivity
curl https://api.zettaz.com/api/health
```

---

## Related Documentation

- [Infrastructure Analysis](../INFRASTRUCTURE_ANALYSIS.md)
- [Production Deployment Guide](./production-deployment.md)
- [Nginx Configuration](../../scripts/setup-nginx-proxy.sh)
- [Deployment Script](../../scripts/deploy_production.sh)

---

## Incident Timeline

| Time | Event |
|------|-------|
| Initial | User reports login failure with SSL error |
| +15min | Identified `:3001` in frontend API URLs |
| +30min | Fixed frontend .env.production, rebuilt |
| +45min | Discovered frontend on shared hosting (not VPS) |
| +60min | Uploaded new frontend build to shared hosting |
| +75min | Encountered CORS duplicate header error |
| +90min | Disabled Express CORS, enabled Nginx CORS only |
| +105min | Backend still running HTTPS, added SSL disable |
| +120min | ✅ Login successful, issue resolved |

---

## Contact

For questions about this resolution or deployment process:
- Review this document
- Check related documentation above
- Consult git history for specific changes

**Last Updated**: November 1, 2025
**Resolution Status**: ✅ Complete
**Production Status**: ✅ Operational
