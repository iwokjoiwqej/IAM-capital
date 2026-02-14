CREATE DATABASE IF NOT EXISTS asthate
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE asthate;

CREATE TABLE IF NOT EXISTS inquiries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  organization VARCHAR(190) NOT NULL,
  investor_type VARCHAR(80) NOT NULL,
  jurisdiction VARCHAR(120) NOT NULL,
  ticket_size VARCHAR(80) NOT NULL,
  notes TEXT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inquiries_email (email),
  INDEX idx_inquiries_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS dd_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  organization VARCHAR(190) NOT NULL,
  role VARCHAR(120) NOT NULL,
  nda_status VARCHAR(80) NOT NULL,
  priority VARCHAR(80) NOT NULL,
  requested_items TEXT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dd_requests_email (email),
  INDEX idx_dd_requests_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS portal_access_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  passphrase_hash CHAR(64) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_portal_access_email (email),
  INDEX idx_portal_access_created_at (created_at)
);
