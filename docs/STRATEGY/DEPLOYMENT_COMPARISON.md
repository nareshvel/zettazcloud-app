# Deployment Scripts Comparison

## 📊 **Two Versions Available**

### **1. Simple Version** ⭐ **RECOMMENDED**
**File**: `deploy-backend-simple.sh` (45 lines)

**Use when**: 
- Quick deployments after pushing to GitHub
- You just need: pull → install → restart
- Minimal output, fast execution

**What it does**:
1. Stop app
2. Free port
3. Pull latest code
4. Install dependencies  
5. Start app

**Run time**: ~30-60 seconds

---

### **2. Comprehensive Version**
**File**: `deploy-backend.sh` (249 lines)

**Use when**:
- First-time deployment
- Troubleshooting issues
- Need detailed diagnostics
- Want prerequisite validation

**What it does**:
1. Check prerequisites (Git, Node, npm, PM2)
2. Stop app with validation
3. Free port with retry logic
4. Pull code with stash handling
5. Check database connection
6. Install dependencies
7. Double-check port
8. Start app with validation
9. Verify startup success
10. Show detailed status

**Run time**: ~60-90 seconds

---

## 🎯 **Recommendation**

For your workflow (push from dev → deploy on server):

**Use**: `deploy-backend-simple.sh`

```bash
# Upload once
scp deploy-backend-simple.sh root@185.75.21.46:/var/www/app-zettaz-cloud/repo/

# Deploy (every time)
ssh root@185.75.21.46
cd /var/www/app-zettaz-cloud/repo
./deploy-backend-simple.sh
```

---

## 📝 **Simple Script Content**

```bash
#!/bin/bash
set -e

APP_NAME="zettaz-api"
PORT=3001
REPO_DIR="/var/www/app-zettaz-cloud/repo"
BACKEND_DIR="${REPO_DIR}/backend"

echo "=== Zettaz Backend Deployment ==="

# 1. Stop app
pm2 stop ${APP_NAME} 2>/dev/null || true

# 2. Free port
sudo lsof -ti:${PORT} | xargs sudo kill -9 2>/dev/null || true
sleep 2

# 3. Pull latest code
cd ${REPO_DIR}
git pull --ff-only

# 4. Install dependencies
cd ${BACKEND_DIR}
npm ci --production

# 5. Start app
pm2 start ${APP_NAME} --update-env
pm2 save

# Verify
sleep 5
pm2 logs ${APP_NAME} --lines 20 --nostream
```

**Total**: 5 steps, clean output, fast execution.

---

## ⚡ **Quick Comparison**

| Feature | Simple | Comprehensive |
|---------|--------|---------------|
| Lines of code | 45 | 249 |
| Execution time | 30-60s | 60-90s |
| Prerequisites check | ❌ | ✅ |
| Color output | ❌ | ✅ |
| DB check | ❌ | ✅ |
| Error details | Basic | Detailed |
| Best for | Daily deploys | Troubleshooting |

---

## 💡 **Your Workflow**

```bash
# On dev machine
git add .
git commit -m "fix: tax calculation improvements"
git push origin main

# On server (one command)
ssh root@185.75.21.46 "cd /var/www/app-zettaz-cloud/repo && ./deploy-backend-simple.sh"
```

**Done!** 🎉
