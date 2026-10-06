-- Add new fields to customers table
ALTER TABLE `customers`
  ADD COLUMN `birth_date` DATE NULL DEFAULT NULL AFTER `last_name`,
  ADD COLUMN `website` VARCHAR(255) NULL DEFAULT NULL AFTER `email`,
  ADD COLUMN `preferred_communication` VARCHAR(20) NULL DEFAULT NULL AFTER `phone_number`,
  ADD COLUMN `preferred_payment_method` VARCHAR(50) NULL DEFAULT NULL AFTER `default_discount_value`,
  ADD COLUMN `referral_source` VARCHAR(100) NULL DEFAULT NULL AFTER `notes`;

-- Add comments for new fields
ALTER TABLE `customers`
  MODIFY COLUMN `birth_date` DATE NULL DEFAULT NULL COMMENT 'Customer date of birth for birthday promotions',
  MODIFY COLUMN `website` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Business website URL',
  MODIFY COLUMN `preferred_communication` VARCHAR(20) NULL DEFAULT NULL COMMENT 'Preferred contact method (email, phone, sms, mail)',
  MODIFY COLUMN `preferred_payment_method` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Default payment method for this customer',
  MODIFY COLUMN `referral_source` VARCHAR(100) NULL DEFAULT NULL COMMENT 'How the customer found the business';
