# Zettaz Cloud POS - Documentation

Welcome to the Zettaz Cloud POS (Point of Sale) system documentation. This project is a modern, cloud-based POS solution designed for retail businesses.

## Documentation Index

1. [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Project roadmap and milestones
2. [Progress & TODOs](./PROGRESS.md) - Current status and pending tasks
3. [Technical Documentation](./TECHNICAL.md) - System architecture and technical details
4. [API Reference](./API_REFERENCE.md) - API endpoints and usage

## Project Overview

Zettaz Cloud POS is a full-stack application with:

- **Frontend**: React.js with TypeScript and Vite
- **Backend**: Node.js with Express
- **Database**: MySQL
- **Authentication**: JWT-based
- **Deployment**: Containerized with Docker

## Getting Started

### Prerequisites

- Node.js 16+
- MySQL 8.0+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install root dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   
   # Install backend dependencies
   cd ../backend
   npm install
   ```

3. Set up environment variables (see `.env.example` files in each directory)

4. Start the development servers:
   ```bash
   # From root directory
   npm run dev
   ```

## License

This project is proprietary software. All rights reserved.
