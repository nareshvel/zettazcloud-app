-- Add gender column to customers table
ALTER TABLE customers
  ADD COLUMN `gender` ENUM('male', 'female', 'other') DEFAULT NULL
  AFTER birth_date;
