# Monitoring and Observability

This section covers the monitoring and observability strategies implemented in Zettaz Cloud Enterprise to ensure system health, performance, and reliability.

## Overview

Effective monitoring is critical for maintaining a robust application. Zettaz Cloud Enterprise implements a comprehensive monitoring strategy covering:

1. Application performance monitoring
2. Error tracking and alerting
3. Database monitoring
4. Infrastructure monitoring
5. User activity and audit logging
6. Security monitoring

## Health Check Endpoints

The application provides health check endpoints that can be used by monitoring tools to verify system status.

### API Health Check

```
GET /api/health
```

This endpoint returns the health status of various components:

```json
{
  "status": "healthy",
  "components": {
    "api": "healthy",
    "database": "healthy",
    "cache": "healthy",
    "storage": "healthy"
  },
  "uptime": "10d 4h 30m",
  "version": "1.5.3",
  "timestamp": "2025-06-02T05:40:43.000Z"
}
```

### Database Health Check

The database health check verifies:
- Connection pool status
- Query execution time
- Replication lag (if applicable)

### Implementation

The health check endpoints are implemented in the `healthController.js` file:

```javascript
// healthController.js
const db = require('../config/database');
const os = require('os');
const packageInfo = require('../package.json');

// Record application start time for uptime calculation
const startTime = new Date();

const getUptime = () => {
  const uptime = new Date() - startTime;
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${days}d ${hours}h ${minutes}m`;
};

const healthCheck = async (req, res) => {
  try {
    // Check database connection
    const dbStartTime = new Date();
    const [dbResult] = await db.query('SELECT 1 as db_check');
    const dbResponseTime = new Date() - dbStartTime;
    
    const dbStatus = dbResult && dbResult[0]?.db_check === 1 ? 'healthy' : 'unhealthy';
    
    // Check system resources
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
    
    res.status(200).json({
      status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
      components: {
        api: 'healthy',
        database: dbStatus,
        database_response_time_ms: dbResponseTime
      },
      system: {
        memory_usage_percent: memoryUsage.toFixed(2),
        cpu_load: os.loadavg()[0].toFixed(2)
      },
      uptime: getUptime(),
      version: packageInfo.version,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(500).json({
      status: 'unhealthy',
      components: {
        api: 'healthy',
        database: 'unhealthy'
      },
      error: error.message,
      uptime: getUptime(),
      version: packageInfo.version,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = { healthCheck };
```

## Logging Strategy

### Log Levels

The application uses the following log levels:

| Level | Description |
|-------|-------------|
| ERROR | Critical issues that require immediate attention |
| WARN | Potential issues that should be reviewed |
| INFO | General operational information |
| DEBUG | Detailed information for troubleshooting |

### Structured Logging

All logs are structured in JSON format to facilitate parsing and analysis:

```json
{
  "timestamp": "2025-06-02T05:40:43.000Z",
  "level": "info",
  "message": "Request processed successfully",
  "method": "GET",
  "path": "/api/products",
  "statusCode": 200,
  "responseTime": 45,
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "91a0c4b4-908f-4720-8b0e-15fa6a0c9a2a",
  "requestId": "7f8d1d6a-4b0c-4a4b-8b0a-c1d2e3f4g5h6"
}
```

### Log Storage

Logs are written to:
1. Console (development environment)
2. Log files (rotated daily)
3. Centralized logging system (production)

### Implementation

Logging is implemented using Winston:

```javascript
// logger.js
const winston = require('winston');
const { format, transports } = winston;
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Custom format for combining timestamp, log level, and message
const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.json()
);

// Create a Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'zettaz-api' },
  transports: [
    // Write logs with level 'error' and below to error.log
    new transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
    // Write all logs to combined.log
    new transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  ]
});

// If we're not in production, also log to the console with a simpler format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(({ timestamp, level, message, ...rest }) => {
        const metaStr = Object.keys(rest).length > 0 ? 
          ` ${JSON.stringify(rest)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    )
  }));
}

// Create a stream object for Morgan HTTP request logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
```

### HTTP Request Logging

All HTTP requests are logged using Morgan middleware:

```javascript
// app.js
const express = require('express');
const morgan = require('morgan');
const logger = require('./utils/logger');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Add request ID to each request
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// Custom Morgan token for request ID
morgan.token('request-id', (req) => req.id);

// Custom Morgan token for user ID
morgan.token('user-id', (req) => req.user?.id || 'anonymous');

// Custom Morgan token for tenant ID
morgan.token('tenant-id', (req) => req.user?.tenant_id || 'none');

// Custom Morgan format
const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms :request-id :user-id :tenant-id';

// Use Morgan for HTTP request logging
app.use(morgan(morganFormat, { stream: logger.stream }));
```

## Error Tracking

The application implements a centralized error handling approach:

### Global Error Handler

```javascript
// errorHandler.js
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error({
    message: 'Unhandled error',
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    tenantId: req.user?.tenant_id
  });
  
  // Determine the status code
  const statusCode = err.statusCode || 500;
  
  // Format the error response
  const errorResponse = {
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_SERVER_ERROR'
    }
  };
  
  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }
  
  // Send the response
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
```

### Custom Error Classes

```javascript
// AppError.js
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'RESOURCE_NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = {}) {
    super(message, 422, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_FAILED');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'PERMISSION_DENIED');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError
};
```

### Error Monitoring in Goods Received Note (GRN) Module

The GRN module implements robust error handling, particularly for missing products during status updates. Instead of failing the entire transaction when a product referenced in a GRN is no longer in the database, the system:

1. Logs warnings for the specific missing products
2. Skips those products while processing the rest of the GRN
3. Continues the transaction to ensure business operations aren't disrupted

This pattern is applied in both inventory reversal (COMPLETED to DRAFT) and inventory commitment (DRAFT to COMPLETED) workflows, ensuring resilience and providing clear error logs for troubleshooting.

```javascript
// Example from grnController.js - Inventory reversal section
try {
  const [productResult] = await connection.query(
    'SELECT id, current_stock_quantity, cost FROM products WHERE id = ? AND tenant_id = ?',
    [item.product_id, tenant_id]
  );
  
  if (!productResult || productResult.length === 0) {
    // Product not found - log warning and continue with next item
    console.warn(`Product not found during GRN status update reversal: ${item.product_id}`);
    continue; // Skip this item but continue processing other items
  }
  
  // Process inventory reversal for this product
  // ...
} catch (error) {
  console.error(`Error processing GRN item reversal for product ${item.product_id}:`, error);
  throw error;
}
```

## Performance Monitoring

### Response Time Tracking

All API endpoints track response times and log them:

```javascript
// performanceMiddleware.js
const responseTime = (req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const elapsed = process.hrtime(start);
    const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
    
    req.responseTime = elapsedMs.toFixed(2);
    
    if (elapsedMs > 1000) {
      logger.warn({
        message: 'Slow API response',
        path: req.path,
        method: req.method,
        responseTime: req.responseTime,
        requestId: req.id
      });
    }
  });
  
  next();
};

module.exports = responseTime;
```

### Database Query Performance

Critical database queries are instrumented to track execution time:

```javascript
// db.js
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0
});

// Wrapper for query to add performance monitoring
const query = async (sql, params = []) => {
  const start = process.hrtime();
  
  try {
    const result = await pool.query(sql, params);
    
    const elapsed = process.hrtime(start);
    const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
    
    // Log slow queries
    if (elapsedMs > 100) {
      logger.warn({
        message: 'Slow database query',
        sql: sql.substring(0, 200), // Truncate long queries
        params: JSON.stringify(params).substring(0, 200),
        execution_time_ms: elapsedMs.toFixed(2)
      });
    }
    
    return result;
  } catch (error) {
    const elapsed = process.hrtime(start);
    const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
    
    logger.error({
      message: 'Database query error',
      sql: sql.substring(0, 200),
      params: JSON.stringify(params).substring(0, 200),
      execution_time_ms: elapsedMs.toFixed(2),
      error: error.message,
      code: error.code
    });
    
    throw error;
  }
};

module.exports = {
  query,
  // ... other methods
};
```

## Alerting System

The application integrates with an alerting system that triggers notifications based on predefined conditions:

### Alert Conditions

1. **Service Availability**: Health check failures
2. **Performance Degradation**: API response times exceeding thresholds
3. **Error Rate**: Unusual spike in error rates
4. **Database Issues**: Connection failures or slow queries
5. **Security**: Failed login attempts or suspicious activities
6. **Resource Usage**: High CPU, memory, or disk usage

### Alert Channels

Alerts can be delivered through multiple channels:

1. Email
2. SMS
3. Slack/Teams notifications
4. PagerDuty or similar on-call services

## User Activity Monitoring

The application tracks and logs important user activities for audit purposes:

### Audit Logging

```javascript
// auditLogger.js
const logger = require('./logger');

const auditLog = (req, action, details) => {
  logger.info({
    message: 'Audit Log',
    action,
    details,
    userId: req.user?.id,
    username: req.user?.email,
    tenantId: req.user?.tenant_id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.id
  });
};

module.exports = { auditLog };
```

### Usage Example

```javascript
// productController.js (excerpt)
const { auditLog } = require('../utils/auditLogger');

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const tenant_id = req.user.tenant_id;
    
    // Update the product
    const result = await productService.updateProduct(id, updates, tenant_id);
    
    // Create audit log
    auditLog(req, 'PRODUCT_UPDATED', {
      productId: id,
      updates: JSON.stringify(updates)
    });
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
```

## Real-time Monitoring Dashboard

For operations staff, a real-time monitoring dashboard is available that provides:

1. System health status
2. Key performance metrics
3. Error counts and details
4. User activity levels
5. Resource utilization

## Monitoring Tools Integration

The application can be integrated with various monitoring tools:

### Prometheus Integration

For metrics collection and monitoring:

```javascript
// prometheusMiddleware.js
const promClient = require('prom-client');
const express = require('express');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (GC, memory, CPU, etc.)
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
});

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Register custom metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestCounter);

// Create middleware for tracking HTTP metrics
const prometheusMiddleware = (req, res, next) => {
  const start = process.hrtime();
  
  // Record response metrics when the response is finished
  res.on('finish', () => {
    const elapsed = process.hrtime(start);
    const elapsedMs = (elapsed[0] * 1000) + (elapsed[1] / 1000000);
    
    // Record HTTP metrics
    httpRequestDurationMicroseconds
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(elapsedMs);
    
    httpRequestCounter
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .inc();
  });
  
  next();
};

// Create a metrics endpoint
const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
};

module.exports = {
  prometheusMiddleware,
  metricsEndpoint
};
```

## Best Practices for Monitoring

1. **Monitor What Matters**: Focus on metrics that directly impact user experience and business outcomes
2. **Establish Baselines**: Understand normal behavior to better detect anomalies
3. **Set Appropriate Thresholds**: Avoid alert fatigue by setting meaningful thresholds
4. **Correlate Events**: Look for patterns across different metrics
5. **Test Monitoring Systems**: Regularly verify that alerts work as expected
6. **Document Runbooks**: Create clear procedures for responding to common alerts
7. **Review and Improve**: Regularly review monitoring effectiveness and refine as needed

## Incident Response Plan

When monitoring detects an issue, follow this incident response plan:

1. **Alert**: Notify the appropriate team members
2. **Assess**: Determine the severity and impact
3. **Mitigate**: Take immediate actions to reduce impact
4. **Resolve**: Address the root cause
5. **Recover**: Restore normal operations
6. **Review**: Conduct a post-mortem analysis
7. **Improve**: Implement changes to prevent recurrence

## Future Enhancements

1. **APM Integration**: Implement Application Performance Monitoring tools like New Relic or Datadog
2. **Distributed Tracing**: Add OpenTelemetry for tracing requests across services
3. **User Experience Monitoring**: Add real user monitoring for frontend performance
4. **Business Metrics**: Integrate business KPIs into the monitoring dashboard
5. **AI-Powered Anomaly Detection**: Implement machine learning for proactive issue detection
