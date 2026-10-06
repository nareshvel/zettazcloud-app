-- Seed: industry types + default product field definitions
-- Idempotent: INSERT IGNORE relies on the unique keys.
-- Fields are stored per product inside products.attributes (JSON) keyed by field_key.

-- ------------------------- industry types -------------------------
INSERT IGNORE INTO `industry_types` (`code`,`name`,`description`,`sort_order`) VALUES
  ('general_retail','General Retail','Default catalogue for general merchandise',10),
  ('jewelry','Jewelry & Bullion','Gold/silver/diamond jewelry retail',20),
  ('apparel','Apparel & Fashion','Clothing and footwear with size/colour variants',30),
  ('electronics','Electronics','Devices with serial/IMEI/warranty tracking',40),
  ('grocery','Grocery & Supermarket','FMCG with batch and expiry tracking',50),
  ('pharmacy','Pharmacy','Medicines with batch, expiry and schedule tracking',60);

-- Helper pattern: INSERT IGNORE ... VALUES (UUID(), 'industry', 'product', 'field_key', ...)

-- ------------------------- JEWELRY --------------------------------
INSERT IGNORE INTO `industry_field_definitions`
 (`id`,`industry_code`,`applies_to`,`field_key`,`label`,`data_type`,`options_json`,`unit`,`is_required`,`is_searchable`,`show_on_receipt`,`sort_order`) VALUES
 (UUID(),'jewelry','product','metal_type','Metal','select', JSON_ARRAY('Gold','Silver','Platinum','Palladium','White Gold','Rose Gold'), NULL,1,1,1,10),
 (UUID(),'jewelry','product','purity','Purity','select', JSON_ARRAY('24K','22K','18K','14K','9K','925 Silver','950 Platinum'), NULL,1,1,1,20),
 (UUID(),'jewelry','product','gross_weight','Gross Weight','decimal',NULL,'g',0,0,1,30),
 (UUID(),'jewelry','product','net_weight','Net Weight','decimal',NULL,'g',0,0,1,40),
 (UUID(),'jewelry','product','stone_type','Stone Type','text',NULL,NULL,0,1,1,50),
 (UUID(),'jewelry','product','stone_weight','Stone Weight','decimal',NULL,'ct',0,0,1,60),
 (UUID(),'jewelry','product','stone_value','Stone Value','decimal',NULL,NULL,0,0,0,70),
 (UUID(),'jewelry','product','making_charge','Making Charge','decimal',NULL,NULL,0,0,1,80),
 (UUID(),'jewelry','product','hallmark_huid','Hallmark / HUID','text',NULL,NULL,0,1,1,90),
 (UUID(),'jewelry','product','certificate_no','Certificate No','text',NULL,NULL,0,1,0,100),
 (UUID(),'jewelry','product','hsn_code','HSN Code','text',NULL,NULL,0,0,0,110);

-- ------------------------- APPAREL --------------------------------
INSERT IGNORE INTO `industry_field_definitions`
 (`id`,`industry_code`,`applies_to`,`field_key`,`label`,`data_type`,`options_json`,`unit`,`is_required`,`is_searchable`,`show_on_receipt`,`sort_order`) VALUES
 (UUID(),'apparel','product','size','Size','select', JSON_ARRAY('XS','S','M','L','XL','XXL','3XL'), NULL,0,1,1,10),
 (UUID(),'apparel','product','color','Colour','text',NULL,NULL,0,1,1,20),
 (UUID(),'apparel','product','brand','Brand','text',NULL,NULL,0,1,0,30),
 (UUID(),'apparel','product','material','Material','text',NULL,NULL,0,0,0,40),
 (UUID(),'apparel','product','gender','Gender','select', JSON_ARRAY('Men','Women','Unisex','Kids'), NULL,0,1,0,50),
 (UUID(),'apparel','product','season','Season','text',NULL,NULL,0,0,0,60);

-- ------------------------- ELECTRONICS ----------------------------
INSERT IGNORE INTO `industry_field_definitions`
 (`id`,`industry_code`,`applies_to`,`field_key`,`label`,`data_type`,`options_json`,`unit`,`is_required`,`is_searchable`,`show_on_receipt`,`sort_order`) VALUES
 (UUID(),'electronics','product','brand','Brand','text',NULL,NULL,0,1,0,10),
 (UUID(),'electronics','product','model','Model','text',NULL,NULL,0,1,1,20),
 (UUID(),'electronics','product','serial_number','Serial Number','text',NULL,NULL,0,1,1,30),
 (UUID(),'electronics','product','imei','IMEI','text',NULL,NULL,0,1,1,40),
 (UUID(),'electronics','product','warranty_months','Warranty','number',NULL,'months',0,0,1,50),
 (UUID(),'electronics','product','color','Colour','text',NULL,NULL,0,0,0,60);

-- ------------------------- GROCERY --------------------------------
INSERT IGNORE INTO `industry_field_definitions`
 (`id`,`industry_code`,`applies_to`,`field_key`,`label`,`data_type`,`options_json`,`unit`,`is_required`,`is_searchable`,`show_on_receipt`,`sort_order`) VALUES
 (UUID(),'grocery','product','batch_no','Batch No','text',NULL,NULL,0,1,0,10),
 (UUID(),'grocery','product','expiry_date','Expiry Date','date',NULL,NULL,0,1,1,20),
 (UUID(),'grocery','product','mfg_date','Mfg Date','date',NULL,NULL,0,0,0,30),
 (UUID(),'grocery','product','unit','Unit','select', JSON_ARRAY('pc','kg','g','L','ml','pack'), NULL,0,0,1,40),
 (UUID(),'grocery','product','pack_size','Pack Size','text',NULL,NULL,0,0,1,50),
 (UUID(),'grocery','product','rack_location','Rack/Shelf','text',NULL,NULL,0,0,0,60);

-- ------------------------- PHARMACY -------------------------------
INSERT IGNORE INTO `industry_field_definitions`
 (`id`,`industry_code`,`applies_to`,`field_key`,`label`,`data_type`,`options_json`,`unit`,`is_required`,`is_searchable`,`show_on_receipt`,`sort_order`) VALUES
 (UUID(),'pharmacy','product','batch_no','Batch No','text',NULL,NULL,1,1,1,10),
 (UUID(),'pharmacy','product','expiry_date','Expiry Date','date',NULL,NULL,1,1,1,20),
 (UUID(),'pharmacy','product','mfg_date','Mfg Date','date',NULL,NULL,0,0,0,30),
 (UUID(),'pharmacy','product','drug_schedule','Drug Schedule','select', JSON_ARRAY('OTC','H','H1','X','G'), NULL,0,1,0,40),
 (UUID(),'pharmacy','product','prescription_required','Prescription Required','boolean',NULL,NULL,0,0,1,50),
 (UUID(),'pharmacy','product','manufacturer','Manufacturer','text',NULL,NULL,0,1,0,60),
 (UUID(),'pharmacy','product','composition','Composition','textarea',NULL,NULL,0,0,0,70);

-- ------------------------- GENERAL RETAIL -------------------------
INSERT IGNORE INTO `industry_field_definitions`
 (`id`,`industry_code`,`applies_to`,`field_key`,`label`,`data_type`,`options_json`,`unit`,`is_required`,`is_searchable`,`show_on_receipt`,`sort_order`) VALUES
 (UUID(),'general_retail','product','brand','Brand','text',NULL,NULL,0,1,0,10),
 (UUID(),'general_retail','product','unit','Unit','select', JSON_ARRAY('pc','kg','g','L','ml','pack','box'), NULL,0,0,0,20),
 (UUID(),'general_retail','product','warranty_months','Warranty','number',NULL,'months',0,0,0,30);
