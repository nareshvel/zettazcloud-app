-- Migration to remove the is_inclusive column from tax_class_rates table
-- This column is redundant with the store-level default_tax_basis setting

-- Step 1: Remove the is_inclusive column from tax_class_rates table
ALTER TABLE tax_class_rates DROP COLUMN is_inclusive;

-- Note: This is a backward-incompatible change. 
-- After running this migration, any code that references the is_inclusive field will need to be updated.
