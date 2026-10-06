-- Seed: add "Souvenir & Gifts" as a supported industry vertical
-- Idempotent: INSERT IGNORE relies on the existing unique keys
--   (industry_types.code, and industry_field_definitions'
--   uniq_industry_entity_field on (industry_code, applies_to, field_key)).
-- Follows the exact pattern established in
-- database/seeds/applied/2026-08-08_industry_field_definitions_seed.sql —
-- run via `npm run migrate:seeds`, same as that file was.

INSERT IGNORE INTO `industry_types` (`code`,`name`,`description`,`sort_order`) VALUES
  ('souvenir_gifts','Souvenir & Gifts','Tourist souvenirs, gift items, and novelty merchandise',70);

-- ------------------------- SOUVENIR & GIFTS -------------------------
-- Chosen to mirror what a souvenir/gift shop actually tracks day-to-day:
-- what kind of item it is, what it's themed/branded around, whether it's
-- personalizable (common upsell), fragility (affects handling/packaging at
-- checkout), and country/region of origin (a common shopper question and a
-- frequent legal/labeling requirement for tourist goods).
INSERT IGNORE INTO `industry_field_definitions`
 (`id`,`industry_code`,`applies_to`,`field_key`,`label`,`data_type`,`options_json`,`unit`,`is_required`,`is_searchable`,`show_on_receipt`,`sort_order`) VALUES
 (UUID(),'souvenir_gifts','product','item_type','Item Type','select', JSON_ARRAY('Keychain','Magnet','Mug','T-Shirt','Postcard','Figurine','Plush Toy','Ornament','Jewelry/Accessory','Home Decor','Stationery','Other'), NULL,0,1,1,10),
 (UUID(),'souvenir_gifts','product','theme','Theme/Collection','text',NULL,NULL,0,1,1,20),
 (UUID(),'souvenir_gifts','product','material','Material','text',NULL,NULL,0,0,0,30),
 (UUID(),'souvenir_gifts','product','origin_country','Made In','text',NULL,NULL,0,1,0,40),
 (UUID(),'souvenir_gifts','product','is_personalizable','Personalizable','boolean',NULL,NULL,0,0,1,50),
 (UUID(),'souvenir_gifts','product','is_fragile','Fragile','boolean',NULL,NULL,0,0,1,60),
 (UUID(),'souvenir_gifts','product','occasion','Occasion','select', JSON_ARRAY('General','Birthday','Wedding','Holiday/Seasonal','Anniversary','Souvenir/Travel'), NULL,0,1,0,70);
