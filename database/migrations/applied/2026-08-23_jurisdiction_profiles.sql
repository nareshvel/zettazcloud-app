-- =============================================================================
-- 2026-08-23 Jurisdiction profiles
-- =============================================================================
-- WHY
-- ---
-- The application is country-agnostic and also serves duty-free retailers, but
-- nothing in the schema modelled *jurisdiction*. Tax was implicitly "sales tax",
-- invoices had no mandatory-title concept, fiscalization was unrepresented, and
-- duty-free/export sales had nowhere to record passport or flight details.
--
-- Concretely, requirements differ by country in ways that are not cosmetic:
--   * Australia mandates the literal words "TAX INVOICE" as a header
--   * EU requires customer VAT numbers, sequential numbering, reverse-charge wording
--   * Canada splits GST/HST by province (place of supply)
--   * ~30 countries (AT, PT, DE, BG, IT, GR, HR, PL, much of LatAm) mandate a
--     cryptographic fiscal signature and QR code on every receipt
--   * India (BIS) mandates HUID/purity itemisation on hallmarked jewellery
--   * Drug identifiers differ: NDC (US), DIN (CA), PZN (DE), GTIN elsewhere
--
-- DESIGN
-- ------
-- Two tables, deliberately separated:
--
--   jurisdiction_profiles      A shared, tenant-agnostic CATALOG keyed by country
--                              (optionally region, for CA provinces). Adding a
--                              country benefits every tenant at once. Seeded and
--                              maintained by us, not by tenants.
--
--   store_jurisdiction_settings  Per-store BINDING and overrides: which profile
--                              applies, what sales mode the store operates in
--                              (domestic / duty_free / export), and the store's
--                              own fiscal device credentials.
--
-- Keeping the catalog separate from the binding means a tenant cannot corrupt
-- the tax rules of a whole country, and a duty-free shop in Antigua and a
-- domestic shop in Antigua can share one profile while differing in sales mode.
--
-- Note this table does NOT calculate tax. `tax_classes` / `tax_class_rates` and
-- taxCalculationService already do that well, including compound tax. This
-- supplies the surrounding jurisdictional context those calculations and the
-- print templates need.
--
-- Idempotent per repo convention.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Jurisdiction catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `jurisdiction_profiles` (
  `id`                      char(36)     NOT NULL,
  `country_code`            varchar(2)   NOT NULL COMMENT 'ISO 3166-1 alpha-2',
  `region_code`             varchar(10)  DEFAULT NULL COMMENT 'Sub-national where tax differs, e.g. CA provinces (ON, QC). NULL = country default',
  `display_name`            varchar(120) NOT NULL,

  -- Tax presentation ---------------------------------------------------------
  `tax_label`               varchar(30)  NOT NULL DEFAULT 'Tax'
                            COMMENT 'VAT | GST | HST | ABST | Sales Tax | Consumption Tax …',
  `tax_id_label`            varchar(40)  NOT NULL DEFAULT 'Tax ID'
                            COMMENT 'What the business tax number is called locally: VAT No, GSTIN, ABN, TRN …',
  `prices_include_tax`      tinyint(1)   NOT NULL DEFAULT 0
                            COMMENT 'Retail convention: EU/AU/IN display tax-inclusive, US/CA display exclusive',

  -- Invoice rules ------------------------------------------------------------
  `mandatory_invoice_title` varchar(60)  DEFAULT NULL
                            COMMENT 'Literal wording the law requires, e.g. "TAX INVOICE" in AU. NULL = free choice',
  `requires_customer_tax_id` tinyint(1)  NOT NULL DEFAULT 0
                            COMMENT 'B2B invoices must carry the buyer tax number (most of the EU)',
  `requires_sequential_numbering` tinyint(1) NOT NULL DEFAULT 0
                            COMMENT 'Gapless sequential invoice numbers (EU)',
  `supports_reverse_charge` tinyint(1)   NOT NULL DEFAULT 0
                            COMMENT '165+ VAT/GST countries permit it for cross-border B2B',
  `reverse_charge_text`     varchar(255) DEFAULT NULL
                            COMMENT 'Exact wording to print, e.g. "Reverse charge: customer to account for VAT"',

  -- Fiscalization ------------------------------------------------------------
  `fiscalization_enabled`   tinyint(1)   NOT NULL DEFAULT 0
                            COMMENT 'Country mandates signed fiscal receipts',
  `fiscalization_scheme`    varchar(40)  DEFAULT NULL
                            COMMENT 'AT_RKSV | PT_ATCUD | DE_DSFINV_K | BG_USN | IT_RT | …',
  `fiscalization_requires_qr` tinyint(1) NOT NULL DEFAULT 0,

  -- Vertical-specific regimes ------------------------------------------------
  `hallmark_regime`         varchar(20)  DEFAULT NULL
                            COMMENT 'BIS_IN where hallmark/HUID itemisation is mandated. NULL = no regime',
  `drug_identifier_label`   varchar(20)  NOT NULL DEFAULT 'Drug ID'
                            COMMENT 'NDC (US) | DIN (CA) | PZN (DE) | GTIN',

  -- Tax-free shopping --------------------------------------------------------
  `supports_tax_refund`     tinyint(1)   NOT NULL DEFAULT 0
                            COMMENT 'Traveller VAT-refund scheme exists (retailer completes a refund form)',
  `tax_refund_scheme_name`  varchar(60)  DEFAULT NULL COMMENT 'e.g. "VAT407" (UK)',

  -- Formatting ---------------------------------------------------------------
  `default_currency_code`   varchar(3)   DEFAULT NULL COMMENT 'ISO 4217 — advisory, stores.currency_code wins',
  `date_format`             varchar(20)  NOT NULL DEFAULT 'DD/MM/YYYY',
  `cash_rounding_increment` decimal(6,3) NOT NULL DEFAULT 0.000
                            COMMENT 'Smallest cash unit, e.g. 0.05 CHF/CAD nickel rounding. 0 = no rounding',

  `notes`                   varchar(500) DEFAULT NULL,
  `is_active`               tinyint(1)   NOT NULL DEFAULT 1,
  `created_at`              timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_country_region` (`country_code`, `region_code`),
  KEY `idx_country` (`country_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Shared catalog of per-country tax/invoice/fiscal rules. Not tenant-owned.';

-- ---------------------------------------------------------------------------
-- 2. Per-store binding + overrides
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_jurisdiction_settings` (
  `store_id`                char(36)     NOT NULL,
  `tenant_id`               char(36)     NOT NULL,
  `jurisdiction_profile_id` char(36)     DEFAULT NULL
                            COMMENT 'NULL = resolve by stores.country_code at read time',

  -- Sales mode ---------------------------------------------------------------
  `sales_mode`              enum('domestic','duty_free','export','mixed') NOT NULL DEFAULT 'domestic'
                            COMMENT 'duty_free/export change which blocks a receipt must carry and zero-rate the sale',
  `requires_passport`       tinyint(1)   NOT NULL DEFAULT 0
                            COMMENT 'Duty-free: passport must be captured and the name must match the purchaser',
  `requires_boarding_pass`  tinyint(1)   NOT NULL DEFAULT 0
                            COMMENT 'Duty-free: flight number / destination captured at point of sale',
  `export_declaration_text` varchar(500) DEFAULT NULL
                            COMMENT 'Printed on duty-free invoices — goods must leave the territory',

  -- Business identity --------------------------------------------------------
  `business_tax_id`         varchar(60)  DEFAULT NULL COMMENT 'This store''s own VAT/GST/ABN number',

  -- Fiscal device credentials (per store, never in the shared catalog) --------
  `fiscal_device_serial`    varchar(120) DEFAULT NULL,
  `fiscal_software_id`      varchar(120) DEFAULT NULL COMMENT 'Certified software identifier, e.g. PT AT software number',
  `fiscal_credentials`      json         DEFAULT NULL
                            COMMENT 'Vendor-specific config (fiskaly etc). Secrets belong in a secret store, not here',

  -- Numbering ----------------------------------------------------------------
  `invoice_number_prefix`   varchar(20)  DEFAULT NULL,

  `overrides`               json         DEFAULT NULL
                            COMMENT 'Sparse per-store overrides of catalog fields. Only for genuine local variance',

  `created_at`              timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`store_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_profile` (`jurisdiction_profile_id`),
  KEY `idx_sales_mode` (`tenant_id`, `sales_mode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Binds a store to a jurisdiction profile and records store-specific mode/fiscal settings.';

-- ---------------------------------------------------------------------------
-- 3. Seed the catalog
-- ---------------------------------------------------------------------------
-- INSERT IGNORE so re-running never disturbs edited rows. Deterministic UUIDs
-- (jp-<iso>-…) so seeds are referenceable and idempotent across environments.
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO `jurisdiction_profiles`
  (`id`, `country_code`, `region_code`, `display_name`,
   `tax_label`, `tax_id_label`, `prices_include_tax`,
   `mandatory_invoice_title`, `requires_customer_tax_id`, `requires_sequential_numbering`,
   `supports_reverse_charge`, `reverse_charge_text`,
   `fiscalization_enabled`, `fiscalization_scheme`, `fiscalization_requires_qr`,
   `hallmark_regime`, `drug_identifier_label`,
   `supports_tax_refund`, `tax_refund_scheme_name`,
   `default_currency_code`, `date_format`, `cash_rounding_increment`, `notes`)
VALUES

  -- Antigua & Barbuda — Diamond Republic's home market -----------------------
  ('jp-ag-000000-0000-0000-000000000001', 'AG', NULL, 'Antigua and Barbuda',
   'ABST', 'ABST No.', 0,
   NULL, 0, 0,
   0, NULL,
   0, NULL, 0,
   NULL, 'Drug ID',
   0, NULL,
   'XCD', 'DD/MM/YYYY', 0.000,
   'ABST standard rate 15%. No fiscalization mandate. Duty-free retail common in St. John''s cruise port — set sales_mode on the store, not here.'),

  -- United States ------------------------------------------------------------
  ('jp-us-000000-0000-0000-000000000001', 'US', NULL, 'United States',
   'Sales Tax', 'Tax ID', 0,
   NULL, 0, 0,
   0, NULL,
   0, NULL, 0,
   NULL, 'NDC',
   0, NULL,
   'USD', 'MM/DD/YYYY', 0.000,
   'Sales tax varies by state/county/city — model actual rates in tax_classes. Groceries commonly exempt while prepared food is taxable, hence the per-line tax flag on receipts.'),

  -- United Kingdom -----------------------------------------------------------
  ('jp-gb-000000-0000-0000-000000000001', 'GB', NULL, 'United Kingdom',
   'VAT', 'VAT No.', 1,
   NULL, 1, 1,
   1, 'Reverse charge: customer to account for VAT',
   0, NULL, 0,
   NULL, 'Drug ID',
   1, 'VAT407',
   'GBP', 'DD/MM/YYYY', 0.000,
   'Retailer completes the refund form with goods description, price, admin charge and refund due, and marks the till receipt to show goods were included.'),

  -- European Union (generic baseline) ----------------------------------------
  ('jp-eu-000000-0000-0000-000000000001', 'EU', NULL, 'European Union (generic)',
   'VAT', 'VAT No.', 1,
   NULL, 1, 1,
   1, 'Reverse charge: customer to account for VAT',
   0, NULL, 0,
   NULL, 'Drug ID',
   1, NULL,
   'EUR', 'DD/MM/YYYY', 0.000,
   'Baseline for member states without a dedicated profile. Sequential gapless numbering and buyer VAT number are required for B2B. Override per country where fiscalization applies.'),

  -- Portugal — ATCUD + QR + certified software -------------------------------
  ('jp-pt-000000-0000-0000-000000000001', 'PT', NULL, 'Portugal',
   'IVA', 'NIF', 1,
   NULL, 1, 1,
   1, 'Autoliquidação / Reverse charge: customer to account for VAT',
   1, 'PT_ATCUD', 1,
   NULL, 'Drug ID',
   1, NULL,
   'EUR', 'DD/MM/YYYY', 0.000,
   'Invoicing software must be AT-certified. Every invoice carries a QR code and ATCUD identifier, with SAF-T (PT) reported monthly. Requires a certified signing vendor — do not implement in-house.'),

  -- Austria — Signaturpflicht -------------------------------------------------
  ('jp-at-000000-0000-0000-000000000001', 'AT', NULL, 'Austria',
   'USt', 'UID', 1,
   NULL, 1, 1,
   1, 'Reverse Charge: Steuerschuldnerschaft des Leistungsempfängers',
   1, 'AT_RKSV', 1,
   NULL, 'PZN',
   1, NULL,
   'EUR', 'DD.MM.YYYY', 0.000,
   'Signaturpflicht (§131b BAO): receipts digitally signed by a secure signature creation device so tampering is detectable.'),

  -- Germany — DsFinV-K --------------------------------------------------------
  ('jp-de-000000-0000-0000-000000000001', 'DE', NULL, 'Germany',
   'MwSt', 'USt-IdNr.', 1,
   NULL, 1, 1,
   1, 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)',
   1, 'DE_DSFINV_K', 0,
   NULL, 'PZN',
   1, NULL,
   'EUR', 'DD.MM.YYYY', 0.000,
   'DsFinV-K defines receipt elements, payment types and export formats. Every business-relevant transaction must be signed and stored (TSE).'),

  -- India — GST + BIS hallmarking --------------------------------------------
  ('jp-in-000000-0000-0000-000000000001', 'IN', NULL, 'India',
   'GST', 'GSTIN', 1,
   'TAX INVOICE', 1, 1,
   1, 'Reverse charge applicable — recipient liable to pay GST',
   0, NULL, 0,
   'BIS_IN', 'Drug ID',
   0, NULL,
   'INR', 'DD/MM/YYYY', 0.000,
   'Hallmarked jewellery invoices must itemise separately: article description, net precious-metal weight, purity in carat AND fineness, and hallmarking charges (levied per article regardless of weight). Hallmark = BIS logo + purity + 6-digit alphanumeric HUID.'),

  -- United Arab Emirates ------------------------------------------------------
  ('jp-ae-000000-0000-0000-000000000001', 'AE', NULL, 'United Arab Emirates',
   'VAT', 'TRN', 1,
   'TAX INVOICE', 1, 1,
   1, 'Reverse charge: recipient to account for VAT',
   0, NULL, 0,
   NULL, 'Drug ID',
   1, NULL,
   'AED', 'DD/MM/YYYY', 0.000,
   'VAT 5%. Tourist refund scheme operates at airports. Large duty-free retail sector.'),

  -- Australia -----------------------------------------------------------------
  ('jp-au-000000-0000-0000-000000000001', 'AU', NULL, 'Australia',
   'GST', 'ABN', 1,
   'TAX INVOICE', 1, 0,
   1, 'Reverse charge: recipient to account for GST',
   0, NULL, 0,
   NULL, 'Drug ID',
   1, 'TRS',
   'AUD', 'DD/MM/YYYY', 0.050,
   'The words "TAX INVOICE" are mandatory on compliant invoices. GST 10%. 1c/2c coins withdrawn so cash totals round to 5c.'),

  -- Canada — federal default --------------------------------------------------
  ('jp-ca-000000-0000-0000-000000000001', 'CA', NULL, 'Canada (GST only)',
   'GST', 'GST/HST No.', 0,
   NULL, 1, 0,
   1, 'Reverse charge: recipient to self-assess',
   0, NULL, 0,
   NULL, 'DIN',
   0, NULL,
   'CAD', 'YYYY-MM-DD', 0.050,
   'GST 5% where no HST applies (AB, and territories). Penny withdrawn — cash rounds to 5c. Province-specific rows below.'),

  -- Canada — Ontario (HST) ----------------------------------------------------
  ('jp-ca-on0000-0000-0000-000000000001', 'CA', 'ON', 'Canada — Ontario (HST)',
   'HST', 'GST/HST No.', 0,
   NULL, 1, 0,
   1, 'Reverse charge: recipient to self-assess',
   0, NULL, 0,
   NULL, 'DIN',
   0, NULL,
   'CAD', 'YYYY-MM-DD', 0.050,
   'HST 13%. Tax depends on place of supply (province), not seller location.'),

  -- Canada — Quebec (GST + QST, compound) -------------------------------------
  ('jp-ca-qc0000-0000-0000-000000000001', 'CA', 'QC', 'Canada — Quebec (GST + QST)',
   'GST + QST', 'GST/QST No.', 0,
   NULL, 1, 0,
   1, 'Reverse charge: recipient to self-assess',
   0, NULL, 0,
   NULL, 'DIN',
   0, NULL,
   'CAD', 'YYYY-MM-DD', 0.050,
   'GST 5% plus QST 9.975%. Model QST as a compound rate in tax_class_rates (is_compound = 1).'),

  -- Singapore ------------------------------------------------------------------
  ('jp-sg-000000-0000-0000-000000000001', 'SG', NULL, 'Singapore',
   'GST', 'GST Reg. No.', 1,
   'TAX INVOICE', 1, 1,
   1, 'Reverse charge: recipient to account for GST',
   0, NULL, 0,
   NULL, 'Drug ID',
   1, 'eTRS',
   'SGD', 'DD/MM/YYYY', 0.000,
   'Major duty-free/transit retail hub. Electronic Tourist Refund Scheme (eTRS).');

-- ---------------------------------------------------------------------------
-- 4. Backfill: bind existing stores to a profile by country_code
-- ---------------------------------------------------------------------------
-- Only stores that do not already have a row. Region-less (country default)
-- profiles only — province-level binding is a deliberate manual choice.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `store_jurisdiction_settings`
  (`store_id`, `tenant_id`, `jurisdiction_profile_id`, `sales_mode`)
SELECT
  s.`id`,
  s.`tenant_id`,
  jp.`id`,
  'domestic'
FROM `stores` s
LEFT JOIN `jurisdiction_profiles` jp
       ON jp.`country_code` = s.`country_code`
      AND jp.`region_code` IS NULL
WHERE s.`country_code` IS NOT NULL;

-- =============================================================================
-- Verification
-- =============================================================================
-- SELECT country_code, region_code, display_name, tax_label, fiscalization_scheme
--   FROM jurisdiction_profiles ORDER BY country_code, region_code;
--
-- Stores still unbound (country_code missing or unseeded country):
-- SELECT s.id, s.name, s.country_code
--   FROM stores s
--   LEFT JOIN store_jurisdiction_settings sjs ON sjs.store_id = s.id
--  WHERE sjs.store_id IS NULL;
-- =============================================================================
