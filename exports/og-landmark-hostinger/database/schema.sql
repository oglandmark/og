-- OG Landmark MySQL schema.
-- Run with `npm run migrate` before starting the Node server.

CREATE TABLE IF NOT EXISTS app_data (
  id BIGINT NOT NULL PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash VARCHAR(255) NOT NULL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_auth_sessions_user (user_id),
  KEY idx_auth_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_challenges (
  email VARCHAR(320) NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (email, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS property_search_index (
  property_id BIGINT NOT NULL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  type VARCHAR(120) NOT NULL,
  status VARCHAR(80) NOT NULL,
  listing_status VARCHAR(80) NULL,
  approval_status VARCHAR(80) NULL,
  purpose VARCHAR(80) NULL,
  city VARCHAR(160) NULL,
  society VARCHAR(200) NULL,
  seller_id BIGINT NULL,
  agent_id BIGINT NULL,
  price DECIMAL(20,2) NULL,
  area_sqft DECIMAL(20,2) NULL,
  bedrooms DECIMAL(10,2) NULL,
  bathrooms DECIMAL(10,2) NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  priority TINYINT(1) NOT NULL DEFAULT 0,
  score_overall DECIMAL(5,2) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  construction_age VARCHAR(80) NULL,
  furnishing VARCHAR(80) NULL,
  availability VARCHAR(120) NULL,
  tags JSON NULL,
  search_text TEXT NOT NULL,
  property_json JSON NOT NULL,
  created_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_property_search_status (approval_status, listing_status, created_at),
  KEY idx_property_search_city (city, type, status),
  KEY idx_property_search_price (price),
  KEY idx_property_search_area (area_sqft),
  KEY idx_property_search_seller (seller_id),
  KEY idx_property_search_agent (agent_id),
  KEY idx_property_search_geo (latitude, longitude),
  FULLTEXT KEY ft_property_search_text (search_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
