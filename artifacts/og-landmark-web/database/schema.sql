CREATE TABLE IF NOT EXISTS app_data (
  id TINYINT PRIMARY KEY,
  data JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expiry (expires_at)
);
CREATE TABLE IF NOT EXISTS auth_challenges (
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts TINYINT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (email, purpose)
);

-- app_data is the durable JSON document store for listings, users, developer
-- records, mobile settings, promotions, verification requests, device tokens,
-- account-scoped histories/searches/comparisons, and all other application data.
-- auth_sessions and auth_challenges intentionally remain relational so bearer
-- sessions and reset/admin OTP challenges survive Node.js restarts.
