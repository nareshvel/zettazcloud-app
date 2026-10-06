# Environment Setup

This guide provides instructions for setting up your development environment for the Zettaz Cloud Enterprise application.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (version 18.x or higher)
- **npm** (usually comes with Node.js)
- **MySQL** (version 8.0 or higher)
- **Git** for version control

## Getting the Code

1. Clone the repository:

```bash
git clone <repository-url>
cd zettaz-cloud-enterprize
```

2. Install dependencies for both frontend and backend:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

## Environment Variables

### Backend Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```
# Server Configuration
PORT=5172
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=digitpulse_zcloud
DB_PORT=3306

# JWT Authentication
JWT_SECRET=your_secret_key
JWT_EXPIRY=8h

# File Upload Paths
UPLOAD_DIR=uploads
```

### Frontend Environment Variables

Create a `.env` file in the `frontend` directory with the following variables:

```
VITE_API_URL=http://localhost:5172/api
```

## Database Setup

1. Create a MySQL database:

```sql
CREATE DATABASE digitpulse_zcloud;
```

2. Import the database schema and initial data:

```bash
mysql -u your_username -p digitpulse_zcloud < database/digitpulse_zcloud_v10.sql
```

This SQL file contains the complete database schema and some initial data to get started.

## Directory Structure Setup

Ensure the following directories exist for file uploads and are writable:

```bash
# Create upload directories for the backend
mkdir -p backend/uploads
mkdir -p backend/public/uploads/categories

# Set appropriate permissions
chmod -R 755 backend/uploads
chmod -R 755 backend/public/uploads
```

## Running the Application

### Development Mode

1. Start the backend server:

```bash
cd backend
npm run dev
```

This will start the backend server with nodemon for automatic reloading on code changes.

2. In a separate terminal, start the frontend development server:

```bash
cd frontend
npm run dev
```

This will start the Vite development server with hot module replacement.

3. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5172/api

### Production Mode

1. Build the frontend:

```bash
cd frontend
npm run build
```

2. Start the backend server in production mode:

```bash
cd backend
npm start
```

## Verification

To verify your setup is working correctly:

1. Check that the backend server is running by accessing http://localhost:5172/api/health
2. Confirm database connectivity through the health endpoint
3. Test authentication by logging in with a default user account:
   - Email: admin@example.com
   - Password: password123

## Troubleshooting Common Issues

### Database Connection Issues

If you encounter database connection errors:

1. Verify MySQL is running:
```bash
sudo systemctl status mysql
```

2. Check your credentials in the `.env` file
3. Ensure the database exists and the user has proper permissions:
```sql
GRANT ALL PRIVILEGES ON digitpulse_zcloud.* TO 'your_username'@'localhost';
FLUSH PRIVILEGES;
```

### Node.js Version Mismatch

If you encounter issues with dependencies or runtime errors:

1. Verify your Node.js version:
```bash
node -v
```

2. Use nvm (Node Version Manager) to install and use the correct version:
```bash
nvm install 18
nvm use 18
```

### File Upload Issues

If file uploads are failing:

1. Ensure the upload directories exist and have proper permissions
2. Check the `UPLOAD_DIR` environment variable is set correctly
3. Verify the Node.js process has write permissions to these directories

## Next Steps

After setting up your environment:

1. Explore the [Codebase Structure](../4-codebase-structure/README.md) documentation
2. Review the [API Documentation](../6-api-documentation/README.md)
3. Check out the [Feature Documentation](../5-features/README.md) for the module you're working on
