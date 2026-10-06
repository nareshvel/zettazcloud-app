-- Migration: Repair orders — payment fields + missing intake columns
-- Date: 2026-08-15
--
-- Adds:
--   job_type             — ring resize, stone setting, polishing, etc.
--   condition_notes      — condition at intake (scratches, missing stones …)
--   goldsmith_name       — assigned craftsperson
--   advance_payment_mode — how advance was collected
--   balance_paid         — amount collected on delivery
--   balance_paid_at      — timestamp of balance collection
--   balance_payment_mode — how balance was collected
--   payment_gateway      — e.g. 'stripe', 'razorpay' (future)
--   payment_gateway_ref  — transaction / charge ID from gateway (future)

ALTER TABLE repair_orders
  ADD COLUMN job_type              VARCHAR(100)   DEFAULT NULL                         AFTER work_required,
  ADD COLUMN condition_notes       TEXT           DEFAULT NULL                         AFTER job_type,
  ADD COLUMN goldsmith_name        VARCHAR(120)   DEFAULT NULL                         AFTER condition_notes,
  ADD COLUMN advance_payment_mode  ENUM('cash','card','upi','bank_transfer','cheque','online','other')
                                                  DEFAULT NULL                         AFTER advance_paid,
  ADD COLUMN balance_paid          DECIMAL(12,2)  DEFAULT NULL                         AFTER advance_payment_mode,
  ADD COLUMN balance_paid_at       TIMESTAMP      DEFAULT NULL                         AFTER balance_paid,
  ADD COLUMN balance_payment_mode  ENUM('cash','card','upi','bank_transfer','cheque','online','other')
                                                  DEFAULT NULL                         AFTER balance_paid_at,
  ADD COLUMN payment_gateway       VARCHAR(60)    DEFAULT NULL                         AFTER balance_payment_mode,
  ADD COLUMN payment_gateway_ref   VARCHAR(255)   DEFAULT NULL                         AFTER payment_gateway;
