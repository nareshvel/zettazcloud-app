# Notifications API

This document details the endpoints for managing notifications in the Zettaz Cloud Enterprise API.

## Overview

The Notifications API provides endpoints for creating, retrieving, updating, and managing notifications sent to users. Notifications include system alerts, status updates, reminders, and other important communications within the application.

## Endpoints

### List Notifications

```
GET /api/v1/notifications
```

Retrieves a paginated list of notifications for the authenticated user.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'created_at') |
| order | string | Sort order ('asc' or 'desc', default: 'desc') |
| read | boolean | Filter by read status (true/false) |
| priority | string | Filter by priority ('LOW', 'MEDIUM', 'HIGH', 'URGENT') |
| category | string | Filter by category ('SYSTEM', 'INVENTORY', 'SALES', 'PURCHASE', 'ACCOUNT', etc.) |
| start_date | string | Filter by creation date range start (ISO format) |
| end_date | string | Filter by creation date range end (ISO format) |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "notif_123456",
      "user_id": "user_123",
      "title": "Low Stock Alert",
      "message": "Product 'Business Laptop Pro' is below minimum stock level (5 remaining)",
      "category": "INVENTORY",
      "priority": "HIGH",
      "read": false,
      "action_url": "/inventory/products/prod_101",
      "entity_type": "PRODUCT",
      "entity_id": "prod_101",
      "created_at": "2023-05-15T14:30:00.000Z",
      "updated_at": "2023-05-15T14:30:00.000Z"
    },
    {
      "id": "notif_123457",
      "user_id": "user_123",
      "title": "Purchase Order Approved",
      "message": "Purchase order PO-20230510-003 has been approved and is ready for processing",
      "category": "PURCHASE",
      "priority": "MEDIUM",
      "read": true,
      "read_at": "2023-05-14T15:45:00.000Z",
      "action_url": "/purchases/orders/po_4567",
      "entity_type": "PURCHASE_ORDER",
      "entity_id": "po_4567",
      "created_at": "2023-05-14T11:15:00.000Z",
      "updated_at": "2023-05-14T15:45:00.000Z"
    },
    // Additional notifications...
  ],
  "pagination": {
    "totalItems": 53,
    "totalPages": 3,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  },
  "summary": {
    "unread_count": 12,
    "urgent_count": 2,
    "high_count": 5
  }
}
```

### Get Notification Details

```
GET /api/v1/notifications/:id
```

Retrieves detailed information for a specific notification.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "notif_123456",
    "user_id": "user_123",
    "title": "Low Stock Alert",
    "message": "Product 'Business Laptop Pro' is below minimum stock level (5 remaining)",
    "category": "INVENTORY",
    "priority": "HIGH",
    "read": false,
    "action_url": "/inventory/products/prod_101",
    "entity_type": "PRODUCT",
    "entity_id": "prod_101",
    "metadata": {
      "current_stock": 5,
      "minimum_stock": 10,
      "product_sku": "BLP001"
    },
    "sender_id": "system",
    "sender_name": "System",
    "recipient_roles": ["INVENTORY_MANAGER", "PURCHASING_MANAGER"],
    "created_at": "2023-05-15T14:30:00.000Z",
    "updated_at": "2023-05-15T14:30:00.000Z"
  }
}
```

### Mark Notification as Read

```
PUT /api/v1/notifications/:id/read
```

Marks a specific notification as read.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "notif_123456",
    "read": true,
    "read_at": "2023-05-15T16:30:00.000Z",
    "updated_at": "2023-05-15T16:30:00.000Z"
  }
}
```

### Mark All Notifications as Read

```
PUT /api/v1/notifications/read-all
```

Marks all notifications for the authenticated user as read.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Only mark notifications in this category as read (optional) |
| before_date | string | Only mark notifications created before this date as read (ISO format, optional) |

#### Response

```json
{
  "success": true,
  "data": {
    "updated_count": 12,
    "updated_at": "2023-05-15T16:45:00.000Z"
  }
}
```

### Delete Notification

```
DELETE /api/v1/notifications/:id
```

Deletes a specific notification.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Notification deleted successfully"
  }
}
```

### Delete All Notifications

```
DELETE /api/v1/notifications/all
```

Deletes all notifications for the authenticated user.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| read | boolean | Only delete read notifications (true) or unread notifications (false) |
| category | string | Only delete notifications in this category |
| before_date | string | Only delete notifications created before this date (ISO format) |

#### Response

```json
{
  "success": true,
  "data": {
    "deleted_count": 35,
    "deleted_at": "2023-05-15T17:00:00.000Z"
  }
}
```

### Get Notification Settings

```
GET /api/v1/notifications/settings
```

Retrieves notification settings for the authenticated user.

#### Response

```json
{
  "success": true,
  "data": {
    "user_id": "user_123",
    "email_notifications": true,
    "push_notifications": true,
    "sms_notifications": false,
    "in_app_notifications": true,
    "desktop_notifications": true,
    "quiet_hours": {
      "enabled": true,
      "start_time": "22:00",
      "end_time": "08:00",
      "timezone": "America/New_York"
    },
    "categories": {
      "SYSTEM": {
        "enabled": true,
        "email": true,
        "push": true,
        "sms": false,
        "in_app": true,
        "desktop": true
      },
      "INVENTORY": {
        "enabled": true,
        "email": true,
        "push": true,
        "sms": true,
        "in_app": true,
        "desktop": true
      },
      "SALES": {
        "enabled": true,
        "email": true,
        "push": true,
        "sms": false,
        "in_app": true,
        "desktop": true
      },
      "PURCHASE": {
        "enabled": true,
        "email": true,
        "push": false,
        "sms": false,
        "in_app": true,
        "desktop": true
      },
      "ACCOUNT": {
        "enabled": true,
        "email": true,
        "push": true,
        "sms": false,
        "in_app": true,
        "desktop": true
      }
    },
    "created_at": "2023-01-15T09:00:00.000Z",
    "updated_at": "2023-05-10T14:30:00.000Z"
  }
}
```

### Update Notification Settings

```
PUT /api/v1/notifications/settings
```

Updates notification settings for the authenticated user.

#### Request Body

```json
{
  "email_notifications": true,
  "push_notifications": true,
  "sms_notifications": true,
  "in_app_notifications": true,
  "desktop_notifications": true,
  "quiet_hours": {
    "enabled": true,
    "start_time": "23:00",
    "end_time": "07:00",
    "timezone": "America/New_York"
  },
  "categories": {
    "INVENTORY": {
      "enabled": true,
      "email": true,
      "push": true,
      "sms": true,
      "in_app": true,
      "desktop": true
    },
    "PURCHASE": {
      "enabled": true,
      "email": true,
      "push": true,
      "sms": false,
      "in_app": true,
      "desktop": false
    }
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "user_id": "user_123",
    "email_notifications": true,
    "push_notifications": true,
    "sms_notifications": true,
    "in_app_notifications": true,
    "desktop_notifications": true,
    "quiet_hours": {
      "enabled": true,
      "start_time": "23:00",
      "end_time": "07:00",
      "timezone": "America/New_York"
    },
    "categories": {
      "SYSTEM": {
        "enabled": true,
        "email": true,
        "push": true,
        "sms": false,
        "in_app": true,
        "desktop": true
      },
      "INVENTORY": {
        "enabled": true,
        "email": true,
        "push": true,
        "sms": true,
        "in_app": true,
        "desktop": true
      },
      "SALES": {
        "enabled": true,
        "email": true,
        "push": true,
        "sms": false,
        "in_app": true,
        "desktop": true
      },
      "PURCHASE": {
        "enabled": true,
        "email": true,
        "push": true,
        "sms": false,
        "in_app": true,
        "desktop": false
      },
      "ACCOUNT": {
        "enabled": true,
        "email": true,
        "push": true,
        "sms": false,
        "in_app": true,
        "desktop": true
      }
    },
    "updated_at": "2023-05-15T17:30:00.000Z"
  }
}
```

### Send Notification

```
POST /api/v1/notifications/send
```

Sends a notification to one or more users.

#### Request Body

```json
{
  "recipients": ["user_456", "user_789"],
  "recipient_roles": ["INVENTORY_MANAGER"],
  "title": "Inventory Count Scheduled",
  "message": "An inventory count has been scheduled for May 20, 2023. Please ensure all receiving is completed by May 19.",
  "category": "INVENTORY",
  "priority": "MEDIUM",
  "action_url": "/inventory/counts/count_123",
  "entity_type": "INVENTORY_COUNT",
  "entity_id": "count_123",
  "metadata": {
    "scheduled_date": "2023-05-20",
    "location": "Main Warehouse",
    "products_count": 250
  },
  "channels": ["in_app", "email"]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "sent_count": 3,
    "notification_ids": ["notif_123458", "notif_123459", "notif_123460"],
    "failed_count": 0,
    "sent_at": "2023-05-15T18:00:00.000Z"
  }
}
```

### Get Notification Summary

```
GET /api/v1/notifications/summary
```

Retrieves a summary of notifications for the authenticated user.

#### Response

```json
{
  "success": true,
  "data": {
    "total_count": 53,
    "unread_count": 12,
    "by_priority": {
      "URGENT": 2,
      "HIGH": 5,
      "MEDIUM": 25,
      "LOW": 21
    },
    "by_category": {
      "SYSTEM": 10,
      "INVENTORY": 15,
      "SALES": 12,
      "PURCHASE": 8,
      "ACCOUNT": 8
    },
    "latest_notification": {
      "id": "notif_123456",
      "title": "Low Stock Alert",
      "created_at": "2023-05-15T14:30:00.000Z"
    }
  }
}
```

### Test Notification Channels

```
POST /api/v1/notifications/test
```

Sends a test notification to the authenticated user via the specified channels.

#### Request Body

```json
{
  "channels": ["email", "push", "sms", "in_app", "desktop"]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "sent": {
      "email": true,
      "push": true,
      "sms": true,
      "in_app": true,
      "desktop": true
    },
    "message": "Test notifications sent successfully",
    "notification_id": "notif_123461",
    "sent_at": "2023-05-15T18:30:00.000Z"
  }
}
```

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "Notification not found",
    "code": "NOT_FOUND"
  }
}
```

### Validation Error

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "title": "Title is required",
      "message": "Message is required",
      "category": "Invalid category"
    }
  }
}
```

### Permission Error

```json
{
  "success": false,
  "error": {
    "message": "Not authorized to access this notification",
    "code": "PERMISSION_ERROR"
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

All notification operations enforce tenant isolation:

```javascript
// Direct notification query
const [notifications] = await connection.query(
  'SELECT * FROM notifications WHERE user_id = ? AND tenant_id = ?',
  [userId, tenant_id]
);

// Joined queries for notification data
const [notificationDetails] = await connection.query(`
  SELECT n.*, u.name as sender_name 
  FROM notifications n
  LEFT JOIN users u ON n.sender_id = u.id
  WHERE n.id = ? AND n.tenant_id = ?
`, [notificationId, tenant_id]);
```

For role-based notifications, the system ensures that only users within the same tenant receive the notifications:

```javascript
// Get users by role within the same tenant
const [users] = await connection.query(`
  SELECT u.id 
  FROM users u
  JOIN user_roles ur ON u.id = ur.user_id
  JOIN roles r ON ur.role_id = r.id
  WHERE r.name IN (?) AND u.tenant_id = ?
`, [recipientRoles, tenant_id]);
```

### Notification Delivery System

The notification system is built on a flexible architecture that supports multiple delivery channels:

1. **In-app Notifications** - Real-time notifications within the application UI
2. **Email Notifications** - Email delivery through SMTP or email service providers
3. **Push Notifications** - Mobile and desktop push notifications
4. **SMS Notifications** - Text messages for urgent notifications
5. **Desktop Notifications** - Native desktop notifications for the web application

The notification delivery process is handled by a dedicated service:

```javascript
const sendNotification = async (notification, channels, tenant_id) => {
  // Save notification in database first
  const [result] = await connection.query(
    'INSERT INTO notifications (user_id, title, message, ...) VALUES (?, ?, ?, ...)',
    [notification.user_id, notification.title, notification.message, ...]
  );
  
  // Process each requested channel
  for (const channel of channels) {
    switch (channel) {
      case 'email':
        await emailService.send(notification, tenant_id);
        break;
      case 'push':
        await pushService.send(notification, tenant_id);
        break;
      case 'sms':
        await smsService.send(notification, tenant_id);
        break;
      case 'desktop':
        await desktopService.send(notification, tenant_id);
        break;
      // In-app notifications are delivered through WebSockets
    }
  }
  
  return result;
};
```

### Real-time Notification Delivery

In-app notifications are delivered in real-time using WebSockets:

1. WebSocket connections are established when users log in
2. Connections are maintained in a connection pool by user ID
3. Notifications are pushed to relevant users as they occur
4. Message queues ensure delivery even if users are offline
5. Read/unread status is synchronized across devices

```javascript
// WebSocket notification delivery
io.on('connection', (socket) => {
  const userId = authenticateSocket(socket);
  
  // Store the connection
  userConnections.set(userId, socket);
  
  // Remove connection when user disconnects
  socket.on('disconnect', () => {
    userConnections.delete(userId);
  });
});

// Sending a notification through WebSocket
const sendWebSocketNotification = (userId, notification) => {
  const socket = userConnections.get(userId);
  if (socket) {
    socket.emit('notification', notification);
  }
};
```

### Notification Templates

The system uses templates for consistent notification formatting:

1. Templates are defined for each notification type
2. Templates support variable substitution for dynamic content
3. HTML and plain text versions are supported for email
4. Templates are customizable by tenant
5. Localization is supported for multi-language deployments

```javascript
// Template-based notification generation
const generateNotificationFromTemplate = async (templateKey, data, tenant_id) => {
  // Get template from database or cache
  const template = await getTemplate(templateKey, tenant_id);
  
  // Replace variables in template
  let title = template.title;
  let message = template.message;
  
  for (const [key, value] of Object.entries(data)) {
    title = title.replace(`{{${key}}}`, value);
    message = message.replace(`{{${key}}}`, value);
  }
  
  return { title, message, ...template.defaults };
};
```

### Notification Preferences and Filtering

The system respects user preferences for notification delivery:

1. Users can set global notification preferences
2. Category-specific preferences override global settings
3. Priority levels determine delivery urgency
4. Quiet hours prevent non-urgent notifications
5. Smart filtering reduces notification noise

```javascript
// Check if notification should be delivered based on user preferences
const shouldDeliverNotification = async (userId, notification, channel, tenant_id) => {
  const [preferences] = await connection.query(
    'SELECT * FROM notification_preferences WHERE user_id = ? AND tenant_id = ?',
    [userId, tenant_id]
  );
  
  if (!preferences) {
    return true; // Default to deliver if no preferences set
  }
  
  // Check quiet hours
  if (preferences.quiet_hours_enabled) {
    const now = new Date();
    const currentTime = `${now.getHours()}:${now.getMinutes()}`;
    if (isInQuietHours(currentTime, preferences.quiet_hours_start, preferences.quiet_hours_end)) {
      // Only deliver urgent notifications during quiet hours
      if (notification.priority !== 'URGENT') {
        return false;
      }
    }
  }
  
  // Check category-specific preferences
  const categoryPrefs = preferences.categories[notification.category];
  if (categoryPrefs && !categoryPrefs.enabled) {
    return false;
  }
  
  // Check channel-specific preference for this category
  return !categoryPrefs || categoryPrefs[channel] !== false;
};
```

### Notification Aggregation and Batching

To prevent notification fatigue, the system implements:

1. Similar notification aggregation
2. Batch delivery for non-urgent notifications
3. Digest modes for high-volume notification categories
4. Intelligent throttling based on user activity
5. Priority-based delivery scheduling

```javascript
// Aggregate similar notifications
const aggregateNotifications = async (userId, notification, tenant_id) => {
  // Check for similar recent notifications
  const [similar] = await connection.query(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    AND entity_type = ? 
    AND entity_id = ?
    AND category = ?
    AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    AND tenant_id = ?
    LIMIT 1
  `, [userId, notification.entity_type, notification.entity_id, notification.category, tenant_id]);
  
  if (similar.length > 0) {
    // Update existing notification instead of creating a new one
    await connection.query(`
      UPDATE notifications 
      SET count = count + 1, 
          message = ?, 
          updated_at = NOW() 
      WHERE id = ?
    `, [
      `${notification.message} (${similar[0].count + 1} updates)`, 
      similar[0].id
    ]);
    return similar[0].id;
  }
  
  // Create new notification
  return null; // Signal to create new notification
};
```

### Analytics and Monitoring

The system includes notification analytics for monitoring and improvement:

1. Delivery rates and open rates tracking
2. User engagement metrics by notification type
3. A/B testing for notification effectiveness
4. Performance monitoring for delivery times
5. Notification volume and patterns analysis
