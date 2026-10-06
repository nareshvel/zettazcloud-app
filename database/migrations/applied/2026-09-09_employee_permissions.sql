-- Migration: Add employee management permissions to the RBAC system
-- Date: 2026-09-09
-- Scope: Adds employees.view, employees.create, employees.edit, employees.delete
--        tenant-level permissions so that employee routes can be gated by RBAC.
-- Idempotent: checks for existence before inserting.

INSERT INTO `permissions` (`id`, `name`, `description`, `module`)
SELECT uuid(), 'employees.view', 'View employees', 'employees'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'employees.view');

INSERT INTO `permissions` (`id`, `name`, `description`, `module`)
SELECT uuid(), 'employees.create', 'Create employees', 'employees'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'employees.create');

INSERT INTO `permissions` (`id`, `name`, `description`, `module`)
SELECT uuid(), 'employees.edit', 'Edit employees', 'employees'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'employees.edit');

INSERT INTO `permissions` (`id`, `name`, `description`, `module`)
SELECT uuid(), 'employees.delete', 'Delete employees', 'employees'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'employees.delete');
