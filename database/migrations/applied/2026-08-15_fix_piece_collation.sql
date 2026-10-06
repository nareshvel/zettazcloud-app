-- =============================================================================
-- 2026-08-15 Fix collation on product_pieces + product_piece_sequences
-- =============================================================================
-- The initial migration ran with utf8mb4_unicode_ci; the rest of the schema
-- uses utf8mb4_0900_ai_ci (MySQL 8 default). JOINs between the two cause:
--   "Illegal mix of collations … for operation '='"
-- This converts both tables to the correct collation.
-- CONVERT TO CHARACTER SET re-collates every text/char/varchar column at once.
-- =============================================================================

ALTER TABLE `product_piece_sequences`
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `product_pieces`
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
