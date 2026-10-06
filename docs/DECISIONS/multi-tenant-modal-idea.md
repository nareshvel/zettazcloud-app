# Multi-Tenant Access Control Library Documentation

## Project Overview

This document outlines a complete development guide for creating a reusable multi-tenant access control library. The library enables management of subscription plans, user roles, permissions, and feature/module access, integrated with a MySQL database and usable across any project using NestJS and React.

---

## Goals

* Modular, plug-and-play design.
* Super admin can create/edit/delete plans.
* tenants subscribe to plans with defined modules.
* Each tenant manages its own users, roles, and permissions.
* Auto-assign default roles and permissions.

---

## Stack Summary

| Layer     | Technology            |
| --------- | --------------------- |
| Backend   | NestJS, TypeORM       |
| Frontend  | React, TypeScript     |
| Database  | MySQL (InnoDB)        |
| Auth      | JWT + PassportJS      |
| Dev Tools | Docker, Swagger, Jest |

---

## Database Structure (Core)

### ✅ Included Entities (with recommended definitions):

```sql
CREATE TABLE `users` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `first_name` varchar(50),
  `last_name` varchar(50),
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT 0
);

CREATE TABLE `tenants` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `email` varchar(100),
  `status` varchar(50) DEFAULT 'active',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `user_tenant_memberships` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `user_id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `role_id` varchar(36),
  `status` varchar(50) DEFAULT 'active',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE
);

CREATE TABLE `plans` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `price_monthly` decimal(10,2) NOT NULL,
  `duration_months` int NOT NULL,
  `modules` JSON,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `tenant_subscriptions` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `tenantId` varchar(36) NOT NULL,
  `planId` varchar(36) NOT NULL,
  `status` enum('active','trial','expired','cancelled','pending') DEFAULT 'pending',
  `startDate` date NOT NULL,
  `endDate` date NOT NULL,
  `modules` JSON,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`planId`) REFERENCES `plans`(`id`)
);

CREATE TABLE `tenant_roles` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `tenant_permissions` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `action` varchar(50) NOT NULL,
  `subject` varchar(50) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `tenant_role_permissions` (
  `role_id` varchar(36) NOT NULL,
  `permission_id` varchar(36) NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `tenant_roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `tenant_permissions`(`id`) ON DELETE CASCADE
);

CREATE TABLE `system_roles` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `name` varchar(50) NOT NULL,
  `description` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `system_permissions` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL DEFAULT 'general',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `system_role_permissions` (
  `role_id` varchar(36) NOT NULL,
  `permission_id` varchar(36) NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `system_roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `system_permissions`(`id`) ON DELETE CASCADE
);

CREATE TABLE `user_system_roles` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `user_id` varchar(36) NOT NULL,
  `role_id` varchar(36) NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `system_roles`(`id`) ON DELETE CASCADE
);
```

### 🔄 Recommended Enhancements to Original Schema

* Ensure all UUID columns use `DEFAULT (UUID())`.
* Enforce unique constraints where necessary (e.g., plan name).
* Add indexes on common query fields (e.g., `tenant_id`, `user_id`).
* Normalize `modules` in `tenant_subscriptions` based on `plans.modules` with fallback.
* Enforce foreign key constraints for full integrity.

---

## Backend Setup (NestJS)

... (unchanged content continues here)
