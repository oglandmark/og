-- OG Landmark PostgreSQL schema for Supabase.
-- Run with `npm run migrate:postgres` before importing production data.
-- The API connects with a server-only PostgreSQL connection string; no
-- Supabase anon/service key belongs in the browser or mobile app.

CREATE TABLE IF NOT EXISTS app_data (
  id BIGINT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash VARCHAR(255) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_challenges (
  email VARCHAR(320) NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (email, purpose)
);

-- A rebuildable search projection; app_data.data remains canonical.
CREATE TABLE IF NOT EXISTS property_search_index (
  property_id BIGINT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  type VARCHAR(120) NOT NULL,
  status VARCHAR(80) NOT NULL,
  listing_status VARCHAR(80),
  approval_status VARCHAR(80),
  purpose VARCHAR(80),
  city VARCHAR(160),
  society VARCHAR(200),
  seller_id BIGINT,
  agent_id BIGINT,
  price DECIMAL(20,2),
  area_sqft DECIMAL(20,2),
  bedrooms DECIMAL(10,2),
  bathrooms DECIMAL(10,2),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  priority BOOLEAN NOT NULL DEFAULT FALSE,
  score_overall DECIMAL(5,2),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  construction_age VARCHAR(80),
  furnishing VARCHAR(80),
  availability VARCHAR(120),
  tags JSONB,
  search_text TEXT NOT NULL,
  property_json JSONB NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_property_search_status
  ON property_search_index (approval_status, listing_status, created_at);
CREATE INDEX IF NOT EXISTS idx_property_search_city
  ON property_search_index (city, type, status);
CREATE INDEX IF NOT EXISTS idx_property_search_price ON property_search_index (price);
CREATE INDEX IF NOT EXISTS idx_property_search_area ON property_search_index (area_sqft);
CREATE INDEX IF NOT EXISTS idx_property_search_seller ON property_search_index (seller_id);
CREATE INDEX IF NOT EXISTS idx_property_search_agent ON property_search_index (agent_id);
CREATE INDEX IF NOT EXISTS idx_property_search_geo ON property_search_index (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_property_search_tags ON property_search_index USING GIN (tags);

-- These tables contain account records, password hashes, session digests, and
-- verification-code digests. They are used only by the server-side DB role.
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_search_index ENABLE ROW LEVEL SECURITY;