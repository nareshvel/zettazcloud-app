-- MySQL dump 10.13  Distrib 9.3.0, for macos15.4 (arm64)
--
-- Host: mysql.us.cloudlogin.co    Database: digitpulse_zcloudep
-- ------------------------------------------------------
-- Server version	8.0.22

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `image_url` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES ('09cd8deb-225c-43d5-9b0a-5d56ad8498a0','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Fruits & Vegetables','Fresh fruits and seasonal vegetables',NULL,'2025-05-20 11:08:34','2025-05-20 11:08:34'),('30a8084c-b4e3-432a-ab8c-5fa8557bb339','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Snacks','Chips, cookies, and other snack items',NULL,'2025-05-20 09:08:21','2025-05-20 09:08:21'),('7e524fba-cb2e-431c-a6a2-9c845196c878','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Beverages','Juices, sodas, and energy drinks',NULL,'2025-05-20 11:08:34','2025-05-20 11:08:34'),('979b1b2d-e7dd-4e29-80d0-27eb7f935513','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Bakery','Freshly baked bread, pastries, and cakes',NULL,'2025-05-20 11:08:34','2025-05-20 11:08:34'),('e34033d9-029f-4f68-a0fb-3a6a451f53b8','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Meat & Seafood','Fresh meat, poultry, and seafood',NULL,'2025-05-20 11:08:34','2025-05-20 11:08:34'),('f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Dairy & Eggs','Milk, cheese, butter, and eggs',NULL,'2025-05-20 11:08:34','2025-05-20 11:08:34'),('f689ca7d-ad61-439a-a446-91a247a09423','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Pantry Staples','Rice, flour, oils, and other kitchen essentials',NULL,'2025-05-20 11:08:34','2025-05-20 11:08:34');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `held_orders`
--

DROP TABLE IF EXISTS `held_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `held_orders` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `cashier_id` char(36) NOT NULL,
  `items` json NOT NULL,
  `note` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `store_id` (`store_id`),
  KEY `cashier_id` (`cashier_id`),
  CONSTRAINT `held_orders_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `held_orders_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  CONSTRAINT `held_orders_ibfk_3` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`)
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `held_orders`
--

LOCK TABLES `held_orders` WRITE;
/*!40000 ALTER TABLE `held_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `held_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_logs`
--

DROP TABLE IF EXISTS `inventory_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_logs` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `quantity_change` int NOT NULL,
  `reason` text,
  `created_by` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `product_id` (`product_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `inventory_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_logs_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_logs_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_logs`
--

LOCK TABLES `inventory_logs` WRITE;
/*!40000 ALTER TABLE `inventory_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_methods`
--

DROP TABLE IF EXISTS `payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_methods` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name (e.g., Cash, Credit Card, UPI)',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unique code (e.g., CASH, CARD, UPI)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `requires_terminal` tinyint(1) NOT NULL DEFAULT '0',
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Icon identifier for UI',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tenant_payment_code` (`tenant_id`,`code`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Available payment methods for each tenant';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_methods`
--

LOCK TABLES `payment_methods` WRITE;
/*!40000 ALTER TABLE `payment_methods` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_methods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_terminals`
--

DROP TABLE IF EXISTS `payment_terminals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_terminals` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name for the terminal',
  `type` enum('INGENICO','VERIFONE','PAYTM','PHONEPE','CUSTOM') COLLATE utf8mb4_unicode_ci NOT NULL,
  `terminal_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Terminal ID from provider',
  `api_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API key for terminal authentication',
  `api_secret` text COLLATE utf8mb4_unicode_ci COMMENT 'Encrypted API secret',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `settings` json DEFAULT NULL COMMENT 'Terminal-specific settings',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_terminal_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment terminal configurations';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_terminals`
--

LOCK TABLES `payment_terminals` WRITE;
/*!40000 ALTER TABLE `payment_terminals` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_terminals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_transactions`
--

DROP TABLE IF EXISTS `payment_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_transactions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sale_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `terminal_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL COMMENT 'Amount in the transaction currency',
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `exchange_rate` decimal(10,6) DEFAULT '1.000000',
  `transaction_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Gateway transaction ID',
  `reference_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Merchant reference ID',
  `status` enum('PENDING','COMPLETED','FAILED','REFUNDED','PARTIALLY_REFUNDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `card_last4` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Last 4 digits of card',
  `card_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Visa, MasterCard, etc.',
  `wallet_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Name of wallet for wallet payments',
  `metadata` json DEFAULT NULL COMMENT 'Additional payment details',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Additional notes',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sale` (`sale_id`),
  KEY `idx_payment_method` (`payment_method_id`),
  KEY `idx_terminal` (`terminal_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_transaction` (`transaction_id`),
  KEY `idx_reference` (`reference_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment transactions';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_transactions`
--

LOCK TABLES `payment_transactions` WRITE;
/*!40000 ALTER TABLE `payment_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  `barcode` varchar(255) DEFAULT NULL,
  `sku` varchar(255) DEFAULT NULL,
  `category_id` char(36) DEFAULT NULL,
  `stock_quantity` int DEFAULT '0',
  `image_url` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_sku_per_tenant` (`tenant_id`,`sku`),
  UNIQUE KEY `unique_barcode_per_tenant` (`tenant_id`,`barcode`),
  KEY `idx_products_tenant` (`tenant_id`),
  KEY `idx_products_category` (`category_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `products_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES ('000330c9-15a0-40f8-afb2-33c33b222bb7','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Basmati Rice','5kg premium basmati rice.',9.99,'7890123456797-migrated-101336512762740761','PAN-RIC-001-migrated-101336512762740760','f689ca7d-ad61-439a-a446-91a247a09423',58,'https://images.pexels.com/photos/4198023/pexels-photo-4198023.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:44:57'),('00233c5c-f8b0-41da-8583-64d1746e635f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Sunflower Oil','1L refined sunflower oil.',3.10,'7890123456808-migrated-101336512762740783','PAN-OIL-002-migrated-101336512762740782','f689ca7d-ad61-439a-a446-91a247a09423',63,'https://images.pexels.com/photos/1660027/pexels-photo-1660027.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:44:57'),('0a3a5617-942e-46bf-abed-c34a74a8a6d7','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Green Tea','Box of 20 green tea bags.',2.25,'7890123456804-migrated-101336512762740775','BEV-GTE-002-migrated-101336512762740774','7e524fba-cb2e-431c-a6a2-9c845196c878',53,'https://images.pexels.com/photos/1417945/pexels-photo-1417945.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:44:57'),('0e9cf56e-14fe-410c-854a-928fd69e054f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Cheddar Cheese','Aged cheddar block, 250g.',4.10,'7890123456801-migrated-101336512762740769','DAI-CHD-002-migrated-101336512762740768','f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8',31,'https://images.pexels.com/photos/1508666/pexels-photo-1508666.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:44:57'),('14ff74f8-d700-4b7f-b118-2fb789011860','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Multigrain Bread','Whole grain sliced bread.',2.85,'7890123456802-migrated-101336512762740771','BAK-MUL-002-migrated-101336512762740770','979b1b2d-e7dd-4e29-80d0-27eb7f935513',38,'https://images.pexels.com/photos/356328/pexels-photo-356328.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:44:57'),('187b21e6-639b-42b4-8199-28e1a2e49f9c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Chocolate Muffins','Pack of 4 rich chocolate muffins.',3.75,'7890123456803-migrated-101336512762740773','BAK-MUF-002-migrated-101336512762740772','979b1b2d-e7dd-4e29-80d0-27eb7f935513',25,'https://images.pexels.com/photos/1660213/pexels-photo-1660213.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:02:21'),('22dbdb82-8f0c-424a-9be3-1c1d57969aa1','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Ground Beef','Minced beef, 500g pack.',4.80,'7890123456806-migrated-101336512762740779','MEA-GBF-002-migrated-101336512762740778','e34033d9-029f-4f68-a0fb-3a6a451f53b8',35,'https://images.pexels.com/photos/1633526/pexels-photo-1633526.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:02:21'),('3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Avocados','Ripe Hass avocados.',2.49,'8901234567891-migrated-101336512762740741','FRU-AVO-001-migrated-101336512762740740','09cd8deb-225c-43d5-9b0a-5d56ad8498a0',80,'https://images.pexels.com/photos/557659/pexels-photo-557659.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('4c98f143-cc49-4f2d-bf93-6544b33d9e19','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Chicken Breast','Boneless skinless chicken breast, 500g.',5.25,'7890123456795-migrated-101336512762740757','MEA-CHB-001-migrated-101336512762740756','e34033d9-029f-4f68-a0fb-3a6a451f53b8',40,'https://images.pexels.com/photos/65175/pexels-photo-65175.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('56c22eee-4c83-4fd1-aed5-07d3c3fba6b1','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Orange Juice','100% pure orange juice, 1L.',2.99,'7890123456793-migrated-101336512762740753','BEV-OJU-001-migrated-101336512762740752','7e524fba-cb2e-431c-a6a2-9c845196c878',70,'https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('592de762-38ed-4640-9e6c-c32fd5096790','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Greek Yogurt','Plain Greek yogurt, 500g tub.',3.25,'7890123456800-migrated-101336512762740767','DAI-YOG-002-migrated-101336512762740766','f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8',45,'https://images.pexels.com/photos/593824/pexels-photo-593824.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:02:21'),('59c5aa8d-33e1-4e3c-ad80-e5735bde8140','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Shrimp (Peeled)','Peeled shrimp, frozen, 400g.',6.50,'7890123456807-migrated-101336512762740781','MEA-SHP-002-migrated-101336512762740780','e34033d9-029f-4f68-a0fb-3a6a451f53b8',25,'https://images.pexels.com/photos/132776/pexels-photo-132776.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:02:21'),('5c08c1dc-5559-4470-8151-c026805899dd','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Cherry Tomatoes','Sweet cherry tomatoes, 250g pack.',1.25,'8901234567892-migrated-101336512762740743','FRU-TOM-001-migrated-101336512762740742','09cd8deb-225c-43d5-9b0a-5d56ad8498a0',60,'https://images.pexels.com/photos/65174/pexels-photo-65174.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('627d7c55-921a-4916-8bf9-98f1bbc4ad08','d7f267da-d5d9-4a15-b0d3-31ca710a4492','All-purpose Flour','2kg pack of wheat flour.',2.60,'7890123456809-migrated-101336512762740785','PAN-FLR-002-migrated-101336512762740784','f689ca7d-ad61-439a-a446-91a247a09423',50,'https://images.pexels.com/photos/4588041/pexels-photo-4588041.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:02:22'),('9c6458f3-20de-4d18-861c-38a24b68b309','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Sparkling Water','Lemon flavored sparkling water.',1.50,'7890123456794-migrated-101336512762740755','BEV-SPA-001-migrated-101336512762740754','7e524fba-cb2e-431c-a6a2-9c845196c878',100,'https://images.pexels.com/photos/1777983/pexels-photo-1777983.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('a3ad9984-5f79-4300-96a5-d153b8a01665','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Organic Bananas','Fresh organic bananas, sold by weight.',1.99,'8901234567890-migrated-101336512762740739','FRU-BAN-001-migrated-101336512762740738','09cd8deb-225c-43d5-9b0a-5d56ad8498a0',100,'https://images.pexels.com/photos/1093038/pexels-photo-1093038.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('a5fd86a0-7b25-457b-9473-a33de24f4e13','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Sourdough Bread','Artisan sourdough loaf.',3.75,'7890123456791-migrated-101336512762740749','BAK-BRD-001-migrated-101336512762740748','979b1b2d-e7dd-4e29-80d0-27eb7f935513',30,'https://images.pexels.com/photos/2434/bread-food-healthy-breakfast.jpg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('ad80d59c-de80-49e0-82e3-c3d528d5367c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Carrots','Crunchy organic carrots, 1kg.',1.50,'7890123456799-migrated-101336512762740765','FRU-CAR-002-migrated-101336512762740764','09cd8deb-225c-43d5-9b0a-5d56ad8498a0',90,'https://images.pexels.com/photos/65174/pexels-photo-65174.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:02:21'),('af783643-559f-4a32-848e-03da9524e85c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Cold Brew Coffee','Ready-to-drink cold brew, 350ml.',2.95,'7890123456805-migrated-101336512762740777','BEV-CBC-002-migrated-101336512762740776','7e524fba-cb2e-431c-a6a2-9c845196c878',30,'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:02:21'),('b6860c69-6d3e-456c-a25f-a4bc09bd23c4','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Baby Spinach','Washed baby spinach leaves, 200g.',1.80,'7890123456798-migrated-101336512762740763','FRU-SPN-002-migrated-101336512762740762','09cd8deb-225c-43d5-9b0a-5d56ad8498a0',75,'https://images.pexels.com/photos/4110251/pexels-photo-4110251.jpeg',1,'2025-05-20 11:14:41','2025-05-20 12:02:21'),('c0edd880-aa11-4d74-8b77-845d8798da90','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Farm Eggs','Pack of 12 organic brown eggs.',2.99,'7890123456790-migrated-101336512762740747','DAI-EGG-001-migrated-101336512762740746','f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8',100,'https://images.pexels.com/photos/5945647/pexels-photo-5945647.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('d27c07d9-fa0c-49a7-9a29-454dde45bf7f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Whole Milk','1 gallon whole milk.',3.49,'7890123456789-migrated-101336512762740745','DAI-MIL-001-migrated-101336512762740744','f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8',50,'https://images.pexels.com/photos/7788359/pexels-photo-7788359.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('ed2f4421-fca0-4827-b7c3-d814f46252c6','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Croissants','Box of 4 butter croissants.',4.50,'7890123456792-migrated-101336512762740751','BAK-CRO-001-migrated-101336512762740750','979b1b2d-e7dd-4e29-80d0-27eb7f935513',25,'https://images.pexels.com/photos/209557/pexels-photo-209557.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21'),('f4d52a04-b5d5-49dc-8aa4-d01947ee16d9','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Salmon Fillet','Atlantic salmon fillet, 250g.',6.99,'7890123456796-migrated-101336512762740759','MEA-SAL-001-migrated-101336512762740758','e34033d9-029f-4f68-a0fb-3a6a451f53b8',20,'https://images.pexels.com/photos/5945902/pexels-photo-5945902.jpeg',1,'2025-05-20 11:11:30','2025-05-20 12:02:21');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sale_items`
--

DROP TABLE IF EXISTS `sale_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sale_items` (
  `id` char(36) NOT NULL,
  `sale_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sale_items_sale` (`sale_id`),
  KEY `idx_sale_items_product` (`product_id`),
  CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sale_items`
--

LOCK TABLES `sale_items` WRITE;
/*!40000 ALTER TABLE `sale_items` DISABLE KEYS */;
INSERT INTO `sale_items` VALUES ('03b45eda-9af9-43d3-b344-10ec0f4aae53','088dc28b-4dea-4871-9227-d6a908e0c0ea','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-20 12:44:57'),('351fae13-b2fc-4136-8150-a61049eaef0e','088dc28b-4dea-4871-9227-d6a908e0c0ea','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-20 12:44:56'),('4d320e95-b580-4f03-9db4-0f4845d9d13a','088dc28b-4dea-4871-9227-d6a908e0c0ea','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-20 12:44:57'),('6bbdb51d-7380-4424-b0d5-3f2a36b1e2cb','088dc28b-4dea-4871-9227-d6a908e0c0ea','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-20 12:44:57'),('bdc96207-4381-47ad-ab34-48cd8050e5bc','088dc28b-4dea-4871-9227-d6a908e0c0ea','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-20 12:44:57');
/*!40000 ALTER TABLE `sale_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales`
--

DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `cashier_id` char(36) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `tax` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) DEFAULT '0.00',
  `total` decimal(10,2) NOT NULL,
  `payment_method` enum('cash','card','upi','wallet','online') NOT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `status` enum('completed','refunded','voided') DEFAULT 'completed',
  `payment_status` enum('PENDING','PARTIALLY_PAID','PAID','REFUNDED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sales_tenant` (`tenant_id`),
  KEY `idx_sales_store` (`store_id`),
  KEY `idx_sales_cashier` (`cashier_id`),
  KEY `idx_sales_payment_status` (`payment_status`),
  KEY `idx_sales_payment_method` (`payment_method`),
  CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_ibfk_3` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`)
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales`
--

LOCK TABLES `sales` WRITE;
/*!40000 ALTER TABLE `sales` DISABLE KEYS */;
INSERT INTO `sales` VALUES ('088dc28b-4dea-4871-9227-d6a908e0c0ea','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',22.29,2.23,0.00,24.52,'cash',NULL,'completed','PENDING','2025-05-20 12:44:56'),('4fee3e47-7781-4f25-8f78-b343802c0ad3','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',4.10,0.41,0.00,4.51,'cash',NULL,'completed','PENDING','2025-05-20 12:19:48');
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stores`
--

DROP TABLE IF EXISTS `stores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stores` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` text,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `tax_rate` decimal(5,2) DEFAULT '10.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `stores_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stores`
--

LOCK TABLES `stores` WRITE;
/*!40000 ALTER TABLE `stores` DISABLE KEYS */;
INSERT INTO `stores` VALUES ('f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Zettaz Mart','123 Main Street, Anytown, CA 12345','+1 (123) 456-7890','store@zettaz.com',10.00,'2025-05-20 09:08:21','2025-05-20 11:51:13');
/*!40000 ALTER TABLE `stores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_payment_settings`
--

DROP TABLE IF EXISTS `tenant_payment_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_payment_settings` (
  `tenant_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_currency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `allow_partial_payments` tinyint(1) NOT NULL DEFAULT '1',
  `allow_tips` tinyint(1) NOT NULL DEFAULT '0',
  `default_tip_percentage` decimal(5,2) DEFAULT '10.00',
  `receipt_settings` json DEFAULT NULL COMMENT 'Receipt template and settings',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tenant-specific payment settings';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_payment_settings`
--

LOCK TABLES `tenant_payment_settings` WRITE;
/*!40000 ALTER TABLE `tenant_payment_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `tenant_payment_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenants`
--

DROP TABLE IF EXISTS `tenants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenants` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `domain` varchar(255) DEFAULT NULL,
  `settings` json DEFAULT (_utf8mb4'{}'),
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `domain` (`domain`)
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenants`
--

LOCK TABLES `tenants` WRITE;
/*!40000 ALTER TABLE `tenants` DISABLE KEYS */;
INSERT INTO `tenants` VALUES ('d7f267da-d5d9-4a15-b0d3-31ca710a4492','Zettaz Demo Store','demo.zettaz.com','{}','2025-05-20 09:08:21','2025-05-20 09:08:21');
/*!40000 ALTER TABLE `tenants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','manager','cashier') NOT NULL,
  `store_id` char(36) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `tenant_id` (`tenant_id`),
  KEY `store_id` (`store_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Naresh','admin@zettaz.com','$2b$10$6jM7G7eHH/MVS1.4FT8GQOKgd/Yt6WClxwY9oJ9B9TO9B6H2B0H2O','admin','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c',1,'2025-05-20 09:08:21','2025-05-20 12:46:22'),('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','d7f267da-d5d9-4a15-b0d3-31ca710a4492','John','manager@zettaz.com','$2b$10$6jM7G7eHH/MVS1.4FT8GQOKgd/Yt6WClxwY9oJ9B9TO9B6H2B0H2O','manager','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c',1,'2025-05-20 09:08:21','2025-05-20 12:46:30'),('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Linda','cashier@zettaz.com','$2b$10$6jM7G7eHH/MVS1.4FT8GQOKgd/Yt6WClxwY9oJ9B9TO9B6H2B0H2O','cashier','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c',1,'2025-05-20 09:08:21','2025-05-20 12:46:35');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'digitpulse_zcloudep'
--
