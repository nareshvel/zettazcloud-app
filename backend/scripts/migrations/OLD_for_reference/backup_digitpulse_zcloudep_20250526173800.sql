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
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` char(36) DEFAULT NULL,
  `updated_by_user_id` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_category_name_per_tenant` (`tenant_id`,`name`),
  KEY `fk_categories_created_by` (`created_by_user_id`),
  KEY `fk_categories_updated_by` (`updated_by_user_id`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_categories_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_categories_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES ('07700005-4225-41e3-b13f-728bfda68dfd','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Appliances & Electronics','Appliances & Electronics','/uploads/categories/image-1748173493681-28922198.webp',0,'2025-05-25 09:25:15','2025-05-25 13:45:15','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('09cd8deb-225c-43d5-9b0a-5d56ad8498a0','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Fruits & Vegetables','Fresh fruits and seasonal vegetables',NULL,1,'2025-05-20 11:08:34','2025-05-25 08:49:00','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('274e7df8-0670-4f11-86a9-768d2c144337','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Personal Care','Personal Care Products like hair, body, etc..',NULL,1,'2025-05-25 09:44:33','2025-05-25 09:44:33','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('2c2c5815-5f0a-48fc-b85a-54386f7e81b7','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Gadgets',NULL,NULL,1,'2025-05-24 22:46:16','2025-05-25 08:49:00','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('30a8084c-b4e3-432a-ab8c-5fa8557bb339','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Snacks','Chips, cookies, and other snack items',NULL,1,'2025-05-20 09:08:21','2025-05-25 08:49:00','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('3ff8552b-2b1c-438c-abd3-6231f9195b00','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Jewelry','Timeless Solitaire Engagement Ring','/uploads/categories/image-1748239172736-35512361.png',1,'2025-05-26 05:59:32','2025-05-26 05:59:32','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('7e524fba-cb2e-431c-a6a2-9c845196c878','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Beverages','Juices, sodas, and energy drinks','d7f267da-d5d9-4a15-b0d3-31ca710a4492/categories/image-1748261988655-359601026.jpg',1,'2025-05-20 11:08:34','2025-05-26 12:19:48','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('979b1b2d-e7dd-4e29-80d0-27eb7f935513','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Bakery','Freshly baked bread, pastries, and cakes','d7f267da-d5d9-4a15-b0d3-31ca710a4492/categories/image-1748262025296-701716745.jpg',1,'2025-05-20 11:08:34','2025-05-26 12:20:25','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('a52d3611-6578-4868-88fe-f704249603d3','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Deli',NULL,NULL,1,'2025-05-25 08:52:06','2025-05-25 08:52:06','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('c56855f9-54e8-4986-b515-00d34cd632c6','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Hair Care','Hair care products','/uploads/categories/image-1748172518145-259409736.webp',1,'2025-05-25 11:28:38','2025-05-25 11:28:38','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('e34033d9-029f-4f68-a0fb-3a6a451f53b8','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Meat & Seafood','Fresh meat, poultry, and seafood','/uploads/categories/image-1748175306198-148539196.webp',1,'2025-05-20 11:08:34','2025-05-25 12:15:06','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Dairy & Eggs','Milk, cheese, butter, and eggs',NULL,1,'2025-05-20 11:08:34','2025-05-25 08:49:00','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('f689ca7d-ad61-439a-a446-91a247a09423','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Pantry Staples','Rice, flour, oils, and other kitchen essentials',NULL,0,'2025-05-20 11:08:34','2025-05-25 10:20:42','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),('ff56c4d9-39f3-4ca5-bb62-1db552fd8aa4','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Nail Care','Nail Care','/uploads/categories/image-1748172911058-277038600.jpg',1,'2025-05-25 11:35:11','2025-05-25 11:35:11','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `countries`
--

DROP TABLE IF EXISTS `countries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `countries` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ISO 3166-1 alpha-2 code',
  `code3` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ISO 3166-1 alpha-3 code',
  `phone_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Country calling code',
  `currency_code` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ISO 4217 currency code',
  `flag_emoji` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Flag emoji unicode',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_countries_code` (`code`),
  KEY `idx_countries_name` (`name`),
  KEY `idx_countries_code3` (`code3`),
  KEY `idx_countries_is_active` (`is_active`),
  KEY `idx_countries_sort_order` (`sort_order`)
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `countries`
--

LOCK TABLES `countries` WRITE;
/*!40000 ALTER TABLE `countries` DISABLE KEYS */;
INSERT INTO `countries` VALUES ('342c752d-3832-11f0-8297-525400148990','United States','US','USA','1','USD','🇺🇸',1,1,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c782a-3832-11f0-8297-525400148990','Canada','CA','CAN','1','CAD','🇨🇦',1,2,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c7b3e-3832-11f0-8297-525400148990','Mexico','MX','MEX','52','MXN','🇲🇽',1,3,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c7c37-3832-11f0-8297-525400148990','United Kingdom','GB','GBR','44','GBP','🇬🇧',1,4,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c7cfd-3832-11f0-8297-525400148990','Australia','AU','AUS','61','AUD','🇦🇺',1,5,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c7dc1-3832-11f0-8297-525400148990','Germany','DE','DEU','49','EUR','🇩🇪',1,6,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c7ee6-3832-11f0-8297-525400148990','France','FR','FRA','33','EUR','🇫🇷',1,7,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c7f9c-3832-11f0-8297-525400148990','Japan','JP','JPN','81','JPY','🇯🇵',1,8,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8070-3832-11f0-8297-525400148990','China','CN','CHN','86','CNY','🇨🇳',1,9,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8131-3832-11f0-8297-525400148990','India','IN','IND','91','INR','🇮🇳',1,10,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8216-3832-11f0-8297-525400148990','Brazil','BR','BRA','55','BRL','🇧🇷',1,11,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8540-3832-11f0-8297-525400148990','Russia','RU','RUS','7','RUB','🇷🇺',1,12,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8622-3832-11f0-8297-525400148990','Italy','IT','ITA','39','EUR','🇮🇹',1,13,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c86b6-3832-11f0-8297-525400148990','Spain','ES','ESP','34','EUR','🇪🇸',1,14,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c875e-3832-11f0-8297-525400148990','Netherlands','NL','NLD','31','EUR','🇳🇱',1,15,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c895d-3832-11f0-8297-525400148990','Sweden','SE','SWE','46','SEK','🇸🇪',1,16,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8a08-3832-11f0-8297-525400148990','Norway','NO','NOR','47','NOK','🇳🇴',1,17,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8aaf-3832-11f0-8297-525400148990','Denmark','DK','DNK','45','DKK','🇩🇰',1,18,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8b4e-3832-11f0-8297-525400148990','Finland','FI','FIN','358','EUR','🇫🇮',1,19,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8bf0-3832-11f0-8297-525400148990','Switzerland','CH','CHE','41','CHF','🇨🇭',1,20,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8c8a-3832-11f0-8297-525400148990','Austria','AT','AUT','43','EUR','🇦🇹',1,21,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8d27-3832-11f0-8297-525400148990','Belgium','BE','BEL','32','EUR','🇧🇪',1,22,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8dbd-3832-11f0-8297-525400148990','Ireland','IE','IRL','353','EUR','🇮🇪',1,23,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8e46-3832-11f0-8297-525400148990','Portugal','PT','PRT','351','EUR','🇵🇹',1,24,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8eae-3832-11f0-8297-525400148990','Greece','GR','GRC','30','EUR','🇬🇷',1,25,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8f15-3832-11f0-8297-525400148990','South Africa','ZA','ZAF','27','ZAR','🇿🇦',1,26,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8f7a-3832-11f0-8297-525400148990','New Zealand','NZ','NZL','64','NZD','🇳🇿',1,27,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c8fde-3832-11f0-8297-525400148990','Singapore','SG','SGP','65','SGD','🇸🇬',1,28,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9043-3832-11f0-8297-525400148990','South Korea','KR','KOR','82','KRW','🇰🇷',1,29,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c90a7-3832-11f0-8297-525400148990','Indonesia','ID','IDN','62','IDR','🇮🇩',1,30,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c910c-3832-11f0-8297-525400148990','Malaysia','MY','MYS','60','MYR','🇲🇾',1,31,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c916e-3832-11f0-8297-525400148990','Philippines','PH','PHL','63','PHP','🇵🇭',1,32,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9349-3832-11f0-8297-525400148990','Thailand','TH','THA','66','THB','🇹🇭',1,33,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9553-3832-11f0-8297-525400148990','Vietnam','VN','VNM','84','VND','🇻🇳',1,34,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9662-3832-11f0-8297-525400148990','Argentina','AR','ARG','54','ARS','🇦🇷',1,35,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9802-3832-11f0-8297-525400148990','Chile','CL','CHL','56','CLP','🇨🇱',1,36,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c98f0-3832-11f0-8297-525400148990','Colombia','CO','COL','57','COP','🇨🇴',1,37,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c99a3-3832-11f0-8297-525400148990','Peru','PE','PER','51','PEN','🇵🇪',1,38,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9b78-3832-11f0-8297-525400148990','Venezuela','VE','VEN','58','VES','🇻🇪',1,39,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9c76-3832-11f0-8297-525400148990','Egypt','EG','EGY','20','EGP','🇪🇬',1,40,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9e00-3832-11f0-8297-525400148990','Nigeria','NG','NGA','234','NGN','🇳🇬',1,41,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9f15-3832-11f0-8297-525400148990','Kenya','KE','KEN','254','KES','🇰🇪',1,42,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342c9fd3-3832-11f0-8297-525400148990','Ghana','GH','GHA','233','GHS','🇬🇭',1,43,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342ca143-3832-11f0-8297-525400148990','Morocco','MA','MAR','212','MAD','🇲🇦',1,44,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342ca1e5-3832-11f0-8297-525400148990','Saudi Arabia','SA','SAU','966','SAR','🇸🇦',1,45,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342ca2a0-3832-11f0-8297-525400148990','United Arab Emirates','AE','ARE','971','AED','🇦🇪',1,46,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342ca356-3832-11f0-8297-525400148990','Israel','IL','ISR','972','ILS','🇮🇱',1,47,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342ca3fb-3832-11f0-8297-525400148990','Turkey','TR','TUR','90','TRY','🇹🇷',1,48,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342ca495-3832-11f0-8297-525400148990','Poland','PL','POL','48','PLN','🇵🇱',1,49,'2025-05-24 00:01:12','2025-05-24 00:01:12'),('342ca4fc-3832-11f0-8297-525400148990','Ukraine','UA','UKR','380','UAH','🇺🇦',1,50,'2025-05-24 00:01:12','2025-05-24 00:01:12');
/*!40000 ALTER TABLE `countries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_activity_log`
--

DROP TABLE IF EXISTS `customer_activity_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_activity_log` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activity_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_activity_customer_id` (`customer_id`)
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_activity_log`
--

LOCK TABLES `customer_activity_log` WRITE;
/*!40000 ALTER TABLE `customer_activity_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_activity_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_contacts`
--

DROP TABLE IF EXISTS `customer_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_contacts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  `position` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customer_contacts_customer_id` (`customer_id`)
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_contacts`
--

LOCK TABLES `customer_contacts` WRITE;
/*!40000 ALTER TABLE `customer_contacts` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_contacts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone_number` varchar(30) DEFAULT NULL,
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state_province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `country_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Reference to countries table',
  `customer_type` varchar(50) DEFAULT 'INDIVIDUAL',
  `loyalty_id` varchar(50) DEFAULT NULL,
  `tax_id_number` varchar(50) DEFAULT NULL,
  `notes` text,
  `credit_limit` decimal(12,2) NOT NULL DEFAULT '0.00',
  `outstanding_credit` decimal(12,2) NOT NULL DEFAULT '0.00',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` varchar(36) DEFAULT NULL,
  `updated_by_user_id` varchar(36) DEFAULT NULL,
  `default_discount_type` enum('percentage','fixed') DEFAULT NULL,
  `default_discount_value` decimal(10,2) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `preferred_communication` varchar(50) DEFAULT NULL,
  `preferred_payment_method` varchar(255) DEFAULT NULL,
  `referral_source` varchar(255) DEFAULT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `currency_code` varchar(3) DEFAULT NULL,
  `portal_status` enum('enabled','disabled') DEFAULT 'disabled',
  `portal_language` varchar(10) DEFAULT 'en',
  PRIMARY KEY (`id`),
  KEY `fk_customers_store` (`store_id`),
  KEY `fk_customers_created_by` (`created_by_user_id`),
  KEY `fk_customers_updated_by` (`updated_by_user_id`),
  KEY `idx_customers_tenant_id` (`tenant_id`),
  KEY `idx_customers_email` (`tenant_id`,`email`),
  KEY `idx_customers_phone_number` (`tenant_id`,`phone_number`),
  KEY `idx_customers_loyalty_id` (`tenant_id`,`loyalty_id`),
  KEY `idx_customers_is_active` (`is_active`),
  KEY `idx_customers_country_id` (`country_id`),
  CONSTRAINT `fk_customers_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customers_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_customers_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES ('0528f5f8-3628-11f0-8297-525400148990','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Walk-In Customer',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,0.00,0.00,1,'2025-05-21 09:43:16','2025-05-21 09:43:16',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('083e0734-5aed-42e3-b978-c5a3d524c9e4','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Samuel','Bailey','sam@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,0.00,0.00,1,'2025-04-22 06:23:49','2025-05-24 00:59:41','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','fixed',10.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('19c25cfa-02e8-4cdd-ba32-d488c9e18b39','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Sivakumar','Thangarasu','siva@gmail.com','2143162116',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,0.00,0.00,1,'2025-04-22 06:23:49','2025-05-24 00:59:41','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('37eeebc2-83d0-469a-95d8-0ffebc67e579','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Bhanu','Teja',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,0.00,0.00,1,'2025-04-22 06:23:49','2025-05-24 00:59:41','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('503e4102-68a7-46e0-a4c9-e798b344ca7b','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Naresh','Velusamy','naresh@digitpulse.com','3149287001',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,800.00,88.02,1,'2025-05-21 10:20:16','2025-05-26 00:59:22','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','fixed',5.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('566ea385-aadc-41cd-bfda-1b3fb8bb4edf','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Ron','Schofield','ron@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,1200.00,50.95,1,'2025-05-21 11:51:57','2025-05-25 23:21:52','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('5f9d994d-7aa3-4f0d-b30e-f4264eed54e3','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Daniel','Craig','dani@dani.com','12367783344',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'RETAIL',NULL,NULL,NULL,0.00,0.00,1,'2025-05-24 00:54:36','2025-05-24 00:54:36','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL,NULL,NULL,'email',NULL,'search',NULL,NULL,'disabled','en'),('76d870d4-06c3-4646-bf4b-e6d9f9dad94a','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Sunil','Mathew','sunil@live.com','+919730355777','Manalmettu Thottam','K. Keeranur','Dindigul','Tamilnadu','624616',NULL,NULL,'WHOLESALE',NULL,NULL,'whole sale customer',100.00,0.00,1,'2025-05-24 00:57:54','2025-05-24 00:57:54','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','percentage',10.00,'2004-02-21',NULL,'email','cash','Friend/Family',NULL,NULL,'disabled','en'),('7acc70a5-8372-425f-a28c-adb7c239457e','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Donald','Bailey',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,0.00,0.00,1,'2025-05-21 10:40:05','2025-05-22 06:23:58','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','percentage',50.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('984744d1-4fad-413f-bace-60eede30e314','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Jody','Meyer','jody@meyer.com','','','','','','','',NULL,'INDIVIDUAL','','','',0.00,0.00,1,'2025-05-25 14:11:12','2025-05-25 14:11:35','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'',NULL,'disabled','en'),('a7520069-1ce5-43a7-8980-2471d5b1eb41','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Ravi','Kithai','ravi@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,0.00,0.00,1,'2025-05-22 19:13:21','2025-05-22 19:13:21','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('ac5d853a-6e91-4275-ad94-1c3601e40892','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Donald','Trump','donald@trump.com','12224643000','Main Street','Suite 01','New York','NY','43002','United States',NULL,'INDIVIDUAL','2342343','523423423','My Notes for Trump',2000.00,0.00,1,'2025-05-23 23:40:44','2025-05-25 23:21:52','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','percentage',10.00,'1957-01-02','https://trump.com','email',NULL,'Friend/Family',NULL,NULL,'disabled','en'),('ec16e637-fdd8-4594-b7a7-31495b9ab95f','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Gaston','Browne','gason@gastonbrowne.com','+12684645001','Prime Ministers Office','Queen Elizabeth Highway','Saint Johns','Saint John','00000','Antigua & Barbuda',NULL,'BUSINESS','100200125',NULL,'Potential Client',1000.00,15.82,1,'2025-05-23 22:55:00','2025-05-25 23:21:52','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','percentage',20.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('ecf5b65f-e11f-4dcb-91df-cc5f90697c30','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Pushpalatha','Thangarasu','pushpalatha.thanga@gmail.com','2143162116',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,500.00,21.74,1,'2025-05-21 10:34:10','2025-05-26 10:38:50','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','percentage',50.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en'),('f14d11c7-cd67-460a-8bff-2beea3980f85','d7f267da-d5d9-4a15-b0d3-31ca710a4492',NULL,'Chinna','Thambi','thambi@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'INDIVIDUAL',NULL,NULL,NULL,0.00,0.00,1,'2025-05-21 12:21:32','2025-05-21 12:21:32','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'disabled','en');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
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
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Available payment methods for each tenant';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_methods`
--

LOCK TABLES `payment_methods` WRITE;
/*!40000 ALTER TABLE `payment_methods` DISABLE KEYS */;
INSERT INTO `payment_methods` VALUES ('00000000-0000-0000-0000-000000000000','d7f267da-d5d9-4a15-b0d3-31ca710a4492','No Payment Required','',1,0,'check-circle',99,'2025-05-22 16:25:35','2025-05-22 16:25:35'),('e9ca7524-35f4-11f0-8297-525400148990','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Cash','CASH',1,0,'currency',1,'2025-05-21 03:37:25','2025-05-22 22:09:49'),('e9ca75b4-35f4-11f0-8297-525400148990','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Charge','ON_ACCOUNT',1,1,'Person',4,'2025-05-21 03:37:25','2025-05-22 16:03:44'),('e9ca7670-35f4-11f0-8297-525400148990','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Card','CARD',1,1,'credit-card',2,'2025-05-21 03:37:25','2025-05-21 08:42:46'),('e9ca76b3-35f4-11f0-8297-525400148990','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Phone','PHONE',1,1,'mobile',3,'2025-05-21 03:37:25','2025-05-21 08:43:21');
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
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment terminal configurations';
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
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment transactions';
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
  `store_id` char(36) DEFAULT NULL COMMENT 'FK to stores.id, if product is store-specific',
  `name` varchar(255) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL COMMENT 'Cost price of the product',
  `barcode` varchar(255) DEFAULT NULL,
  `sku` varchar(255) DEFAULT NULL,
  `category_id` char(36) DEFAULT NULL,
  `stock_quantity` int DEFAULT '0',
  `low_stock_threshold` int DEFAULT NULL COMMENT 'Threshold for low stock warning',
  `image_url` text,
  `tax_class_id` char(36) DEFAULT NULL COMMENT 'FK to tax_classes.id. Determines the tax rules for this product. NULL means use store default tax class.',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` char(36) DEFAULT NULL COMMENT 'FK to users.id, user who created the product',
  `updated_by_user_id` char(36) DEFAULT NULL COMMENT 'FK to users.id, user who last updated the product',
  `specific_discount_type` enum('percentage','fixed') DEFAULT NULL COMMENT 'Type of product-specific discount.',
  `specific_discount_value` decimal(10,2) DEFAULT NULL COMMENT 'Value for product-specific discount (amount for fixed, percentage for percentage).',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_sku_per_tenant` (`tenant_id`,`sku`),
  UNIQUE KEY `unique_barcode_per_tenant` (`tenant_id`,`barcode`),
  KEY `idx_products_tenant` (`tenant_id`),
  KEY `idx_products_category` (`category_id`),
  KEY `fk_products_tax_class` (`tax_class_id`),
  KEY `idx_products_store` (`store_id`),
  CONSTRAINT `fk_products_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_tax_class` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `products_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES ('','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Timeless Solitaire Engagement Ring','Timeless Solitaire Engagement Ring',585.00,400.00,NULL,NULL,'3ff8552b-2b1c-438c-abd3-6231f9195b00',12,12,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748271406883-269326272.png',NULL,1,'2025-05-26 14:56:47','2025-05-26 15:12:01','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('000330c9-15a0-40f8-afb2-33c33b222bb7','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Basmati Rice 15lbs','5kg premium basmati rice.',9.99,6.99,'7890123456797-migrated-101336512762740761','PAN-RIC-001-migrated-101336512762740760','f689ca7d-ad61-439a-a446-91a247a09423',20,22,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748157000039_Authentic-Royal-Royal-Basmati-Rice-15-Pound-Bag.webp',NULL,1,'2025-01-01 00:00:00','2025-05-26 11:41:31','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('00233c5c-f8b0-41da-8583-64d1746e635f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Sunflower Oil','1L refined sunflower oil.',3.10,2.17,'7890123456808-migrated-101336512762740783','PAN-OIL-002-migrated-101336512762740782','f689ca7d-ad61-439a-a446-91a247a09423',58,23,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163596382_sunflower_oil.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 09:54:43','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('056250b8-90d2-41e8-b9c7-1a866658ee7f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Samsung S24 Ultra','Samsung S24 Ultra',749.00,700.00,NULL,NULL,'2c2c5815-5f0a-48fc-b85a-54386f7e81b7',10,5,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748154755605_Samsung_24_ultra.webp',NULL,1,'2025-05-25 06:32:35','2025-05-25 06:32:35','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('0a3a5617-942e-46bf-abed-c34a74a8a6d7','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Green Tea','Box of 20 green tea bags.',2.25,1.58,'7890123456804-migrated-101336512762740775','BEV-GTE-002-migrated-101336512762740774','7e524fba-cb2e-431c-a6a2-9c845196c878',48,19,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161705424_green_tea.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:28:25','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('0e9cf56e-14fe-410c-854a-928fd69e054f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Cheddar Cheese','Aged cheddar block, 250g.',4.10,2.87,'7890123456801-migrated-101336512762740769','DAI-CHD-002-migrated-101336512762740768','f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8',100,5,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159637041_cheddar_cheese.webp',NULL,1,'2025-01-01 00:00:00','2025-05-26 00:54:41','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('14ff74f8-d700-4b7f-b118-2fb789011860','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Multigrain Bread','Whole grain sliced bread.',2.85,2.00,'7890123456802-migrated-101336512762740771','BAK-MUL-002-migrated-101336512762740770','979b1b2d-e7dd-4e29-80d0-27eb7f935513',46,18,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159339081_pan-bread.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 07:48:59','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('187b21e6-639b-42b4-8199-28e1a2e49f9c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Chocolate Muffins','Pack of 4 rich chocolate muffins.',3.75,2.63,'7890123456803-migrated-101336512762740773','BAK-MUF-002-migrated-101336512762740772','979b1b2d-e7dd-4e29-80d0-27eb7f935513',26,11,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161393928_Chocolate-Muffins-1.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:23:14','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('22dbdb82-8f0c-424a-9be3-1c1d57969aa1','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Goat meat','Minced goat meat, 500g pack.',4.80,3.36,'7890123456806-migrated-101336512762740779','MEA-GBF-002-migrated-101336512762740778','e34033d9-029f-4f68-a0fb-3a6a451f53b8',32,13,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161829475_goat_meat.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:30:29','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Avocados','Ripe Hass avocados and Fresh',2.49,1.74,'','FRU-AVO-001-migrated-101336512762740740','c56855f9-54e8-4986-b515-00d34cd632c6',99,28,'/images/products/product-1785b4f3-5260-4d25-a01f-11bcc83d3b13-1748086457647.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 13:45:23','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('3dcedd3f-0c34-44f5-b8da-08e372b219cf','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Nathara Contour','Nathara Contour Engagement Ring for special women',1475.00,1200.00,'1231431431','1224322342','3ff8552b-2b1c-438c-abd3-6231f9195b00',20,8,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748272194929-324524273.png',NULL,1,'2025-05-26 15:09:55','2025-05-26 16:03:48','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('4c98f143-cc49-4f2d-bf93-6544b33d9e19','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Chicken Breast','Boneless skinless chicken breast, 500g.',5.25,3.68,'7890123456795-migrated-101336512762740757','MEA-CHB-001-migrated-101336512762740756','e34033d9-029f-4f68-a0fb-3a6a451f53b8',43,18,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159405092_chicken_breast.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 07:50:05','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('56b60d92-35a1-4b1d-9be0-514779568b40','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Bread Pan','',2.35,0.00,NULL,NULL,'979b1b2d-e7dd-4e29-80d0-27eb7f935513',100,100,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160313360_bread_pan.webp',NULL,1,'2025-05-23 08:29:28','2025-05-26 15:11:13','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('56c22eee-4c83-4fd1-aed5-07d3c3fba6b1','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Orange Juice','100% pure orange juice, 1L.',2.99,2.09,'7890123456793-migrated-101336512762740753','BEV-OJU-001-migrated-101336512762740752','7e524fba-cb2e-431c-a6a2-9c845196c878',74,30,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159551657_Orange_juice_-_Simply_orange.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 07:52:31','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('592de762-38ed-4640-9e6c-c32fd5096790','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Greek Yogurt (Vanilla)','Plain Greek yogurt, 500g tub.',3.25,2.28,'7890123456800-migrated-101336512762740767','DAI-YOG-002-migrated-101336512762740766','f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8',45,18,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161775112_greek_yogurt_vanilla.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:29:35','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','iPhone 14Pro','iPhone 14Pro Silver color',799.00,749.00,NULL,NULL,'2c2c5815-5f0a-48fc-b85a-54386f7e81b7',30,5,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160407103_iphone14-iphone14pro-4.webp',NULL,1,'2025-05-25 06:27:35','2025-05-25 23:45:55','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('59c5aa8d-33e1-4e3c-ad80-e5735bde8140','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Shrimp (Peeled)','Peeled shrimp, frozen, 400g.',6.50,4.55,'7890123456807-migrated-101336512762740781','MEA-SHP-002-migrated-101336512762740780','e34033d9-029f-4f68-a0fb-3a6a451f53b8',25,10,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163528703_shrimp-peeled.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:58:48','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('5c08c1dc-5559-4470-8151-c026805899dd','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Cherry Tomatoes','Sweet cherry tomatoes, 250g pack.',1.25,0.88,'8901234567892-migrated-101336512762740743','FRU-TOM-001-migrated-101336512762740742','09cd8deb-225c-43d5-9b0a-5d56ad8498a0',56,24,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159682544_chery_tomattos.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 07:54:42','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('627d7c55-921a-4916-8bf9-98f1bbc4ad08','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Indian Meal','Mixed with pure spice from india',15.00,1.82,'7890123456809-migrated-101336512762740785','PAN-FLR-002-migrated-101336512762740784','a52d3611-6578-4868-88fe-f704249603d3',99,100,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163138234_indian_meal.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:52:18','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('9c6458f3-20de-4d18-861c-38a24b68b309','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Sparkling Water','Flavored sparkling water with great quality',1.50,1.05,'7890123456794-migrated-101336512762740755','BEV-SPA-001-migrated-101336512762740754','7e524fba-cb2e-431c-a6a2-9c845196c878',100,40,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748175012748_sparkling_water.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 12:10:12','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('a0cff669-2621-4b55-aaac-88e81474710a','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Parle-G 10 pack of 100g','Parle-G 10 pack of 100g',10.00,7.00,NULL,NULL,'30a8084c-b4e3-432a-ab8c-5fa8557bb339',30,50,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163362103_parle_g.webp',NULL,1,'2025-05-23 08:06:42','2025-05-26 15:11:33','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('a3ad9984-5f79-4300-96a5-d153b8a01665','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Organic Bananas','Fresh organic bananas, sold by weight.',1.99,1.39,'8901234567890-migrated-101336512762740739','FRU-BAN-001-migrated-101336512762740738','09cd8deb-225c-43d5-9b0a-5d56ad8498a0',92,37,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163291017_organic_bananas.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:54:51','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('a5fd86a0-7b25-457b-9473-a33de24f4e13','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Sourdough Bread','Artisan sourdough loaf.',3.75,2.63,'7890123456791-migrated-101336512762740749','BAK-BRD-001-migrated-101336512762740748','979b1b2d-e7dd-4e29-80d0-27eb7f935513',30,12,'/uploads/default_product.png',NULL,1,'2025-01-01 00:00:00','2025-05-25 12:08:35','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e',NULL,NULL),('a95dbb16-3ac2-48c8-a9b0-5a6e6656c884','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Samsung A19 Tab','Samsung A19 Tab',163.00,140.00,NULL,NULL,'2c2c5815-5f0a-48fc-b85a-54386f7e81b7',29,2,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160241621_Samsung_A19_Tab.webp',NULL,1,'2025-05-25 08:04:01','2025-05-26 10:37:12','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('ad80d59c-de80-49e0-82e3-c3d528d5367c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Carrots','Crunchy organic carrots, 1kg.',1.50,1.05,'7890123456799-migrated-101336512762740765','FRU-CAR-002-migrated-101336512762740764','09cd8deb-225c-43d5-9b0a-5d56ad8498a0',100,32,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159594321_carrots.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 23:45:55','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('af783643-559f-4a32-848e-03da9524e85c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Cold Brew Coffee','Ready-to-drink cold brew, 350ml.',2.95,2.07,'7890123456805-migrated-101336512762740777','BEV-CBC-002-migrated-101336512762740776','7e524fba-cb2e-431c-a6a2-9c845196c878',25,10,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159457408_cold_brew_coffee.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 07:50:57','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('b193d1a1-94f6-405a-b13f-15a1d594f403','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Bread - Americano','',3.85,0.00,NULL,NULL,'979b1b2d-e7dd-4e29-80d0-27eb7f935513',20,40,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159356742_bread.webp',NULL,1,'2025-05-23 08:27:19','2025-05-26 15:11:51','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('b6860c69-6d3e-456c-a25f-a4bc09bd23c4','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Baby Spinach','Washed baby spinach leaves, 200g.',1.80,1.26,'7890123456798-migrated-101336512762740763','FRU-SPN-002-migrated-101336512762740762','09cd8deb-225c-43d5-9b0a-5d56ad8498a0',100,29,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748156885365_baby_spinach.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 23:45:55','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('b82e1887-40f9-4475-b277-ef45e093bf56','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Garnier Whole Blends Honey Treasures','Garnier Whole Blends Honey Treasures',7.80,7.00,'123123123','12312312141','274e7df8-0670-4f11-86a9-768d2c144337',44,30,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748279956157-948328307.webp',NULL,1,'2025-05-25 09:45:28','2025-05-26 17:19:16','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('b89be53e-f6b7-4005-9f32-9e890325c658','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','iPhone 15 ProPlus','iPhone 15 ProPlus Space Gray',899.00,849.00,NULL,NULL,'2c2c5815-5f0a-48fc-b85a-54386f7e81b7',-1,5,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160384922_Apple-iPhone-15-Pro-lineup-color-lineup-230912_big.jpg.large.webp',NULL,1,'2025-05-25 06:24:30','2025-05-26 12:30:36','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('bcfc8606-b170-42a4-83ed-f1c74f2f8c61','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Dove Pink Soap ','dove soap',5.00,2.00,NULL,NULL,'979b1b2d-e7dd-4e29-80d0-27eb7f935513',30,10,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748261926588-364199522.webp',NULL,1,'2025-05-25 09:53:04','2025-05-26 15:11:13','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('c0edd880-aa11-4d74-8b77-845d8798da90','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Farm Eggs','Pack of 12 organic brown eggs.',2.99,2.09,'7890123456790-migrated-101336512762740747','DAI-EGG-001-migrated-101336512762740746','f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8',99,40,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161499916_egg.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:25:00','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('c4d1fe2b-c711-494c-93d1-e0932962a61e','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','iPhone 16Pro Mac256GB','iPhone 16Pro Max 256GB',999.00,0.00,NULL,NULL,'2c2c5815-5f0a-48fc-b85a-54386f7e81b7',12,10,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160351522_iphone16promax.webp',NULL,1,'2025-05-25 06:18:32','2025-05-25 08:05:51','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('ce16c080-7f4b-49a4-ad4b-c84c53a2aa79','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Pepsi 300ml (24pack)','Pepsi 300ml (24pack)',1245.00,10.00,NULL,NULL,'7e524fba-cb2e-431c-a6a2-9c845196c878',50,12,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163427332_pepsi_24_can.webp',NULL,1,'2025-05-23 08:01:37','2025-05-26 15:11:33','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('d27c07d9-fa0c-49a7-9a29-454dde45bf7f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Whole Milk','1 gallon whole milk.',3.49,2.44,'7890123456789-migrated-101336512762740745','DAI-MIL-001-migrated-101336512762740744','f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8',48,19,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163560596_whole_milk.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:59:20','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('db11baa7-4d6c-4b88-b8e5-45cf40a1a8d8','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Lemon Bag','Lemon Bag',1.00,0.00,NULL,NULL,'09cd8deb-225c-43d5-9b0a-5d56ad8498a0',20,50,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159300264_lemon.webp',NULL,1,'2025-05-23 08:12:43','2025-05-26 15:11:33','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('e03dc952-7f98-421d-924b-4f819abe666e','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Coca Cola','',5.00,3.00,NULL,NULL,'7e524fba-cb2e-431c-a6a2-9c845196c878',100,50,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161443842_soft-drink-coke-2.webp',NULL,1,'2025-05-23 06:51:43','2025-05-26 15:11:13','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('ed2f4421-fca0-4827-b7c3-d814f46252c6','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Croissants','Box of 4 butter croissants.',4.50,3.15,'7890123456792-migrated-101336512762740751','BAK-CRO-001-migrated-101336512762740750','979b1b2d-e7dd-4e29-80d0-27eb7f935513',23,9,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163230614_20croissants_blend_74949-delifrance.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:53:50','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL),('f4d52a04-b5d5-49dc-8aa4-d01947ee16d9','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','Salmon Fillet','Atlantic salmon fillet, 250g.',6.99,4.89,'7890123456796-migrated-101336512762740759','MEA-SAL-001-migrated-101336512762740758','e34033d9-029f-4f68-a0fb-3a6a451f53b8',20,8,'/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163465353_salmon_filet_pack.webp',NULL,1,'2025-01-01 00:00:00','2025-05-25 08:57:45','b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',NULL,NULL);
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
INSERT INTO `sale_items` VALUES ('00846539-665b-4e83-9ea1-dd6aef2fc43e','a1bdaff0-fa53-4fb9-84be-ecc792104091','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 12:20:18'),('00ebaa07-85e2-46ca-b683-753c4cb3488c','75dbad64-c638-4c48-b33d-956bb29dc284','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 21:40:27'),('01c14a18-39ba-44f4-b7fc-8d294f0a7d34','622d2c66-957f-4cea-b86a-a96e0317b689','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 05:15:15'),('02218f5a-ea44-4136-856f-5ee6bda7cce4','cab72c77-0c99-4c84-88d6-978e43f6d8b0','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 10:21:41'),('02aaa3c6-5f42-4a84-a163-857d11ca0ec1','89abe8fd-7d71-4e40-a275-9f60164215ea','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-22 05:37:45'),('035ae5a6-f766-49f6-8fd7-835e5d2b0294','33da33e3-6f97-42a6-aa13-0232c5c84887','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-22 17:57:47'),('03b45eda-9af9-43d3-b344-10ec0f4aae53','088dc28b-4dea-4871-9227-d6a908e0c0ea','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-20 12:44:57'),('03b878c0-1ac8-405f-a470-d2da6b7b6efe','5b594d33-dcdb-4b62-a71a-a08fb01500b7','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 11:25:31'),('046ce561-78b7-419d-8162-23700fed2ddb','c170a67c-2808-4ffa-ab76-a667eb62cc27','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 11:55:23'),('05479c78-05ab-41eb-8270-4f52b9a16a56','8b1db9a1-2d80-4106-83e1-10c231953e2c','187b21e6-639b-42b4-8199-28e1a2e49f9c',1,3.75,'2025-05-21 09:28:45'),('05e864f3-dec9-4340-b632-db933900cbe3','3e761ec1-d72f-43b8-8b0f-fdf7d344fa24','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 05:04:31'),('064f0d8c-f517-468a-b305-34ca03fd8001','0f1b6715-262a-4c40-9134-86c6016f589f','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 04:11:25'),('06ca97d8-e320-468a-994c-cc066e203a27','3e52bc21-34c6-49e4-b15e-af23f4f63e31','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-21 09:26:27'),('070709f7-c67e-4e2d-98ba-d0154c7cc4e0','9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-21 12:05:29'),('079cf4bb-4ea6-48fa-a1ad-124f5d881006','ee07c583-f4c1-4fe8-9805-b12b57cdd5fd','ed2f4421-fca0-4827-b7c3-d814f46252c6',1,4.50,'2025-05-22 17:35:33'),('0abcf4fc-6223-4f55-a2cb-ab2263c14ac6','265cfdab-8094-4e5f-a794-37deb69fb0ee','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 11:50:49'),('0e124e74-d005-49ad-8a4d-f70143f8be47','bba0eff6-fb3d-43e3-941a-9b6c2f375617','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 09:25:13'),('0ee98822-dc00-447b-96c6-951b64fb0456','e9208b05-33ce-4cd9-9197-f167d869e8d4','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 19:26:40'),('0f35240c-240f-4b18-9f6d-6648754b88f6','9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c','4c98f143-cc49-4f2d-bf93-6544b33d9e19',1,5.25,'2025-05-21 12:05:29'),('0f5e3f4f-1408-41b5-9c2e-9b6cd886014a','33b58c5e-e0b3-4899-b35d-aa41fad917d2','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 05:07:40'),('0faa753b-895a-4523-b040-710760d6afa9','9fecb2c9-99be-4911-b3bc-4ada6df83694','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 12:17:12'),('0fc94f96-110e-4f8b-87d3-4f2c276376c9','ffe373a2-b9a8-45e3-8757-8ec47f40f6ab','ad80d59c-de80-49e0-82e3-c3d528d5367c',1,1.50,'2025-05-23 01:47:32'),('12293d66-a4c3-4cec-8ce9-c49dba8a1a2a','5c15b8bd-f29c-433c-9003-c54bacfa7ec4','af783643-559f-4a32-848e-03da9524e85c',1,2.95,'2025-05-23 02:04:42'),('12537764-f238-43a4-9735-56d2951fe23b','0040f320-8ede-439c-9a42-036c454d996c','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-26 00:59:22'),('13a242ba-23a3-44e4-b667-0adf512352b3','0436db07-7abb-41e8-a9a0-a4e7028eb992','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 10:45:54'),('158b71ac-b449-4565-af87-5c28d0d70809','6ae9312a-febc-4109-bfab-62466b0f5787','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-25 23:37:20'),('15cc74b7-efd3-436c-ab74-849681d605a9','722a03b4-32b9-4bc1-b6e4-f793a0825239','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 19:25:41'),('17425760-dda2-4f6e-a7b5-387b68119b89','9fecb2c9-99be-4911-b3bc-4ada6df83694','4c98f143-cc49-4f2d-bf93-6544b33d9e19',1,5.25,'2025-05-21 12:17:12'),('17ff5c8d-27b5-4c51-b26f-7945fde99aaa','76eb82fe-36cc-499d-88c3-e52ee5cced9d','af783643-559f-4a32-848e-03da9524e85c',1,2.95,'2025-05-22 21:51:12'),('185cd6c8-1055-434d-9329-a65dfd3bd9f2','e14bbb18-dbe3-4641-b739-661f1a0de630','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-25 23:32:22'),('198ec937-9fe8-4b17-93da-bd32dfabbd90','e8a5a9d0-b7df-4b8f-8040-abe21b26011d','187b21e6-639b-42b4-8199-28e1a2e49f9c',1,3.75,'2025-05-22 20:18:44'),('1b721fcc-15b4-4462-a0db-c7f406fb8371','55a91e70-3811-4d6c-a57c-5be5417d9158','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-22 17:35:24'),('1c358b7f-bbaa-494c-a4d5-273eda87a58f','5b5507a5-19a5-4dfc-9b82-6c53332ba2f3','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-22 20:20:33'),('1c49bfa9-7c19-446b-9401-e66ec653bb9b','febad102-c9f8-4d81-ae17-6d773f28c402','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-21 12:54:51'),('1caa5ed3-7266-42fd-a97d-ac9675d3ee47','3a5ab606-6417-4ac6-a97c-339eab8b6df2','22dbdb82-8f0c-424a-9be3-1c1d57969aa1',1,4.80,'2025-05-21 05:10:12'),('1db352d5-c734-4156-819b-0a4125c8559d','ae3f93ad-d00e-40c0-a666-f33e7816ec7f','4c98f143-cc49-4f2d-bf93-6544b33d9e19',2,5.25,'2025-05-21 11:52:23'),('1e798011-18f7-4179-a8d7-7254b66a41e2','c19baf5f-0db6-44a0-8fb3-86f58340815e','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',1,1.80,'2025-05-22 19:24:32'),('1f5c1492-6abb-4b96-ad22-cfb4fe1113d5','9fecb2c9-99be-4911-b3bc-4ada6df83694','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-21 12:17:12'),('2236e28f-b968-4ca9-bb8a-8c2806fe7080','e9208b05-33ce-4cd9-9197-f167d869e8d4','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 19:26:40'),('22998a13-71e7-4703-99ae-c0809206703a','fe533d3a-4992-4a23-9111-b37af05e8426','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-22 17:55:23'),('24dbd49a-5db8-4de7-889b-e35d26517c25','36f7f59b-f2d3-4bf5-9ae4-c45e821ae5ac','a95dbb16-3ac2-48c8-a9b0-5a6e6656c884',1,163.00,'2025-05-26 10:29:31'),('25f52879-5c0d-4179-ae58-3e4792f69697','e6defc7a-8d1a-4dc7-a815-23aaf893a4ab','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 19:33:41'),('28074a5c-2f20-428e-b979-97aa159d5885','f43996f0-c7ef-4e18-885e-f805a527a515','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 13:05:17'),('295f9c39-2bac-4cab-b0b8-e2c656c539a3','ae3f93ad-d00e-40c0-a666-f33e7816ec7f','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-21 11:52:23'),('29e7e510-c0d9-4c81-be6f-ce08979d16be','aa190312-e5c5-4655-a044-e2bddc9f3057','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-21 12:20:52'),('2c37ba69-3d9b-4b9d-8053-fc60df687bdd','febad102-c9f8-4d81-ae17-6d773f28c402','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 12:54:51'),('2d6ecc16-1563-42b1-80c5-86b1e55079b3','722a03b4-32b9-4bc1-b6e4-f793a0825239','187b21e6-639b-42b4-8199-28e1a2e49f9c',1,3.75,'2025-05-24 19:25:41'),('2ec33d92-69d5-4cf8-8698-41e7f5cee892','becb1993-9d2e-429f-bc6c-c6d0979ca73f','9c6458f3-20de-4d18-861c-38a24b68b309',1,1.50,'2025-05-21 12:07:18'),('2f440230-b179-42f7-ae04-60404dd81f06','d566c786-767c-434e-8e60-7a0e26cd4923','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 12:18:27'),('3215b980-bd80-418b-ad5a-7f30eaa20f9e','1e570dce-d230-41e3-9f17-747c7251c89d','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 05:20:52'),('32591dbb-98d4-4f1b-ba30-d78b2150fa36','3e761ec1-d72f-43b8-8b0f-fdf7d344fa24','22dbdb82-8f0c-424a-9be3-1c1d57969aa1',1,4.80,'2025-05-21 05:04:31'),('33159fba-ef99-40ca-a06e-b72dd4ef3b88','3a5a927d-42b1-4cbd-9657-f16934e939e0','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-25 23:34:09'),('339c1f62-e675-4b17-a5c9-0604a014ded6','55692572-d1f0-4d6d-8026-8af1853b66b2','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-24 11:24:36'),('341876c2-6572-4da0-ba67-8f2f517777fa','ee07c583-f4c1-4fe8-9805-b12b57cdd5fd','af783643-559f-4a32-848e-03da9524e85c',1,2.95,'2025-05-22 17:35:33'),('348a7f5d-d463-4ba7-b94b-8379fdbb2f03','5e4c58a6-9dd0-4f10-9f31-f2715ec62503','000330c9-15a0-40f8-afb2-33c33b222bb7',2,9.99,'2025-05-24 11:23:05'),('34c06c29-824f-444c-8757-84a10df1be8f','e84a2ed6-cd12-401c-96b4-d219451f8fb0','4c98f143-cc49-4f2d-bf93-6544b33d9e19',1,5.25,'2025-05-22 05:39:06'),('351fae13-b2fc-4136-8150-a61049eaef0e','088dc28b-4dea-4871-9227-d6a908e0c0ea','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-20 12:44:56'),('361e3726-bd4e-4960-a35a-2cb075f6c9a0','baf01e81-1f9f-44a0-8147-a261fc111adb','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-21 12:13:03'),('363ca845-c63f-469d-be5f-47fb40820897','47c24705-bf59-4fd6-8c48-561230440bec','ad80d59c-de80-49e0-82e3-c3d528d5367c',1,1.50,'2025-05-22 17:14:21'),('36d70643-37a9-400d-a818-68fc6184d374','e14bbb18-dbe3-4641-b739-661f1a0de630','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-25 23:32:22'),('3827b204-3b47-4d34-a479-d2871f5f561f','265cfdab-8094-4e5f-a794-37deb69fb0ee','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 11:50:49'),('382cbd08-ec4d-4bcf-9cfd-523d00cb2254','5c80048c-decf-4d63-b6d3-fdc52eeef9c1','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-25 23:40:29'),('388bc27b-dbbe-42b8-b9b0-698babcc826b','c170a67c-2808-4ffa-ab76-a667eb62cc27','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-21 11:55:23'),('38c05b3a-fae7-4ac7-8a56-9a8ef034f31f','75dbad64-c638-4c48-b33d-956bb29dc284','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',2,1.80,'2025-05-24 21:40:27'),('393e89db-2bc2-4380-8d24-60257368b186','a1c83478-b3a6-4e7f-8955-b845ae437f70','187b21e6-639b-42b4-8199-28e1a2e49f9c',1,3.75,'2025-05-22 19:41:41'),('3af33ed0-d5ac-4ee8-9108-c6b9bdfaa2f1','5c15b8bd-f29c-433c-9003-c54bacfa7ec4','ad80d59c-de80-49e0-82e3-c3d528d5367c',1,1.50,'2025-05-23 02:04:42'),('3bfa07f5-296c-413c-b9a2-66847ed87005','a1c83478-b3a6-4e7f-8955-b845ae437f70','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',1,1.80,'2025-05-22 19:41:41'),('3c7e2660-098c-48eb-a01a-07b9469a88d0','8508b5e9-20a9-4a7a-8cb2-d74006e31191','a3ad9984-5f79-4300-96a5-d153b8a01665',1,1.99,'2025-05-22 17:51:44'),('3d6474d9-ed44-4f79-b1d8-4509f6e1b886','9bb9cdd4-fcd7-4cb5-b722-092d02701ef2','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-21 12:50:46'),('3f0271a4-3184-4d7a-9403-52aad7de716a','14bebbc8-6960-4489-a4c9-0d40c73d1412','4c98f143-cc49-4f2d-bf93-6544b33d9e19',1,5.25,'2025-05-24 12:23:57'),('3f8d32ae-83ca-4cda-b592-ffa1e01617b8','630498fe-466b-4181-972b-637deef0dee6','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 09:39:05'),('3ff05fcd-c95b-4bd5-ad1e-159a57c50d0f','49d186f0-6f05-4b1e-a061-20410ffa0ff3','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-24 11:25:06'),('42eb6a4e-cc6f-4d5e-9913-220a15696ee1','57c75542-70b0-438e-8043-5b865186540c','af783643-559f-4a32-848e-03da9524e85c',1,2.95,'2025-05-22 21:18:53'),('45315d76-2799-42f3-bcea-1168155cbf92','265cfdab-8094-4e5f-a794-37deb69fb0ee','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-21 11:50:49'),('4574c8d2-56c2-45a8-b574-654a0a07777d','becb1993-9d2e-429f-bc6c-c6d0979ca73f','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-21 12:07:18'),('46e832ea-6162-483e-bbaa-194a4f1e1f77','6ae9312a-febc-4109-bfab-62466b0f5787','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-25 23:37:20'),('475f9b96-743f-40a7-ac7b-40c452731afa','8b1db9a1-2d80-4106-83e1-10c231953e2c','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-21 09:28:45'),('47e5d4dd-e01c-4f54-9141-74102492e626','722a03b4-32b9-4bc1-b6e4-f793a0825239','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 19:25:41'),('4861f1d7-3d2b-4e60-8080-f1ea929fc03e','fe533d3a-4992-4a23-9111-b37af05e8426','9c6458f3-20de-4d18-861c-38a24b68b309',1,1.50,'2025-05-22 17:55:23'),('4d320e95-b580-4f03-9db4-0f4845d9d13a','088dc28b-4dea-4871-9227-d6a908e0c0ea','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-20 12:44:57'),('4d606858-e08c-4357-a59c-45c81bfe38e0','8f3765c9-9651-49fc-9382-c8b0ee7da1d3','a95dbb16-3ac2-48c8-a9b0-5a6e6656c884',1,163.00,'2025-05-26 10:16:31'),('4e7ee984-7eab-49f4-a5ac-a32ee4e854ed','a1c83478-b3a6-4e7f-8955-b845ae437f70','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-22 19:41:41'),('510595f8-819a-4e1e-9b4d-32a327c50a5b','c07fd97a-1f98-43dd-9a3c-eb0139cc1a8b','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-21 05:23:54'),('52a71104-ece0-4332-bba3-1aae7f1edb5c','33b58c5e-e0b3-4899-b35d-aa41fad917d2','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 05:07:40'),('5536f545-887a-469b-a681-49c1e12c8ba5','fb1207da-0027-4287-a488-3916982776a9','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-21 14:20:06'),('56d1b96c-6aa6-46ed-882b-54bf208d0e88','e14bbb18-dbe3-4641-b739-661f1a0de630','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',1,1.80,'2025-05-25 23:32:22'),('58799245-3e65-471e-adf7-338dfbea4724','e8a5a9d0-b7df-4b8f-8040-abe21b26011d','4c98f143-cc49-4f2d-bf93-6544b33d9e19',1,5.25,'2025-05-22 20:18:44'),('58f23914-2251-4907-894d-835588487c5a','a2d5c73b-8298-4915-a9fb-5d0b2675c54e','a95dbb16-3ac2-48c8-a9b0-5a6e6656c884',1,163.00,'2025-05-26 10:05:24'),('5c259846-9f84-43f5-938b-d18a421d68c9','76ffa68d-3d19-40fe-89b9-638ec4ddcefe','a95dbb16-3ac2-48c8-a9b0-5a6e6656c884',1,163.00,'2025-05-26 10:26:30'),('5f23ed26-65d3-4272-bb23-3ce8fd11d0e9','d103fd6a-33e6-4194-a0c0-c36c50418fb0','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 10:37:35'),('5f31fbb8-3f28-43f0-bc0d-71452178904d','265cfdab-8094-4e5f-a794-37deb69fb0ee','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-21 11:50:49'),('5f44e42d-b2db-4f9a-aa9e-5d0213dcc037','949ebb34-8285-4f62-90d5-6381a40c5a8c','4c98f143-cc49-4f2d-bf93-6544b33d9e19',1,5.25,'2025-05-22 21:17:47'),('5fdedbbf-211b-4be3-9a72-d3a04653501b','961abb66-0966-489b-af03-11adc536e782','187b21e6-639b-42b4-8199-28e1a2e49f9c',1,3.75,'2025-05-21 11:49:29'),('623f4e95-67fe-433f-bdbb-cd09494d8df8','7eac203f-c870-45ba-88b5-fd793be7c99d','a95dbb16-3ac2-48c8-a9b0-5a6e6656c884',1,163.00,'2025-05-26 09:59:49'),('6305e3b2-24c6-43dd-8f91-940209470d0c','9fecb2c9-99be-4911-b3bc-4ada6df83694','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-21 12:17:12'),('63682857-a882-4767-9217-efb26f9229cd','41851d0a-2999-45bb-85a3-91cdbdfc874a','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 04:05:52'),('65fc4c72-bac4-4728-bc76-01a26bc19198','63e31c11-bd06-4df2-9721-3ffd7539c5a5','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 04:00:21'),('67d7811a-9439-4e1b-beb7-e6f775147afc','622d2c66-957f-4cea-b86a-a96e0317b689','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 05:15:15'),('682efebf-0083-4cd3-9bc3-6ac0e60dbf83','44d33faa-1afc-4fd0-99da-be5e1712ad78','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 05:13:00'),('690da6a9-a129-4a9f-8b12-dd26e240c321','ffe373a2-b9a8-45e3-8757-8ec47f40f6ab','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-23 01:47:32'),('6929a58c-1f5a-4efd-8a70-5cccf85f864d','ae3f93ad-d00e-40c0-a666-f33e7816ec7f','592de762-38ed-4640-9e6c-c32fd5096790',2,3.25,'2025-05-21 11:52:23'),('6bbdb51d-7380-4424-b0d5-3f2a36b1e2cb','088dc28b-4dea-4871-9227-d6a908e0c0ea','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-20 12:44:57'),('6bd22988-03bf-4724-863d-7f464b40a947','5b594d33-dcdb-4b62-a71a-a08fb01500b7','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-24 11:25:31'),('6c588eed-43e1-4c7e-9243-26a453e12032','baf01e81-1f9f-44a0-8147-a261fc111adb','4c98f143-cc49-4f2d-bf93-6544b33d9e19',1,5.25,'2025-05-21 12:13:03'),('6c73bbd1-a707-46f1-8e0c-c34dd8b6a3f5','3a5ab606-6417-4ac6-a97c-339eab8b6df2','59c5aa8d-33e1-4e3c-ad80-e5735bde8140',1,6.50,'2025-05-21 05:10:12'),('6d51a5fa-02f8-464a-b17a-8d5875db2080','d103fd6a-33e6-4194-a0c0-c36c50418fb0','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 10:37:35'),('6fbd8d36-2365-495e-a988-c0be35ca6474','1e570dce-d230-41e3-9f17-747c7251c89d','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-21 05:20:52'),('6fe54b06-7095-42e6-82a4-8638c29a4b92','14bebbc8-6960-4489-a4c9-0d40c73d1412','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-24 12:23:57'),('704b7556-dcb8-4c71-9a13-1898f086760b','ef6bbe6f-28e4-4d06-b0dc-a9cebb0df973','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 10:22:13'),('707ec1c7-84e6-464d-acc8-b341817eb5c0','a29c0234-bd43-4d00-91d8-04125f6cb522','a3ad9984-5f79-4300-96a5-d153b8a01665',2,1.99,'2025-05-22 17:55:01'),('72a90c24-818f-454c-bfb5-79f39546c68d','14bebbc8-6960-4489-a4c9-0d40c73d1412','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-24 12:23:57'),('73eda19f-3e68-46f5-96b3-67f90220661d','f7dcbef4-1fec-4d10-860f-74aa554b29f3','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 10:00:23'),('743fd552-60b1-4315-a45b-789a3e5e4c0c','e6defc7a-8d1a-4dc7-a815-23aaf893a4ab','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 19:33:41'),('76442f77-e93e-49d3-ab19-64352c9d06b2','fe533d3a-4992-4a23-9111-b37af05e8426','d27c07d9-fa0c-49a7-9a29-454dde45bf7f',1,3.49,'2025-05-22 17:55:23'),('78029c32-8c0c-4972-85f8-de1bb92e37c0','8b1f3bac-8bb1-4322-8ba4-81032c52ba33','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-26 01:03:53'),('7bb04f18-419b-4fc3-bee4-7f3eb8ac7dcc','ae3f93ad-d00e-40c0-a666-f33e7816ec7f','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 11:52:23'),('7c0671f2-356e-44f4-aa15-072ffef3b96c','fe533d3a-4992-4a23-9111-b37af05e8426','a3ad9984-5f79-4300-96a5-d153b8a01665',1,1.99,'2025-05-22 17:55:23'),('7c981f4a-bf10-43ac-9a7c-2bfbd4e83ee4','76eb82fe-36cc-499d-88c3-e52ee5cced9d','22dbdb82-8f0c-424a-9be3-1c1d57969aa1',1,4.80,'2025-05-22 21:51:12'),('7d780610-fe17-4b1c-8082-df93fc0fa6bf','d3c4dec0-0b07-4a7c-8c7d-182530b7e9dc','a95dbb16-3ac2-48c8-a9b0-5a6e6656c884',1,163.00,'2025-05-26 10:37:12'),('80bbf49d-a770-40c6-8c73-d7c3ca672161','05d21891-a1e7-4e71-90fa-fca928e0fa09','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 04:20:49'),('81a7d2ef-822c-4839-a12c-3831199c8be6','aff75fd0-4a08-42bb-baee-4b4974a10ca0','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-26 00:47:10'),('81b890a8-14b3-4df1-834d-d939dcc56d0f','5b594d33-dcdb-4b62-a71a-a08fb01500b7','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',1,1.80,'2025-05-24 11:25:31'),('8241807a-a496-4faa-aa5b-c889b26bfe0c','0776f099-b90c-4d2f-9dab-d7577db468d6','ad80d59c-de80-49e0-82e3-c3d528d5367c',4,1.50,'2025-05-22 14:48:05'),('88c309c5-a5fd-49d1-b5bd-a87076e9b96e','3a5ab606-6417-4ac6-a97c-339eab8b6df2','592de762-38ed-4640-9e6c-c32fd5096790',1,3.25,'2025-05-21 05:10:12'),('8920cc5a-b63c-4cb9-a818-f485e2b83d40','94f38e52-e9a3-42c7-9b5a-93d32363e583','22dbdb82-8f0c-424a-9be3-1c1d57969aa1',1,4.80,'2025-05-22 23:54:11'),('89d12e03-e75d-40dd-8bf9-148fcebe5497','6f16c6d3-d352-4555-8441-589524e9fe27','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-22 19:27:23'),('8a2d6752-a105-4bce-a81a-1ed4aa2779ec','256e5c03-ca60-4703-b49d-d6caa4a7187a','627d7c55-921a-4916-8bf9-98f1bbc4ad08',1,2.60,'2025-05-21 12:55:13'),('8d178e2e-f7a7-4de5-aa8e-6023a4b1304a','1a828a26-2c33-4036-97cf-edd016b4b5b9','a3ad9984-5f79-4300-96a5-d153b8a01665',1,1.99,'2025-05-22 17:59:36'),('8e02cea2-1229-44d6-9577-676b2c6a3f9f','aff75fd0-4a08-42bb-baee-4b4974a10ca0','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-26 00:47:10'),('8e61ace8-2199-401a-be56-6cfe1346fbfe','ae3f93ad-d00e-40c0-a666-f33e7816ec7f','59c5aa8d-33e1-4e3c-ad80-e5735bde8140',1,6.50,'2025-05-21 11:52:23'),('8e79a62e-1dbe-4994-bf4b-34bb18f65672','c8de6ea9-3a62-42a7-8c6b-7f17208da11e','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 10:08:28'),('8ff4bdce-7cfe-465d-b7f1-cdc6c1253906','14bebbc8-6960-4489-a4c9-0d40c73d1412','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',1,1.80,'2025-05-24 12:23:57'),('933cf246-e53e-4623-ac54-01f4e3e926d0','949ebb34-8285-4f62-90d5-6381a40c5a8c','5c08c1dc-5559-4470-8151-c026805899dd',1,1.25,'2025-05-22 21:17:47'),('96803c1b-66b1-4dd3-8bb2-1fc35938600d','94f38e52-e9a3-42c7-9b5a-93d32363e583','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-22 23:54:11'),('976f2277-00b7-4a12-8638-8274e5a71ac5','fb1207da-0027-4287-a488-3916982776a9','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-21 14:20:06'),('97bb4a78-fa3c-47e8-aa4e-2fb824071463','c5c365d9-1830-49c6-a1f3-89dbf702c045','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-22 05:36:13'),('98b9e423-6912-4a32-bf31-951fb6a14892','3a5ab606-6417-4ac6-a97c-339eab8b6df2','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 05:10:12'),('9a08c511-2778-45bc-94a2-0036bf04eda3','a29c0234-bd43-4d00-91d8-04125f6cb522','d27c07d9-fa0c-49a7-9a29-454dde45bf7f',1,3.49,'2025-05-22 17:55:01'),('9b53a370-42de-42a3-9e2c-ea4ba03cea71','40247b67-995d-416f-b86b-279e5c6445f4','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 03:56:31'),('9e69d257-adfc-42aa-bfda-5237f642b0e1','de34f1ec-4a2f-4b06-a7c8-dd7d00007f8a','a95dbb16-3ac2-48c8-a9b0-5a6e6656c884',1,163.00,'2025-05-26 09:58:00'),('9eca50e6-96bb-4457-abca-0bead3f964c3','14bebbc8-6960-4489-a4c9-0d40c73d1412','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 12:23:57'),('9f9374f7-94b9-45a4-9863-21c2d59fac66','e2c93d4b-4bef-401c-9273-5f942e478218','a3ad9984-5f79-4300-96a5-d153b8a01665',1,1.99,'2025-05-22 17:59:01'),('9ffc6a2b-c9db-4637-bf6f-7df798f14550','8e13fb01-bd1e-4a8e-b031-facda22033f2','4c98f143-cc49-4f2d-bf93-6544b33d9e19',1,5.25,'2025-05-22 10:54:51'),('a07576a5-f5ed-49fb-8821-1d7c0342f7b8','9bb9cdd4-fcd7-4cb5-b722-092d02701ef2','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-21 12:50:46'),('a14116b2-20d6-4f31-b861-a24f07ec25f1','e9208b05-33ce-4cd9-9197-f167d869e8d4','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',1,1.80,'2025-05-24 19:26:40'),('a1d444fb-399b-407e-9a40-3b7b76fdd02a','67585ef1-874b-4411-9533-93a1d7c01412','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-22 18:34:22'),('a2b49d4e-9d06-416d-a3b4-9480d9957249','d9b447a0-dc08-4a60-9653-f92be02668e9','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-22 17:13:39'),('a3db487b-385e-4183-ac64-594e479553ad','f43996f0-c7ef-4e18-885e-f805a527a515','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-21 13:05:17'),('a4c52b00-2c34-4b31-a0da-2899ff84f0e7','2aaa8f65-c421-46aa-b5bb-004ea5861d5c','ad80d59c-de80-49e0-82e3-c3d528d5367c',1,1.50,'2025-05-22 16:59:38'),('a56a88aa-be99-4899-be11-eaf35210c8dd','94f38e52-e9a3-42c7-9b5a-93d32363e583','c0edd880-aa11-4d74-8b77-845d8798da90',1,2.99,'2025-05-22 23:54:11'),('a696d3e9-ae19-4980-be42-375f15076069','3e52bc21-34c6-49e4-b15e-af23f4f63e31','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-21 09:26:27'),('a7d51d38-5228-4608-a3f0-ec5640740f4c','d566c786-767c-434e-8e60-7a0e26cd4923','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-21 12:18:27'),('a86235f2-2851-4c6c-bf0a-ef9ccd348174','0f1b6715-262a-4c40-9134-86c6016f589f','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 04:11:25'),('aa8ac20f-aad8-4d47-8589-0763871edc14','6ae9312a-febc-4109-bfab-62466b0f5787','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',1,1.80,'2025-05-25 23:37:20'),('aaadaef9-e57f-4915-aaaa-38c7f9aa6a70','e84a2ed6-cd12-401c-96b4-d219451f8fb0','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-22 05:39:06'),('ab5a7bf4-4b93-45c2-adf8-232651a18d6f','baf01e81-1f9f-44a0-8147-a261fc111adb','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-21 12:13:03'),('ab7e9a92-1fbd-46b8-8610-dd466c7981b5','921dd3ec-0dd8-40f3-ba96-42bbb8e3688d','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 12:23:24'),('abc70d6e-d7b3-494e-80f6-8b8dfb44bfd5','6e28e524-7656-4dc8-9cad-180260f7069f','ad80d59c-de80-49e0-82e3-c3d528d5367c',1,1.50,'2025-05-22 21:16:40'),('ace153ad-c2c4-4eec-8d85-eb593c6c5500','0436db07-7abb-41e8-a9a0-a4e7028eb992','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 10:45:54'),('adc34d6b-caf0-4773-814f-90ae98babf02','6a3102ee-87de-4db1-b466-0a3931d99f3a','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 10:22:05'),('ae2390b3-eb61-4c12-9876-42b9f4bb28f0','33da33e3-6f97-42a6-aa13-0232c5c84887','9c6458f3-20de-4d18-861c-38a24b68b309',1,1.50,'2025-05-22 17:57:47'),('af29f65e-3eb3-430b-b3ee-430197d0418c','c07fd97a-1f98-43dd-9a3c-eb0139cc1a8b','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 05:23:54'),('b2d41ace-10ae-4ed3-8596-2ba7185c732e','042a8e24-ce18-443d-b44a-ab514bf601f0','b89be53e-f6b7-4005-9f32-9e890325c658',11,899.00,'2025-05-26 12:30:35'),('b348a688-e8a6-42a1-b0af-eecd3b4f5d6f','8508b5e9-20a9-4a7a-8cb2-d74006e31191','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',2,2.99,'2025-05-22 17:51:44'),('b35626d2-dcdc-4c64-a9d4-3c9e9549f62d','614ed020-a515-4c08-ba19-8c556009c11d','187b21e6-639b-42b4-8199-28e1a2e49f9c',4,3.75,'2025-05-21 12:21:41'),('b4cb27e0-8337-4aab-ba71-cddb4371b7a5','55692572-d1f0-4d6d-8026-8af1853b66b2','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 11:24:36'),('b4f32888-a733-4662-800e-3210266039ac','53fd7515-667b-4657-a2a5-000d8ea3918d','ad80d59c-de80-49e0-82e3-c3d528d5367c',1,1.50,'2025-05-22 16:24:17'),('b674fa92-3efb-4731-ae07-c4d012858f2e','8508b5e9-20a9-4a7a-8cb2-d74006e31191','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-22 17:51:44'),('b706c3a1-965a-4446-8305-2de8e63546bd','baf01e81-1f9f-44a0-8147-a261fc111adb','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 12:13:03'),('bacb13c6-5f67-4da2-be4e-35adbd3ba8b5','0e96f059-6720-463e-be95-87215e20b18c','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 12:02:13'),('bb0fa995-094c-452b-8b86-12dcb94970a2','94f38e52-e9a3-42c7-9b5a-93d32363e583','ed2f4421-fca0-4827-b7c3-d814f46252c6',1,4.50,'2025-05-22 23:54:11'),('bdc96207-4381-47ad-ab34-48cd8050e5bc','088dc28b-4dea-4871-9227-d6a908e0c0ea','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-20 12:44:57'),('bec107ac-110d-45eb-b4e7-d82861850fdb','7f8cfd5b-8870-4df1-9f1b-453bf9cb638f','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 10:01:09'),('c003608b-e19f-4358-b4b7-f54a77b5f460','0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 12:12:00'),('c0952106-4c51-42e7-89e3-b66d50d340d1','94f38e52-e9a3-42c7-9b5a-93d32363e583','592de762-38ed-4640-9e6c-c32fd5096790',1,3.25,'2025-05-22 23:54:11'),('c3f46efb-2a53-4134-8ebd-7c4c2d624a2d','974f9a3c-f478-499f-a39b-fc6a539b8812','af783643-559f-4a32-848e-03da9524e85c',1,2.95,'2025-05-22 20:19:45'),('c4577664-4556-4ce3-b56c-fee604414de8','fb1207da-0027-4287-a488-3916982776a9','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 14:20:06'),('c4b60a03-4aa5-4632-94e0-e482de1670ef','49d186f0-6f05-4b1e-a061-20410ffa0ff3','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 11:25:06'),('c8718c9f-7d13-4092-bd0c-2e0a2bd07bdb','3a5a927d-42b1-4cbd-9657-f16934e939e0','ad80d59c-de80-49e0-82e3-c3d528d5367c',1,1.50,'2025-05-25 23:34:09'),('c9f09ee3-072e-4bb8-b847-b3fd190d39cf','e826dc43-8a2c-440d-90dd-d65dcc1f595c','b82e1887-40f9-4475-b277-ef45e093bf56',1,7.80,'2025-05-26 10:38:50'),('cc568610-38c1-4ee1-9b7d-4278123f0ef2','75dbad64-c638-4c48-b33d-956bb29dc284','5c08c1dc-5559-4470-8151-c026805899dd',1,1.25,'2025-05-24 21:40:27'),('ce935e3f-1612-4421-9aa6-c9584fe2aea0','40247b67-995d-416f-b86b-279e5c6445f4','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 03:56:32'),('cf0608eb-1153-493a-a4c8-33f56b32fc03','89abe8fd-7d71-4e40-a275-9f60164215ea','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-22 05:37:45'),('d198218c-ed23-411a-adeb-2b78132dbe46','0e96f059-6720-463e-be95-87215e20b18c','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-21 12:02:13'),('d20e27f6-db7a-45a3-bb28-2156ed8a5318','0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c','4c98f143-cc49-4f2d-bf93-6544b33d9e19',1,5.25,'2025-05-21 12:12:00'),('d22f68e3-8e5e-4beb-b731-7be3936c1af4','256e5c03-ca60-4703-b49d-d6caa4a7187a','9c6458f3-20de-4d18-861c-38a24b68b309',1,1.50,'2025-05-21 12:55:13'),('d2bbefef-4f8d-49f9-8633-9f1ea72ac19c','0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-21 12:12:00'),('d471d58e-6a5c-4af5-9a33-e3ed19c3dc63','e89b7185-49d7-40ec-a320-fa8fdd65211c','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 04:24:37'),('d9b298fe-a9f2-40a3-8165-71dd55fb5685','6ae9312a-febc-4109-bfab-62466b0f5787','ad80d59c-de80-49e0-82e3-c3d528d5367c',1,1.50,'2025-05-25 23:37:20'),('dad39297-baed-4419-9ab1-c3799f2e3c96','8e13fb01-bd1e-4a8e-b031-facda22033f2','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-22 10:54:51'),('dc36362c-7619-45f0-a297-d404a1c73759','44d33faa-1afc-4fd0-99da-be5e1712ad78','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 05:13:00'),('dcedc2bd-7d5c-4e6b-a190-c00b4d63e3d9','9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 12:05:29'),('dd00cb50-a7a5-4bb8-9f8a-a602c373c495','0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-21 12:12:00'),('dde709d8-5c9d-4518-948e-9e82764f2c38','e89b7185-49d7-40ec-a320-fa8fdd65211c','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 04:24:37'),('e006b3dd-e1ee-4af0-a524-ad254229f6ee','961abb66-0966-489b-af03-11adc536e782','0a3a5617-942e-46bf-abed-c34a74a8a6d7',1,2.25,'2025-05-21 11:49:29'),('e2d82c48-4329-43a0-acb2-3033150146c5','0f8628fa-e7e3-45cb-9738-c1b9c6ff760c','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 04:01:36'),('e562b8e4-85b5-49a7-ad20-2923b1df11bf','49d186f0-6f05-4b1e-a061-20410ffa0ff3','5c08c1dc-5559-4470-8151-c026805899dd',1,1.25,'2025-05-24 11:25:06'),('e8a04663-b6c8-4f9c-92aa-3a4785bf6e77','67585ef1-874b-4411-9533-93a1d7c01412','a3ad9984-5f79-4300-96a5-d153b8a01665',1,1.99,'2025-05-22 18:34:22'),('e9b37583-29cf-4fe7-9f59-4f8e5e35ec71','a29c0234-bd43-4d00-91d8-04125f6cb522','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-22 17:55:01'),('ea2bc0e9-735f-4ac3-b88c-5f47e7bbd82f','ae3f93ad-d00e-40c0-a666-f33e7816ec7f','22dbdb82-8f0c-424a-9be3-1c1d57969aa1',1,4.80,'2025-05-21 11:52:23'),('eb728633-ad3d-4265-8255-bed94066871f','5e4c58a6-9dd0-4f10-9f31-f2715ec62503','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-24 11:23:05'),('ed250976-7a1c-44b4-8e1e-460d53d86895','aff75fd0-4a08-42bb-baee-4b4974a10ca0','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-26 00:47:10'),('edc97dc9-7661-4059-92d5-5af7faa10998','a29c0234-bd43-4d00-91d8-04125f6cb522','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-22 17:55:01'),('ede7335c-84fe-439d-8954-f57d3a290579','8e13fb01-bd1e-4a8e-b031-facda22033f2','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-22 10:54:51'),('f1856971-bcaa-4cb1-b2ce-a4c9989140bc','a29c0234-bd43-4d00-91d8-04125f6cb522','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-22 17:55:01'),('f197c1c9-aa21-442e-a333-e31cc35d98be','265cfdab-8094-4e5f-a794-37deb69fb0ee','00233c5c-f8b0-41da-8583-64d1746e635f',1,3.10,'2025-05-21 11:50:49'),('f26a91c3-3d97-4b3a-b181-24b15b5fa79f','8e13fb01-bd1e-4a8e-b031-facda22033f2','56c22eee-4c83-4fd1-aed5-07d3c3fba6b1',1,2.99,'2025-05-22 10:54:51'),('f350beca-c02c-49df-90df-578553f414d7','3a5a927d-42b1-4cbd-9657-f16934e939e0','000330c9-15a0-40f8-afb2-33c33b222bb7',2,9.99,'2025-05-25 23:34:09'),('f49234c2-fa29-4452-8f6b-ed016c544db3','5c80048c-decf-4d63-b6d3-fdc52eeef9c1','ad80d59c-de80-49e0-82e3-c3d528d5367c',1,1.50,'2025-05-25 23:40:29'),('f4fa3fd6-af41-480e-911f-41def61dd6cf','d566c786-767c-434e-8e60-7a0e26cd4923','14ff74f8-d700-4b7f-b118-2fb789011860',1,2.85,'2025-05-21 12:18:27'),('f52f58fd-3ed3-4e1c-b5d0-4c3a6358e608','63e31c11-bd06-4df2-9721-3ffd7539c5a5','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 04:00:22'),('f5984a15-697a-499f-a507-9ad6a6577c4f','921dd3ec-0dd8-40f3-ba96-42bbb8e3688d','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-24 12:23:24'),('f5a532ab-66d0-42a5-b92c-7fd87f1bd282','485b3716-b29e-41cc-b539-f52c0af8f69d','000330c9-15a0-40f8-afb2-33c33b222bb7',1,9.99,'2025-05-22 21:18:08'),('f5b47f41-e8ba-4f24-b10a-18c1e5c9b91a','5c15b8bd-f29c-433c-9003-c54bacfa7ec4','000330c9-15a0-40f8-afb2-33c33b222bb7',2,9.99,'2025-05-23 02:04:42'),('f69f7650-1fb9-4425-aae6-03343b79f827','921dd3ec-0dd8-40f3-ba96-42bbb8e3688d','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',1,1.80,'2025-05-24 12:23:24'),('f7c5a40e-e01e-4596-b2ab-b97b899d6283','bba0eff6-fb3d-43e3-941a-9b6c2f375617','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 09:25:13'),('fb6ce781-2823-4294-aa7d-9bb6dd8b4438','55692572-d1f0-4d6d-8026-8af1853b66b2','b6860c69-6d3e-456c-a25f-a4bc09bd23c4',1,1.80,'2025-05-24 11:24:36'),('fc54e55d-47b8-4707-89d4-d15cd0977537','14bebbc8-6960-4489-a4c9-0d40c73d1412','5c08c1dc-5559-4470-8151-c026805899dd',1,1.25,'2025-05-24 12:23:57'),('fce623d7-62ae-48b6-93ce-608067f6d243','05d21891-a1e7-4e71-90fa-fca928e0fa09','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 04:20:49'),('fd4c8a48-9836-4a60-9b8c-d7868335cdf6','0f8628fa-e7e3-45cb-9738-c1b9c6ff760c','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 04:01:36'),('fd4f0360-885c-4f47-a88f-3f0a2d4b07ca','41851d0a-2999-45bb-85a3-91cdbdfc874a','0e9cf56e-14fe-410c-854a-928fd69e054f',1,4.10,'2025-05-21 04:05:52'),('fd9c46b2-7450-44c0-91bf-61cd95ef8dce','ada4c8cb-3fb3-42e2-a7f3-3f751d44b977','b193d1a1-94f6-405a-b13f-15a1d594f403',1,3.85,'2025-05-26 01:18:48'),('ff00caf4-cdd2-4c8c-b7a6-417b05097737','654e3a9a-8183-465b-86d7-d4986d10d4d9','a3ad9984-5f79-4300-96a5-d153b8a01665',1,1.99,'2025-05-22 18:34:11'),('ffcf74f5-af7d-4f43-a31f-d239be155b95','9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c','3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6',1,2.49,'2025-05-21 12:05:29');
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
  `payment_method` varchar(36) DEFAULT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `status` enum('completed','refunded','voided') DEFAULT 'completed',
  `payment_status` enum('PENDING','PARTIALLY_PAID','PAID','REFUNDED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `discount_type` varchar(20) DEFAULT NULL COMMENT 'Type of discount (e.g., percentage, fixed)',
  `discount_value` decimal(10,2) DEFAULT NULL COMMENT 'The value of the discount (e.g., 10 for 10%, or 5.00 for a fixed amount)',
  `discount_amount` decimal(10,2) DEFAULT NULL COMMENT 'The actual calculated amount of the discount applied to the sale',
  `customer_id` varchar(36) DEFAULT NULL,
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
INSERT INTO `sales` VALUES ('0040f320-8ede-439c-9a42-036c454d996c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',9.99,0.41,0.00,10.40,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 00:59:22',NULL,NULL,0.00,'503e4102-68a7-46e0-a4c9-e798b344ca7b'),('042a8e24-ce18-443d-b44a-ab514bf601f0','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',9889.00,815.84,0.00,10704.84,'e9ca7670-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 12:30:35',NULL,NULL,0.00,NULL),('0436db07-7abb-41e8-a9a0-a4e7028eb992','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',13.84,0.00,0.00,13.84,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 10:45:54',NULL,NULL,0.00,'ec16e637-fdd8-4594-b7a7-31495b9ab95f'),('05d21891-a1e7-4e71-90fa-fca928e0fa09','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f',6.59,0.66,0.00,7.25,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 04:20:49',NULL,NULL,NULL,''),('0776f099-b90c-4d2f-9dab-d7577db468d6','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.00,0.08,0.00,1.08,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 14:48:05',NULL,NULL,5.00,'503e4102-68a7-46e0-a4c9-e798b344ca7b'),('088dc28b-4dea-4871-9227-d6a908e0c0ea','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',22.29,2.23,0.00,24.52,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-20 12:44:56',NULL,NULL,NULL,''),('0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.19,1.52,0.00,16.71,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:12:00',NULL,NULL,NULL,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('0e96f059-6720-463e-be95-87215e20b18c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',5.35,0.54,0.00,5.89,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:02:13',NULL,NULL,NULL,''),('0f1b6715-262a-4c40-9134-86c6016f589f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.35,0.64,0.00,6.98,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 04:11:25',NULL,NULL,NULL,''),('0f8628fa-e7e3-45cb-9738-c1b9c6ff760c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.59,0.66,0.00,7.25,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 04:01:36',NULL,NULL,NULL,''),('14bebbc8-6960-4489-a4c9-0d40c73d1412','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',24.88,1.64,0.00,26.52,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 12:23:56',NULL,NULL,0.00,'ec16e637-fdd8-4594-b7a7-31495b9ab95f'),('1a828a26-2c33-4036-97cf-edd016b4b5b9','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',1.99,0.16,0.00,2.15,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 17:59:36',NULL,NULL,NULL,NULL),('1e570dce-d230-41e3-9f17-747c7251c89d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',5.35,0.54,0.00,5.89,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 05:20:52',NULL,NULL,NULL,''),('256e5c03-ca60-4703-b49d-d6caa4a7187a','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',4.10,0.41,0.00,4.51,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:55:13',NULL,NULL,NULL,'f14d11c7-cd67-460a-8bff-2beea3980f85'),('265cfdab-8094-4e5f-a794-37deb69fb0ee','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',22.29,2.23,0.00,24.52,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 11:50:49',NULL,NULL,NULL,''),('2aaa8f65-c421-46aa-b5bb-004ea5861d5c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',1.50,0.00,0.00,0.00,'00000000-0000-0000-0000-000000000000',NULL,'completed','PAID','2025-05-22 16:59:38',NULL,NULL,1.50,NULL),('33b58c5e-e0b3-4899-b35d-aa41fad917d2','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.59,0.66,0.00,7.25,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 05:07:40',NULL,NULL,NULL,''),('33da33e3-6f97-42a6-aa13-0232c5c84887','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',4.60,0.38,0.00,4.98,'e9ca7670-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 17:57:47',NULL,NULL,NULL,NULL),('36f7f59b-f2d3-4bf5-9ae4-c45e821ae5ac','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',163.00,13.45,0.00,176.45,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 10:29:31',NULL,NULL,0.00,NULL),('3a5a927d-42b1-4cbd-9657-f16934e939e0','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',25.58,0.00,0.00,25.58,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-25 23:34:09',NULL,NULL,0.00,'503e4102-68a7-46e0-a4c9-e798b344ca7b'),('3a5ab606-6417-4ac6-a97c-339eab8b6df2','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',17.04,1.70,0.00,18.74,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 05:10:12',NULL,NULL,NULL,''),('3e52bc21-34c6-49e4-b15e-af23f4f63e31','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',13.09,1.31,0.00,14.40,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 09:26:27',NULL,NULL,NULL,''),('3e761ec1-d72f-43b8-8b0f-fdf7d344fa24','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',8.90,0.89,0.00,9.79,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 05:04:31',NULL,NULL,NULL,''),('40247b67-995d-416f-b86b-279e5c6445f4','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.59,0.66,0.00,7.25,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 03:56:31',NULL,NULL,NULL,''),('41851d0a-2999-45bb-85a3-91cdbdfc874a','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.35,0.64,0.00,6.98,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 04:05:52',NULL,NULL,NULL,''),('44d33faa-1afc-4fd0-99da-be5e1712ad78','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.59,0.66,0.00,7.25,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 05:13:00',NULL,NULL,NULL,''),('47c24705-bf59-4fd6-8c48-561230440bec','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',1.50,0.00,0.00,0.00,'00000000-0000-0000-0000-000000000000',NULL,'completed','PAID','2025-05-22 17:14:21',NULL,NULL,1.50,NULL),('485b3716-b29e-41cc-b539-f52c0af8f69d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',9.99,0.74,0.00,10.73,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 21:18:08',NULL,NULL,0.00,NULL),('49d186f0-6f05-4b1e-a061-20410ffa0ff3','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',9.20,0.61,0.00,9.81,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 11:25:06',NULL,NULL,0.00,'ec16e637-fdd8-4594-b7a7-31495b9ab95f'),('4fee3e47-7781-4f25-8f78-b343802c0ad3','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',4.10,0.41,0.00,4.51,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-20 12:19:48',NULL,NULL,NULL,''),('53fd7515-667b-4657-a2a5-000d8ea3918d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',1.50,0.00,0.00,0.00,'00000000-0000-0000-0000-000000000000',NULL,'completed','PAID','2025-05-22 16:24:16',NULL,NULL,1.50,NULL),('55692572-d1f0-4d6d-8026-8af1853b66b2','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.89,0.66,0.00,16.55,'e9ca76b3-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 11:24:36',NULL,NULL,0.00,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('55a91e70-3811-4d6c-a57c-5be5417d9158','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',4.10,0.34,0.00,4.44,'e9ca7670-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 17:35:24',NULL,NULL,NULL,NULL),('57c75542-70b0-438e-8043-5b865186540c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',2.95,0.24,0.00,3.19,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 21:18:53',NULL,NULL,0.00,NULL),('5b5507a5-19a5-4dfc-9b82-6c53332ba2f3','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',2.49,0.21,0.00,2.70,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 20:20:33',NULL,NULL,NULL,NULL),('5b594d33-dcdb-4b62-a71a-a08fb01500b7','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.89,1.31,0.00,17.20,'e9ca7670-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 11:25:31',NULL,NULL,0.00,NULL),('5c15b8bd-f29c-433c-9003-c54bacfa7ec4','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',24.43,2.02,0.00,26.45,'e9ca76b3-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-23 02:04:42',NULL,NULL,0.00,NULL),('5c80048c-decf-4d63-b6d3-fdc52eeef9c1','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',5.60,0.00,0.00,5.60,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-25 23:40:29',NULL,NULL,0.00,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('5e4c58a6-9dd0-4f10-9f31-f2715ec62503','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',23.83,1.97,0.00,25.80,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 11:23:05',NULL,NULL,0.00,NULL),('614ed020-a515-4c08-ba19-8c556009c11d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.00,1.50,0.00,16.50,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:21:41',NULL,NULL,NULL,'f14d11c7-cd67-460a-8bff-2beea3980f85'),('622d2c66-957f-4cea-b86a-a96e0317b689','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.35,0.64,0.00,6.98,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 05:15:15',NULL,NULL,NULL,''),('630498fe-466b-4181-972b-637deef0dee6','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',3.85,0.32,0.00,4.17,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 09:39:05',NULL,NULL,0.00,NULL),('63e31c11-bd06-4df2-9721-3ffd7539c5a5','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.59,0.66,0.00,7.25,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 04:00:21',NULL,NULL,NULL,''),('654e3a9a-8183-465b-86d7-d4986d10d4d9','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',1.99,0.16,0.00,2.15,'e9ca76b3-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 18:34:11',NULL,NULL,NULL,NULL),('67585ef1-874b-4411-9533-93a1d7c01412','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',4.98,0.41,0.00,5.39,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 18:34:22',NULL,NULL,NULL,NULL),('6a3102ee-87de-4db1-b466-0a3931d99f3a','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',9.99,0.00,0.00,9.99,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 10:22:05',NULL,NULL,0.00,NULL),('6ae9312a-febc-4109-bfab-62466b0f5787','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',17.39,0.00,0.00,17.39,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-25 23:37:20',NULL,NULL,0.00,'503e4102-68a7-46e0-a4c9-e798b344ca7b'),('6e28e524-7656-4dc8-9cad-180260f7069f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',1.50,0.12,0.00,1.62,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 21:16:40',NULL,NULL,0.00,NULL),('6f16c6d3-d352-4555-8441-589524e9fe27','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',2.49,0.21,0.00,2.70,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 19:27:23',NULL,NULL,NULL,'0fe0c3a7-1096-4937-9a00-dfe6afa2efac'),('722a03b4-32b9-4bc1-b6e4-f793a0825239','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',17.59,1.45,0.00,19.04,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 19:25:41',NULL,NULL,0.00,'566ea385-aadc-41cd-bfda-1b3fb8bb4edf'),('75dbad64-c638-4c48-b33d-956bb29dc284','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',14.84,0.98,0.00,15.82,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 21:40:27',NULL,NULL,0.00,'ec16e637-fdd8-4594-b7a7-31495b9ab95f'),('76eb82fe-36cc-499d-88c3-e52ee5cced9d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',7.75,0.64,0.00,8.39,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 21:51:12',NULL,NULL,0.00,NULL),('76ffa68d-3d19-40fe-89b9-638ec4ddcefe','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',163.00,13.45,0.00,176.45,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 10:26:30',NULL,NULL,0.00,NULL),('7eac203f-c870-45ba-88b5-fd793be7c99d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',163.00,13.45,0.00,176.45,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 09:59:49',NULL,NULL,0.00,NULL),('7f8cfd5b-8870-4df1-9f1b-453bf9cb638f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',3.85,0.00,0.00,3.85,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 10:01:09',NULL,NULL,0.00,NULL),('8508b5e9-20a9-4a7a-8cb2-d74006e31191','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',12.07,1.00,0.00,13.07,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 17:51:44',NULL,NULL,NULL,NULL),('89abe8fd-7d71-4e40-a275-9f60164215ea','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.95,0.70,0.00,7.65,'e9ca76b3-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 05:37:45',NULL,NULL,NULL,NULL),('8b1db9a1-2d80-4106-83e1-10c231953e2c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.85,0.69,0.00,7.54,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 09:28:45',NULL,NULL,NULL,''),('8b1f3bac-8bb1-4322-8ba4-81032c52ba33','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',3.85,0.16,0.00,4.01,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 01:03:53',NULL,NULL,0.00,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('8e13fb01-bd1e-4a8e-b031-facda22033f2','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.19,1.25,0.00,16.44,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 10:54:51',NULL,NULL,NULL,NULL),('8f3765c9-9651-49fc-9382-c8b0ee7da1d3','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',163.00,13.45,0.00,176.45,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 10:16:31',NULL,NULL,0.00,NULL),('921dd3ec-0dd8-40f3-ba96-42bbb8e3688d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.64,0.88,0.00,16.52,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 12:23:24',NULL,NULL,0.00,'503e4102-68a7-46e0-a4c9-e798b344ca7b'),('949ebb34-8285-4f62-90d5-6381a40c5a8c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.50,0.54,0.00,7.04,'e9ca7670-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 21:17:47',NULL,NULL,0.00,NULL),('94f38e52-e9a3-42c7-9b5a-93d32363e583','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',17.79,0.73,0.00,18.52,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 23:54:11',NULL,NULL,0.00,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('961abb66-0966-489b-af03-11adc536e782','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.00,0.60,0.00,6.60,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 11:49:29',NULL,NULL,NULL,''),('974f9a3c-f478-499f-a39b-fc6a539b8812','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',2.95,0.24,0.00,3.19,'e9ca7670-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 20:19:45',NULL,NULL,NULL,NULL),('9bb9cdd4-fcd7-4cb5-b722-092d02701ef2','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',5.84,0.58,0.00,6.42,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:50:46',NULL,NULL,NULL,NULL),('9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',14.69,1.47,0.00,16.16,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:05:29',NULL,NULL,NULL,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('9fecb2c9-99be-4911-b3bc-4ada6df83694','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',13.59,1.22,0.00,13.45,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:17:12',NULL,NULL,1.36,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('a1bdaff0-fa53-4fb9-84be-ecc792104091','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',2.25,0.23,0.00,2.48,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:20:18',NULL,NULL,NULL,NULL),('a1c83478-b3a6-4e7f-8955-b845ae437f70','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.54,1.28,0.00,16.82,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 19:41:41',NULL,NULL,NULL,NULL),('a29c0234-bd43-4d00-91d8-04125f6cb522','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',16.41,1.31,0.00,17.23,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 17:55:01',NULL,NULL,0.49,NULL),('a2d5c73b-8298-4915-a9fb-5d0b2675c54e','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',163.00,13.45,0.00,176.45,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 10:05:24',NULL,NULL,0.00,NULL),('aa190312-e5c5-4655-a044-e2bddc9f3057','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',9.99,1.00,0.00,10.99,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:20:52',NULL,NULL,NULL,'7acc70a5-8372-425f-a28c-adb7c239457e'),('ada4c8cb-3fb3-42e2-a7f3-3f751d44b977','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',3.85,0.16,0.00,4.01,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 01:18:48',NULL,NULL,0.00,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('ae3f93ad-d00e-40c0-a666-f33e7816ec7f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',33.78,3.38,0.00,37.16,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 11:52:22',NULL,NULL,NULL,''),('aff75fd0-4a08-42bb-baee-4b4974a10ca0','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',17.94,1.07,0.00,19.01,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 00:47:10',NULL,NULL,0.00,'503e4102-68a7-46e0-a4c9-e798b344ca7b'),('baf01e81-1f9f-44a0-8147-a261fc111adb','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.19,1.52,0.00,16.71,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:13:03',NULL,NULL,NULL,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('bba0eff6-fb3d-43e3-941a-9b6c2f375617','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.35,0.64,0.00,6.98,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 09:25:13',NULL,NULL,NULL,''),('becb1993-9d2e-429f-bc6c-c6d0979ca73f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',4.49,0.45,0.00,4.94,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:07:18',NULL,NULL,NULL,''),('c07fd97a-1f98-43dd-9a3c-eb0139cc1a8b','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',5.35,0.54,0.00,5.89,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 05:23:54',NULL,NULL,NULL,''),('c170a67c-2808-4ffa-ab76-a667eb62cc27','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',5.35,0.54,0.00,5.89,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 11:55:23',NULL,NULL,NULL,''),('c19baf5f-0db6-44a0-8fb3-86f58340815e','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',1.80,0.15,0.00,1.95,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 19:24:32',NULL,NULL,NULL,'0fe0c3a7-1096-4937-9a00-dfe6afa2efac'),('c5c365d9-1830-49c6-a1f3-89dbf702c045','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',2.85,0.29,0.00,3.14,'e9ca76b3-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 05:36:13',NULL,NULL,NULL,NULL),('c8de6ea9-3a62-42a7-8c6b-7f17208da11e','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',3.85,0.00,0.00,3.85,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 10:08:28',NULL,NULL,0.00,NULL),('cab72c77-0c99-4c84-88d6-978e43f6d8b0','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',3.85,0.00,0.00,3.85,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 10:21:41',NULL,NULL,0.00,NULL),('d103fd6a-33e6-4194-a0c0-c36c50418fb0','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',13.84,0.00,0.00,13.84,'e9ca7670-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 10:37:35',NULL,NULL,0.00,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('d3c4dec0-0b07-4a7c-8c7d-182530b7e9dc','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',163.00,13.45,0.00,176.45,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 10:37:12',NULL,NULL,0.00,NULL),('d566c786-767c-434e-8e60-7a0e26cd4923','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',9.94,0.99,0.00,10.93,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:18:27',NULL,NULL,NULL,'503e4102-68a7-46e0-a4c9-e798b344ca7b'),('d9b447a0-dc08-4a60-9653-f92be02668e9','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',4.10,0.00,0.00,0.00,'00000000-0000-0000-0000-000000000000',NULL,'completed','PAID','2025-05-22 17:13:39',NULL,NULL,4.10,NULL),('de34f1ec-4a2f-4b06-a7c8-dd7d00007f8a','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',163.00,13.45,0.00,176.45,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 09:58:00',NULL,NULL,0.00,NULL),('e14bbb18-dbe3-4641-b739-661f1a0de630','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.64,0.00,0.00,15.64,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-25 23:32:22',NULL,NULL,0.00,'503e4102-68a7-46e0-a4c9-e798b344ca7b'),('e2c93d4b-4bef-401c-9273-5f942e478218','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',1.99,0.16,0.00,2.15,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 17:59:01',NULL,NULL,NULL,NULL),('e6defc7a-8d1a-4dc7-a815-23aaf893a4ab','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',13.84,1.14,0.00,14.98,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 19:33:41',NULL,NULL,0.00,'566ea385-aadc-41cd-bfda-1b3fb8bb4edf'),('e826dc43-8a2c-440d-90dd-d65dcc1f595c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',7.80,0.32,0.00,8.12,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-26 10:38:50',NULL,NULL,0.00,'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),('e84a2ed6-cd12-401c-96b4-d219451f8fb0','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',8.10,0.81,0.00,8.91,'e9ca7670-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 05:39:06',NULL,NULL,NULL,NULL),('e89b7185-49d7-40ec-a320-fa8fdd65211c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f',6.59,0.66,0.00,7.25,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 04:24:37',NULL,NULL,NULL,''),('e8a5a9d0-b7df-4b8f-8040-abe21b26011d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',9.00,0.74,0.00,9.74,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 20:18:44',NULL,NULL,NULL,NULL),('e9208b05-33ce-4cd9-9197-f167d869e8d4','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',15.64,1.29,0.00,16.93,'e9ca75b4-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 19:26:40',NULL,NULL,0.00,'566ea385-aadc-41cd-bfda-1b3fb8bb4edf'),('ee07c583-f4c1-4fe8-9805-b12b57cdd5fd','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',7.45,0.61,0.00,8.06,'e9ca76b3-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 17:35:33',NULL,NULL,NULL,NULL),('ef6bbe6f-28e4-4d06-b0dc-a9cebb0df973','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',9.99,0.00,0.00,9.99,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 10:22:13',NULL,NULL,0.00,NULL),('f43996f0-c7ef-4e18-885e-f805a527a515','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.95,0.70,0.00,7.65,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 13:05:17',NULL,NULL,NULL,'f14d11c7-cd67-460a-8bff-2beea3980f85'),('f7dcbef4-1fec-4d10-860f-74aa554b29f3','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',3.85,0.00,0.00,3.85,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-24 10:00:23',NULL,NULL,0.00,NULL),('fb1207da-0027-4287-a488-3916982776a9','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f',9.94,0.99,0.00,10.93,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 14:20:06',NULL,NULL,NULL,NULL),('fe533d3a-4992-4a23-9111-b37af05e8426','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',10.08,0.83,0.00,10.91,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-22 17:55:23',NULL,NULL,NULL,NULL),('febad102-c9f8-4d81-ae17-6d773f28c402','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',6.95,0.70,0.00,7.65,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-21 12:54:51',NULL,NULL,NULL,NULL),('ffe373a2-b9a8-45e3-8757-8ec47f40f6ab','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d',11.49,0.95,0.00,12.44,'e9ca7524-35f4-11f0-8297-525400148990',NULL,'completed','PAID','2025-05-23 01:47:32',NULL,NULL,0.00,NULL);
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_adjustments`
--

DROP TABLE IF EXISTS `stock_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_adjustments` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `variant_id` varchar(36) DEFAULT NULL COMMENT 'For future product variant support',
  `user_id` varchar(36) NOT NULL COMMENT 'User performing the adjustment',
  `adjustment_type` enum('INCREMENT','DECREMENT') NOT NULL,
  `reason_code` varchar(50) NOT NULL COMMENT 'e.g., DAMAGED, CORRECTION, INITIAL_STOCK, RECEIVED_STOCK, PROMOTION_ADJ, THEFT, SPOILAGE, RETURN_TO_VENDOR, OTHER',
  `quantity_adjusted` int unsigned NOT NULL COMMENT 'Absolute value of quantity changed',
  `stock_before_adjustment` int NOT NULL,
  `stock_after_adjustment` int NOT NULL,
  `notes` text,
  `adjustment_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sa_product_id` (`product_id`),
  KEY `idx_sa_variant_id` (`variant_id`),
  KEY `idx_sa_user_id` (`user_id`),
  KEY `idx_sa_reason_code` (`reason_code`),
  KEY `idx_sa_adjustment_date` (`adjustment_date`),
  CONSTRAINT `stock_adjustments_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_adjustments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_adjustments`
--

LOCK TABLES `stock_adjustments` WRITE;
/*!40000 ALTER TABLE `stock_adjustments` DISABLE KEYS */;
INSERT INTO `stock_adjustments` VALUES ('2bfdcf0e-a0ea-4d7e-9dc2-bbaaf98a7522','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','b89be53e-f6b7-4005-9f32-9e890325c658',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','DECREMENT','SALE_TRANSACTION',11,10,-1,NULL,'2025-05-26 12:30:36','2025-05-26 12:30:36','2025-05-26 12:30:36'),('2e497a2c-e325-4bb2-b0d3-ccb09e6bb33e','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','a95dbb16-3ac2-48c8-a9b0-5a6e6656c884',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','DECREMENT','SALE_TRANSACTION',1,30,29,NULL,'2025-05-26 10:37:12','2025-05-26 10:37:12','2025-05-26 10:37:12'),('52f21898-9637-4af3-9d07-cb6547dce006','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','b82e1887-40f9-4475-b277-ef45e093bf56',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','DECREMENT','SALE_TRANSACTION',1,45,44,NULL,'2025-05-26 10:38:50','2025-05-26 10:38:50','2025-05-26 10:38:50'),('64e9633e-2b1d-41af-8414-fb805b8f67ff','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','3dcedd3f-0c34-44f5-b8da-08e372b219cf',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','INCREMENT','CORRECTION',2,19,21,'new','2025-05-26 00:00:00','2025-05-26 15:52:40','2025-05-26 15:52:40'),('892f1ac5-a9fe-4556-bc23-879790b8138a','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','3dcedd3f-0c34-44f5-b8da-08e372b219cf',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','DECREMENT','RETURN_TO_VENDOR',1,13,12,'resaasssds','2025-05-26 00:00:00','2025-05-26 15:19:50','2025-05-26 15:19:50'),('93a8743d-7384-429d-b563-4aca87aa9c64','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','3dcedd3f-0c34-44f5-b8da-08e372b219cf',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','INCREMENT','RECEIVED_STOCK',5,12,17,'new stock','2025-05-26 00:00:00','2025-05-26 15:38:52','2025-05-26 15:38:52'),('c1bfd898-0c6f-4f06-b7b1-fe5b513c8b14','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','3dcedd3f-0c34-44f5-b8da-08e372b219cf',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','INCREMENT','OTHER',1,12,13,'Returned from the vendor','2025-05-26 00:00:00','2025-05-26 15:31:49','2025-05-26 15:31:49'),('c8f25b36-e680-4463-ba55-97b5d68ca833','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','3dcedd3f-0c34-44f5-b8da-08e372b219cf',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','DECREMENT','PROMOTION_ADJ',1,13,12,'given to promotional team','2025-05-26 00:00:00','2025-05-26 15:36:45','2025-05-26 15:36:45'),('cd95e99a-f0c7-4a74-b3e1-37c676799b9a','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','3dcedd3f-0c34-44f5-b8da-08e372b219cf',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','INCREMENT','CORRECTION',2,17,19,NULL,'2025-05-26 00:00:00','2025-05-26 15:46:53','2025-05-26 15:46:53'),('d828210b-5022-4c10-9e3b-5cb8303c30a8','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','3dcedd3f-0c34-44f5-b8da-08e372b219cf',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','DECREMENT','CORRECTION',2,21,19,NULL,'2025-05-26 00:00:00','2025-05-26 15:59:09','2025-05-26 15:59:09'),('e952db1b-557f-4594-9f32-98fc90ef0d1d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','3dcedd3f-0c34-44f5-b8da-08e372b219cf',NULL,'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','INCREMENT','CORRECTION',1,19,20,NULL,'2025-05-26 00:00:00','2025-05-26 16:03:48','2025-05-26 16:03:48');
/*!40000 ALTER TABLE `stock_adjustments` ENABLE KEYS */;
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
  `currency_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'USD' COMMENT 'Standard ISO 4217 currency code, e.g., USD, EUR, INR',
  `language_code` varchar(5) DEFAULT NULL,
  `country_code` varchar(2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tax_config` json DEFAULT (json_object(_utf8mb4'default_rate',0.00,_utf8mb4'rules',json_array())),
  `discount_application_rule` varchar(20) DEFAULT 'BEFORE_TAX' COMMENT 'Can be BEFORE_TAX or AFTER_TAX',
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
INSERT INTO `stores` VALUES ('f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Zettaz Mart','123 Main Street, Anytown, CA 12345','+1 (123) 456-7890','store@zettaz.com',10.00,'INR','en-US','IN','2025-05-20 09:08:21','2025-05-26 09:43:47','{\"rules\": [], \"default_rate\": 0.1, \"default_tax_class_id\": \"92bd6f00-36f9-11f0-8297-525400148990\"}','BEFORE_TAX');
/*!40000 ALTER TABLE `stores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tax_class_rates`
--

DROP TABLE IF EXISTS `tax_class_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_class_rates` (
  `id` char(36) NOT NULL,
  `tax_class_id` char(36) NOT NULL,
  `tax_rate_name` varchar(100) NOT NULL COMMENT 'e.g., GST, PST, State Sales Tax, City Tax',
  `rate` decimal(7,5) NOT NULL COMMENT 'Tax rate, e.g., 0.05000 for 5%. Allows for rates like 12.345%',
  `priority` int NOT NULL DEFAULT '0' COMMENT 'Calculation order for taxes within the same class. Lower numbers first.',
  `is_compound` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0 = Applied on base price. 1 = Applied on (base price + sum of prior-priority taxes for this item).',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '0 = Inactive, 1 = Active. Allows disabling a rate without deleting.',
  `is_inclusive` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0 = Tax is added to price, 1 = Tax is included in price.',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tax_class_rates_class` (`tax_class_id`),
  CONSTRAINT `fk_tax_class_rates_class` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE CASCADE
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Defines individual tax rate components for a tax class.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tax_class_rates`
--

LOCK TABLES `tax_class_rates` WRITE;
/*!40000 ALTER TABLE `tax_class_rates` DISABLE KEYS */;
INSERT INTO `tax_class_rates` VALUES ('92bfa003-36f9-11f0-8297-525400148990','92bd6f00-36f9-11f0-8297-525400148990','General Sales Tax',0.08250,0,0,1,0,'2025-05-22 10:43:18','2025-05-22 10:43:18'),('92c075ec-36f9-11f0-8297-525400148990','92be2844-36f9-11f0-8297-525400148990','Reduced Item Tax',0.05000,0,0,1,0,'2025-05-22 10:43:18','2025-05-22 10:43:18'),('92c13ae3-36f9-11f0-8297-525400148990','92bed9d4-36f9-11f0-8297-525400148990','Exempt Rate',0.00000,0,0,1,0,'2025-05-22 10:43:18','2025-05-22 10:43:18');
/*!40000 ALTER TABLE `tax_class_rates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tax_classes`
--

DROP TABLE IF EXISTS `tax_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_classes` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'e.g., Standard Sales Tax, Food Items (Reduced Rate), Services (GST + QST), Tax Exempt',
  `description` text COMMENT 'Optional detailed description of the tax class.',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_default` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0 = Not default, 1 = Default tax class for new products.',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tax_classes_tenant` (`tenant_id`),
  CONSTRAINT `fk_tax_classes_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Defines categories of tax rules (e.g., standard, reduced, exempt).';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tax_classes`
--

LOCK TABLES `tax_classes` WRITE;
/*!40000 ALTER TABLE `tax_classes` DISABLE KEYS */;
INSERT INTO `tax_classes` VALUES ('92bd6f00-36f9-11f0-8297-525400148990','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Standard Sales Tax','Standard sales tax applicable to most goods and services.',1,1,'2025-05-22 10:43:18','2025-05-22 10:43:18'),('92be2844-36f9-11f0-8297-525400148990','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Reduced Rate Tax','Reduced tax rate for specific categories of items (e.g., certain food items).',1,0,'2025-05-22 10:43:18','2025-05-22 10:43:18'),('92bed9d4-36f9-11f0-8297-525400148990','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Tax Exempt','Items or customers exempt from sales tax.',1,0,'2025-05-22 10:43:18','2025-05-22 10:43:18');
/*!40000 ALTER TABLE `tax_classes` ENABLE KEYS */;
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
) /*!50100 TABLESPACE `digitpulse_zcloudep` */ ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tenant-specific payment settings';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_payment_settings`
--

LOCK TABLES `tenant_payment_settings` WRITE;
/*!40000 ALTER TABLE `tenant_payment_settings` DISABLE KEYS */;
INSERT INTO `tenant_payment_settings` VALUES ('d7f267da-d5d9-4a15-b0d3-31ca710a4492','INR',1,0,10.00,NULL,'2025-05-21 03:37:25','2025-05-21 03:37:25');
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
INSERT INTO `tenants` VALUES ('d7f267da-d5d9-4a15-b0d3-31ca710a4492','Zettaz Demo Store','demo.zettaz.com','{\"allow_negative_stock\": true}','2025-05-20 09:08:21','2025-05-26 02:23:21');
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
  `phone_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','manager','cashier') NOT NULL,
  `profile_picture_url` varchar(255) DEFAULT NULL,
  `store_id` char(36) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_login_at` datetime DEFAULT NULL,
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
INSERT INTO `users` VALUES ('a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Naresh','admin@zettaz.com','+12684642003','$2b$10$KNcoR4qLxzIeA3y7ymAFceQF6mXM4sGA9pJdrkztcTW3O5IGYubEi','admin',NULL,'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c',1,'2025-05-20 09:08:21','2025-05-20 09:08:21','2025-05-26 09:39:01'),('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e','d7f267da-d5d9-4a15-b0d3-31ca710a4492','John','manager@zettaz.com',NULL,'$2b$10$KNcoR4qLxzIeA3y7ymAFceQF6mXM4sGA9pJdrkztcTW3O5IGYubEi','manager',NULL,'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c',1,NULL,'2025-05-20 09:08:21','2025-05-21 13:53:51'),('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f','d7f267da-d5d9-4a15-b0d3-31ca710a4492','Linda','cashier@zettaz.com',NULL,'$2b$10$KNcoR4qLxzIeA3y7ymAFceQF6mXM4sGA9pJdrkztcTW3O5IGYubEi','cashier',NULL,'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c',1,NULL,'2025-05-20 09:08:21','2025-05-21 13:53:51');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'digitpulse_zcloudep'
--
