-- Migration: Jewelry industry field definitions update
-- Date: 2026-08-14
-- Purpose:
--   1. Add new jewelry fields: product_type, metal_colour, wastage_pct,
--      number_of_stones, stone_quality, stone_certification, design_no
--   2. Update metal_type options (remove White Gold/Rose Gold; add Titanium, Stainless Steel, Brass)
--   3. Update purity options to a comprehensive all-metal list (frontend filters dynamically)
--   4. Update stone_type to select with common stone options
--   5. Update certificate_no to show on receipt (relevant for GIA/IGI certified pieces)
--   6. Update sort orders to accommodate new fields
-- Idempotent: uses INSERT IGNORE for new rows, UPDATE for existing rows.

-- ---------------------------------------------------------------------------
-- UPDATE existing jewelry fields
-- ---------------------------------------------------------------------------

-- metal_type: expand list, remove colour variants (moved to metal_colour field)
UPDATE `industry_field_definitions`
SET
  `options_json` = '["Gold","Silver","Platinum","Palladium","Titanium","Stainless Steel","Brass"]',
  `sort_order`   = 10
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'metal_type';

-- purity: expand to all-metal comprehensive list; frontend will filter by metal
UPDATE `industry_field_definitions`
SET
  `options_json` = '["24K (999)","23K (958)","22K (916)","21K (875)","20K (833)","18K (750)","14K (585)","10K (417)","9K (375)","999 Fine Silver","925 Sterling Silver","900 Coin Silver","800 Silver","Pt 950","Pt 900","Pt 850","Pd 950","Pd 500"]',
  `sort_order`   = 20
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'purity';

-- gross_weight: no change to options; bump sort to 30 (already 30)
UPDATE `industry_field_definitions`
SET `sort_order` = 30
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'gross_weight';

-- net_weight: sort 40 (already 40)
UPDATE `industry_field_definitions`
SET `sort_order` = 40
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'net_weight';

-- stone_type: convert to select with common stone options, sort 50
UPDATE `industry_field_definitions`
SET
  `data_type`    = 'select',
  `options_json` = '["No Stone","Diamond","Ruby","Emerald","Sapphire","Pearl","Opal","Topaz","Amethyst","Coral","Garnet","Other"]',
  `sort_order`   = 55
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'stone_type';

-- stone_weight: sort 65
UPDATE `industry_field_definitions`
SET `sort_order` = 65
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'stone_weight';

-- stone_value: sort 75
UPDATE `industry_field_definitions`
SET `sort_order` = 75
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'stone_value';

-- making_charge: sort 85
UPDATE `industry_field_definitions`
SET `sort_order` = 85
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'making_charge';

-- hallmark_huid: sort 90
UPDATE `industry_field_definitions`
SET `sort_order` = 90
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'hallmark_huid';

-- certificate_no: show on receipt (important for certified diamond pieces)
UPDATE `industry_field_definitions`
SET
  `show_on_receipt` = 1,
  `sort_order`      = 100
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'certificate_no';

-- hsn_code: sort 120
UPDATE `industry_field_definitions`
SET `sort_order` = 120
WHERE `industry_code` = 'jewelry'
  AND `applies_to`    = 'product'
  AND `field_key`     = 'hsn_code';

-- ---------------------------------------------------------------------------
-- INSERT new jewelry fields (INSERT IGNORE is idempotent)
-- ---------------------------------------------------------------------------

-- product_type: Piece category — Ring, Necklace, etc. (sort 5, searchable, on receipt)
INSERT IGNORE INTO `industry_field_definitions`
  (`id`, `industry_code`, `applies_to`, `field_key`, `label`, `data_type`, `options_json`, `unit`, `is_required`, `is_searchable`, `show_on_receipt`, `sort_order`, `is_active`)
VALUES
  (UUID(), 'jewelry', 'product', 'product_type', 'Piece Type', 'select',
   '["Ring","Necklace","Pendant","Earrings","Bracelet","Bangle","Chain","Anklet","Brooch","Mangalsutra","Haar","Jhumka","Other"]',
   NULL, 0, 1, 1, 5, 1);

-- metal_colour: Yellow/White/Rose — relevant mainly for Gold (frontend shows only when metal=Gold)
INSERT IGNORE INTO `industry_field_definitions`
  (`id`, `industry_code`, `applies_to`, `field_key`, `label`, `data_type`, `options_json`, `unit`, `is_required`, `is_searchable`, `show_on_receipt`, `sort_order`, `is_active`)
VALUES
  (UUID(), 'jewelry', 'product', 'metal_colour', 'Metal Colour', 'select',
   '["Yellow","White","Rose / Pink","Two-Tone","Tri-Colour"]',
   NULL, 0, 1, 1, 15, 1);

-- wastage_pct: Wastage percentage for gold weight calculation (sort 45, internal/no receipt)
INSERT IGNORE INTO `industry_field_definitions`
  (`id`, `industry_code`, `applies_to`, `field_key`, `label`, `data_type`, `options_json`, `unit`, `is_required`, `is_searchable`, `show_on_receipt`, `sort_order`, `is_active`)
VALUES
  (UUID(), 'jewelry', 'product', 'wastage_pct', 'Wastage %', 'decimal',
   NULL, '%', 0, 0, 0, 45, 1);

-- number_of_stones: count of stones (sort 60)
INSERT IGNORE INTO `industry_field_definitions`
  (`id`, `industry_code`, `applies_to`, `field_key`, `label`, `data_type`, `options_json`, `unit`, `is_required`, `is_searchable`, `show_on_receipt`, `sort_order`, `is_active`)
VALUES
  (UUID(), 'jewelry', 'product', 'number_of_stones', 'No. of Stones', 'number',
   NULL, NULL, 0, 0, 1, 60, 1);

-- stone_quality: free text for diamond grading (e.g. "VVS1/G/EX") (sort 70)
INSERT IGNORE INTO `industry_field_definitions`
  (`id`, `industry_code`, `applies_to`, `field_key`, `label`, `data_type`, `options_json`, `unit`, `is_required`, `is_searchable`, `show_on_receipt`, `sort_order`, `is_active`)
VALUES
  (UUID(), 'jewelry', 'product', 'stone_quality', 'Stone Quality', 'text',
   NULL, NULL, 0, 0, 0, 70, 1);

-- design_no: internal design/style reference code (sort 95)
INSERT IGNORE INTO `industry_field_definitions`
  (`id`, `industry_code`, `applies_to`, `field_key`, `label`, `data_type`, `options_json`, `unit`, `is_required`, `is_searchable`, `show_on_receipt`, `sort_order`, `is_active`)
VALUES
  (UUID(), 'jewelry', 'product', 'design_no', 'Design No.', 'text',
   NULL, NULL, 0, 1, 0, 95, 1);

-- stone_certification: lab/authority that issued the certificate (sort 105)
INSERT IGNORE INTO `industry_field_definitions`
  (`id`, `industry_code`, `applies_to`, `field_key`, `label`, `data_type`, `options_json`, `unit`, `is_required`, `is_searchable`, `show_on_receipt`, `sort_order`, `is_active`)
VALUES
  (UUID(), 'jewelry', 'product', 'stone_certification', 'Certification Body', 'select',
   '["None","GIA","IGI","HRD","SGL","BIS","Other"]',
   NULL, 0, 0, 0, 105, 1);
