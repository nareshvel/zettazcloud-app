-- Migration: Add identity fields to customers table
-- Date: 2026-08-14
-- Adds nationality, id_type, id_number for duty-free and identity capture use cases

ALTER TABLE customers
  ADD COLUMN nationality VARCHAR(100) DEFAULT NULL AFTER gender,
  ADD COLUMN id_type ENUM('passport','national_id','drivers_license','residence_permit','other') DEFAULT NULL AFTER nationality,
  ADD COLUMN id_number VARCHAR(100) DEFAULT NULL AFTER id_type;
