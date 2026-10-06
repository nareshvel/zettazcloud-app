-- Add is_tax_exempt column to customers table
ALTER TABLE customers
ADD COLUMN is_tax_exempt TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether this customer is exempt from taxes';

-- Add comment to explain the column
ALTER TABLE customers
MODIFY COLUMN is_tax_exempt TINYINT(1) NOT NULL DEFAULT 0 
COMMENT 'Whether this customer is exempt from taxes (1=exempt, 0=not exempt)';
