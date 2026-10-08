> **SUPERSEDED (2026-10):** This document describes the pre-migration production layout — backend at `/var/www/app-zettaz-cloud/repo`, remote MySQL `mysql.us.cloudlogin.co` (some docs also show the old shared-hosting frontend and port 3001). Current layout: everything on the VPS at `/var/www/zettazcloud-app` with MySQL `zettazcloud_prod @ localhost:3306`; deploy via `bash /var/www/zettazcloud-app/deploy.sh` or `deploy-quick.sh` (see `AGENTS.md` at the repo root). Kept for historical reference only.
>

# Production Deployment Instructions

## 🚀 **Deployment Architecture**

### **Infrastructure**

- **Frontend**: Shared hosting (Apache) at `https://cloud.zettaz.com`
- **Backend**: VPS (Nginx + PM2) at `https://api.zettaz.com` (185.75.21.46)
- **Database**: MySQL on shared hosting

### **Deployment Flow**

```
Development Machine
    ├─> Frontend: Build → Upload to shared hosting
    └─> Backend: Push to GitHub → Deploy on VPS
```

---

## 📦 **Frontend Deployment**

### **Step 1: Build Frontend**

```bash
cd /Users/nareshvelusamy/Herd/app-zettaz-cloud/frontend

# Update version (optional)
# Edit package.json version field

# Build for production
npm run build
```

**Output**: `dist/` folder with production-ready files

### **Step 2: Upload to Shared Hosting**

**Manual Upload** (via cPanel File Manager or FTP):
1. Connect to shared hosting
2. Navigate to public_html or web root
3. Upload contents of `dist/` folder
4. Ensure `.htaccess` is configured for SPA routing

**FTP Upload** (using FileZilla or similar):
```
Host: ftp.yoursharedhosting.com
Username: your_username
Password: your_password
Local folder: /Users/nareshvelusamy/Herd/app-zettaz-cloud/frontend/dist
Remote folder: /public_html
```

### **Step 3: Verify Frontend**

Visit `https://cloud.zettaz.com` and verify:
- ✅ Application loads
- ✅ Login works
- ✅ API calls reach backend
- ✅ No console errors

---

## 🔧 **Backend Deployment**

### **Step 1: Commit and Push Changes**

```bash
cd /Users/nareshvelusamy/Herd/app-zettaz-cloud

# Check status
git status

# Add changes
git add .

# Commit with descriptive message
git commit -m "feat: add tax calculation fix and i18n improvements"

# Push to GitHub
git push origin main
```

### **Step 2: Upload Deployment Script to Server**

**First time only** - Upload the deployment script:

```bash
# From your local machine
scp deploy-backend.sh root@185.75.21.46:/var/www/app-zettaz-cloud/repo/

# SSH to server
ssh root@185.75.21.46

# Make script executable
chmod +x /var/www/app-zettaz-cloud/repo/deploy-backend.sh
```

### **Step 3: Run Deployment Script**

```bash
# SSH to server (if not already connected)
ssh root@185.75.21.46

# Navigate to repo directory
cd /var/www/app-zettaz-cloud/repo

# Run deployment script
./deploy-backend.sh
```

### **What the Script Does**

1. ✅ **Checks prerequisites** (Git, Node, npm, PM2)
2. ✅ **Stops application** (PM2 stop)
3. ✅ **Frees port 3001** (kills lingering processes)
4. ✅ **Updates code** (git pull from main branch)
5. ✅ **Checks database connection**
6. ✅ **Installs dependencies** (npm ci --production)
7. ✅ **Frees port again** (safety check)
8. ✅ **Starts application** (PM2 start/restart)
9. ✅ **Saves PM2 config** (pm2 save)
10. ✅ **Shows logs and status**

### **Step 4: Verify Backend**

The script will show:
- Application status
- Recent logs
- Any errors

**Manual verification**:
```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs api --lines 50

# Check if port is listening
sudo lsof -i:3001

# Test API endpoint
curl http://localhost:3001/api/health
```

---

## 🔍 **Troubleshooting**

### **Backend Won't Start**

```bash
# Check PM2 logs
pm2 logs api --lines 100

# Check if port is blocked
sudo lsof -i:3001

# Kill processes on port
sudo lsof -ti:3001 | xargs sudo kill -9

# Restart manually
cd /var/www/app-zettaz-cloud/repo/backend
pm2 restart api
```

### **Database Connection Issues**

```bash
# Test database connection
cd /var/www/app-zettaz-cloud/repo/backend
node scripts/check_db_connection.js

# Check .env file
cat .env | grep DB_
```

### **Git Pull Fails**

```bash
# Stash local changes
git stash

# Force pull
git fetch --all
git reset --hard origin/main

# Or clean and pull
git clean -fd
git pull origin main
```

### **PM2 Issues**

```bash
# Delete and recreate PM2 app
pm2 delete api
pm2 flush
cd /var/www/app-zettaz-cloud/repo/backend
pm2 start server.js --name api
pm2 save

# Reset PM2 completely
pm2 kill
pm2 resurrect
```

---

## 📋 **Quick Reference Commands**

### **On Development Machine**

```bash
# Build frontend
cd frontend && npm run build

# Push backend changes
git add . && git commit -m "your message" && git push origin main
```

### **On Production Server**

```bash
# Deploy backend
cd /var/www/app-zettaz-cloud/repo && ./deploy-backend.sh

# View logs
pm2 logs api

# Restart app
pm2 restart api

# Check status
pm2 status

# Monitor resources
pm2 monit
```

---

## 🔐 **Security Checklist**

Before deploying:

- ✅ Environment variables set in backend/.env
- ✅ JWT_SECRET is strong and unique
- ✅ Database credentials are secure
- ✅ CORS configured for cloud.zettaz.com
- ✅ SSL certificates valid (Nginx handles this)
- ✅ No sensitive data in git repository
- ✅ .gitignore includes .env files

---

## 📊 **Deployment Checklist**

### **Pre-Deployment**

- [ ] Test all features locally
- [ ] Run `npm run build` successfully
- [ ] Check for console errors
- [ ] Verify API endpoints work
- [ ] Update version numbers (optional)
- [ ] Commit and push to GitHub

### **Frontend Deployment**

- [ ] Build frontend (`npm run build`)
- [ ] Upload `dist/` folder to shared hosting
- [ ] Verify site loads at cloud.zettaz.com
- [ ] Test login and key features
- [ ] Check browser console for errors

### **Backend Deployment**

- [ ] Upload deployment script (first time)
- [ ] SSH to server
- [ ] Run `./deploy-backend.sh`
- [ ] Verify no errors in output
- [ ] Check PM2 status
- [ ] Test API endpoints
- [ ] Monitor logs for issues

### **Post-Deployment**

- [ ] Test complete user flow (login → POS → checkout)
- [ ] Verify tax calculations
- [ ] Check translations/i18n
- [ ] Test on different devices/browsers
- [ ] Monitor error logs for 24 hours
- [ ] Notify team of deployment

---

## 🎯 **Version Management**

### **Update Version Numbers**

```bash
# Root package.json
/Users/nareshvelusamy/Herd/app-zettaz-cloud/package.json
"version": "1.1.2"

# Frontend package.json
/Users/nareshvelusamy/Herd/app-zettaz-cloud/frontend/package.json
"version": "1.1.2"
```

### **Git Tagging** (Optional)

```bash
# Create version tag
git tag -a v1.1.2 -m "Release v1.1.2: Tax fixes and i18n improvements"

# Push tags
git push origin --tags
```

---

## 📞 **Support**

### **Server Access**

- **VPS IP**: 185.75.21.46
- **SSH User**: root
- **Backend Path**: /var/www/app-zettaz-cloud/repo
- **PM2 App Name**: api

### **URLs**

- **Frontend**: https://cloud.zettaz.com
- **Backend API**: https://api.zettaz.com
- **Database**: Shared hosting MySQL

### **Useful Links**

- GitHub Repository: [Your repo URL]
- PM2 Documentation: https://pm2.keymetrics.io/docs/usage/quick-start/
- Nginx Configuration: /etc/nginx/sites-available/api.zettaz.com

---

## 🚨 **Emergency Rollback**

If deployment causes critical issues:

```bash
# SSH to server
ssh root@185.75.21.46

# Navigate to repo
cd /var/www/app-zettaz-cloud/repo

# Rollback to previous commit
git log --oneline -10  # Find previous commit hash
git reset --hard <previous-commit-hash>

# Reinstall dependencies
cd backend
npm ci --production

# Restart application
pm2 restart api

# Verify
pm2 logs api --lines 50
```

---

**Last Updated**: February 12, 2026  
**Current Version**: 1.1.2  
**Deployment Script**: deploy-backend.sh
