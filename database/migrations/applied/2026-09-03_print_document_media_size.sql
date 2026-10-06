SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='print_document_settings' AND column_name='media_size');
SET @sql := IF(@col=0,
  'ALTER TABLE `print_document_settings` ADD COLUMN `media_size` varchar(20) DEFAULT NULL AFTER `paper_width`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `print_document_settings`
   SET `media_size` = CASE
     WHEN `document_type` = 'invoice' THEN 'a4'
     WHEN `paper_width` = 58 THEN '58mm'
     WHEN `paper_width` = 110 THEN '110mm'
     ELSE '80mm'
   END
 WHERE `media_size` IS NULL;
