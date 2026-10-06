# Authentication API

This document details the authentication endpoints for the Zettaz Cloud Enterprise API.

## Endpoints

### Register a New User

```
POST /api/v1/auth/register
```

Registers a new user in the system. This endpoint is typically only accessible to administrators.

#### Request Body

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "role": "manager",
  "tenant_id": "12345"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "67890",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "manager",
      "tenant_id": "12345",
      "createdAt": "2023-01-15T14:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Notes
- Password must meet security requirements: minimum 8 characters, include at least one uppercase letter, one lowercase letter, one number, and one special character.
- `tenant_id` is required and must be valid.
- `role` must be one of: "admin", "manager", "inventory_clerk", "sales_associate", "accountant".

### Login

```
POST /api/v1/auth/login
```

Authenticates a user and returns a JWT token.

#### Request Body

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "67890",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "manager",
      "tenant_id": "12345"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

#### Notes
- The token is valid for 24 hours (86400 seconds).
- Account will be temporarily locked after 5 consecutive failed login attempts.

### Forgot Password

```
POST /api/v1/auth/forgot-password
```

Initiates the password reset process by sending a reset link to the user's email.

#### Request Body

```json
{
  "email": "john.doe@example.com"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Password reset email sent. Please check your inbox."
  }
}
```

#### Notes
- Always returns a success response for security reasons, even if the email is not found.
- Reset link expires after 1 hour.

### Reset Password

```
POST /api/v1/auth/reset-password
```

Resets a user's password using a valid reset token.

#### Request Body

```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePassword123!"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully."
  }
}
```

#### Notes
- New password must meet the same security requirements as registration.
- Token must be valid and not expired.

### Verify Token

```
GET /api/v1/auth/verify
```

Verifies if the current JWT token is valid.

#### Headers

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "67890",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "manager",
      "tenant_id": "12345"
    }
  }
}
```

#### Notes
- Useful for validating sessions and retrieving current user information.
- No request body required.

### Refresh Token

```
POST /api/v1/auth/refresh
```

Generates a new JWT token based on the current valid token.

#### Headers

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

#### Notes
- Should be called before the current token expires to maintain session.
- Returns new token with reset expiration time.

### Logout

```
POST /api/v1/auth/logout
```

Invalidates the current JWT token.

#### Headers

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### Notes
- Token is added to a blacklist until its original expiration time.
- Subsequent requests with the same token will be rejected.

## Error Responses

### Invalid Credentials

```json
{
  "success": false,
  "error": {
    "message": "Invalid email or password",
    "code": "AUTH_FAILED"
  }
}
```

### Account Locked

```json
{
  "success": false,
  "error": {
    "message": "Account temporarily locked due to multiple failed login attempts. Please try again later.",
    "code": "ACCOUNT_LOCKED",
    "details": {
      "unlockTime": "2023-01-15T15:30:00.000Z"
    }
  }
}
```

### Invalid Token

```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired token",
    "code": "INVALID_TOKEN"
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
      "password": "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
    }
  }
}
```

## Implementation Notes

### Token Structure

The JWT token payload contains:

```json
{
  "id": "67890",
  "email": "john.doe@example.com",
  "role": "manager",
  "tenant_id": "12345",
  "iat": 1673797800,
  "exp": 1673884200
}
```

### Security Considerations

- All authentication endpoints enforce HTTPS in production.
- Passwords are hashed using bcrypt with appropriate work factor.
- Login attempts are rate-limited to prevent brute force attacks.
- Token blacklisting is implemented for logout functionality.
- Password reset tokens are single-use and short-lived.
