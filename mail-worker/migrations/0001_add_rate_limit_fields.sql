-- Migration: Add rate limit fields to share table
-- Date: 2025-09-30
-- Description: Add custom rate limiting configuration fields for each share link

-- Add rate_limit_per_second column (default 5 requests per second)
ALTER TABLE share ADD COLUMN rate_limit_per_second INTEGER DEFAULT 5 NOT NULL;

-- Add rate_limit_per_minute column (default 60 requests per minute)
ALTER TABLE share ADD COLUMN rate_limit_per_minute INTEGER DEFAULT 60 NOT NULL;

-- Update existing records to have default values (in case ALTER TABLE doesn't set defaults)
UPDATE share SET rate_limit_per_second = 5 WHERE rate_limit_per_second IS NULL;
UPDATE share SET rate_limit_per_minute = 60 WHERE rate_limit_per_minute IS NULL;

