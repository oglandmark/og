-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Sep 27, 2026 at 10:10 PM
-- Server version: 11.6.1-MariaDB-log
-- PHP Version: 8.3.16

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `og_landmark_property_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `app_data`
--

CREATE TABLE `app_data` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `updated_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `app_data`
--

INSERT INTO `app_data` (`id`, `data`, `updated_at`) VALUES
(1, '{\"properties\":[{\"id\":1,\"title\":\"Luxurious Modern Villa in DHA Phase 8\",\"type\":\"Villa\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":125000000,\"area\":5500,\"bedrooms\":6,\"bathrooms\":7,\"city\":\"Lahore\",\"address\":\"Street 12, DHA Phase 8, Lahore\",\"society\":\"DHA Phase 8\",\"block\":\"Block H\",\"landmark\":\"Near DHA Phase 8 Gate\",\"nearbyPlaces\":{\"schools\":[\"The City School DHA\",\"Beaconhouse DHA Campus\"],\"hospitals\":[\"Shaukat Khanum Memorial Hospital\"],\"mosques\":[\"DHA Jamia Masjid\"],\"markets\":[\"DHA Phase 8 Commercial Area\"],\"metroStations\":[],\"motorwayDist\":\"15 km\"},\"description\":\"Exceptional modern villa featuring contemporary architecture, premium finishes, and expansive living spaces. Private pool, landscaped garden, and state-of-the-art amenities.\",\"amenities\":[\"Private Pool\",\"Home Theater\",\"Gym\",\"Garden\",\"Servant Quarters\",\"Security System\",\"3 Car Parking\",\"Central AC\",\"Solar System\",\"CCTV\",\"EV Charging\"],\"images\":[\"/images/property-1.jpg\",\"/images/property-5.jpg\",\"/images/property-3.jpg\",\"/images/property-2.jpg\"],\"agentId\":1,\"sellerId\":10,\"sellerName\":\"Salman Khan\",\"featured\":true,\"views\":820,\"inquiryCount\":12,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2023,\"constructionAge\":\"New\",\"furnishing\":\"Unfurnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Kanal\",\"areaInSqft\":5500,\"purpose\":\"For Sale\",\"tags\":[\"featured\",\"verified\",\"luxury\",\"smartHome\"],\"propertyScore\":{\"location\":4.9,\"construction\":5,\"investment\":4.8,\"amenities\":5,\"futureGrowth\":4.7,\"overall\":4.9},\"createdAt\":\"2024-01-15\"},{\"id\":2,\"title\":\"Premium 3-Bed Apartment in Bahria Town\",\"type\":\"Apartment\",\"status\":\"For Rent\",\"approvalStatus\":\"Active\",\"price\":85000,\"area\":1850,\"bedrooms\":3,\"bathrooms\":3,\"city\":\"Islamabad\",\"address\":\"Civic Centre, Bahria Town Phase 4, Islamabad\",\"society\":\"Bahria Town Phase 4\",\"block\":\"Civic Centre\",\"landmark\":\"Near Bahria Grand Mosque\",\"nearbyPlaces\":{\"schools\":[\"The Scholar School Bahria\",\"Roots School Bahria\"],\"hospitals\":[\"Bahria International Hospital\"],\"mosques\":[\"Bahria Grand Mosque\"],\"markets\":[\"Bahria Town Phase 4 Market\"],\"metroStations\":[],\"motorwayDist\":\"3 km\"},\"description\":\"Stunning apartment with panoramic city views and modern amenities. Open-concept design, high-end finishes, and access to world-class facilities.\",\"amenities\":[\"Clubhouse\",\"Swimming Pool\",\"Gym\",\"Balcony\",\"Central Heating\",\"Underground Parking\",\"24/7 Security\",\"Elevators\",\"Backup Generator\"],\"images\":[\"/images/property-2.jpg\",\"/images/property-5.jpg\",\"/images/property-1.jpg\"],\"agentId\":3,\"sellerId\":10,\"sellerName\":\"Salman Khan\",\"featured\":true,\"views\":560,\"inquiryCount\":8,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2022,\"constructionAge\":\"1 Year\",\"furnishing\":\"Semi Furnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Square Feet\",\"areaInSqft\":1850,\"purpose\":\"For Rent\",\"tags\":[\"featured\",\"verified\",\"newListing\"],\"propertyScore\":{\"location\":4.7,\"construction\":4.5,\"investment\":4.2,\"amenities\":4.8,\"futureGrowth\":4.5,\"overall\":4.5},\"createdAt\":\"2024-01-20\"},{\"id\":3,\"title\":\"Elegant 5 Bedroom House in Gulberg\",\"type\":\"House\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":68000000,\"area\":4200,\"bedrooms\":5,\"bathrooms\":5,\"city\":\"Lahore\",\"address\":\"Main Boulevard, Gulberg III, Lahore\",\"society\":\"Gulberg III\",\"block\":\"Main Boulevard\",\"landmark\":\"Near Gulberg Main Market\",\"nearbyPlaces\":{\"schools\":[\"LGS Gulberg\",\"Aitchison College\"],\"hospitals\":[\"Doctors Hospital\",\"Hameed Latif Hospital\"],\"mosques\":[\"Jamia Masjid Gulberg\"],\"markets\":[\"Liberty Market\",\"MM Alam Road\"],\"metroStations\":[\"Gulberg Orange Line Station\"],\"motorwayDist\":\"12 km\"},\"description\":\"Spacious and elegant house in the heart of Gulberg with premium finishes throughout. Perfect for families seeking upscale urban living.\",\"amenities\":[\"Garden\",\"Servant Quarters\",\"4 Car Parking\",\"Security System\",\"Solar System\",\"Generator\",\"Fiber Internet\",\"CCTV\"],\"images\":[\"/images/property-3.jpg\",\"/images/property-1.jpg\",\"/images/property-4.jpg\"],\"agentId\":1,\"sellerId\":10,\"sellerName\":\"Salman Khan\",\"featured\":false,\"views\":430,\"inquiryCount\":10,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2020,\"constructionAge\":\"5 Years\",\"furnishing\":\"Unfurnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Marla\",\"areaInSqft\":4200,\"purpose\":\"For Sale\",\"tags\":[\"verified\",\"hotArea\",\"corner\"],\"propertyScore\":{\"location\":4.8,\"construction\":4,\"investment\":4.5,\"amenities\":4.2,\"futureGrowth\":4.6,\"overall\":4.4},\"createdAt\":\"2024-01-10\"},{\"id\":4,\"title\":\"Spacious Penthouse with City View\",\"type\":\"Apartment\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":45000000,\"area\":3200,\"bedrooms\":4,\"bathrooms\":4,\"city\":\"Karachi\",\"address\":\"Clifton Block 5, Karachi\",\"society\":\"Clifton Block 5\",\"block\":\"Block 5\",\"landmark\":\"Near Clifton Beach\",\"nearbyPlaces\":{\"schools\":[\"Karachi Grammar School\"],\"hospitals\":[\"Aga Khan University Hospital\"],\"mosques\":[\"Clifton Mosque\"],\"markets\":[\"Clifton Block 9 Market\"],\"metroStations\":[],\"motorwayDist\":\"25 km\"},\"description\":\"Exclusive penthouse offering breathtaking city views with top-notch finishes and premium amenities in the heart of Clifton.\",\"amenities\":[\"Private Terrace\",\"Jacuzzi\",\"Smart Home\",\"Gym\",\"Concierge Service\",\"Swimming Pool\",\"Elevator\"],\"images\":[\"/images/property-4.jpg\",\"/images/property-6.jpg\",\"/images/property-2.jpg\"],\"agentId\":2,\"sellerId\":11,\"sellerName\":\"Hassan Raza\",\"featured\":true,\"views\":680,\"inquiryCount\":6,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2021,\"constructionAge\":\"5 Years\",\"furnishing\":\"Furnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Square Feet\",\"areaInSqft\":3200,\"purpose\":\"For Sale\",\"tags\":[\"featured\",\"verified\",\"luxury\",\"highROI\",\"parkFacing\"],\"propertyScore\":{\"location\":4.9,\"construction\":4.2,\"investment\":4.7,\"amenities\":4.9,\"futureGrowth\":4.4,\"overall\":4.6},\"createdAt\":\"2024-01-25\"},{\"id\":5,\"title\":\"Modern Commercial Plaza in Clifton\",\"type\":\"Commercial\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":180000000,\"area\":8500,\"bedrooms\":0,\"bathrooms\":4,\"city\":\"Karachi\",\"address\":\"Main Clifton Road, Karachi\",\"society\":\"Clifton\",\"block\":\"Main Clifton Road\",\"landmark\":\"Near Clifton Bridge\",\"nearbyPlaces\":{\"schools\":[],\"hospitals\":[\"Dr. Ziauddin Hospital\"],\"mosques\":[\"Clifton Mosque\"],\"markets\":[\"Clifton Commercial Market\"],\"metroStations\":[],\"motorwayDist\":\"22 km\"},\"description\":\"Prime commercial space in the most sought-after commercial area of Karachi. Ideal for offices, retail, or mixed-use development.\",\"amenities\":[\"Elevator\",\"Backup Generator\",\"Central AC\",\"Security\",\"Parking\",\"Fiber Internet\"],\"images\":[\"/images/property-5.jpg\",\"/images/property-3.jpg\"],\"agentId\":2,\"sellerId\":11,\"sellerName\":\"Hassan Raza\",\"featured\":false,\"views\":290,\"inquiryCount\":4,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2019,\"constructionAge\":\"10 Years\",\"furnishing\":\"Unfurnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Square Feet\",\"areaInSqft\":8500,\"purpose\":\"For Sale\",\"tags\":[\"verified\",\"highROI\",\"rentalIncome\",\"mainRoad\",\"corner\"],\"propertyScore\":{\"location\":4.6,\"construction\":3.5,\"investment\":4.8,\"amenities\":3.8,\"futureGrowth\":4.3,\"overall\":4.2},\"createdAt\":\"2024-02-01\"},{\"id\":6,\"title\":\"Affordable 2-Bed Apartment in E-11\",\"type\":\"Apartment\",\"status\":\"For Rent\",\"approvalStatus\":\"Active\",\"price\":55000,\"area\":1200,\"bedrooms\":2,\"bathrooms\":2,\"city\":\"Islamabad\",\"address\":\"E-11/2, Islamabad\",\"society\":\"E-11\",\"block\":\"Sector E-11/2\",\"landmark\":\"Near Islamabad Zoo\",\"nearbyPlaces\":{\"schools\":[\"The Educators E-11\",\"NUST\"],\"hospitals\":[\"PIMS Hospital\"],\"mosques\":[\"E-11 Masjid\"],\"markets\":[\"E-11 Market\"],\"metroStations\":[\"E-11 Metro Station\"],\"motorwayDist\":\"8 km\"},\"description\":\"Well-maintained apartment in a peaceful neighborhood perfect for small families or couples.\",\"amenities\":[\"Elevator\",\"Backup Generator\",\"Security\",\"Parking\"],\"images\":[\"/images/property-6.jpg\",\"/images/property-4.jpg\"],\"agentId\":3,\"sellerId\":12,\"sellerName\":\"Maria Ali\",\"featured\":false,\"views\":340,\"inquiryCount\":5,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2018,\"constructionAge\":\"10 Years\",\"furnishing\":\"Semi Furnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Square Feet\",\"areaInSqft\":1200,\"purpose\":\"For Rent\",\"tags\":[\"newListing\"],\"propertyScore\":{\"location\":4,\"construction\":3.5,\"investment\":3.8,\"amenities\":3.5,\"futureGrowth\":4.2,\"overall\":3.8},\"createdAt\":\"2024-02-05\"},{\"id\":7,\"title\":\"10-Acre Mango Orchard in Rahim Yar Khan\",\"type\":\"Orchard\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":8500000,\"area\":435600,\"bedrooms\":0,\"bathrooms\":0,\"city\":\"Rahim Yar Khan\",\"address\":\"Liaquatpur Road, Rahim Yar Khan\",\"society\":null,\"block\":null,\"landmark\":\"Near Rahim Yar Khan City\",\"nearbyPlaces\":{\"schools\":[],\"hospitals\":[\"DHQ Hospital RYK\"],\"mosques\":[\"Local Mosque\"],\"markets\":[\"Liaquatpur Market\"],\"metroStations\":[],\"motorwayDist\":\"15 km\"},\"description\":\"Highly productive mango orchard with established trees and bore well irrigation. Excellent investment opportunity.\",\"amenities\":[\"Bore Well\",\"Solar Pumping\",\"Caretaker House\",\"Boundary Wall\"],\"images\":[\"/images/property-5.jpg\",\"/images/property-6.jpg\"],\"agentId\":5,\"sellerId\":14,\"sellerName\":\"Muhammad Tariq\",\"featured\":false,\"views\":180,\"inquiryCount\":3,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":null,\"constructionAge\":null,\"furnishing\":null,\"availability\":\"Ready to Move\",\"areaUnit\":\"Acre\",\"areaInSqft\":435600,\"purpose\":\"For Sale\",\"tags\":[\"verified\",\"highROI\",\"orchard\",\"tubeWell\"],\"propertyScore\":{\"location\":3.5,\"construction\":3,\"investment\":4.5,\"amenities\":3.2,\"futureGrowth\":4,\"overall\":3.6},\"createdAt\":\"2024-02-10\"},{\"id\":8,\"title\":\"25-Acre Fertile Farmland in Okara\",\"type\":\"Agriculture Land\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":30000000,\"area\":1089000,\"bedrooms\":0,\"bathrooms\":0,\"city\":\"Okara\",\"address\":\"Renala Khurd Road, Okara\",\"society\":null,\"block\":null,\"landmark\":\"Near Renala Khurd Town\",\"nearbyPlaces\":{\"schools\":[],\"hospitals\":[\"THQ Hospital Renala\"],\"mosques\":[\"Village Mosque\"],\"markets\":[\"Renala Market\"],\"metroStations\":[],\"motorwayDist\":\"5 km\"},\"description\":\"Premium agricultural land in Okara district with canal irrigation available. Ideal for wheat, rice, and sugarcane cultivation.\",\"amenities\":[\"Canal Irrigation\",\"Electricity\",\"Road Access\",\"Flat Land\"],\"images\":[\"/images/property-6.jpg\",\"/images/property-5.jpg\"],\"agentId\":5,\"sellerId\":14,\"sellerName\":\"Muhammad Tariq\",\"featured\":false,\"views\":220,\"inquiryCount\":4,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":null,\"constructionAge\":null,\"furnishing\":null,\"availability\":\"Ready to Move\",\"areaUnit\":\"Acre\",\"areaInSqft\":1089000,\"purpose\":\"For Sale\",\"tags\":[\"verified\",\"highROI\",\"riceLand\",\"canalWater\",\"roadFront\"],\"propertyScore\":{\"location\":3.2,\"construction\":2.5,\"investment\":4.8,\"amenities\":2.8,\"futureGrowth\":4.2,\"overall\":3.5},\"createdAt\":\"2024-02-12\"},{\"description\":\"Created by CMS smoke test\",\"type\":\"Villa\",\"price\":25000000,\"purpose\":\"Sale\",\"city\":\"Lahore\",\"bedrooms\":5,\"images\":[],\"publish\":true,\"bathrooms\":4,\"area\":2500,\"title\":\"CMS Test Villa\",\"featured\":true,\"id\":1000,\"sellerId\":1,\"sellerName\":\"Admin\",\"createdAt\":\"2026-09-24T20:25:31.585945Z\",\"updatedAt\":\"2026-09-24T20:25:31.586538Z\",\"approvalStatus\":\"Active\",\"listingStatus\":\"Active\",\"views\":0,\"inquiryCount\":0,\"priority\":false,\"createdByAdmin\":true},{\"city\":\"Lahore\",\"approvalStatus\":\"Pending\",\"sellerId\":1005,\"type\":\"House\",\"price\":1000000,\"title\":\"Smoke Seller Listing\",\"status\":\"For Sale\",\"id\":1006,\"sellerName\":\"S P\",\"createdAt\":\"2026-09-24T22:06:46.265423Z\",\"updatedAt\":\"2026-09-24T22:06:46.266337Z\",\"listingStatus\":\"Pending\",\"views\":0,\"inquiryCount\":0,\"images\":[],\"featured\":false,\"priority\":false,\"createdByAdmin\":false}],\"users\":[{\"id\":1,\"name\":\"Admin\",\"email\":\"oggroup834@gmail.com\",\"phone\":\"+92 304 2569000\",\"role\":\"Admin\",\"status\":\"Active\",\"password\":\"pbkdf2:d47f640e6b74b552d22695eff08c72b9:10bb5ef822564a865a67c2875e981798cc2715cb1fce0156c214af53e21fdbaaa0ed425f04ccb2d1895f9a1f01f8290cea9c26b23e2644a7a4a202ee3723aa0b\",\"joinedDate\":\"2023-01-01\"},{\"id\":2,\"name\":\"Ali Hassan\",\"email\":\"ali.agent@og.com\",\"phone\":\"+92 300 1111111\",\"city\":\"Lahore\",\"specialization\":\"Luxury\",\"title\":\"Senior Property Consultant\",\"experience\":\"7 Years\",\"license\":\"RERA-2017-002\",\"languages\":\"Urdu, Punjabi, English\",\"bio\":\"Specialist in luxury residential properties across Lahore. 7+ years of experience.\",\"role\":\"Agent\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:38c8c98f6e0997baf2157d55c5318ed8:ea26d06eb1018de89e1a99f01d37b318ad8a3e3d89b9a0952d7f44552d177bc19902a082c91db209b4d79d5412d3cfa56d547140f578bc963e9664813e01d0c6\",\"joinedDate\":\"2024-01-01\",\"createdByAdmin\":true,\"photo\":null,\"rating\":null},{\"id\":3,\"name\":\"Sara Ahmed\",\"email\":\"sara.agent@og.com\",\"phone\":\"+92 300 2222222\",\"city\":\"Islamabad\",\"specialization\":\"Residential\",\"title\":\"Property Consultant\",\"experience\":\"4 Years\",\"license\":\"RERA-2020-003\",\"languages\":\"Urdu, English\",\"bio\":\"Expert in residential and rental properties in Islamabad and Rawalpindi.\",\"role\":\"Agent\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:7fd4e157c7497d3bfc82a93f1aaee166:91496acd479a385bae20f3b5b57938d46e5195d3173200d4ad44b2129cd2c5c2186095105d4d72bc19d4dd2ab0598d16f4e470f2f81b2ff87bc7c45a1979cf87\",\"joinedDate\":\"2024-01-01\",\"createdByAdmin\":true,\"photo\":null,\"rating\":null},{\"id\":4,\"name\":\"Usman Ahmed\",\"email\":\"usman@example.com\",\"phone\":\"+92 300 1234567\",\"role\":\"Buyer\",\"status\":\"Active\",\"password\":\"pbkdf2:0163d459ed9e7e4ac219595c9e0e74c8:39d0e9f9e893823fd0cd9d2682442a08d9e16d3402e7efa133325842afdbbbcc8fe2de5bfc8bdbf84ccbb275e21b76943445fdb4ad8921656d94299545f5f0fd\",\"joinedDate\":\"2023-06-15\"},{\"id\":5,\"name\":\"Bilal Malik\",\"email\":\"bilal.agent@og.com\",\"phone\":\"+92 300 5555555\",\"city\":\"Okara\",\"specialization\":\"Agriculture\",\"title\":\"Agricultural Land Specialist\",\"experience\":\"6 Years\",\"license\":\"RERA-2018-005\",\"languages\":\"Urdu, Punjabi\",\"bio\":\"Expert in agricultural land, farmhouses, and rural properties in Punjab.\",\"role\":\"Agent\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:b88216f32e74061ba6c0344a287683bb:fbb9e7c67dc2134152b82ca1344b64d8c693fcaac7d0e969de38b4e6a7244df47adcd980f4b072f5bce5eba2c03a0032b935beb7a8e12dc1b1ec60f54a160a58\",\"joinedDate\":\"2024-01-01\",\"createdByAdmin\":true,\"photo\":null,\"rating\":null},{\"id\":10,\"name\":\"Salman Khan\",\"email\":\"salman@example.com\",\"phone\":\"+92 321 9876543\",\"role\":\"Seller\",\"status\":\"Active\",\"password\":\"pbkdf2:5b5e2329e4f1f243587247570db3040a:193339a88ac6a5acabc98ba4df615190ce1774256a60756b0997aaa6de3171b0dee5039139b87f9f6574a22a1b312459c6b9ea70cd918ecafe16f679952dd2e2\",\"joinedDate\":\"2023-03-10\"},{\"id\":11,\"name\":\"Hassan Raza\",\"email\":\"hassan@example.com\",\"phone\":\"+92 333 4567890\",\"role\":\"Seller\",\"status\":\"Active\",\"password\":\"pbkdf2:ab81ba330c690aebb6308e2042ec5fdf:174637b4d3319363c71b742a0436e49cbec64ef100a4b6582628cf9157f569e2eca395f2b495bc3a9e5f4695891ae4b29bec885a385f786b0ac0e3664e654ab7\",\"joinedDate\":\"2023-04-20\"},{\"id\":12,\"name\":\"Zainab Khan\",\"email\":\"zainab@example.com\",\"phone\":\"+92 345 2468135\",\"role\":\"Buyer\",\"status\":\"Active\",\"password\":\"pbkdf2:9ec87c035b0c459dbe76c9699cc082c9:b4a1c5d5a6b9c367508dff0da88dc100ca234605c9001a7bbd4344ee7e28c6e1c7b7fedae8e080ff2c01f1978db547b86a3a37e0ee625498753bd1fb1bf18e10\",\"joinedDate\":\"2023-07-01\"},{\"id\":13,\"name\":\"Shahid Malik\",\"email\":\"shahid@example.com\",\"phone\":\"+92 300 8765432\",\"role\":\"Buyer\",\"status\":\"Active\",\"password\":\"pbkdf2:30f26bdf2b37618b5ff38020d326748c:d861a341d8225ce51763dd430e4df66cd4e97675620230a41ec257c250e9a7bb817c85dde34b308129300734aac9c2b8e223070873e949ab171b3fef76ae65e0\",\"joinedDate\":\"2023-05-12\"},{\"id\":14,\"name\":\"Maria Ali\",\"email\":\"maria@example.com\",\"phone\":\"+92 321 1357924\",\"role\":\"Seller\",\"status\":\"Active\",\"password\":\"pbkdf2:b885044ecb08ec769b522ecb8f60eb02:a152e0aa22f802d70d038f013377a34c95847edb7718a7605e17c5de87fef77931bf431fba64b939316e85fda610d71515f3b8aaba45c72eb863e87b234ebd3a\",\"joinedDate\":\"2023-08-05\"},{\"id\":15,\"name\":\"Kamran Ahmed\",\"email\":\"kamran@example.com\",\"phone\":\"+92 300 2468135\",\"role\":\"Buyer\",\"status\":\"Active\",\"password\":\"pbkdf2:62614ee89298d2a98a498729dc2fda97:7b5d5a46181450364644e186c56d5475c2cc5594f12414ff8136cde02b1ea781785373691cd52657a4f9d47ae33eab11039e59a8342c0b984601f513dbde7993\",\"joinedDate\":\"2023-09-18\"},{\"id\":1001,\"name\":\"Smoke Buyer\",\"email\":\"buyer_smoke_1477914193@test.local\",\"username\":null,\"phone\":\"03001234567\",\"city\":null,\"role\":\"Buyer\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:390eeb2c14b7cab652e7ad2e29b4912f:b67f70fd9e74d52ebbc0d83ddca49cf39a1491973ab758eae944908719a45465a02f643385ad8a75bd4c7eb994edaf67d36e25b77b617a19b370532be3a12ba3\",\"joinedDate\":\"2026-09-24T22:05:29.821160Z\"},{\"id\":1002,\"name\":\"Smoke Seller\",\"email\":\"seller_smoke_2031751383@test.local\",\"username\":null,\"phone\":\"03007654321\",\"city\":null,\"role\":\"Seller\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:8dfb8ef3ed0694faa541aa8e44b9b795:7424145eb2ff07d8c49e74ecb6eb64242c806fc1c8fbec7d194e0ba1733c0c5606493f49e074f9de37752d48b09516d40bae327d163e6d114a8d71ddab696994\",\"joinedDate\":\"2026-09-24T22:05:30.958913Z\"},{\"id\":1003,\"name\":\"Smoke Agent\",\"email\":\"agent_smoke_1980748245@test.local\",\"username\":null,\"phone\":\"03001112233\",\"city\":\"Lahore\",\"role\":\"Agent\",\"status\":\"Pending\",\"approvalStatus\":\"Pending\",\"password\":\"pbkdf2:4a56925a9c6a98b950857193b5de9857:23fc638d67f84fb85205325b862f0518906ab2ff506977179056ece676ad52bb1f4bda7c1670d7d67d05867fe6c51e48d952b97834c8df5974c7e73ce208df4d\",\"joinedDate\":\"2026-09-24T22:05:33.953462Z\",\"specialization\":\"Residential\"},{\"id\":1004,\"name\":\"P Agent\",\"email\":\"agent_pending_1537301913@test.local\",\"username\":null,\"phone\":\"03009998877\",\"city\":null,\"role\":\"Agent\",\"status\":\"Pending\",\"approvalStatus\":\"Pending\",\"password\":\"pbkdf2:4d8b803b6c16abe3f134526c69babdda:dc2ef02760ce6b4a936b60c8d7575f33216341e8597a3c9b2da489d9d90047ec02eb22d3094b46e6bbb1908acb2d009e56a5d93d582c6af0cd562177397fb681\",\"joinedDate\":\"2026-09-24T22:06:21.909857Z\"},{\"id\":1005,\"name\":\"S P\",\"email\":\"seller_prop_2117125295@test.local\",\"username\":null,\"phone\":\"03001230000\",\"city\":null,\"role\":\"Seller\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:76128b2369a92f05997eadc230fb0fd2:28e6a816918a92c9e6ae59b156ec8507a65b1a59e7ba094710f3420cd8505d343f983ff51a793af76756ee00982321299ec72b1b3c9490f568147ef99fff95fe\",\"joinedDate\":\"2026-09-24T22:06:45.777738Z\"},{\"id\":1007,\"name\":\"E2E Buyer\",\"email\":\"e2e.buyer.20260927@oglandmark.test\",\"username\":null,\"phone\":\"03001112233\",\"city\":null,\"role\":\"Buyer\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:effe4254ac9edf64bfb5c9b820ff8062:97a606f83b7ad666440197c3c57a3aed567e572a4a0dd037087eb32aea73fd97e3a4668cd2ea0c204b6e36efa464b61ba793d4c22b1f496ee4ad371e4e097618\",\"joinedDate\":\"2026-09-27T14:57:07.736385Z\"},{\"id\":1008,\"name\":\"E2E Admin\",\"email\":\"e2e.admin.20260927@oglandmark.test\",\"phone\":\"+92 300 0000999\",\"role\":\"Admin\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:39cf9a792c19676665c67553e187e4ab:d21b67a50b8aa79408a8288c1674b1ed9a6e92dc865c32a7182facceb4737ddb26e51e438bf889c55a149d7d6276b023dff67fad905bfb91326b1e4852d92312\",\"joinedDate\":\"2026-09-27\",\"createdByAdmin\":true},{\"id\":1011,\"name\":\"E2E Seller\",\"email\":\"e2e.seller.1790521997004@oglandmark.test\",\"username\":null,\"phone\":null,\"city\":null,\"role\":\"Seller\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:fd191e91b680d0d9012c18c5bf145cf6:fa2484c62250900a10a2a7064a207029aab9189c3f5305ada3d6f8e12e08afa98e295202f4857f9bdd8ac639896bd9dffe85adcbcc89c24a86924c0011133b8d\",\"joinedDate\":\"2026-09-27T15:13:17.908210Z\"},{\"id\":1012,\"name\":\"Platform Admin\",\"email\":\"admin@gmail.com\",\"role\":\"Admin\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:5701c9bf12288abaddc37e02a30c7be3:2895e57a94688864d7f453ecf87d05aaedb1138001997a76eae58dc109f633977301782c5593d5073e4a7fad7fdd113dff05538daa9501b438e5f83ac51b06ed\",\"joinedDate\":\"2026-09-27T20:49:38.469666Z\"},{\"id\":1013,\"name\":\"E2E Buyer\",\"email\":\"buyer_e2e_921949460@example.com\",\"username\":null,\"phone\":null,\"city\":null,\"role\":\"Buyer\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:9a654783c23a9ebb6d235b116fc18522:0cff0a2f6d452d1f3aad10c0bdf2f902721ec3b565dafa6253b446b6175bf3c419777658adc9bb666ff1325b472b66537027e00d6e0a19389e5ed7fb6ac6218a\",\"joinedDate\":\"2026-09-27T21:19:42.172027Z\"},{\"id\":1014,\"name\":\"Browser Buyer\",\"email\":\"buyer_browser_122084040@example.com\",\"username\":null,\"phone\":null,\"city\":null,\"role\":\"Buyer\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:329140fba38ecc34fe26ff89982ed219:e72058bea8ae3f5f1257d3103083a3a9ff554eb7bcce9fa316854969179e3fc1460abd39c56f63812f304306259d101b00e4fca2dc4ac38f8f80d73248d9b6eb\",\"joinedDate\":\"2026-09-27T21:24:28.682132Z\"},{\"id\":1015,\"name\":\"PW2 Buyer\",\"email\":\"pw2_1790544357706@example.com\",\"username\":null,\"phone\":null,\"city\":null,\"role\":\"Buyer\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:79e0ae623f93d5de5d26163d24e7e163:375cc9203d387c500032030f09d704f079d041c0cbd87a495153e4e4b1010c74524dcd1aea909a1feabb0fa6082182c97af604f029ed0b41b863cff757f55acf\",\"joinedDate\":\"2026-09-27T21:25:59.468124Z\"},{\"id\":1016,\"name\":\"PW3 Buyer\",\"email\":\"pw3_1790544404852@example.com\",\"username\":null,\"phone\":null,\"city\":null,\"role\":\"Buyer\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:c695b2712d0a468da612a1c635ffffac:8c3f2049cb3569bef486be6cad28ce08005db30b8ad9f56e1bf75db65c746f4f2ce77bf38d352ce9097549cd24e92949249da3d8cf73e0f9e2c0e442cae1d7e5\",\"joinedDate\":\"2026-09-27T21:26:46.839898Z\"},{\"id\":1017,\"name\":\"PW4 Buyer\",\"email\":\"pw4_1790544425397@example.com\",\"username\":null,\"phone\":null,\"city\":null,\"role\":\"Buyer\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:0e65ae77610682e0aa121317bcdd48f1:1fd422039dfe165f8cff3b83c35b767902e015e96fdccc2c71b772a9610b206c2fab8f5648db1642c72a4a6f51e75d4bccb567eb816bef75f1ae4b0aef296ca2\",\"joinedDate\":\"2026-09-27T21:27:06.459684Z\"},{\"id\":1018,\"name\":\"PW5 Buyer\",\"email\":\"pw5_1790544441423@example.com\",\"username\":null,\"phone\":null,\"city\":null,\"role\":\"Buyer\",\"status\":\"Active\",\"approvalStatus\":\"Approved\",\"password\":\"pbkdf2:f8c2fcaca7fd44bc192f79d7a1648685:ceb1270f39c92d76ce0cdd67cab755c767b328289856f02d165bb090fdc69b6c563740adcb20f92d0ff25cdcea694e4a3116adc5d5eaf565a153e1d58ef00dc8\",\"joinedDate\":\"2026-09-27T21:27:22.342955Z\"}],\"inquiries\":[{\"id\":1,\"propertyId\":1,\"propertyTitle\":\"Luxurious Modern Villa in DHA Phase 8\",\"clientName\":\"Usman Ahmed\",\"email\":\"usman@example.com\",\"phone\":\"+92 300 1234567\",\"message\":\"I am very interested in this villa. Can we arrange a viewing this weekend?\",\"sellerId\":10,\"buyerId\":4,\"status\":\"Pending\",\"reply\":null,\"replyDate\":null,\"date\":\"2024-01-25\",\"agentId\":1},{\"id\":2,\"propertyId\":2,\"propertyTitle\":\"Premium 3-Bed Apartment in Bahria Town\",\"clientName\":\"Zainab Khan\",\"email\":\"zainab@example.com\",\"phone\":\"+92 345 2468135\",\"message\":\"What is the minimum lease period for this apartment?\",\"sellerId\":10,\"buyerId\":12,\"status\":\"Contacted\",\"reply\":\"Minimum lease is 12 months. Happy to arrange a viewing.\",\"replyDate\":\"2024-01-24\",\"date\":\"2024-01-24\",\"agentId\":3},{\"id\":3,\"propertyId\":5,\"propertyTitle\":\"Modern Commercial Plaza in Clifton\",\"clientName\":\"Shahid Malik\",\"email\":\"shahid@example.com\",\"phone\":\"+92 300 8765432\",\"message\":\"We are looking for office space. Is this property available for lease?\",\"sellerId\":11,\"buyerId\":13,\"status\":\"Contacted\",\"reply\":null,\"replyDate\":null,\"date\":\"2024-01-23\",\"agentId\":2},{\"id\":4,\"propertyId\":4,\"propertyTitle\":\"Spacious Penthouse with City View\",\"clientName\":\"Maria Ali\",\"email\":\"maria@example.com\",\"phone\":\"+92 321 1357924\",\"message\":\"Interested in the penthouse. What are the maintenance charges?\",\"sellerId\":11,\"buyerId\":null,\"status\":\"Pending\",\"reply\":null,\"replyDate\":null,\"date\":\"2024-01-25\",\"agentId\":2},{\"id\":5,\"propertyId\":3,\"propertyTitle\":\"Elegant 5 Bedroom House in Gulberg\",\"clientName\":\"Hassan Raza\",\"email\":\"hassan@example.com\",\"phone\":\"+92 333 4567890\",\"message\":\"Price seems high. Is the seller open to negotiation?\",\"sellerId\":10,\"buyerId\":null,\"status\":\"Closed\",\"reply\":null,\"replyDate\":null,\"date\":\"2024-01-20\",\"agentId\":1},{\"propertyId\":1,\"message\":\"E2E-INQ-20260927195806\",\"propertyTitle\":\"E2E Test Property\",\"phone\":\"03001112233\",\"email\":\"e2e.buyer.20260927@oglandmark.test\",\"status\":\"Pending\",\"clientName\":\"E2E Buyer\",\"id\":\"inquiries_3ad6d9e757a8790a\",\"userId\":1007,\"createdAt\":\"2026-09-27T14:58:06.290310Z\"},{\"propertyId\":1,\"propertyTitle\":\"Browser E2E Inquiry\",\"clientName\":\"E2E Buyer\",\"email\":\"e2e.buyer.20260927@oglandmark.test\",\"phone\":\"03001112233\",\"message\":\"E2E-BROWSER-INQ-1790521392939\",\"status\":\"Pending\",\"id\":\"inquiries_88fdd659180cf3fa\",\"userId\":1007,\"createdAt\":\"2026-09-27T15:03:13.286706Z\"}],\"offers\":[{\"id\":1,\"propertyId\":1,\"propertyTitle\":\"Luxurious Modern Villa in DHA Phase 8\",\"propertyImage\":\"/images/property-1.jpg\",\"buyerId\":4,\"buyerName\":\"Usman Ahmed\",\"buyerPhone\":\"+92 300 1234567\",\"sellerId\":10,\"amount\":120000000,\"message\":\"I am very interested in this property. Please consider my offer.\",\"status\":\"Pending\",\"counterAmount\":null,\"counterMessage\":null,\"date\":\"2024-02-12\"},{\"id\":2,\"propertyId\":3,\"propertyTitle\":\"Elegant 5 Bedroom House in Gulberg\",\"propertyImage\":\"/images/property-3.jpg\",\"buyerId\":4,\"buyerName\":\"Usman Ahmed\",\"buyerPhone\":\"+92 300 1234567\",\"sellerId\":10,\"amount\":65000000,\"message\":\"Great property. Offering a fair market price.\",\"status\":\"Accepted\",\"counterAmount\":null,\"counterMessage\":null,\"date\":\"2024-01-28\"},{\"id\":3,\"propertyId\":4,\"propertyTitle\":\"Spacious Penthouse with City View\",\"propertyImage\":\"/images/property-4.jpg\",\"buyerId\":12,\"buyerName\":\"Zainab Khan\",\"buyerPhone\":\"+92 345 2468135\",\"sellerId\":11,\"amount\":43000000,\"message\":\"Keen buyer. Can close quickly.\",\"status\":\"Rejected\",\"counterAmount\":null,\"counterMessage\":null,\"date\":\"2024-02-05\"}],\"appointments\":[{\"id\":1,\"propertyId\":1,\"propertyTitle\":\"Luxurious Modern Villa in DHA Phase 8\",\"propertyAddress\":\"Street 12, DHA Phase 8, Lahore\",\"buyerId\":4,\"buyerName\":\"Usman Ahmed\",\"sellerId\":10,\"date\":\"2024-02-15\",\"time\":\"10:00 AM\",\"type\":\"Site Visit\",\"status\":\"Upcoming\",\"notes\":\"\",\"agentId\":1},{\"id\":2,\"propertyId\":2,\"propertyTitle\":\"Premium 3-Bed Apartment in Bahria Town\",\"propertyAddress\":\"Civic Centre, Bahria Town Phase 4\",\"buyerId\":4,\"buyerName\":\"Usman Ahmed\",\"sellerId\":10,\"date\":\"2024-02-16\",\"time\":\"02:00 PM\",\"type\":\"Site Visit\",\"status\":\"Upcoming\",\"notes\":\"\",\"agentId\":3},{\"id\":3,\"propertyId\":3,\"propertyTitle\":\"Elegant 5 Bedroom House in Gulberg\",\"propertyAddress\":\"Main Boulevard, Gulberg III\",\"buyerId\":4,\"buyerName\":\"Usman Ahmed\",\"sellerId\":10,\"date\":\"2024-01-20\",\"time\":\"11:00 AM\",\"type\":\"Video Call\",\"status\":\"Completed\",\"notes\":\"\",\"agentId\":1}],\"conversations\":[{\"id\":1,\"propertyId\":1,\"propertyTitle\":\"Luxurious Modern Villa in DHA Phase 8\",\"participants\":[4,2],\"participantNames\":[\"Usman Ahmed\",\"Ahmed Hassan\"],\"agentImage\":\"/images/agent-1.jpg\",\"lastUpdated\":\"2026-07-27T08:44:40.255Z\",\"messages\":[{\"id\":1,\"senderId\":1,\"senderName\":\"Ahmed Hassan\",\"text\":\"Hello Usman, I\'ve confirmed with the seller. The viewing for the DHA Phase 8 Villa is scheduled for tomorrow at 10:00 AM.\",\"timestamp\":\"2026-07-27T06:44:40.255Z\"},{\"id\":2,\"senderId\":4,\"senderName\":\"Usman Ahmed\",\"text\":\"That sounds great. I\'ll be there on time.\",\"timestamp\":\"2026-07-27T07:44:40.255Z\"},{\"id\":3,\"senderId\":1,\"senderName\":\"Ahmed Hassan\",\"text\":\"Perfect. Please bring your CNIC just in case security asks at the gate. See you tomorrow!\",\"timestamp\":\"2026-07-27T08:14:40.255Z\"}]},{\"id\":2,\"propertyId\":2,\"propertyTitle\":\"Premium 3-Bed Apartment in Bahria Town\",\"participants\":[4,2],\"participantNames\":[\"Usman Ahmed\",\"Fatima Khan\"],\"agentImage\":\"/images/agent-2.jpg\",\"lastUpdated\":\"2026-07-26T08:44:40.255Z\",\"messages\":[{\"id\":4,\"senderId\":2,\"senderName\":\"Fatima Khan\",\"text\":\"Here are the documents you requested. Please review and let me know.\",\"timestamp\":\"2026-07-26T08:44:40.255Z\"}]},{\"id\":3,\"propertyId\":3,\"propertyTitle\":\"Elegant 5 Bedroom House in Gulberg\",\"participants\":[4,3],\"participantNames\":[\"Usman Ahmed\",\"Bilal Rashid\"],\"agentImage\":\"/images/agent-3.jpg\",\"lastUpdated\":\"2026-07-24T08:44:40.255Z\",\"messages\":[{\"id\":5,\"senderId\":3,\"senderName\":\"Bilal Rashid\",\"text\":\"Yes, the price is negotiable. The seller is open to offers above 62 Cr.\",\"timestamp\":\"2026-07-24T08:44:40.255Z\"}]}],\"notifications\":[{\"id\":1,\"type\":\"appointment\",\"title\":\"Appointment Reminder\",\"message\":\"Your site visit for DHA Phase 8 Villa is tomorrow at 10:00 AM.\",\"forPortal\":\"buyer\",\"read\":false,\"timestamp\":\"2026-07-27T06:44:40.255Z\",\"link\":\"/user/appointments\"},{\"id\":2,\"type\":\"message\",\"title\":\"New Message\",\"message\":\"Ahmed Hassan replied to your inquiry about the commercial plaza.\",\"forPortal\":\"buyer\",\"read\":false,\"timestamp\":\"2026-07-27T03:44:40.255Z\",\"link\":\"/user/messages\"},{\"id\":3,\"type\":\"system\",\"title\":\"Price Drop Alert\",\"message\":\"\\\"Elegant 5 Bedroom House in Gulberg\\\" price dropped by 2%.\",\"forPortal\":\"buyer\",\"read\":true,\"timestamp\":\"2026-07-26T08:44:40.255Z\",\"link\":null},{\"id\":4,\"type\":\"inquiry\",\"title\":\"New Lead\",\"message\":\"Usman Ahmed enquired about DHA Phase 8 Villa.\",\"forPortal\":\"seller\",\"read\":false,\"timestamp\":\"2026-07-27T07:44:40.255Z\",\"link\":\"/seller/leads\"},{\"id\":5,\"type\":\"offer\",\"title\":\"New Offer Received\",\"message\":\"Usman Ahmed made an offer of PKR 1.20 Cr on Villa.\",\"forPortal\":\"seller\",\"read\":false,\"timestamp\":\"2026-07-27T06:44:40.255Z\",\"link\":\"/seller/offers\"},{\"id\":6,\"type\":\"inquiry\",\"title\":\"New Inquiry\",\"message\":\"New inquiry from Shahid Malik for Clifton Plaza.\",\"forPortal\":\"admin\",\"read\":false,\"timestamp\":\"2026-07-27T07:44:40.255Z\",\"link\":\"/admin/inquiries\"},{\"id\":7,\"type\":\"approval\",\"title\":\"New Listing Submission\",\"message\":\"A new property has been submitted for admin approval.\",\"forPortal\":\"admin\",\"read\":false,\"timestamp\":\"2026-07-27T06:44:40.255Z\",\"link\":\"/admin/properties\"}],\"blogPosts\":[{\"id\":1,\"title\":\"Top 5 Emerging Real Estate Markets in Pakistan 2024\",\"excerpt\":\"Discover where savvy investors are putting their money in Pakistan\'s fastest-growing property markets.\",\"content\":\"<p>Pakistan\'s real estate sector is witnessing unprecedented growth. Lahore\'s DHA, Karachi\'s Clifton, and Islamabad\'s New Blue Area continue to dominate, but emerging markets in Multan, Faisalabad, and Gwadar are gaining traction.</p>\",\"author\":\"OG Landmark\",\"category\":\"Market Trends\",\"image\":\"/images/blog-1.jpg\",\"published\":true,\"views\":1240,\"createdAt\":\"2024-01-15\"},{\"id\":2,\"title\":\"Complete Guide to Buying Property in Pakistan\",\"excerpt\":\"Everything first-time buyers need to know about the property purchase process in Pakistan.\",\"content\":\"<p>Buying property in Pakistan can be complex. Understanding Fard, Registry, and Mutation is essential. Always verify the seller\'s ownership documents before making any payment.</p>\",\"author\":\"OG Landmark\",\"category\":\"Buyer Guide\",\"image\":\"/images/blog-1.jpg\",\"published\":true,\"views\":890,\"createdAt\":\"2024-01-20\"},{\"id\":3,\"title\":\"Agricultural Land Investment in Punjab: A Growing Opportunity\",\"excerpt\":\"Why agricultural land in Punjab districts like Okara, Sahiwal, and Faisalabad is attracting urban investors.\",\"content\":\"<p>Agricultural land in Okara district, known for its fertile soil and canal irrigation, has appreciated 25% in three years. OG Landmark specializes in agricultural land in the Depalpur-Okara region.</p>\",\"author\":\"OG Landmark\",\"category\":\"Investment\",\"image\":\"/images/blog-1.jpg\",\"published\":true,\"views\":560,\"createdAt\":\"2024-02-01\"}],\"savedProperties\":[],\"nextId\":1019,\"savedSearches\":[],\"mobileAgents\":[],\"cityAgents\":[],\"banners\":[],\"announcements\":[],\"hiddenReactAgents\":[],\"reports\":[],\"developerProjects\":[],\"developerLeads\":[],\"inventoryUnits\":[],\"siteContent\":{\"heroTitle\":\"CMS Hero Title Test\",\"heroSubtitle\":\"Dynamic subtitle from admin\",\"primaryCta\":{\"label\":\"See Listings\",\"href\":\"/properties\"},\"secondaryCta\":{\"label\":\"Sell Fast\",\"href\":\"/seller\"},\"featuredSectionTitle\":\"Featured Now\",\"aboutTeaser\":\"About teaser updated\",\"contact\":{\"phone\":\"03001234567\",\"email\":\"hello@oglandmark.com\",\"whatsapp\":\"923001234567\",\"address\":\"Lahore\"},\"seo\":{\"title\":\"OG CMS Title\",\"description\":\"OG CMS description\"},\"updatedAt\":\"2026-09-24T20:25:31.295785Z\"},\"buyerRequests\":[],\"verificationRequests\":[],\"agentLeads\":[],\"agentVisits\":[],\"developerBlocks\":[],\"developerTeam\":[],\"developerDocuments\":[],\"developerPaymentPlans\":[],\"developerPromotions\":[],\"userActivity\":[]}', '2026-09-27 21:27:22.000');

-- --------------------------------------------------------

--
-- Table structure for table `auth_challenges`
--

CREATE TABLE `auth_challenges` (
  `email` varchar(320) NOT NULL,
  `purpose` varchar(64) NOT NULL,
  `code_hash` char(64) NOT NULL,
  `attempts` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `expires_at` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_sessions`
--

CREATE TABLE `auth_sessions` (
  `token_hash` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `auth_sessions`
--

INSERT INTO `auth_sessions` (`token_hash`, `user_id`, `expires_at`, `created_at`) VALUES
('01373d087098101f0725acb94ffcb8bd41dec975cc7c698b929ae27b4915dd2e', 1008, '2026-10-04 15:18:30.000', '2026-09-27 15:18:30.000'),
('1bf65cc4a3ec3a45fdab067cd5a20557387dcf58f71e13d0aa70d33e1a69edfb', 1012, '2026-10-04 21:25:54.000', '2026-09-27 21:25:54.000'),
('1f9181b99f984c2c1b4adef64c6c238e3c2825082e480241b47cbf4dbf2038e6', 1008, '2026-10-04 15:12:51.000', '2026-09-27 15:12:51.000'),
('222f973e896bbd3100ffa7964a08d8582adf135ab1864a453f5c7848c099a8e9', 1012, '2026-10-04 21:24:56.000', '2026-09-27 21:24:56.000'),
('31359bd40ccfcb4e9db4a18a577094dd6a0d1864bd978c47db0d27ca0adba216', 1012, '2026-10-04 21:23:02.000', '2026-09-27 21:23:02.000'),
('39e4db8aef4bb037cb76afb6b2a77a074242a32d3fb83dcb3d48f9d386714f41', 1007, '2026-10-04 15:12:52.000', '2026-09-27 15:12:52.000'),
('4776368c3572449e5902053ce7c08a39a94b2b05613205805bc33e603167e2cf', 1014, '2026-10-04 21:24:28.000', '2026-09-27 21:24:28.000'),
('501548e03e98b674e9d900225c850453331fe6da8c2b6fad8ef40e8f41ac912e', 1012, '2026-10-04 21:24:27.000', '2026-09-27 21:24:27.000'),
('6b2ce727ac59892e22ae8a2f48d88626e99a9d6dd2d9cc4a13c02a5acdabce32', 4, '2026-09-30 23:10:07.000', '2026-09-23 23:10:07.000'),
('7119a574cf55b2ffded2130873680651e6851cb9a5234d5df3f1c0114339931d', 1012, '2026-10-04 21:25:26.000', '2026-09-27 21:25:26.000'),
('77b994d30dec0ba377725f59ca1831ce2f19b31c40067509bae73d35c49c39ff', 1013, '2026-10-04 21:19:42.000', '2026-09-27 21:19:42.000'),
('7ae79ebd14dfefe3dce12262b9ef21e95fce402a4bce08a69f9287ab5b6e6b94', 1008, '2026-10-04 14:58:05.000', '2026-09-27 14:58:05.000'),
('88ff3b8709da3503560fb46cd1ef5213b781d054d3e68d925894717d53196acf', 1001, '2026-10-01 22:05:29.000', '2026-09-24 22:05:29.000'),
('8e9a07f6dc07db7cf649df1cd277d67aedb60d5bc67b20899466f7d8bfcc3fa4', 1017, '2026-10-04 21:27:06.000', '2026-09-27 21:27:06.000'),
('90d784aa8c4582d2ed10e33a17cf2c6ef2c94499ee8a0376524ac1155c1baf49', 1007, '2026-10-04 15:03:01.000', '2026-09-27 15:03:01.000'),
('90ddbf6f621143ce198ed46505dd72235138bae3fd8468717ad7e8da6c2268e1', 1007, '2026-10-04 14:57:07.000', '2026-09-27 14:57:07.000'),
('9468eb4c111a6cfe1f3f562e12328b772c5c495605fbd99bb9fa8376ac6ab322', 1002, '2026-10-01 22:05:32.000', '2026-09-24 22:05:32.000'),
('9d2560d905d395a3e2b287226b363481d0a492c9b1998551fa078f32e4e7470e', 1005, '2026-10-01 22:06:45.000', '2026-09-24 22:06:45.000'),
('aac64593949329aa2d8183de910b53c2ac8fb4f7338a16bfdb9ca232082a7612', 1016, '2026-10-04 21:26:46.000', '2026-09-27 21:26:46.000'),
('abf909a800f251e510dbb3c7564080a8550da2e82eb14dd65d78c06aa7f118ac', 1018, '2026-10-04 21:27:22.000', '2026-09-27 21:27:22.000'),
('b5204f2a3b487489654182b2fdd1a8617f772c60ace0ca8cf3bf096b565f96ab', 1002, '2026-10-01 22:05:30.000', '2026-09-24 22:05:30.000'),
('c36d8158487daeeb86717faf835c09be7619a561f096fa697f7bd81873aaf551', 1012, '2026-10-04 21:26:22.000', '2026-09-27 21:26:22.000'),
('d11f4b2747f76a3894a404d5f6168f95559fd0043ee5e48e0cce580fa58d350b', 1011, '2026-10-04 15:13:17.000', '2026-09-27 15:13:17.000'),
('da60bc050f722be71c80ddb48ac7810d9dd45ec5ed3b58dfe786112ca8985fb0', 1012, '2026-10-04 21:19:39.000', '2026-09-27 21:19:39.000'),
('dbf1937ed01f653134143886f9a9b29eaf01bd5586dca257058e830a5307d07c', 1008, '2026-10-04 14:57:36.000', '2026-09-27 14:57:36.000'),
('e1bc2f2d195635254b825de1f2653ea77022cc8dd500ad42424633b0c2e71641', 1008, '2026-10-04 15:18:03.000', '2026-09-27 15:18:03.000'),
('ee7a4941a4eea94001a739af83414072a9a88746850e21a372903e3fb66571cb', 1015, '2026-10-04 21:25:59.000', '2026-09-27 21:25:59.000'),
('f7b0d69a83bc6e2ca4a347e810f806ce4dc4d5aa850100e95e0858bc5f3932f9', 1007, '2026-10-04 14:58:05.000', '2026-09-27 14:58:05.000'),
('fc16a0fbc1841bddf621201cc9866c5f09648bd6449708974be0535a1765db1b', 1, '2026-09-25 20:25:30.000', '2026-09-24 20:25:30.000');

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000000_create_users_table', 1),
(2, '0001_01_01_000001_create_cache_table', 1),
(3, '0001_01_01_000002_create_jobs_table', 1),
(4, '2026_09_23_000001_create_og_landmark_compatibility_tables', 1),
(5, '2026_09_24_000002_create_property_search_index_table', 1);

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `property_search_index`
--

CREATE TABLE `property_search_index` (
  `property_id` bigint(20) UNSIGNED NOT NULL,
  `title` varchar(500) NOT NULL,
  `type` varchar(120) NOT NULL,
  `status` varchar(80) NOT NULL,
  `listing_status` varchar(80) DEFAULT NULL,
  `approval_status` varchar(80) DEFAULT NULL,
  `purpose` varchar(80) DEFAULT NULL,
  `city` varchar(160) DEFAULT NULL,
  `society` varchar(200) DEFAULT NULL,
  `seller_id` bigint(20) UNSIGNED DEFAULT NULL,
  `agent_id` bigint(20) UNSIGNED DEFAULT NULL,
  `price` decimal(20,2) DEFAULT NULL,
  `area_sqft` decimal(20,2) DEFAULT NULL,
  `bedrooms` decimal(10,2) DEFAULT NULL,
  `bathrooms` decimal(10,2) DEFAULT NULL,
  `featured` tinyint(1) NOT NULL DEFAULT 0,
  `priority` tinyint(1) NOT NULL DEFAULT 0,
  `score_overall` decimal(5,2) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `construction_age` varchar(80) DEFAULT NULL,
  `furnishing` varchar(80) DEFAULT NULL,
  `availability` varchar(120) DEFAULT NULL,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `search_text` text NOT NULL,
  `property_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`property_json`)),
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `property_search_index`
--

INSERT INTO `property_search_index` (`property_id`, `title`, `type`, `status`, `listing_status`, `approval_status`, `purpose`, `city`, `society`, `seller_id`, `agent_id`, `price`, `area_sqft`, `bedrooms`, `bathrooms`, `featured`, `priority`, `score_overall`, `latitude`, `longitude`, `construction_age`, `furnishing`, `availability`, `tags`, `search_text`, `property_json`, `created_at`, `updated_at`) VALUES
(1, 'Luxurious Modern Villa in DHA Phase 8', 'Villa', 'For Sale', NULL, 'Active', 'For Sale', 'Lahore', 'DHA Phase 8', 10, 1, 125000000.00, 5500.00, 6.00, 7.00, 1, 0, NULL, NULL, NULL, 'New', 'Unfurnished', 'Ready to Move', '[\"featured\",\"verified\",\"luxury\",\"smartHome\"]', 'Luxurious Modern Villa in DHA Phase 8 Villa Lahore DHA Phase 8 Exceptional modern villa featuring contemporary architecture, premium finishes, and expansive living spaces. Private pool, landscaped garden, and state-of-the-art amenities. featured verified luxury smartHome', '{\"id\":1,\"title\":\"Luxurious Modern Villa in DHA Phase 8\",\"type\":\"Villa\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":125000000,\"area\":5500,\"bedrooms\":6,\"bathrooms\":7,\"city\":\"Lahore\",\"address\":\"Street 12, DHA Phase 8, Lahore\",\"society\":\"DHA Phase 8\",\"block\":\"Block H\",\"landmark\":\"Near DHA Phase 8 Gate\",\"nearbyPlaces\":{\"schools\":[\"The City School DHA\",\"Beaconhouse DHA Campus\"],\"hospitals\":[\"Shaukat Khanum Memorial Hospital\"],\"mosques\":[\"DHA Jamia Masjid\"],\"markets\":[\"DHA Phase 8 Commercial Area\"],\"metroStations\":[],\"motorwayDist\":\"15 km\"},\"description\":\"Exceptional modern villa featuring contemporary architecture, premium finishes, and expansive living spaces. Private pool, landscaped garden, and state-of-the-art amenities.\",\"amenities\":[\"Private Pool\",\"Home Theater\",\"Gym\",\"Garden\",\"Servant Quarters\",\"Security System\",\"3 Car Parking\",\"Central AC\",\"Solar System\",\"CCTV\",\"EV Charging\"],\"images\":[\"/images/property-1.jpg\",\"/images/property-5.jpg\",\"/images/property-3.jpg\",\"/images/property-2.jpg\"],\"agentId\":1,\"sellerId\":10,\"sellerName\":\"Salman Khan\",\"featured\":true,\"views\":820,\"inquiryCount\":12,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2023,\"constructionAge\":\"New\",\"furnishing\":\"Unfurnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Kanal\",\"areaInSqft\":5500,\"purpose\":\"For Sale\",\"tags\":[\"featured\",\"verified\",\"luxury\",\"smartHome\"],\"propertyScore\":{\"location\":4.9,\"construction\":5,\"investment\":4.8,\"amenities\":5,\"futureGrowth\":4.7,\"overall\":4.9},\"createdAt\":\"2024-01-15\"}', '2024-01-15 00:00:00.000', '2026-09-24 20:24:56.000'),
(2, 'Premium 3-Bed Apartment in Bahria Town', 'Apartment', 'For Rent', NULL, 'Active', 'For Rent', 'Islamabad', 'Bahria Town Phase 4', 10, 3, 85000.00, 1850.00, 3.00, 3.00, 1, 0, NULL, NULL, NULL, '1 Year', 'Semi Furnished', 'Ready to Move', '[\"featured\",\"verified\",\"newListing\"]', 'Premium 3-Bed Apartment in Bahria Town Apartment Islamabad Bahria Town Phase 4 Stunning apartment with panoramic city views and modern amenities. Open-concept design, high-end finishes, and access to world-class facilities. featured verified newListing', '{\"id\":2,\"title\":\"Premium 3-Bed Apartment in Bahria Town\",\"type\":\"Apartment\",\"status\":\"For Rent\",\"approvalStatus\":\"Active\",\"price\":85000,\"area\":1850,\"bedrooms\":3,\"bathrooms\":3,\"city\":\"Islamabad\",\"address\":\"Civic Centre, Bahria Town Phase 4, Islamabad\",\"society\":\"Bahria Town Phase 4\",\"block\":\"Civic Centre\",\"landmark\":\"Near Bahria Grand Mosque\",\"nearbyPlaces\":{\"schools\":[\"The Scholar School Bahria\",\"Roots School Bahria\"],\"hospitals\":[\"Bahria International Hospital\"],\"mosques\":[\"Bahria Grand Mosque\"],\"markets\":[\"Bahria Town Phase 4 Market\"],\"metroStations\":[],\"motorwayDist\":\"3 km\"},\"description\":\"Stunning apartment with panoramic city views and modern amenities. Open-concept design, high-end finishes, and access to world-class facilities.\",\"amenities\":[\"Clubhouse\",\"Swimming Pool\",\"Gym\",\"Balcony\",\"Central Heating\",\"Underground Parking\",\"24/7 Security\",\"Elevators\",\"Backup Generator\"],\"images\":[\"/images/property-2.jpg\",\"/images/property-5.jpg\",\"/images/property-1.jpg\"],\"agentId\":3,\"sellerId\":10,\"sellerName\":\"Salman Khan\",\"featured\":true,\"views\":560,\"inquiryCount\":8,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2022,\"constructionAge\":\"1 Year\",\"furnishing\":\"Semi Furnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Square Feet\",\"areaInSqft\":1850,\"purpose\":\"For Rent\",\"tags\":[\"featured\",\"verified\",\"newListing\"],\"propertyScore\":{\"location\":4.7,\"construction\":4.5,\"investment\":4.2,\"amenities\":4.8,\"futureGrowth\":4.5,\"overall\":4.5},\"createdAt\":\"2024-01-20\"}', '2024-01-20 00:00:00.000', '2026-09-24 20:24:56.000'),
(3, 'Elegant 5 Bedroom House in Gulberg', 'House', 'For Sale', NULL, 'Active', 'For Sale', 'Lahore', 'Gulberg III', 10, 1, 68000000.00, 4200.00, 5.00, 5.00, 0, 0, NULL, NULL, NULL, '5 Years', 'Unfurnished', 'Ready to Move', '[\"verified\",\"hotArea\",\"corner\"]', 'Elegant 5 Bedroom House in Gulberg House Lahore Gulberg III Spacious and elegant house in the heart of Gulberg with premium finishes throughout. Perfect for families seeking upscale urban living. verified hotArea corner', '{\"id\":3,\"title\":\"Elegant 5 Bedroom House in Gulberg\",\"type\":\"House\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":68000000,\"area\":4200,\"bedrooms\":5,\"bathrooms\":5,\"city\":\"Lahore\",\"address\":\"Main Boulevard, Gulberg III, Lahore\",\"society\":\"Gulberg III\",\"block\":\"Main Boulevard\",\"landmark\":\"Near Gulberg Main Market\",\"nearbyPlaces\":{\"schools\":[\"LGS Gulberg\",\"Aitchison College\"],\"hospitals\":[\"Doctors Hospital\",\"Hameed Latif Hospital\"],\"mosques\":[\"Jamia Masjid Gulberg\"],\"markets\":[\"Liberty Market\",\"MM Alam Road\"],\"metroStations\":[\"Gulberg Orange Line Station\"],\"motorwayDist\":\"12 km\"},\"description\":\"Spacious and elegant house in the heart of Gulberg with premium finishes throughout. Perfect for families seeking upscale urban living.\",\"amenities\":[\"Garden\",\"Servant Quarters\",\"4 Car Parking\",\"Security System\",\"Solar System\",\"Generator\",\"Fiber Internet\",\"CCTV\"],\"images\":[\"/images/property-3.jpg\",\"/images/property-1.jpg\",\"/images/property-4.jpg\"],\"agentId\":1,\"sellerId\":10,\"sellerName\":\"Salman Khan\",\"featured\":false,\"views\":430,\"inquiryCount\":10,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2020,\"constructionAge\":\"5 Years\",\"furnishing\":\"Unfurnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Marla\",\"areaInSqft\":4200,\"purpose\":\"For Sale\",\"tags\":[\"verified\",\"hotArea\",\"corner\"],\"propertyScore\":{\"location\":4.8,\"construction\":4,\"investment\":4.5,\"amenities\":4.2,\"futureGrowth\":4.6,\"overall\":4.4},\"createdAt\":\"2024-01-10\"}', '2024-01-10 00:00:00.000', '2026-09-24 20:24:56.000'),
(4, 'Spacious Penthouse with City View', 'Apartment', 'For Sale', NULL, 'Active', 'For Sale', 'Karachi', 'Clifton Block 5', 11, 2, 45000000.00, 3200.00, 4.00, 4.00, 1, 0, NULL, NULL, NULL, '5 Years', 'Furnished', 'Ready to Move', '[\"featured\",\"verified\",\"luxury\",\"highROI\",\"parkFacing\"]', 'Spacious Penthouse with City View Apartment Karachi Clifton Block 5 Exclusive penthouse offering breathtaking city views with top-notch finishes and premium amenities in the heart of Clifton. featured verified luxury highROI parkFacing', '{\"id\":4,\"title\":\"Spacious Penthouse with City View\",\"type\":\"Apartment\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":45000000,\"area\":3200,\"bedrooms\":4,\"bathrooms\":4,\"city\":\"Karachi\",\"address\":\"Clifton Block 5, Karachi\",\"society\":\"Clifton Block 5\",\"block\":\"Block 5\",\"landmark\":\"Near Clifton Beach\",\"nearbyPlaces\":{\"schools\":[\"Karachi Grammar School\"],\"hospitals\":[\"Aga Khan University Hospital\"],\"mosques\":[\"Clifton Mosque\"],\"markets\":[\"Clifton Block 9 Market\"],\"metroStations\":[],\"motorwayDist\":\"25 km\"},\"description\":\"Exclusive penthouse offering breathtaking city views with top-notch finishes and premium amenities in the heart of Clifton.\",\"amenities\":[\"Private Terrace\",\"Jacuzzi\",\"Smart Home\",\"Gym\",\"Concierge Service\",\"Swimming Pool\",\"Elevator\"],\"images\":[\"/images/property-4.jpg\",\"/images/property-6.jpg\",\"/images/property-2.jpg\"],\"agentId\":2,\"sellerId\":11,\"sellerName\":\"Hassan Raza\",\"featured\":true,\"views\":680,\"inquiryCount\":6,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2021,\"constructionAge\":\"5 Years\",\"furnishing\":\"Furnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Square Feet\",\"areaInSqft\":3200,\"purpose\":\"For Sale\",\"tags\":[\"featured\",\"verified\",\"luxury\",\"highROI\",\"parkFacing\"],\"propertyScore\":{\"location\":4.9,\"construction\":4.2,\"investment\":4.7,\"amenities\":4.9,\"futureGrowth\":4.4,\"overall\":4.6},\"createdAt\":\"2024-01-25\"}', '2024-01-25 00:00:00.000', '2026-09-24 20:24:56.000'),
(5, 'Modern Commercial Plaza in Clifton', 'Commercial', 'For Sale', NULL, 'Active', 'For Sale', 'Karachi', 'Clifton', 11, 2, 180000000.00, 8500.00, 0.00, 4.00, 0, 0, NULL, NULL, NULL, '10 Years', 'Unfurnished', 'Ready to Move', '[\"verified\",\"highROI\",\"rentalIncome\",\"mainRoad\",\"corner\"]', 'Modern Commercial Plaza in Clifton Commercial Karachi Clifton Prime commercial space in the most sought-after commercial area of Karachi. Ideal for offices, retail, or mixed-use development. verified highROI rentalIncome mainRoad corner', '{\"id\":5,\"title\":\"Modern Commercial Plaza in Clifton\",\"type\":\"Commercial\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":180000000,\"area\":8500,\"bedrooms\":0,\"bathrooms\":4,\"city\":\"Karachi\",\"address\":\"Main Clifton Road, Karachi\",\"society\":\"Clifton\",\"block\":\"Main Clifton Road\",\"landmark\":\"Near Clifton Bridge\",\"nearbyPlaces\":{\"schools\":[],\"hospitals\":[\"Dr. Ziauddin Hospital\"],\"mosques\":[\"Clifton Mosque\"],\"markets\":[\"Clifton Commercial Market\"],\"metroStations\":[],\"motorwayDist\":\"22 km\"},\"description\":\"Prime commercial space in the most sought-after commercial area of Karachi. Ideal for offices, retail, or mixed-use development.\",\"amenities\":[\"Elevator\",\"Backup Generator\",\"Central AC\",\"Security\",\"Parking\",\"Fiber Internet\"],\"images\":[\"/images/property-5.jpg\",\"/images/property-3.jpg\"],\"agentId\":2,\"sellerId\":11,\"sellerName\":\"Hassan Raza\",\"featured\":false,\"views\":290,\"inquiryCount\":4,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2019,\"constructionAge\":\"10 Years\",\"furnishing\":\"Unfurnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Square Feet\",\"areaInSqft\":8500,\"purpose\":\"For Sale\",\"tags\":[\"verified\",\"highROI\",\"rentalIncome\",\"mainRoad\",\"corner\"],\"propertyScore\":{\"location\":4.6,\"construction\":3.5,\"investment\":4.8,\"amenities\":3.8,\"futureGrowth\":4.3,\"overall\":4.2},\"createdAt\":\"2024-02-01\"}', '2024-02-01 00:00:00.000', '2026-09-24 20:24:56.000'),
(6, 'Affordable 2-Bed Apartment in E-11', 'Apartment', 'For Rent', NULL, 'Active', 'For Rent', 'Islamabad', 'E-11', 12, 3, 55000.00, 1200.00, 2.00, 2.00, 0, 0, NULL, NULL, NULL, '10 Years', 'Semi Furnished', 'Ready to Move', '[\"newListing\"]', 'Affordable 2-Bed Apartment in E-11 Apartment Islamabad E-11 Well-maintained apartment in a peaceful neighborhood perfect for small families or couples. newListing', '{\"id\":6,\"title\":\"Affordable 2-Bed Apartment in E-11\",\"type\":\"Apartment\",\"status\":\"For Rent\",\"approvalStatus\":\"Active\",\"price\":55000,\"area\":1200,\"bedrooms\":2,\"bathrooms\":2,\"city\":\"Islamabad\",\"address\":\"E-11/2, Islamabad\",\"society\":\"E-11\",\"block\":\"Sector E-11/2\",\"landmark\":\"Near Islamabad Zoo\",\"nearbyPlaces\":{\"schools\":[\"The Educators E-11\",\"NUST\"],\"hospitals\":[\"PIMS Hospital\"],\"mosques\":[\"E-11 Masjid\"],\"markets\":[\"E-11 Market\"],\"metroStations\":[\"E-11 Metro Station\"],\"motorwayDist\":\"8 km\"},\"description\":\"Well-maintained apartment in a peaceful neighborhood perfect for small families or couples.\",\"amenities\":[\"Elevator\",\"Backup Generator\",\"Security\",\"Parking\"],\"images\":[\"/images/property-6.jpg\",\"/images/property-4.jpg\"],\"agentId\":3,\"sellerId\":12,\"sellerName\":\"Maria Ali\",\"featured\":false,\"views\":340,\"inquiryCount\":5,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":2018,\"constructionAge\":\"10 Years\",\"furnishing\":\"Semi Furnished\",\"availability\":\"Ready to Move\",\"areaUnit\":\"Square Feet\",\"areaInSqft\":1200,\"purpose\":\"For Rent\",\"tags\":[\"newListing\"],\"propertyScore\":{\"location\":4,\"construction\":3.5,\"investment\":3.8,\"amenities\":3.5,\"futureGrowth\":4.2,\"overall\":3.8},\"createdAt\":\"2024-02-05\"}', '2024-02-05 00:00:00.000', '2026-09-24 20:24:56.000'),
(7, '10-Acre Mango Orchard in Rahim Yar Khan', 'Orchard', 'For Sale', NULL, 'Active', 'For Sale', 'Rahim Yar Khan', NULL, 14, 5, 8500000.00, 435600.00, 0.00, 0.00, 0, 0, NULL, NULL, NULL, NULL, NULL, 'Ready to Move', '[\"verified\",\"highROI\",\"orchard\",\"tubeWell\"]', '10-Acre Mango Orchard in Rahim Yar Khan Orchard Rahim Yar Khan Highly productive mango orchard with established trees and bore well irrigation. Excellent investment opportunity. verified highROI orchard tubeWell', '{\"id\":7,\"title\":\"10-Acre Mango Orchard in Rahim Yar Khan\",\"type\":\"Orchard\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":8500000,\"area\":435600,\"bedrooms\":0,\"bathrooms\":0,\"city\":\"Rahim Yar Khan\",\"address\":\"Liaquatpur Road, Rahim Yar Khan\",\"society\":null,\"block\":null,\"landmark\":\"Near Rahim Yar Khan City\",\"nearbyPlaces\":{\"schools\":[],\"hospitals\":[\"DHQ Hospital RYK\"],\"mosques\":[\"Local Mosque\"],\"markets\":[\"Liaquatpur Market\"],\"metroStations\":[],\"motorwayDist\":\"15 km\"},\"description\":\"Highly productive mango orchard with established trees and bore well irrigation. Excellent investment opportunity.\",\"amenities\":[\"Bore Well\",\"Solar Pumping\",\"Caretaker House\",\"Boundary Wall\"],\"images\":[\"/images/property-5.jpg\",\"/images/property-6.jpg\"],\"agentId\":5,\"sellerId\":14,\"sellerName\":\"Muhammad Tariq\",\"featured\":false,\"views\":180,\"inquiryCount\":3,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":null,\"constructionAge\":null,\"furnishing\":null,\"availability\":\"Ready to Move\",\"areaUnit\":\"Acre\",\"areaInSqft\":435600,\"purpose\":\"For Sale\",\"tags\":[\"verified\",\"highROI\",\"orchard\",\"tubeWell\"],\"propertyScore\":{\"location\":3.5,\"construction\":3,\"investment\":4.5,\"amenities\":3.2,\"futureGrowth\":4,\"overall\":3.6},\"createdAt\":\"2024-02-10\"}', '2024-02-10 00:00:00.000', '2026-09-24 20:24:56.000'),
(8, '25-Acre Fertile Farmland in Okara', 'Agriculture Land', 'For Sale', NULL, 'Active', 'For Sale', 'Okara', NULL, 14, 5, 30000000.00, 1089000.00, 0.00, 0.00, 0, 0, NULL, NULL, NULL, NULL, NULL, 'Ready to Move', '[\"verified\",\"highROI\",\"riceLand\",\"canalWater\",\"roadFront\"]', '25-Acre Fertile Farmland in Okara Agriculture Land Okara Premium agricultural land in Okara district with canal irrigation available. Ideal for wheat, rice, and sugarcane cultivation. verified highROI riceLand canalWater roadFront', '{\"id\":8,\"title\":\"25-Acre Fertile Farmland in Okara\",\"type\":\"Agriculture Land\",\"status\":\"For Sale\",\"approvalStatus\":\"Active\",\"price\":30000000,\"area\":1089000,\"bedrooms\":0,\"bathrooms\":0,\"city\":\"Okara\",\"address\":\"Renala Khurd Road, Okara\",\"society\":null,\"block\":null,\"landmark\":\"Near Renala Khurd Town\",\"nearbyPlaces\":{\"schools\":[],\"hospitals\":[\"THQ Hospital Renala\"],\"mosques\":[\"Village Mosque\"],\"markets\":[\"Renala Market\"],\"metroStations\":[],\"motorwayDist\":\"5 km\"},\"description\":\"Premium agricultural land in Okara district with canal irrigation available. Ideal for wheat, rice, and sugarcane cultivation.\",\"amenities\":[\"Canal Irrigation\",\"Electricity\",\"Road Access\",\"Flat Land\"],\"images\":[\"/images/property-6.jpg\",\"/images/property-5.jpg\"],\"agentId\":5,\"sellerId\":14,\"sellerName\":\"Muhammad Tariq\",\"featured\":false,\"views\":220,\"inquiryCount\":4,\"videoUrl\":null,\"tour360Url\":null,\"yearBuilt\":null,\"constructionAge\":null,\"furnishing\":null,\"availability\":\"Ready to Move\",\"areaUnit\":\"Acre\",\"areaInSqft\":1089000,\"purpose\":\"For Sale\",\"tags\":[\"verified\",\"highROI\",\"riceLand\",\"canalWater\",\"roadFront\"],\"propertyScore\":{\"location\":3.2,\"construction\":2.5,\"investment\":4.8,\"amenities\":2.8,\"futureGrowth\":4.2,\"overall\":3.5},\"createdAt\":\"2024-02-12\"}', '2024-02-12 00:00:00.000', '2026-09-24 20:24:56.000'),
(1000, 'CMS Test Villa', 'Villa', 'Active', 'Active', 'Active', 'Sale', 'Lahore', NULL, 1, NULL, 25000000.00, 2500.00, 5.00, 4.00, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, '[]', 'CMS Test Villa Villa Lahore Created by CMS smoke test', '{\"description\":\"Created by CMS smoke test\",\"type\":\"Villa\",\"price\":25000000,\"purpose\":\"Sale\",\"city\":\"Lahore\",\"bedrooms\":5,\"images\":[],\"publish\":true,\"bathrooms\":4,\"area\":2500,\"title\":\"CMS Test Villa\",\"featured\":true,\"id\":1000,\"sellerId\":1,\"sellerName\":\"Admin\",\"createdAt\":\"2026-09-24T20:25:31.585945Z\",\"updatedAt\":\"2026-09-24T20:25:31.586538Z\",\"approvalStatus\":\"Active\",\"listingStatus\":\"Active\",\"views\":0,\"inquiryCount\":0,\"priority\":false,\"createdByAdmin\":true}', '2026-09-24 20:25:31.000', '2026-09-24 20:25:31.000'),
(1006, 'Smoke Seller Listing', 'House', 'For Sale', 'Pending', 'Pending', NULL, 'Lahore', NULL, 1005, NULL, 1000000.00, NULL, NULL, NULL, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, '[]', 'Smoke Seller Listing House Lahore', '{\"city\":\"Lahore\",\"approvalStatus\":\"Pending\",\"sellerId\":1005,\"type\":\"House\",\"price\":1000000,\"title\":\"Smoke Seller Listing\",\"status\":\"For Sale\",\"id\":1006,\"sellerName\":\"S P\",\"createdAt\":\"2026-09-24T22:06:46.265423Z\",\"updatedAt\":\"2026-09-24T22:06:46.266337Z\",\"listingStatus\":\"Pending\",\"views\":0,\"inquiryCount\":0,\"images\":[],\"featured\":false,\"priority\":false,\"createdByAdmin\":false}', '2026-09-24 22:06:46.000', '2026-09-24 22:06:46.000');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `app_data`
--
ALTER TABLE `app_data`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `auth_challenges`
--
ALTER TABLE `auth_challenges`
  ADD PRIMARY KEY (`email`,`purpose`);

--
-- Indexes for table `auth_sessions`
--
ALTER TABLE `auth_sessions`
  ADD PRIMARY KEY (`token_hash`),
  ADD KEY `idx_auth_sessions_user` (`user_id`),
  ADD KEY `idx_auth_sessions_expiry` (`expires_at`);

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_expiration_index` (`expiration`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_locks_expiration_index` (`expiration`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `property_search_index`
--
ALTER TABLE `property_search_index`
  ADD PRIMARY KEY (`property_id`),
  ADD KEY `idx_property_search_status` (`approval_status`,`listing_status`,`created_at`),
  ADD KEY `idx_property_search_city` (`city`,`type`,`status`),
  ADD KEY `idx_property_search_geo` (`latitude`,`longitude`),
  ADD KEY `idx_property_search_seller` (`seller_id`),
  ADD KEY `idx_property_search_agent` (`agent_id`),
  ADD KEY `idx_property_search_price` (`price`),
  ADD KEY `idx_property_search_area` (`area_sqft`);
ALTER TABLE `property_search_index` ADD FULLTEXT KEY `ft_property_search_text` (`search_text`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
