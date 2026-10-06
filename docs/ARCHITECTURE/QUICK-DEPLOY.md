# Quick Deployment Guide

## 🚀 Deploy in 5 Minutes

### Step 1: Update Version
```bash
# Edit frontend/package.json
# Change version: "1.0.0" → "1.1.0"
```

### Step 2: Update Changelog
```bash
# Edit docs/deployment/CHANGELOG.md
# Add new version entry with changes
```

### Step 3: Build
```bash
cd frontend
npm run build
```

### Step 4: Deploy
```bash
# Upload dist/* to hosting via FTP/SFTP
# Target: public_html or web root
```

### Step 5: Verify
```bash
# Visit https://cloud.zettaz.com
# Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
# Test login and key features
```

---

## 📋 Pre-Deployment Checklist

- [ ] Version number updated in `package.json`
- [ ] Changes documented in `CHANGELOG.md`
- [ ] Build completed without errors
- [ ] Console logs removed from production code
- [ ] Environment variables correct in `.env.production`

---

## 🔧 Common Commands

```bash
# Build for production
npm run build

# Check backend status
ssh root@185.75.21.46
pm2 status

# Restart backend if needed
pm2 restart api

# View backend logs
pm2 logs api --lines 50
```

---

## 📦 What Gets Deployed

```
dist/
├── index.html              # Entry point
├── assets/
│   ├── *.css              # Styles
│   ├── *.js               # JavaScript bundles
│   └── images/            # Static images
└── .htaccess              # SPA routing (if needed)
```

---

## 🐛 Quick Fixes

**White screen?**
→ Clear cache + hard refresh

**Images not loading?**
→ Check backend is running: `pm2 status`

**404 on refresh?**
→ Add .htaccess file for SPA routing

**API errors?**
→ Verify VITE_API_URL in .env.production

---

## 📞 Emergency Contacts

- **VPS**: root@185.75.21.46
- **Frontend**: https://cloud.zettaz.com
- **Backend**: https://api.zettaz.com

---

## 🎯 Version Numbering

- **Major (2.0.0)**: Breaking changes
- **Minor (1.1.0)**: New features
- **Patch (1.0.1)**: Bug fixes

---

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)
