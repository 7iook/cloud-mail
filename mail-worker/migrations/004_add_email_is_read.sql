-- 添加邮件已读状态字段
-- Migration: v2.4
-- Date: 2025-10-15
-- Description: 为 email 表添加 is_read 字段，用于标记邮件的已读/未读状态

-- 添加 is_read 字段到 email 表
ALTER TABLE email ADD COLUMN is_read INTEGER DEFAULT 0 NOT NULL;

-- 字段说明：
-- is_read: 邮件已读状态
--   0 = 未读 (默认值)
--   1 = 已读

-- 注意：
-- 1. 此迁移已在 Cloudflare D1 生产数据库中手动执行完成
-- 2. 本地开发环境会通过 init.js 中的 v2_4DB 方法自动执行
-- 3. 所有现有邮件默认标记为未读状态 (is_read = 0)

