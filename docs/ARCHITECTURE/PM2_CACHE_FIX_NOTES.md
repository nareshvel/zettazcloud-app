Fix: Clear PM2 Cache

pm2 stop all
pm2 delete all

# Stop PM2 process completely
pm2 delete api

# Clear PM2 cache and logs
pm2 flush

# Start fresh
cd /var/www/app-zettaz-cloud/repo/backend
pm2 start server.js --name api

# Check if error is resolved
pm2 logs api --lines 20 --nostream





Future deploys (after pushing to GitHub)

cd /var/www/app-zettaz-cloud/repo
git fetch --all
git checkout main
git pull --ff-only
cd backend
npm ci
pm2 reload api
pm2 logs api --lines 50 --nostream


New Script:


# 1. Stop application first to avoid port conflicts
pm2 stop api

# 2. Kill any lingering processes on port 3001
sudo lsof -ti:3001 | xargs sudo kill -9 2>/dev/null || true

# 3. Update code
cd /var/www/app-zettaz-cloud/repo
git fetch --all
git checkout main
git pull --ff-only

# 4. Check database connection before proceeding
cd backend
node scripts/check_db_connection.js

# 5. Install dependencies
npm ci --production

# 6. Start with updated environment
pm2 start api --update-env

# 7. Check status
sleep 5
pm2 logs api --lines 20 --nostream







# Manual approach:
cd /var/www/app-zettaz-cloud/repo

# Pull latest changes (including the new deployment script)
git fetch --all
git checkout main  
git pull --ff-only

# Now the deployment script is available, make it executable
chmod +x scripts/deploy_production.sh

# Run the deployment script
./scripts/deploy_production.sh




# 1. Pull latest changes from git
git pull origin main

# 2. Install any new dependencies (if package.json changed)
npm install

# 3. Restart the PM2 process
pm2 restart api

# 4. Check status
pm2 status





# On your machine (from repo root)
scp docs/deploy-zettaz.sh root@185.75.21.46:/var/www/app-zettaz-cloud/repo/

# On server
ssh root@YOUR_SERVER
chmod +x /var/www/app-zettaz-cloud/repo/deploy-zettaz.sh
cd /var/www/app-zettaz-cloud/repo && ./deploy-zettaz.sh




# 1. Stop Zettaz
pm2 stop zettaz-api

# 2. Free port 3001
sudo lsof -ti:3001 | xargs sudo kill -9 2>/dev/null || true

# 3. Update code
cd /var/www/app-zettaz-cloud/repo
git fetch --all
git checkout main
git pull --ff-only

# 4. DB check and install
cd backend
node scripts/check_db_connection.js
npm ci --production

# 5. Free 3001 again and start (avoids something taking it during 3–4)
sudo lsof -ti:3001 | xargs sudo kill -9 2>/dev/null || true
sleep 1
pm2 start zettaz-api --update-env

# 6. Check
sleep 5
pm2 logs zettaz-api --lines 20 --nostream




Start the Backend server 

pm2 restart zettaz-api && pm2 save



cd /var/www/app-zettaz-cloud/repo
git pull origin main
cd backend
pm2 restart api
pm2 status