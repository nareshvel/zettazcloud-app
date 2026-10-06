#!/bin/bash

###############################################################################
# Zettaz Cloud POS - Backend Deployment Script
# 
# This script handles the complete backend deployment process on the 
# production server (VPS at 185.75.21.46)
#
# Usage: ./deploy-backend.sh
#
# Prerequisites:
# - Git repository set up at /var/www/app-zettaz-cloud/repo
# - PM2 installed globally
# - Node.js and npm installed
# - Database connection configured in backend/.env
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_DIR="/var/www/app-zettaz-cloud/repo"
BACKEND_DIR="${REPO_DIR}/backend"
PM2_APP_NAME="zettaz-api"
BACKEND_PORT=5172
export PORT=$BACKEND_PORT
GIT_BRANCH="main"

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "\n${GREEN}==>${NC} ${BLUE}$1${NC}\n"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    if port_in_use $port; then
        print_warning "Port $port is in use. Killing processes..."
        sudo lsof -ti:$port | xargs sudo kill -9 2>/dev/null || true
        sleep 2
        if port_in_use $port; then
            print_error "Failed to free port $port"
            return 1
        fi
        print_success "Port $port freed"
    else
        print_info "Port $port is already free"
    fi
}

###############################################################################
# Main Deployment Process
###############################################################################

print_step "Starting Zettaz Backend Deployment"

# Step 1: Check prerequisites
print_step "Step 1: Checking prerequisites"

if ! command_exists git; then
    print_error "Git is not installed"
    exit 1
fi

if ! command_exists node; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
fi

if ! command_exists pm2; then
    print_error "PM2 is not installed. Install with: npm install -g pm2"
    exit 1
fi

if [ ! -d "$REPO_DIR" ]; then
    print_error "Repository directory not found: $REPO_DIR"
    exit 1
fi

print_success "All prerequisites met"

# Step 2: Stop the application
print_step "Step 2: Stopping application"

if pm2 list | grep -q "$PM2_APP_NAME"; then
    print_info "Stopping PM2 app: $PM2_APP_NAME"
    pm2 stop $PM2_APP_NAME || true
    sleep 2
    print_success "Application stopped"
else
    print_warning "PM2 app '$PM2_APP_NAME' not found (first deployment?)"
fi

# Step 3: Free the port
print_step "Step 3: Freeing port $BACKEND_PORT"
kill_port $BACKEND_PORT

# Step 4: Update code from Git
print_step "Step 4: Updating code from Git"

cd $REPO_DIR
print_info "Current directory: $(pwd)"

# Stash any local changes
if [[ -n $(git status -s) ]]; then
    print_warning "Local changes detected. Stashing..."
    git stash
fi

# Fetch and pull latest code
print_info "Fetching latest changes..."
git fetch --all

print_info "Checking out $GIT_BRANCH branch..."
git checkout $GIT_BRANCH

print_info "Pulling latest changes..."
git pull --ff-only origin $GIT_BRANCH

print_success "Code updated to latest version"
git log -1 --oneline

# Step 5: Check database connection
print_step "Step 5: Checking database connection"

cd $BACKEND_DIR

if [ -f "scripts/check_db_connection.js" ]; then
    print_info "Running database connection check..."
    if node scripts/check_db_connection.js; then
        print_success "Database connection verified"
    else
        print_error "Database connection failed"
        print_warning "Continuing anyway, but application may not start properly"
    fi
else
    print_warning "Database check script not found, skipping"
fi

# Step 6: Install dependencies
print_step "Step 6: Installing dependencies"

print_info "Running npm ci (clean install)..."
npm ci --production

print_success "Dependencies installed"

# Step 7: Free port again (safety check)
print_step "Step 7: Final port check"
kill_port $BACKEND_PORT

# Step 8: Start the application
print_step "Step 8: Starting application"

# Check if PM2 app exists
if pm2 list | grep -q "$PM2_APP_NAME"; then
    print_info "Restarting existing PM2 app..."
    pm2 restart $PM2_APP_NAME --update-env
else
    print_info "Starting new PM2 app..."
    pm2 start server.js --name $PM2_APP_NAME
fi

# Save PM2 configuration
print_info "Saving PM2 configuration..."
pm2 save

print_success "Application started"

# Step 9: Wait and check logs
print_step "Step 9: Checking application status"

print_info "Waiting 5 seconds for application to initialize..."
sleep 5

# Check if process is running
if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
    print_success "Application is running!"
else
    print_error "Application failed to start"
    print_info "Showing error logs:"
    pm2 logs $PM2_APP_NAME --lines 50 --nostream
    exit 1
fi

# Show recent logs
print_info "Recent logs:"
pm2 logs $PM2_APP_NAME --lines 20 --nostream

# Step 10: Final status
print_step "Step 10: Deployment Summary"

echo ""
print_success "✓ Deployment completed successfully!"
echo ""
print_info "Application Status:"
pm2 status $PM2_APP_NAME

echo ""
print_info "Useful Commands:"
echo "  View logs:        pm2 logs $PM2_APP_NAME"
echo "  Restart app:      pm2 restart $PM2_APP_NAME"
echo "  Stop app:         pm2 stop $PM2_APP_NAME"
echo "  App status:       pm2 status"
echo "  Monitor:          pm2 monit"
echo ""

print_info "Backend API should be accessible at: http://localhost:$BACKEND_PORT"
print_info "External API URL: https://api.zettaz.com"
echo ""

print_success "Deployment script finished!"
