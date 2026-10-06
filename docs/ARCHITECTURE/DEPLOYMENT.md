# Zettaz Cloud POS - Deployment Guide

## Version Management

### Current Version: 1.1.0

### Version Update Procedure

1. **Update Version Number**
   ```bash
   # Edit package.json
   cd frontend
   # Change "version": "1.0.0" to "1.1.0"
   ```

2. **Document Changes**
   - Update `docs/deployment/CHANGELOG.md` with new version entry
   - List all Added, Changed, Fixed, and Removed items
   - Include date in format: [1.1.0] - 2025-11-01

3. **Build Application**
   ```bash
   cd frontend
   npm run build
   ```

4. **Deploy to Production**
   - Upload `dist/*` files to shared hosting
   - Clear browser cache
   - Test critical functionality

---

## Build Process

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Access to shared hosting (FTP/SFTP)

### Build Commands

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Output will be in dist/ directory
```

### Build Output
```
dist/
├── index.html                    # Main HTML file
├── assets/
│   ├── index-[hash].css         # Compiled CSS
│   ├── index-[hash].js          # Main JavaScript bundle
│   ├── react-vendor-[hash].js   # React vendor bundle
│   └── ... (other chunks)
```

---

## Deployment Steps

### 1. Build the Application
```bash
cd /Users/nareshvelusamy/Herd/app-zettaz-cloud/frontend
npm run build
```

### 2. Upload to Shared Hosting

**Via FTP/SFTP:**
1. Connect to hosting server
2. Navigate to public_html or web root
3. Upload all files from `dist/` directory
4. Ensure `.htaccess` file is present for SPA routing

**Required .htaccess for SPA:**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### 3. Verify Deployment
- Visit https://cloud.zettaz.com
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Test login functionality
- Verify API connectivity
- Check console for errors

---

## Environment Configuration

### Production Environment Variables

**File**: `frontend/.env.production`
```env
VITE_API_URL=https://api.zettaz.com
VITE_API_BASE_URL=https://api.zettaz.com
VITE_JWT_SECRET=[your-jwt-secret]
```

### Backend API Configuration
- **API URL**: https://api.zettaz.com
- **Backend Server**: VPS at 185.75.21.46
- **Process Manager**: PM2 (process name: "api")

---

## Post-Deployment Checklist

- [ ] Build completed successfully
- [ ] All files uploaded to hosting
- [ ] .htaccess file present
- [ ] Clear browser cache
- [ ] Login works
- [ ] Products page loads
- [ ] POS screen functional
- [ ] Images display correctly
- [ ] Mobile UI responsive
- [ ] No console errors
- [ ] Version number updated in package.json
- [ ] CHANGELOG.md updated

---

## Rollback Procedure

If deployment fails:

1. **Identify Issue**
   - Check browser console for errors
   - Check backend API status
   - Verify environment variables

2. **Rollback Steps**
   ```bash
   # Rebuild previous version
   git checkout [previous-version-tag]
   cd frontend
   npm run build
   # Upload dist/* to hosting
   ```

3. **Restore from Backup**
   - Keep previous dist/ folder as backup
   - Replace current files with backup

---

## Version History

| Version | Date       | Deployed By | Notes                          |
|---------|------------|-------------|--------------------------------|
| 1.1.0   | 2025-11-01 | Naresh      | Mobile UI improvements         |
| 1.0.0   | 2025-10-XX | Naresh      | Initial production release     |

---

## Troubleshooting

### Issue: White Screen After Deployment
**Solution**: Clear browser cache, check console for errors, verify API URL

### Issue: Images Not Loading
**Solution**: Check VITE_API_URL in .env.production, verify backend is running

### Issue: 404 on Page Refresh
**Solution**: Ensure .htaccess file is present with SPA routing rules

### Issue: API Connection Failed
**Solution**: 
```bash
# SSH to VPS
ssh root@185.75.21.46
# Check PM2 status
pm2 status
# Restart if needed
pm2 restart api
```

---

## Contact

For deployment issues, contact:
- **Developer**: Naresh Velusamy
- **Email**: [your-email]
- **VPS Access**: root@185.75.21.46

---

## References

- [CHANGELOG.md](./CHANGELOG.md) - Version history and changes
- [Production Issue Resolution](../9-deployment/production-issue-resolution-nov2025.md)
- [Mobile UI Fixes](../bug-fixes/mobile-ui-fixes-nov2025.md)
