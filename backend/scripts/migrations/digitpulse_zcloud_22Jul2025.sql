-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 10.123.0.165:3306
-- Generation Time: Jul 22, 2025 at 07:46 PM
-- Server version: 8.4.5
-- PHP Version: 8.2.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `digitpulse_zcloud`
--

DELIMITER $$
--
-- Functions
--
CREATE DEFINER=`digitpulse_zcloud`@`%` FUNCTION `uuid_v4` () RETURNS CHAR(36) CHARSET utf8mb4 DETERMINISTIC NO SQL BEGIN
    DECLARE h1 CHAR(4);
    DECLARE h2 CHAR(4);
    DECLARE h3 CHAR(4);
    DECLARE h4 CHAR(4);
    DECLARE h5 CHAR(4);
    DECLARE h6 CHAR(4);
    DECLARE h7 CHAR(4);
    DECLARE h8 CHAR(4);

    SET h1 = HEX(FLOOR(RAND() * 0xffff));
    SET h2 = HEX(FLOOR(RAND() * 0xffff));
    SET h3 = HEX(FLOOR(RAND() * 0xffff));
    SET h4 = HEX(FLOOR(RAND() * 0x0fff) | 0x4000);
    SET h5 = HEX(FLOOR(RAND() * 0x3fff) | 0x8000);
    SET h6 = HEX(FLOOR(RAND() * 0xffff));
    SET h7 = HEX(FLOOR(RAND() * 0xffff));
    SET h8 = HEX(FLOOR(RAND() * 0xffff));

    RETURN LOWER(CONCAT(
        LPAD(h1, 4, '0'), LPAD(h2, 4, '0'), '-',
        LPAD(h3, 4, '0'), '-', LPAD(h4, 4, '0'), '-',
        LPAD(h5, 4, '0'), '-', LPAD(h6, 4, '0'),
        LPAD(h7, 4, '0'), LPAD(h8, 4, '0')
    ));
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

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
  `updated_by_user_id` char(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `tenant_id`, `name`, `description`, `image_url`, `is_active`, `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`) VALUES
('09cd8deb-225c-43d5-9b0a-5d56ad8498a0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Fruits & Vegetables', 'Fresh fruits and seasonal vegetables', NULL, 1, '2025-05-20 11:08:34', '2025-05-25 08:49:00', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('274e7df8-0670-4f11-86a9-768d2c144337', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Personal Care', 'Personal Care Products like hair, body, etc..', NULL, 1, '2025-05-25 09:44:33', '2025-05-25 09:44:33', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('2c2c5815-5f0a-48fc-b85a-54386f7e81b7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Gadgets', NULL, NULL, 1, '2025-05-24 22:46:16', '2025-05-25 08:49:00', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('30a8084c-b4e3-432a-ab8c-5fa8557bb339', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Snacks', 'Chips, cookies, and other snack items', NULL, 1, '2025-05-20 09:08:21', '2025-05-25 08:49:00', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('3ff8552b-2b1c-438c-abd3-6231f9195b00', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Jewelry', 'Timeless Solitaire Engagement Ring', '/uploads/categories/image-1748239172736-35512361.png', 1, '2025-05-26 05:59:32', '2025-05-26 05:59:32', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('7e524fba-cb2e-431c-a6a2-9c845196c878', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Beverages', 'Juices, sodas, and energy drinks', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492/categories/image-1748261988655-359601026.jpg', 1, '2025-05-20 11:08:34', '2025-05-26 12:19:48', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('979b1b2d-e7dd-4e29-80d0-27eb7f935513', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Bakery', 'Freshly baked bread, pastries, and cakes', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492/categories/image-1748262025296-701716745.jpg', 1, '2025-05-20 11:08:34', '2025-06-18 07:05:02', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('a52d3611-6578-4868-88fe-f704249603d3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Deli', NULL, NULL, 1, '2025-05-25 08:52:06', '2025-05-25 08:52:06', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('c56855f9-54e8-4986-b515-00d34cd632c6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Hair Care', 'Hair care products', '/uploads/categories/image-1748172518145-259409736.webp', 1, '2025-05-25 11:28:38', '2025-05-25 11:28:38', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('e34033d9-029f-4f68-a0fb-3a6a451f53b8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Meat & Seafood', 'Fresh meat, poultry, and seafood', '/uploads/categories/image-1748175306198-148539196.webp', 1, '2025-05-20 11:08:34', '2025-05-25 12:15:06', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Dairy & Eggs', 'Milk, cheese, butter, and eggs', NULL, 1, '2025-05-20 11:08:34', '2025-05-25 08:49:00', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('f689ca7d-ad61-439a-a446-91a247a09423', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Pantry Staples', 'Rice, flour, oils, and other kitchen essentials', NULL, 0, '2025-05-20 11:08:34', '2025-05-25 10:20:42', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('ff56c4d9-39f3-4ca5-bb62-1db552fd8aa4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Nail Care', 'Nail Care', '/uploads/categories/image-1748172911058-277038600.jpg', 1, '2025-05-25 11:35:11', '2025-05-25 11:35:11', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d');

-- --------------------------------------------------------

--
-- Table structure for table `countries`
--

CREATE TABLE `countries` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ISO 3166-1 alpha-2 code',
  `code3` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ISO 3166-1 alpha-3 code',
  `phone_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Country calling code',
  `currency_code` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ISO 4217 currency code',
  `flag_emoji` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Flag emoji unicode',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `countries`
--

INSERT INTO `countries` (`id`, `name`, `code`, `code3`, `phone_code`, `currency_code`, `flag_emoji`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
('342c752d-3832-11f0-8297-525400148990', 'United States', 'US', 'USA', '1', 'USD', '🇺🇸', 1, 1, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c782a-3832-11f0-8297-525400148990', 'Canada', 'CA', 'CAN', '1', 'CAD', '🇨🇦', 1, 2, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c7b3e-3832-11f0-8297-525400148990', 'Mexico', 'MX', 'MEX', '52', 'MXN', '🇲🇽', 1, 3, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c7c37-3832-11f0-8297-525400148990', 'United Kingdom', 'GB', 'GBR', '44', 'GBP', '🇬🇧', 1, 4, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c7cfd-3832-11f0-8297-525400148990', 'Australia', 'AU', 'AUS', '61', 'AUD', '🇦🇺', 1, 5, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c7dc1-3832-11f0-8297-525400148990', 'Germany', 'DE', 'DEU', '49', 'EUR', '🇩🇪', 1, 6, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c7ee6-3832-11f0-8297-525400148990', 'France', 'FR', 'FRA', '33', 'EUR', '🇫🇷', 1, 7, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c7f9c-3832-11f0-8297-525400148990', 'Japan', 'JP', 'JPN', '81', 'JPY', '🇯🇵', 1, 8, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8070-3832-11f0-8297-525400148990', 'China', 'CN', 'CHN', '86', 'CNY', '🇨🇳', 1, 9, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8131-3832-11f0-8297-525400148990', 'India', 'IN', 'IND', '91', 'INR', '🇮🇳', 1, 10, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8216-3832-11f0-8297-525400148990', 'Brazil', 'BR', 'BRA', '55', 'BRL', '🇧🇷', 1, 11, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8540-3832-11f0-8297-525400148990', 'Russia', 'RU', 'RUS', '7', 'RUB', '🇷🇺', 1, 12, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8622-3832-11f0-8297-525400148990', 'Italy', 'IT', 'ITA', '39', 'EUR', '🇮🇹', 1, 13, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c86b6-3832-11f0-8297-525400148990', 'Spain', 'ES', 'ESP', '34', 'EUR', '🇪🇸', 1, 14, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c875e-3832-11f0-8297-525400148990', 'Netherlands', 'NL', 'NLD', '31', 'EUR', '🇳🇱', 1, 15, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c895d-3832-11f0-8297-525400148990', 'Sweden', 'SE', 'SWE', '46', 'SEK', '🇸🇪', 1, 16, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8a08-3832-11f0-8297-525400148990', 'Norway', 'NO', 'NOR', '47', 'NOK', '🇳🇴', 1, 17, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8aaf-3832-11f0-8297-525400148990', 'Denmark', 'DK', 'DNK', '45', 'DKK', '🇩🇰', 1, 18, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8b4e-3832-11f0-8297-525400148990', 'Finland', 'FI', 'FIN', '358', 'EUR', '🇫🇮', 1, 19, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8bf0-3832-11f0-8297-525400148990', 'Switzerland', 'CH', 'CHE', '41', 'CHF', '🇨🇭', 1, 20, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8c8a-3832-11f0-8297-525400148990', 'Austria', 'AT', 'AUT', '43', 'EUR', '🇦🇹', 1, 21, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8d27-3832-11f0-8297-525400148990', 'Belgium', 'BE', 'BEL', '32', 'EUR', '🇧🇪', 1, 22, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8dbd-3832-11f0-8297-525400148990', 'Ireland', 'IE', 'IRL', '353', 'EUR', '🇮🇪', 1, 23, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8e46-3832-11f0-8297-525400148990', 'Portugal', 'PT', 'PRT', '351', 'EUR', '🇵🇹', 1, 24, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8eae-3832-11f0-8297-525400148990', 'Greece', 'GR', 'GRC', '30', 'EUR', '🇬🇷', 1, 25, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8f15-3832-11f0-8297-525400148990', 'South Africa', 'ZA', 'ZAF', '27', 'ZAR', '🇿🇦', 1, 26, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8f7a-3832-11f0-8297-525400148990', 'New Zealand', 'NZ', 'NZL', '64', 'NZD', '🇳🇿', 1, 27, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c8fde-3832-11f0-8297-525400148990', 'Singapore', 'SG', 'SGP', '65', 'SGD', '🇸🇬', 1, 28, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9043-3832-11f0-8297-525400148990', 'South Korea', 'KR', 'KOR', '82', 'KRW', '🇰🇷', 1, 29, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c90a7-3832-11f0-8297-525400148990', 'Indonesia', 'ID', 'IDN', '62', 'IDR', '🇮🇩', 1, 30, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c910c-3832-11f0-8297-525400148990', 'Malaysia', 'MY', 'MYS', '60', 'MYR', '🇲🇾', 1, 31, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c916e-3832-11f0-8297-525400148990', 'Philippines', 'PH', 'PHL', '63', 'PHP', '🇵🇭', 1, 32, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9349-3832-11f0-8297-525400148990', 'Thailand', 'TH', 'THA', '66', 'THB', '🇹🇭', 1, 33, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9553-3832-11f0-8297-525400148990', 'Vietnam', 'VN', 'VNM', '84', 'VND', '🇻🇳', 1, 34, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9662-3832-11f0-8297-525400148990', 'Argentina', 'AR', 'ARG', '54', 'ARS', '🇦🇷', 1, 35, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9802-3832-11f0-8297-525400148990', 'Chile', 'CL', 'CHL', '56', 'CLP', '🇨🇱', 1, 36, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c98f0-3832-11f0-8297-525400148990', 'Colombia', 'CO', 'COL', '57', 'COP', '🇨🇴', 1, 37, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c99a3-3832-11f0-8297-525400148990', 'Peru', 'PE', 'PER', '51', 'PEN', '🇵🇪', 1, 38, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9b78-3832-11f0-8297-525400148990', 'Venezuela', 'VE', 'VEN', '58', 'VES', '🇻🇪', 1, 39, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9c76-3832-11f0-8297-525400148990', 'Egypt', 'EG', 'EGY', '20', 'EGP', '🇪🇬', 1, 40, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9e00-3832-11f0-8297-525400148990', 'Nigeria', 'NG', 'NGA', '234', 'NGN', '🇳🇬', 1, 41, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9f15-3832-11f0-8297-525400148990', 'Kenya', 'KE', 'KEN', '254', 'KES', '🇰🇪', 1, 42, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342c9fd3-3832-11f0-8297-525400148990', 'Ghana', 'GH', 'GHA', '233', 'GHS', '🇬🇭', 1, 43, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342ca143-3832-11f0-8297-525400148990', 'Morocco', 'MA', 'MAR', '212', 'MAD', '🇲🇦', 1, 44, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342ca1e5-3832-11f0-8297-525400148990', 'Saudi Arabia', 'SA', 'SAU', '966', 'SAR', '🇸🇦', 1, 45, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342ca2a0-3832-11f0-8297-525400148990', 'United Arab Emirates', 'AE', 'ARE', '971', 'AED', '🇦🇪', 1, 46, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342ca356-3832-11f0-8297-525400148990', 'Israel', 'IL', 'ISR', '972', 'ILS', '🇮🇱', 1, 47, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342ca3fb-3832-11f0-8297-525400148990', 'Turkey', 'TR', 'TUR', '90', 'TRY', '🇹🇷', 1, 48, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342ca495-3832-11f0-8297-525400148990', 'Poland', 'PL', 'POL', '48', 'PLN', '🇵🇱', 1, 49, '2025-05-24 00:01:12', '2025-05-24 00:01:12'),
('342ca4fc-3832-11f0-8297-525400148990', 'Ukraine', 'UA', 'UKR', '380', 'UAH', '🇺🇦', 1, 50, '2025-05-24 00:01:12', '2025-05-24 00:01:12');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

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
  `payment_terms_days` int DEFAULT '30' COMMENT 'Number of days allowed for payment before considered overdue',
  `is_tax_exempt` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether this customer is exempt from taxes (1=exempt, 0=not exempt)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `tenant_id`, `store_id`, `first_name`, `last_name`, `email`, `phone_number`, `address_line1`, `address_line2`, `city`, `state_province`, `postal_code`, `country`, `country_id`, `customer_type`, `loyalty_id`, `tax_id_number`, `notes`, `credit_limit`, `outstanding_credit`, `is_active`, `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `default_discount_type`, `default_discount_value`, `birth_date`, `website`, `preferred_communication`, `preferred_payment_method`, `referral_source`, `company_name`, `currency_code`, `portal_status`, `portal_language`, `payment_terms_days`, `is_tax_exempt`) VALUES
('0528f5f8-3628-11f0-8297-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Guest', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-21 09:43:16', '2025-06-08 09:02:11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('07bd99c2-b357-43dc-b7de-cc17e573d356', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Sudhir', 'Modi', 'smodi@hotmail.com', '', '', '', '', '', '', '', NULL, 'INDIVIDUAL', NULL, '', '', 20000.00, 0.00, 1, '2025-06-17 15:12:06', '2025-06-17 15:12:06', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Sudhir & Co', NULL, 'disabled', 'en', 30, 1),
('083e0734-5aed-42e3-b978-c5a3d524c9e4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Samuel', 'Bailey', 'sam@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 6011.61, 1, '2025-04-22 06:23:49', '2025-06-09 12:54:47', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'fixed', 10.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('19c25cfa-02e8-4cdd-ba32-d488c9e18b39', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Sivakumar', 'Thangarasu', 'siva@gmail.com', '2143162116', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-04-22 06:23:49', '2025-05-24 00:59:41', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('19ca2e12-41b2-41b5-bec3-fe0cefd64c09', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Cameron', 'Dias', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-27 23:10:40', '2025-05-27 23:10:40', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('37eeebc2-83d0-469a-95d8-0ffebc67e579', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Bhanu', 'Teja', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-04-22 06:23:49', '2025-05-24 00:59:41', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('503e4102-68a7-46e0-a4c9-e798b344ca7b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Naresh', 'Velusamy', 'naresh@digitpulse.com', '3149287001', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 800.00, 8979.86, 1, '2025-05-21 10:20:16', '2025-06-09 12:27:02', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'fixed', 5.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('566ea385-aadc-41cd-bfda-1b3fb8bb4edf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Ron', 'Schofield', 'ron@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 1200.00, 50.95, 1, '2025-05-21 11:51:57', '2025-05-25 23:21:52', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('5f9d994d-7aa3-4f0d-b30e-f4264eed54e3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Daniel', 'Craig', 'dani@dani.com', '12367783344', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'RETAIL', NULL, NULL, NULL, 0.00, 68.13, 1, '2025-05-24 00:54:36', '2025-06-06 08:06:25', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, 'email', NULL, 'search', NULL, NULL, 'disabled', 'en', 30, 0),
('6d2fd998-111e-4f90-b838-cbba1ff0ab8e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Chester', 'John', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 2716.80, 1, '2025-05-28 00:30:26', '2025-06-09 12:20:15', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('76d870d4-06c3-4646-bf4b-e6d9f9dad94a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Sunil', 'Mathew', 'sunil@live.com', '+919730355777', 'Manalmettu Thottam', 'K. Keeranur', 'Dindigul', 'Tamilnadu', '624616', NULL, NULL, 'WHOLESALE', NULL, NULL, 'whole sale customer', 100.00, 0.00, 1, '2025-05-24 00:57:54', '2025-05-24 00:57:54', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'percentage', 10.00, '2004-02-21', NULL, 'email', 'cash', 'Friend/Family', NULL, NULL, 'disabled', 'en', 30, 0),
('7acc70a5-8372-425f-a28c-adb7c239457e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Donald', 'Bailey', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 1817.14, 1, '2025-05-21 10:40:05', '2025-06-09 16:21:39', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'percentage', 50.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('805159a6-a30b-4ed5-aa64-49b285c28ab7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Subman', 'Gill', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-28 00:26:28', '2025-05-28 00:26:28', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('984744d1-4fad-413f-bace-60eede30e314', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Jody', 'Meyer', 'jody@meyer.com', '', '', '', '', '', '', '', NULL, 'INDIVIDUAL', '', '', '', 0.00, 0.00, 1, '2025-05-25 14:11:12', '2025-05-25 14:11:35', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', NULL, 'disabled', 'en', 30, 0),
('9b17864c-e087-4ae4-ac47-c46eb2875547', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Simon', 'Daley', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-06-03 10:05:56', '2025-06-03 10:05:56', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('a0779cca-ad4a-441f-b569-de149ffdced0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Shaquel', 'Watkins', '', '', '', '', '', '', '', '', NULL, 'INDIVIDUAL', NULL, '', '', 0.00, 0.00, 1, '2025-06-17 15:37:38', '2025-06-17 15:37:38', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', NULL, 'disabled', 'en', 30, 0),
('a55431f3-009d-4fcf-9b1b-27d0a1196e40', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Majorie', 'Parchment', '', '', '', '', '', '', '', '', NULL, 'INDIVIDUAL', '', '', '', 0.00, 0.00, 1, '2025-06-17 16:12:41', '2025-06-17 18:20:37', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', NULL, 'disabled', 'en', 30, 0),
('a7520069-1ce5-43a7-8980-2471d5b1eb41', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Ravi', 'Kithai', 'ravi@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-22 19:13:21', '2025-05-22 19:13:21', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('a98644da-bc81-481b-9b1a-a9de5ee8468d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Mario', 'Benjamin', 'mario@gmail.com', '268 123 4444', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 5654.17, 1, '2025-06-09 12:35:55', '2025-06-09 12:37:46', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('ac5d853a-6e91-4275-ad94-1c3601e40892', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Donald', 'Trump', 'donald@trump.com', '12224643000', '', '', '', '', '', '', NULL, 'BUSINESS', '', '', '', 2000.00, 879.60, 1, '2025-05-23 23:40:44', '2025-06-09 13:39:44', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'percentage', 10.00, '1957-01-02', 'https://trump.com', 'email', NULL, 'Friend/Family', '', NULL, 'disabled', 'en', 30, 0),
('b7da1737-a1b0-437b-b9d2-1606adfa756f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Marvin', 'Jose', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-28 00:22:15', '2025-05-28 00:22:15', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('cd04a0be-3483-44aa-a218-d9a15bdf6168', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Andy', 'Brueman', '', '', '', '', '', '', '', '', NULL, 'INDIVIDUAL', '', '', '', 0.00, 0.00, 1, '2025-05-27 23:03:04', '2025-06-12 21:19:48', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', NULL, 'disabled', 'en', 30, 1),
('da0b388e-61e1-4c8a-9a15-b5f09a719276', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Andy', 'John', 'andy@john.com', '2342342ddd', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-27 18:50:50', '2025-05-27 18:50:50', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('da5d7968-78b8-4de3-8d0c-3cca39789a2b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Tim', 'Cook', 'time@cook.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-27 23:08:50', '2025-05-27 23:08:50', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('dd38133a-18d2-47c4-9097-8ba99a1214ab', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Siv', 'Chanderpal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-28 00:33:57', '2025-05-28 00:33:57', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('e7055f1a-f6f4-40a3-9a29-46c9552fadaf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Asmatullah', 'Jan', 'asmat@gmail.com', '', '', '', '', '', '', '', NULL, 'INDIVIDUAL', NULL, '', '', 100000.00, 0.00, 1, '2025-06-17 15:18:36', '2025-06-17 15:18:36', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Diamond Republic', NULL, 'disabled', 'en', 30, 0),
('ec16e637-fdd8-4594-b7a7-31495b9ab95f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Gaston', 'Browne', 'gason@gastonbrowne.com', '+12684645001', 'Prime Ministers Office', 'Queen Elizabeth Highway', 'Saint Johns', 'Saint John', '00000', 'Antigua & Barbuda', NULL, 'BUSINESS', '100200125', NULL, 'Potential Client', 1000.00, 744.08, 1, '2025-05-23 22:55:00', '2025-06-09 16:32:53', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'percentage', 20.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 7, 0),
('ecf5b65f-e11f-4dcb-91df-cc5f90697c30', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Pushpalatha', 'Thangarasu', 'pushpalatha.thanga@gmail.com', '2143162116', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 500.00, 5604.59, 1, '2025-05-21 10:34:10', '2025-06-09 12:57:18', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'percentage', 50.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('f14d11c7-cd67-460a-8bff-2beea3980f85', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Chinna', 'Thambi', 'thambi@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-21 12:21:32', '2025-05-21 12:21:32', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0),
('f4c27eb1-767b-40e2-8480-6c2e6b0f4ef2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', NULL, 'Kishore', 'Rajpal', 'jiyarajpal@yahoo.com', '', '', '', '', '', '', '', NULL, 'INDIVIDUAL', NULL, '', '', 0.00, 0.00, 1, '2025-06-17 15:21:53', '2025-06-17 15:21:53', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '', NULL, 'disabled', 'en', 30, 0),
('f71b38cf-5dc8-4e37-ab69-981b3773b137', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Mathew', 'Fernandez', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'INDIVIDUAL', NULL, NULL, NULL, 0.00, 0.00, 1, '2025-05-27 18:55:24', '2025-05-27 18:55:24', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'disabled', 'en', 30, 0);

-- --------------------------------------------------------

--
-- Table structure for table `customer_activity_log`
--

CREATE TABLE `customer_activity_log` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_contacts`
--

CREATE TABLE `customer_contacts` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  `position` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `goods_received_notes`
--

CREATE TABLE `goods_received_notes` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `store_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT 'FK to stores.id',
  `grn_number` varchar(50) NOT NULL,
  `supplier_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `purchase_order_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `received_date` date NOT NULL,
  `notes` text,
  `supplier_invoice_number` varchar(100) DEFAULT NULL,
  `supplier_invoice_date` date DEFAULT NULL,
  `received_by_user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL COMMENT 'FK to users.id, creator of the GRN',
  `status` varchar(20) NOT NULL DEFAULT 'COMPLETED',
  `total_received_value` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_tax_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `shipping_handling_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `other_charges_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `grand_total` decimal(15,2) GENERATED ALWAYS AS ((((coalesce(`total_received_value`,0) + coalesce(`total_tax_paid`,0)) + coalesce(`shipping_handling_paid`,0)) + coalesce(`other_charges_paid`,0))) STORED COMMENT 'Total value including taxes and charges',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `goods_received_notes`
--

INSERT INTO `goods_received_notes` (`id`, `tenant_id`, `store_id`, `grn_number`, `supplier_id`, `purchase_order_id`, `received_date`, `notes`, `supplier_invoice_number`, `supplier_invoice_date`, `received_by_user_id`, `user_id`, `status`, `total_received_value`, `total_tax_paid`, `shipping_handling_paid`, `other_charges_paid`, `created_at`, `updated_at`) VALUES
('7874d4ea-624f-4fbb-8130-2a36ca258691', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'GRN-2506-f8c4-10001', 'd1f3a980-0a3a-4e5c-b15a-92c174caeec1', NULL, '2025-06-02', NULL, '234', '2025-06-01', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'COMPLETED', 508.24, 234.00, 23.00, 23.00, '2025-06-03 09:20:59', '2025-06-03 09:22:46'),
('c630ee88-cfb9-4e26-952f-6da3098c36f3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'GRN-2506-f8c4-10003', 'd1f3a980-0a3a-4e5c-b15a-92c174caeec1', NULL, '2025-06-01', NULL, '12', '2025-06-02', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'COMPLETED', 1000.00, 0.00, 0.00, 0.00, '2025-06-03 09:22:35', '2025-06-03 09:23:11'),
('f53a7fa1-9eb5-4fab-977f-8ff59dc89cd4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'GRN-2506-f8c4-10002', 'd1f3a980-0a3a-4e5c-b15a-92c174caeec1', NULL, '2025-06-03', NULL, '1234', '2025-06-02', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'COMPLETED', 150.00, 0.00, 0.00, 0.00, '2025-06-03 09:21:53', '2025-06-03 09:21:53');

-- --------------------------------------------------------

--
-- Table structure for table `grn_items`
--

CREATE TABLE `grn_items` (
  `id` varchar(36) NOT NULL,
  `grn_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `product_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `purchase_order_item_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `quantity_ordered` decimal(10,2) DEFAULT NULL,
  `quantity_received` decimal(10,2) NOT NULL,
  `unit_cost_price` decimal(15,2) NOT NULL,
  `line_total` decimal(15,2) GENERATED ALWAYS AS ((`quantity_received` * `unit_cost_price`)) STORED,
  `tax_rate` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT 'Tax rate percentage, e.g., 10.00 for 10%',
  `tax_amount` decimal(15,2) GENERATED ALWAYS AS ((((`quantity_received` * `unit_cost_price`) * `tax_rate`) / 100.00)) STORED COMMENT 'Calculated tax amount for the line',
  `line_total_with_tax` decimal(15,2) GENERATED ALWAYS AS (((`quantity_received` * `unit_cost_price`) + (((`quantity_received` * `unit_cost_price`) * `tax_rate`) / 100.00))) STORED COMMENT 'Line total including tax',
  `batch_number` varchar(50) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `grn_items`
--

INSERT INTO `grn_items` (`id`, `grn_id`, `product_id`, `purchase_order_item_id`, `quantity_ordered`, `quantity_received`, `unit_cost_price`, `tax_rate`, `batch_number`, `expiry_date`, `remarks`, `created_at`, `updated_at`) VALUES
('7aa756ea-e6f9-4c20-b922-8c96e7e9e8f8', 'f53a7fa1-9eb5-4fab-977f-8ff59dc89cd4', 'e03dc952-7f98-421d-924b-4f819abe666e', '1c5e5c30-c4a3-4cd3-ba32-a75acabe2525', 50.00, 50.00, 3.00, 0.00, NULL, NULL, NULL, '2025-06-03 09:21:53', '2025-06-03 09:21:53'),
('885fca55-c999-4a07-89a9-5780db0ed01b', '7874d4ea-624f-4fbb-8130-2a36ca258691', 'b193d1a1-94f6-405a-b13f-15a1d594f403', '97b8d9b6-2a30-44f4-b540-608427d00863', NULL, 35.00, 10.00, 0.00, NULL, NULL, NULL, '2025-06-03 09:22:45', '2025-06-03 09:22:45'),
('9497d737-fac9-457b-9303-138e4d0af630', 'c630ee88-cfb9-4e26-952f-6da3098c36f3', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 'a27a7221-1602-4b42-b384-d100486aa43c', NULL, 100.00, 10.00, 0.00, NULL, NULL, NULL, '2025-06-03 09:23:11', '2025-06-03 09:23:11'),
('a4e8fab6-1d65-4e6e-975f-32cc6b9ca8c1', '7874d4ea-624f-4fbb-8130-2a36ca258691', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 'e20fe480-02f2-40d9-9917-a76222ea03d0', NULL, 43.00, 3.68, 0.00, NULL, NULL, NULL, '2025-06-03 09:22:45', '2025-06-03 09:22:45');

-- --------------------------------------------------------

--
-- Table structure for table `held_orders`
--

CREATE TABLE `held_orders` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `cashier_id` char(36) NOT NULL,
  `items` json NOT NULL,
  `note` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_logs`
--

CREATE TABLE `inventory_logs` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `store_id` varchar(36) DEFAULT NULL COMMENT 'FK to stores.id, if inventory is store-specific',
  `quantity_change` decimal(10,2) NOT NULL COMMENT 'Change in quantity, positive for increase, negative for decrease',
  `reference_type` varchar(50) DEFAULT NULL COMMENT 'e.g., GRN_ITEM, SALE_ITEM, ADJUSTMENT',
  `reference_id` varchar(36) DEFAULT NULL COMMENT 'ID of the source document/item (e.g., grn_items.id)',
  `reason` text,
  `current_stock_before_change` decimal(10,2) DEFAULT NULL COMMENT 'Stock level of the product before this change',
  `current_stock_after_change` decimal(10,2) DEFAULT NULL COMMENT 'Stock level of the product after this change',
  `created_by` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `inventory_logs`
--

INSERT INTO `inventory_logs` (`id`, `tenant_id`, `product_id`, `store_id`, `quantity_change`, `reference_type`, `reference_id`, `reason`, `current_stock_before_change`, `current_stock_after_change`, `created_by`, `created_at`) VALUES
('0edcb4a2-2f3d-42be-a21d-627c356ff1f3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 43.00, 'GRN_STATUS_COMMITMENT', '7874d4ea-624f-4fbb-8130-2a36ca258691', 'GRN GRN-2506-f8c4-10001 status changed from DRAFT to COMPLETED (via updateGrn)', 86.00, 129.00, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', '2025-06-03 09:22:45'),
('25d1e3fe-d54a-48d7-87fa-bda8bd8f343e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'e03dc952-7f98-421d-924b-4f819abe666e', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 50.00, 'GRN_ITEM', '7aa756ea-e6f9-4c20-b922-8c96e7e9e8f8', 'GRN Receipt: GRN-2506-f8c4-10002', 450.00, 500.00, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', '2025-06-03 09:21:53'),
('342528f8-ad3d-499b-983e-e031171e4550', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 100.00, 'GRN_STATUS_COMMITMENT', 'c630ee88-cfb9-4e26-952f-6da3098c36f3', 'GRN GRN-2506-f8c4-10003 status changed from DRAFT to COMPLETED (via updateGrn)', 550.00, 650.00, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', '2025-06-03 09:23:11'),
('97b5ab54-ffe9-4737-8d28-e8f902d7e291', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 35.00, 'GRN_STATUS_COMMITMENT', '7874d4ea-624f-4fbb-8130-2a36ca258691', 'GRN GRN-2506-f8c4-10001 status changed from DRAFT to COMPLETED (via updateGrn)', 125.00, 160.00, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', '2025-06-03 09:22:45');

-- --------------------------------------------------------

--
-- Table structure for table `offer_price_tiers`
--

CREATE TABLE `offer_price_tiers` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) NOT NULL,
  `offer_id` varchar(36) NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `offer_price_tiers`
--

INSERT INTO `offer_price_tiers` (`id`, `tenant_id`, `store_id`, `offer_id`, `quantity`, `price`, `created_at`, `updated_at`) VALUES
('39bfd77f-7980-4b71-b200-c8ab644f0ef2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ff2e3f26-9be2-4b33-8655-cd226bb70288', 20, 9.50, '2025-06-16 15:25:24', '2025-06-16 15:25:24'),
('67dd6d19-c899-4f31-ae06-18fdac88558d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ff2e3f26-9be2-4b33-8655-cd226bb70288', 25, 9.03, '2025-06-16 15:25:24', '2025-06-16 15:25:24'),
('a0fb5935-08bc-41b6-a0b4-5aad0e661b1a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ff2e3f26-9be2-4b33-8655-cd226bb70288', 30, 8.58, '2025-06-16 15:25:24', '2025-06-16 15:25:24');

-- --------------------------------------------------------

--
-- Table structure for table `offer_rules`
--

CREATE TABLE `offer_rules` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `offer_id` char(36) NOT NULL,
  `rule_type` enum('product','category','all_products') NOT NULL,
  `entity_id` char(36) DEFAULT NULL,
  `quantity` int DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `offer_rules`
--

INSERT INTO `offer_rules` (`id`, `tenant_id`, `store_id`, `offer_id`, `rule_type`, `entity_id`, `quantity`, `created_at`, `updated_at`) VALUES
('b191fc9c-6d52-475a-b64c-0e6634f6bade', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '1b34cd1e-d89f-4b3f-b2f9-473823ca0d9e', 'product', '377ecc2b-ba34-445b-bbd2-b0527b4718e6', 1, '2025-06-16 10:28:01', '2025-06-16 10:28:01'),
('fd442622-3556-4556-a48d-2e1a94f3cd6a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ff2e3f26-9be2-4b33-8655-cd226bb70288', 'product', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 10, '2025-06-16 15:25:24', '2025-06-16 15:25:24');

-- --------------------------------------------------------

--
-- Table structure for table `offer_usage`
--

CREATE TABLE `offer_usage` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `offer_id` char(36) NOT NULL,
  `customer_id` char(36) NOT NULL,
  `order_id` char(36) NOT NULL,
  `used_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_methods`
--

CREATE TABLE `payment_methods` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name (e.g., Cash, Credit Card, UPI)',
  `code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unique code (e.g., CASH, CARD, UPI)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `requires_terminal` tinyint(1) NOT NULL DEFAULT '0',
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Icon identifier for UI',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Available payment methods for each tenant';

--
-- Dumping data for table `payment_methods`
--

INSERT INTO `payment_methods` (`id`, `tenant_id`, `name`, `code`, `is_active`, `requires_terminal`, `icon`, `sort_order`, `created_at`, `updated_at`) VALUES
('00000000-0000-0000-0000-000000000000', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'No Payment Required', '', 1, 0, 'check-circle', 99, '2025-05-22 16:25:35', '2025-05-22 16:25:35'),
('e9ca7524-35f4-11f0-8297-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Cash', 'CASH', 1, 0, 'currency', 1, '2025-05-21 03:37:25', '2025-05-22 22:09:49'),
('e9ca75b4-35f4-11f0-8297-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Charge', 'ON_ACCOUNT', 1, 1, 'Person', 4, '2025-05-21 03:37:25', '2025-05-22 16:03:44'),
('e9ca7670-35f4-11f0-8297-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Card', 'CARD', 1, 1, 'credit-card', 2, '2025-05-21 03:37:25', '2025-05-21 08:42:46'),
('e9ca76b3-35f4-11f0-8297-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Phone', 'PHONE', 1, 1, 'mobile', 3, '2025-05-21 03:37:25', '2025-05-21 08:43:21');

-- --------------------------------------------------------

--
-- Table structure for table `payment_terminals`
--

CREATE TABLE `payment_terminals` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name for the terminal',
  `type` enum('INGENICO','VERIFONE','PAYTM','PHONEPE','CUSTOM') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `terminal_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Terminal ID from provider',
  `api_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API key for terminal authentication',
  `api_secret` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Encrypted API secret',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `settings` json DEFAULT NULL COMMENT 'Terminal-specific settings',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment terminal configurations';

-- --------------------------------------------------------

--
-- Table structure for table `payment_transactions`
--

CREATE TABLE `payment_transactions` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sale_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `terminal_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL COMMENT 'Amount in the transaction currency',
  `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `exchange_rate` decimal(10,6) DEFAULT '1.000000',
  `transaction_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Gateway transaction ID',
  `reference_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Merchant reference ID',
  `status` enum('PENDING','COMPLETED','FAILED','REFUNDED','PARTIALLY_REFUNDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `card_last4` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Last 4 digits of card',
  `card_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Visa, MasterCard, etc.',
  `wallet_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Name of wallet for wallet payments',
  `metadata` json DEFAULT NULL COMMENT 'Additional payment details',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Additional notes',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment transactions';

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `module` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `name`, `description`, `module`, `created_at`, `updated_at`) VALUES
('6b9d041a-4c50-11f0-8dfa-525400d69130', 'dashboard.view', 'View store dashboard', 'dashboard', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d06da-4c50-11f0-8dfa-525400d69130', 'reports.view', 'View reports', 'reports', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d0853-4c50-11f0-8dfa-525400d69130', 'reports.export', 'Export reports', 'reports', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d0914-4c50-11f0-8dfa-525400d69130', 'products.view', 'View products', 'products', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d09cf-4c50-11f0-8dfa-525400d69130', 'products.create', 'Create products', 'products', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d0a90-4c50-11f0-8dfa-525400d69130', 'products.edit', 'Edit products', 'products', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d0b53-4c50-11f0-8dfa-525400d69130', 'products.delete', 'Delete products', 'products', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d0cd5-4c50-11f0-8dfa-525400d69130', 'products.import', 'Import products', 'products', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d0dd3-4c50-11f0-8dfa-525400d69130', 'products.export', 'Export products', 'products', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d0ea5-4c50-11f0-8dfa-525400d69130', 'categories.view', 'View categories', 'categories', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d0f6b-4c50-11f0-8dfa-525400d69130', 'categories.create', 'Create categories', 'categories', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d101b-4c50-11f0-8dfa-525400d69130', 'categories.edit', 'Edit categories', 'categories', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d10df-4c50-11f0-8dfa-525400d69130', 'categories.delete', 'Delete categories', 'categories', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1189-4c50-11f0-8dfa-525400d69130', 'inventory.view', 'View inventory', 'inventory', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d123f-4c50-11f0-8dfa-525400d69130', 'inventory.adjust', 'Adjust inventory', 'inventory', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d12db-4c50-11f0-8dfa-525400d69130', 'inventory.transfer', 'Transfer inventory between stores', 'inventory', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1396-4c50-11f0-8dfa-525400d69130', 'inventory.history', 'View inventory history', 'inventory', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1438-4c50-11f0-8dfa-525400d69130', 'sales.view', 'View sales', 'sales', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d14d7-4c50-11f0-8dfa-525400d69130', 'sales.create', 'Create sales', 'sales', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d158d-4c50-11f0-8dfa-525400d69130', 'sales.void', 'Void sales', 'sales', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1653-4c50-11f0-8dfa-525400d69130', 'sales.refund', 'Process refunds', 'sales', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d171a-4c50-11f0-8dfa-525400d69130', 'sales.discount', 'Apply discounts', 'sales', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d17db-4c50-11f0-8dfa-525400d69130', 'customers.view', 'View customers', 'customers', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d188d-4c50-11f0-8dfa-525400d69130', 'customers.create', 'Create customers', 'customers', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1a4c-4c50-11f0-8dfa-525400d69130', 'customers.edit', 'Edit customers', 'customers', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1b50-4c50-11f0-8dfa-525400d69130', 'customers.delete', 'Delete customers', 'customers', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1c08-4c50-11f0-8dfa-525400d69130', 'stores.view', 'View stores', 'stores', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1cb0-4c50-11f0-8dfa-525400d69130', 'stores.create', 'Create stores', 'stores', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1d5b-4c50-11f0-8dfa-525400d69130', 'stores.edit', 'Edit stores', 'stores', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1e16-4c50-11f0-8dfa-525400d69130', 'stores.delete', 'Delete stores', 'stores', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1ebb-4c50-11f0-8dfa-525400d69130', 'users.view', 'View users', 'users', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1f4f-4c50-11f0-8dfa-525400d69130', 'users.create', 'Create users', 'users', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d1ff1-4c50-11f0-8dfa-525400d69130', 'users.edit', 'Edit users', 'users', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d209b-4c50-11f0-8dfa-525400d69130', 'users.delete', 'Delete users', 'users', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d2140-4c50-11f0-8dfa-525400d69130', 'roles.view', 'View roles', 'roles', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d21d1-4c50-11f0-8dfa-525400d69130', 'roles.create', 'Create roles', 'roles', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d2265-4c50-11f0-8dfa-525400d69130', 'roles.edit', 'Edit roles', 'roles', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d22ff-4c50-11f0-8dfa-525400d69130', 'roles.delete', 'Delete roles', 'roles', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d2398-4c50-11f0-8dfa-525400d69130', 'settings.view', 'View tenant settings', 'settings', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d2432-4c50-11f0-8dfa-525400d69130', 'settings.edit', 'Edit tenant settings', 'settings', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d24d1-4c50-11f0-8dfa-525400d69130', 'tenant.subscription.view', 'View subscription details', 'subscription', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9d256b-4c50-11f0-8dfa-525400d69130', 'tenant.subscription.upgrade', 'Upgrade subscription', 'subscription', '2025-06-18 14:27:53', '2025-06-18 14:27:53');

-- --------------------------------------------------------

--
-- Table structure for table `plans`
--

CREATE TABLE `plans` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `price_monthly` decimal(10,2) NOT NULL,
  `price_yearly` decimal(10,2) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `features` json DEFAULT NULL,
  `limits` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `plans`
--

INSERT INTO `plans` (`id`, `name`, `description`, `price_monthly`, `price_yearly`, `currency`, `features`, `limits`, `is_active`, `created_at`, `updated_at`) VALUES
('6baf0d04-4c50-11f0-8dfa-525400d69130', 'Basic', 'Essential features for small businesses', 29.99, 299.90, 'USD', '{\"support\": \"email\", \"inventory\": true, \"multiUser\": true, \"pointOfSale\": true, \"basicReports\": true, \"customerManagement\": true}', '{\"users\": 3, \"stores\": 1, \"storage\": \"1GB\", \"products\": 500}', 1, '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6baf1082-4c50-11f0-8dfa-525400d69130', 'Professional', 'Advanced features for growing businesses', 59.99, 599.90, 'USD', '{\"support\": \"24/7\", \"inventory\": true, \"multiUser\": true, \"multiStore\": true, \"pointOfSale\": true, \"loyaltyProgram\": true, \"advancedReports\": true, \"customerManagement\": true}', '{\"users\": 10, \"stores\": 3, \"storage\": \"5GB\", \"products\": 2000}', 1, '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6baf11e2-4c50-11f0-8dfa-525400d69130', 'Enterprise', 'Full-featured solution for larger businesses', 99.99, 999.90, 'USD', '{\"support\": \"premium\", \"apiAccess\": true, \"inventory\": true, \"multiUser\": true, \"multiStore\": true, \"pointOfSale\": true, \"customBranding\": true, \"loyaltyProgram\": true, \"advancedReports\": true, \"customerManagement\": true}', '{\"users\": 30, \"stores\": 10, \"storage\": \"20GB\", \"products\": 10000}', 1, '2025-06-18 14:27:53', '2025-06-18 14:27:53');

-- --------------------------------------------------------

--
-- Table structure for table `printer_settings`
--

CREATE TABLE `printer_settings` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) NOT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `auto_print` tinyint(1) DEFAULT '0',
  `print_mode` enum('browser','direct','server') DEFAULT 'browser',
  `printer_name` varchar(255) DEFAULT NULL,
  `paper_width` int DEFAULT '58',
  `template_id` varchar(36) DEFAULT NULL,
  `header` text,
  `footer` text,
  `logo_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `printer_settings`
--

INSERT INTO `printer_settings` (`id`, `tenant_id`, `store_id`, `enabled`, `auto_print`, `print_mode`, `printer_name`, `paper_width`, `template_id`, `header`, `footer`, `logo_url`, `created_at`, `updated_at`, `created_by`, `updated_by`) VALUES
('fb800138-5090-421d-be59-479b27af09a7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 1, 1, 'browser', '192.168.1.100', 80, '550e8c73-d3aa-4c8e-ad54-04a2a6c8d436', 'Tax ID: 23423423', 'Welcome back again!', NULL, '2025-06-07 06:19:58', '2025-06-09 15:50:19', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) DEFAULT NULL COMMENT 'FK to stores.id, if product is store-specific',
  `name` varchar(255) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL COMMENT 'Cost price of the product',
  `total_quantity_received` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Cumulative quantity of this product ever received',
  `last_received_cost_price` decimal(15,2) DEFAULT NULL,
  `weighted_average_cost` decimal(15,5) DEFAULT NULL COMMENT 'Weighted average cost price, updated upon receiving goods',
  `last_received_date` date DEFAULT NULL COMMENT 'Date when the product was last received via GRN',
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
  `promotional_offer_id` char(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `tenant_id`, `store_id`, `name`, `description`, `price`, `cost_price`, `total_quantity_received`, `last_received_cost_price`, `weighted_average_cost`, `last_received_date`, `barcode`, `sku`, `category_id`, `stock_quantity`, `low_stock_threshold`, `image_url`, `tax_class_id`, `is_active`, `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `specific_discount_type`, `specific_discount_value`, `promotional_offer_id`) VALUES
('000330c9-15a0-40f8-afb2-33c33b222bb7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Basmati Rice 15lbs', '5kg premium basmati rice.', 9.99, 6.99, 0.00, NULL, NULL, NULL, '0721999289767', 'ZET-BDM126', 'f689ca7d-ad61-439a-a446-91a247a09423', 20, 22, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748157000039_Authentic-Royal-Royal-Basmati-Rice-15-Pound-Bag.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:58', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('00233c5c-f8b0-41da-8583-64d1746e635f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Sunflower Oil', '1L refined sunflower oil.', 3.10, 2.17, 0.00, NULL, NULL, NULL, '0219002638681', 'ZET-HAG164', 'f689ca7d-ad61-439a-a446-91a247a09423', 58, 23, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163596382_sunflower_oil.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:58', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('056250b8-90d2-41e8-b9c7-1a866658ee7f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Samsung S24 Ultra', 'Samsung S24 Ultra', 749.00, 700.00, 0.00, NULL, NULL, NULL, '0183098691872', 'ZET-ZOW741', '2c2c5815-5f0a-48fc-b85a-54386f7e81b7', 1, 5, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748154755605_Samsung_24_ultra.webp', NULL, 1, '2025-05-25 06:32:35', '2025-06-13 11:59:55', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('0a3a5617-942e-46bf-abed-c34a74a8a6d7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Green Tea', 'Box of 20 green tea bags.', 2.25, 1.58, 0.00, NULL, NULL, NULL, '0152963361938', 'ZET-BER883', '7e524fba-cb2e-431c-a6a2-9c845196c878', 48, 19, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161705424_green_tea.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:57', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('0e9cf56e-14fe-410c-854a-928fd69e054f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Cheddar Cheese', 'Aged cheddar block, 250g.', 4.10, 2.87, 50.00, 2.87, 2.87000, '2025-06-02', '0428010784022', 'ZET-ETH238', 'f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8', 150, 5, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159637041_cheddar_cheese.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:57', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('14ff74f8-d700-4b7f-b118-2fb789011860', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Multigrain Bread', 'Whole grain sliced bread.', 2.85, 2.00, 0.00, NULL, NULL, NULL, '0345843531978', 'ZET-QLF802', '979b1b2d-e7dd-4e29-80d0-27eb7f935513', 46, 18, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159339081_pan-bread.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-18 06:45:49', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('187b21e6-639b-42b4-8199-28e1a2e49f9c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Chocolate Muffins', 'Pack of 4 rich chocolate muffins.', 3.75, 2.63, 0.00, NULL, NULL, NULL, '0412623201508', 'ZET-IPB425', '979b1b2d-e7dd-4e29-80d0-27eb7f935513', 22, 11, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161393928_Chocolate-Muffins-1.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-18 06:45:49', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('22dbdb82-8f0c-424a-9be3-1c1d57969aa1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Goat meat', 'Minced goat meat, 500g pack.', 4.80, 3.36, 0.00, NULL, NULL, NULL, '0979278004149', 'ZET-PCT371', 'e34033d9-029f-4f68-a0fb-3a6a451f53b8', 28, 13, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161829475_goat_meat.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:57', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('377ecc2b-ba34-445b-bbd2-b0527b4718e6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Coffee Cup', 'Coffee Cup', 10.00, 5.00, 0.00, NULL, NULL, NULL, NULL, NULL, 'a52d3611-6578-4868-88fe-f704249603d3', 73, 10, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1750185556237-973315397.jpeg', NULL, 1, '2025-06-11 10:24:59', '2025-06-17 18:39:16', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL),
('3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Avocados', 'Ripe Hass avocados and Fresh', 2.49, 1.74, 11.00, 4.00, 3.61324, '2025-06-02', '0667652204695', 'ZET-AHJ011', 'c56855f9-54e8-4986-b515-00d34cd632c6', 93, 28, '/images/products/product-1785b4f3-5260-4d25-a01f-11bcc83d3b13-1748086457647.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:57', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('3dcedd3f-0c34-44f5-b8da-08e372b219cf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Nathara Contour', 'Nathara Contour Engagement Ring for special women', 1475.00, 1200.00, 70.00, 1200.00, 1200.00000, NULL, '0922480967567', 'ZET-NYA353', '3ff8552b-2b1c-438c-abd3-6231f9195b00', 31, 8, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748272194929-324524273.png', NULL, 1, '2025-05-26 15:09:55', '2025-06-13 13:42:33', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('4c98f143-cc49-4f2d-bf93-6544b33d9e19', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Chicken Breast', 'Boneless skinless chicken breast, 500g.', 5.25, 3.68, 43.00, 3.68, 2.45333, '2025-06-02', '0719975472538', 'ZET-KWD077', 'e34033d9-029f-4f68-a0fb-3a6a451f53b8', 125, 18, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159405092_chicken_breast.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:56', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('55f2568f-96cf-46a8-b156-a633be5b591c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Wedding Ring', 'Wedding Ring for lovers', 1400.00, 1000.00, 0.00, NULL, NULL, NULL, NULL, NULL, '3ff8552b-2b1c-438c-abd3-6231f9195b00', 7, 10, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748850859392-437044890.png', NULL, 1, '2025-06-02 07:54:19', '2025-06-18 06:46:38', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL, NULL),
('56b60d92-35a1-4b1d-9be0-514779568b40', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Bread Pan', '', 2.35, 0.00, 40.00, 20.00, 9.00000, '2025-06-01', '0100980926585', 'ZET-UWY216', '979b1b2d-e7dd-4e29-80d0-27eb7f935513', 136, 100, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160313360_bread_pan.webp', NULL, 1, '2025-05-23 08:29:28', '2025-06-18 06:45:48', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Orange Juice', '100% pure orange juice, 1L.', 2.99, 2.09, 0.00, NULL, NULL, NULL, '0292860936087', 'ZET-KMC013', '7e524fba-cb2e-431c-a6a2-9c845196c878', 71, 30, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159551657_Orange_juice_-_Simply_orange.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:56', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('592de762-38ed-4640-9e6c-c32fd5096790', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Greek Yogurt (Vanilla)', 'Plain Greek yogurt, 500g tub.', 3.25, 2.28, 10.00, 2.28, 2.28000, NULL, '0831549618514', 'ZET-ARI562', 'f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8', 38, 18, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161775112_greek_yogurt_vanilla.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:56', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'iPhone 14Pro', 'iPhone 14Pro Silver color', 799.00, 749.00, 40.00, 749.00, 599.20000, '2025-06-02', '0870513891214', 'ZET-PKE767', '2c2c5815-5f0a-48fc-b85a-54386f7e81b7', 140, 5, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160407103_iphone14-iphone14pro-4.webp', NULL, 1, '2025-05-25 06:27:35', '2025-06-13 11:59:55', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('59c5aa8d-33e1-4e3c-ad80-e5735bde8140', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Shrimp (Peeled)', 'Peeled shrimp, frozen, 400g.', 6.50, 4.55, 80.00, 4.55, 4.55000, NULL, '0341466292591', 'ZET-BKV046', 'e34033d9-029f-4f68-a0fb-3a6a451f53b8', 55, 10, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163528703_shrimp-peeled.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:56', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('5c08c1dc-5559-4470-8151-c026805899dd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Cherry Tomatoes', 'Sweet cherry tomatoes, 250g pack.', 1.25, 0.88, 0.00, NULL, NULL, NULL, '0727940056684', 'ZET-JQF114', '09cd8deb-225c-43d5-9b0a-5d56ad8498a0', 44, 24, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159682544_chery_tomattos.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:56', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('627d7c55-921a-4916-8bf9-98f1bbc4ad08', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Indian Meal', 'Mixed with pure spice from india', 15.00, 1.82, 0.00, NULL, NULL, NULL, '0935308560947', 'ZET-HSQ069', 'a52d3611-6578-4868-88fe-f704249603d3', 71, 100, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163138234_indian_meal.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:56', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('9c6458f3-20de-4d18-861c-38a24b68b309', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Sparkling Water', 'Flavored sparkling water with great quality', 1.50, 1.05, 0.00, NULL, NULL, NULL, '0490727673834', 'ZET-ZNR759', '7e524fba-cb2e-431c-a6a2-9c845196c878', 98, 40, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748175012748_sparkling_water.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:56', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('a0cff669-2621-4b55-aaac-88e81474710a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Parle-G 10 pack of 100g', 'Parle-G 10 pack of 100g', 10.00, 7.00, 0.00, NULL, NULL, NULL, '0843372645827', 'ZET-WUI366', '30a8084c-b4e3-432a-ab8c-5fa8557bb339', -3, 50, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163362103_parle_g.webp', NULL, 1, '2025-05-23 08:06:42', '2025-06-13 11:59:55', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('a3ad9984-5f79-4300-96a5-d153b8a01665', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Organic Bananas', 'Fresh organic bananas, sold by weight.', 1.99, 1.39, 0.00, NULL, NULL, NULL, '0827861904657', 'ZET-YHR435', '09cd8deb-225c-43d5-9b0a-5d56ad8498a0', 88, 37, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163291017_organic_bananas.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:56', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('a5fd86a0-7b25-457b-9473-a33de24f4e13', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Sourdough Bread', 'Artisan sourdough loaf.', 3.75, 2.63, 0.00, NULL, NULL, NULL, '0256790484447', 'ZET-OHV178', '979b1b2d-e7dd-4e29-80d0-27eb7f935513', 29, 12, '/uploads/default_product.png', NULL, 1, '2025-01-01 00:00:00', '2025-06-18 06:45:49', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', NULL, NULL, NULL),
('a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Samsung A19 Tab', 'Samsung A19 Tab', 163.00, 140.00, 2.00, 140.00, 140.00000, NULL, '0495555778308', 'ZET-RZZ984', '2c2c5815-5f0a-48fc-b85a-54386f7e81b7', 19, 2, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160241621_Samsung_A19_Tab.webp', NULL, 1, '2025-05-25 08:04:01', '2025-06-13 11:59:55', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('ad80d59c-de80-49e0-82e3-c3d528d5367c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Carrots', 'Crunchy organic carrots, 1kg.', 1.50, 1.05, 100.00, 1.05, 1.05000, NULL, '0944719335198', 'ZET-TWE222', '09cd8deb-225c-43d5-9b0a-5d56ad8498a0', 191, 32, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159594321_carrots.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:57', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('af783643-559f-4a32-848e-03da9524e85c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Cold Brew Coffee', 'Ready-to-drink cold brew, 350ml.', 2.95, 2.07, 40.00, 2.07, 2.07000, NULL, '0640999339279', 'ZET-IWK352', '7e524fba-cb2e-431c-a6a2-9c845196c878', 45, 10, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159457408_cold_brew_coffee.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:57', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('b193d1a1-94f6-405a-b13f-15a1d594f403', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Bread - Americano', '', 3.85, 0.00, 139.00, 10.00, 11.75000, '2025-06-02', '0607261034014', 'ZET-TCH016', '979b1b2d-e7dd-4e29-80d0-27eb7f935513', 151, 40, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159356742_bread.webp', NULL, 1, '2025-05-23 08:27:19', '2025-06-18 06:45:49', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Baby Spinach', 'Washed baby spinach leaves, 200g.', 1.80, 1.26, 0.00, NULL, NULL, NULL, '0347219776778', 'ZET-IUA644', '09cd8deb-225c-43d5-9b0a-5d56ad8498a0', 91, 29, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748156885365_baby_spinach.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:57', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('b82e1887-40f9-4475-b277-ef45e093bf56', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Garnier Whole Blends Honey Treasures', 'Garnier Whole Blends Honey Treasures', 7.80, 7.00, 60.00, 7.00, 7.00000, '2025-06-03', '0284773532752', 'ZET-CVY180', '274e7df8-0670-4f11-86a9-768d2c144337', 79, 30, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748279956157-948328307.webp', NULL, 1, '2025-05-25 09:45:28', '2025-06-13 11:59:55', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('b89be53e-f6b7-4005-9f32-9e890325c658', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'iPhone 15 ProPlus', 'iPhone 15 ProPlus Space Gray', 899.00, 849.00, 40.00, 849.00, 855.10790, '2025-06-02', '0166589102769', 'ZET-VYD934', '2c2c5815-5f0a-48fc-b85a-54386f7e81b7', 131, 5, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160384922_Apple-iPhone-15-Pro-lineup-color-lineup-230912_big.jpg.large.webp', NULL, 1, '2025-05-25 06:24:30', '2025-06-13 11:59:55', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Dove Pink Soap ', 'dove soap', 5.00, 2.00, 10.00, 2.00, 0.80000, '2025-06-02', '0318992176390', 'ZET-KIL258', '979b1b2d-e7dd-4e29-80d0-27eb7f935513', 31, 10, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748261926588-364199522.webp', NULL, 1, '2025-05-25 09:53:04', '2025-06-18 06:45:48', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('c0edd880-aa11-4d74-8b77-845d8798da90', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Farm Eggs', 'Pack of 12 organic brown eggs.', 2.99, 2.09, 20.00, 2.09, 2.09000, '2025-06-02', '0932342252350', 'ZET-WMV691', 'f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8', 119, 40, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161499916_egg.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:57', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('c4d1fe2b-c711-494c-93d1-e0932962a61e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'iPhone 16Pro Mac256GB', 'iPhone 16Pro Max 256GB', 999.00, 0.00, 10.00, 900.00, 900.00000, NULL, '0989757405676', 'ZET-WJH263', '2c2c5815-5f0a-48fc-b85a-54386f7e81b7', 19, 10, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748160351522_iphone16promax.webp', NULL, 1, '2025-05-25 06:18:32', '2025-06-13 11:59:55', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Pepsi 300ml (24pack)', 'Pepsi 300ml (24pack)', 1245.00, 10.00, 350.00, 10.00, 10.00000, '2025-06-01', '0533040102787', 'ZET-PQI683', '7e524fba-cb2e-431c-a6a2-9c845196c878', 620, 12, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163427332_pepsi_24_can.webp', NULL, 1, '2025-05-23 08:01:37', '2025-06-13 11:59:56', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('d27c07d9-fa0c-49a7-9a29-454dde45bf7f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Whole Milk', '1 gallon whole milk.', 3.49, 2.44, 0.00, NULL, NULL, NULL, '0523136082871', 'ZET-HCO434', 'f42b588a-fabf-4c66-b7e5-15b6d9e2d0f8', 48, 19, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163560596_whole_milk.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:57', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('db11baa7-4d6c-4b88-b8e5-45cf40a1a8d8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Lemon Bag', 'Lemon Bag', 1.00, 0.00, 30.00, 10.00, 8.33330, NULL, '0597011308368', 'ZET-LQV147', '09cd8deb-225c-43d5-9b0a-5d56ad8498a0', -4, 50, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748159300264_lemon.webp', NULL, 1, '2025-05-23 08:12:43', '2025-06-13 11:59:55', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('e03dc952-7f98-421d-924b-4f819abe666e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Coca Cola', '', 5.00, 3.00, 200.00, 3.00, 2.40000, '2025-06-03', '0369645756547', 'ZET-BJT594', '7e524fba-cb2e-431c-a6a2-9c845196c878', 472, 50, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748161443842_soft-drink-coke-2.webp', NULL, 1, '2025-05-23 06:51:43', '2025-06-13 11:59:56', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('ed2f4421-fca0-4827-b7c3-d814f46252c6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Croissants', 'Box of 4 butter croissants.', 4.50, 3.15, 30.00, 3.15, 3.15000, NULL, '0753777024292', 'ZET-WBT584', '979b1b2d-e7dd-4e29-80d0-27eb7f935513', 53, 9, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163230614_20croissants_blend_74949-delifrance.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-18 06:45:49', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL),
('f4d52a04-b5d5-49dc-8aa4-d01947ee16d9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Salmon Fillet', 'Atlantic salmon fillet, 250g.', 6.99, 4.89, 0.00, NULL, NULL, NULL, '0697226040993', 'ZET-OVM949', 'e34033d9-029f-4f68-a0fb-3a6a451f53b8', 17, 8, '/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c/1748163465353_salmon_filet_pack.webp', NULL, 1, '2025-01-01 00:00:00', '2025-06-13 11:59:58', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `promotional_offers`
--

CREATE TABLE `promotional_offers` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `offer_type` enum('buy_x_get_y','percentage_discount','fixed_discount','bundle_price','tiered_pricing') NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `start_date` datetime NOT NULL,
  `end_date` datetime DEFAULT NULL,
  `priority` int DEFAULT '0',
  `max_uses_per_customer` int DEFAULT NULL,
  `max_total_uses` int DEFAULT NULL,
  `current_total_uses` int DEFAULT '0',
  `minimum_quantity` int DEFAULT '1',
  `minimum_purchase_amount` decimal(10,2) DEFAULT NULL,
  `discount_value` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` char(36) DEFAULT NULL,
  `updated_by_user_id` char(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `promotional_offers`
--

INSERT INTO `promotional_offers` (`id`, `tenant_id`, `store_id`, `name`, `description`, `offer_type`, `is_active`, `start_date`, `end_date`, `priority`, `max_uses_per_customer`, `max_total_uses`, `current_total_uses`, `minimum_quantity`, `minimum_purchase_amount`, `discount_value`, `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`) VALUES
('0e88cf84-486b-11f0-9c38-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Summer Sale 20% Off', '20% discount on selected items', 'percentage_discount', 1, '2025-06-13 15:28:29', '2025-07-13 15:28:29', 10, NULL, NULL, 0, 1, NULL, 20.00, '2025-06-13 15:28:29', '2025-06-14 06:21:02', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('0e8936b5-486b-11f0-9c38-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Fixed $5 Discount', '$5 off on any item', 'fixed_discount', 1, '2025-06-13 15:28:29', '2025-06-28 15:28:29', 20, NULL, NULL, 0, 1, NULL, 5.00, '2025-06-13 15:28:29', '2025-06-14 06:21:02', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('0e893ad2-486b-11f0-9c38-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Weekend Special 10% Off', '10% discount on weekend purchases', 'percentage_discount', 1, '2025-06-13 15:28:29', '2025-06-20 15:28:29', 30, NULL, NULL, 0, 1, NULL, 10.00, '2025-06-13 15:28:29', '2025-06-14 06:21:02', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('1b34cd1e-d89f-4b3f-b2f9-473823ca0d9e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Buy 1 get 1', 'buy', 'buy_x_get_y', 1, '2025-06-15 00:00:00', '0000-00-00 00:00:00', 0, 0, 0, 0, 1, 0.00, 1.00, '2025-06-16 10:28:01', '2025-06-16 10:28:01', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL),
('1e893ad2-486b-11f0-9c38-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Summer Sale 20% Off', '20% discount on selected items', 'percentage_discount', 1, '2025-06-14 00:00:00', '2025-07-14 00:00:00', 10, 0, 0, 0, 1, 0.00, 20.00, '2025-06-14 01:49:24', '2025-06-16 08:00:50', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('ff2e3f26-9be2-4b33-8655-cd226bb70288', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '10 or more for bEtteR', '', 'tiered_pricing', 1, '2025-06-15 00:00:00', '2025-06-30 00:00:00', 1, 0, 0, 0, 9, 0.00, 10.00, '2025-06-16 13:44:45', '2025-06-16 15:25:24', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `purchase_orders`
--

CREATE TABLE `purchase_orders` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) DEFAULT NULL COMMENT 'FK to stores.id, if purchases are store-specific',
  `supplier_id` char(36) NOT NULL COMMENT 'FK to suppliers.id - Who the purchase is from',
  `purchase_order_number` varchar(50) DEFAULT NULL COMMENT 'Optional user-friendly PO number',
  `order_date` date NOT NULL COMMENT 'Date the order was placed',
  `expected_delivery_date` date DEFAULT NULL COMMENT 'When the items are expected',
  `status` varchar(50) NOT NULL DEFAULT 'DRAFT',
  `received_status` varchar(30) NOT NULL DEFAULT 'NOT_RECEIVED' COMMENT 'Tracks the goods receiving status against this PO',
  `total_amount` decimal(12,2) DEFAULT '0.00' COMMENT 'Calculated total of all items, can be updated',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` char(36) DEFAULT NULL COMMENT 'FK to users.id',
  `updated_by_user_id` char(36) DEFAULT NULL COMMENT 'FK to users.id',
  `last_grn_date` datetime DEFAULT NULL COMMENT 'Date when last GRN was processed for this PO'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `purchase_orders`
--

INSERT INTO `purchase_orders` (`id`, `tenant_id`, `store_id`, `supplier_id`, `purchase_order_number`, `order_date`, `expected_delivery_date`, `status`, `received_status`, `total_amount`, `notes`, `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`, `last_grn_date`) VALUES
('81c07abf-01bf-498d-9b1f-1b08a47c93b8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'd1f3a980-0a3a-4e5c-b15a-92c174caeec1', '100003', '2025-06-03', NULL, 'ORDERED', 'NOT_RECEIVED', 158.24, '', '2025-06-03 08:59:32', '2025-06-03 08:59:32', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL),
('9bd30d25-8556-455e-b6d5-1f5ac51e777c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'd1f3a980-0a3a-4e5c-b15a-92c174caeec1', '100001', '2025-06-03', NULL, 'ORDERED', 'NOT_RECEIVED', 1150.00, '', '2025-06-03 08:58:59', '2025-06-03 08:58:59', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL),
('cc78bbae-c7c1-41f9-a039-5a3a87ce454b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'd1f3a980-0a3a-4e5c-b15a-92c174caeec1', '100002', '2025-06-03', NULL, 'DRAFT', 'NOT_RECEIVED', 339.20, '', '2025-06-03 08:59:11', '2025-06-25 04:29:09', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `purchase_order_items`
--

CREATE TABLE `purchase_order_items` (
  `id` char(36) NOT NULL,
  `purchase_order_id` char(36) NOT NULL COMMENT 'FK to purchase_orders.id',
  `product_id` char(36) NOT NULL COMMENT 'FK to products.id',
  `quantity_ordered` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) NOT NULL COMMENT 'Cost per unit at the time of this purchase',
  `quantity_received` decimal(10,2) DEFAULT '0.00' COMMENT 'How many have been received so far',
  `remaining_quantity` decimal(10,2) GENERATED ALWAYS AS ((`quantity_ordered` - `quantity_received`)) STORED COMMENT 'Calculated remaining quantity to be received',
  `status` varchar(50) DEFAULT NULL,
  `item_received_status` varchar(30) NOT NULL DEFAULT 'NOT_RECEIVED' COMMENT 'Tracks receiving status for this specific line item',
  `line_total` decimal(12,2) GENERATED ALWAYS AS ((`quantity_ordered` * `cost_price`)) STORED COMMENT 'Automatically calculated',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `purchase_order_items`
--

INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `product_id`, `quantity_ordered`, `cost_price`, `quantity_received`, `status`, `item_received_status`, `created_at`, `updated_at`) VALUES
('1c5e5c30-c4a3-4cd3-ba32-a75acabe2525', '9bd30d25-8556-455e-b6d5-1f5ac51e777c', 'e03dc952-7f98-421d-924b-4f819abe666e', 50.00, 3.00, 0.00, NULL, 'NOT_RECEIVED', '2025-06-03 08:58:59', '2025-06-03 08:58:59'),
('97b8d9b6-2a30-44f4-b540-608427d00863', '81c07abf-01bf-498d-9b1f-1b08a47c93b8', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 35.00, 0.00, 35.00, 'FULLY_RECEIVED', 'NOT_RECEIVED', '2025-06-03 08:59:32', '2025-06-03 09:22:46'),
('9d738c33-32f1-4f31-95df-af318f8b3e89', 'cc78bbae-c7c1-41f9-a039-5a3a87ce454b', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 30.00, 1.74, 0.00, NULL, 'NOT_RECEIVED', '2025-06-25 04:29:09', '2025-06-25 04:29:09'),
('a27a7221-1602-4b42-b384-d100486aa43c', '9bd30d25-8556-455e-b6d5-1f5ac51e777c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 100.00, 10.00, 100.00, 'FULLY_RECEIVED', 'NOT_RECEIVED', '2025-06-03 08:58:59', '2025-06-03 09:23:11'),
('e20fe480-02f2-40d9-9917-a76222ea03d0', '81c07abf-01bf-498d-9b1f-1b08a47c93b8', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 43.00, 3.68, 43.00, 'FULLY_RECEIVED', 'NOT_RECEIVED', '2025-06-03 08:59:32', '2025-06-03 09:22:45'),
('eccc8729-c515-40b2-82a4-a96d96f40a85', 'cc78bbae-c7c1-41f9-a039-5a3a87ce454b', '0e9cf56e-14fe-410c-854a-928fd69e054f', 100.00, 2.87, 0.00, NULL, 'NOT_RECEIVED', '2025-06-25 04:29:09', '2025-06-25 04:29:09');

-- --------------------------------------------------------

--
-- Table structure for table `receipt_templates`
--

CREATE TABLE `receipt_templates` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `html_template` text NOT NULL,
  `css_template` text,
  `is_default` tinyint(1) DEFAULT '0',
  `is_system` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `receipt_templates`
--

INSERT INTO `receipt_templates` (`id`, `tenant_id`, `name`, `description`, `html_template`, `css_template`, `is_default`, `is_system`, `created_at`, `updated_at`, `created_by`, `updated_by`) VALUES
('1848571e-0537-4e4c-868f-8b65ff79c1c2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Compact Receipt', 'Space-saving receipt format for small paper sizes', '\n<div class=\"compact-receipt\">\n  <div class=\"header\">\n    <h1>{{storeName}}</h1>\n  </div>\n  \n  <div class=\"receipt-info\">\n    <p>{{date}} #{{receiptNumber}}</p>\n  </div>\n  \n  <div class=\"items\">\n    {{#each items}}\n    <div class=\"item\">\n      <div class=\"item-name\">{{name}}</div>\n      <div class=\"item-detail\">\n        <span>{{price}} x{{quantity}}</span>\n        <span>{{total}}</span>\n      </div>\n    </div>\n    {{/each}}\n  </div>\n  \n  <div class=\"totals\">\n    <div><span>SUB</span><span>{{subtotal}}</span></div>\n    {{#if tax}}\n    <div><span>TAX</span><span>{{tax}}</span></div>\n    {{/if}}\n    {{#if discount}}\n    <div><span>DISC</span><span>{{discount}}</span></div>\n    {{/if}}\n    <div class=\"total\"><span>TOTAL</span><span>{{total}}</span></div>\n  </div>\n  \n  <div class=\"payment\">\n    <p>{{paymentMethod}}: {{amountPaid}}</p>\n  </div>\n  \n  <div class=\"footer\">\n    <p>{{footerText}}</p>\n  </div>\n</div>', '\n.compact-receipt {\n  width: 100%;\n  max-width: 220px;\n  margin: 0 auto;\n  font-family: \'Courier New\', monospace;\n  font-size: 8pt;\n}\n\n.header {\n  text-align: center;\n  margin-bottom: 5px;\n}\n\n.header h1 {\n  font-size: 10pt;\n  margin: 0;\n}\n\n.receipt-info {\n  text-align: center;\n  margin-bottom: 5px;\n}\n\n.receipt-info p {\n  margin: 0;\n}\n\n.items {\n  border-top: 1px dashed #000;\n  border-bottom: 1px dashed #000;\n  padding: 5px 0;\n}\n\n.item {\n  margin-bottom: 3px;\n}\n\n.item-detail {\n  display: flex;\n  justify-content: space-between;\n  font-size: 7pt;\n}\n\n.totals {\n  margin-top: 5px;\n  font-size: 8pt;\n}\n\n.totals > div {\n  display: flex;\n  justify-content: space-between;\n}\n\n.total {\n  font-weight: bold;\n  border-top: 1px solid #000;\n  padding-top: 2px;\n  margin-top: 2px;\n}\n\n.payment {\n  margin-top: 5px;\n  text-align: center;\n  font-size: 8pt;\n}\n\n.footer {\n  margin-top: 10px;\n  text-align: center;\n  font-size: 7pt;\n}', 0, 1, '2025-06-06 09:51:27', '2025-06-06 09:51:27', NULL, NULL),
('550e8c73-d3aa-4c8e-ad54-04a2a6c8d436', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Standard Receipt', 'Traditional receipt format with store details, items, and totals', '\n<div class=\"receipt\">\n  <div class=\"header\">\n    <h1>{{storeName}}</h1>\n    <p>{{storeAddress}}</p>\n    <p>{{storePhone}}</p>\n  </div>\n  \n  <div class=\"receipt-info\">\n    <p>Date: {{date}}</p>\n    <p>Cashier: {{cashier}}</p>\n    <p>Receipt #: {{receiptNumber}}</p>\n  </div>\n  \n  <div class=\"items\">\n    {{#each items}}\n    <div class=\"item\">\n      <span class=\"item-name\">{{name}}</span>\n      <span class=\"item-price\">{{price}} x{{quantity}}</span>\n      <span class=\"item-total\">{{total}}</span>\n    </div>\n    {{/each}}\n  </div>\n  \n  <div class=\"totals\">\n    <div><span>Subtotal</span><span>{{subtotal}}</span></div>\n    {{#if tax}}\n    <div><span>Tax</span><span>{{tax}}</span></div>\n    {{/if}}\n    {{#if discount}}\n    <div><span>Discount</span><span>{{discount}}</span></div>\n    {{/if}}\n    <div class=\"total\"><span>TOTAL</span><span>{{total}}</span></div>\n  </div>\n  \n  <div class=\"payment\">\n    <p>Payment Method: {{paymentMethod}}</p>\n    <p>Amount Paid: {{amountPaid}}</p>\n  </div>\n  \n  <div class=\"footer\">\n    <p>{{footerText}}</p>\n  </div>\n</div>', '\n.receipt {\n  width: 100%;\n  max-width: 300px;\n  margin: 0 auto;\n  font-family: \'Courier New\', monospace;\n  font-size: 10pt;\n}\n\n.header {\n  text-align: center;\n  margin-bottom: 10px;\n}\n\n.header h1 {\n  font-size: 14pt;\n  margin: 0;\n}\n\n.receipt-info {\n  margin-bottom: 10px;\n}\n\n.receipt-info p {\n  margin: 2px 0;\n}\n\n.items {\n  border-top: 1px dashed #000;\n  border-bottom: 1px dashed #000;\n  padding: 10px 0;\n}\n\n.item {\n  display: flex;\n  justify-content: space-between;\n  margin-bottom: 4px;\n}\n\n.item-name {\n  flex: 2;\n}\n\n.item-price {\n  flex: 1;\n  text-align: center;\n}\n\n.item-total {\n  flex: 1;\n  text-align: right;\n}\n\n.totals {\n  margin-top: 10px;\n}\n\n.totals > div {\n  display: flex;\n  justify-content: space-between;\n}\n\n.total {\n  font-weight: bold;\n  margin-top: 5px;\n}\n\n.payment {\n  margin-top: 10px;\n  text-align: center;\n}\n\n.footer {\n  margin-top: 20px;\n  text-align: center;\n  font-size: 9pt;\n}', 1, 1, '2025-06-06 09:51:27', '2025-06-06 09:51:27', NULL, NULL),
('a8234e90-77bf-42da-ad92-b3a03e149400', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Detailed Receipt', 'Comprehensive receipt with additional transaction details', '\n<div class=\"detailed-receipt\">\n  <div class=\"header\">\n    <div class=\"logo\">{{#if logoUrl}}<img src=\"{{logoUrl}}\" />{{/if}}</div>\n    <h1>{{storeName}}</h1>\n    <p>{{storeAddress}}</p>\n    <p>{{storePhone}} | {{storeEmail}}</p>\n    <p>{{storeWebsite}}</p>\n  </div>\n  \n  <div class=\"receipt-info\">\n    <table>\n      <tr>\n        <td>Date:</td>\n        <td>{{date}}</td>\n      </tr>\n      <tr>\n        <td>Time:</td>\n        <td>{{time}}</td>\n      </tr>\n      <tr>\n        <td>Receipt #:</td>\n        <td>{{receiptNumber}}</td>\n      </tr>\n      <tr>\n        <td>Cashier:</td>\n        <td>{{cashier}}</td>\n      </tr>\n      {{#if customer}}\n      <tr>\n        <td>Customer:</td>\n        <td>{{customer}}</td>\n      </tr>\n      {{/if}}\n    </table>\n  </div>\n  \n  <div class=\"items\">\n    <table>\n      <thead>\n        <tr>\n          <th>Item</th>\n          <th>Price</th>\n          <th>Qty</th>\n          <th>Total</th>\n        </tr>\n      </thead>\n      <tbody>\n        {{#each items}}\n        <tr>\n          <td>{{name}}</td>\n          <td>{{price}}</td>\n          <td>{{quantity}}</td>\n          <td>{{total}}</td>\n        </tr>\n        {{/each}}\n      </tbody>\n    </table>\n  </div>\n  \n  <div class=\"totals\">\n    <table>\n      <tr>\n        <td>Subtotal:</td>\n        <td>{{subtotal}}</td>\n      </tr>\n      {{#if tax}}\n      <tr>\n        <td>Tax:</td>\n        <td>{{tax}}</td>\n      </tr>\n      {{/if}}\n      {{#if discount}}\n      <tr>\n        <td>Discount:</td>\n        <td>{{discount}}</td>\n      </tr>\n      {{/if}}\n      <tr class=\"total\">\n        <td>TOTAL:</td>\n        <td>{{total}}</td>\n      </tr>\n      <tr>\n        <td>Payment Method:</td>\n        <td>{{paymentMethod}}</td>\n      </tr>\n      <tr>\n        <td>Amount Paid:</td>\n        <td>{{amountPaid}}</td>\n      </tr>\n      {{#if change}}\n      <tr>\n        <td>Change:</td>\n        <td>{{change}}</td>\n      </tr>\n      {{/if}}\n    </table>\n  </div>\n  \n  <div class=\"barcode\">\n    {{#if barcodeUrl}}\n    <img src=\"{{barcodeUrl}}\" />\n    {{/if}}\n  </div>\n  \n  <div class=\"footer\">\n    <p>{{footerText}}</p>\n    <p>Thank you for your business!</p>\n  </div>\n</div>', '\n.detailed-receipt {\n  width: 100%;\n  max-width: 400px;\n  margin: 0 auto;\n  font-family: Arial, sans-serif;\n  font-size: 10pt;\n}\n\n.header {\n  text-align: center;\n  margin-bottom: 15px;\n}\n\n.logo {\n  margin-bottom: 10px;\n}\n\n.logo img {\n  max-width: 100px;\n  max-height: 50px;\n}\n\n.header h1 {\n  font-size: 16pt;\n  margin: 0 0 5px 0;\n}\n\n.header p {\n  margin: 0;\n  font-size: 9pt;\n}\n\n.receipt-info {\n  margin-bottom: 15px;\n}\n\n.receipt-info table {\n  width: 100%;\n  border-collapse: collapse;\n}\n\n.receipt-info td {\n  padding: 2px 0;\n}\n\n.receipt-info td:first-child {\n  font-weight: bold;\n}\n\n.items {\n  margin-bottom: 15px;\n}\n\n.items table {\n  width: 100%;\n  border-collapse: collapse;\n}\n\n.items th {\n  border-bottom: 1px solid #000;\n  text-align: left;\n  padding: 5px 0;\n}\n\n.items td {\n  padding: 5px 0;\n  border-bottom: 1px dotted #ccc;\n}\n\n.items th:nth-child(2),\n.items th:nth-child(3),\n.items th:nth-child(4),\n.items td:nth-child(2),\n.items td:nth-child(3),\n.items td:nth-child(4) {\n  text-align: right;\n}\n\n.totals {\n  margin-bottom: 15px;\n}\n\n.totals table {\n  width: 100%;\n  border-collapse: collapse;\n}\n\n.totals td {\n  padding: 2px 0;\n}\n\n.totals td:first-child {\n  font-weight: bold;\n}\n\n.totals td:last-child {\n  text-align: right;\n}\n\n.totals .total {\n  font-size: 12pt;\n  border-top: 1px solid #000;\n  border-bottom: 1px solid #000;\n}\n\n.barcode {\n  text-align: center;\n  margin: 15px 0;\n}\n\n.barcode img {\n  max-width: 200px;\n}\n\n.footer {\n  text-align: center;\n  margin-top: 20px;\n  font-size: 9pt;\n}\n\n.footer p {\n  margin: 3px 0;\n}', 0, 1, '2025-06-06 09:51:27', '2025-06-06 09:51:27', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tenant_id` char(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `is_system_role` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `tenant_id`, `name`, `description`, `is_system_role`, `created_at`, `updated_at`, `created_by`) VALUES
('6b9f79c6-4c50-11f0-8dfa-525400d69130', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Tenant Admin', 'Full tenant administrative access', 1, '2025-06-18 14:27:53', '2025-06-18 14:27:53', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Store Manager', 'Full management of assigned stores', 1, '2025-06-18 14:27:53', '2025-06-18 14:27:53', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Cashier', 'Basic sales and customer management', 1, '2025-06-18 14:27:53', '2025-06-18 14:27:53', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Inventory Manager', 'Product and inventory management', 0, '2025-06-18 14:27:53', '2025-06-18 14:27:53', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Reports Viewer', 'View-only access to reports and analytics', 0, '2025-06-18 14:27:53', '2025-06-18 14:27:53', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d');

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role_id` char(36) NOT NULL,
  `permission_id` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `role_permissions`
--

INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d041a-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d041a-4c50-11f0-8dfa-525400d69130'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', '6b9d041a-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d041a-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d06da-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d06da-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d06da-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d0853-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d0853-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d0914-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d0914-4c50-11f0-8dfa-525400d69130'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', '6b9d0914-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d0914-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d0914-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d09cf-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d09cf-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d09cf-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d0a90-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d0a90-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d0a90-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d0b53-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d0b53-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d0b53-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d0cd5-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d0cd5-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d0cd5-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d0dd3-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d0dd3-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d0dd3-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d0ea5-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d0ea5-4c50-11f0-8dfa-525400d69130'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', '6b9d0ea5-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d0ea5-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d0ea5-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d0f6b-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d0f6b-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d0f6b-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d101b-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d101b-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d101b-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d10df-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d10df-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d10df-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1189-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1189-4c50-11f0-8dfa-525400d69130'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', '6b9d1189-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d1189-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d1189-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d123f-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d123f-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d123f-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d12db-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d12db-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d12db-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1396-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1396-4c50-11f0-8dfa-525400d69130'),
('6b9f827c-4c50-11f0-8dfa-525400d69130', '6b9d1396-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1438-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1438-4c50-11f0-8dfa-525400d69130'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', '6b9d1438-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d1438-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d14d7-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d14d7-4c50-11f0-8dfa-525400d69130'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', '6b9d14d7-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d158d-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d158d-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1653-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1653-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d171a-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d171a-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d17db-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d17db-4c50-11f0-8dfa-525400d69130'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', '6b9d17db-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d17db-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d188d-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d188d-4c50-11f0-8dfa-525400d69130'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', '6b9d188d-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1a4c-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1a4c-4c50-11f0-8dfa-525400d69130'),
('6b9f8119-4c50-11f0-8dfa-525400d69130', '6b9d1a4c-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1b50-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1b50-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1c08-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1c08-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d1c08-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1cb0-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1d5b-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1d5b-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1e16-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1ebb-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1ebb-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d1ebb-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1f4f-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1f4f-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d1ff1-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d1ff1-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d209b-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d209b-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d2140-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d2140-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d2140-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d21d1-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d21d1-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d2265-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d2265-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d22ff-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d22ff-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d2398-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d2398-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d2398-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d2432-4c50-11f0-8dfa-525400d69130'),
('6b9f7f1a-4c50-11f0-8dfa-525400d69130', '6b9d2432-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d24d1-4c50-11f0-8dfa-525400d69130'),
('6b9f83c0-4c50-11f0-8dfa-525400d69130', '6b9d24d1-4c50-11f0-8dfa-525400d69130'),
('6b9f79c6-4c50-11f0-8dfa-525400d69130', '6b9d256b-4c50-11f0-8dfa-525400d69130');

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

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
  `customer_id` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `sales`
--

INSERT INTO `sales` (`id`, `tenant_id`, `store_id`, `cashier_id`, `subtotal`, `tax`, `discount`, `total`, `payment_method`, `payment_reference`, `status`, `payment_status`, `created_at`, `discount_type`, `discount_value`, `discount_amount`, `customer_id`) VALUES
('0040f320-8ede-439c-9a42-036c454d996c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9.99, 0.41, 0.00, 10.40, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 00:59:22', NULL, NULL, 0.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('01bc04ac-c63f-484f-8488-4c4ab978e2af', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3173.00, 130.89, 0.00, 1717.39, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-08 09:31:59', 'percentage', 50.00, 1586.50, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('042a8e24-ce18-443d-b44a-ab514bf601f0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9889.00, 815.84, 0.00, 10704.84, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 12:30:35', NULL, NULL, 0.00, NULL),
('0436db07-7abb-41e8-a9a0-a4e7028eb992', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 13.84, 0.00, 0.00, 13.84, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 10:45:54', NULL, NULL, 0.00, 'ec16e637-fdd8-4594-b7a7-31495b9ab95f'),
('05d21891-a1e7-4e71-90fa-fca928e0fa09', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 6.59, 0.66, 0.00, 7.25, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 04:20:49', NULL, NULL, NULL, ''),
('0776f099-b90c-4d2f-9dab-d7577db468d6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.00, 0.08, 0.00, 1.08, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 14:48:05', NULL, NULL, 5.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('088dc28b-4dea-4871-9227-d6a908e0c0ea', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 22.29, 2.23, 0.00, 24.52, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-20 12:44:56', NULL, NULL, NULL, ''),
('0b086a7b-2203-4168-be4f-63a13edb9c30', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1400.00, 103.95, 0.00, 1363.95, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-04 07:25:32', 'percentage', 10.00, 140.00, 'ac5d853a-6e91-4275-ad94-1c3601e40892'),
('0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.19, 1.52, 0.00, 16.71, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:12:00', NULL, NULL, NULL, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('0e96f059-6720-463e-be95-87215e20b18c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.35, 0.54, 0.00, 5.89, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:02:13', NULL, NULL, NULL, ''),
('0ed2e936-4f66-4c74-ae2a-e9314cfa8394', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 10.00, 0.83, 0.00, 10.83, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-13 12:18:21', NULL, NULL, 0.00, NULL),
('0f1b6715-262a-4c40-9134-86c6016f589f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.35, 0.64, 0.00, 6.98, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 04:11:25', NULL, NULL, NULL, ''),
('0f8628fa-e7e3-45cb-9738-c1b9c6ff760c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.59, 0.66, 0.00, 7.25, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 04:01:36', NULL, NULL, NULL, ''),
('1273a32e-3197-42cb-87e9-d975866243c3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1800.35, 148.12, 0.00, 1943.47, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-08 14:31:26', 'fixed', 5.00, 5.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('13e744e6-0d28-4b34-860c-3f4a810b4b4a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 2545.50, 105.00, 0.00, 1377.75, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:21:15', 'percentage', 50.00, 1272.75, '7acc70a5-8372-425f-a28c-adb7c239457e'),
('14a89bc3-18de-4fae-9cf8-50a8d62418c1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 78.00, 6.44, 0.00, 84.44, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-11 11:11:28', NULL, NULL, 0.00, NULL),
('14bebbc8-6960-4489-a4c9-0d40c73d1412', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 24.88, 1.64, 0.00, 26.52, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 12:23:56', NULL, NULL, 0.00, 'ec16e637-fdd8-4594-b7a7-31495b9ab95f'),
('19dfbe4a-6993-48ab-9368-1c7e93fcd860', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 799.00, 52.73, 0.00, 691.93, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 16:32:53', 'percentage', 20.00, 159.80, 'ec16e637-fdd8-4594-b7a7-31495b9ab95f'),
('1a828a26-2c33-4036-97cf-edd016b4b5b9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1.99, 0.16, 0.00, 2.15, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 17:59:36', NULL, NULL, NULL, NULL),
('1cabe080-11f1-4869-b82f-97363dabd495', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7530.00, 621.23, 0.00, 8151.23, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 13:33:56', NULL, NULL, 0.00, NULL),
('1e570dce-d230-41e3-9f17-747c7251c89d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.35, 0.54, 0.00, 5.89, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 05:20:52', NULL, NULL, NULL, ''),
('1ea38ea3-ba24-4cbe-879a-3ea133b74a5a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1475.00, 121.69, 0.00, 1596.69, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-13 13:42:32', NULL, NULL, 0.00, NULL),
('1eb68c1a-558a-44ab-890a-875ce3e64b75', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1400.00, 115.50, 0.00, 1515.50, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-05 22:19:07', NULL, NULL, 0.00, NULL),
('1efb8f3d-bfbc-45a6-878b-95df7d455f35', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7.80, 0.32, 0.00, 4.22, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 16:21:39', 'percentage', 50.00, 3.90, '7acc70a5-8372-425f-a28c-adb7c239457e'),
('22337686-b156-430a-91fe-f4e26a7fba00', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.25, 0.43, 0.00, 5.68, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 11:20:19', NULL, NULL, 0.00, NULL),
('24d6cff3-146d-4f7e-bd11-494796654988', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1548.00, 127.71, 0.00, 1675.71, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:58:03', NULL, NULL, 0.00, NULL),
('256e5c03-ca60-4703-b49d-d6caa4a7187a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 4.10, 0.41, 0.00, 4.51, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:55:13', NULL, NULL, NULL, 'f14d11c7-cd67-460a-8bff-2beea3980f85'),
('265cfdab-8094-4e5f-a794-37deb69fb0ee', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 22.29, 2.23, 0.00, 24.52, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 11:50:49', NULL, NULL, NULL, ''),
('26743683-aa1f-4fc7-8af4-cb467169ba5a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 2509.75, 207.05, 0.00, 2716.80, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:20:14', NULL, NULL, 0.00, '6d2fd998-111e-4f90-b838-cbba1ff0ab8e'),
('2688e9d0-bbd8-467f-8a1c-ab9cc4b30999', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 34.50, 2.02, 0.00, 26.52, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 11:35:50', 'fixed', 10.00, 10.00, '083e0734-5aed-42e3-b978-c5a3d524c9e4'),
('2749c3f0-bf90-46b2-bcc1-fbef2a9dde1f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3744.40, 308.91, 0.00, 4053.31, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 13:56:30', NULL, NULL, 0.00, NULL),
('27a4a063-e969-499b-9eaf-dbb09d02d173', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 12.10, 0.00, 158.80, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-04 07:17:44', 'percentage', 10.00, 16.30, 'ac5d853a-6e91-4275-ad94-1c3601e40892'),
('2aaa8f65-c421-46aa-b5bb-004ea5861d5c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1.50, 0.00, 0.00, 0.00, '00000000-0000-0000-0000-000000000000', NULL, 'completed', 'PAID', '2025-05-22 16:59:38', NULL, NULL, 1.50, NULL),
('33b58c5e-e0b3-4899-b35d-aa41fad917d2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.59, 0.66, 0.00, 7.25, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 05:07:40', NULL, NULL, NULL, ''),
('33da33e3-6f97-42a6-aa13-0232c5c84887', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 4.60, 0.38, 0.00, 4.98, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 17:57:47', NULL, NULL, NULL, NULL),
('36f7f59b-f2d3-4bf5-9ae4-c45e821ae5ac', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 13.45, 0.00, 176.45, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 10:29:31', NULL, NULL, 0.00, NULL),
('3753f5a9-56d3-4017-9e08-7abaff056b11', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1245.00, 102.71, 0.00, 1347.71, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 14:18:03', NULL, NULL, 0.00, NULL),
('3a5a927d-42b1-4cbd-9657-f16934e939e0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 25.58, 0.00, 0.00, 25.58, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-25 23:34:09', NULL, NULL, 0.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('3a5ab606-6417-4ac6-a97c-339eab8b6df2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 17.04, 1.70, 0.00, 18.74, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 05:10:12', NULL, NULL, NULL, ''),
('3a7c028e-35e1-4a8f-aa8f-426f9388fe23', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1598.00, 131.84, 0.00, 1729.84, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-05 22:05:09', NULL, NULL, 0.00, NULL),
('3b8273b6-5172-4b5d-93b8-70f7e1e2d3a3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 12.10, 0.00, 158.80, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-04 07:44:54', 'percentage', 10.00, 16.30, 'ac5d853a-6e91-4275-ad94-1c3601e40892'),
('3c7bfc55-b3f1-4392-ac4b-6a2f6de28616', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.60, 1.29, 0.00, 16.89, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 16:29:14', NULL, NULL, 0.00, NULL),
('3e52bc21-34c6-49e4-b15e-af23f4f63e31', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 13.09, 1.31, 0.00, 14.40, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 09:26:27', NULL, NULL, NULL, ''),
('3e761ec1-d72f-43b8-8b0f-fdf7d344fa24', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 8.90, 0.89, 0.00, 9.79, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 05:04:31', NULL, NULL, NULL, ''),
('3ed848c0-905e-4423-9830-1cdb609e350a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7.80, 0.64, 0.00, 8.44, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 15:50:29', NULL, NULL, 0.00, NULL),
('3fd9a1fd-f306-4fba-bca0-da40bf293251', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 999.00, 82.42, 0.00, 1081.42, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-08 14:30:13', NULL, NULL, 0.00, NULL),
('40247b67-995d-416f-b86b-279e5c6445f4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.59, 0.66, 0.00, 7.25, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 03:56:31', NULL, NULL, NULL, ''),
('40d3b2fa-6e33-4286-bb9a-b2440ae40a3b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7.80, 0.64, 0.00, 8.44, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 15:13:38', NULL, NULL, 0.00, NULL),
('41851d0a-2999-45bb-85a3-91cdbdfc874a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.35, 0.64, 0.00, 6.98, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 04:05:52', NULL, NULL, NULL, ''),
('41a2d61d-ba3e-4116-ab9c-55d18549d19d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1475.00, 121.69, 0.00, 1596.69, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-11 11:04:12', NULL, NULL, 0.00, NULL),
('44d33faa-1afc-4fd0-99da-be5e1712ad78', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.59, 0.66, 0.00, 7.25, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 05:13:00', NULL, NULL, NULL, ''),
('47c24705-bf59-4fd6-8c48-561230440bec', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1.50, 0.00, 0.00, 0.00, '00000000-0000-0000-0000-000000000000', NULL, 'completed', 'PAID', '2025-05-22 17:14:21', NULL, NULL, 1.50, NULL),
('485b3716-b29e-41cc-b539-f52c0af8f69d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9.99, 0.74, 0.00, 10.73, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 21:18:08', NULL, NULL, 0.00, NULL),
('49d186f0-6f05-4b1e-a061-20410ffa0ff3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9.20, 0.61, 0.00, 9.81, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 11:25:06', NULL, NULL, 0.00, 'ec16e637-fdd8-4594-b7a7-31495b9ab95f'),
('4ea4ed67-033f-47ae-b3eb-1c580456dc91', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 18.42, 1.52, 0.00, 19.94, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-06 08:41:46', NULL, NULL, 0.00, NULL),
('4f65ddef-df52-4013-bc0b-c4c4a1301d5b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1475.00, 121.69, 0.00, 1596.69, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-11 08:54:55', NULL, NULL, 0.00, NULL),
('4fee3e47-7781-4f25-8f78-b343802c0ad3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 4.10, 0.41, 0.00, 4.51, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-20 12:19:48', NULL, NULL, NULL, ''),
('52832c24-bb8e-4c62-8318-911b8b88e984', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7.80, 0.64, 0.00, 8.44, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-05 07:40:49', NULL, NULL, 0.00, NULL),
('52d30c66-4c71-46f6-93c0-e1c203df9914', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1480.00, 122.10, 0.00, 1602.10, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:37:46', NULL, NULL, 0.00, 'a98644da-bc81-481b-9b1a-a9de5ee8468d'),
('53fd7515-667b-4657-a2a5-000d8ea3918d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1.50, 0.00, 0.00, 0.00, '00000000-0000-0000-0000-000000000000', NULL, 'completed', 'PAID', '2025-05-22 16:24:16', NULL, NULL, 1.50, NULL),
('55692572-d1f0-4d6d-8026-8af1853b66b2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.89, 0.66, 0.00, 16.55, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 11:24:36', NULL, NULL, 0.00, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('55a91e70-3811-4d6c-a57c-5be5417d9158', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 4.10, 0.34, 0.00, 4.44, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 17:35:24', NULL, NULL, NULL, NULL),
('57857aec-9b2c-4be0-9afb-4fde047a577e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1475.00, 121.69, 0.00, 1596.69, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-05 07:37:15', NULL, NULL, 0.00, NULL),
('57c75542-70b0-438e-8043-5b865186540c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 2.95, 0.24, 0.00, 3.19, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 21:18:53', NULL, NULL, 0.00, NULL),
('5b5507a5-19a5-4dfc-9b82-6c53332ba2f3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 2.49, 0.21, 0.00, 2.70, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 20:20:33', NULL, NULL, NULL, NULL),
('5b594d33-dcdb-4b62-a71a-a08fb01500b7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.89, 1.31, 0.00, 17.20, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 11:25:31', NULL, NULL, 0.00, NULL),
('5c12e943-7505-4470-8042-8e319387a58c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 899.00, 74.17, 0.00, 973.17, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-03 10:06:04', NULL, NULL, 0.00, NULL),
('5c15b8bd-f29c-433c-9003-c54bacfa7ec4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 24.43, 2.02, 0.00, 26.45, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-23 02:04:42', NULL, NULL, 0.00, NULL),
('5c80048c-decf-4d63-b6d3-fdc52eeef9c1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.60, 0.00, 0.00, 5.60, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-25 23:40:29', NULL, NULL, 0.00, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('5e4c58a6-9dd0-4f10-9f31-f2715ec62503', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 23.83, 1.97, 0.00, 25.80, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 11:23:05', NULL, NULL, 0.00, NULL),
('614ed020-a515-4c08-ba19-8c556009c11d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.00, 1.50, 0.00, 16.50, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:21:41', NULL, NULL, NULL, 'f14d11c7-cd67-460a-8bff-2beea3980f85'),
('622d2c66-957f-4cea-b86a-a96e0317b689', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.35, 0.64, 0.00, 6.98, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 05:15:15', NULL, NULL, NULL, ''),
('630498fe-466b-4181-972b-637deef0dee6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3.85, 0.32, 0.00, 4.17, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 09:39:05', NULL, NULL, 0.00, NULL),
('63e31c11-bd06-4df2-9721-3ffd7539c5a5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.59, 0.66, 0.00, 7.25, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 04:00:21', NULL, NULL, NULL, ''),
('654e3a9a-8183-465b-86d7-d4986d10d4d9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1.99, 0.16, 0.00, 2.15, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 18:34:11', NULL, NULL, NULL, NULL),
('656ee87c-ef90-4251-962f-36afa77f599d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 25.00, 2.06, 0.00, 27.06, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-03 10:04:59', NULL, NULL, 0.00, NULL),
('67585ef1-874b-4411-9533-93a1d7c01412', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 4.98, 0.41, 0.00, 5.39, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 18:34:22', NULL, NULL, NULL, NULL),
('6947bae0-c6eb-4e2c-b05e-fcc75cc3ec44', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 11.07, 0.91, 0.00, 11.98, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 15:39:25', NULL, NULL, 0.00, NULL),
('6a3102ee-87de-4db1-b466-0a3931d99f3a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9.99, 0.00, 0.00, 9.99, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 10:22:05', NULL, NULL, 0.00, NULL),
('6ae9312a-febc-4109-bfab-62466b0f5787', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 17.39, 0.00, 0.00, 17.39, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-25 23:37:20', NULL, NULL, 0.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('6e28e524-7656-4dc8-9cad-180260f7069f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1.50, 0.12, 0.00, 1.62, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 21:16:40', NULL, NULL, 0.00, NULL),
('6f16c6d3-d352-4555-8441-589524e9fe27', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 2.49, 0.21, 0.00, 2.70, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 19:27:23', NULL, NULL, NULL, '0fe0c3a7-1096-4937-9a00-dfe6afa2efac'),
('720d1457-e4e4-4f64-8d55-6649e861d1ac', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 2452.00, 101.15, 0.00, 1327.15, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:27:37', 'percentage', 50.00, 1226.00, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('722a03b4-32b9-4bc1-b6e4-f793a0825239', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 17.59, 1.45, 0.00, 19.04, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 19:25:41', NULL, NULL, 0.00, '566ea385-aadc-41cd-bfda-1b3fb8bb4edf'),
('7260e4e7-cba7-41d4-9e3e-f10a7c1c4b45', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 13.45, 0.00, 176.45, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-05 11:23:03', NULL, NULL, 0.00, NULL),
('74868ac1-73a5-417a-97eb-53bb99420ddd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 17.80, 1.06, 0.00, 13.86, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:27:01', 'fixed', 5.00, 5.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('75dbad64-c638-4c48-b33d-956bb29dc284', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 14.84, 0.98, 0.00, 15.82, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 21:40:27', NULL, NULL, 0.00, 'ec16e637-fdd8-4594-b7a7-31495b9ab95f'),
('76eb82fe-36cc-499d-88c3-e52ee5cced9d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7.75, 0.64, 0.00, 8.39, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 21:51:12', NULL, NULL, 0.00, NULL),
('76ffa68d-3d19-40fe-89b9-638ec4ddcefe', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 13.45, 0.00, 176.45, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 10:26:30', NULL, NULL, 0.00, NULL),
('79a526a2-29e8-4e6c-8deb-6e9508f570e0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 60.00, 4.95, 0.00, 64.95, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-06 08:04:42', NULL, NULL, 0.00, NULL),
('7b2c3d08-9d30-4419-90b1-3ae756e698f3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 20.97, 1.73, 0.00, 22.70, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 15:47:02', NULL, NULL, 0.00, NULL),
('7b869ace-96c7-4252-8939-bc16b602791e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 799.00, 32.96, 0.00, 432.46, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 16:07:19', 'percentage', 50.00, 399.50, '7acc70a5-8372-425f-a28c-adb7c239457e'),
('7bc9556f-8c4b-484f-8d15-5adb31109126', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 749.00, 55.61, 0.00, 729.71, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-04 03:33:15', 'percentage', 10.00, 74.90, 'ac5d853a-6e91-4275-ad94-1c3601e40892'),
('7eac203f-c870-45ba-88b5-fd793be7c99d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 13.45, 0.00, 176.45, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 09:59:49', NULL, NULL, 0.00, NULL),
('7f8cfd5b-8870-4df1-9f1b-453bf9cb638f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3.85, 0.00, 0.00, 3.85, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 10:01:09', NULL, NULL, 0.00, NULL),
('8508b5e9-20a9-4a7a-8cb2-d74006e31191', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 12.07, 1.00, 0.00, 13.07, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 17:51:44', NULL, NULL, NULL, NULL),
('89abe8fd-7d71-4e40-a275-9f60164215ea', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.95, 0.70, 0.00, 7.65, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 05:37:45', NULL, NULL, NULL, NULL),
('8b1db9a1-2d80-4106-83e1-10c231953e2c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.85, 0.69, 0.00, 7.54, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 09:28:45', NULL, NULL, NULL, ''),
('8b1f3bac-8bb1-4322-8ba4-81032c52ba33', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3.85, 0.16, 0.00, 4.01, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 01:03:53', NULL, NULL, 0.00, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('8b478c8a-3150-45a6-a01b-d37bbeae6ff2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.00, 0.41, 0.00, 5.41, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 14:25:01', NULL, NULL, 0.00, NULL),
('8c1365fd-9852-4e35-b426-8f710b3a9f92', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 906.80, 74.81, 0.00, 981.61, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:59:36', NULL, NULL, 0.00, NULL),
('8e13fb01-bd1e-4a8e-b031-facda22033f2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.19, 1.25, 0.00, 16.44, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 10:54:51', NULL, NULL, NULL, NULL),
('8f3765c9-9651-49fc-9382-c8b0ee7da1d3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 13.45, 0.00, 176.45, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 10:16:31', NULL, NULL, 0.00, NULL),
('921dd3ec-0dd8-40f3-ba96-42bbb8e3688d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.64, 0.88, 0.00, 16.52, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 12:23:24', NULL, NULL, 0.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('949ebb34-8285-4f62-90d5-6381a40c5a8c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.50, 0.54, 0.00, 7.04, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 21:17:47', NULL, NULL, 0.00, NULL),
('94f38e52-e9a3-42c7-9b5a-93d32363e583', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 17.79, 0.73, 0.00, 18.52, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 23:54:11', NULL, NULL, 0.00, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('9578d64d-6c06-4af7-8fd7-98e0622af9ac', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1480.00, 122.10, 0.00, 1602.10, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-03 10:05:33', NULL, NULL, 0.00, NULL),
('961abb66-0966-489b-af03-11adc536e782', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.00, 0.60, 0.00, 6.60, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 11:49:29', NULL, NULL, NULL, ''),
('974f9a3c-f478-499f-a39b-fc6a539b8812', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 2.95, 0.24, 0.00, 3.19, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 20:19:45', NULL, NULL, NULL, NULL),
('97f42afb-f5b9-4c7a-94b0-9b0f3660c258', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3743.25, 308.82, 0.00, 4052.07, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:36:04', NULL, NULL, 0.00, 'a98644da-bc81-481b-9b1a-a9de5ee8468d'),
('98e52b69-796b-44fb-afa7-f7d419b45633', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 360.00, 29.70, 0.00, 389.70, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-11 10:59:21', NULL, NULL, 0.00, NULL),
('9a6944e8-f637-4698-98c8-f4d8150bb874', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 38.40, 3.17, 0.00, 41.57, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-07 14:14:15', NULL, NULL, 0.00, NULL),
('9bb9cdd4-fcd7-4cb5-b722-092d02701ef2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.84, 0.58, 0.00, 6.42, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:50:46', NULL, NULL, NULL, NULL),
('9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 14.69, 1.47, 0.00, 16.16, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:05:29', NULL, NULL, NULL, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('9fecb2c9-99be-4911-b3bc-4ada6df83694', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 13.59, 1.22, 0.00, 13.45, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:17:12', NULL, NULL, 1.36, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('9ffc1ad1-8238-40b9-a5c7-a8620a094ac7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 260.00, 21.45, 0.00, 281.45, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-11 10:59:59', NULL, NULL, 0.00, NULL),
('a189a025-b269-409b-87e7-c29f5f7e33c0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 47.50, 3.09, 0.00, 40.59, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 11:55:30', 'fixed', 10.00, 10.00, '083e0734-5aed-42e3-b978-c5a3d524c9e4'),
('a1bdaff0-fa53-4fb9-84be-ecc792104091', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 2.25, 0.23, 0.00, 2.48, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:20:18', NULL, NULL, NULL, NULL),
('a1c83478-b3a6-4e7f-8955-b845ae437f70', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.54, 1.28, 0.00, 16.82, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 19:41:41', NULL, NULL, NULL, NULL),
('a29c0234-bd43-4d00-91d8-04125f6cb522', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 16.41, 1.31, 0.00, 17.23, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 17:55:01', NULL, NULL, 0.49, NULL),
('a2d5c73b-8298-4915-a9fb-5d0b2675c54e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 13.45, 0.00, 176.45, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 10:05:24', NULL, NULL, 0.00, NULL),
('a554ea47-1e3b-4c34-bf7f-fb8d6af52b1a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1162.00, 95.87, 0.00, 1257.87, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-05 21:51:14', NULL, NULL, 0.00, NULL),
('a6ebf1df-200c-4bdf-b51f-e64778f2a8cd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1245.00, 102.71, 0.00, 1347.71, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 14:09:48', NULL, NULL, 0.00, NULL),
('aa190312-e5c5-4655-a044-e2bddc9f3057', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9.99, 1.00, 0.00, 10.99, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:20:52', NULL, NULL, NULL, '7acc70a5-8372-425f-a28c-adb7c239457e'),
('ada4c8cb-3fb3-42e2-a7f3-3f751d44b977', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3.85, 0.16, 0.00, 4.01, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 01:18:48', NULL, NULL, 0.00, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('ae3f93ad-d00e-40c0-a666-f33e7816ec7f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 33.78, 3.38, 0.00, 37.16, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 11:52:22', NULL, NULL, NULL, ''),
('aea258b8-991b-48d7-bd77-ffaa5c00472a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1.99, 0.16, 0.00, 2.15, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 14:27:58', NULL, NULL, 0.00, NULL),
('aff75fd0-4a08-42bb-baee-4b4974a10ca0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 17.94, 1.07, 0.00, 19.01, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 00:47:10', NULL, NULL, 0.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('b4349a32-d394-494a-a0bb-e175dbb8dc56', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 45.60, 2.94, 0.00, 38.54, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-06 08:48:41', 'fixed', 10.00, 10.00, '083e0734-5aed-42e3-b978-c5a3d524c9e4'),
('b6ebaf8e-9edf-476b-937a-b62eb82bb505', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1759.95, 145.20, 0.00, 1905.15, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-07 16:19:08', NULL, NULL, 0.00, NULL),
('b8b73bcb-4f97-42d6-a78e-e61ea99cc4c7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 799.00, 65.92, 0.00, 864.92, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 13:46:06', NULL, NULL, 0.00, NULL),
('b93fce95-9fe7-4e53-a879-5f64d26be589', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 899.00, 66.75, 0.00, 875.85, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 13:39:43', 'percentage', 10.00, 89.90, 'ac5d853a-6e91-4275-ad94-1c3601e40892'),
('baf01e81-1f9f-44a0-8147-a261fc111adb', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.19, 1.52, 0.00, 16.71, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:13:03', NULL, NULL, NULL, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('bba0eff6-fb3d-43e3-941a-9b6c2f375617', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.35, 0.64, 0.00, 6.98, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 09:25:13', NULL, NULL, NULL, ''),
('bbeeb7fb-ed8d-43db-9a55-cb231b5d6f1b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 999.00, 82.42, 0.00, 1081.42, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-11 10:23:41', NULL, NULL, 0.00, NULL),
('becb1993-9d2e-429f-bc6c-c6d0979ca73f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 4.49, 0.45, 0.00, 4.94, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:07:18', NULL, NULL, NULL, ''),
('c0535628-88d0-434f-9f11-01ca242f639c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 62.94, 5.19, 0.00, 68.13, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-06 08:06:25', NULL, NULL, 0.00, '5f9d994d-7aa3-4f0d-b30e-f4264eed54e3'),
('c07fd97a-1f98-43dd-9a3c-eb0139cc1a8b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.35, 0.54, 0.00, 5.89, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 05:23:54', NULL, NULL, NULL, ''),
('c0b2f1df-647d-4120-ab8a-a7bdcea02d3e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3038.00, 250.64, 0.00, 3288.64, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-11 08:52:59', NULL, NULL, 0.00, NULL),
('c170a67c-2808-4ffa-ab76-a667eb62cc27', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.35, 0.54, 0.00, 5.89, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 11:55:23', NULL, NULL, NULL, ''),
('c19baf5f-0db6-44a0-8fb3-86f58340815e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1.80, 0.15, 0.00, 1.95, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 19:24:32', NULL, NULL, NULL, '0fe0c3a7-1096-4937-9a00-dfe6afa2efac'),
('c3f863cf-316e-4bf3-8cf2-3ed72b963760', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.00, 0.41, 0.00, 5.41, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-11 08:52:26', NULL, NULL, 0.00, NULL),
('c48ad082-1560-427f-a4cb-a16f501bdd50', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9.00, 0.33, 0.00, 4.33, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-04 07:55:24', 'fixed', 5.00, 5.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('c5c365d9-1830-49c6-a1f3-89dbf702c045', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 2.85, 0.29, 0.00, 3.14, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 05:36:13', NULL, NULL, NULL, NULL),
('c8de6ea9-3a62-42a7-8c6b-7f17208da11e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3.85, 0.00, 0.00, 3.85, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 10:08:28', NULL, NULL, 0.00, NULL),
('c9bb8168-dd72-4026-a10b-55f5ade425ac', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 200.00, 16.50, 0.00, 216.50, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-11 11:01:01', NULL, NULL, 0.00, NULL),
('cab72c77-0c99-4c84-88d6-978e43f6d8b0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3.85, 0.00, 0.00, 3.85, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 10:21:41', NULL, NULL, 0.00, NULL),
('d103fd6a-33e6-4194-a0c0-c36c50418fb0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 13.84, 0.00, 0.00, 13.84, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 10:37:35', NULL, NULL, 0.00, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('d3c4dec0-0b07-4a7c-8c7d-182530b7e9dc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 13.45, 0.00, 176.45, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 10:37:12', NULL, NULL, 0.00, NULL),
('d3e87c68-2fbd-48d0-90b6-cb8796c0d9d3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3774.00, 310.53, 0.00, 4074.53, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:12:57', 'fixed', 10.00, 10.00, '083e0734-5aed-42e3-b978-c5a3d524c9e4'),
('d566c786-767c-434e-8e60-7a0e26cd4923', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9.94, 0.99, 0.00, 10.93, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:18:27', NULL, NULL, NULL, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('d9b447a0-dc08-4a60-9653-f92be02668e9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 4.10, 0.00, 0.00, 0.00, '00000000-0000-0000-0000-000000000000', NULL, 'completed', 'PAID', '2025-05-22 17:13:39', NULL, NULL, 4.10, NULL),
('db49dc92-a913-4b09-adde-b5adf6ea6787', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 326.00, 26.90, 0.00, 352.90, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-27 11:38:18', NULL, NULL, 0.00, NULL),
('dc596ff6-e0b6-49b8-a058-f0be03498df1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1245.00, 102.71, 0.00, 1347.71, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 14:00:07', NULL, NULL, 0.00, NULL),
('de34f1ec-4a2f-4b06-a7c8-dd7d00007f8a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 163.00, 13.45, 0.00, 176.45, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 09:58:00', NULL, NULL, 0.00, NULL),
('dff4d19d-015e-4077-8d6a-e9e59bb56822', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.00, 0.21, 0.00, 2.71, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 13:24:58', 'percentage', 50.00, 2.50, '7acc70a5-8372-425f-a28c-adb7c239457e'),
('e14bbb18-dbe3-4641-b739-661f1a0de630', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.64, 0.00, 0.00, 15.64, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-25 23:32:22', NULL, NULL, 0.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('e2c93d4b-4bef-401c-9273-5f942e478218', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1.99, 0.16, 0.00, 2.15, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 17:59:01', NULL, NULL, NULL, NULL),
('e3f33851-3653-4121-a71e-af45a9f3f2ca', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 999.00, 74.18, 0.00, 973.28, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-04 07:31:14', 'percentage', 10.00, 99.90, 'ac5d853a-6e91-4275-ad94-1c3601e40892');
INSERT INTO `sales` (`id`, `tenant_id`, `store_id`, `cashier_id`, `subtotal`, `tax`, `discount`, `total`, `payment_method`, `payment_reference`, `status`, `payment_status`, `created_at`, `discount_type`, `discount_value`, `discount_amount`, `customer_id`) VALUES
('e501a905-567d-4a4a-a88a-885bed5aeda0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6436.75, 526.91, 0.00, 6913.66, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-08 08:27:10', 'fixed', 50.00, 50.00, '503e4102-68a7-46e0-a4c9-e798b344ca7b'),
('e6defc7a-8d1a-4dc7-a815-23aaf893a4ab', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 13.84, 1.14, 0.00, 14.98, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 19:33:41', NULL, NULL, 0.00, '566ea385-aadc-41cd-bfda-1b3fb8bb4edf'),
('e826dc43-8a2c-440d-90dd-d65dcc1f595c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7.80, 0.32, 0.00, 8.12, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-26 10:38:50', NULL, NULL, 0.00, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('e84a2ed6-cd12-401c-96b4-d219451f8fb0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 8.10, 0.81, 0.00, 8.91, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 05:39:06', NULL, NULL, NULL, NULL),
('e89b7185-49d7-40ec-a320-fa8fdd65211c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 6.59, 0.66, 0.00, 7.25, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 04:24:37', NULL, NULL, NULL, ''),
('e8a5a9d0-b7df-4b8f-8040-abe21b26011d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9.00, 0.74, 0.00, 9.74, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 20:18:44', NULL, NULL, NULL, NULL),
('e9208b05-33ce-4cd9-9197-f167d869e8d4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 15.64, 1.29, 0.00, 16.93, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 19:26:40', NULL, NULL, 0.00, '566ea385-aadc-41cd-bfda-1b3fb8bb4edf'),
('ebf0fe7b-9f1f-4eaf-a6d7-04c96cf0fe12', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7.80, 0.64, 0.00, 8.44, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-03 10:04:34', NULL, NULL, 0.00, NULL),
('ee07c583-f4c1-4fe8-9805-b12b57cdd5fd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7.45, 0.61, 0.00, 8.06, 'e9ca76b3-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 17:35:33', NULL, NULL, NULL, NULL),
('ef6bbe6f-28e4-4d06-b0dc-a9cebb0df973', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 9.99, 0.00, 0.00, 9.99, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 10:22:13', NULL, NULL, 0.00, NULL),
('f0ba7544-63ce-4887-b234-06531ef15e38', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 7.80, 0.64, 0.00, 8.44, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 13:51:28', NULL, NULL, 0.00, NULL),
('f3f31f7d-ddcd-4921-9a44-4fd3dffd20ac', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 12.80, 0.81, 0.00, 10.61, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-12 14:54:28', 'fixed', 3.00, 3.00, NULL),
('f43996f0-c7ef-4e18-885e-f805a527a515', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.95, 0.70, 0.00, 7.65, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 13:05:17', NULL, NULL, NULL, 'f14d11c7-cd67-460a-8bff-2beea3980f85'),
('f584c877-2d87-4d1c-9df2-1b2e5027a239', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3756.50, 154.96, 0.00, 2033.21, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:29:37', 'percentage', 50.00, 1878.25, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('f5d90868-a1ae-4a8a-82c9-8f9c7f387137', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 1701.85, 139.58, 0.00, 1831.43, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:54:47', 'fixed', 10.00, 10.00, '083e0734-5aed-42e3-b978-c5a3d524c9e4'),
('f67c72fa-1f6a-4d94-a679-a2f55cff8e4f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 5.00, 0.41, 0.00, 5.41, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 11:34:08', NULL, NULL, 0.00, NULL),
('f7cd9e5b-bd9e-4e35-818c-3a95196a7733', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3.85, 0.29, 0.00, 3.75, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-04 07:52:47', 'percentage', 10.00, 0.39, 'ac5d853a-6e91-4275-ad94-1c3601e40892'),
('f7dcbef4-1fec-4d10-860f-74aa554b29f3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 3.85, 0.00, 0.00, 3.85, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-24 10:00:23', NULL, NULL, 0.00, NULL),
('f83ce334-7f3d-4ba9-86a4-a915695e8714', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 899.00, 37.08, 0.00, 486.58, 'e9ca7670-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-09 12:57:18', 'percentage', 50.00, 449.50, 'ecf5b65f-e11f-4dcb-91df-cc5f90697c30'),
('fb1207da-0027-4287-a488-3916982776a9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 9.94, 0.99, 0.00, 10.93, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 14:20:06', NULL, NULL, NULL, NULL),
('fcb03cfa-806c-49e0-af76-160e81168101', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 749.00, 55.61, 0.00, 729.71, 'e9ca75b4-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-06-04 03:25:22', 'percentage', 10.00, 74.90, 'ac5d853a-6e91-4275-ad94-1c3601e40892'),
('fe533d3a-4992-4a23-9111-b37af05e8426', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 10.08, 0.83, 0.00, 10.91, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-22 17:55:23', NULL, NULL, NULL, NULL),
('febad102-c9f8-4d81-ae17-6d773f28c402', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 6.95, 0.70, 0.00, 7.65, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-21 12:54:51', NULL, NULL, NULL, NULL),
('ffe373a2-b9a8-45e3-8757-8ec47f40f6ab', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 11.49, 0.95, 0.00, 12.44, 'e9ca7524-35f4-11f0-8297-525400148990', NULL, 'completed', 'PAID', '2025-05-23 01:47:32', NULL, NULL, 0.00, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `sale_items`
--

CREATE TABLE `sale_items` (
  `id` char(36) NOT NULL,
  `sale_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `sale_items`
--

INSERT INTO `sale_items` (`id`, `sale_id`, `product_id`, `quantity`, `price`, `created_at`) VALUES
('0024cf65-c243-4f4b-9582-98d5843fd20d', '24d6cff3-146d-4f7e-bd11-494796654988', '056250b8-90d2-41e8-b9c7-1a866658ee7f', 1, 749.00, '2025-06-09 12:58:03'),
('00846539-665b-4e83-9ea1-dd6aef2fc43e', 'a1bdaff0-fa53-4fb9-84be-ecc792104091', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 12:20:18'),
('00ebaa07-85e2-46ca-b683-753c4cb3488c', '75dbad64-c638-4c48-b33d-956bb29dc284', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 21:40:27'),
('01c14a18-39ba-44f4-b7fc-8d294f0a7d34', '622d2c66-957f-4cea-b86a-a96e0317b689', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 05:15:15'),
('02218f5a-ea44-4136-856f-5ee6bda7cce4', 'cab72c77-0c99-4c84-88d6-978e43f6d8b0', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 10:21:41'),
('02aaa3c6-5f42-4a84-a163-857d11ca0ec1', '89abe8fd-7d71-4e40-a275-9f60164215ea', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-22 05:37:45'),
('035ae5a6-f766-49f6-8fd7-835e5d2b0294', '33da33e3-6f97-42a6-aa13-0232c5c84887', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-22 17:57:47'),
('03b45eda-9af9-43d3-b344-10ec0f4aae53', '088dc28b-4dea-4871-9227-d6a908e0c0ea', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-20 12:44:57'),
('03b878c0-1ac8-405f-a470-d2da6b7b6efe', '5b594d33-dcdb-4b62-a71a-a08fb01500b7', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 11:25:31'),
('046ce561-78b7-419d-8162-23700fed2ddb', 'c170a67c-2808-4ffa-ab76-a667eb62cc27', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 11:55:23'),
('05479c78-05ab-41eb-8270-4f52b9a16a56', '8b1db9a1-2d80-4106-83e1-10c231953e2c', '187b21e6-639b-42b4-8199-28e1a2e49f9c', 1, 3.75, '2025-05-21 09:28:45'),
('05c0a746-a51c-4686-81ab-f682ece92313', '2749c3f0-bf90-46b2-bcc1-fbef2a9dde1f', '56b60d92-35a1-4b1d-9be0-514779568b40', 4, 2.35, '2025-06-09 13:56:30'),
('05e864f3-dec9-4340-b632-db933900cbe3', '3e761ec1-d72f-43b8-8b0f-fdf7d344fa24', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 05:04:31'),
('064f0d8c-f517-468a-b305-34ca03fd8001', '0f1b6715-262a-4c40-9134-86c6016f589f', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 04:11:25'),
('06ca97d8-e320-468a-994c-cc066e203a27', '3e52bc21-34c6-49e4-b15e-af23f4f63e31', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-21 09:26:27'),
('070709f7-c67e-4e2d-98ba-d0154c7cc4e0', '9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-21 12:05:29'),
('079cf4bb-4ea6-48fa-a1ad-124f5d881006', 'ee07c583-f4c1-4fe8-9805-b12b57cdd5fd', 'ed2f4421-fca0-4827-b7c3-d814f46252c6', 1, 4.50, '2025-05-22 17:35:33'),
('0848f92c-02b1-46f5-ab56-89faf2c76a64', 'b6ebaf8e-9edf-476b-937a-b62eb82bb505', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 1, 5.00, '2025-06-07 16:19:08'),
('0877965b-65fd-4721-9f54-760f629f79c1', '01bc04ac-c63f-484f-8488-4c4ab978e2af', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 1, 799.00, '2025-06-08 09:31:59'),
('0884492e-8db1-45a0-a525-a855cf6b3369', '57857aec-9b2c-4be0-9afb-4fde047a577e', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', 1, 1475.00, '2025-06-05 07:37:15'),
('089f3410-0bbd-4ab1-9abd-4a48d8fee504', 'a189a025-b269-409b-87e7-c29f5f7e33c0', '627d7c55-921a-4916-8bf9-98f1bbc4ad08', 3, 15.00, '2025-06-09 11:55:30'),
('0994a446-80d8-48d0-94d6-c491d8d1882f', '3fd9a1fd-f306-4fba-bca0-da40bf293251', 'c4d1fe2b-c711-494c-93d1-e0932962a61e', 1, 999.00, '2025-06-08 14:30:13'),
('0abcf4fc-6223-4f55-a2cb-ab2263c14ac6', '265cfdab-8094-4e5f-a794-37deb69fb0ee', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 11:50:49'),
('0abd996f-efed-4656-8e74-aeaee240a667', '13e744e6-0d28-4b34-860c-3f4a810b4b4a', '5c08c1dc-5559-4470-8151-c026805899dd', 2, 1.25, '2025-06-09 12:21:15'),
('0db4b3e2-ae03-4eae-b79d-7dc74d30341c', '7260e4e7-cba7-41d4-9e3e-f10a7c1c4b45', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-06-05 11:23:03'),
('0e124e74-d005-49ad-8a4d-f70143f8be47', 'bba0eff6-fb3d-43e3-941a-9b6c2f375617', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 09:25:13'),
('0ee98822-dc00-447b-96c6-951b64fb0456', 'e9208b05-33ce-4cd9-9197-f167d869e8d4', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 19:26:40'),
('0f35240c-240f-4b18-9f6d-6648754b88f6', '9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-05-21 12:05:29'),
('0f5e3f4f-1408-41b5-9c2e-9b6cd886014a', '33b58c5e-e0b3-4899-b35d-aa41fad917d2', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 05:07:40'),
('0faa753b-895a-4523-b040-710760d6afa9', '9fecb2c9-99be-4911-b3bc-4ada6df83694', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 12:17:12'),
('0fc94f96-110e-4f8b-87d3-4f2c276376c9', 'ffe373a2-b9a8-45e3-8757-8ec47f40f6ab', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 1, 1.50, '2025-05-23 01:47:32'),
('0fdec2c6-9416-47f5-b00e-759890e1c5ec', '9a6944e8-f637-4698-98c8-f4d8150bb874', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 3, 5.00, '2025-06-07 14:14:15'),
('12293d66-a4c3-4cec-8ce9-c49dba8a1a2a', '5c15b8bd-f29c-433c-9003-c54bacfa7ec4', 'af783643-559f-4a32-848e-03da9524e85c', 1, 2.95, '2025-05-23 02:04:42'),
('12537764-f238-43a4-9735-56d2951fe23b', '0040f320-8ede-439c-9a42-036c454d996c', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-26 00:59:22'),
('12648d28-2595-41de-a821-4372c8fa16c8', '7b2c3d08-9d30-4419-90b1-3ae756e698f3', 'f4d52a04-b5d5-49dc-8aa4-d01947ee16d9', 3, 6.99, '2025-06-09 15:47:02'),
('12a48739-4c62-4226-ae1c-0231048d5c3d', '720d1457-e4e4-4f64-8d55-6649e861d1ac', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 1, 799.00, '2025-06-09 12:27:37'),
('13309b7a-3543-4a07-82f8-82e81827c908', 'f0ba7544-63ce-4887-b234-06531ef15e38', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-06-09 13:51:28'),
('13a242ba-23a3-44e4-b667-0adf512352b3', '0436db07-7abb-41e8-a9a0-a4e7028eb992', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 10:45:54'),
('14623a5a-f95b-4c2a-844d-5c3f143c9b91', '41a2d61d-ba3e-4116-ab9c-55d18549d19d', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', 1, 1475.00, '2025-06-11 11:04:12'),
('150066f3-edeb-45f8-b3f2-0b9b64b88723', '4ea4ed67-033f-47ae-b3eb-1c580456dc91', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 4, 1.80, '2025-06-06 08:41:46'),
('155a64bb-2e27-4b33-9f41-6a9cadd0278c', '3c7bfc55-b3f1-4392-ac4b-6a2f6de28616', 'b82e1887-40f9-4475-b277-ef45e093bf56', 2, 7.80, '2025-06-09 16:29:14'),
('158b71ac-b449-4565-af87-5c28d0d70809', '6ae9312a-febc-4109-bfab-62466b0f5787', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-25 23:37:20'),
('15cc74b7-efd3-436c-ab74-849681d605a9', '722a03b4-32b9-4bc1-b6e4-f793a0825239', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 19:25:41'),
('16ad9e67-9365-4f8f-8c74-e430d3c0112f', '4f65ddef-df52-4013-bc0b-c4c4a1301d5b', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', 1, 1475.00, '2025-06-11 08:54:55'),
('17425760-dda2-4f6e-a7b5-387b68119b89', '9fecb2c9-99be-4911-b3bc-4ada6df83694', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-05-21 12:17:12'),
('176a19e6-4c83-4efd-b129-af42ea248bbc', '0b086a7b-2203-4168-be4f-63a13edb9c30', '55f2568f-96cf-46a8-b156-a633be5b591c', 1, 1400.00, '2025-06-04 07:25:32'),
('17ff5c8d-27b5-4c51-b26f-7945fde99aaa', '76eb82fe-36cc-499d-88c3-e52ee5cced9d', 'af783643-559f-4a32-848e-03da9524e85c', 1, 2.95, '2025-05-22 21:51:12'),
('185cd6c8-1055-434d-9329-a65dfd3bd9f2', 'e14bbb18-dbe3-4641-b739-661f1a0de630', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-25 23:32:22'),
('1862e20f-aaa1-4464-8749-5435c8f504ba', '24d6cff3-146d-4f7e-bd11-494796654988', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 1, 799.00, '2025-06-09 12:58:03'),
('18d00477-fd85-49bb-ae20-680d537a6609', 'a554ea47-1e3b-4c34-bf7f-fb8d6af52b1a', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-06-05 21:51:14'),
('19651e89-9c81-4f32-9f81-806ed8c693a9', '97f42afb-f5b9-4c7a-94b0-9b0f3660c258', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 3, 1245.00, '2025-06-09 12:36:04'),
('198ec937-9fe8-4b17-93da-bd32dfabbd90', 'e8a5a9d0-b7df-4b8f-8040-abe21b26011d', '187b21e6-639b-42b4-8199-28e1a2e49f9c', 1, 3.75, '2025-05-22 20:18:44'),
('1b721fcc-15b4-4462-a0db-c7f406fb8371', '55a91e70-3811-4d6c-a57c-5be5417d9158', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-22 17:35:24'),
('1c342a10-dc44-47a0-a069-57685a474930', '13e744e6-0d28-4b34-860c-3f4a810b4b4a', '627d7c55-921a-4916-8bf9-98f1bbc4ad08', 2, 15.00, '2025-06-09 12:21:15'),
('1c358b7f-bbaa-494c-a4d5-273eda87a58f', '5b5507a5-19a5-4dfc-9b82-6c53332ba2f3', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-22 20:20:33'),
('1c49bfa9-7c19-446b-9401-e66ec653bb9b', 'febad102-c9f8-4d81-ae17-6d773f28c402', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-21 12:54:51'),
('1caa5ed3-7266-42fd-a97d-ac9675d3ee47', '3a5ab606-6417-4ac6-a97c-339eab8b6df2', '22dbdb82-8f0c-424a-9be3-1c1d57969aa1', 1, 4.80, '2025-05-21 05:10:12'),
('1db352d5-c734-4156-819b-0a4125c8559d', 'ae3f93ad-d00e-40c0-a666-f33e7816ec7f', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 2, 5.25, '2025-05-21 11:52:23'),
('1e798011-18f7-4179-a8d7-7254b66a41e2', 'c19baf5f-0db6-44a0-8fb3-86f58340815e', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 1, 1.80, '2025-05-22 19:24:32'),
('1f5c1492-6abb-4b96-ad22-cfb4fe1113d5', '9fecb2c9-99be-4911-b3bc-4ada6df83694', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-21 12:17:12'),
('2156801d-0b64-47ab-87c5-28af0c68de72', '26743683-aa1f-4fc7-8af4-cb467169ba5a', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 2, 1245.00, '2025-06-09 12:20:14'),
('2236e28f-b968-4ca9-bb8a-8c2806fe7080', 'e9208b05-33ce-4cd9-9197-f167d869e8d4', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 19:26:40'),
('227bae7d-ea04-46b8-85e7-59e9e4d05d39', 'd3e87c68-2fbd-48d0-90b6-cb8796c0d9d3', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 3, 1245.00, '2025-06-09 12:12:57'),
('22998a13-71e7-4703-99ae-c0809206703a', 'fe533d3a-4992-4a23-9111-b37af05e8426', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-22 17:55:23'),
('2385b0eb-a80e-46d7-9393-a9b407d12f83', '13e744e6-0d28-4b34-860c-3f4a810b4b4a', '59c5aa8d-33e1-4e3c-ad80-e5735bde8140', 2, 6.50, '2025-06-09 12:21:15'),
('24dbd49a-5db8-4de7-889b-e35d26517c25', '36f7f59b-f2d3-4bf5-9ae4-c45e821ae5ac', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-05-26 10:29:31'),
('25f52879-5c0d-4179-ae58-3e4792f69697', 'e6defc7a-8d1a-4dc7-a815-23aaf893a4ab', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 19:33:41'),
('27bc1315-097b-4d17-9dc1-0a33b9dced44', 'e501a905-567d-4a4a-a88a-885bed5aeda0', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 5, 1245.00, '2025-06-08 08:27:10'),
('28074a5c-2f20-428e-b979-97aa159d5885', 'f43996f0-c7ef-4e18-885e-f805a527a515', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 13:05:17'),
('295f9c39-2bac-4cab-b0b8-e2c656c539a3', 'ae3f93ad-d00e-40c0-a666-f33e7816ec7f', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-21 11:52:23'),
('29e7e510-c0d9-4c81-be6f-ce08979d16be', 'aa190312-e5c5-4655-a044-e2bddc9f3057', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-21 12:20:52'),
('2bb0cc47-4e92-4326-80a3-8363edf8ba08', '1cabe080-11f1-4869-b82f-97363dabd495', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 6, 1245.00, '2025-06-09 13:33:56'),
('2c37ba69-3d9b-4b9d-8053-fc60df687bdd', 'febad102-c9f8-4d81-ae17-6d773f28c402', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 12:54:51'),
('2cac022a-285e-4446-b1ee-99db7f0b7e65', 'c0535628-88d0-434f-9f11-01ca242f639c', 'a3ad9984-5f79-4300-96a5-d153b8a01665', 3, 1.99, '2025-06-06 08:06:25'),
('2d6ecc16-1563-42b1-80c5-86b1e55079b3', '722a03b4-32b9-4bc1-b6e4-f793a0825239', '187b21e6-639b-42b4-8199-28e1a2e49f9c', 1, 3.75, '2025-05-24 19:25:41'),
('2d88a263-4957-42b3-82a0-8574abcb1119', 'f3f31f7d-ddcd-4921-9a44-4fd3dffd20ac', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 1, 5.00, '2025-06-12 14:54:28'),
('2d94f481-fc35-4eb8-92b7-b50d252b5794', '7b869ace-96c7-4252-8939-bc16b602791e', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 1, 799.00, '2025-06-09 16:07:19'),
('2dc6c978-9d8b-4f2a-81c8-13824ae825c4', 'c0b2f1df-647d-4120-ab8a-a7bdcea02d3e', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-06-11 08:52:59'),
('2ec33d92-69d5-4cf8-8698-41e7f5cee892', 'becb1993-9d2e-429f-bc6c-c6d0979ca73f', '9c6458f3-20de-4d18-861c-38a24b68b309', 1, 1.50, '2025-05-21 12:07:18'),
('2efe258e-5f35-4bd0-9230-fc10d8a96ea5', 'c0b2f1df-647d-4120-ab8a-a7bdcea02d3e', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', 1, 1475.00, '2025-06-11 08:52:59'),
('2f3fc7d6-aabe-4b4b-bbf3-a9374a4a1a1c', 'c3f863cf-316e-4bf3-8cf2-3ed72b963760', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 1, 5.00, '2025-06-11 08:52:26'),
('2f440230-b179-42f7-ae04-60404dd81f06', 'd566c786-767c-434e-8e60-7a0e26cd4923', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 12:18:27'),
('3215b980-bd80-418b-ad5a-7f30eaa20f9e', '1e570dce-d230-41e3-9f17-747c7251c89d', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 05:20:52'),
('32591dbb-98d4-4f1b-ba30-d78b2150fa36', '3e761ec1-d72f-43b8-8b0f-fdf7d344fa24', '22dbdb82-8f0c-424a-9be3-1c1d57969aa1', 1, 4.80, '2025-05-21 05:04:31'),
('33159fba-ef99-40ca-a06e-b72dd4ef3b88', '3a5a927d-42b1-4cbd-9657-f16934e939e0', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-25 23:34:09'),
('339c1f62-e675-4b17-a5c9-0604a014ded6', '55692572-d1f0-4d6d-8026-8af1853b66b2', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-24 11:24:36'),
('341876c2-6572-4da0-ba67-8f2f517777fa', 'ee07c583-f4c1-4fe8-9805-b12b57cdd5fd', 'af783643-559f-4a32-848e-03da9524e85c', 1, 2.95, '2025-05-22 17:35:33'),
('348a7f5d-d463-4ba7-b94b-8379fdbb2f03', '5e4c58a6-9dd0-4f10-9f31-f2715ec62503', '000330c9-15a0-40f8-afb2-33c33b222bb7', 2, 9.99, '2025-05-24 11:23:05'),
('34c06c29-824f-444c-8757-84a10df1be8f', 'e84a2ed6-cd12-401c-96b4-d219451f8fb0', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-05-22 05:39:06'),
('351fae13-b2fc-4136-8150-a61049eaef0e', '088dc28b-4dea-4871-9227-d6a908e0c0ea', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-20 12:44:56'),
('361e3726-bd4e-4960-a35a-2cb075f6c9a0', 'baf01e81-1f9f-44a0-8147-a261fc111adb', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-21 12:13:03'),
('363ca845-c63f-469d-be5f-47fb40820897', '47c24705-bf59-4fd6-8c48-561230440bec', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 1, 1.50, '2025-05-22 17:14:21'),
('36d70643-37a9-400d-a818-68fc6184d374', 'e14bbb18-dbe3-4641-b739-661f1a0de630', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-25 23:32:22'),
('3827b204-3b47-4d34-a479-d2871f5f561f', '265cfdab-8094-4e5f-a794-37deb69fb0ee', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 11:50:49'),
('382cbd08-ec4d-4bcf-9cfd-523d00cb2254', '5c80048c-decf-4d63-b6d3-fdc52eeef9c1', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-25 23:40:29'),
('388bc27b-dbbe-42b8-b9b0-698babcc826b', 'c170a67c-2808-4ffa-ab76-a667eb62cc27', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-21 11:55:23'),
('38c05b3a-fae7-4ac7-8a56-9a8ef034f31f', '75dbad64-c638-4c48-b33d-956bb29dc284', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 2, 1.80, '2025-05-24 21:40:27'),
('393e89db-2bc2-4380-8d24-60257368b186', 'a1c83478-b3a6-4e7f-8955-b845ae437f70', '187b21e6-639b-42b4-8199-28e1a2e49f9c', 1, 3.75, '2025-05-22 19:41:41'),
('3af33ed0-d5ac-4ee8-9108-c6b9bdfaa2f1', '5c15b8bd-f29c-433c-9003-c54bacfa7ec4', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 1, 1.50, '2025-05-23 02:04:42'),
('3b0a5e71-aa47-4b0c-b52e-38373c1eeb77', 'f67c72fa-1f6a-4d94-a679-a2f55cff8e4f', '5c08c1dc-5559-4470-8151-c026805899dd', 4, 1.25, '2025-06-09 11:34:08'),
('3bfa07f5-296c-413c-b9a2-66847ed87005', 'a1c83478-b3a6-4e7f-8955-b845ae437f70', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 1, 1.80, '2025-05-22 19:41:41'),
('3c7e2660-098c-48eb-a01a-07b9469a88d0', '8508b5e9-20a9-4a7a-8cb2-d74006e31191', 'a3ad9984-5f79-4300-96a5-d153b8a01665', 1, 1.99, '2025-05-22 17:51:44'),
('3d6474d9-ed44-4f79-b1d8-4509f6e1b886', '9bb9cdd4-fcd7-4cb5-b722-092d02701ef2', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-21 12:50:46'),
('3e21d020-9397-4118-949d-ecf1e602c560', '9a6944e8-f637-4698-98c8-f4d8150bb874', 'b82e1887-40f9-4475-b277-ef45e093bf56', 3, 7.80, '2025-06-07 14:14:15'),
('3e5c4958-ccb2-49a6-835f-a2ed8a5ab102', '5c12e943-7505-4470-8042-8e319387a58c', 'b89be53e-f6b7-4005-9f32-9e890325c658', 1, 899.00, '2025-06-03 10:06:04'),
('3ea4c177-f233-4a20-9e1a-c5bdb5dc875e', '9ffc1ad1-8238-40b9-a5c7-a8620a094ac7', 'a0cff669-2621-4b55-aaac-88e81474710a', 26, 10.00, '2025-06-11 10:59:59'),
('3f0271a4-3184-4d7a-9403-52aad7de716a', '14bebbc8-6960-4489-a4c9-0d40c73d1412', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-05-24 12:23:57'),
('3f8d32ae-83ca-4cda-b592-ffa1e01617b8', '630498fe-466b-4181-972b-637deef0dee6', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 09:39:05'),
('3ff05fcd-c95b-4bd5-ad1e-159a57c50d0f', '49d186f0-6f05-4b1e-a061-20410ffa0ff3', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-24 11:25:06'),
('42eb6a4e-cc6f-4d5e-9913-220a15696ee1', '57c75542-70b0-438e-8043-5b865186540c', 'af783643-559f-4a32-848e-03da9524e85c', 1, 2.95, '2025-05-22 21:18:53'),
('437aee0f-c191-4a55-b935-3fad2545c07f', 'a554ea47-1e3b-4c34-bf7f-fb8d6af52b1a', 'c4d1fe2b-c711-494c-93d1-e0932962a61e', 1, 999.00, '2025-06-05 21:51:14'),
('45315d76-2799-42f3-bcea-1168155cbf92', '265cfdab-8094-4e5f-a794-37deb69fb0ee', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-21 11:50:49'),
('4574c8d2-56c2-45a8-b574-654a0a07777d', 'becb1993-9d2e-429f-bc6c-c6d0979ca73f', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-21 12:07:18'),
('469d1294-e6a0-456c-8d9c-026314837307', '52d30c66-4c71-46f6-93c0-e1c203df9914', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 1, 5.00, '2025-06-09 12:37:46'),
('46e832ea-6162-483e-bbaa-194a4f1e1f77', '6ae9312a-febc-4109-bfab-62466b0f5787', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-25 23:37:20'),
('475f9b96-743f-40a7-ac7b-40c452731afa', '8b1db9a1-2d80-4106-83e1-10c231953e2c', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-21 09:28:45'),
('4778bf1b-7e28-4b0e-b061-cb2274224e1d', '656ee87c-ef90-4251-962f-36afa77f599d', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 5, 5.00, '2025-06-03 10:04:59'),
('47e5d4dd-e01c-4f54-9141-74102492e626', '722a03b4-32b9-4bc1-b6e4-f793a0825239', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 19:25:41'),
('4847bfb4-d7cd-4193-bf57-b07eec5bfb5e', '4ea4ed67-033f-47ae-b3eb-1c580456dc91', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 3, 2.49, '2025-06-06 08:41:46'),
('4861f1d7-3d2b-4e60-8080-f1ea929fc03e', 'fe533d3a-4992-4a23-9111-b37af05e8426', '9c6458f3-20de-4d18-861c-38a24b68b309', 1, 1.50, '2025-05-22 17:55:23'),
('49f07a81-dcf2-4f3a-a4cc-ea1d75fac4e2', '2688e9d0-bbd8-467f-8a1c-ab9cc4b30999', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 3, 5.25, '2025-06-09 11:35:50'),
('4b1735d4-03f2-419c-89f1-e35404444330', '3b8273b6-5172-4b5d-93b8-70f7e1e2d3a3', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-06-04 07:44:54'),
('4b3dfb4f-0795-43d0-b436-e1bad49afb3a', '26743683-aa1f-4fc7-8af4-cb467169ba5a', '9c6458f3-20de-4d18-861c-38a24b68b309', 2, 1.50, '2025-06-09 12:20:14'),
('4d320e95-b580-4f03-9db4-0f4845d9d13a', '088dc28b-4dea-4871-9227-d6a908e0c0ea', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-20 12:44:57'),
('4d606858-e08c-4357-a59c-45c81bfe38e0', '8f3765c9-9651-49fc-9382-c8b0ee7da1d3', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-05-26 10:16:31'),
('4db59acb-5b1a-4b2c-a1c2-5608af6673de', 'd3e87c68-2fbd-48d0-90b6-cb8796c0d9d3', '59c5aa8d-33e1-4e3c-ad80-e5735bde8140', 6, 6.50, '2025-06-09 12:12:57'),
('4e7ee984-7eab-49f4-a5ac-a32ee4e854ed', 'a1c83478-b3a6-4e7f-8955-b845ae437f70', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-22 19:41:41'),
('510595f8-819a-4e1e-9b4d-32a327c50a5b', 'c07fd97a-1f98-43dd-9a3c-eb0139cc1a8b', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-21 05:23:54'),
('51b6492a-39c3-4394-8d72-79836b3405d2', '7bc9556f-8c4b-484f-8d15-5adb31109126', '056250b8-90d2-41e8-b9c7-1a866658ee7f', 1, 749.00, '2025-06-04 03:33:15'),
('528db232-fd56-416d-b0ee-30d4413b4249', '52d30c66-4c71-46f6-93c0-e1c203df9914', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', 1, 1475.00, '2025-06-09 12:37:46'),
('52a71104-ece0-4332-bba3-1aae7f1edb5c', '33b58c5e-e0b3-4899-b35d-aa41fad917d2', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 05:07:40'),
('530bb6d4-e664-4324-9031-7b4c0a007937', '2688e9d0-bbd8-467f-8a1c-ab9cc4b30999', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 5, 1.50, '2025-06-09 11:35:50'),
('5322aba9-f995-49c2-9aaf-4dfefeeed6a1', '1cabe080-11f1-4869-b82f-97363dabd495', 'e03dc952-7f98-421d-924b-4f819abe666e', 12, 5.00, '2025-06-09 13:33:56'),
('545bf050-138d-485e-9e8d-f76daf408f55', 'a6ebf1df-200c-4bdf-b51f-e64778f2a8cd', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 1, 1245.00, '2025-06-09 14:09:48'),
('5536f545-887a-469b-a681-49c1e12c8ba5', 'fb1207da-0027-4287-a488-3916982776a9', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-21 14:20:06'),
('558ebcae-9a4d-47a1-9a54-9247a73b4a3f', '98e52b69-796b-44fb-afa7-f7d419b45633', '627d7c55-921a-4916-8bf9-98f1bbc4ad08', 20, 15.00, '2025-06-11 10:59:21'),
('56d1b96c-6aa6-46ed-882b-54bf208d0e88', 'e14bbb18-dbe3-4641-b739-661f1a0de630', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 1, 1.80, '2025-05-25 23:32:22'),
('58799245-3e65-471e-adf7-338dfbea4724', 'e8a5a9d0-b7df-4b8f-8040-abe21b26011d', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-05-22 20:18:44'),
('58cdc9d8-1605-48d3-8a37-ad2af48040ec', 'bbeeb7fb-ed8d-43db-9a55-cb231b5d6f1b', 'c4d1fe2b-c711-494c-93d1-e0932962a61e', 1, 999.00, '2025-06-11 10:23:42'),
('58f23914-2251-4907-894d-835588487c5a', 'a2d5c73b-8298-4915-a9fb-5d0b2675c54e', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-05-26 10:05:24'),
('5aa7c273-d167-410a-9aee-027617d6ed4b', 'c0535628-88d0-434f-9f11-01ca242f639c', 'e03dc952-7f98-421d-924b-4f819abe666e', 7, 5.00, '2025-06-06 08:06:25'),
('5c259846-9f84-43f5-938b-d18a421d68c9', '76ffa68d-3d19-40fe-89b9-638ec4ddcefe', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-05-26 10:26:30'),
('5f23ed26-65d3-4272-bb23-3ce8fd11d0e9', 'd103fd6a-33e6-4194-a0c0-c36c50418fb0', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 10:37:35'),
('5f31fbb8-3f28-43f0-bc0d-71452178904d', '265cfdab-8094-4e5f-a794-37deb69fb0ee', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-21 11:50:49'),
('5f44e42d-b2db-4f9a-aa9e-5d0213dcc037', '949ebb34-8285-4f62-90d5-6381a40c5a8c', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-05-22 21:17:47'),
('5fdedbbf-211b-4be3-9a72-d3a04653501b', '961abb66-0966-489b-af03-11adc536e782', '187b21e6-639b-42b4-8199-28e1a2e49f9c', 1, 3.75, '2025-05-21 11:49:29'),
('5ff286b2-5f94-4328-9112-04cb4597a51f', 'b6ebaf8e-9edf-476b-937a-b62eb82bb505', 'b89be53e-f6b7-4005-9f32-9e890325c658', 1, 899.00, '2025-06-07 16:19:08'),
('623f4e95-67fe-433f-bdbb-cd09494d8df8', '7eac203f-c870-45ba-88b5-fd793be7c99d', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-05-26 09:59:49'),
('6305e3b2-24c6-43dd-8f91-940209470d0c', '9fecb2c9-99be-4911-b3bc-4ada6df83694', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-21 12:17:12'),
('63682857-a882-4767-9217-efb26f9229cd', '41851d0a-2999-45bb-85a3-91cdbdfc874a', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 04:05:52'),
('64ae70c1-5b9f-4260-9ddd-9771b2328152', '2688e9d0-bbd8-467f-8a1c-ab9cc4b30999', 'a5fd86a0-7b25-457b-9473-a33de24f4e13', 3, 3.75, '2025-06-09 11:35:50'),
('65bf7e7d-5c4c-4fb6-aa1b-565cfc95a372', 'c0b2f1df-647d-4120-ab8a-a7bdcea02d3e', '55f2568f-96cf-46a8-b156-a633be5b591c', 1, 1400.00, '2025-06-11 08:52:59'),
('65fc4c72-bac4-4728-bc76-01a26bc19198', '63e31c11-bd06-4df2-9721-3ffd7539c5a5', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 04:00:21'),
('67d7811a-9439-4e1b-beb7-e6f775147afc', '622d2c66-957f-4cea-b86a-a96e0317b689', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 05:15:15'),
('682efebf-0083-4cd3-9bc3-6ac0e60dbf83', '44d33faa-1afc-4fd0-99da-be5e1712ad78', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 05:13:00'),
('690da6a9-a129-4a9f-8b12-dd26e240c321', 'ffe373a2-b9a8-45e3-8757-8ec47f40f6ab', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-23 01:47:32'),
('6929a58c-1f5a-4efd-8a70-5cccf85f864d', 'ae3f93ad-d00e-40c0-a666-f33e7816ec7f', '592de762-38ed-4640-9e6c-c32fd5096790', 2, 3.25, '2025-05-21 11:52:23'),
('6bbdb51d-7380-4424-b0d5-3f2a36b1e2cb', '088dc28b-4dea-4871-9227-d6a908e0c0ea', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-20 12:44:57'),
('6bd22988-03bf-4724-863d-7f464b40a947', '5b594d33-dcdb-4b62-a71a-a08fb01500b7', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-24 11:25:31'),
('6c42b444-aed7-4bc5-a180-fabe2264cff1', 'f5d90868-a1ae-4a8a-82c9-8f9c7f387137', 'b89be53e-f6b7-4005-9f32-9e890325c658', 1, 899.00, '2025-06-09 12:54:47'),
('6c588eed-43e1-4c7e-9243-26a453e12032', 'baf01e81-1f9f-44a0-8147-a261fc111adb', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-05-21 12:13:03'),
('6c73bbd1-a707-46f1-8e0c-c34dd8b6a3f5', '3a5ab606-6417-4ac6-a97c-339eab8b6df2', '59c5aa8d-33e1-4e3c-ad80-e5735bde8140', 1, 6.50, '2025-05-21 05:10:12'),
('6d51a5fa-02f8-464a-b17a-8d5875db2080', 'd103fd6a-33e6-4194-a0c0-c36c50418fb0', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 10:37:35'),
('6eb5b117-1b7b-4fd8-b8be-c322ae70b76c', 'a189a025-b269-409b-87e7-c29f5f7e33c0', '5c08c1dc-5559-4470-8151-c026805899dd', 2, 1.25, '2025-06-09 11:55:30'),
('6f4ea1da-cc66-4ca6-bb2c-93a06952f3ba', 'dc596ff6-e0b6-49b8-a058-f0be03498df1', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 1, 1245.00, '2025-06-09 14:00:07'),
('6fbd8d36-2365-495e-a988-c0be35ca6474', '1e570dce-d230-41e3-9f17-747c7251c89d', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-21 05:20:52'),
('6fd14149-10db-47ec-86d7-9a1c59226695', '1efb8f3d-bfbc-45a6-878b-95df7d455f35', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-06-09 16:21:39'),
('6fe54b06-7095-42e6-82a4-8638c29a4b92', '14bebbc8-6960-4489-a4c9-0d40c73d1412', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-24 12:23:57'),
('704b7556-dcb8-4c71-9a13-1898f086760b', 'ef6bbe6f-28e4-4d06-b0dc-a9cebb0df973', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 10:22:13'),
('707ec1c7-84e6-464d-acc8-b341817eb5c0', 'a29c0234-bd43-4d00-91d8-04125f6cb522', 'a3ad9984-5f79-4300-96a5-d153b8a01665', 2, 1.99, '2025-05-22 17:55:01'),
('7127f1e5-e1b5-417c-88c7-c45cfbb05e2d', '26743683-aa1f-4fc7-8af4-cb467169ba5a', '5c08c1dc-5559-4470-8151-c026805899dd', 3, 1.25, '2025-06-09 12:20:14'),
('718207f3-fdc8-4261-b543-7c4fcbac3a01', '720d1457-e4e4-4f64-8d55-6649e861d1ac', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 1, 5.00, '2025-06-09 12:27:37'),
('724d4227-4114-4068-8270-17644c7e9af7', 'e501a905-567d-4a4a-a88a-885bed5aeda0', '5c08c1dc-5559-4470-8151-c026805899dd', 3, 1.25, '2025-06-08 08:27:10'),
('72a90c24-818f-454c-bfb5-79f39546c68d', '14bebbc8-6960-4489-a4c9-0d40c73d1412', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-24 12:23:57'),
('739471c1-1bc2-4ed1-b75c-8e8ee300ac38', '9578d64d-6c06-4af7-8fd7-98e0622af9ac', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 1, 5.00, '2025-06-03 10:05:33'),
('73eda19f-3e68-46f5-96b3-67f90220661d', 'f7dcbef4-1fec-4d10-860f-74aa554b29f3', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 10:00:23'),
('743fd552-60b1-4315-a45b-789a3e5e4c0c', 'e6defc7a-8d1a-4dc7-a815-23aaf893a4ab', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 19:33:41'),
('76442f77-e93e-49d3-ab19-64352c9d06b2', 'fe533d3a-4992-4a23-9111-b37af05e8426', 'd27c07d9-fa0c-49a7-9a29-454dde45bf7f', 1, 3.49, '2025-05-22 17:55:23'),
('78029c32-8c0c-4972-85f8-de1bb92e37c0', '8b1f3bac-8bb1-4322-8ba4-81032c52ba33', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-26 01:03:53'),
('7bb04f18-419b-4fc3-bee4-7f3eb8ac7dcc', 'ae3f93ad-d00e-40c0-a666-f33e7816ec7f', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 11:52:23'),
('7c0671f2-356e-44f4-aa15-072ffef3b96c', 'fe533d3a-4992-4a23-9111-b37af05e8426', 'a3ad9984-5f79-4300-96a5-d153b8a01665', 1, 1.99, '2025-05-22 17:55:23'),
('7c981f4a-bf10-43ac-9a7c-2bfbd4e83ee4', '76eb82fe-36cc-499d-88c3-e52ee5cced9d', '22dbdb82-8f0c-424a-9be3-1c1d57969aa1', 1, 4.80, '2025-05-22 21:51:12'),
('7d2c4cbc-d7c7-4035-80c6-d79475961563', '97f42afb-f5b9-4c7a-94b0-9b0f3660c258', '592de762-38ed-4640-9e6c-c32fd5096790', 1, 3.25, '2025-06-09 12:36:04'),
('7d780610-fe17-4b1c-8082-df93fc0fa6bf', 'd3c4dec0-0b07-4a7c-8c7d-182530b7e9dc', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-05-26 10:37:12'),
('7f30e673-b235-4ed1-9ac4-65a65f4309bc', '74868ac1-73a5-417a-97eb-53bb99420ddd', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-06-09 12:27:01'),
('7f5a454e-6479-49e6-96f8-f7e215277964', '98e52b69-796b-44fb-afa7-f7d419b45633', '377ecc2b-ba34-445b-bbd2-b0527b4718e6', 6, 10.00, '2025-06-11 10:59:21'),
('80bbf49d-a770-40c6-8c73-d7c3ca672161', '05d21891-a1e7-4e71-90fa-fca928e0fa09', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 04:20:49'),
('81a7d2ef-822c-4839-a12c-3831199c8be6', 'aff75fd0-4a08-42bb-baee-4b4974a10ca0', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-26 00:47:10'),
('81b890a8-14b3-4df1-834d-d939dcc56d0f', '5b594d33-dcdb-4b62-a71a-a08fb01500b7', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 1, 1.80, '2025-05-24 11:25:31'),
('8241807a-a496-4faa-aa5b-c889b26bfe0c', '0776f099-b90c-4d2f-9dab-d7577db468d6', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 4, 1.50, '2025-05-22 14:48:05'),
('82af6777-cb5e-40e4-86b1-bcfa084c736d', 'c9bb8168-dd72-4026-a10b-55f5ade425ac', '377ecc2b-ba34-445b-bbd2-b0527b4718e6', 20, 10.00, '2025-06-11 11:01:01'),
('858479a2-d7bf-4475-96c5-aadf16c3441e', 'db49dc92-a913-4b09-adde-b5adf6ea6787', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 2, 163.00, '2025-05-27 11:38:18'),
('85b01456-8cc9-4c5d-8292-3978d3ad38c9', 'b6ebaf8e-9edf-476b-937a-b62eb82bb505', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 1, 799.00, '2025-06-07 16:19:08'),
('88c309c5-a5fd-49d1-b5bd-a87076e9b96e', '3a5ab606-6417-4ac6-a97c-339eab8b6df2', '592de762-38ed-4640-9e6c-c32fd5096790', 1, 3.25, '2025-05-21 05:10:12'),
('8920cc5a-b63c-4cb9-a818-f485e2b83d40', '94f38e52-e9a3-42c7-9b5a-93d32363e583', '22dbdb82-8f0c-424a-9be3-1c1d57969aa1', 1, 4.80, '2025-05-22 23:54:11'),
('89666dde-42b1-4d62-834f-628e6b869036', '4ea4ed67-033f-47ae-b3eb-1c580456dc91', 'a5fd86a0-7b25-457b-9473-a33de24f4e13', 1, 3.75, '2025-06-06 08:41:46'),
('89d12e03-e75d-40dd-8bf9-148fcebe5497', '6f16c6d3-d352-4555-8441-589524e9fe27', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-22 19:27:23'),
('8a2d6752-a105-4bce-a81a-1ed4aa2779ec', '256e5c03-ca60-4703-b49d-d6caa4a7187a', '627d7c55-921a-4916-8bf9-98f1bbc4ad08', 1, 2.60, '2025-05-21 12:55:13'),
('8a77c148-603f-4adb-8613-49a9ceabb055', 'b6ebaf8e-9edf-476b-937a-b62eb82bb505', 'e03dc952-7f98-421d-924b-4f819abe666e', 5, 5.00, '2025-06-07 16:19:08'),
('8b6c7a59-967c-437a-acbf-419811b3c93d', '1273a32e-3197-42cb-87e9-d975866243c3', '56b60d92-35a1-4b1d-9be0-514779568b40', 1, 2.35, '2025-06-08 14:31:26'),
('8d178e2e-f7a7-4de5-aa8e-6023a4b1304a', '1a828a26-2c33-4036-97cf-edd016b4b5b9', 'a3ad9984-5f79-4300-96a5-d153b8a01665', 1, 1.99, '2025-05-22 17:59:36'),
('8e02cea2-1229-44d6-9577-676b2c6a3f9f', 'aff75fd0-4a08-42bb-baee-4b4974a10ca0', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-26 00:47:10'),
('8e61ace8-2199-401a-be56-6cfe1346fbfe', 'ae3f93ad-d00e-40c0-a666-f33e7816ec7f', '59c5aa8d-33e1-4e3c-ad80-e5735bde8140', 1, 6.50, '2025-05-21 11:52:23'),
('8e79a62e-1dbe-4994-bf4b-34bb18f65672', 'c8de6ea9-3a62-42a7-8c6b-7f17208da11e', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 10:08:28'),
('8f1276b3-aa4e-41f7-a0a5-217df3572a7b', 'fcb03cfa-806c-49e0-af76-160e81168101', '056250b8-90d2-41e8-b9c7-1a866658ee7f', 1, 749.00, '2025-06-04 03:25:22'),
('8f40d4cc-3b15-4010-93c5-483a6d39eed8', '6947bae0-c6eb-4e2c-b05e-fcc75cc3ec44', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 3, 2.49, '2025-06-09 15:39:25'),
('8ff4bdce-7cfe-465d-b7f1-cdc6c1253906', '14bebbc8-6960-4489-a4c9-0d40c73d1412', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 1, 1.80, '2025-05-24 12:23:57'),
('91d1f35f-c13b-4a52-a1b1-20fb0a35bb8d', 'f3f31f7d-ddcd-4921-9a44-4fd3dffd20ac', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-06-12 14:54:28'),
('933cf246-e53e-4623-ac54-01f4e3e926d0', '949ebb34-8285-4f62-90d5-6381a40c5a8c', '5c08c1dc-5559-4470-8151-c026805899dd', 1, 1.25, '2025-05-22 21:17:47'),
('96803c1b-66b1-4dd3-8bb2-1fc35938600d', '94f38e52-e9a3-42c7-9b5a-93d32363e583', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-22 23:54:11'),
('976f2277-00b7-4a12-8638-8274e5a71ac5', 'fb1207da-0027-4287-a488-3916982776a9', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-21 14:20:06'),
('97bb4a78-fa3c-47e8-aa4e-2fb824071463', 'c5c365d9-1830-49c6-a1f3-89dbf702c045', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-22 05:36:13'),
('98b9e423-6912-4a32-bf31-951fb6a14892', '3a5ab606-6417-4ac6-a97c-339eab8b6df2', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 05:10:12'),
('99152e8d-9a95-483c-8a85-e6337958b6b7', 'f5d90868-a1ae-4a8a-82c9-8f9c7f387137', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 1, 799.00, '2025-06-09 12:54:47'),
('9a01334a-4fb2-4c83-aa43-14f870495603', 'b4349a32-d394-494a-a0bb-e175dbb8dc56', '187b21e6-639b-42b4-8199-28e1a2e49f9c', 4, 3.75, '2025-06-06 08:48:41'),
('9a08c511-2778-45bc-94a2-0036bf04eda3', 'a29c0234-bd43-4d00-91d8-04125f6cb522', 'd27c07d9-fa0c-49a7-9a29-454dde45bf7f', 1, 3.49, '2025-05-22 17:55:01'),
('9af138e9-f635-4d43-b796-22f73ae6fb43', '6947bae0-c6eb-4e2c-b05e-fcc75cc3ec44', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 2, 1.80, '2025-06-09 15:39:25'),
('9b53a370-42de-42a3-9e2c-ea4ba03cea71', '40247b67-995d-416f-b86b-279e5c6445f4', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 03:56:31'),
('9c2d42a6-ce6b-4a36-bc4a-774830d80447', 'f83ce334-7f3d-4ba9-86a4-a915695e8714', 'b89be53e-f6b7-4005-9f32-9e890325c658', 1, 899.00, '2025-06-09 12:57:18'),
('9cbd7bfd-1112-4e8e-8313-5bb4f958404e', '3ed848c0-905e-4423-9830-1cdb609e350a', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-06-09 15:50:29'),
('9e3abe0e-b2bf-4d16-85a9-3a89f7474c59', 'b4349a32-d394-494a-a0bb-e175dbb8dc56', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 3, 1.80, '2025-06-06 08:48:41'),
('9e69d257-adfc-42aa-bfda-5237f642b0e1', 'de34f1ec-4a2f-4b06-a7c8-dd7d00007f8a', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-05-26 09:58:00'),
('9eca50e6-96bb-4457-abca-0bead3f964c3', '14bebbc8-6960-4489-a4c9-0d40c73d1412', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 12:23:57'),
('9f9374f7-94b9-45a4-9863-21c2d59fac66', 'e2c93d4b-4bef-401c-9273-5f942e478218', 'a3ad9984-5f79-4300-96a5-d153b8a01665', 1, 1.99, '2025-05-22 17:59:01'),
('9ffc6a2b-c9db-4637-bf6f-7df798f14550', '8e13fb01-bd1e-4a8e-b031-facda22033f2', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-05-22 10:54:51'),
('a07576a5-f5ed-49fb-8821-1d7c0342f7b8', '9bb9cdd4-fcd7-4cb5-b722-092d02701ef2', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-21 12:50:46'),
('a14116b2-20d6-4f31-b861-a24f07ec25f1', 'e9208b05-33ce-4cd9-9197-f167d869e8d4', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 1, 1.80, '2025-05-24 19:26:40'),
('a1d444fb-399b-407e-9a40-3b7b76fdd02a', '67585ef1-874b-4411-9533-93a1d7c01412', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-22 18:34:22'),
('a27bf0c9-65d2-4ffe-8628-71d4ed920c04', '13e744e6-0d28-4b34-860c-3f4a810b4b4a', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 2, 1245.00, '2025-06-09 12:21:15'),
('a2b49d4e-9d06-416d-a3b4-9480d9957249', 'd9b447a0-dc08-4a60-9653-f92be02668e9', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-22 17:13:39'),
('a38a594d-c773-431a-852c-21bc2902a407', '40d3b2fa-6e33-4286-bb9a-b2440ae40a3b', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-06-09 15:13:38'),
('a3db487b-385e-4183-ac64-594e479553ad', 'f43996f0-c7ef-4e18-885e-f805a527a515', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-21 13:05:17'),
('a48d41a5-420d-4a56-8f29-ea9c7a2abf7b', '1273a32e-3197-42cb-87e9-d975866243c3', 'b89be53e-f6b7-4005-9f32-9e890325c658', 2, 899.00, '2025-06-08 14:31:26'),
('a4c52b00-2c34-4b31-a0da-2899ff84f0e7', '2aaa8f65-c421-46aa-b5bb-004ea5861d5c', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 1, 1.50, '2025-05-22 16:59:38'),
('a56a88aa-be99-4899-be11-eaf35210c8dd', '94f38e52-e9a3-42c7-9b5a-93d32363e583', 'c0edd880-aa11-4d74-8b77-845d8798da90', 1, 2.99, '2025-05-22 23:54:11'),
('a5ca5c12-e9a6-4a10-998d-da2ea284ca21', 'b6ebaf8e-9edf-476b-937a-b62eb82bb505', 'db11baa7-4d6c-4b88-b8e5-45cf40a1a8d8', 5, 1.00, '2025-06-07 16:19:08'),
('a692e805-4011-4ffe-a57a-5710c91b8fd3', 'e3f33851-3653-4121-a71e-af45a9f3f2ca', 'c4d1fe2b-c711-494c-93d1-e0932962a61e', 1, 999.00, '2025-06-04 07:31:14'),
('a696d3e9-ae19-4980-be42-375f15076069', '3e52bc21-34c6-49e4-b15e-af23f4f63e31', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-21 09:26:27'),
('a7d51d38-5228-4608-a3f0-ec5640740f4c', 'd566c786-767c-434e-8e60-7a0e26cd4923', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-21 12:18:27'),
('a86235f2-2851-4c6c-bf0a-ef9ccd348174', '0f1b6715-262a-4c40-9134-86c6016f589f', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 04:11:25'),
('aa8ac20f-aad8-4d47-8589-0763871edc14', '6ae9312a-febc-4109-bfab-62466b0f5787', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 1, 1.80, '2025-05-25 23:37:20'),
('aaadaef9-e57f-4915-aaaa-38c7f9aa6a70', 'e84a2ed6-cd12-401c-96b4-d219451f8fb0', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-22 05:39:06'),
('ab41339d-a1c2-4aa7-a655-a738811509b9', 'f7cd9e5b-bd9e-4e35-818c-3a95196a7733', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-06-04 07:52:47'),
('ab5a7bf4-4b93-45c2-adf8-232651a18d6f', 'baf01e81-1f9f-44a0-8147-a261fc111adb', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-21 12:13:03'),
('ab62c1d5-8313-48cf-9924-52d3c1e2ceaf', 'b4349a32-d394-494a-a0bb-e175dbb8dc56', '22dbdb82-8f0c-424a-9be3-1c1d57969aa1', 4, 4.80, '2025-06-06 08:48:41'),
('ab7e9a92-1fbd-46b8-8610-dd466c7981b5', '921dd3ec-0dd8-40f3-ba96-42bbb8e3688d', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 12:23:24'),
('abc70d6e-d7b3-494e-80f6-8b8dfb44bfd5', '6e28e524-7656-4dc8-9cad-180260f7069f', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 1, 1.50, '2025-05-22 21:16:40'),
('abd582c7-717c-4173-bf8e-74eeca478015', '3753f5a9-56d3-4017-9e08-7abaff056b11', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 1, 1245.00, '2025-06-09 14:18:03'),
('ace153ad-c2c4-4eec-8d85-eb593c6c5500', '0436db07-7abb-41e8-a9a0-a4e7028eb992', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 10:45:54'),
('adc34d6b-caf0-4773-814f-90ae98babf02', '6a3102ee-87de-4db1-b466-0a3931d99f3a', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 10:22:05'),
('ae2390b3-eb61-4c12-9876-42b9f4bb28f0', '33da33e3-6f97-42a6-aa13-0232c5c84887', '9c6458f3-20de-4d18-861c-38a24b68b309', 1, 1.50, '2025-05-22 17:57:47'),
('af29f65e-3eb3-430b-b3ee-430197d0418c', 'c07fd97a-1f98-43dd-9a3c-eb0139cc1a8b', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 05:23:54'),
('b0c57496-fa21-440e-9409-55d40a07923f', 'f584c877-2d87-4d1c-9df2-1b2e5027a239', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 3, 1245.00, '2025-06-09 12:29:37'),
('b144cb85-1755-4fd5-bd96-3c25ab394451', 'c48ad082-1560-427f-a4cb-a16f501bdd50', 'db11baa7-4d6c-4b88-b8e5-45cf40a1a8d8', 9, 1.00, '2025-06-04 07:55:24'),
('b18cbf9e-e1d5-459a-8b3c-65a9dfd4ed33', '52832c24-bb8e-4c62-8318-911b8b88e984', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-06-05 07:40:49'),
('b253c1bf-1502-45e3-aa78-420089254874', '9578d64d-6c06-4af7-8fd7-98e0622af9ac', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', 1, 1475.00, '2025-06-03 10:05:33'),
('b2d41ace-10ae-4ed3-8596-2ba7185c732e', '042a8e24-ce18-443d-b44a-ab514bf601f0', 'b89be53e-f6b7-4005-9f32-9e890325c658', 11, 899.00, '2025-05-26 12:30:35'),
('b348a688-e8a6-42a1-b0af-eecd3b4f5d6f', '8508b5e9-20a9-4a7a-8cb2-d74006e31191', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 2, 2.99, '2025-05-22 17:51:44'),
('b35626d2-dcdc-4c64-a9d4-3c9e9549f62d', '614ed020-a515-4c08-ba19-8c556009c11d', '187b21e6-639b-42b4-8199-28e1a2e49f9c', 4, 3.75, '2025-05-21 12:21:41'),
('b4b9ace8-7ad0-48a8-8173-450db4241aaf', 'e501a905-567d-4a4a-a88a-885bed5aeda0', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-06-08 08:27:10'),
('b4cb27e0-8337-4aab-ba71-cddb4371b7a5', '55692572-d1f0-4d6d-8026-8af1853b66b2', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 11:24:36'),
('b4f32888-a733-4662-800e-3210266039ac', '53fd7515-667b-4657-a2a5-000d8ea3918d', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 1, 1.50, '2025-05-22 16:24:17'),
('b674fa92-3efb-4731-ae07-c4d012858f2e', '8508b5e9-20a9-4a7a-8cb2-d74006e31191', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-22 17:51:44'),
('b706c3a1-965a-4446-8305-2de8e63546bd', 'baf01e81-1f9f-44a0-8147-a261fc111adb', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 12:13:03'),
('bacb13c6-5f67-4da2-be4e-35adbd3ba8b5', '0e96f059-6720-463e-be95-87215e20b18c', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 12:02:13'),
('bb0fa995-094c-452b-8b86-12dcb94970a2', '94f38e52-e9a3-42c7-9b5a-93d32363e583', 'ed2f4421-fca0-4827-b7c3-d814f46252c6', 1, 4.50, '2025-05-22 23:54:11'),
('bdbc0a61-81c0-4c74-be6f-e9decea4ef63', '2749c3f0-bf90-46b2-bcc1-fbef2a9dde1f', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', 3, 1245.00, '2025-06-09 13:56:30'),
('bdc96207-4381-47ad-ab34-48cd8050e5bc', '088dc28b-4dea-4871-9227-d6a908e0c0ea', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-20 12:44:57'),
('be295c37-a316-4907-84ba-b9a380dcf609', 'b93fce95-9fe7-4e53-a879-5f64d26be589', 'b89be53e-f6b7-4005-9f32-9e890325c658', 1, 899.00, '2025-06-09 13:39:43'),
('bec107ac-110d-45eb-b4e7-d82861850fdb', '7f8cfd5b-8870-4df1-9f1b-453bf9cb638f', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 10:01:09'),
('c003608b-e19f-4358-b4b7-f54a77b5f460', '0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 12:12:00'),
('c0952106-4c51-42e7-89e3-b66d50d340d1', '94f38e52-e9a3-42c7-9b5a-93d32363e583', '592de762-38ed-4640-9e6c-c32fd5096790', 1, 3.25, '2025-05-22 23:54:11'),
('c2ae45bd-b07a-4a29-9d4b-822b8b4e1bc7', 'c0535628-88d0-434f-9f11-01ca242f639c', '592de762-38ed-4640-9e6c-c32fd5096790', 4, 3.25, '2025-06-06 08:06:25'),
('c3f46efb-2a53-4134-8ebd-7c4c2d624a2d', '974f9a3c-f478-499f-a39b-fc6a539b8812', 'af783643-559f-4a32-848e-03da9524e85c', 1, 2.95, '2025-05-22 20:19:45'),
('c4577664-4556-4ce3-b56c-fee604414de8', 'fb1207da-0027-4287-a488-3916982776a9', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 14:20:06'),
('c4b60a03-4aa5-4632-94e0-e482de1670ef', '49d186f0-6f05-4b1e-a061-20410ffa0ff3', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 11:25:06'),
('c61af09e-a1c4-47dd-b564-2e67fbad4e43', 'c0535628-88d0-434f-9f11-01ca242f639c', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 3, 2.99, '2025-06-06 08:06:25'),
('c801143a-a28e-4581-b713-68f8150c60b6', '01bc04ac-c63f-484f-8488-4c4ab978e2af', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', 1, 1475.00, '2025-06-08 09:31:59'),
('c8718c9f-7d13-4092-bd0c-2e0a2bd07bdb', '3a5a927d-42b1-4cbd-9657-f16934e939e0', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 1, 1.50, '2025-05-25 23:34:09'),
('c9c5e43d-ceac-425e-9134-e3193cc921e7', 'f584c877-2d87-4d1c-9df2-1b2e5027a239', 'e03dc952-7f98-421d-924b-4f819abe666e', 3, 5.00, '2025-06-09 12:29:37'),
('c9f09ee3-072e-4bb8-b847-b3fd190d39cf', 'e826dc43-8a2c-440d-90dd-d65dcc1f595c', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-05-26 10:38:50'),
('cbeb1939-180b-4813-8ee4-39c8caaf87d8', '720d1457-e4e4-4f64-8d55-6649e861d1ac', 'b89be53e-f6b7-4005-9f32-9e890325c658', 1, 899.00, '2025-06-09 12:27:37'),
('cc568610-38c1-4ee1-9b7d-4278123f0ef2', '75dbad64-c638-4c48-b33d-956bb29dc284', '5c08c1dc-5559-4470-8151-c026805899dd', 1, 1.25, '2025-05-24 21:40:27'),
('ccb3d167-e758-4e8a-87bd-5ad842cc5844', 'f584c877-2d87-4d1c-9df2-1b2e5027a239', '592de762-38ed-4640-9e6c-c32fd5096790', 2, 3.25, '2025-06-09 12:29:37'),
('ccb7206f-182f-4512-86a5-07cbcfcec187', '1ea38ea3-ba24-4cbe-879a-3ea133b74a5a', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', 1, 1475.00, '2025-06-13 13:42:32'),
('ccd39d7f-611a-42b4-9f14-3cc9489843ba', '3a7c028e-35e1-4a8f-aa8f-426f9388fe23', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 2, 799.00, '2025-06-05 22:05:09'),
('ce935e3f-1612-4421-9aa6-c9584fe2aea0', '40247b67-995d-416f-b86b-279e5c6445f4', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 03:56:32'),
('cf0608eb-1153-493a-a4c8-33f56b32fc03', '89abe8fd-7d71-4e40-a275-9f60164215ea', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-22 05:37:45'),
('d198218c-ed23-411a-adeb-2b78132dbe46', '0e96f059-6720-463e-be95-87215e20b18c', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-21 12:02:13'),
('d20e27f6-db7a-45a3-bb28-2156ed8a5318', '0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-05-21 12:12:00'),
('d22f68e3-8e5e-4beb-b731-7be3936c1af4', '256e5c03-ca60-4703-b49d-d6caa4a7187a', '9c6458f3-20de-4d18-861c-38a24b68b309', 1, 1.50, '2025-05-21 12:55:13'),
('d295920c-3b5a-418b-a7fb-15f346b2c914', '14a89bc3-18de-4fae-9cf8-50a8d62418c1', 'b82e1887-40f9-4475-b277-ef45e093bf56', 10, 7.80, '2025-06-11 11:11:28'),
('d2bbefef-4f8d-49f9-8633-9f1ea72ac19c', '0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-21 12:12:00'),
('d471d58e-6a5c-4af5-9a33-e3ed19c3dc63', 'e89b7185-49d7-40ec-a320-fa8fdd65211c', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 04:24:37'),
('d66c80d9-e323-4a61-8757-b32f874cbc87', '79a526a2-29e8-4e6c-8deb-6e9508f570e0', 'a0cff669-2621-4b55-aaac-88e81474710a', 6, 10.00, '2025-06-06 08:04:43'),
('d6cbbe81-e991-47cc-81b0-c6dd3d85c1a2', '26743683-aa1f-4fc7-8af4-cb467169ba5a', '59c5aa8d-33e1-4e3c-ad80-e5735bde8140', 2, 6.50, '2025-06-09 12:20:14'),
('d9b298fe-a9f2-40a3-8165-71dd55fb5685', '6ae9312a-febc-4109-bfab-62466b0f5787', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 1, 1.50, '2025-05-25 23:37:20'),
('dad39297-baed-4419-9ab1-c3799f2e3c96', '8e13fb01-bd1e-4a8e-b031-facda22033f2', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-22 10:54:51'),
('dae8cd40-3ed9-49d5-9ee9-377376fb514a', '8c1365fd-9852-4e35-b426-8f710b3a9f92', 'b89be53e-f6b7-4005-9f32-9e890325c658', 1, 899.00, '2025-06-09 12:59:36'),
('dc36362c-7619-45f0-a297-d404a1c73759', '44d33faa-1afc-4fd0-99da-be5e1712ad78', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 05:13:00'),
('dcedc2bd-7d5c-4e6b-a190-c00b4d63e3d9', '9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 12:05:29'),
('dd00cb50-a7a5-4bb8-9f8a-a602c373c495', '0e76b9be-ccdf-4fcb-a07b-ede08fe01d5c', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-21 12:12:00'),
('dde709d8-5c9d-4518-948e-9e82764f2c38', 'e89b7185-49d7-40ec-a320-fa8fdd65211c', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 04:24:37'),
('df2ddd8c-59ee-4c8f-a13c-bd46aea100a7', '13e744e6-0d28-4b34-860c-3f4a810b4b4a', 'a0cff669-2621-4b55-aaac-88e81474710a', 1, 10.00, '2025-06-09 12:21:15'),
('df7bd6dc-ef85-4d9a-9aeb-7f0abdd44e62', '19dfbe4a-6993-48ab-9368-1c7e93fcd860', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 1, 799.00, '2025-06-09 16:32:53'),
('df975ff8-1cda-4884-ae2c-751141317d08', '8c1365fd-9852-4e35-b426-8f710b3a9f92', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-06-09 12:59:36'),
('e006b3dd-e1ee-4af0-a524-ad254229f6ee', '961abb66-0966-489b-af03-11adc536e782', '0a3a5617-942e-46bf-abed-c34a74a8a6d7', 1, 2.25, '2025-05-21 11:49:29'),
('e2d82c48-4329-43a0-acb2-3033150146c5', '0f8628fa-e7e3-45cb-9738-c1b9c6ff760c', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 04:01:36'),
('e2d83886-6aa9-4824-9981-7cc1b27454e1', '0ed2e936-4f66-4c74-ae2a-e9314cfa8394', '377ecc2b-ba34-445b-bbd2-b0527b4718e6', 1, 10.00, '2025-06-13 12:18:21'),
('e562b8e4-85b5-49a7-ad20-2923b1df11bf', '49d186f0-6f05-4b1e-a061-20410ffa0ff3', '5c08c1dc-5559-4470-8151-c026805899dd', 1, 1.25, '2025-05-24 11:25:06'),
('e5903d66-1fcb-4125-bc06-d6f9c57f6542', 'ebf0fe7b-9f1f-4eaf-a6d7-04c96cf0fe12', 'b82e1887-40f9-4475-b277-ef45e093bf56', 1, 7.80, '2025-06-03 10:04:35'),
('e63d4ff7-1e5e-4a56-9355-b84c359b7db0', '01bc04ac-c63f-484f-8488-4c4ab978e2af', 'b89be53e-f6b7-4005-9f32-9e890325c658', 1, 899.00, '2025-06-08 09:31:59'),
('e7fd1696-d2bc-4c4b-8edb-c3e832a41478', 'aea258b8-991b-48d7-bd77-ffaa5c00472a', 'a3ad9984-5f79-4300-96a5-d153b8a01665', 1, 1.99, '2025-06-09 14:27:58'),
('e8a04663-b6c8-4f9c-92aa-3a4785bf6e77', '67585ef1-874b-4411-9533-93a1d7c01412', 'a3ad9984-5f79-4300-96a5-d153b8a01665', 1, 1.99, '2025-05-22 18:34:22'),
('e913d154-b998-4bbf-9426-0c75d5d1e775', '8b478c8a-3150-45a6-a01b-d37bbeae6ff2', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 1, 5.00, '2025-06-09 14:25:01'),
('e9b37583-29cf-4fe7-9f59-4f8e5e35ec71', 'a29c0234-bd43-4d00-91d8-04125f6cb522', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-22 17:55:01'),
('ea287346-79ec-4935-bf5e-a5c7baf5018b', 'dff4d19d-015e-4077-8d6a-e9e59bb56822', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 1, 5.00, '2025-06-09 13:24:58'),
('ea2bc0e9-735f-4ac3-b88c-5f47e7bbd82f', 'ae3f93ad-d00e-40c0-a666-f33e7816ec7f', '22dbdb82-8f0c-424a-9be3-1c1d57969aa1', 1, 4.80, '2025-05-21 11:52:23'),
('eb728633-ad3d-4265-8255-bed94066871f', '5e4c58a6-9dd0-4f10-9f31-f2715ec62503', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-24 11:23:05'),
('ebc56257-09b4-43c7-9fbd-6328f93a4df7', '74868ac1-73a5-417a-97eb-53bb99420ddd', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', 2, 5.00, '2025-06-09 12:27:01'),
('ec30d595-21f5-478e-8613-6ad98591db76', 'b4349a32-d394-494a-a0bb-e175dbb8dc56', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 4, 1.50, '2025-06-06 08:48:41'),
('ed250976-7a1c-44b4-8e1e-460d53d86895', 'aff75fd0-4a08-42bb-baee-4b4974a10ca0', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-26 00:47:10'),
('edc97dc9-7661-4059-92d5-5af7faa10998', 'a29c0234-bd43-4d00-91d8-04125f6cb522', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-22 17:55:01'),
('ede7335c-84fe-439d-8954-f57d3a290579', '8e13fb01-bd1e-4a8e-b031-facda22033f2', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-22 10:54:51'),
('ee3c1ee5-8839-47aa-804c-ac2e30393534', 'f5d90868-a1ae-4a8a-82c9-8f9c7f387137', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-06-09 12:54:47'),
('f1856971-bcaa-4cb1-b2ce-a4c9989140bc', 'a29c0234-bd43-4d00-91d8-04125f6cb522', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-22 17:55:01'),
('f197c1c9-aa21-442e-a333-e31cc35d98be', '265cfdab-8094-4e5f-a794-37deb69fb0ee', '00233c5c-f8b0-41da-8583-64d1746e635f', 1, 3.10, '2025-05-21 11:50:49');
INSERT INTO `sale_items` (`id`, `sale_id`, `product_id`, `quantity`, `price`, `created_at`) VALUES
('f26a91c3-3d97-4b3a-b181-24b15b5fa79f', '8e13fb01-bd1e-4a8e-b031-facda22033f2', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', 1, 2.99, '2025-05-22 10:54:51'),
('f350beca-c02c-49df-90df-578553f414d7', '3a5a927d-42b1-4cbd-9657-f16934e939e0', '000330c9-15a0-40f8-afb2-33c33b222bb7', 2, 9.99, '2025-05-25 23:34:09'),
('f35e8df0-3ef7-48af-bfdf-ac4c572e0340', 'e501a905-567d-4a4a-a88a-885bed5aeda0', '627d7c55-921a-4916-8bf9-98f1bbc4ad08', 3, 15.00, '2025-06-08 08:27:10'),
('f4115fc5-8202-4008-b3a6-ad513505822e', '97f42afb-f5b9-4c7a-94b0-9b0f3660c258', 'e03dc952-7f98-421d-924b-4f819abe666e', 1, 5.00, '2025-06-09 12:36:04'),
('f49234c2-fa29-4452-8f6b-ed016c544db3', '5c80048c-decf-4d63-b6d3-fdc52eeef9c1', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', 1, 1.50, '2025-05-25 23:40:29'),
('f4fa3fd6-af41-480e-911f-41def61dd6cf', 'd566c786-767c-434e-8e60-7a0e26cd4923', '14ff74f8-d700-4b7f-b118-2fb789011860', 1, 2.85, '2025-05-21 12:18:27'),
('f5098fd3-196c-4552-80ed-159b84328557', '1eb68c1a-558a-44ab-890a-875ce3e64b75', '55f2568f-96cf-46a8-b156-a633be5b591c', 1, 1400.00, '2025-06-05 22:19:07'),
('f52f58fd-3ed3-4e1c-b5d0-4c3a6358e608', '63e31c11-bd06-4df2-9721-3ffd7539c5a5', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 04:00:22'),
('f5984a15-697a-499f-a507-9ad6a6577c4f', '921dd3ec-0dd8-40f3-ba96-42bbb8e3688d', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-24 12:23:24'),
('f5a532ab-66d0-42a5-b92c-7fd87f1bd282', '485b3716-b29e-41cc-b539-f52c0af8f69d', '000330c9-15a0-40f8-afb2-33c33b222bb7', 1, 9.99, '2025-05-22 21:18:08'),
('f5b47f41-e8ba-4f24-b10a-18c1e5c9b91a', '5c15b8bd-f29c-433c-9003-c54bacfa7ec4', '000330c9-15a0-40f8-afb2-33c33b222bb7', 2, 9.99, '2025-05-23 02:04:42'),
('f69f7650-1fb9-4425-aae6-03343b79f827', '921dd3ec-0dd8-40f3-ba96-42bbb8e3688d', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 1, 1.80, '2025-05-24 12:23:24'),
('f77b3a12-ea94-44f8-8590-b006642596fb', '27a4a063-e969-499b-9eaf-dbb09d02d173', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', 1, 163.00, '2025-06-04 07:17:44'),
('f7c5a40e-e01e-4596-b2ab-b97b899d6283', 'bba0eff6-fb3d-43e3-941a-9b6c2f375617', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 09:25:13'),
('f841250f-fb18-41f7-becd-fc0445b62cff', '22337686-b156-430a-91fe-f4e26a7fba00', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', 1, 5.25, '2025-06-09 11:20:19'),
('f8ab1c5c-63a5-4963-a6b8-7f7aa775b770', 'b6ebaf8e-9edf-476b-937a-b62eb82bb505', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 7, 3.85, '2025-06-07 16:19:08'),
('fa53417f-adbf-4179-8aff-c9fc4b8f5bc1', '720d1457-e4e4-4f64-8d55-6649e861d1ac', '056250b8-90d2-41e8-b9c7-1a866658ee7f', 1, 749.00, '2025-06-09 12:27:37'),
('fb6ce781-2823-4294-aa7d-9bb6dd8b4438', '55692572-d1f0-4d6d-8026-8af1853b66b2', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', 1, 1.80, '2025-05-24 11:24:36'),
('fc54e55d-47b8-4707-89d4-d15cd0977537', '14bebbc8-6960-4489-a4c9-0d40c73d1412', '5c08c1dc-5559-4470-8151-c026805899dd', 1, 1.25, '2025-05-24 12:23:57'),
('fce623d7-62ae-48b6-93ce-608067f6d243', '05d21891-a1e7-4e71-90fa-fca928e0fa09', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 04:20:49'),
('fd4c8a48-9836-4a60-9b8c-d7868335cdf6', '0f8628fa-e7e3-45cb-9738-c1b9c6ff760c', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 04:01:36'),
('fd4f0360-885c-4f47-a88f-3f0a2d4b07ca', '41851d0a-2999-45bb-85a3-91cdbdfc874a', '0e9cf56e-14fe-410c-854a-928fd69e054f', 1, 4.10, '2025-05-21 04:05:52'),
('fd9c46b2-7450-44c0-91bf-61cd95ef8dce', 'ada4c8cb-3fb3-42e2-a7f3-3f751d44b977', 'b193d1a1-94f6-405a-b13f-15a1d594f403', 1, 3.85, '2025-05-26 01:18:48'),
('ff00caf4-cdd2-4c8c-b7a6-417b05097737', '654e3a9a-8183-465b-86d7-d4986d10d4d9', 'a3ad9984-5f79-4300-96a5-d153b8a01665', 1, 1.99, '2025-05-22 18:34:11'),
('ffcf74f5-af7d-4f43-a31f-d239be155b95', '9ecc54fc-6e3f-4d35-aaa1-698d573b2f8c', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', 1, 2.49, '2025-05-21 12:05:29'),
('fffc8f6a-92d9-4f60-8e70-f98423c49058', 'b8b73bcb-4f97-42d6-a78e-e61ea99cc4c7', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', 1, 799.00, '2025-06-09 13:46:06');

-- --------------------------------------------------------

--
-- Table structure for table `stock_adjustments`
--

CREATE TABLE `stock_adjustments` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `variant_id` varchar(36) DEFAULT NULL COMMENT 'For future product variant support',
  `user_id` varchar(36) NOT NULL COMMENT 'User performing the adjustment',
  `adjustment_type` enum('INCREMENT','DECREMENT') NOT NULL,
  `reason_code` varchar(50) NOT NULL COMMENT 'e.g., DAMAGED, CORRECTION, INITIAL_STOCK, RECEIVED_STOCK, PROMOTION_ADJ, THEFT, SPOILAGE, RETURN_TO_VENDOR, OTHER',
  `quantity_adjusted` int UNSIGNED NOT NULL COMMENT 'Absolute value of quantity changed',
  `stock_before_adjustment` int NOT NULL,
  `stock_after_adjustment` int NOT NULL,
  `notes` text,
  `adjustment_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `stock_adjustments`
--

INSERT INTO `stock_adjustments` (`id`, `tenant_id`, `store_id`, `product_id`, `variant_id`, `user_id`, `adjustment_type`, `reason_code`, `quantity_adjusted`, `stock_before_adjustment`, `stock_after_adjustment`, `notes`, `adjustment_date`, `created_at`, `updated_at`) VALUES
('004fb506-05fd-4fd9-a4e5-f6a62bc06434', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'e03dc952-7f98-421d-924b-4f819abe666e', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 5, 493, 488, NULL, '2025-06-07 16:19:09', '2025-06-07 16:19:09', '2025-06-07 16:19:09'),
('00831887-7ff7-47bb-99b5-888d407faedb', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 635, 632, NULL, '2025-06-09 12:36:20', '2025-06-09 12:36:20', '2025-06-09 12:36:20'),
('02b9e554-0ced-424c-aee4-5dbad6f944c6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 95, 94, NULL, '2025-06-09 15:13:39', '2025-06-09 15:13:39', '2025-06-09 15:13:39'),
('06fa2167-fde2-46b5-9852-eb5aedd01fe8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '55f2568f-96cf-46a8-b156-a633be5b591c', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 8, 7, NULL, '2025-06-11 08:53:02', '2025-06-11 08:53:02', '2025-06-11 08:53:02'),
('079209c5-a895-470b-bd57-d5a1d830d900', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 147, 146, NULL, '2025-06-08 09:32:00', '2025-06-08 09:32:00', '2025-06-08 09:32:00'),
('08b56829-a59d-4a12-8c44-717f983732db', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '592de762-38ed-4640-9e6c-c32fd5096790', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 39, 38, NULL, '2025-06-09 12:36:05', '2025-06-09 12:36:05', '2025-06-09 12:36:05'),
('0981c518-0a0e-49bd-b591-3dad01029ab7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'db11baa7-4d6c-4b88-b8e5-45cf40a1a8d8', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 9, 10, 1, NULL, '2025-06-04 07:55:24', '2025-06-04 07:55:24', '2025-06-04 07:55:24'),
('0f6a8d0e-f09a-4810-873a-c0a901f4d04f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 40, 39, NULL, '2025-06-03 10:05:34', '2025-06-03 10:05:34', '2025-06-03 10:05:34'),
('127f04a4-1d1c-4c59-b44e-5da65d0f766f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59c5aa8d-33e1-4e3c-ad80-e5735bde8140', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 6, 65, 59, NULL, '2025-06-09 12:12:58', '2025-06-09 12:12:58', '2025-06-09 12:12:58'),
('169a60dc-f752-45c6-8472-1ae9c6c780dc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 4, 200, 196, NULL, '2025-06-06 08:48:42', '2025-06-06 08:48:42', '2025-06-06 08:48:42'),
('1c075605-851f-4d90-9c82-0c9995ec1d5b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 29, 27, NULL, '2025-05-27 11:38:19', '2025-05-27 11:38:19', '2025-05-27 11:38:19'),
('1d548b7d-5538-4774-9b0b-04b291249811', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '056250b8-90d2-41e8-b9c7-1a866658ee7f', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 6, 5, NULL, '2025-06-04 02:52:57', '2025-06-04 02:52:57', '2025-06-04 02:52:57'),
('1dc7cb19-263c-46af-ba8a-94d51e078fb1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a5fd86a0-7b25-457b-9473-a33de24f4e13', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 30, 29, NULL, '2025-06-06 08:41:46', '2025-06-06 08:41:46', '2025-06-06 08:41:46'),
('1e1656e1-5755-4c0e-b29a-fa78baedec82', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 34, 33, NULL, '2025-06-09 14:25:02', '2025-06-09 14:25:02', '2025-06-09 14:25:02'),
('25c47b2e-9c31-41e2-bf9f-9a05dfb66f8c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 26, 25, NULL, '2025-06-04 01:55:39', '2025-06-04 01:55:39', '2025-06-04 01:55:39'),
('2776e009-8b47-4014-aeb8-f5a8fd26057c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 642, 640, NULL, '2025-06-09 12:20:55', '2025-06-09 12:20:55', '2025-06-09 12:20:55'),
('2a0d8b18-08b9-4f4c-9b69-fc680e07b09b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '55f2568f-96cf-46a8-b156-a633be5b591c', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 10, 9, NULL, '2025-06-04 07:25:33', '2025-06-04 07:25:33', '2025-06-04 07:25:33'),
('2bfdcf0e-a0ea-4d7e-9dc2-bbaaf98a7522', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b89be53e-f6b7-4005-9f32-9e890325c658', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 11, 10, -1, NULL, '2025-05-26 12:30:36', '2025-05-26 12:30:36', '2025-05-26 12:30:36'),
('2d1df82a-280a-4051-87c2-195798d672f8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 146, 145, NULL, '2025-06-09 12:28:30', '2025-06-09 12:28:30', '2025-06-09 12:28:30'),
('2d6e0f12-b4db-4a3f-a8cd-d94eee6bd9fd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 44, 43, NULL, '2025-06-04 01:14:45', '2025-06-04 01:14:45', '2025-06-04 01:14:45'),
('2e497a2c-e325-4bb2-b0d3-ccb09e6bb33e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 30, 29, NULL, '2025-05-26 10:37:12', '2025-05-26 10:37:12', '2025-05-26 10:37:12'),
('2f511a55-8739-4db0-a560-73165510e571', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 142, 141, NULL, '2025-06-09 16:07:20', '2025-06-09 16:07:20', '2025-06-09 16:07:20'),
('2fb39317-a8a1-47a3-887e-efcc1ece035c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '056250b8-90d2-41e8-b9c7-1a866658ee7f', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 7, 6, NULL, '2025-06-04 02:38:57', '2025-06-04 02:38:57', '2025-06-04 02:38:57'),
('32c80062-f050-4118-8004-0e9adaef6a30', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'e03dc952-7f98-421d-924b-4f819abe666e', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 12, 484, 472, NULL, '2025-06-09 13:33:57', '2025-06-09 13:33:57', '2025-06-09 13:33:57'),
('339d4ca2-56c0-44ff-be25-5ed2e4b7fb39', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 24, 23, NULL, '2025-06-04 07:44:54', '2025-06-04 07:44:54', '2025-06-04 07:44:54'),
('36138b76-ab62-41d1-9c4e-dfef9fd996ec', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 25, 24, NULL, '2025-06-04 07:17:44', '2025-06-04 07:17:44', '2025-06-04 07:17:44'),
('3925de88-5b19-4746-a45a-f1ad76d10a60', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b193d1a1-94f6-405a-b13f-15a1d594f403', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 160, 159, NULL, '2025-06-04 07:52:47', '2025-06-04 07:52:47', '2025-06-04 07:52:47'),
('3a5a966e-152f-447f-a7a4-d0ff2ce2489e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 33, 32, NULL, '2025-06-11 11:04:12', '2025-06-11 11:04:12', '2025-06-11 11:04:12'),
('3bb866f9-d7a9-48a8-a00b-da864a9eaadc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '377ecc2b-ba34-445b-bbd2-b0527b4718e6', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 74, 73, NULL, '2025-06-13 12:18:22', '2025-06-13 12:18:22', '2025-06-13 12:18:22'),
('3bc52c9c-9e8c-4ae8-b6b1-da392f4864be', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'e03dc952-7f98-421d-924b-4f819abe666e', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 485, 484, NULL, '2025-06-09 12:36:20', '2025-06-09 12:36:20', '2025-06-09 12:36:20'),
('3e91ccfd-e14d-410a-8c25-b6c0a0f57cf3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 23, 22, NULL, '2025-06-05 11:23:04', '2025-06-05 11:23:04', '2025-06-05 11:23:04'),
('402def49-7c7b-4096-9dcd-23c6f7151d67', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a0cff669-2621-4b55-aaac-88e81474710a', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 26, 23, -3, NULL, '2025-06-11 11:00:00', '2025-06-11 11:00:00', '2025-06-11 11:00:00'),
('430dfc06-917e-42a4-8f55-23a3e77a30fc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 6, 632, 626, NULL, '2025-06-09 13:33:57', '2025-06-09 13:33:57', '2025-06-09 13:33:57'),
('43a26399-14cf-47d3-9663-b801c5c18a0c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '627d7c55-921a-4916-8bf9-98f1bbc4ad08', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 93, 91, NULL, '2025-06-09 12:21:16', '2025-06-09 12:21:16', '2025-06-09 12:21:16'),
('43d11d62-a8f3-4096-b64b-58b4ba1a3604', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b89be53e-f6b7-4005-9f32-9e890325c658', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 132, 131, NULL, '2025-06-09 13:39:45', '2025-06-09 13:39:45', '2025-06-09 13:39:45'),
('4aba5732-1eec-4bec-8f21-85bce601d625', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 99, 96, NULL, '2025-06-06 08:41:47', '2025-06-06 08:41:47', '2025-06-06 08:41:47'),
('4b120fc5-8965-4041-a652-9b850e96a5ca', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 36, 35, NULL, '2025-06-09 12:37:52', '2025-06-09 12:37:52', '2025-06-09 12:37:52'),
('4dab52bc-b2db-4dd8-af08-5835ece85899', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '056250b8-90d2-41e8-b9c7-1a866658ee7f', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 8, 7, NULL, '2025-06-04 02:35:07', '2025-06-04 02:35:07', '2025-06-04 02:35:07'),
('4e017876-8357-49ff-aca7-4878589deb8e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '9c6458f3-20de-4d18-861c-38a24b68b309', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 100, 98, NULL, '2025-06-09 12:20:15', '2025-06-09 12:20:15', '2025-06-09 12:20:15'),
('4fc18a99-ded0-418a-a91f-393e9992573f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b89be53e-f6b7-4005-9f32-9e890325c658', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 134, 133, NULL, '2025-06-09 12:57:19', '2025-06-09 12:57:19', '2025-06-09 12:57:19'),
('52f21898-9637-4af3-9d07-cb6547dce006', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 45, 44, NULL, '2025-05-26 10:38:50', '2025-05-26 10:38:50', '2025-05-26 10:38:50'),
('56267b11-e9d0-46e1-a277-4c57c986e2ab', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 32, 31, NULL, '2025-06-13 13:42:33', '2025-06-13 13:42:33', '2025-06-13 13:42:33'),
('57bf16e3-1e91-4b2c-9286-21121c13d274', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '627d7c55-921a-4916-8bf9-98f1bbc4ad08', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 20, 91, 71, NULL, '2025-06-11 10:59:22', '2025-06-11 10:59:22', '2025-06-11 10:59:22'),
('5810b794-4a54-448e-81ef-d2f5fd1752a4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b89be53e-f6b7-4005-9f32-9e890325c658', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 136, 135, NULL, '2025-06-09 12:28:30', '2025-06-09 12:28:30', '2025-06-09 12:28:30'),
('5ab1a831-24cf-4d6e-9819-b390a4f26644', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '056250b8-90d2-41e8-b9c7-1a866658ee7f', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 2, 1, NULL, '2025-06-09 12:58:04', '2025-06-09 12:58:04', '2025-06-09 12:58:04'),
('5b6d0a82-95f2-4323-93f3-e0632ad1954d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 626, 623, NULL, '2025-06-09 13:56:31', '2025-06-09 13:56:31', '2025-06-09 13:56:31'),
('5c0dbcf6-23d9-46d5-aeb9-51f4d9056978', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '056250b8-90d2-41e8-b9c7-1a866658ee7f', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 5, 4, NULL, '2025-06-04 03:25:23', '2025-06-04 03:25:23', '2025-06-04 03:25:23'),
('5c7cd267-9e21-4090-92e3-d197a9b755ca', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 92, 90, NULL, '2025-06-09 16:29:15', '2025-06-09 16:29:15', '2025-06-09 16:29:15'),
('6038adfa-67e9-4589-9670-835e5efd6259', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 5, 50, 45, NULL, '2025-06-03 10:04:59', '2025-06-03 10:04:59', '2025-06-03 10:04:59'),
('6171f568-0639-484d-80fb-56bcad0a1a20', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a3ad9984-5f79-4300-96a5-d153b8a01665', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 92, 89, NULL, '2025-06-06 08:06:26', '2025-06-06 08:06:26', '2025-06-06 08:06:26'),
('6208adbf-f182-42b9-8aad-b10547247b0f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 96, 93, NULL, '2025-06-09 15:39:26', '2025-06-09 15:39:26', '2025-06-09 15:39:26'),
('64a2ad07-33f1-41c6-81f7-2c8840007fbc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '627d7c55-921a-4916-8bf9-98f1bbc4ad08', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 96, 93, NULL, '2025-06-09 11:55:31', '2025-06-09 11:55:31', '2025-06-09 11:55:31'),
('64e9633e-2b1d-41af-8414-fb805b8f67ff', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'INCREMENT', 'CORRECTION', 2, 19, 21, 'new', '2025-05-26 00:00:00', '2025-05-26 15:52:40', '2025-05-26 15:52:40'),
('6615325f-25f5-438a-96b6-764110161a12', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 21, 20, NULL, '2025-06-08 08:27:10', '2025-06-08 08:27:10', '2025-06-08 08:27:10'),
('66cd26cf-0e17-4a50-a76c-5567b46d42a6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 93, 92, NULL, '2025-06-09 16:21:40', '2025-06-09 16:21:40', '2025-06-09 16:21:40'),
('66fb7901-2349-43ff-a878-ca809ff43914', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 638, 635, NULL, '2025-06-09 12:30:16', '2025-06-09 12:30:16', '2025-06-09 12:30:16'),
('6b3e19d0-ae95-4f30-8c8a-4cdbd97dccf8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 43, 40, NULL, '2025-06-07 14:14:15', '2025-06-07 14:14:15', '2025-06-07 14:14:15'),
('6e9db3f4-87ba-488c-b9b6-f8e85941f976', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 33, 32, NULL, '2025-06-11 08:52:27', '2025-06-11 08:52:27', '2025-06-11 08:52:27'),
('6f7419f8-c156-4cd3-b0f9-3276e8849b11', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'e03dc952-7f98-421d-924b-4f819abe666e', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 488, 485, NULL, '2025-06-09 12:29:38', '2025-06-09 12:29:38', '2025-06-09 12:29:38'),
('72b336aa-5721-47c1-8cd9-5cf218f45b15', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '377ecc2b-ba34-445b-bbd2-b0527b4718e6', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 20, 94, 74, NULL, '2025-06-11 11:01:02', '2025-06-11 11:01:02', '2025-06-11 11:01:02'),
('744a3818-14a2-4e7c-ad73-ee7d7504d5df', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 645, 642, NULL, '2025-06-09 12:15:37', '2025-06-09 12:15:37', '2025-06-09 12:15:37'),
('762515f4-ac59-4c03-8f5f-756041f97bba', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 623, 622, NULL, '2025-06-09 14:00:08', '2025-06-09 14:00:08', '2025-06-09 14:00:08'),
('770fdc2b-e4cc-4587-ba55-6fefb52601eb', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 102, 101, NULL, '2025-06-05 07:40:49', '2025-06-05 07:40:49', '2025-06-05 07:40:49'),
('78c05e93-c83c-49f6-a255-ad88f6882328', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '056250b8-90d2-41e8-b9c7-1a866658ee7f', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 9, 8, NULL, '2025-06-04 02:31:37', '2025-06-04 02:31:37', '2025-06-04 02:31:37'),
('79283ee8-f52a-4355-b8e5-f900722a1260', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 35, 34, NULL, '2025-06-09 13:24:59', '2025-06-09 13:24:59', '2025-06-09 13:24:59'),
('794e92f8-8f80-40cc-a038-4690850aa8a2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 148, 147, NULL, '2025-06-07 16:19:09', '2025-06-07 16:19:09', '2025-06-07 16:19:09'),
('79830a0b-6c5b-44d8-a426-2f7ed26eba7b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 5, 650, 645, NULL, '2025-06-08 08:27:10', '2025-06-08 08:27:10', '2025-06-08 08:27:10'),
('7a9582fb-5756-46a7-b9be-073e541a3230', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 45, 44, NULL, '2025-06-03 10:05:34', '2025-06-03 10:05:34', '2025-06-03 10:05:34'),
('7ab94b07-fe70-4a7c-9fd2-3ffc89e3e70b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 103, 102, NULL, '2025-06-04 01:14:45', '2025-06-04 01:14:45', '2025-06-04 01:14:45'),
('7ad786ae-f941-4177-81e2-005f0ab787b0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 129, 128, NULL, '2025-06-09 11:20:19', '2025-06-09 11:20:19', '2025-06-09 11:20:19'),
('7bef3037-1c41-4fc2-b4a3-ced3f96145a8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a0cff669-2621-4b55-aaac-88e81474710a', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 24, 23, NULL, '2025-06-09 12:21:39', '2025-06-09 12:21:39', '2025-06-09 12:21:39'),
('7d1c476b-7287-406a-a89b-557a920bc0a6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b89be53e-f6b7-4005-9f32-9e890325c658', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 138, 137, NULL, '2025-06-07 16:19:09', '2025-06-07 16:19:09', '2025-06-07 16:19:09'),
('7f0f7be7-6f4b-475c-b5ca-adb1754e95da', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'c4d1fe2b-c711-494c-93d1-e0932962a61e', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 20, 19, NULL, '2025-06-11 10:23:42', '2025-06-11 10:23:42', '2025-06-11 10:23:42'),
('80b13408-e8af-4bf1-8181-e05b99f67700', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '5c08c1dc-5559-4470-8151-c026805899dd', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 49, 46, NULL, '2025-06-09 12:20:54', '2025-06-09 12:20:54', '2025-06-09 12:20:54'),
('81066916-d419-4cee-ae68-254dbbbf5f59', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 93, 91, NULL, '2025-06-09 15:39:26', '2025-06-09 15:39:26', '2025-06-09 15:39:26'),
('86b46d82-50d7-428f-8546-0148d6eb57e9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'f4d52a04-b5d5-49dc-8aa4-d01947ee16d9', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 20, 17, NULL, '2025-06-09 15:47:03', '2025-06-09 15:47:03', '2025-06-09 15:47:03'),
('86c3d989-b060-420e-ba9e-0fe4aae35687', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 98, 97, NULL, '2025-06-09 12:27:02', '2025-06-09 12:27:02', '2025-06-09 12:27:02'),
('883c0e6b-48fd-4532-a855-0d7c1bd7ea25', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '5c08c1dc-5559-4470-8151-c026805899dd', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 46, 44, NULL, '2025-06-09 12:21:38', '2025-06-09 12:21:38', '2025-06-09 12:21:38'),
('892f1ac5-a9fe-4556-bc23-879790b8138a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'RETURN_TO_VENDOR', 1, 13, 12, 'resaasssds', '2025-05-26 00:00:00', '2025-05-26 15:19:50', '2025-05-26 15:19:50'),
('8a38feff-950c-4318-b5cf-dd1a6eacfb62', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 39, 37, NULL, '2025-06-09 12:27:17', '2025-06-09 12:27:17', '2025-06-09 12:27:17'),
('8ce543a4-2567-4f8a-a4bc-03e02d4e4866', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 37, 36, NULL, '2025-06-09 12:27:38', '2025-06-09 12:27:38', '2025-06-09 12:27:38'),
('8f1f7fbe-2983-4780-ad35-471a19b8c440', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 94, 93, NULL, '2025-06-09 15:50:29', '2025-06-09 15:50:29', '2025-06-09 15:50:29'),
('916c3e23-11b7-48d3-988c-95ec89e24f6c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 40, 39, NULL, '2025-06-07 16:19:08', '2025-06-07 16:19:08', '2025-06-07 16:19:08'),
('91db7fea-abfd-4b44-838c-4b3b1f2d6358', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 35, 34, NULL, '2025-06-11 08:53:01', '2025-06-11 08:53:01', '2025-06-11 08:53:01'),
('93a8743d-7384-429d-b563-4aca87aa9c64', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'INCREMENT', 'RECEIVED_STOCK', 5, 12, 17, 'new stock', '2025-05-26 00:00:00', '2025-05-26 15:38:52', '2025-05-26 15:38:52'),
('94e1caed-7ed0-4bd1-97ec-0097c6885957', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 38, 37, NULL, '2025-06-05 07:37:15', '2025-06-05 07:37:15', '2025-06-05 07:37:15'),
('971cf7be-2ed1-41b0-847e-11e603131596', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b193d1a1-94f6-405a-b13f-15a1d594f403', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 152, 151, NULL, '2025-06-09 12:54:51', '2025-06-09 12:54:51', '2025-06-09 12:54:51'),
('99bc1373-47e5-46f6-949c-fbb0471615c0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 141, 140, NULL, '2025-06-09 16:32:54', '2025-06-09 16:32:54', '2025-06-09 16:32:54'),
('9a7d30d1-eeae-476a-9f4e-e330166ddca8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 80, 79, NULL, '2025-06-12 14:54:28', '2025-06-12 14:54:28', '2025-06-12 14:54:28'),
('9ac2edd0-73e4-408f-a8ae-a191494e17b5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '056250b8-90d2-41e8-b9c7-1a866658ee7f', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 10, 9, NULL, '2025-06-04 02:29:02', '2025-06-04 02:29:02', '2025-06-04 02:29:02'),
('9eb90a8a-8ab0-47b0-b25e-b788b7ba0304', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 27, 26, NULL, '2025-06-04 01:14:45', '2025-06-04 01:14:45', '2025-06-04 01:14:45'),
('9f54a02b-ee34-469d-888b-279c0b37f519', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '377ecc2b-ba34-445b-bbd2-b0527b4718e6', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 6, 100, 94, NULL, '2025-06-11 10:59:24', '2025-06-11 10:59:24', '2025-06-11 10:59:24'),
('a45fa14d-35ff-4026-8fbe-2e8ba48c9d6e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 97, 96, NULL, '2025-06-09 12:59:37', '2025-06-09 12:59:37', '2025-06-09 12:59:37'),
('a6b4c8c0-9b3c-4731-b380-fc32be3d0130', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 37, 36, NULL, '2025-06-08 09:32:00', '2025-06-08 09:32:00', '2025-06-08 09:32:00'),
('aaf6e8e0-26d9-43ea-b822-8bc996c1d175', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '56c22eee-4c83-4fd1-aed5-07d3c3fba6b1', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 74, 71, NULL, '2025-06-06 08:06:26', '2025-06-06 08:06:26', '2025-06-06 08:06:26'),
('ac28cf81-6bdb-4d0d-881d-ebd350cacd7d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '5c08c1dc-5559-4470-8151-c026805899dd', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 4, 53, 49, NULL, '2025-06-09 11:34:09', '2025-06-09 11:34:09', '2025-06-09 11:34:09'),
('ae80f01f-cfd8-445a-9bb4-4adbded7dd28', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '592de762-38ed-4640-9e6c-c32fd5096790', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 4, 45, 41, NULL, '2025-06-06 08:06:26', '2025-06-06 08:06:26', '2025-06-06 08:06:26'),
('b15b2054-b688-45b1-8d5f-93471c94bb3c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 96, 95, NULL, '2025-06-09 13:51:28', '2025-06-09 13:51:28', '2025-06-09 13:51:28'),
('b480cb4a-314f-424e-b310-e7a4accd64ad', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '4c98f143-cc49-4f2d-bf93-6544b33d9e19', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 128, 125, NULL, '2025-06-09 11:42:32', '2025-06-09 11:42:32', '2025-06-09 11:42:32'),
('b9288afa-14d9-469a-bff3-02be965d8aea', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '187b21e6-639b-42b4-8199-28e1a2e49f9c', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 4, 26, 22, NULL, '2025-06-06 08:48:42', '2025-06-06 08:48:42', '2025-06-06 08:48:42'),
('b9e1d7b1-6289-4412-8a0f-29eb0c402053', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '056250b8-90d2-41e8-b9c7-1a866658ee7f', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 3, 2, NULL, '2025-06-09 12:28:30', '2025-06-09 12:28:30', '2025-06-09 12:28:30'),
('bcc20df4-7e6c-4bf5-861b-8f3965cba92f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '55f2568f-96cf-46a8-b156-a633be5b591c', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 9, 8, NULL, '2025-06-05 22:19:07', '2025-06-05 22:19:07', '2025-06-05 22:19:07'),
('bd4eb222-a657-4ab5-b206-0453ca130f2f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '056250b8-90d2-41e8-b9c7-1a866658ee7f', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 4, 3, NULL, '2025-06-04 03:33:15', '2025-06-04 03:33:15', '2025-06-04 03:33:15'),
('c0a1cf5c-1b46-4796-bceb-81d049bba363', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b89be53e-f6b7-4005-9f32-9e890325c658', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 135, 134, NULL, '2025-06-09 12:54:48', '2025-06-09 12:54:48', '2025-06-09 12:54:48'),
('c18ae1ef-69fa-4686-a8d9-5cfa5e8a157b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '56b60d92-35a1-4b1d-9be0-514779568b40', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 4, 140, 136, NULL, '2025-06-09 13:56:31', '2025-06-09 13:56:31', '2025-06-09 13:56:31'),
('c1bfd898-0c6f-4f06-b7b1-fe5b513c8b14', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'INCREMENT', 'OTHER', 1, 12, 13, 'Returned from the vendor', '2025-05-26 00:00:00', '2025-05-26 15:31:49', '2025-05-26 15:31:49'),
('c3c60da0-c339-4711-9f4b-c4eecee7fd7a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 145, 144, NULL, '2025-06-09 12:54:51', '2025-06-09 12:54:51', '2025-06-09 12:54:51'),
('c4ebf8b2-1f37-4993-8ff1-c40eef6b82cf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 22, 21, NULL, '2025-06-05 21:51:14', '2025-06-05 21:51:14', '2025-06-05 21:51:14'),
('c761c79e-b742-4f14-ac5e-7d17879cf300', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '592de762-38ed-4640-9e6c-c32fd5096790', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 41, 39, NULL, '2025-06-09 12:30:15', '2025-06-09 12:30:15', '2025-06-09 12:30:15'),
('c8f25b36-e680-4463-ba55-97b5d68ca833', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'PROMOTION_ADJ', 1, 13, 12, 'given to promotional team', '2025-05-26 00:00:00', '2025-05-26 15:36:45', '2025-05-26 15:36:45'),
('c94e398a-f8aa-447d-8ae5-22c1ebc59b85', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 10, 90, 80, NULL, '2025-06-11 11:11:28', '2025-06-11 11:11:28', '2025-06-11 11:11:28'),
('cada0e7c-cea5-46ab-8026-f755904260f3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 640, 638, NULL, '2025-06-09 12:21:38', '2025-06-09 12:21:38', '2025-06-09 12:21:38'),
('cd25fd88-8882-41d2-b11f-94f02a8ee3b3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 36, 35, NULL, '2025-06-09 12:37:52', '2025-06-09 12:37:52', '2025-06-09 12:37:52'),
('cd28806b-b04b-44a2-b8e5-828c24fa6138', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 101, 98, NULL, '2025-06-07 14:14:16', '2025-06-07 14:14:16', '2025-06-07 14:14:16'),
('cd95e99a-f0c7-4a74-b3e1-37c676799b9a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'INCREMENT', 'CORRECTION', 2, 17, 19, NULL, '2025-05-26 00:00:00', '2025-05-26 15:46:53', '2025-05-26 15:46:53'),
('cf2bbe17-3827-4bf2-a278-7f6701a2d07e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'c4d1fe2b-c711-494c-93d1-e0932962a61e', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 22, 21, NULL, '2025-06-04 07:31:14', '2025-06-04 07:31:14', '2025-06-04 07:31:14'),
('d7be4957-8fcc-4b35-b8b4-c899e2e61dd3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '627d7c55-921a-4916-8bf9-98f1bbc4ad08', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 99, 96, NULL, '2025-06-08 08:27:11', '2025-06-08 08:27:11', '2025-06-08 08:27:11'),
('d7e3d0e7-9afa-484e-aed5-75cbd5ee4be3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a95dbb16-3ac2-48c8-a9b0-5a6e6656c884', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 20, 19, NULL, '2025-06-11 08:53:00', '2025-06-11 08:53:00', '2025-06-11 08:53:00'),
('d828210b-5022-4c10-9e3b-5cb8303c30a8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'CORRECTION', 2, 21, 19, NULL, '2025-05-26 00:00:00', '2025-05-26 15:59:09', '2025-05-26 15:59:09'),
('dc7b9fca-feaf-4090-ae81-3894667400b3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'c4d1fe2b-c711-494c-93d1-e0932962a61e', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 21, 20, NULL, '2025-06-05 21:51:15', '2025-06-05 21:51:15', '2025-06-05 21:51:15'),
('dd18fd5a-a1cd-48a0-8716-8e1431d26adc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 150, 148, NULL, '2025-06-05 22:05:09', '2025-06-05 22:05:09', '2025-06-05 22:05:09'),
('dda14183-f2fe-498c-bc7b-99ea1aeed1db', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b89be53e-f6b7-4005-9f32-9e890325c658', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 137, 136, NULL, '2025-06-08 09:32:00', '2025-06-08 09:32:00', '2025-06-08 09:32:00'),
('ddf1e474-4997-41e0-a784-2ea4c8dd786d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 144, 143, NULL, '2025-06-09 12:58:04', '2025-06-09 12:58:04', '2025-06-09 12:58:04'),
('e1ef85ab-aa55-4757-8fdb-86a4a1bcd67b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b193d1a1-94f6-405a-b13f-15a1d594f403', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 7, 159, 152, NULL, '2025-06-07 16:19:09', '2025-06-07 16:19:09', '2025-06-07 16:19:09'),
('e1ff8a18-c723-4c78-9727-0f40ee0f9f89', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'db11baa7-4d6c-4b88-b8e5-45cf40a1a8d8', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 5, 1, -4, NULL, '2025-06-07 16:19:09', '2025-06-07 16:19:09', '2025-06-07 16:19:09'),
('e3f3fa3c-f7c3-418f-b59e-e3929f0d9ac6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 622, 621, NULL, '2025-06-09 14:09:49', '2025-06-09 14:09:49', '2025-06-09 14:09:49'),
('e54e59e0-aabd-41a6-b0ab-b9da29500d3e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '22dbdb82-8f0c-424a-9be3-1c1d57969aa1', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 4, 32, 28, NULL, '2025-06-06 08:48:42', '2025-06-06 08:48:42', '2025-06-06 08:48:42'),
('e952db1b-557f-4594-9f32-98fc90ef0d1d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'INCREMENT', 'CORRECTION', 1, 19, 20, NULL, '2025-05-26 00:00:00', '2025-05-26 16:03:48', '2025-05-26 16:03:48'),
('ea30c2be-d279-4da9-8edf-0fbe985de2f7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ad80d59c-de80-49e0-82e3-c3d528d5367c', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 5, 196, 191, NULL, '2025-06-09 11:35:51', '2025-06-09 11:35:51', '2025-06-09 11:35:51'),
('eaed7664-ca4e-4610-bc46-1cfb3d113975', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 96, 93, NULL, '2025-06-06 08:48:42', '2025-06-06 08:48:42', '2025-06-06 08:48:42'),
('ec258755-8792-4872-a1cc-dcba227beacf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 143, 142, NULL, '2025-06-09 13:46:07', '2025-06-09 13:46:07', '2025-06-09 13:46:07'),
('ed09f93c-9c2f-4178-86fc-a1509219bf88', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 39, 38, NULL, '2025-06-04 01:14:46', '2025-06-04 01:14:46', '2025-06-04 01:14:46'),
('ef53cec1-0437-46cf-a7ca-fd59264b892f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a3ad9984-5f79-4300-96a5-d153b8a01665', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 89, 88, NULL, '2025-06-09 14:27:59', '2025-06-09 14:27:59', '2025-06-09 14:27:59'),
('efb91e8f-2d2a-47f3-94ff-4cffe5909bbc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ce16c080-7f4b-49a4-ad4b-c84c53a2aa79', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 621, 620, NULL, '2025-06-09 14:18:04', '2025-06-09 14:18:04', '2025-06-09 14:18:04'),
('f266f34a-b9fb-4335-a1aa-3929c2937a21', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59c5aa8d-33e1-4e3c-ad80-e5735bde8140', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 57, 55, NULL, '2025-06-09 12:21:38', '2025-06-09 12:21:38', '2025-06-09 12:21:38'),
('f366ad68-4ad4-4986-8913-9ddb51e387f5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'e03dc952-7f98-421d-924b-4f819abe666e', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 7, 500, 493, NULL, '2025-06-06 08:06:26', '2025-06-06 08:06:26', '2025-06-06 08:06:26'),
('f5a3459e-fe18-4c30-a6a9-e48ddeddb7f7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b82e1887-40f9-4475-b277-ef45e093bf56', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 104, 103, NULL, '2025-06-03 10:04:35', '2025-06-03 10:04:35', '2025-06-03 10:04:35'),
('f5b7bfd1-2dc7-4fd5-84c1-4494d36d1627', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'a0cff669-2621-4b55-aaac-88e81474710a', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 6, 30, 24, NULL, '2025-06-06 08:04:43', '2025-06-06 08:04:43', '2025-06-06 08:04:43'),
('f8ebae04-c854-4899-a075-f20765e82225', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '5c08c1dc-5559-4470-8151-c026805899dd', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 3, 56, 53, NULL, '2025-06-08 08:27:11', '2025-06-08 08:27:11', '2025-06-08 08:27:11'),
('fb0224d0-85ce-4538-b7d0-c2c5b519a085', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '59c5aa8d-33e1-4e3c-ad80-e5735bde8140', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 2, 59, 57, NULL, '2025-06-09 12:20:54', '2025-06-09 12:20:54', '2025-06-09 12:20:54'),
('fc4ba2b7-2509-4f87-8a84-2915556f7f13', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', '3dcedd3f-0c34-44f5-b8da-08e372b219cf', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 34, 33, NULL, '2025-06-11 08:54:56', '2025-06-11 08:54:56', '2025-06-11 08:54:56'),
('fc8753b0-1d3d-4b74-a083-5a32cdb7c938', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b89be53e-f6b7-4005-9f32-9e890325c658', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 133, 132, NULL, '2025-06-09 12:59:37', '2025-06-09 12:59:37', '2025-06-09 12:59:37'),
('fcf997bf-9870-4421-a513-8162623461e3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'bcfc8606-b170-42a4-83ed-f1c74f2f8c61', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 32, 31, NULL, '2025-06-12 14:54:39', '2025-06-12 14:54:39', '2025-06-12 14:54:39'),
('fe0e5eb3-655b-4553-8690-aeb0c341ac0c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b89be53e-f6b7-4005-9f32-9e890325c658', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 1, 139, 138, NULL, '2025-06-03 10:06:04', '2025-06-03 10:06:04', '2025-06-03 10:06:04'),
('ff2f38bb-65df-47f1-aa5c-62bfdfcd555f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'b6860c69-6d3e-456c-a25f-a4bc09bd23c4', NULL, 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'DECREMENT', 'SALE_TRANSACTION', 4, 100, 96, NULL, '2025-06-06 08:41:47', '2025-06-06 08:41:47', '2025-06-06 08:41:47');

-- --------------------------------------------------------

--
-- Table structure for table `stores`
--

CREATE TABLE `stores` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `default_tax_class_id` char(36) DEFAULT NULL,
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
  `allow_negative_stock` tinyint(1) DEFAULT '1',
  `discount_application_rule` varchar(20) DEFAULT 'BEFORE_TAX' COMMENT 'Can be BEFORE_TAX or AFTER_TAX',
  `date_format` varchar(20) DEFAULT 'MM/DD/YYYY',
  `time_format` varchar(20) DEFAULT 'hh:mm A',
  `timezone` varchar(50) DEFAULT 'UTC',
  `number_format` varchar(20) DEFAULT '1,234.56' COMMENT 'Number format pattern, e.g., 1,234.56 or 1.234,56',
  `decimal_precision` int DEFAULT '2' COMMENT 'Default decimal precision for currency values',
  `locale_code` varchar(10) DEFAULT 'en-US' COMMENT 'BCP 47 language tag, e.g., en-US, fr-CA',
  `measurement_system` enum('metric','imperial') DEFAULT 'metric' COMMENT 'Default measurement system',
  `allow_over_receiving` tinyint(1) DEFAULT '0',
  `default_tax_basis` enum('INCLUSIVE','EXCLUSIVE') NOT NULL DEFAULT 'EXCLUSIVE' COMMENT 'Determines if product prices in this store are treated as tax-inclusive or tax-exclusive by default.',
  `is_active` tinyint(1) DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `stores`
--

INSERT INTO `stores` (`id`, `tenant_id`, `name`, `default_tax_class_id`, `address`, `phone`, `email`, `tax_rate`, `currency_code`, `language_code`, `country_code`, `created_at`, `updated_at`, `tax_config`, `allow_negative_stock`, `discount_application_rule`, `date_format`, `time_format`, `timezone`, `number_format`, `decimal_precision`, `locale_code`, `measurement_system`, `allow_over_receiving`, `default_tax_basis`, `is_active`) VALUES
('330dc360-f6de-4c77-a8ab-10b7785e33e5', '2ebc3978-912d-4b0f-95cd-241bab143708', 'Smith Electronics - Main Store', NULL, 'Address to be updated', '+1555123456', 'john.smith@example.com', 10.00, 'USD', NULL, NULL, '2025-07-22 10:10:17', '2025-07-22 10:10:17', '{\"rules\": [], \"default_rate\": 0.00}', 1, 'BEFORE_TAX', 'MM/DD/YYYY', 'hh:mm A', 'UTC', '1,234.56', 2, 'en-US', 'metric', 0, 'EXCLUSIVE', 1),
('5a873254-c0f5-4e47-83b3-20b7eb776ca7', 'dfb9d4f0-a36f-43fe-adf0-79954c42b00d', 'Test Business - Main Store', NULL, 'Address to be updated', '+1234567890', 'test@example.com', 10.00, 'USD', NULL, NULL, '2025-07-22 09:56:54', '2025-07-22 09:56:54', '{\"rules\": [], \"default_rate\": 0.00}', 1, 'BEFORE_TAX', 'MM/DD/YYYY', 'hh:mm A', 'UTC', '1,234.56', 2, 'en-US', 'metric', 0, 'EXCLUSIVE', 1),
('7072ce94-56ae-4412-a31d-260dcf166bab', 'dev-tenant', 'Default Store', NULL, NULL, NULL, NULL, 10.00, 'USD', NULL, NULL, '2025-07-08 02:31:57', '2025-07-08 02:32:13', '{\"pricesIncludeTax\": true, \"default_tax_class_id\": null}', 1, 'BEFORE_TAX', 'MM/DD/YYYY', 'hh:mm A', 'UTC', '1,234.56', 2, 'en-US', 'metric', 0, 'EXCLUSIVE', 1),
('7e5acd03-0a6c-44e9-9b69-41828f880605', '2e70f11c-d825-4997-bb02-077274298ba8', 'Pushpalatha Thangarasu\'s Business - Main Store', NULL, 'Address to be updated', '2143162116', 'pushpalatha.thanga@gmail.com', 10.00, 'USD', NULL, NULL, '2025-07-22 19:34:23', '2025-07-22 19:34:23', '{\"rules\": [], \"default_rate\": 0.00}', 1, 'BEFORE_TAX', 'MM/DD/YYYY', 'hh:mm A', 'UTC', '1,234.56', 2, 'en-US', 'metric', 0, 'EXCLUSIVE', 1),
('f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Zettaz Mart', '92bd6f00-36f9-11f0-8297-525400148990', '123 Main Street, Maryland Heights, MO 63043', '+1 (268) 456-7890', 'stores@zettaz.com', 10.00, 'USD', 'en', 'IN', '2025-05-20 09:08:21', '2025-06-25 05:13:11', '{\"rules\": [], \"default_rate\": 0.1, \"default_tax_class_id\": \"92bd6f00-36f9-11f0-8297-525400148990\"}', 1, 'BEFORE_TAX', 'DD/MM/YYYY', 'hh:mm A', 'America/Chicago', '1,234.56', 2, 'en-US', 'imperial', 1, 'EXCLUSIVE', 1),
('f8g5c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'e6eb6436-4665-11f0-9c38-525400148990', 'Deshvidesh Enterprise Store', '5e6dc0f6-d6eb-4b90-aab2-d75af20992c3', '123 Friars Hill Road, St. John\'s, Antigua, WI.', '+1 (268) 783-7837', 'stores@deshvidesh.com', 10.00, 'XCD', 'en', 'AG', '2025-05-20 09:08:21', '2025-06-11 06:46:51', '{\"rules\": [], \"default_rate\": 0.1, \"default_tax_class_id\": \"92bd6f00-36f9-11f0-8297-525400148990\"}', 1, 'BEFORE_TAX', 'DD/MM/YYYY', 'hh:mm A', 'America/Chicago', '1,234.56', 2, 'en-US', 'imperial', 1, 'EXCLUSIVE', 1);

-- --------------------------------------------------------

--
-- Table structure for table `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tenant_id` char(36) NOT NULL,
  `plan_id` char(36) NOT NULL,
  `status` enum('active','trial','expired','cancelled','pending') NOT NULL DEFAULT 'pending',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `trial_end_date` date DEFAULT NULL,
  `auto_renew` tinyint(1) NOT NULL DEFAULT '0',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `subscriptions`
--

INSERT INTO `subscriptions` (`id`, `tenant_id`, `plan_id`, `status`, `start_date`, `end_date`, `trial_end_date`, `auto_renew`, `metadata`, `created_at`, `updated_at`) VALUES
('6bb0f4c5-4c50-11f0-8dfa-525400d69130', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', '6baf11e2-4c50-11f0-8dfa-525400d69130', 'active', '2025-06-18', '2026-06-18', '2025-06-17', 1, NULL, '2025-06-18 14:27:53', '2025-06-18 14:38:40'),
('6CC0f4c5-4c50-11f0-8dfa-525400d69130', 'e6eb6436-4665-11f0-9c38-525400148990', '6baf11e2-4c50-11f0-8dfa-525400d69130', 'active', '2025-06-18', '2026-06-18', '2025-06-17', 1, NULL, '2025-06-18 14:27:53', '2025-06-18 14:38:40');

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `supplier_name` varchar(255) NOT NULL COMMENT 'Name of the supplier company or individual',
  `contact_person` varchar(255) DEFAULT NULL COMMENT 'Primary contact person at the supplier',
  `email` varchar(255) DEFAULT NULL COMMENT 'Email address of the supplier',
  `phone` varchar(50) DEFAULT NULL COMMENT 'Phone number of the supplier',
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state_province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL COMMENT 'Supplier website URL',
  `tax_id` varchar(50) DEFAULT NULL COMMENT 'Tax identification number (e.g., VAT ID, EIN)',
  `default_payment_terms` varchar(100) DEFAULT NULL COMMENT 'e.g., Net 30, Due on Receipt',
  `notes` text COMMENT 'Internal notes about the supplier',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether the supplier is currently active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` varchar(36) DEFAULT NULL,
  `updated_by_user_id` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `tenant_id`, `supplier_name`, `contact_person`, `email`, `phone`, `address_line1`, `address_line2`, `city`, `state_province`, `postal_code`, `country`, `website`, `tax_id`, `default_payment_terms`, `notes`, `is_active`, `created_at`, `updated_at`, `created_by_user_id`, `updated_by_user_id`) VALUES
('a29d230f-c4a1-41f0-baf7-0a3bcd6b2e2d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Global Packaging Supplies inc', 'Mark Peterson', 'mark@globalpack.com', '+1-555-987-1234', '88 Industrial Park', '', 'Dallas', 'Texas', '75201', 'USA', 'https://www.globalpack.com', 'GPS-77443', 'Due on Receipt', 'Supplies packaging and storage materials.', 1, '2025-05-27 02:59:10', '2025-06-17 21:41:21', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('b13a5671-b90d-4ef2-81d4-029d9b99f679', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Golden Dairy Ltd.', 'Sophie Wells', 'sales@goldendairy.com', '+44 20 7946 0022', '42 Milk Street', NULL, 'London', 'Greater London', 'EC1A 1BB', 'UK', 'https://www.goldendairy.co.uk', 'GD-44567', 'Net 15', 'High-quality dairy products. Delivers weekly.', 1, '2025-05-27 02:59:10', '2025-05-27 02:59:10', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'),
('d1f3a980-0a3a-4e5c-b15a-92c174caeec1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Fresh Farm Produce Co.', 'Alice Johnson', 'contact@freshfarm.com', '+1-555-234-5678', '123 Green Road', 'Warehouse 4', 'Springfield', 'Illinois', '62704', 'USA', 'https://www.freshfarm.com', 'FFP-98221', 'Net 30', 'Preferred organic supplier for produce.', 1, '2025-05-27 02:59:10', '2025-05-27 02:59:10', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d');

-- --------------------------------------------------------

--
-- Table structure for table `system_permissions`
--

CREATE TABLE `system_permissions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `module` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `system_permissions`
--

INSERT INTO `system_permissions` (`id`, `name`, `description`, `module`, `created_at`, `updated_at`) VALUES
('6b90313f-4c50-11f0-8dfa-525400d69130', 'platform.view', 'View platform dashboard and statistics', 'platform', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9034bf-4c50-11f0-8dfa-525400d69130', 'platform.manage', 'Manage platform settings and configurations', 'platform', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9036b9-4c50-11f0-8dfa-525400d69130', 'tenants.view', 'View all tenants on the platform', 'tenants', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9037a9-4c50-11f0-8dfa-525400d69130', 'tenants.create', 'Create new tenants', 'tenants', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9038c3-4c50-11f0-8dfa-525400d69130', 'tenants.edit', 'Edit tenant information', 'tenants', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903941-4c50-11f0-8dfa-525400d69130', 'tenants.delete', 'Delete tenants', 'tenants', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9039a9-4c50-11f0-8dfa-525400d69130', 'subscriptions.view', 'View all subscriptions', 'subscriptions', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903a08-4c50-11f0-8dfa-525400d69130', 'subscriptions.create', 'Create new subscriptions', 'subscriptions', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903a72-4c50-11f0-8dfa-525400d69130', 'subscriptions.edit', 'Edit existing subscriptions', 'subscriptions', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903b97-4c50-11f0-8dfa-525400d69130', 'subscriptions.delete', 'Cancel/Delete subscriptions', 'subscriptions', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903c07-4c50-11f0-8dfa-525400d69130', 'plans.view', 'View subscription plans', 'plans', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903c63-4c50-11f0-8dfa-525400d69130', 'plans.create', 'Create new subscription plans', 'plans', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903d7a-4c50-11f0-8dfa-525400d69130', 'plans.edit', 'Edit subscription plans', 'plans', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903ded-4c50-11f0-8dfa-525400d69130', 'plans.delete', 'Delete subscription plans', 'plans', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903e51-4c50-11f0-8dfa-525400d69130', 'support.view', 'View support tickets', 'support', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903eee-4c50-11f0-8dfa-525400d69130', 'support.respond', 'Respond to support tickets', 'support', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903f4d-4c50-11f0-8dfa-525400d69130', 'support.escalate', 'Escalate support tickets', 'support', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b903fb1-4c50-11f0-8dfa-525400d69130', 'support.close', 'Close support tickets', 'support', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b90400e-4c50-11f0-8dfa-525400d69130', 'system.logs.view', 'View system logs', 'system', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b904067-4c50-11f0-8dfa-525400d69130', 'system.settings.view', 'View system settings', 'system', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9040d1-4c50-11f0-8dfa-525400d69130', 'system.settings.edit', 'Edit system settings', 'system', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b904130-4c50-11f0-8dfa-525400d69130', 'system.maintenance', 'Perform system maintenance', 'system', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b90419a-4c50-11f0-8dfa-525400d69130', 'system.roles.manage', 'Manage system roles', 'system', '2025-06-18 14:27:53', '2025-06-18 14:27:53');

-- --------------------------------------------------------

--
-- Table structure for table `system_roles`
--

CREATE TABLE `system_roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(50) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `system_roles`
--

INSERT INTO `system_roles` (`id`, `name`, `description`, `created_at`, `updated_at`) VALUES
('6b9152e9-4c50-11f0-8dfa-525400d69130', 'Super Admin', 'Complete access to all platform features and settings', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', 'Platform Admin', 'Administrative access to platform management features', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b915654-4c50-11f0-8dfa-525400d69130', 'Support Admin', 'Access to customer support and help desk features', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', 'Billing Admin', 'Access to subscription and billing management', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6b9156fb-4c50-11f0-8dfa-525400d69130', 'Read Only Admin', 'View-only access to platform data and analytics', '2025-06-18 14:27:53', '2025-06-18 14:27:53');

-- --------------------------------------------------------

--
-- Table structure for table `system_role_permissions`
--

CREATE TABLE `system_role_permissions` (
  `role_id` char(36) NOT NULL,
  `permission_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `system_role_permissions`
--

INSERT INTO `system_role_permissions` (`role_id`, `permission_id`, `created_at`) VALUES
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b90313f-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b9034bf-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b9036b9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b9037a9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b9038c3-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903941-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b9039a9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903a08-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903a72-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903b97-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903c07-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903c63-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903d7a-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903ded-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903e51-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903eee-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903f4d-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b903fb1-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b90400e-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b904067-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b9040d1-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b904130-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9152e9-4c50-11f0-8dfa-525400d69130', '6b90419a-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b90313f-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b9034bf-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b9036b9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b9037a9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b9038c3-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b903941-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b90400e-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b904067-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b9040d1-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b904130-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915566-4c50-11f0-8dfa-525400d69130', '6b90419a-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915654-4c50-11f0-8dfa-525400d69130', '6b9036b9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915654-4c50-11f0-8dfa-525400d69130', '6b903e51-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915654-4c50-11f0-8dfa-525400d69130', '6b903eee-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915654-4c50-11f0-8dfa-525400d69130', '6b903f4d-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915654-4c50-11f0-8dfa-525400d69130', '6b903fb1-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b915654-4c50-11f0-8dfa-525400d69130', '6b90400e-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', '6b9036b9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', '6b9039a9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', '6b903a08-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', '6b903a72-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', '6b903b97-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', '6b903c07-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', '6b903c63-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', '6b903d7a-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156ad-4c50-11f0-8dfa-525400d69130', '6b903ded-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156fb-4c50-11f0-8dfa-525400d69130', '6b90313f-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156fb-4c50-11f0-8dfa-525400d69130', '6b9036b9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156fb-4c50-11f0-8dfa-525400d69130', '6b9039a9-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156fb-4c50-11f0-8dfa-525400d69130', '6b903c07-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156fb-4c50-11f0-8dfa-525400d69130', '6b903e51-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156fb-4c50-11f0-8dfa-525400d69130', '6b90400e-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53'),
('6b9156fb-4c50-11f0-8dfa-525400d69130', '6b904067-4c50-11f0-8dfa-525400d69130', '2025-06-18 14:27:53');

-- --------------------------------------------------------

--
-- Table structure for table `tax_classes`
--

CREATE TABLE `tax_classes` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'e.g., Standard Sales Tax, Food Items (Reduced Rate), Services (GST + QST), Tax Exempt',
  `description` text COMMENT 'Optional detailed description of the tax class.',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Defines categories of tax rules (e.g., standard, reduced, exempt).';

--
-- Dumping data for table `tax_classes`
--

INSERT INTO `tax_classes` (`id`, `tenant_id`, `store_id`, `name`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
('5e6dc0f6-d6eb-4b90-aab2-d75af20992c3', 'e6eb6436-4665-11f0-9c38-525400148990', 'f8g5c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'ABST', 'Antigua and Barbuda Sales Tax', 1, '2025-06-11 06:46:51', '2025-06-11 06:46:51'),
('92bd6f00-36f9-11f0-8297-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Federal Sales Tax', 'Federal sales tax applicable to most goods and service.', 1, '2025-05-22 10:43:18', '2025-07-08 03:09:07'),
('92be2844-36f9-11f0-8297-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Reduced Rate Tax', 'Reduced tax rate for specific categories of items (e.g., certain food items).', 1, '2025-05-22 10:43:18', '2025-06-11 05:45:22'),
('92bed9d4-36f9-11f0-8297-525400148990', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'Tax Exempt', 'Items or customers exempt from sales tax.', 1, '2025-05-22 10:43:18', '2025-06-11 05:45:22');

-- --------------------------------------------------------

--
-- Table structure for table `tax_class_rates`
--

CREATE TABLE `tax_class_rates` (
  `id` char(36) NOT NULL,
  `tax_class_id` char(36) NOT NULL,
  `tax_rate_name` varchar(100) NOT NULL COMMENT 'e.g., GST, PST, State Sales Tax, City Tax',
  `rate` decimal(7,5) NOT NULL COMMENT 'Tax rate, e.g., 0.05000 for 5%. Allows for rates like 12.345%',
  `priority` int NOT NULL DEFAULT '0' COMMENT 'Calculation order for taxes within the same class. Lower numbers first.',
  `is_compound` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0 = Applied on base price. 1 = Applied on (base price + sum of prior-priority taxes for this item).',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '0 = Inactive, 1 = Active. Allows disabling a rate without deleting.',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `store_id` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Defines individual tax rate components for a tax class.';

--
-- Dumping data for table `tax_class_rates`
--

INSERT INTO `tax_class_rates` (`id`, `tax_class_id`, `tax_rate_name`, `rate`, `priority`, `is_compound`, `is_active`, `created_at`, `updated_at`, `store_id`) VALUES
('3bce3d53-997f-4d0b-b528-76af5b06848f', '5e6dc0f6-d6eb-4b90-aab2-d75af20992c3', 'ABST', 15.00000, 1, 1, 1, '2025-06-11 06:57:51', '2025-06-12 06:54:30', 'f8g5c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c'),
('92bfa003-36f9-11f0-8297-525400148990', '92bd6f00-36f9-11f0-8297-525400148990', 'Federal Sales Tax', 8.25000, 1, 0, 1, '2025-05-22 10:43:18', '2025-07-08 03:09:19', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c'),
('92c075ec-36f9-11f0-8297-525400148990', '92be2844-36f9-11f0-8297-525400148990', 'Reduced Item Tax', 5.00000, 1, 0, 1, '2025-05-22 10:43:18', '2025-06-13 10:30:53', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c'),
('92c13ae3-36f9-11f0-8297-525400148990', '92bed9d4-36f9-11f0-8297-525400148990', 'Exempt Rate', 0.00000, 0, 0, 1, '2025-05-22 10:43:18', '2025-06-12 06:54:30', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c');

-- --------------------------------------------------------

--
-- Table structure for table `tenants`
--

CREATE TABLE `tenants` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `domain` varchar(255) DEFAULT NULL,
  `settings` json DEFAULT (_utf8mb4'{}'),
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `setup_completed` tinyint(1) DEFAULT '0',
  `trial_started_at` datetime DEFAULT NULL,
  `onboarding_step` varchar(50) DEFAULT 'signup'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tenants`
--

INSERT INTO `tenants` (`id`, `name`, `domain`, `settings`, `created_at`, `updated_at`, `setup_completed`, `trial_started_at`, `onboarding_step`) VALUES
('2e70f11c-d825-4997-bb02-077274298ba8', 'Pushpalatha Thangarasu\'s Business', NULL, '{}', '2025-07-22 19:34:23', '2025-07-22 19:34:53', 0, '2025-07-22 19:34:23', 'store_setup'),
('2ebc3978-912d-4b0f-95cd-241bab143708', 'Smith Electronics', NULL, '{}', '2025-07-22 10:10:17', '2025-07-22 10:10:49', 0, '2025-07-22 10:10:17', 'store_setup'),
('d7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Zettaz Demo Store', 'demo.zettaz.com', '{\"allow_negative_stock\": true}', '2025-05-20 09:08:21', '2025-05-26 02:23:21', 0, NULL, 'signup'),
('dev-tenant', 'Development Tenant', NULL, '{}', '2025-07-08 02:31:56', '2025-07-08 02:31:56', 0, NULL, 'signup'),
('dfb9d4f0-a36f-43fe-adf0-79954c42b00d', 'Test Business', NULL, '{}', '2025-07-22 09:56:54', '2025-07-22 09:57:53', 0, '2025-07-22 09:56:54', 'store_setup'),
('e6eb6436-4665-11f0-9c38-525400148990', 'Deshvidesh Enterprises', 'deshvidesh.com', '{\"allow_negative_stock\": true}', '2025-06-11 01:46:32', '2025-06-11 01:47:16', 0, NULL, 'signup');

-- --------------------------------------------------------

--
-- Table structure for table `tenant_payment_settings`
--

CREATE TABLE `tenant_payment_settings` (
  `tenant_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `allow_partial_payments` tinyint(1) NOT NULL DEFAULT '1',
  `allow_tips` tinyint(1) NOT NULL DEFAULT '0',
  `default_tip_percentage` decimal(5,2) DEFAULT '10.00',
  `receipt_settings` json DEFAULT NULL COMMENT 'Receipt template and settings',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tenant-specific payment settings';

--
-- Dumping data for table `tenant_payment_settings`
--

INSERT INTO `tenant_payment_settings` (`tenant_id`, `default_currency`, `allow_partial_payments`, `allow_tips`, `default_tip_percentage`, `receipt_settings`, `created_at`, `updated_at`) VALUES
('d7f267da-d5d9-4a15-b0d3-31ca710a4492', 'INR', 1, 0, 10.00, NULL, '2025-05-21 03:37:25', '2025-05-21 03:37:25');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `profile_picture_url` varchar(255) DEFAULT NULL,
  `store_id` char(36) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email_verified` tinyint(1) DEFAULT '0',
  `verification_token` varchar(255) DEFAULT NULL,
  `verification_expires` datetime DEFAULT NULL,
  `signup_completed` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `tenant_id`, `name`, `email`, `phone_number`, `password_hash`, `profile_picture_url`, `store_id`, `is_active`, `last_login_at`, `created_at`, `updated_at`, `email_verified`, `verification_token`, `verification_expires`, `signup_completed`) VALUES
('73568034-e1b9-4dc6-87d2-ce1504a45602', 'dfb9d4f0-a36f-43fe-adf0-79954c42b00d', 'Test User', 'test@example.com', '+1234567890', '$2b$12$0/rWgAcElJJJ34aFI0kIPuRI5nOOW20TwGFaHRvvqZFzNgKCdgXYi', NULL, NULL, 1, NULL, '2025-07-22 09:56:54', '2025-07-22 09:57:53', 1, NULL, NULL, 1),
('a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Naresh Velusamy', 'admin@zettaz.com', '12684642003', '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2', NULL, 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 1, '2025-07-22 19:33:29', '2025-05-20 09:08:21', '2025-07-22 19:33:29', 1, NULL, NULL, 0),
('adbaa8f4-2b62-4e0b-8e4d-4fb9b0dee282', '2ebc3978-912d-4b0f-95cd-241bab143708', 'John Smith', 'john.smith@example.com', '+1555123456', '$2b$12$TEMGaniBwhuwuZZZmKCZp.Crjp6GGIqNe8.R4d9vxjperfBQYLxkW', NULL, NULL, 1, NULL, '2025-07-22 10:10:17', '2025-07-22 10:10:49', 1, NULL, NULL, 1),
('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'John Deib Manager', 'manager@zettaz.com', NULL, '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2', NULL, NULL, 1, '2025-07-22 06:38:57', '2025-05-20 09:08:21', '2025-07-22 09:58:39', 1, NULL, NULL, 0),
('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Linda Johnson', 'cashier@zettaz.com', NULL, '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2', NULL, NULL, 1, '2025-07-19 06:35:41', '2025-05-20 09:08:21', '2025-07-22 09:58:39', 1, NULL, NULL, 0),
('c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'e6eb6436-4665-11f0-9c38-525400148990', 'Deepak', 'admin@deshvidesh.com', '+12687837837', '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2', NULL, 'f8g5c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 1, '2025-07-16 08:39:06', '2025-05-20 09:08:21', '2025-07-22 09:58:39', 1, NULL, NULL, 0),
('cb7b62d6-f2e3-4b0b-8cfd-bd13da4a67bf', '2e70f11c-d825-4997-bb02-077274298ba8', 'Pushpalatha Thangarasu', 'pushpalatha.thanga@gmail.com', '2143162116', '$2b$12$bt9hRV2wjN/3UaNNS/p2HOpfplkxtHjGyzhAGCFBpELxB9c5e.GS2', NULL, NULL, 1, NULL, '2025-07-22 19:34:23', '2025-07-22 19:34:52', 1, NULL, NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `users_backup_20250626051814474`
--

CREATE TABLE `users_backup_20250626051814474` (
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
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users_backup_20250626051814474`
--

INSERT INTO `users_backup_20250626051814474` (`id`, `tenant_id`, `name`, `email`, `phone_number`, `password_hash`, `role`, `profile_picture_url`, `store_id`, `is_active`, `last_login_at`, `created_at`, `updated_at`) VALUES
('87dd56a6-c0d4-46a0-9ef0-d99ac8cacd67', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'test user', 'test@user.com', NULL, '$2a$10$PsC4ami07qHrJIlRe8Gp8OLYKVBzph.nnGtFzfs5ZB9pxi4ytGv1m', 'cashier', NULL, NULL, 0, NULL, '2025-06-25 05:57:17', '2025-06-25 01:16:45'),
('a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Naresh Velusamy', 'admin@zettaz.com', '12684642003', '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2', 'admin', NULL, 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 0, '2025-05-20 09:08:21', '2025-05-20 09:08:21', '2025-06-25 02:56:48'),
('b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'John Manager', 'manager@zettaz.com', NULL, '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2', 'manager', NULL, NULL, 0, NULL, '2025-05-20 09:08:21', '2025-06-23 20:35:01'),
('c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'Linda Johnson', 'cashier@zettaz.com', NULL, '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2', 'cashier', NULL, NULL, 0, NULL, '2025-05-20 09:08:21', '2025-06-23 20:52:39'),
('c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'e6eb6436-4665-11f0-9c38-525400148990', 'Deepak', 'admin@deshvidesh.com', '+12687837837', '$2a$12$z.PB2zdDXrzO0zQ3NcwQAOG0dKWis1c6A.CeKWwLheAfoYZ3wv.J2', 'admin', NULL, 'f8g5c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 1, '2025-05-20 09:08:21', '2025-05-20 09:08:21', '2025-06-11 01:52:34');

-- --------------------------------------------------------

--
-- Table structure for table `user_activity_logs`
--

CREATE TABLE `user_activity_logs` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `username` varchar(255) DEFAULT NULL,
  `action_type` varchar(100) NOT NULL,
  `description` text,
  `details` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `user_activity_logs`
--

INSERT INTO `user_activity_logs` (`id`, `tenant_id`, `user_id`, `username`, `action_type`, `description`, `details`, `ip_address`, `user_agent`, `timestamp`) VALUES
('01b17c29-6735-4171-9c40-dc1093e36cb1', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 01:53:39'),
('022a5d76-e735-42a5-b7a2-9f75604209cd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID c4d1fe2b-c711-494c-93d1-e0932962a61e adjusted from 20 to 19. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 19, \"oldStock\": 20, \"productId\": \"c4d1fe2b-c711-494c-93d1-e0932962a61e\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 10:23:42'),
('0249a80f-2b76-4b5d-8dee-265874705d46', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 04:23:00'),
('027aebe8-2412-4f9c-ba25-d167d177c1f5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 01:30:47'),
('0397c555-c26e-4630-83b8-81bffdfd55a2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-23 19:20:54'),
('04066c7b-7ffc-41c1-82cf-90d1f67c14b8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 377ecc2b-ba34-445b-bbd2-b0527b4718e6 adjusted from 100 to 94. Change: -6.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 94, \"oldStock\": 100, \"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -6}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 10:59:24'),
('04587947-1d64-4730-8859-d7da97635f74', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 19:21:13'),
('04f81ab1-b64e-4b88-af24-a1de857b1b2d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 18:38:00'),
('055d8566-93f9-4a76-98ad-58f24d61b042', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'cashier@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user cashier@zettaz.com: Invalid password.', '{\"email\": \"cashier@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'curl/8.7.1', '2025-06-11 12:55:04'),
('059572be-ac1e-4064-8337-00e6ae8d81f6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 627d7c55-921a-4916-8bf9-98f1bbc4ad08 adjusted from 99 to 96. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 96, \"oldStock\": 99, \"productId\": \"627d7c55-921a-4916-8bf9-98f1bbc4ad08\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 08:27:11'),
('05b1cf92-5fe2-43ae-8a56-8a10fc76e922', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 15:45:01'),
('0684b49b-d74f-4777-97cd-f69faaae2f3e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b89be53e-f6b7-4005-9f32-9e890325c658 adjusted from 133 to 132. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 132, \"oldStock\": 133, \"productId\": \"b89be53e-f6b7-4005-9f32-9e890325c658\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:59:37'),
('068b791f-54b5-43e1-ae47-24dce30e1313', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 56b60d92-35a1-4b1d-9be0-514779568b40 adjusted from 140 to 136. Change: -4.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 136, \"oldStock\": 140, \"productId\": \"56b60d92-35a1-4b1d-9be0-514779568b40\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -4}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:56:31'),
('078057c3-26b5-49f5-b8eb-391df5f15d82', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 12:02:43'),
('0792f79c-5a4b-40c8-b95b-95fc7d9ce7a8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 02:10:28'),
('07ac8268-9661-4bff-a650-9c958bbcdcf4', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:22:21'),
('081525c9-2607-4171-bee2-4cf0b226eed9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 79a526a2-29e8-4e6c-8deb-6e9508f570e0 processed successfully for amount 64.95. Items: 1.', '{\"saleId\": \"79a526a2-29e8-4e6c-8deb-6e9508f570e0\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 64.95, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:04:43'),
('0850b3ee-dbf0-4512-a70a-754b0ea6def9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:49:41'),
('08a57e4a-d454-47f1-8b56-b946be6ba521', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 102 to 101. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 101, \"oldStock\": 102, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 07:40:49'),
('08fd280a-fad3-43a2-92a2-704272566203', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 11:38:32'),
('09269a78-7783-4fb5-a9c0-a37af413ea0c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d adjusted from 148 to 147. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 147, \"oldStock\": 148, \"productId\": \"59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 16:19:09'),
('097f339d-7b91-44c4-a021-07beb1182466', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 7260e4e7-cba7-41d4-9e3e-f10a7c1c4b45 processed successfully for amount 176.45. Items: 1.', '{\"saleId\": \"7260e4e7-cba7-41d4-9e3e-f10a7c1c4b45\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 176.4475, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 11:23:03'),
('0a5e2b21-157d-4627-bf29-6fdcd7ddd7be', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 09:33:58'),
('0aa17439-baf8-4674-b2f4-00d59adee875', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 15:37:59'),
('0ac06863-d85a-4fab-9099-a093be8c61be', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:40:38'),
('0b92ba7e-dd94-41f2-8c86-fe5f78ec076e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 22dbdb82-8f0c-424a-9be3-1c1d57969aa1 adjusted from 32 to 28. Change: -4.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 28, \"oldStock\": 32, \"productId\": \"22dbdb82-8f0c-424a-9be3-1c1d57969aa1\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -4}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:48:42'),
('0be59c56-51b7-4415-ab4a-77e9eb08a011', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 96 to 95. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 95, \"oldStock\": 96, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:51:29'),
('0c0dfd5c-e0fd-49e4-a440-b28749be0117', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 14ff74f8-d700-4b7f-b118-2fb789011860) updated.', '{\"productId\": \"14ff74f8-d700-4b7f-b118-2fb789011860\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"67bab738-0494-4e8d-8d5e-9d0a0f97c04f\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:51'),
('0c514b79-f725-4bd1-aa7a-e77a27274cc5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: bcfc8606-b170-42a4-83ed-f1c74f2f8c61) updated.', '{\"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"67bab738-0494-4e8d-8d5e-9d0a0f97c04f\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:51'),
('0ca8175b-bfbd-46e9-be73-1aa2cb98773f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 377ecc2b-ba34-445b-bbd2-b0527b4718e6 adjusted from 74 to 73. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 73, \"oldStock\": 74, \"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 12:18:22'),
('0cd8796f-c0a4-44d3-aeef-f1ed56cbee93', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-26 05:32:17'),
('0cf5c13a-4d0a-45ad-926b-6b8f8bbe7da8', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 04:44:32'),
('0d69aa55-7c06-424f-b2cd-3d197d43301a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:43:23'),
('0e59540e-0741-4410-9f3f-f82cdad63fb6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Wedding Ring\" (ID: 55f2568f-96cf-46a8-b156-a633be5b591c) updated.', '{\"productId\": \"55f2568f-96cf-46a8-b156-a633be5b591c\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Wedding Ring\", \"price\": \"1400\", \"barcode\": \"\", \"imageUrl\": \"/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748850859392-437044890.png\", \"is_active\": \"true\", \"category_id\": \"3ff8552b-2b1c-438c-abd3-6231f9195b00\", \"description\": \"Wedding Ring\", \"tax_class_id\": \"92be2844-36f9-11f0-8297-525400148990\", \"purchase_price\": \"1000\", \"stock_quantity\": \"7\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 10:31:16'),
('0edb211f-4a8b-4813-ab49-ce11e0fb5822', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-25 02:56:54'),
('0eed26e9-f667-4def-bcb1-3ca2b88c22c4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 08:24:44'),
('0f2153a9-7435-46f2-b5f9-c613e0eb2271', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale a189a025-b269-409b-87e7-c29f5f7e33c0 processed successfully for amount 40.59. Items: 2.', '{\"saleId\": \"a189a025-b269-409b-87e7-c29f5f7e33c0\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": \"083e0734-5aed-42e3-b978-c5a3d524c9e4\", \"totalAmount\": 40.59375, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 11:55:30'),
('0f42c166-840f-4a2a-b334-e1e8de9165aa', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"null\", \"purchase_price\": \"5\", \"stock_quantity\": \"73\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:54:03'),
('0f47f607-807f-4bce-a620-af7a241d8b16', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 21:22:05'),
('10004fcb-2c96-4e87-aa0c-be454444dd9c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 93 to 92. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 92, \"oldStock\": 93, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:21:40'),
('105207a0-a28d-489e-a0bf-1a256689f498', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale b8b73bcb-4f97-42d6-a78e-e61ea99cc4c7 processed successfully for amount 864.92. Items: 1.', '{\"saleId\": \"b8b73bcb-4f97-42d6-a78e-e61ea99cc4c7\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 864.9175, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:46:06'),
('11189921-e3b7-4e32-aee4-17c5ee84d293', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 07:44:01'),
('114dfbdb-92f0-48ab-9a38-795f15ad133a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 14ff74f8-d700-4b7f-b118-2fb789011860) updated.', '{\"productId\": \"14ff74f8-d700-4b7f-b118-2fb789011860\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:36'),
('115015b1-98c1-4e6d-890c-81a806cbbf20', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:23:37'),
('122c6f77-2f30-4ab4-8709-4786bb6ec13b', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 12:48:37'),
('127dc35d-f9ea-44d8-9cdb-fa26c4c51d68', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:18:55'),
('135b0a2e-7804-44ef-8c70-81fcbf16cd4b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 9a6944e8-f637-4698-98c8-f4d8150bb874 processed successfully for amount 41.57. Items: 2.', '{\"saleId\": \"9a6944e8-f637-4698-98c8-f4d8150bb874\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": null, \"totalAmount\": 41.568, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 14:14:15'),
('13cb9114-86b8-47a8-99e1-6b5dfee4dd6d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59c5aa8d-33e1-4e3c-ad80-e5735bde8140 adjusted from 65 to 59. Change: -6.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 59, \"oldStock\": 65, \"productId\": \"59c5aa8d-33e1-4e3c-ad80-e5735bde8140\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -6}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:12:58'),
('13ed635f-f683-4ff1-a821-55ff3e17029d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 09:33:13'),
('141190d9-1a85-45b4-ae3b-704eb7ed0db0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-23 23:36:45'),
('14125c0e-0090-4149-87e2-684c10a9f41f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a95dbb16-3ac2-48c8-a9b0-5a6e6656c884 adjusted from 22 to 21. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 21, \"oldStock\": 22, \"productId\": \"a95dbb16-3ac2-48c8-a9b0-5a6e6656c884\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 21:51:15'),
('142adbad-fc5f-4e63-a542-e53ead30dddd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 15:44:53'),
('15426a54-2f91-4154-9219-4c851d9dc573', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-15 16:18:00'),
('15e99159-e9d0-4eea-a6fc-38f32f87b2de', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 08:29:47'),
('16eb937b-02a9-4325-8c88-cbe09313217c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 15:51:32'),
('174b792a-2902-48d5-935e-94804f0f3f56', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d adjusted from 145 to 144. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 144, \"oldStock\": 145, \"productId\": \"59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:54:51'),
('17a31c6f-d5a3-4f9e-b847-e944b1e69193', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID bcfc8606-b170-42a4-83ed-f1c74f2f8c61 adjusted from 39 to 37. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 37, \"oldStock\": 39, \"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:27:17'),
('190b0e8b-1790-4a2c-a88a-8efb501b9108', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"92bed9d4-36f9-11f0-8297-525400148990\", \"purchase_price\": \"5\", \"stock_quantity\": \"73\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:46:25'),
('196709fe-a32d-4725-be91-bc862e0f45d5', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 04:25:52'),
('1a197a37-1865-4c7c-8013-fbe77258bd86', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale aea258b8-991b-48d7-bd77-ffaa5c00472a processed successfully for amount 2.15. Items: 1.', '{\"saleId\": \"aea258b8-991b-48d7-bd77-ffaa5c00472a\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 2.154175, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:27:58'),
('1b1a9820-d2e4-4ebf-b61c-d662f4109365', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 627d7c55-921a-4916-8bf9-98f1bbc4ad08 adjusted from 93 to 91. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 91, \"oldStock\": 93, \"productId\": \"627d7c55-921a-4916-8bf9-98f1bbc4ad08\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:21:16'),
('1bbfa5bd-73d1-4123-9612-883d02dc8b9d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 15:45:15'),
('1c28e4d6-713e-4d0c-9ad7-f0c59f13997d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-24 02:15:32'),
('1c3647bc-d715-4159-b6c8-097d05638c34', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'cashier@zettaz.com', 'USER_LOGIN_SUCCESS', 'User cashier@zettaz.com logged in successfully.', '{\"email\": \"cashier@zettaz.com\", \"userId\": \"c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-16 08:39:37'),
('1cbb2ac5-aa6c-414d-a009-8b155ce2ae68', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 592de762-38ed-4640-9e6c-c32fd5096790 adjusted from 39 to 38. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 38, \"oldStock\": 39, \"productId\": \"592de762-38ed-4640-9e6c-c32fd5096790\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:36:05'),
('1ce425ea-9f64-4096-92d6-f426a6852b8a', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 18:50:40'),
('1d2fdddd-293e-490a-8d77-820b77072b59', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 08:52:57'),
('1d30e600-5180-4a15-be1c-a508faf76704', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: a5fd86a0-7b25-457b-9473-a33de24f4e13) updated.', '{\"productId\": \"a5fd86a0-7b25-457b-9473-a33de24f4e13\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 06:45:49'),
('1fd1a1aa-689c-403b-85b5-df3530bef128', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 52d30c66-4c71-46f6-93c0-e1c203df9914 processed successfully for amount 1602.10. Items: 2.', '{\"saleId\": \"52d30c66-4c71-46f6-93c0-e1c203df9914\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": \"a98644da-bc81-481b-9b1a-a9de5ee8468d\", \"totalAmount\": 1602.1, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:37:46'),
('207d5c13-3eba-4ca3-a5dc-37614cdaf8ce', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 12:39:16'),
('21095eab-04db-4b80-b556-ae707a2a4d0a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user manager@zettaz.com: Invalid password.', '{\"email\": \"manager@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:38:37'),
('21771477-e282-47ab-bc88-6f0a2a0185e5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 3ed848c0-905e-4423-9830-1cdb609e350a processed successfully for amount 8.44. Items: 1.', '{\"saleId\": \"3ed848c0-905e-4423-9830-1cdb609e350a\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 8.4435, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 15:50:29'),
('21af1d97-9a3c-474a-8176-bd165ae57692', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 06:33:42'),
('21cf52f2-19b4-4030-957b-d47d1bc1adb3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: a5fd86a0-7b25-457b-9473-a33de24f4e13) updated.', '{\"productId\": \"a5fd86a0-7b25-457b-9473-a33de24f4e13\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:36'),
('2221a506-9037-4e7c-8263-406fb254a01c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID bcfc8606-b170-42a4-83ed-f1c74f2f8c61 adjusted from 37 to 36. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 36, \"oldStock\": 37, \"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:27:38'),
('223ddd72-7128-4612-937c-3cfe872aa1f7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"image_url = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"null\", \"purchase_price\": \"5\", \"stock_quantity\": \"73\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 18:39:16'),
('22e9dcae-50b8-4c6c-958e-5c8de6478807', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"null\", \"purchase_price\": \"5\", \"stock_quantity\": \"73\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 06:05:48'),
('22f9aab6-aead-4624-a1f1-92a7c63480b2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 3a7c028e-35e1-4a8f-aa8f-426f9388fe23 processed successfully for amount 1729.84. Items: 1.', '{\"saleId\": \"3a7c028e-35e1-4a8f-aa8f-426f9388fe23\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1729.835, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 22:05:09'),
('23104ae1-dd25-4b42-9dd6-c3f9e674fe06', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_SUCCESS', 'User manager@zettaz.com logged in successfully.', '{\"email\": \"manager@zettaz.com\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 17:40:24'),
('2344dd55-0745-46b3-a022-216b248aaac1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 10:00:00'),
('23623997-c918-440d-b897-ee198b227ce9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 03:23:58'),
('236836a4-bc63-420b-8575-b4b08ce9ac92', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 09:19:11'),
('236bea26-e7c7-4f9e-af32-a301c0a04bfd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 04:45:40'),
('2437eb4d-2cdc-4097-816e-05a0040c623b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-15 18:04:40'),
('2443e89c-7291-4ba1-8ff8-0b82d3ad42f1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 11:19:37'),
('24626558-9b25-4804-9d6b-5d7a5ed574ee', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 8c1365fd-9852-4e35-b426-8f710b3a9f92 processed successfully for amount 981.61. Items: 2.', '{\"saleId\": \"8c1365fd-9852-4e35-b426-8f710b3a9f92\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": null, \"totalAmount\": 981.611, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:59:36'),
('24ada7c8-d26d-44fa-911c-088ea2980713', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 10:30:49');
INSERT INTO `user_activity_logs` (`id`, `tenant_id`, `user_id`, `username`, `action_type`, `description`, `details`, `ip_address`, `user_agent`, `timestamp`) VALUES
('2543e729-57d6-4902-ae61-85129ba21acb', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 00:05:46'),
('259f6424-8a8c-4401-9f28-e46766f9508d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-27 16:11:50'),
('265cce50-58f5-49af-95b6-1c6b8c9a4e6b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 05:40:26'),
('2673f5a9-01bb-491e-866a-69491bba3101', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-26 05:28:27'),
('272aae02-641a-492d-b1eb-0217703f01f6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 4c98f143-cc49-4f2d-bf93-6544b33d9e19 adjusted from 128 to 125. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 125, \"oldStock\": 128, \"productId\": \"4c98f143-cc49-4f2d-bf93-6544b33d9e19\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 11:42:33'),
('2783f6b5-3764-434b-8653-fb3c0befb872', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 11:18:49'),
('285e86dc-f239-441f-98d4-bc7c340d1827', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-26 06:03:27'),
('2875edf8-758d-49e1-94f1-528a6ccdcf98', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 5c08c1dc-5559-4470-8151-c026805899dd adjusted from 46 to 44. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 44, \"oldStock\": 46, \"productId\": \"5c08c1dc-5559-4470-8151-c026805899dd\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:21:38'),
('2909ca8c-b53c-49db-8f73-dcba0d085f84', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 187b21e6-639b-42b4-8199-28e1a2e49f9c adjusted from 26 to 22. Change: -4.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 22, \"oldStock\": 26, \"productId\": \"187b21e6-639b-42b4-8199-28e1a2e49f9c\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -4}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:48:42'),
('29634058-890b-4611-b99e-310550f8567c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale a6ebf1df-200c-4bdf-b51f-e64778f2a8cd processed successfully for amount 1347.71. Items: 1.', '{\"saleId\": \"a6ebf1df-200c-4bdf-b51f-e64778f2a8cd\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1347.7125, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:09:48'),
('29c257ca-b32e-49c4-972c-d8fad5b9333f', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 18:40:40'),
('2a2388e7-a3ca-4fc8-973a-12926f7daad7', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 04:23:31'),
('2a641335-67e3-479b-ad8e-30994f662a4b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: a5fd86a0-7b25-457b-9473-a33de24f4e13) updated.', '{\"productId\": \"a5fd86a0-7b25-457b-9473-a33de24f4e13\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"67bab738-0494-4e8d-8d5e-9d0a0f97c04f\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:51'),
('2b40f94e-dd5b-4b2a-bc80-0e10539e26ef', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-15 10:22:35'),
('2c898791-2dc2-4e11-bddd-d4e2cac806c2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: bcfc8606-b170-42a4-83ed-f1c74f2f8c61) updated.', '{\"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 10:00:06'),
('2ef887a0-5669-43bc-a388-a9759765a3da', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale b6ebaf8e-9edf-476b-937a-b62eb82bb505 processed successfully for amount 1905.15. Items: 6.', '{\"saleId\": \"b6ebaf8e-9edf-476b-937a-b62eb82bb505\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 6, \"customerId\": null, \"totalAmount\": 1905.145875, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 16:19:08'),
('2f39c213-713b-4639-b074-eb870b2c5e5a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 06:43:50'),
('2f6cf84a-1544-4176-9f39-a87ebb3e7b44', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-16 08:39:06'),
('2f8590b7-bd68-4a7a-974f-7bf440f019da', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-26 06:07:53'),
('3005ff07-f088-4088-992a-9d1ba989a3a6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 056250b8-90d2-41e8-b9c7-1a866658ee7f adjusted from 3 to 2. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 2, \"oldStock\": 3, \"productId\": \"056250b8-90d2-41e8-b9c7-1a866658ee7f\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:28:30'),
('300c2ea2-b77a-462f-84f0-2ea562d3d73f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale b4349a32-d394-494a-a0bb-e175dbb8dc56 processed successfully for amount 38.54. Items: 4.', '{\"saleId\": \"b4349a32-d394-494a-a0bb-e175dbb8dc56\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 4, \"customerId\": \"083e0734-5aed-42e3-b978-c5a3d524c9e4\", \"totalAmount\": 38.537, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:48:41'),
('31972ae5-d812-41a3-a43d-edfc5ada7659', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 90 to 80. Change: -10.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 80, \"oldStock\": 90, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -10}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:11:28'),
('32960e24-233a-4558-82f4-fa73a3697735', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user manager@zettaz.com: Invalid password.', '{\"email\": \"manager@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:33:56'),
('32b76cb8-49d7-4b37-bb9f-3e2e25ec0cf3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user manager@zettaz.com: Invalid password.', '{\"email\": \"manager@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:30:19'),
('33a64a26-cbf3-477f-ba34-0a67b2010b7e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 11:31:21'),
('33bb18d8-0da4-4a56-82f4-1df1f2f5caf9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 02:11:17'),
('33e71cad-34bf-48b5-9091-4367241ebd57', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Dove Pink Soap \" (ID: bcfc8606-b170-42a4-83ed-f1c74f2f8c61) updated.', '{\"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"barcode = ?\", \"sku = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"ZET-KIL258\", \"name\": \"Dove Pink Soap \", \"price\": \"5\", \"barcode\": \"0318992176390\", \"imageUrl\": \"/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748261926588-364199522.webp\", \"is_active\": \"true\", \"category_id\": \"979b1b2d-e7dd-4e29-80d0-27eb7f935513\", \"description\": \"dove soap\", \"tax_class_id\": \"92be2844-36f9-11f0-8297-525400148990\", \"purchase_price\": \"2\", \"stock_quantity\": \"31\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 11:48:05'),
('33fdddb5-5ac9-4b1e-903b-632cff9f08e6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-24 05:34:27'),
('34a960b2-9c89-46d4-9299-0f48d820a89b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'cashier@zettaz.com', 'USER_LOGIN_SUCCESS', 'User cashier@zettaz.com logged in successfully.', '{\"email\": \"cashier@zettaz.com\", \"userId\": \"c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 17:39:54'),
('34c9a32c-8bec-4c44-b88b-b63e49fdedab', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 09:20:36'),
('34ede7f6-f5fe-4fdc-8f12-bad404b3ddf1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 23:12:13'),
('34fbeebe-24ea-4839-9ed5-3c86c7b0ba46', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:37:02'),
('3545d769-4017-462a-83ad-a023276fdfa0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 07:17:06'),
('35596897-938f-4920-b3ab-17c1cdedaf81', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 04:15:49'),
('35e0e9f2-cd44-48ca-8cc4-8ce9fc512063', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 3dcedd3f-0c34-44f5-b8da-08e372b219cf adjusted from 35 to 34. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 34, \"oldStock\": 35, \"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:53:01'),
('368ce904-5dcb-4f85-9fb9-89c950f8e90f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 02:05:49'),
('36ba7856-2494-496d-ba3e-a5f4b7935490', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 17:24:54'),
('37489681-a386-410a-bfb0-c9a4f1d54fcb', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:15:08'),
('376c63cd-0e2f-4345-90e9-31f1976f0fa1', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 04:45:06'),
('37875769-8a9b-478e-84f3-add279d70b8a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 08:07:54'),
('37c63438-0f64-4066-9fb2-30debdd1bebd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 05:59:51'),
('37ebd92f-6eb8-4834-9cce-141aee2040e8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-26 06:11:35'),
('387ca48c-8c0a-41c4-83cb-697ad02a614b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59c5aa8d-33e1-4e3c-ad80-e5735bde8140 adjusted from 59 to 57. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 57, \"oldStock\": 59, \"productId\": \"59c5aa8d-33e1-4e3c-ad80-e5735bde8140\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:20:54'),
('3904dc27-735c-4a6f-8d55-08dc5a0c47d3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 07:27:46'),
('394a5617-621c-4e93-aaf8-844b57a16833', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 03:29:39'),
('3a426609-6e2e-4a6c-a31b-75a79aa9a83b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 3dcedd3f-0c34-44f5-b8da-08e372b219cf adjusted from 33 to 32. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 32, \"oldStock\": 33, \"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:04:12'),
('3b01dc50-ada4-48be-916f-05db80075a04', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 06:23:31'),
('3b76ea14-8979-405c-92c4-deaa21edccf0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 11:19:39'),
('3d5fac9d-b636-4ac4-a4c8-a454142cfe1a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-25 02:56:06'),
('3dde600a-ccd6-4eea-90ca-166a9b21168a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale c0b2f1df-647d-4120-ab8a-a7bdcea02d3e processed successfully for amount 3288.64. Items: 3.', '{\"saleId\": \"c0b2f1df-647d-4120-ab8a-a7bdcea02d3e\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 3, \"customerId\": null, \"totalAmount\": 3288.635, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:52:59'),
('3df8c690-f6f7-4174-9f03-01383ac0f6a4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-24 04:23:01'),
('3e02688a-6ada-4966-92c0-8dbbe6693a5b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 08:30:32'),
('3e11d063-2003-47e6-b3cd-2fed6045ea30', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"92be2844-36f9-11f0-8297-525400148990\", \"purchase_price\": \"5\", \"stock_quantity\": \"74\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 11:29:50'),
('3f61f242-fdb8-4a60-b135-9a628529f2b6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 592de762-38ed-4640-9e6c-c32fd5096790 adjusted from 45 to 41. Change: -4.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 41, \"oldStock\": 45, \"productId\": \"592de762-38ed-4640-9e6c-c32fd5096790\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -4}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:06:26'),
('3f9e3686-41c5-4e3e-8035-8c5acb967eb0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 11:20:36'),
('405cdef6-a4b2-4874-b3f3-6101079b1806', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 02:02:18'),
('408242ff-c38c-4acf-acf0-3411cc6615fb', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: ed2f4421-fca0-4827-b7c3-d814f46252c6) updated.', '{\"productId\": \"ed2f4421-fca0-4827-b7c3-d814f46252c6\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 06:45:49'),
('40e041c5-eaf2-4e08-bfdb-613e57c62f9c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"purchase_price\": \"5\", \"stock_quantity\": \"74\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 10:09:38'),
('42d30909-e861-45ae-ad61-367b66293c8c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 187b21e6-639b-42b4-8199-28e1a2e49f9c) updated.', '{\"productId\": \"187b21e6-639b-42b4-8199-28e1a2e49f9c\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"1e893ad2-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 09:58:41'),
('4356a941-b2fe-41bc-b897-8b811b0ab7fa', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:54:47'),
('44522d1d-3eb9-47da-99ad-c43eaa0bc2a0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 01:38:53'),
('44684efe-a0f4-4c11-b0be-ae5242aa2eed', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 09:18:56'),
('44d22263-dbd2-4dac-b0d1-8afd78a80be9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 04:07:38'),
('452ba052-7e42-498e-953a-c9f2ee9be978', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 1cabe080-11f1-4869-b82f-97363dabd495 processed successfully for amount 8151.23. Items: 2.', '{\"saleId\": \"1cabe080-11f1-4869-b82f-97363dabd495\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": null, \"totalAmount\": 8151.225, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:33:56'),
('45757216-d241-481d-a8d3-6e73fb0a0591', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-16 08:39:46'),
('45c5c687-e5db-485c-b3b1-a4fe80b6662d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b6860c69-6d3e-456c-a25f-a4bc09bd23c4 adjusted from 96 to 93. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 93, \"oldStock\": 96, \"productId\": \"b6860c69-6d3e-456c-a25f-a4bc09bd23c4\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:48:42'),
('45efbbd6-e97e-4092-a180-929f16d78247', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 09:05:39'),
('468052e3-1808-4b38-ac3a-286e6b809f4a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 08:29:25'),
('46900b67-b312-471d-bdfb-c8df40208808', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 07:36:53'),
('46e287cf-f675-45fa-9602-443aea687697', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:37:10'),
('47024ece-260f-48cc-8962-fa377061a8ae', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-26 06:18:02'),
('472f7e56-370f-4bcf-a125-75336554de99', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b6860c69-6d3e-456c-a25f-a4bc09bd23c4 adjusted from 100 to 96. Change: -4.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 96, \"oldStock\": 100, \"productId\": \"b6860c69-6d3e-456c-a25f-a4bc09bd23c4\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -4}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:41:47'),
('47c4e6ae-b29d-4e20-aa95-c2a459d9441b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 14ff74f8-d700-4b7f-b118-2fb789011860) updated.', '{\"productId\": \"14ff74f8-d700-4b7f-b118-2fb789011860\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 10:10:36'),
('47d56b5f-5e62-4307-a183-15431e4ec7ec', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 56b60d92-35a1-4b1d-9be0-514779568b40) updated.', '{\"productId\": \"56b60d92-35a1-4b1d-9be0-514779568b40\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"67bab738-0494-4e8d-8d5e-9d0a0f97c04f\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:51'),
('47d81188-be59-4c14-9dea-f169e1e37cbd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 187b21e6-639b-42b4-8199-28e1a2e49f9c) updated.', '{\"productId\": \"187b21e6-639b-42b4-8199-28e1a2e49f9c\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 06:45:49'),
('484024c9-e10d-4bda-8b2d-a660252c3f86', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-14 05:04:36'),
('4853437c-8916-4cdd-876e-0600e3956dd2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 101 to 98. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 98, \"oldStock\": 101, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 14:14:16'),
('48647f75-dc4d-4f9f-8e73-46bf774cc387', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b89be53e-f6b7-4005-9f32-9e890325c658 adjusted from 135 to 134. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 134, \"oldStock\": 135, \"productId\": \"b89be53e-f6b7-4005-9f32-9e890325c658\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:54:48'),
('48971251-2188-435c-b4d0-9ecd61b2d4bc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b193d1a1-94f6-405a-b13f-15a1d594f403 adjusted from 159 to 152. Change: -7.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 152, \"oldStock\": 159, \"productId\": \"b193d1a1-94f6-405a-b13f-15a1d594f403\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -7}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 16:19:09'),
('48fccf96-d697-4ae2-9352-7fb7aef62b81', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-25 03:09:39'),
('4907cf88-4204-4162-82b0-bd18724add88', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 00:23:21'),
('49930589-3843-46d7-ad59-6ee55532ebec', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 01:29:45'),
('49d99649-c9bc-4bda-8ad5-5b8c7b6419fe', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_SUCCESS', 'User manager@zettaz.com logged in successfully.', '{\"role\": \"manager\", \"email\": \"manager@zettaz.com\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:56:11'),
('4a5627c4-331a-4d68-8c7e-9d99504710fc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale c0535628-88d0-434f-9f11-01ca242f639c processed successfully for amount 68.13. Items: 4.', '{\"saleId\": \"c0535628-88d0-434f-9f11-01ca242f639c\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 4, \"customerId\": \"5f9d994d-7aa3-4f0d-b30e-f4264eed54e3\", \"totalAmount\": 68.13255, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:06:25'),
('4b6420da-6897-4bf9-a4cb-c9c58140ee28', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 03:15:06'),
('4b6c5b7c-5390-4f4b-a171-82b33ccb1b75', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-10 06:31:41'),
('4b8dab35-fe0c-4f01-b595-4c8635be0b09', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale dc596ff6-e0b6-49b8-a058-f0be03498df1 processed successfully for amount 1347.71. Items: 1.', '{\"saleId\": \"dc596ff6-e0b6-49b8-a058-f0be03498df1\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1347.7125, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:00:07'),
('4b9eb495-aa4b-4899-ac61-544db0a4c43a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 06:19:26'),
('4be7e565-ae1b-4851-b5f2-e8c65de30177', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:48:46'),
('4c84c84e-b357-44c9-a779-fe44d6a58a81', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 15:48:50'),
('4e4c65f7-789d-4ba2-b550-14861cf6b3a6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 41a2d61d-ba3e-4116-ab9c-55d18549d19d processed successfully for amount 1596.69. Items: 1.', '{\"saleId\": \"41a2d61d-ba3e-4116-ab9c-55d18549d19d\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1596.6875, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:04:12'),
('4e928fb4-a1a4-4347-8cee-e870349e358b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-26 14:46:45');
INSERT INTO `user_activity_logs` (`id`, `tenant_id`, `user_id`, `username`, `action_type`, `description`, `details`, `ip_address`, `user_agent`, `timestamp`) VALUES
('4eb353c9-5a54-4a61-bd58-3f09a1392b30', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-26 06:22:57'),
('4ebc5346-fd8c-4ae2-9c5b-0666b87ac84a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: a5fd86a0-7b25-457b-9473-a33de24f4e13) updated.', '{\"productId\": \"a5fd86a0-7b25-457b-9473-a33de24f4e13\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"0e88cf84-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 20:52:23'),
('4f2b8f3c-bd75-4237-a6c5-b43f6a6c5aad', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-23 06:53:14'),
('4ffa4cab-6467-412a-a965-4cd532c96a20', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:15:37'),
('511fd428-a5e1-4ed8-ae79-9f480c08bf58', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"92bed9d4-36f9-11f0-8297-525400148990\", \"purchase_price\": \"5\", \"stock_quantity\": \"73\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:45:55'),
('51f70ffa-8123-489c-8bda-35400a82e406', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 11:29:21'),
('52b956ff-721f-48d6-88c7-3e5bab39d1c0', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 18:47:37'),
('52bce998-1b40-4a53-abb4-dd595c8cf926', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 05:19:25'),
('52f95437-6f03-4077-8c9e-951f7bf6f13a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale f5d90868-a1ae-4a8a-82c9-8f9c7f387137 processed successfully for amount 1831.43. Items: 3.', '{\"saleId\": \"f5d90868-a1ae-4a8a-82c9-8f9c7f387137\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 3, \"customerId\": \"083e0734-5aed-42e3-b978-c5a3d524c9e4\", \"totalAmount\": 1831.427625, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:54:47'),
('5367f7e5-9153-4619-b62c-5d5fb6b7d58c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale c3f863cf-316e-4bf3-8cf2-3ed72b963760 processed successfully for amount 5.41. Items: 1.', '{\"saleId\": \"c3f863cf-316e-4bf3-8cf2-3ed72b963760\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 5.4125, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:52:26'),
('53fe69d3-7d0c-4d4a-956c-52dc9a19536c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 55f2568f-96cf-46a8-b156-a633be5b591c adjusted from 9 to 8. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 8, \"oldStock\": 9, \"productId\": \"55f2568f-96cf-46a8-b156-a633be5b591c\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 22:19:07'),
('547f9deb-2ba5-4363-b5eb-64aa08c6f93c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 13:34:57'),
('5633f64f-c182-4a08-bcc9-0e5b5f038e39', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 08:43:02'),
('5660405b-4e8b-4aa0-be62-d76a543c23ef', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 377ecc2b-ba34-445b-bbd2-b0527b4718e6 adjusted from 94 to 74. Change: -20.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 74, \"oldStock\": 94, \"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -20}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:01:02'),
('56eb18df-b639-4141-ae20-77c87b2d9dfe', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-12 06:06:18'),
('5739a636-d1dc-4ccd-ab62-104801c7975f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 01bc04ac-c63f-484f-8488-4c4ab978e2af processed successfully for amount 1717.39. Items: 3.', '{\"saleId\": \"01bc04ac-c63f-484f-8488-4c4ab978e2af\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 3, \"customerId\": \"ecf5b65f-e11f-4dcb-91df-cc5f90697c30\", \"totalAmount\": 1717.38625, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 09:32:00'),
('57b8f1a6-aae1-4199-befe-a97e63aacb7b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID bcfc8606-b170-42a4-83ed-f1c74f2f8c61 adjusted from 35 to 34. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 34, \"oldStock\": 35, \"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:24:59'),
('57c7352f-5295-4aa7-946c-505847529a5a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 3dcedd3f-0c34-44f5-b8da-08e372b219cf adjusted from 32 to 31. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 31, \"oldStock\": 32, \"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:42:33'),
('57f0af14-01c3-45b0-941a-8878bf20e702', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 10:45:47'),
('5877ec76-4e9f-4288-a17f-6be533a72927', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID f4d52a04-b5d5-49dc-8aa4-d01947ee16d9 adjusted from 20 to 17. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 17, \"oldStock\": 20, \"productId\": \"f4d52a04-b5d5-49dc-8aa4-d01947ee16d9\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 15:47:03'),
('5a3a7536-8c7c-40ba-a5ec-b6057b4640fc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 17:40:39'),
('5a3c4dd9-f890-4dc6-be90-888766fa7d55', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-26 05:58:29'),
('5a6eaec5-c82e-4acb-8d0f-e7a290202dfc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 08:32:12'),
('5accda92-8de3-40b2-925a-b7da719b3149', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-15 12:06:08'),
('5b29fe2b-f966-48db-8e90-84353c5fc43e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 640 to 638. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 638, \"oldStock\": 640, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:21:38'),
('5b33149f-2567-4d4a-9b72-2229dc21fe3d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 13:51:03'),
('5bf99fb7-a03a-4b3b-8c65-6c9bf1add8c6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-23 23:26:49'),
('5c6b7b7b-1fd0-4ad0-b7ab-24101fbecec5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 11:19:38'),
('5c8b2bf6-c43c-4651-8636-b7b9549c2749', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 10:50:50'),
('5d340d80-d642-430a-81ae-2d844f1f4dd8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user manager@zettaz.com: Invalid password.', '{\"email\": \"manager@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:50:00'),
('5d5b4d44-1f4b-41f4-824a-f2a504d39f8d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 7b869ace-96c7-4252-8939-bc16b602791e processed successfully for amount 432.46. Items: 1.', '{\"saleId\": \"7b869ace-96c7-4252-8939-bc16b602791e\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": \"7acc70a5-8372-425f-a28c-adb7c239457e\", \"totalAmount\": 432.45875, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:07:19'),
('5e5af2f5-a24d-45e0-b7a9-f624235266c4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 04:25:46'),
('5eeb3939-5875-4983-80e4-8c16ed4425ee', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:33:46'),
('5f40dd1e-6eb0-499a-bfb6-4c89d3d25143', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-25 03:02:42'),
('5f644a62-90bf-46f7-ae31-cae213aa312c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 06:56:15'),
('5fb87cef-231a-4902-970e-1ce2443d8171', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 22337686-b156-430a-91fe-f4e26a7fba00 processed successfully for amount 5.68. Items: 1.', '{\"saleId\": \"22337686-b156-430a-91fe-f4e26a7fba00\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 5.683125, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 11:20:19'),
('6037ec35-a889-4916-b311-8a06a2f538e3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:51:10'),
('604f7eda-12d6-4f8c-aead-599f0b1fbb70', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 18:54:10'),
('611007a8-4e42-40ef-b092-943e939701ad', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 06:00:44'),
('61af5fd6-5a5f-4e90-8860-5ed08c8a23e3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a0cff669-2621-4b55-aaac-88e81474710a adjusted from 30 to 24. Change: -6.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 24, \"oldStock\": 30, \"productId\": \"a0cff669-2621-4b55-aaac-88e81474710a\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -6}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:04:43'),
('61cdcd41-0f48-4833-b191-3e620f4de719', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6 adjusted from 99 to 96. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 96, \"oldStock\": 99, \"productId\": \"3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:41:47'),
('629c00b2-40f1-4605-b231-5536268110f0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 56c22eee-4c83-4fd1-aed5-07d3c3fba6b1 adjusted from 74 to 71. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 71, \"oldStock\": 74, \"productId\": \"56c22eee-4c83-4fd1-aed5-07d3c3fba6b1\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:06:26'),
('62cc5473-0475-4dba-9d23-2270a9231748', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_CREATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) created.', '{\"sku\": null, \"price\": 10, \"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"categoryId\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"productName\": \"Coffee Cup\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 10:24:59'),
('62f893ba-d249-4dd3-86a6-75d9df9ba7a4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-25 02:52:16'),
('62f9e4bd-3856-42bd-a382-bd96f51ce16c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID e03dc952-7f98-421d-924b-4f819abe666e adjusted from 493 to 488. Change: -5.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 488, \"oldStock\": 493, \"productId\": \"e03dc952-7f98-421d-924b-4f819abe666e\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -5}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 16:19:09'),
('63fbc6a1-19b2-4fe6-ab69-cde28924fcbd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 11:18:20'),
('64160915-1547-40a2-a0a2-6a6153ce239f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 22:59:42'),
('646d9bbb-338b-44af-bff2-22c3d8ede0ab', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 08:46:48'),
('65127b32-a050-40f6-9a05-b64600848a51', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: ed2f4421-fca0-4827-b7c3-d814f46252c6) updated.', '{\"productId\": \"ed2f4421-fca0-4827-b7c3-d814f46252c6\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"67bab738-0494-4e8d-8d5e-9d0a0f97c04f\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:51'),
('6566ca26-e16c-4a29-8584-830a5638cbba', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-26 07:07:15'),
('65f22918-2577-42cf-a1f2-e58371d4e422', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'cashier@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user cashier@zettaz.com: Invalid password.', '{\"email\": \"cashier@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:48:37'),
('66174c8a-c5ee-49fa-aa54-e9d6ac627b20', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 15:44:35'),
('66876c89-da47-4ea8-976a-667f022afb82', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 9ffc1ad1-8238-40b9-a5c7-a8620a094ac7 processed successfully for amount 281.45. Items: 1.', '{\"saleId\": \"9ffc1ad1-8238-40b9-a5c7-a8620a094ac7\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 281.45, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 10:59:59'),
('671d3643-702d-4993-b0e9-55281f9dd35c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 03:16:34'),
('6842a272-c070-42cc-bd63-ed60120e6a1a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-26 06:54:52'),
('68add6b4-9c60-46cc-a43f-5ec30626021e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:43:16'),
('68b4074f-3842-459b-a502-645d576de574', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: a5fd86a0-7b25-457b-9473-a33de24f4e13) updated.', '{\"productId\": \"a5fd86a0-7b25-457b-9473-a33de24f4e13\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 10:10:36'),
('696850a7-3899-4cd6-9346-1f4ef253cb08', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user manager@zettaz.com: Invalid password.', '{\"email\": \"manager@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:33:55'),
('698a6656-e1bf-44d2-a177-52ebac01f7b6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 638 to 635. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 635, \"oldStock\": 638, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:30:16'),
('69f523e6-9c94-4ca5-a1c3-d17529077c28', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 52832c24-bb8e-4c62-8318-911b8b88e984 processed successfully for amount 8.44. Items: 1.', '{\"saleId\": \"52832c24-bb8e-4c62-8318-911b8b88e984\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 8.4435, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 07:40:49'),
('6ac65416-27d6-4e86-9793-9779ce4dc448', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 06:39:30'),
('6c9342b2-75c4-45c7-b469-07c37322b824', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 627d7c55-921a-4916-8bf9-98f1bbc4ad08 adjusted from 91 to 71. Change: -20.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 71, \"oldStock\": 91, \"productId\": \"627d7c55-921a-4916-8bf9-98f1bbc4ad08\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -20}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 10:59:22'),
('6cbed5e1-b85e-42ee-a99b-7a23ffd0425f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 98 to 97. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 97, \"oldStock\": 98, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:27:02'),
('6ce49c6c-3cb5-4bdc-b5ee-0dc44b31ea0a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-26 05:35:27'),
('6d5c7116-30ce-4740-ba32-a9786e8d03bf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale a554ea47-1e3b-4c34-bf7f-fb8d6af52b1a processed successfully for amount 1257.87. Items: 2.', '{\"saleId\": \"a554ea47-1e3b-4c34-bf7f-fb8d6af52b1a\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": null, \"totalAmount\": 1257.865, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 21:51:14'),
('6db7112b-7b55-4ecb-bac0-163e963ab57e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 03:17:09'),
('6e173e21-1c3c-435d-9d9b-947e356d5bc7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:33:08'),
('6e94ff41-ce2e-4419-9f82-72dfd00ea18e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b89be53e-f6b7-4005-9f32-9e890325c658 adjusted from 137 to 136. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 136, \"oldStock\": 137, \"productId\": \"b89be53e-f6b7-4005-9f32-9e890325c658\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 09:32:00'),
('6eb755c3-83a0-4599-8360-9109db858c64', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-24 04:08:14'),
('6f8c7ecc-424b-421b-8397-89096a4ffbcd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d adjusted from 142 to 141. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 141, \"oldStock\": 142, \"productId\": \"59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:07:20'),
('70bc5d78-4f08-473d-ad50-c110e23dc772', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b89be53e-f6b7-4005-9f32-9e890325c658 adjusted from 136 to 135. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 135, \"oldStock\": 136, \"productId\": \"b89be53e-f6b7-4005-9f32-9e890325c658\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:28:30'),
('710a3bc6-6fa0-411e-b537-c5e509ee4afb', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d adjusted from 143 to 142. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 142, \"oldStock\": 143, \"productId\": \"59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:46:07'),
('71ae35c2-0ed5-49a1-9b1a-31c616492045', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 14ff74f8-d700-4b7f-b118-2fb789011860) updated.', '{\"productId\": \"14ff74f8-d700-4b7f-b118-2fb789011860\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 06:45:49'),
('721c26fc-f520-4855-933e-79db1a3aebf9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 06:24:13'),
('73441d59-8308-4c10-9814-c75654a1d44b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 10:44:12'),
('738a764a-daeb-4266-a84b-52e630709751', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: ed2f4421-fca0-4827-b7c3-d814f46252c6) updated.', '{\"productId\": \"ed2f4421-fca0-4827-b7c3-d814f46252c6\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:36'),
('73bfd161-ac9b-442c-a4f8-b0c70050a1e6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 9c6458f3-20de-4d18-861c-38a24b68b309 adjusted from 100 to 98. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 98, \"oldStock\": 100, \"productId\": \"9c6458f3-20de-4d18-861c-38a24b68b309\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:20:15'),
('73dee567-8ef9-42d7-b62f-add7b2e79ff9', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 187b21e6-639b-42b4-8199-28e1a2e49f9c) updated.', '{\"productId\": \"187b21e6-639b-42b4-8199-28e1a2e49f9c\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:36'),
('73e82950-a8d3-4e8f-a8bc-41068d2340d4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID db11baa7-4d6c-4b88-b8e5-45cf40a1a8d8 adjusted from 1 to -4. Change: -5.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": -4, \"oldStock\": 1, \"productId\": \"db11baa7-4d6c-4b88-b8e5-45cf40a1a8d8\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -5}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 16:19:09'),
('73e8822b-153f-4561-a68f-99e5f363310e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 14ff74f8-d700-4b7f-b118-2fb789011860) updated.', '{\"productId\": \"14ff74f8-d700-4b7f-b118-2fb789011860\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"0e88cf84-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 20:52:23'),
('7529facd-e087-447b-ba4a-e22c53f61841', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 642 to 640. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 640, \"oldStock\": 642, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:20:55'),
('7560ce93-65e7-4ff9-82d4-168dd4ffe18a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'cashier@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user cashier@zettaz.com: Invalid password.', '{\"email\": \"cashier@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:49:55'),
('76504ca7-6734-43e4-adda-20965e87dd18', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 720d1457-e4e4-4f64-8d55-6649e861d1ac processed successfully for amount 1327.14. Items: 4.', '{\"saleId\": \"720d1457-e4e4-4f64-8d55-6649e861d1ac\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 4, \"customerId\": \"ecf5b65f-e11f-4dcb-91df-cc5f90697c30\", \"totalAmount\": 1327.145, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:27:37'),
('779aa51c-82b6-42d4-bfc4-f78fd0bec6bf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'cashier@zettaz.com', 'USER_LOGIN_SUCCESS', 'User cashier@zettaz.com logged in successfully.', '{\"role\": \"cashier\", \"email\": \"cashier@zettaz.com\", \"userId\": \"c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:57:19'),
('78460620-0e28-4904-8e0b-6739c62b0f87', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: bcfc8606-b170-42a4-83ed-f1c74f2f8c61) updated.', '{\"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 06:45:48'),
('7866b472-0c55-4ca4-adef-d40bafd3185b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-16 08:38:30'),
('79f97630-a9c7-44b4-a734-a7ad89bb161b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 16:39:29'),
('7a15b95d-94b9-4843-8797-39f570305f7f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 04:44:16'),
('7a2530da-d9b7-4dae-a91a-996cf1d59bbd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-23 12:16:28'),
('7a2e11cc-c372-453c-9322-050cccade6a0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 3fd9a1fd-f306-4fba-bca0-da40bf293251 processed successfully for amount 1081.42. Items: 1.', '{\"saleId\": \"3fd9a1fd-f306-4fba-bca0-da40bf293251\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1081.4175, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 14:30:14');
INSERT INTO `user_activity_logs` (`id`, `tenant_id`, `user_id`, `username`, `action_type`, `description`, `details`, `ip_address`, `user_agent`, `timestamp`) VALUES
('7b9bd474-31ba-40b4-8a97-ee14b045b120', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 5c08c1dc-5559-4470-8151-c026805899dd adjusted from 49 to 46. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 46, \"oldStock\": 49, \"productId\": \"5c08c1dc-5559-4470-8151-c026805899dd\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:20:54'),
('7bc60d27-a77a-4349-b319-b5bf97efc7ca', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a95dbb16-3ac2-48c8-a9b0-5a6e6656c884 adjusted from 20 to 19. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 19, \"oldStock\": 20, \"productId\": \"a95dbb16-3ac2-48c8-a9b0-5a6e6656c884\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:53:00'),
('7c471b66-7245-4178-a86a-85c53539312f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 03:34:50'),
('7c9db05f-43c6-4281-8c2c-46dd225a1000', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale c9bb8168-dd72-4026-a10b-55f5ade425ac processed successfully for amount 216.50. Items: 1.', '{\"saleId\": \"c9bb8168-dd72-4026-a10b-55f5ade425ac\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 216.5, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:01:01'),
('7d25aa7e-b30f-4367-a9c6-5d3d688b7c79', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-17 14:32:11'),
('7daa6cae-e299-419d-8a15-98cafd3f8ba2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-15 18:03:56'),
('7e167fed-5bd8-4bcb-a529-eb745c9ff3d1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 650 to 645. Change: -5.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 645, \"oldStock\": 650, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -5}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 08:27:10'),
('7f6d518b-8b28-45b1-817b-bdc2241e6668', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 01:56:06'),
('7fb67cf4-d74f-418f-98cc-be9e8724ab70', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 03:35:43'),
('7fc57824-83f5-48d6-9276-36e69b2ed983', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 04:36:51'),
('8158d2d2-757c-4d2c-95bd-f5c32c04ab6c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 97 to 96. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 96, \"oldStock\": 97, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:59:37'),
('81c33426-4820-4245-81b5-2b8eab817654', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 621 to 620. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 620, \"oldStock\": 621, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:18:04'),
('82e1e1fb-25de-4954-b7be-a3bc26b9cdc0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:23:45'),
('82e6a1ff-fc85-48cf-a7d6-b85b8afb37fc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 56b60d92-35a1-4b1d-9be0-514779568b40) updated.', '{\"productId\": \"56b60d92-35a1-4b1d-9be0-514779568b40\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"0e88cf84-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 20:52:23'),
('83bcce95-bc7e-4ccb-82b9-e01776854e28', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"92bed9d4-36f9-11f0-8297-525400148990\", \"purchase_price\": \"5\", \"stock_quantity\": \"73\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:54:42'),
('845e919e-395f-416f-9994-dc19cb392bca', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"92be2844-36f9-11f0-8297-525400148990\", \"purchase_price\": \"5\", \"stock_quantity\": \"74\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 10:29:45'),
('845f1d68-5344-449d-babb-f921da3d4ccb', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 56b60d92-35a1-4b1d-9be0-514779568b40) updated.', '{\"productId\": \"56b60d92-35a1-4b1d-9be0-514779568b40\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 10:10:36'),
('849dd445-389b-4edf-ac1b-698ecab2ff0d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: bcfc8606-b170-42a4-83ed-f1c74f2f8c61) updated.', '{\"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"1e893ad2-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 09:58:41'),
('850e84d3-c70b-45d4-a016-cc9ea6e8c921', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"92bed9d4-36f9-11f0-8297-525400148990\", \"purchase_price\": \"5\", \"stock_quantity\": \"74\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 10:33:25'),
('86d3457c-a565-4b92-bd61-2e8658ed27b6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 15:57:08'),
('88136515-7481-4e0c-82ec-a6a03f240305', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: b193d1a1-94f6-405a-b13f-15a1d594f403) updated.', '{\"productId\": \"b193d1a1-94f6-405a-b13f-15a1d594f403\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"67bab738-0494-4e8d-8d5e-9d0a0f97c04f\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:51'),
('883c847b-9271-4187-ae58-973525449174', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-26 05:37:18'),
('884fc5f6-19b1-4a0c-a95f-79a1b153fdf3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-12 11:04:04'),
('88b75378-81fd-4b9b-9e1e-764608d1479b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 623 to 622. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 622, \"oldStock\": 623, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:00:08'),
('88f05b37-f06b-4880-a005-591c8ae9b575', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 13:10:50'),
('89242b0d-50a8-4b96-9b30-de16171d0a4b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 01:31:20'),
('892c24d2-0848-4993-b5c0-d2913888362b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 04:21:42'),
('8987c824-4c8e-4994-a551-5c7e51d5cedd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: bcfc8606-b170-42a4-83ed-f1c74f2f8c61) updated.', '{\"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"0e88cf84-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 20:52:23'),
('8989e3da-a253-49c2-9338-ee087eca8022', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 632 to 626. Change: -6.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 626, \"oldStock\": 632, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -6}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:33:57'),
('89b8ccc4-d10d-48db-a424-c4458276980c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 1273a32e-3197-42cb-87e9-d975866243c3 processed successfully for amount 1943.47. Items: 2.', '{\"saleId\": \"1273a32e-3197-42cb-87e9-d975866243c3\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": \"503e4102-68a7-46e0-a4c9-e798b344ca7b\", \"totalAmount\": 1943.466375, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 14:31:26'),
('8abe2315-e651-4273-82f9-bca4c1770c28', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:40:48'),
('8ae0e982-f441-436a-bf90-d181f1dd6eb2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 14ff74f8-d700-4b7f-b118-2fb789011860) updated.', '{\"productId\": \"14ff74f8-d700-4b7f-b118-2fb789011860\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"1e893ad2-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 09:58:41'),
('8b164bc7-0765-42e1-b88c-521451bb7901', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-24 05:17:56'),
('8bec9244-63c3-467f-864b-2229d9ad74fc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID e03dc952-7f98-421d-924b-4f819abe666e adjusted from 485 to 484. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 484, \"oldStock\": 485, \"productId\": \"e03dc952-7f98-421d-924b-4f819abe666e\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:36:20'),
('8bf7b518-d53b-4f46-916c-7edad884b9bc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-12 14:53:28'),
('8caa2fdf-614d-408c-a292-88963efae8d1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 05:48:30'),
('8d09eba6-69f0-4dbe-9096-5c0fef5809be', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 55f2568f-96cf-46a8-b156-a633be5b591c adjusted from 8 to 7. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 7, \"oldStock\": 8, \"productId\": \"55f2568f-96cf-46a8-b156-a633be5b591c\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:53:02'),
('8da911e9-1fa8-4d16-8988-f57e44c5a23d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 03:35:09'),
('8e749522-feca-4523-93fe-10885d071fd3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: b193d1a1-94f6-405a-b13f-15a1d594f403) updated.', '{\"productId\": \"b193d1a1-94f6-405a-b13f-15a1d594f403\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"0e88cf84-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 20:52:23'),
('8e8a4ab1-ca6e-4c52-a923-c298ae9b30d7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale f67c72fa-1f6a-4d94-a679-a2f55cff8e4f processed successfully for amount 5.41. Items: 1.', '{\"saleId\": \"f67c72fa-1f6a-4d94-a679-a2f55cff8e4f\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 5.4125, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 11:34:08'),
('8e9e72e6-07bb-46b8-8b18-7e2f8e6f526d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 07:23:26'),
('8ea1ecc1-cf9e-4282-838a-15645ca23675', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 08:00:32'),
('8ed76bf2-dd8d-47bf-9099-ff9437f692b6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a3ad9984-5f79-4300-96a5-d153b8a01665 adjusted from 92 to 89. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 89, \"oldStock\": 92, \"productId\": \"a3ad9984-5f79-4300-96a5-d153b8a01665\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:06:26'),
('8eda53d0-6d94-4f9a-8b1f-46e51413f446', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-24 02:14:23'),
('901e489e-9eb8-4e07-8806-aeb6d1593a1f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: ed2f4421-fca0-4827-b7c3-d814f46252c6) updated.', '{\"productId\": \"ed2f4421-fca0-4827-b7c3-d814f46252c6\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"1e893ad2-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 09:58:41'),
('906c48ba-49a0-4c25-ae33-0419bcf59260', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-16 07:58:05'),
('90b6479c-5ca9-4b89-a90a-d39cfd6974f4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 1eb68c1a-558a-44ab-890a-875ce3e64b75 processed successfully for amount 1515.50. Items: 1.', '{\"saleId\": \"1eb68c1a-558a-44ab-890a-875ce3e64b75\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1515.5, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 22:19:07'),
('938a5187-3be6-43dd-bd3b-4e5a01a14fc1', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 18:36:59'),
('9399cf67-8355-46a6-9975-dc2cef182a1e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 2688e9d0-bbd8-467f-8a1c-ab9cc4b30999 processed successfully for amount 26.52. Items: 3.', '{\"saleId\": \"2688e9d0-bbd8-467f-8a1c-ab9cc4b30999\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 3, \"customerId\": \"083e0734-5aed-42e3-b978-c5a3d524c9e4\", \"totalAmount\": 26.52125, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 11:35:51'),
('94ed8123-6893-4069-8b8f-f3cb1915bbe8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 40d3b2fa-6e33-4286-bb9a-b2440ae40a3b processed successfully for amount 8.44. Items: 1.', '{\"saleId\": \"40d3b2fa-6e33-4286-bb9a-b2440ae40a3b\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 8.4435, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 15:13:38'),
('9519021e-6e4b-4d65-bd2a-c8f073299bda', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 06:43:23'),
('9630c9db-71e7-4c23-b1ad-4e0d5488bf32', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 17:39:22'),
('97ac4a23-ab20-4afd-a0a5-eb8017b09d30', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 56b60d92-35a1-4b1d-9be0-514779568b40) updated.', '{\"productId\": \"56b60d92-35a1-4b1d-9be0-514779568b40\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 06:45:48'),
('980c4a53-9332-41c5-8b47-20d36f95abeb', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID e03dc952-7f98-421d-924b-4f819abe666e adjusted from 488 to 485. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 485, \"oldStock\": 488, \"productId\": \"e03dc952-7f98-421d-924b-4f819abe666e\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:29:38'),
('9884a172-8efb-468f-8f38-44b6ada226a3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale f3f31f7d-ddcd-4921-9a44-4fd3dffd20ac processed successfully for amount 10.61. Items: 2.', '{\"saleId\": \"f3f31f7d-ddcd-4921-9a44-4fd3dffd20ac\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": null, \"totalAmount\": 10.61, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-12 14:54:28'),
('9895fc80-f6cd-472b-838b-60854eef6bc7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale f584c877-2d87-4d1c-9df2-1b2e5027a239 processed successfully for amount 2033.21. Items: 3.', '{\"saleId\": \"f584c877-2d87-4d1c-9df2-1b2e5027a239\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 3, \"customerId\": \"ecf5b65f-e11f-4dcb-91df-cc5f90697c30\", \"totalAmount\": 2033.205625, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:29:37'),
('98f993bc-920f-4326-a2cc-7206e4b4acdd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', '87dd56a6-c0d4-46a0-9ef0-d99ac8cacd67', 'test@user.com', 'USER_LOGIN_SUCCESS', 'User test@user.com logged in successfully.', '{\"role\": \"cashier\", \"email\": \"test@user.com\", \"userId\": \"87dd56a6-c0d4-46a0-9ef0-d99ac8cacd67\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 06:22:25'),
('992a57ab-3787-41c3-8402-dc04d9a6c2cf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID bcfc8606-b170-42a4-83ed-f1c74f2f8c61 adjusted from 40 to 39. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 39, \"oldStock\": 40, \"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 16:19:08'),
('9993e73d-0e66-4dac-b43e-5ba42482863f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Nathara Contour\" (ID: 3dcedd3f-0c34-44f5-b8da-08e372b219cf) updated.', '{\"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"barcode = ?\", \"sku = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"ZET-NYA353\", \"name\": \"Nathara Contour\", \"price\": \"1475\", \"barcode\": \"0922480967567\", \"imageUrl\": \"/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748272194929-324524273.png\", \"is_active\": \"true\", \"category_id\": \"3ff8552b-2b1c-438c-abd3-6231f9195b00\", \"description\": \"Nathara Contour Engagement Ring for special women\", \"tax_class_id\": \"92be2844-36f9-11f0-8297-525400148990\", \"purchase_price\": \"1200\", \"stock_quantity\": \"32\", \"low_stock_threshold\": \"8\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 10:35:49'),
('9a4d48b8-3bc9-499d-84ab-3545e35735ca', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 07:46:30'),
('9abd634a-c103-4f89-9f01-b9bfdab83476', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 10:22:34'),
('9b012781-e0b8-48b4-a457-f796db9a7889', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:51:00'),
('9c2828a1-eb22-4b61-82ee-2a8f2dae03aa', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Nathara Contour\" (ID: 3dcedd3f-0c34-44f5-b8da-08e372b219cf) updated.', '{\"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"barcode = ?\", \"sku = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"ZET-NYA353\", \"name\": \"Nathara Contour\", \"price\": \"1475\", \"barcode\": \"0922480967567\", \"imageUrl\": \"/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748272194929-324524273.png\", \"is_active\": \"true\", \"category_id\": \"3ff8552b-2b1c-438c-abd3-6231f9195b00\", \"description\": \"Nathara Contour Engagement Ring for special women\", \"tax_class_id\": \"92be2844-36f9-11f0-8297-525400148990\", \"purchase_price\": \"1200\", \"stock_quantity\": \"32\", \"low_stock_threshold\": \"8\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 11:47:56'),
('9c2b921f-899b-4999-be87-e18b148a3ede', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 18:43:10'),
('9c3f8132-8002-449e-b295-def0b12c9a4e', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 01:53:20'),
('9c5e31f3-6e0b-455b-b332-e59641295e35', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 01:46:07'),
('9d7ebcd0-48bf-41c3-ac2d-ad8a38861051', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 12:27:07'),
('9e52a088-09ef-42d9-94c4-d0f61bf986f3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 18:52:51'),
('9ef41b8d-4a89-4631-850b-191861b3f86e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b89be53e-f6b7-4005-9f32-9e890325c658 adjusted from 132 to 131. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 131, \"oldStock\": 132, \"productId\": \"b89be53e-f6b7-4005-9f32-9e890325c658\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:39:45'),
('9f09f80a-8186-456f-a115-a660eb36283d', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 18:43:01'),
('9f81b01d-3ab0-49ab-a264-7594d0ffd871', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 626 to 623. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 623, \"oldStock\": 626, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:56:31'),
('a2511ce5-4603-4fc6-bccd-a263340194cc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 74868ac1-73a5-417a-97eb-53bb99420ddd processed successfully for amount 13.86. Items: 2.', '{\"saleId\": \"74868ac1-73a5-417a-97eb-53bb99420ddd\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": \"503e4102-68a7-46e0-a4c9-e798b344ca7b\", \"totalAmount\": 13.856000000000002, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:27:02'),
('a30f90f7-15ef-4175-aa89-b84e88709058', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ad80d59c-de80-49e0-82e3-c3d528d5367c adjusted from 200 to 196. Change: -4.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 196, \"oldStock\": 200, \"productId\": \"ad80d59c-de80-49e0-82e3-c3d528d5367c\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -4}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:48:42'),
('a354c7d3-404b-4362-88c4-6412c1775a15', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Wedding Ring\" (ID: 55f2568f-96cf-46a8-b156-a633be5b591c) updated.', '{\"productId\": \"55f2568f-96cf-46a8-b156-a633be5b591c\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Wedding Ring\", \"price\": \"1400\", \"barcode\": \"\", \"imageUrl\": \"/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748850859392-437044890.png\", \"is_active\": \"true\", \"category_id\": \"3ff8552b-2b1c-438c-abd3-6231f9195b00\", \"description\": \"Wedding Ring for lovers\", \"tax_class_id\": \"null\", \"purchase_price\": \"1000\", \"stock_quantity\": \"7\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 06:46:38'),
('a3bdddb1-7ba6-483b-8a9f-d4c72002614d', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 06:46:14'),
('a3f15823-5de4-401f-a9e0-8c964af98cbc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59c5aa8d-33e1-4e3c-ad80-e5735bde8140 adjusted from 57 to 55. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 55, \"oldStock\": 57, \"productId\": \"59c5aa8d-33e1-4e3c-ad80-e5735bde8140\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:21:38'),
('a4169802-5214-4ca1-9fec-1f1a356a4cba', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 17:12:57'),
('a43be6bb-f435-41ce-be7c-217ca0781574', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 7b2c3d08-9d30-4419-90b1-3ae756e698f3 processed successfully for amount 22.70. Items: 1.', '{\"saleId\": \"7b2c3d08-9d30-4419-90b1-3ae756e698f3\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 22.700025, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 15:47:02'),
('a49797c4-fc21-4409-990f-f7659fa1706b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b89be53e-f6b7-4005-9f32-9e890325c658 adjusted from 134 to 133. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 133, \"oldStock\": 134, \"productId\": \"b89be53e-f6b7-4005-9f32-9e890325c658\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:57:19'),
('a5347af4-2199-45c6-81b1-84c733b7d55b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 056250b8-90d2-41e8-b9c7-1a866658ee7f adjusted from 2 to 1. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 1, \"oldStock\": 2, \"productId\": \"056250b8-90d2-41e8-b9c7-1a866658ee7f\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:58:04'),
('a60a6e83-600a-44fd-b9ef-9b55ec20742f', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:39:24'),
('a66640d7-6778-4686-8fc4-491a90364d52', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 56b60d92-35a1-4b1d-9be0-514779568b40) updated.', '{\"productId\": \"56b60d92-35a1-4b1d-9be0-514779568b40\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"1e893ad2-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 09:58:41'),
('a670596c-2ffa-4683-a3b6-0d993194de49', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user manager@zettaz.com: Invalid password.', '{\"email\": \"manager@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:48:56');
INSERT INTO `user_activity_logs` (`id`, `tenant_id`, `user_id`, `username`, `action_type`, `description`, `details`, `ip_address`, `user_agent`, `timestamp`) VALUES
('a7e7b36f-8be5-4153-b4ae-d3ccf3667221', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: bcfc8606-b170-42a4-83ed-f1c74f2f8c61) updated.', '{\"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 10:10:36'),
('a801fdd6-5fad-4dee-b09c-95d2c7c47ef6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 187b21e6-639b-42b4-8199-28e1a2e49f9c) updated.', '{\"productId\": \"187b21e6-639b-42b4-8199-28e1a2e49f9c\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"67bab738-0494-4e8d-8d5e-9d0a0f97c04f\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:51'),
('a822775f-c4ef-404b-b60b-fdbcb41a31a2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 01:38:12'),
('a826276e-04b0-4f15-8af4-0a0275b9448e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 3c7bfc55-b3f1-4392-ac4b-6a2f6de28616 processed successfully for amount 16.89. Items: 1.', '{\"saleId\": \"3c7bfc55-b3f1-4392-ac4b-6a2f6de28616\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 16.887, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:29:14'),
('a87e5c98-0c4e-43e7-aa10-999004d59809', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 95 to 94. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 94, \"oldStock\": 95, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 15:13:39'),
('a9024f44-508b-479a-adc7-198b69ae44ee', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 09:03:31'),
('a941b8a1-79db-4e86-b2b5-e58485857eae', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 97f42afb-f5b9-4c7a-94b0-9b0f3660c258 processed successfully for amount 4052.07. Items: 3.', '{\"saleId\": \"97f42afb-f5b9-4c7a-94b0-9b0f3660c258\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 3, \"customerId\": \"a98644da-bc81-481b-9b1a-a9de5ee8468d\", \"totalAmount\": 4052.068125, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:36:05'),
('a95ee9bc-3a06-4ccc-8450-a01c6f4161ac', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b89be53e-f6b7-4005-9f32-9e890325c658 adjusted from 138 to 137. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 137, \"oldStock\": 138, \"productId\": \"b89be53e-f6b7-4005-9f32-9e890325c658\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 16:19:09'),
('a9f34d20-abc8-4987-95fc-3cc7890c174b', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:58:21'),
('a9fd59e7-4447-4912-9baf-3c9371309145', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 4f65ddef-df52-4013-bc0b-c4c4a1301d5b processed successfully for amount 1596.69. Items: 1.', '{\"saleId\": \"4f65ddef-df52-4013-bc0b-c4c4a1301d5b\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1596.6875, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:54:56'),
('aa22b144-950a-4930-ab8d-441f7b5c5731', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a3ad9984-5f79-4300-96a5-d153b8a01665 adjusted from 89 to 88. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 88, \"oldStock\": 89, \"productId\": \"a3ad9984-5f79-4300-96a5-d153b8a01665\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:27:59'),
('aa9948ad-8c0c-4fd8-bb9e-0bb7047d698d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 04:21:16'),
('aadfe94d-840a-4fe0-81d0-a19190b3ebf7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 24d6cff3-146d-4f7e-bd11-494796654988 processed successfully for amount 1675.71. Items: 2.', '{\"saleId\": \"24d6cff3-146d-4f7e-bd11-494796654988\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": null, \"totalAmount\": 1675.71, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:58:03'),
('ab8f4ba0-9945-45d6-8a21-476f2102d1bc', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale b93fce95-9fe7-4e53-a879-5f64d26be589 processed successfully for amount 875.85. Items: 1.', '{\"saleId\": \"b93fce95-9fe7-4e53-a879-5f64d26be589\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": \"ac5d853a-6e91-4275-ad94-1c3601e40892\", \"totalAmount\": 875.8507500000001, \"paymentMethodId\": \"e9ca75b4-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:39:44'),
('aba3c179-222b-4be0-b03a-84acaf3fba5d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d adjusted from 147 to 146. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 146, \"oldStock\": 147, \"productId\": \"59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 09:32:00'),
('abfc9616-f87a-4097-a7a1-182ba6546728', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID bcfc8606-b170-42a4-83ed-f1c74f2f8c61 adjusted from 43 to 40. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 40, \"oldStock\": 43, \"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-07 14:14:15'),
('ac27fca3-75fc-457b-9dfd-08b1a9ee5c0b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 17:06:09'),
('aca29bcc-76ff-4fc5-ad27-e9b20b4bca42', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 98e52b69-796b-44fb-afa7-f7d419b45633 processed successfully for amount 389.70. Items: 2.', '{\"saleId\": \"98e52b69-796b-44fb-afa7-f7d419b45633\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": null, \"totalAmount\": 389.7, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 10:59:21'),
('acf0133f-6a54-41e7-ac6d-427dbf69a5f6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 17:26:21'),
('ad768e23-7ba9-46de-93db-075a1df3a8a3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a0cff669-2621-4b55-aaac-88e81474710a adjusted from 23 to -3. Change: -26.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": -3, \"oldStock\": 23, \"productId\": \"a0cff669-2621-4b55-aaac-88e81474710a\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -26}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:00:00'),
('ae8ed8f5-fd7a-4b33-9a77-71381bff9d55', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 07:52:16'),
('aeb50745-6ce4-413b-9cb6-08802622757e', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 16:56:18'),
('aec610f2-a460-42f5-b9e5-8c9e697796cf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 05:15:41'),
('aee32476-1574-4534-b284-452d2556da69', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 12:29:12'),
('af501b0e-59f4-416a-a0cc-6c03219cacc5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 18:54:18'),
('af6f7eff-f2fe-4e20-b2d1-f745acca793c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a95dbb16-3ac2-48c8-a9b0-5a6e6656c884 adjusted from 23 to 22. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 22, \"oldStock\": 23, \"productId\": \"a95dbb16-3ac2-48c8-a9b0-5a6e6656c884\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 11:23:04'),
('afe5fc8a-221b-4877-ba52-126def046a26', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 592de762-38ed-4640-9e6c-c32fd5096790 adjusted from 41 to 39. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 39, \"oldStock\": 41, \"productId\": \"592de762-38ed-4640-9e6c-c32fd5096790\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:30:16'),
('b058626a-64b3-40e9-8e14-222f887f361e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 80 to 79. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 79, \"oldStock\": 80, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-12 14:54:28'),
('b0fd5c9f-2973-4685-86bc-72dfe61bbed0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 3dcedd3f-0c34-44f5-b8da-08e372b219cf adjusted from 34 to 33. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 33, \"oldStock\": 34, \"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:54:56'),
('b1220dc2-0243-45f4-891f-d4e66dd5c236', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 17:06:51'),
('b1d79abd-334b-4318-9e86-3e84a17b19a4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: ed2f4421-fca0-4827-b7c3-d814f46252c6) updated.', '{\"productId\": \"ed2f4421-fca0-4827-b7c3-d814f46252c6\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"0e88cf84-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 20:52:23'),
('b2f40bc5-b0d0-4d7c-9216-62535a2960a8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 07:17:13'),
('b3029162-0f3f-4e23-93ea-5b825ce3f9fa', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID bcfc8606-b170-42a4-83ed-f1c74f2f8c61 adjusted from 36 to 35. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 35, \"oldStock\": 36, \"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:37:52'),
('b31566ad-8683-45f3-b5bd-cfd314c79836', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-15 09:08:10'),
('b378b272-cc0e-40ce-853d-7fb83d9622f7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 1efb8f3d-bfbc-45a6-878b-95df7d455f35 processed successfully for amount 4.22. Items: 1.', '{\"saleId\": \"1efb8f3d-bfbc-45a6-878b-95df7d455f35\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": \"7acc70a5-8372-425f-a28c-adb7c239457e\", \"totalAmount\": 4.22175, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:21:39'),
('b38b8f2e-b353-4e83-b6a5-5b9fcd54e67c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 622 to 621. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 621, \"oldStock\": 622, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:09:49'),
('b3fd98c7-c49c-430e-9e7b-0599228dcda5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 13:22:09'),
('b516b50d-a82e-49b9-9b1c-bf96aba95438', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ad80d59c-de80-49e0-82e3-c3d528d5367c adjusted from 196 to 191. Change: -5.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 191, \"oldStock\": 196, \"productId\": \"ad80d59c-de80-49e0-82e3-c3d528d5367c\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -5}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 11:35:51'),
('b562f5c2-7ff7-4526-a878-b308475c328c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale f83ce334-7f3d-4ba9-86a4-a915695e8714 processed successfully for amount 486.58. Items: 1.', '{\"saleId\": \"f83ce334-7f3d-4ba9-86a4-a915695e8714\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": \"ecf5b65f-e11f-4dcb-91df-cc5f90697c30\", \"totalAmount\": 486.58375, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:57:18'),
('b5d40f99-fa7c-4d38-8b47-8dfa5d94038d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-15 17:53:27'),
('b660e2ed-3109-4ba0-928c-8e7e9a3b4ae7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 8b478c8a-3150-45a6-a01b-d37bbeae6ff2 processed successfully for amount 5.41. Items: 1.', '{\"saleId\": \"8b478c8a-3150-45a6-a01b-d37bbeae6ff2\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 5.4125, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:25:01'),
('b6a25b72-11ed-4eba-9de2-14db4a940215', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 17:23:29'),
('b6a61fa0-4b7f-4706-b223-0e5aaffab3c7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 26743683-aa1f-4fc7-8af4-cb467169ba5a processed successfully for amount 2716.80. Items: 4.', '{\"saleId\": \"26743683-aa1f-4fc7-8af4-cb467169ba5a\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 4, \"customerId\": \"6d2fd998-111e-4f90-b838-cbba1ff0ab8e\", \"totalAmount\": 2716.804375, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:20:15'),
('b7cdf755-1b3a-400d-8493-895a009bdda8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-25 02:53:54'),
('b7f8f1a0-d7e5-48e0-8c14-688208cf3da4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', '87dd56a6-c0d4-46a0-9ef0-d99ac8cacd67', 'test@user.com', 'USER_LOGIN_SUCCESS', 'User test@user.com logged in successfully.', '{\"role\": \"cashier\", \"email\": \"test@user.com\", \"userId\": \"87dd56a6-c0d4-46a0-9ef0-d99ac8cacd67\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 06:16:55'),
('b809dd9b-c3ba-49bd-a732-59fc626b36a4', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 04:37:21'),
('b858888b-b72d-4630-899f-58d615b85823', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 10:44:03'),
('ba16d3d3-e634-46fd-80bf-03b63d2f45e6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 3dcedd3f-0c34-44f5-b8da-08e372b219cf adjusted from 36 to 35. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 35, \"oldStock\": 36, \"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:37:52'),
('ba61748e-b850-4566-a973-7c02e6f2e9b4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d adjusted from 146 to 145. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 145, \"oldStock\": 146, \"productId\": \"59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:28:30'),
('bb42c9af-7e32-4ad4-b413-e112c30360ce', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 1ea38ea3-ba24-4cbe-879a-3ea133b74a5a processed successfully for amount 1596.69. Items: 1.', '{\"saleId\": \"1ea38ea3-ba24-4cbe-879a-3ea133b74a5a\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1596.69, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:42:32'),
('bc8df57b-a465-4f84-9be3-a341a64dd8e8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-12 07:45:39'),
('bcbfe58d-a281-41ff-be94-af314b7dbd81', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-09 15:02:40'),
('bed7c9b7-371c-4615-b79c-71ae50ec671e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 2749c3f0-bf90-46b2-bcc1-fbef2a9dde1f processed successfully for amount 4053.31. Items: 2.', '{\"saleId\": \"2749c3f0-bf90-46b2-bcc1-fbef2a9dde1f\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": null, \"totalAmount\": 4053.313, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:56:30'),
('bfb30222-6fc5-4d2c-ab10-a6b587b11ffa', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale d3e87c68-2fbd-48d0-90b6-cb8796c0d9d3 processed successfully for amount 4074.53. Items: 2.', '{\"saleId\": \"d3e87c68-2fbd-48d0-90b6-cb8796c0d9d3\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": \"083e0734-5aed-42e3-b978-c5a3d524c9e4\", \"totalAmount\": 4074.53, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:12:57'),
('bfcc5f73-dd9f-41de-a3d3-fab7da39911b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 14a89bc3-18de-4fae-9cf8-50a8d62418c1 processed successfully for amount 84.44. Items: 1.', '{\"saleId\": \"14a89bc3-18de-4fae-9cf8-50a8d62418c1\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 84.435, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:11:28'),
('bfe5fd6d-8ba7-4775-8b16-b80d7a58730d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 627d7c55-921a-4916-8bf9-98f1bbc4ad08 adjusted from 96 to 93. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 93, \"oldStock\": 96, \"productId\": \"627d7c55-921a-4916-8bf9-98f1bbc4ad08\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 11:55:31'),
('c0b60358-5f09-4812-99f0-b80c7394cde4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 4ea4ed67-033f-47ae-b3eb-1c580456dc91 processed successfully for amount 19.94. Items: 3.', '{\"saleId\": \"4ea4ed67-033f-47ae-b3eb-1c580456dc91\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 3, \"customerId\": null, \"totalAmount\": 19.93965, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:41:46'),
('c13f4a6c-cffa-470c-872d-483a116deaef', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-24 19:30:48'),
('c18e9e47-165f-4e04-953d-ead72c8c4607', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 0ed2e936-4f66-4c74-ae2a-e9314cfa8394 processed successfully for amount 10.83. Items: 1.', '{\"saleId\": \"0ed2e936-4f66-4c74-ae2a-e9314cfa8394\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 10.83, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 12:18:21'),
('c1a6b847-2c05-424f-b6f1-f125ec08e697', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 01:30:39'),
('c1b080f1-d338-4754-9333-e1dd999a870d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 16:52:50'),
('c1b26a94-16ef-4932-b83a-1e3b0b19c333', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-13 04:48:21'),
('c1c25ae4-4359-474b-a77e-4ebffa82d326', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 15:09:02'),
('c337d3ad-3f1b-45e9-882e-1bd3e6bf5403', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:05:02'),
('c39770fa-4ff4-4daa-bdf4-78eaf5698791', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 20:49:57'),
('c3a40e89-c5d0-468f-9a5f-6d021584ffb7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale e501a905-567d-4a4a-a88a-885bed5aeda0 processed successfully for amount 6913.66. Items: 4.', '{\"saleId\": \"e501a905-567d-4a4a-a88a-885bed5aeda0\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 4, \"customerId\": \"503e4102-68a7-46e0-a4c9-e798b344ca7b\", \"totalAmount\": 6913.656875, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 08:27:10'),
('c41b292f-fb16-474f-af14-db370b3d3134', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 187b21e6-639b-42b4-8199-28e1a2e49f9c) updated.', '{\"productId\": \"187b21e6-639b-42b4-8199-28e1a2e49f9c\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"0e88cf84-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 20:52:23'),
('c4e94216-47dd-4024-99ae-f2633c2fb732', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6 adjusted from 96 to 93. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 93, \"oldStock\": 96, \"productId\": \"3b7458e4-5e5d-4a2b-9ee2-caf4fdaae4f6\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 15:39:26'),
('c503cbf1-383f-4563-a279-15db29063d98', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:10:43'),
('c5740016-6adb-4457-979f-74857f3efa2c', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b6860c69-6d3e-456c-a25f-a4bc09bd23c4 adjusted from 93 to 91. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 91, \"oldStock\": 93, \"productId\": \"b6860c69-6d3e-456c-a25f-a4bc09bd23c4\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 15:39:27'),
('c5acf3fe-0a39-44ce-bec4-a5f7f2dd48b2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 09:16:15'),
('c60a2380-7ebd-4980-86c1-dd6c250b7a95', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 20:52:01'),
('c6f5176a-9488-447e-84ec-fe9fafb42b8f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 5c08c1dc-5559-4470-8151-c026805899dd adjusted from 53 to 49. Change: -4.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 49, \"oldStock\": 53, \"productId\": \"5c08c1dc-5559-4470-8151-c026805899dd\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -4}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 11:34:09'),
('c776dbb0-4855-443d-9e62-9d651e549b55', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 92 to 90. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 90, \"oldStock\": 92, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:29:15'),
('c802bd2f-c8fd-41b2-9301-17bee93bee91', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID bcfc8606-b170-42a4-83ed-f1c74f2f8c61 adjusted from 33 to 32. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 32, \"oldStock\": 33, \"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:52:27'),
('c96552b3-d485-4932-8168-ca9cd9bd469b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: b193d1a1-94f6-405a-b13f-15a1d594f403) updated.', '{\"productId\": \"b193d1a1-94f6-405a-b13f-15a1d594f403\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 10:10:36'),
('c98df5e3-cc0f-4a58-afa1-887e75be2f5e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b82e1887-40f9-4475-b277-ef45e093bf56 adjusted from 94 to 93. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 93, \"oldStock\": 94, \"productId\": \"b82e1887-40f9-4475-b277-ef45e093bf56\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 15:50:29'),
('c9bfd4b9-2a4a-45e1-923a-68bd64eac504', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 01:30:25'),
('ca329cb9-c842-4bb1-9f91-d183fb226e83', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-12 01:25:30'),
('ca6a38a6-01e5-4198-838a-eb4d97d4dd84', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-12 07:26:28'),
('cab36196-69b0-4dc2-bcfd-e46c0b2c4329', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'cashier@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user cashier@zettaz.com: Invalid password.', '{\"email\": \"cashier@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:38:11'),
('cbf59804-5887-4c51-bcfc-57480e569cc2', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 5c08c1dc-5559-4470-8151-c026805899dd adjusted from 56 to 53. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 53, \"oldStock\": 56, \"productId\": \"5c08c1dc-5559-4470-8151-c026805899dd\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 08:27:11'),
('cc02f7bf-c173-4da3-96ef-c9d417f46e28', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@deshvidesh.com: Invalid password.', '{\"email\": \"admin@deshvidesh.com\", \"reason\": \"Invalid password\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 15:48:53'),
('cc1b34dc-c2bc-4ca8-8e9a-960a2d29ae4d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 10:46:43'),
('ccf7bdbc-5260-4e24-a283-36d9817f130b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_SUCCESS', 'User manager@zettaz.com logged in successfully.', '{\"role\": \"manager\", \"email\": \"manager@zettaz.com\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:57:12'),
('cd335fa5-41ab-4612-9339-18d5401cdd7e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a0cff669-2621-4b55-aaac-88e81474710a adjusted from 24 to 23. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 23, \"oldStock\": 24, \"productId\": \"a0cff669-2621-4b55-aaac-88e81474710a\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:21:39');
INSERT INTO `user_activity_logs` (`id`, `tenant_id`, `user_id`, `username`, `action_type`, `description`, `details`, `ip_address`, `user_agent`, `timestamp`) VALUES
('cd359a49-343f-4e01-9158-01330614743d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a5fd86a0-7b25-457b-9473-a33de24f4e13 adjusted from 30 to 29. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 29, \"oldStock\": 30, \"productId\": \"a5fd86a0-7b25-457b-9473-a33de24f4e13\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:41:47'),
('cd60e857-e7e1-498f-8f30-ef79c4d3aa1d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID bcfc8606-b170-42a4-83ed-f1c74f2f8c61 adjusted from 34 to 33. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 33, \"oldStock\": 34, \"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:25:02'),
('cda12423-f60e-4641-bd98-f55f30004fd6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-26 06:29:10'),
('cf8d9e1e-4920-402f-9dda-220df06e998d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:38:27'),
('d05428ee-97cf-463d-a902-1890d58b3e28', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID b193d1a1-94f6-405a-b13f-15a1d594f403 adjusted from 152 to 151. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 151, \"oldStock\": 152, \"productId\": \"b193d1a1-94f6-405a-b13f-15a1d594f403\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:54:51'),
('d0fb66c2-7aca-42ef-abef-9327bf525a77', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID bcfc8606-b170-42a4-83ed-f1c74f2f8c61 adjusted from 32 to 31. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 31, \"oldStock\": 32, \"productId\": \"bcfc8606-b170-42a4-83ed-f1c74f2f8c61\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-12 14:54:39'),
('d115ac0a-1857-4127-97c2-dc80f2186657', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d adjusted from 144 to 143. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 143, \"oldStock\": 144, \"productId\": \"59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:58:04'),
('d1350d0b-72fe-4dba-b441-0a7ffb945938', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', '87dd56a6-c0d4-46a0-9ef0-d99ac8cacd67', 'test@user.com', 'USER_LOGIN_SUCCESS', 'User test@user.com logged in successfully.', '{\"role\": \"cashier\", \"email\": \"test@user.com\", \"userId\": \"87dd56a6-c0d4-46a0-9ef0-d99ac8cacd67\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 05:57:39'),
('d16b7bc2-95f5-4dbb-aa17-81df16092ff4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 08:30:32'),
('d1d302bb-09bf-4b86-a542-1c3face4ebae', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Nathara Contour\" (ID: 3dcedd3f-0c34-44f5-b8da-08e372b219cf) updated.', '{\"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"barcode = ?\", \"sku = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"ZET-NYA353\", \"name\": \"Nathara Contour\", \"price\": \"1475\", \"barcode\": \"0922480967567\", \"imageUrl\": \"/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748272194929-324524273.png\", \"is_active\": \"true\", \"category_id\": \"3ff8552b-2b1c-438c-abd3-6231f9195b00\", \"description\": \"Nathara Contour Engagement Ring for special women\", \"tax_class_id\": \"92bed9d4-36f9-11f0-8297-525400148990\", \"purchase_price\": \"1200\", \"stock_quantity\": \"32\", \"low_stock_threshold\": \"8\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 10:34:27'),
('d59b15cb-6a3f-4df0-a95d-ec4e9f7624be', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 19:00:52'),
('d5c782f8-a881-4198-aef8-eeebf61359b4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d adjusted from 141 to 140. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 140, \"oldStock\": 141, \"productId\": \"59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:32:54'),
('d6317d04-9ede-4390-9975-c1bd701bfe71', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 16:57:34'),
('d69981a5-e929-4534-88d6-2b7551c7a697', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 19dfbe4a-6993-48ab-9368-1c7e93fcd860 processed successfully for amount 691.93. Items: 1.', '{\"saleId\": \"19dfbe4a-6993-48ab-9368-1c7e93fcd860\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": \"ec16e637-fdd8-4594-b7a7-31495b9ab95f\", \"totalAmount\": 691.9340000000001, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:32:53'),
('d7f58ff7-9abe-442f-98a1-7448824c9cb5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 645 to 642. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 642, \"oldStock\": 645, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:15:38'),
('d85b1c89-cddd-48b2-bb56-843677084736', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 04:08:35'),
('d8715ccb-5b52-4fff-96f9-587f4f5326b6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale f0ba7544-63ce-4887-b234-06531ef15e38 processed successfully for amount 8.44. Items: 1.', '{\"saleId\": \"f0ba7544-63ce-4887-b234-06531ef15e38\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 8.4435, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:51:28'),
('d9d54e17-fb80-4903-bba1-a1d3d4f19e60', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 03:50:42'),
('dad8e04c-bcab-40b5-8c30-64cd1e991fe4', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:50:45'),
('db82f15d-b342-41fa-8811-1f5bb8517560', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 11:43:01'),
('dbaffbcc-1913-49c5-805d-d1d2bcc6ad50', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-17 10:36:39'),
('dc1747ae-5e5a-4d3b-acf9-2b0c5c344ed4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID e03dc952-7f98-421d-924b-4f819abe666e adjusted from 500 to 493. Change: -7.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 493, \"oldStock\": 500, \"productId\": \"e03dc952-7f98-421d-924b-4f819abe666e\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -7}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-06 08:06:26'),
('ddec96e6-8373-4871-85df-c5eccaebce14', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 02:00:19'),
('de957e15-9c2e-4c70-83ac-b7fd9acb94a7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: b193d1a1-94f6-405a-b13f-15a1d594f403) updated.', '{\"productId\": \"b193d1a1-94f6-405a-b13f-15a1d594f403\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"1e893ad2-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 09:58:41'),
('df70b05b-dd23-4be3-a400-6f46d7e1cb95', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 4c98f143-cc49-4f2d-bf93-6544b33d9e19 adjusted from 129 to 128. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 128, \"oldStock\": 129, \"productId\": \"4c98f143-cc49-4f2d-bf93-6544b33d9e19\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 11:20:19'),
('dfa06a90-5722-49e0-8899-1ea60555bd6a', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Nathara Contour\" (ID: 3dcedd3f-0c34-44f5-b8da-08e372b219cf) updated.', '{\"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"barcode = ?\", \"sku = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"ZET-NYA353\", \"name\": \"Nathara Contour\", \"price\": \"1475\", \"barcode\": \"0922480967567\", \"imageUrl\": \"/uploads/d7f267da-d5d9-4a15-b0d3-31ca710a4492/products/image-1748272194929-324524273.png\", \"is_active\": \"true\", \"category_id\": \"3ff8552b-2b1c-438c-abd3-6231f9195b00\", \"description\": \"Nathara Contour Engagement Ring for special women\", \"tax_class_id\": \"null\", \"purchase_price\": \"1200\", \"stock_quantity\": \"32\", \"low_stock_threshold\": \"8\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 11:36:14'),
('e08a1f34-0cf2-4a1f-938d-1fa952a266a6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: b193d1a1-94f6-405a-b13f-15a1d594f403) updated.', '{\"productId\": \"b193d1a1-94f6-405a-b13f-15a1d594f403\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 06:45:49'),
('e0dd31c6-3882-4f41-8deb-8cc1853e8d0f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: ed2f4421-fca0-4827-b7c3-d814f46252c6) updated.', '{\"productId\": \"ed2f4421-fca0-4827-b7c3-d814f46252c6\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 10:10:36'),
('e115f78d-7ce2-40a3-bfc7-88d57974c1a4', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 18:40:31'),
('e1d87c9f-9597-4928-b09f-a7fbb72eebb4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: a5fd86a0-7b25-457b-9473-a33de24f4e13) updated.', '{\"productId\": \"a5fd86a0-7b25-457b-9473-a33de24f4e13\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"1e893ad2-486b-11f0-9c38-525400148990\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-14 09:58:41'),
('e2566986-a63a-4252-b6d3-4202b76c893b', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:22:05'),
('e2afc3e0-d4b0-43d2-8753-6efed8909fde', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_SUCCESS', 'User manager@zettaz.com logged in successfully.', '{\"email\": \"manager@zettaz.com\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-16 08:39:23'),
('e3420c33-d053-4586-a3ca-8fc9c92718e5', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:41:07'),
('e3c2b861-1f36-4ed9-b2cc-1c27a89751e1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"Coffee Cup\" (ID: 377ecc2b-ba34-445b-bbd2-b0527b4718e6) updated.', '{\"productId\": \"377ecc2b-ba34-445b-bbd2-b0527b4718e6\", \"updatedFields\": [\"name = ?\", \"description = ?\", \"price = ?\", \"category_id = ?\", \"stock_quantity = ?\", \"is_active = ?\", \"tax_class_id = ?\", \"cost_price = ?\", \"low_stock_threshold = ?\"], \"requestedChanges\": {\"sku\": \"\", \"name\": \"Coffee Cup\", \"price\": \"10\", \"barcode\": \"\", \"imageUrl\": \"\", \"is_active\": \"true\", \"category_id\": \"a52d3611-6578-4868-88fe-f704249603d3\", \"description\": \"Coffee Cup\", \"tax_class_id\": \"92bed9d4-36f9-11f0-8297-525400148990\", \"purchase_price\": \"5\", \"stock_quantity\": \"74\", \"low_stock_threshold\": \"10\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 11:35:47'),
('e3e90980-8269-4613-aca3-991fc81058ea', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 12:40:49'),
('e48ac94b-6a93-45b7-8f7b-a7794fd0f9f7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 08:41:59'),
('e5b112f3-0c58-4b50-b7df-f87c6d650424', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-25 04:19:32'),
('e690ddbd-1052-45ea-a1b4-b5f866d26e71', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 04:00:44'),
('e805b463-868b-4e45-9d60-3a997f9ef6b1', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-13 13:45:46'),
('e8e3d20a-6c8a-407a-a02d-0d19621d1d68', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:28:15'),
('e949d2bf-45a9-40d2-875f-a4d77a8fefc4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:51:44'),
('e94f130e-eec1-40a8-89f5-481165c56b41', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:21:55'),
('ea410f45-30bd-4c8c-9ef3-4b6cd651b031', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID ce16c080-7f4b-49a4-ad4b-c84c53a2aa79 adjusted from 635 to 632. Change: -3.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 632, \"oldStock\": 635, \"productId\": \"ce16c080-7f4b-49a4-ad4b-c84c53a2aa79\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -3}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:36:20'),
('ea474e84-9925-489a-8b16-6b9bc55faa8f', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-26 05:30:00'),
('eb74242e-5e8d-4054-805a-ce740fd28774', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-26 06:48:13'),
('ebc541db-b818-499c-9b0b-7b86adb56adf', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale bbeeb7fb-ed8d-43db-9a55-cb231b5d6f1b processed successfully for amount 1081.42. Items: 1.', '{\"saleId\": \"bbeeb7fb-ed8d-43db-9a55-cb231b5d6f1b\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1081.4175, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 10:23:42'),
('ec01c218-af24-4b7c-934c-3113afcdb40b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-18 17:13:29'),
('eceaf4fa-5cf6-4c13-a4cc-992cce82135b', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 15:50:32'),
('ecff3f1d-eeb0-43fb-9484-4cc4b2a95a9d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 56b60d92-35a1-4b1d-9be0-514779568b40) updated.', '{\"productId\": \"56b60d92-35a1-4b1d-9be0-514779568b40\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:36'),
('ed9dc410-93fc-4070-b5be-be6f08ee8730', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: 187b21e6-639b-42b4-8199-28e1a2e49f9c) updated.', '{\"productId\": \"187b21e6-639b-42b4-8199-28e1a2e49f9c\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 10:10:36'),
('ee5021c1-6c23-4896-b81e-89352f25a805', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 19:11:32'),
('eecd8310-3c3b-4af8-ae72-bd655d9170fb', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:47:14'),
('f01a51f9-0b13-4657-8dbc-39acfa4c84fd', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:58:44'),
('f01f287b-6a89-4af4-92d9-9cf39e941358', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 09:16:15'),
('f111b0cf-c411-4841-930d-45926607e51b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'curl/8.7.1', '2025-06-25 03:05:25'),
('f1d776aa-63f8-41a8-8b9b-5b7a769ce578', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user admin@zettaz.com: Invalid password.', '{\"email\": \"admin@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 11:19:37'),
('f228eea1-0af1-46e9-af01-e875bd327dfe', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d adjusted from 150 to 148. Change: -2.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 148, \"oldStock\": 150, \"productId\": \"59bb58ed-3b8a-4cbe-90cb-4ffd9ec1b90d\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -2}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 22:05:09'),
('f29f52db-4a90-4db1-a788-274767fd2649', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 3753f5a9-56d3-4017-9e08-7abaff056b11 processed successfully for amount 1347.71. Items: 1.', '{\"saleId\": \"3753f5a9-56d3-4017-9e08-7abaff056b11\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": null, \"totalAmount\": 1347.7125, \"paymentMethodId\": \"e9ca7670-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 14:18:03'),
('f3628809-a359-44f8-b503-39e3a8f445d3', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-24 03:14:25'),
('f52ec232-393c-4e7a-a840-c310ddb65ef0', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 16:45:25'),
('f65fc804-600f-4dcd-bd1b-ff189e43ff51', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 13e744e6-0d28-4b34-860c-3f4a810b4b4a processed successfully for amount 1377.75. Items: 5.', '{\"saleId\": \"13e744e6-0d28-4b34-860c-3f4a810b4b4a\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 5, \"customerId\": \"7acc70a5-8372-425f-a28c-adb7c239457e\", \"totalAmount\": 1377.751875, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 12:21:15'),
('f6e2cb6f-9949-4c12-98cc-f5398a1af84e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID c4d1fe2b-c711-494c-93d1-e0932962a61e adjusted from 21 to 20. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 20, \"oldStock\": 21, \"productId\": \"c4d1fe2b-c711-494c-93d1-e0932962a61e\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 21:51:15'),
('f7a9ad3b-b1a8-43da-91ae-f315a8440e4e', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-19 08:53:00'),
('f7c6b931-d2af-4f8d-a1fe-03770206f1b8', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-24 02:58:08'),
('f85d94b6-7a31-452f-aea7-725bd19d3639', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-08 15:45:11'),
('f88d705f-d4df-4777-b96b-14d0ca6cba5b', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_UPDATED', 'Product \"N/A\" (ID: b193d1a1-94f6-405a-b13f-15a1d594f403) updated.', '{\"productId\": \"b193d1a1-94f6-405a-b13f-15a1d594f403\", \"updatedFields\": [\"promotional_offer_id = ?\"], \"requestedChanges\": {\"promotionalOfferId\": \"\"}}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-16 08:17:36'),
('f9224eac-db98-4f93-ba58-a054883aae6f', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'axios/1.10.0', '2025-07-08 18:34:50'),
('f93b201e-8661-4dac-948b-594feb71353c', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:21:07'),
('f9a83e73-0aea-48ae-b957-776c5bc123c7', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', '2025-06-05 20:56:28'),
('f9ef2e09-4151-434e-8383-ca9f8ddd4420', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', 'manager@zettaz.com', 'USER_LOGIN_FAILURE', 'Login attempt failed for user manager@zettaz.com: Invalid password.', '{\"email\": \"manager@zettaz.com\", \"reason\": \"Invalid password\", \"userId\": \"b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 12:30:18'),
('fa2d0d04-1fde-49ff-93d2-05a0009c37a6', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID a95dbb16-3ac2-48c8-a9b0-5a6e6656c884 adjusted from 21 to 20. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 20, \"oldStock\": 21, \"productId\": \"a95dbb16-3ac2-48c8-a9b0-5a6e6656c884\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 08:27:10'),
('fab06a10-e849-445f-9fee-76a8f4ffa652', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'USER_LOGIN_SUCCESS', 'User admin@zettaz.com logged in successfully.', '{\"email\": \"admin@zettaz.com\", \"userId\": \"a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-13 05:00:46'),
('fbc5a19e-4c2a-4f65-aa45-075330ea9e06', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID 3dcedd3f-0c34-44f5-b8da-08e372b219cf adjusted from 37 to 36. Change: -1.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 36, \"oldStock\": 37, \"productId\": \"3dcedd3f-0c34-44f5-b8da-08e372b219cf\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -1}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-08 09:32:00'),
('fbeaadcb-a209-446f-acbf-0783995f5f4b', 'e6eb6436-4665-11f0-9c38-525400148990', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', 'admin@deshvidesh.com', 'USER_LOGIN_SUCCESS', 'User admin@deshvidesh.com logged in successfully.', '{\"role\": \"admin\", \"email\": \"admin@deshvidesh.com\", \"userId\": \"c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-11 08:05:56'),
('fd563efa-5438-4b64-944d-00fbc658752d', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'PRODUCT_STOCK_ADJUSTED', 'Stock for product ID e03dc952-7f98-421d-924b-4f819abe666e adjusted from 484 to 472. Change: -12.', '{\"notes\": null, \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"newStock\": 472, \"oldStock\": 484, \"productId\": \"e03dc952-7f98-421d-924b-4f819abe666e\", \"reasonCode\": \"SALE_TRANSACTION\", \"adjustmentType\": \"DECREMENT\", \"quantityChanged\": -12}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:33:57'),
('fe43c0bc-da9c-46e6-9149-87a0fdbc35d4', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale dff4d19d-015e-4077-8d6a-e9e59bb56822 processed successfully for amount 2.71. Items: 1.', '{\"saleId\": \"dff4d19d-015e-4077-8d6a-e9e59bb56822\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 1, \"customerId\": \"7acc70a5-8372-425f-a28c-adb7c239457e\", \"totalAmount\": 2.70625, \"paymentMethodId\": \"e9ca7524-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 13:24:58'),
('ffe809cb-5bdc-4e3e-86ef-46d3ba6fed14', 'd7f267da-d5d9-4a15-b0d3-31ca710a4492', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', 'admin@zettaz.com', 'SALE_PROCESSED', 'Sale 6947bae0-c6eb-4e2c-b05e-fcc75cc3ec44 processed successfully for amount 11.98. Items: 2.', '{\"saleId\": \"6947bae0-c6eb-4e2c-b05e-fcc75cc3ec44\", \"storeId\": \"f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c\", \"itemCount\": 2, \"customerId\": null, \"totalAmount\": 11.983275, \"paymentMethodId\": \"e9ca76b3-35f4-11f0-8297-525400148990\"}', '::1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36', '2025-06-09 15:39:26');

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

CREATE TABLE `user_roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) NOT NULL,
  `role_id` char(36) NOT NULL,
  `store_id` char(36) DEFAULT NULL,
  `scope` enum('tenant','store') NOT NULL DEFAULT 'tenant',
  `assigned_by` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`id`, `user_id`, `role_id`, `store_id`, `scope`, `assigned_by`, `created_at`, `updated_at`) VALUES
('6bab0ecd-4c50-11f0-8dfa-525400d69130', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', '6b9f79c6-4c50-11f0-8dfa-525400d69130', NULL, 'tenant', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('6bab13b3-4c50-11f0-8dfa-525400d69130', 'c3g4z5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', '6b9f79c6-4c50-11f0-8dfa-525400d69130', NULL, 'tenant', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', '2025-06-18 14:27:53', '2025-06-19 01:42:25'),
('6bada7a8-4c50-11f0-8dfa-525400d69130', 'c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f', '6b9f8119-4c50-11f0-8dfa-525400d69130', 'f8c4c8e7-9f3d-4b4f-9c5d-6f7e8d9a0b1c', 'store', 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d', '2025-06-18 14:27:53', '2025-06-18 14:27:53'),
('8a0343d8-16f1-4ad7-9207-af3945352be7', 'b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e', '6b9f7f1a-4c50-11f0-8dfa-525400d69130', NULL, 'tenant', NULL, '2025-07-08 04:40:09', '2025-07-08 04:40:09');

-- --------------------------------------------------------

--
-- Table structure for table `user_system_roles`
--

CREATE TABLE `user_system_roles` (
  `user_id` char(36) NOT NULL,
  `role_id` char(36) NOT NULL,
  `assigned_by` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_category_name_per_tenant` (`tenant_id`,`name`),
  ADD KEY `fk_categories_created_by` (`created_by_user_id`),
  ADD KEY `fk_categories_updated_by` (`updated_by_user_id`);

--
-- Indexes for table `countries`
--
ALTER TABLE `countries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_countries_code` (`code`),
  ADD KEY `idx_countries_name` (`name`),
  ADD KEY `idx_countries_code3` (`code3`),
  ADD KEY `idx_countries_is_active` (`is_active`),
  ADD KEY `idx_countries_sort_order` (`sort_order`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_customers_store` (`store_id`),
  ADD KEY `fk_customers_created_by` (`created_by_user_id`),
  ADD KEY `fk_customers_updated_by` (`updated_by_user_id`),
  ADD KEY `idx_customers_tenant_id` (`tenant_id`),
  ADD KEY `idx_customers_email` (`tenant_id`,`email`),
  ADD KEY `idx_customers_phone_number` (`tenant_id`,`phone_number`),
  ADD KEY `idx_customers_loyalty_id` (`tenant_id`,`loyalty_id`),
  ADD KEY `idx_customers_is_active` (`is_active`),
  ADD KEY `idx_customers_country_id` (`country_id`);

--
-- Indexes for table `customer_activity_log`
--
ALTER TABLE `customer_activity_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer_activity_customer_id` (`customer_id`);

--
-- Indexes for table `customer_contacts`
--
ALTER TABLE `customer_contacts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer_contacts_customer_id` (`customer_id`);

--
-- Indexes for table `goods_received_notes`
--
ALTER TABLE `goods_received_notes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `grn_number` (`grn_number`),
  ADD KEY `idx_grn_supplier_id` (`supplier_id`),
  ADD KEY `idx_grn_purchase_order_id` (`purchase_order_id`),
  ADD KEY `idx_grn_received_by_user_id` (`received_by_user_id`),
  ADD KEY `idx_grn_status` (`status`);

--
-- Indexes for table `grn_items`
--
ALTER TABLE `grn_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_grn_item_grn_id` (`grn_id`),
  ADD KEY `idx_grn_item_product_id` (`product_id`),
  ADD KEY `idx_grn_item_po_item_id` (`purchase_order_item_id`),
  ADD KEY `idx_grn_items_po_item_id` (`purchase_order_item_id`),
  ADD KEY `idx_grn_items_grn_id` (`grn_id`);

--
-- Indexes for table `held_orders`
--
ALTER TABLE `held_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `store_id` (`store_id`),
  ADD KEY `cashier_id` (`cashier_id`);

--
-- Indexes for table `inventory_logs`
--
ALTER TABLE `inventory_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `offer_price_tiers`
--
ALTER TABLE `offer_price_tiers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_offer_price_tiers_tenant_store` (`tenant_id`,`store_id`),
  ADD KEY `idx_offer_price_tiers_offer` (`offer_id`);

--
-- Indexes for table `offer_rules`
--
ALTER TABLE `offer_rules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `idx_offer_rule` (`offer_id`,`rule_type`),
  ADD KEY `idx_offer_rule_store` (`store_id`);

--
-- Indexes for table `offer_usage`
--
ALTER TABLE `offer_usage`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `idx_offer_customer` (`offer_id`,`customer_id`),
  ADD KEY `idx_offer_usage_store` (`store_id`);

--
-- Indexes for table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_tenant_payment_code` (`tenant_id`,`code`),
  ADD KEY `idx_tenant` (`tenant_id`);

--
-- Indexes for table `payment_terminals`
--
ALTER TABLE `payment_terminals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tenant` (`tenant_id`),
  ADD KEY `idx_terminal_type` (`type`);

--
-- Indexes for table `payment_transactions`
--
ALTER TABLE `payment_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sale` (`sale_id`),
  ADD KEY `idx_payment_method` (`payment_method_id`),
  ADD KEY `idx_terminal` (`terminal_id`),
  ADD KEY `idx_tenant` (`tenant_id`),
  ADD KEY `idx_transaction` (`transaction_id`),
  ADD KEY `idx_reference` (`reference_id`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_permissions_name` (`name`);

--
-- Indexes for table `plans`
--
ALTER TABLE `plans`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `printer_settings`
--
ALTER TABLE `printer_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `store_id` (`store_id`),
  ADD KEY `template_id` (`template_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_sku_per_tenant` (`tenant_id`,`sku`),
  ADD UNIQUE KEY `unique_barcode_per_tenant` (`tenant_id`,`barcode`),
  ADD KEY `idx_products_tenant` (`tenant_id`),
  ADD KEY `idx_products_category` (`category_id`),
  ADD KEY `fk_products_tax_class` (`tax_class_id`),
  ADD KEY `idx_products_store` (`store_id`),
  ADD KEY `idx_products_promotional_offer_id` (`promotional_offer_id`);

--
-- Indexes for table `promotional_offers`
--
ALTER TABLE `promotional_offers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `store_id` (`store_id`),
  ADD KEY `idx_tenant_store_active` (`tenant_id`,`store_id`,`is_active`),
  ADD KEY `idx_dates` (`start_date`,`end_date`);

--
-- Indexes for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_po_tenant_id` (`tenant_id`),
  ADD KEY `idx_po_supplier_id` (`supplier_id`),
  ADD KEY `idx_po_store_id` (`store_id`),
  ADD KEY `fk_po_created_by` (`created_by_user_id`),
  ADD KEY `fk_po_updated_by` (`updated_by_user_id`),
  ADD KEY `idx_po_status` (`status`);

--
-- Indexes for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_poi_purchase_order_id` (`purchase_order_id`),
  ADD KEY `idx_poi_product_id` (`product_id`),
  ADD KEY `idx_poi_status` (`status`);

--
-- Indexes for table `receipt_templates`
--
ALTER TABLE `receipt_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_roles_tenant` (`tenant_id`),
  ADD KEY `fk_roles_created_by` (`created_by`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`role_id`,`permission_id`),
  ADD KEY `idx_rp_permission` (`permission_id`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sales_tenant` (`tenant_id`),
  ADD KEY `idx_sales_store` (`store_id`),
  ADD KEY `idx_sales_cashier` (`cashier_id`),
  ADD KEY `idx_sales_payment_status` (`payment_status`),
  ADD KEY `idx_sales_payment_method` (`payment_method`);

--
-- Indexes for table `sale_items`
--
ALTER TABLE `sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sale_items_sale` (`sale_id`),
  ADD KEY `idx_sale_items_product` (`product_id`);

--
-- Indexes for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sa_product_id` (`product_id`),
  ADD KEY `idx_sa_variant_id` (`variant_id`),
  ADD KEY `idx_sa_user_id` (`user_id`),
  ADD KEY `idx_sa_reason_code` (`reason_code`),
  ADD KEY `idx_sa_adjustment_date` (`adjustment_date`);

--
-- Indexes for table `stores`
--
ALTER TABLE `stores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `fk_stores_default_tax_class` (`default_tax_class_id`),
  ADD KEY `idx_stores_is_active` (`is_active`);

--
-- Indexes for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sub_tenant` (`tenant_id`),
  ADD KEY `idx_sub_plan` (`plan_id`),
  ADD KEY `idx_sub_status` (`status`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_suppliers_created_by` (`created_by_user_id`),
  ADD KEY `fk_suppliers_updated_by` (`updated_by_user_id`),
  ADD KEY `idx_suppliers_tenant_id` (`tenant_id`),
  ADD KEY `idx_suppliers_tenant_id_supplier_name` (`tenant_id`,`supplier_name`),
  ADD KEY `idx_suppliers_tenant_id_email` (`tenant_id`,`email`),
  ADD KEY `idx_suppliers_tenant_id_phone` (`tenant_id`,`phone`),
  ADD KEY `idx_suppliers_is_active` (`is_active`);

--
-- Indexes for table `system_permissions`
--
ALTER TABLE `system_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_system_permissions_name` (`name`);

--
-- Indexes for table `system_roles`
--
ALTER TABLE `system_roles`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `system_role_permissions`
--
ALTER TABLE `system_role_permissions`
  ADD PRIMARY KEY (`role_id`,`permission_id`),
  ADD KEY `idx_srp_permission` (`permission_id`);

--
-- Indexes for table `tax_classes`
--
ALTER TABLE `tax_classes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tax_classes_tenant` (`tenant_id`),
  ADD KEY `idx_store_id` (`store_id`),
  ADD KEY `idx_tax_classes_store` (`store_id`);

--
-- Indexes for table `tax_class_rates`
--
ALTER TABLE `tax_class_rates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tax_class_rates_class` (`tax_class_id`),
  ADD KEY `idx_tax_rates_store` (`store_id`);

--
-- Indexes for table `tenants`
--
ALTER TABLE `tenants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `domain` (`domain`);

--
-- Indexes for table `tenant_payment_settings`
--
ALTER TABLE `tenant_payment_settings`
  ADD PRIMARY KEY (`tenant_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `store_id` (`store_id`);

--
-- Indexes for table `users_backup_20250626051814474`
--
ALTER TABLE `users_backup_20250626051814474`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `store_id` (`store_id`);

--
-- Indexes for table `user_activity_logs`
--
ALTER TABLE `user_activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_activity_tenant_id` (`tenant_id`),
  ADD KEY `idx_user_activity_user_id` (`user_id`),
  ADD KEY `idx_user_activity_action_type` (`action_type`),
  ADD KEY `idx_user_activity_timestamp` (`timestamp`);

--
-- Indexes for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_role_scope` (`user_id`,`role_id`,`scope`,`store_id`),
  ADD KEY `idx_ur_role` (`role_id`),
  ADD KEY `idx_ur_scope` (`scope`,`store_id`),
  ADD KEY `fk_ur_store` (`store_id`);

--
-- Indexes for table `user_system_roles`
--
ALTER TABLE `user_system_roles`
  ADD PRIMARY KEY (`user_id`,`role_id`),
  ADD KEY `idx_usr_role` (`role_id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `categories`
--
ALTER TABLE `categories`
  ADD CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_categories_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_categories_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `fk_customers_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_customers_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_customers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_customers_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `goods_received_notes`
--
ALTER TABLE `goods_received_notes`
  ADD CONSTRAINT `fk_grn_purchase_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_grn_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_grn_user` FOREIGN KEY (`received_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `grn_items`
--
ALTER TABLE `grn_items`
  ADD CONSTRAINT `fk_grn_item_grn` FOREIGN KEY (`grn_id`) REFERENCES `goods_received_notes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_grn_item_po_item` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_grn_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `held_orders`
--
ALTER TABLE `held_orders`
  ADD CONSTRAINT `held_orders_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `held_orders_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `held_orders_ibfk_3` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `inventory_logs`
--
ALTER TABLE `inventory_logs`
  ADD CONSTRAINT `inventory_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_logs_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_logs_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `offer_price_tiers`
--
ALTER TABLE `offer_price_tiers`
  ADD CONSTRAINT `offer_price_tiers_ibfk_1` FOREIGN KEY (`offer_id`) REFERENCES `promotional_offers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `offer_rules`
--
ALTER TABLE `offer_rules`
  ADD CONSTRAINT `offer_rules_ibfk_1` FOREIGN KEY (`offer_id`) REFERENCES `promotional_offers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `offer_rules_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `offer_rules_ibfk_3` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`);

--
-- Constraints for table `offer_usage`
--
ALTER TABLE `offer_usage`
  ADD CONSTRAINT `offer_usage_ibfk_1` FOREIGN KEY (`offer_id`) REFERENCES `promotional_offers` (`id`),
  ADD CONSTRAINT `offer_usage_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `offer_usage_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `offer_usage_ibfk_4` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`);

--
-- Constraints for table `printer_settings`
--
ALTER TABLE `printer_settings`
  ADD CONSTRAINT `printer_settings_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `printer_settings_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `printer_settings_ibfk_3` FOREIGN KEY (`template_id`) REFERENCES `receipt_templates` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_product_tax_class` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_products_promotional_offers` FOREIGN KEY (`promotional_offer_id`) REFERENCES `promotional_offers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_products_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_products_tax_class` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `products_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `promotional_offers`
--
ALTER TABLE `promotional_offers`
  ADD CONSTRAINT `promotional_offers_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `promotional_offers_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`);

--
-- Constraints for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD CONSTRAINT `fk_po_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  ADD CONSTRAINT `fk_po_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`),
  ADD CONSTRAINT `fk_po_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  ADD CONSTRAINT `fk_poi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_poi_purchase_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `receipt_templates`
--
ALTER TABLE `receipt_templates`
  ADD CONSTRAINT `receipt_templates_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `roles`
--
ALTER TABLE `roles`
  ADD CONSTRAINT `fk_roles_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_roles_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sales_ibfk_3` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `sale_items`
--
ALTER TABLE `sale_items`
  ADD CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  ADD CONSTRAINT `stock_adjustments_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `stock_adjustments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT;

--
-- Constraints for table `stores`
--
ALTER TABLE `stores`
  ADD CONSTRAINT `fk_stores_default_tax_class` FOREIGN KEY (`default_tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `stores_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `fk_sub_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`),
  ADD CONSTRAINT `fk_sub_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD CONSTRAINT `fk_suppliers_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_suppliers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_suppliers_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `system_role_permissions`
--
ALTER TABLE `system_role_permissions`
  ADD CONSTRAINT `fk_srp_permission` FOREIGN KEY (`permission_id`) REFERENCES `system_permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_srp_role` FOREIGN KEY (`role_id`) REFERENCES `system_roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tax_classes`
--
ALTER TABLE `tax_classes`
  ADD CONSTRAINT `fk_tax_classes_store_id` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`),
  ADD CONSTRAINT `fk_tax_classes_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tax_class_rates`
--
ALTER TABLE `tax_class_rates`
  ADD CONSTRAINT `fk_tax_class_rates_class` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_tax_class_rates_store_id` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`);

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `users_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ur_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_system_roles`
--
ALTER TABLE `user_system_roles`
  ADD CONSTRAINT `fk_usr_role` FOREIGN KEY (`role_id`) REFERENCES `system_roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_usr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
