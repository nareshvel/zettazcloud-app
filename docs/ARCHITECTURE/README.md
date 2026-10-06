# Deployment Guide

This section provides comprehensive documentation for deploying the Zettaz Cloud Enterprise application to various environments, from development to production.

## Overview

Zettaz Cloud Enterprise is a fullstack application consisting of:

- A Node.js/Express backend API
- A React/TypeScript frontend application
- A MySQL database

This guide covers the deployment process for each component, configuration management, and scaling considerations.

## 📚 Documentation Index

### Quick Start
- **[Production Deployment Guide](./production-deployment.md)** - Step-by-step production deployment
- **[Frontend Deployment Steps](./frontend-deployment-steps.md)** - Detailed frontend build and deployment

### Architecture & Infrastructure
- **[Infrastructure Architecture](./infrastructure-architecture.md)** - Complete infrastructure overview and diagrams
- **[Production Issue Resolution (Nov 2025)](./production-issue-resolution-nov2025.md)** - Detailed troubleshooting case study

### Reference
- **[Deployment Checklist](#deployment-checklist)** - Pre/post deployment verification steps
- **[Environment Configuration](#environment-configuration)** - Required environment variables
- **[Security Considerations](#security-considerations)** - Security best practices

## Deployment Environments

### Local Development

The local development environment is used by developers for day-to-day work.

### Staging/QA

The staging environment mirrors the production environment closely and is used for testing and quality assurance.

### Production

The production environment hosts the live application used by customers.

## Server Requirements

### Backend Server

- **Operating System**: Ubuntu 20.04 LTS or newer
- **RAM**: Minimum 4GB, Recommended 8GB+
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **Storage**: Minimum 20GB SSD
- **Node.js**: v18.x or newer
- **PM2**: For process management
- **Nginx**: As a reverse proxy

### Frontend Server

- **Operating System**: Any supporting Nginx/Apache
- **RAM**: Minimum 2GB
- **CPU**: Minimum 1 core
- **Storage**: Minimum 10GB SSD
- **Nginx/Apache**: For serving static files

### Database Server

- **Operating System**: Ubuntu 20.04 LTS or newer
- **RAM**: Minimum 8GB, Recommended 16GB+
- **CPU**: Minimum 4 cores, Recommended 8+ cores
- **Storage**: Minimum 50GB SSD, Recommended 100GB+ SSD
- **MySQL**: v8.0 or newer

## Deployment Strategies

### Backend Deployment

The backend API can be deployed using several methods:

#### Option 1: Manual Deployment

1. SSH into the server
2. Clone the repository
3. Install dependencies
4. Configure environment variables
5. Start the application with PM2

Detailed steps:

```bash
# SSH into the server
ssh user@server-ip

# Clone the repository
git clone https://github.com/your-org/zettaz-cloud-enterprize.git
cd zettaz-cloud-enterprize

# Install backend dependencies
cd backend
npm install --production

# Configure environment variables
cp .env.example .env
nano .env  # Edit environment variables

# Start the application with PM2
pm2 start app.js --name "zettaz-api" -i max
pm2 save
```

#### Option 2: Automated Deployment with CI/CD

1. Configure a CI/CD pipeline (GitHub Actions, GitLab CI, Jenkins, etc.)
2. Build and test the application
3. Deploy to the server via SSH or container orchestration

Example GitHub Actions workflow:

```yaml
name: Deploy Backend

on:
  push:
    branches: [ main ]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18.x'
          
      - name: Install dependencies
        run: |
          cd backend
          npm ci
          
      - name: Run tests
        run: |
          cd backend
          npm test
          
      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /path/to/app
            git pull
            cd backend
            npm install --production
            pm2 restart zettaz-api
```

#### Option 3: Container Deployment

1. Build a Docker image
2. Push the image to a container registry
3. Deploy using Docker, Docker Compose, or Kubernetes

Example Dockerfile for backend:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
```

Example Docker Compose file:

```yaml
version: '3'

services:
  api:
    build: ./backend
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db
    networks:
      - zettaz-network

  db:
    image: mysql:8.0
    restart: always
    volumes:
      - db-data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
      - MYSQL_USER=${DB_USER}
      - MYSQL_PASSWORD=${DB_PASSWORD}
    networks:
      - zettaz-network

networks:
  zettaz-network:

volumes:
  db-data:
```

### Frontend Deployment

The frontend application is a static site that can be deployed to any web server.

#### Option 1: Manual Deployment

1. Build the frontend application
2. Copy the build files to a web server
3. Configure the web server to serve the files

Detailed steps:

```bash
# Build the frontend
cd frontend
npm install
npm run build

# Copy to web server
scp -r build/* user@server-ip:/var/www/html/
```

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name app.zettazcloud.com;
    
    root /var/www/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://backend-server:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Option 2: Automated Deployment with CI/CD

Example GitHub Actions workflow:

```yaml
name: Deploy Frontend

on:
  push:
    branches: [ main ]
    paths:
      - 'frontend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18.x'
          
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
          
      - name: Build
        run: |
          cd frontend
          npm run build
          
      - name: Deploy to production
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "frontend/build/*"
          target: "/var/www/html"
          strip_components: 2
```

#### Option 3: Static Site Hosting

Deploy to a static site hosting service:

1. AWS S3 + CloudFront
2. Netlify
3. Vercel
4. GitHub Pages

Example for Netlify:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the frontend
cd frontend
npm install
npm run build

# Deploy to Netlify
netlify deploy --prod --dir=build
```

### Database Deployment

#### Option 1: Self-Hosted MySQL

1. Install MySQL on the server
2. Secure the installation
3. Create the database and user
4. Import the schema and data

Detailed steps:

```bash
# Install MySQL
sudo apt update
sudo apt install mysql-server

# Secure the installation
sudo mysql_secure_installation

# Access MySQL
sudo mysql

# Create database and user
CREATE DATABASE zettaz_db;
CREATE USER 'zettaz_user'@'%' IDENTIFIED BY 'your-strong-password';
GRANT ALL PRIVILEGES ON zettaz_db.* TO 'zettaz_user'@'%';
FLUSH PRIVILEGES;
EXIT;

# Import the database dump
mysql -u zettaz_user -p zettaz_db < /path/to/digitpulse_zcloud_v10.sql
```

#### Option 2: Managed MySQL Service

Use a managed database service:

1. AWS RDS
2. Google Cloud SQL
3. Azure Database for MySQL
4. DigitalOcean Managed MySQL

Steps will vary by provider but generally involve:
1. Creating a database instance
2. Configuring networking and access
3. Creating database and user
4. Importing the schema and data

## Environment Configuration

### Backend Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
# Node.js Environment
NODE_ENV=production

# Server Configuration
PORT=3000
CORS_ORIGIN=https://app.zettazcloud.com

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=zettaz_user
DB_PASSWORD=your-strong-password
DB_NAME=zettaz_db
DB_CONNECTION_LIMIT=10

# Authentication
JWT_SECRET=your-very-long-and-secure-jwt-secret
JWT_EXPIRATION=1d
REFRESH_TOKEN_SECRET=your-very-long-and-secure-refresh-token-secret
REFRESH_TOKEN_EXPIRATION=7d

# File Upload
UPLOAD_DIR=/var/www/uploads
MAX_FILE_SIZE=5242880  # 5MB

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/zettaz/app.log
```

### Frontend Environment Variables

Create a `.env` file in the frontend directory with the following variables:

```
# API URL
VITE_API_BASE_URL=https://api.zettazcloud.com

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_NOTIFICATIONS=true

# Build Configuration
VITE_APP_VERSION=$npm_package_version
```

## SSL/TLS Configuration

It's essential to secure your application with SSL/TLS. You can use Let's Encrypt to obtain free SSL certificates.

### Installing Certbot

```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

### Obtaining a Certificate

```bash
sudo certbot --nginx -d app.zettazcloud.com -d api.zettazcloud.com
```

### Auto-renewal

Certbot sets up a cron job to automatically renew certificates. Verify with:

```bash
sudo systemctl status certbot.timer
```

## Load Balancing and Scaling

For high-traffic deployments, implement load balancing and scaling:

### Horizontal Scaling

1. Deploy multiple backend instances behind a load balancer
2. Use sticky sessions if needed for stateful operations

Example Nginx load balancer configuration:

```nginx
upstream backend {
    server backend1.example.com:3000;
    server backend2.example.com:3000;
    server backend3.example.com:3000;
}

server {
    listen 80;
    server_name api.zettazcloud.com;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Database Scaling

1. Implement read replicas for read-heavy workloads
2. Consider sharding for very large datasets
3. Use connection pooling to manage database connections efficiently

## Monitoring and Logging

### Application Monitoring

1. Implement health check endpoints
2. Use monitoring tools like New Relic, Datadog, or Prometheus + Grafana
3. Set up alerts for critical issues

Example health check endpoint:

```javascript
// healthController.js
const db = require('../config/database');

const healthCheck = async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = { healthCheck };
```

### Logging

1. Use a centralized logging solution like ELK Stack or Graylog
2. Implement structured logging for easier parsing
3. Set up log rotation to manage disk space

Example logging configuration with Winston:

```javascript
// logger.js
const winston = require('winston');
const { format, transports } = winston;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  defaultMeta: { service: 'zettaz-api' },
  transports: [
    new transports.Console(),
    new transports.File({ 
      filename: process.env.LOG_FILE || 'app.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

module.exports = logger;
```

## Backup and Disaster Recovery

### Database Backups

1. Set up automated daily backups
2. Store backups in a secure, offsite location
3. Regularly test backup restoration

Example MySQL backup script:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/mysql"
MYSQL_USER="backup_user"
MYSQL_PASSWORD="your-backup-password"
MYSQL_DATABASE="zettaz_db"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/$MYSQL_DATABASE-$DATE.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create the backup
mysqldump --user=$MYSQL_USER --password=$MYSQL_PASSWORD --single-transaction \
  --quick --lock-tables=false $MYSQL_DATABASE | gzip > $BACKUP_FILE

# Delete backups older than 30 days
find $BACKUP_DIR -name "$MYSQL_DATABASE-*.sql.gz" -mtime +30 -delete

# Upload to S3 or other storage (optional)
# aws s3 cp $BACKUP_FILE s3://your-bucket/backups/
```

### Application Backups

1. Back up uploaded files and user-generated content
2. Version control for code and configuration
3. Document the restoration process

## Security Considerations

### Network Security

1. Use a firewall to restrict access to servers
2. Implement VPC or network segmentation
3. Allow only necessary ports and connections

### Application Security

1. Keep dependencies up to date
2. Implement proper input validation and sanitization
3. Use security headers (HSTS, CSP, etc.)
4. Protect against common vulnerabilities (XSS, CSRF, SQL Injection)

Example security headers in Nginx:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.zettazcloud.com;" always;
```

### Database Security

1. Use strong, unique passwords
2. Restrict network access to the database
3. Implement least privilege principle for database users
4. Enable audit logging for sensitive operations

## Deployment Checklist

Use this checklist before deploying to production:

### Pre-Deployment

- [ ] Run full test suite and ensure all tests pass
- [ ] Check for security vulnerabilities in dependencies
- [ ] Review code changes and conduct code review
- [ ] Update documentation for any new features or changes
- [ ] Verify environment variables are configured correctly
- [ ] Create a database backup before deploying

### Deployment

- [ ] Deploy to staging environment first
- [ ] Test critical functionality in staging
- [ ] Schedule deployment during low-traffic periods
- [ ] Implement with blue-green or canary deployment if possible
- [ ] Monitor logs during deployment for errors

### Post-Deployment

- [ ] Verify application health checks pass
- [ ] Test critical functionality in production
- [ ] Monitor application performance and error rates
- [ ] Check database performance
- [ ] Update status page or notify users if necessary

## Rollback Procedure

If issues are detected after deployment, follow this rollback procedure:

1. Identify the issue and its severity
2. If critical, immediately revert to the previous version
3. If non-critical, assess if a hotfix is more appropriate
4. Update relevant stakeholders about the issue and rollback

Example rollback steps:

```bash
# Backend rollback
cd /path/to/app/backend
git reset --hard <previous-commit-hash>
npm install --production
pm2 restart zettaz-api

# Frontend rollback
cd /path/to/app/frontend
git reset --hard <previous-commit-hash>
npm install
npm run build
cp -r build/* /var/www/html/
```

## Continuous Deployment

For a more automated workflow, implement continuous deployment:

1. Configure a CI/CD pipeline to run tests automatically
2. Automatically deploy to staging when tests pass
3. Implement automated integration tests in staging
4. Deploy to production automatically or with manual approval

## Multi-Tenant Deployment Considerations

Since Zettaz Cloud Enterprise is a multi-tenant application, consider these additional factors:

1. **Database Isolation**: Ensure tenant data is properly isolated
2. **Performance**: Monitor resource usage by tenant to prevent noisy neighbor issues
3. **Customization**: Support tenant-specific configurations without code changes
4. **Upgrades**: Ability to upgrade tenants individually or as a group

## Cloud Provider-Specific Guidance

### AWS Deployment

1. Use Elastic Beanstalk or ECS for the backend
2. S3 + CloudFront for the frontend
3. RDS for the database
4. Secrets Manager for environment variables
5. CloudWatch for monitoring and logging

### Google Cloud Platform

1. App Engine or Cloud Run for the backend
2. Cloud Storage + Cloud CDN for the frontend
3. Cloud SQL for the database
4. Secret Manager for environment variables
5. Cloud Monitoring and Logging

### Azure

1. App Service for the backend
2. Blob Storage + CDN for the frontend
3. Azure Database for MySQL
4. Key Vault for environment variables
5. Application Insights for monitoring

## Troubleshooting Common Deployment Issues

### Backend Service Won't Start

1. Check environment variables
2. Verify database connection
3. Check for port conflicts
4. Review application logs

### Database Connection Issues

1. Verify network connectivity
2. Check credentials
3. Ensure database server is running
4. Check connection limits

### Frontend Routes Not Working

1. Verify the Nginx configuration for SPA routing
2. Check that the build process completed successfully
3. Ensure API endpoints are correctly configured
