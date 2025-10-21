-- =====================================================
-- Cloud-Mail 模板匹配功能数据库迁移脚本
-- 版本: 7.0.0
-- 日期: 2025-01-15
-- 说明: 添加邮件模板匹配功能所需字段
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库!
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

-- =====================================================
-- 第一部分: 添加新字段（使用安全的错误处理）
-- =====================================================

-- SQLite 不支持 IF NOT EXISTS 语法，所以我们直接执行 ALTER TABLE
-- 如果字段已存在，此语句会失败，但这是预期行为（可以忽略错误）

-- 1. 过滤模式字段
-- filter_mode: 1=关键词过滤, 2=模板匹配
-- 注意: 如果字段已存在，此语句会失败，但这是预期行为
ALTER TABLE share ADD COLUMN filter_mode INTEGER DEFAULT 1 NOT NULL;

-- 2. 模板ID字段
ALTER TABLE share ADD COLUMN template_id TEXT;

-- 3. 显示完整邮件字段
ALTER TABLE share ADD COLUMN show_full_email INTEGER DEFAULT 1 NOT NULL;

-- =====================================================
-- 第二部分: 创建索引优化查询性能
-- =====================================================

-- 为过滤模式创建索引
CREATE INDEX IF NOT EXISTS idx_share_filter_mode ON share(filter_mode);

-- 为模板ID创建索引
CREATE INDEX IF NOT EXISTS idx_share_template_id ON share(template_id);

-- =====================================================
-- 第三部分: 验证迁移结果
-- =====================================================

-- 验证新字段是否正确添加
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    SUM(CASE WHEN filter_mode = 1 THEN 1 ELSE 0 END) as keyword_filter_shares,
    SUM(CASE WHEN filter_mode = 2 THEN 1 ELSE 0 END) as template_filter_shares,
    SUM(CASE WHEN template_id IS NOT NULL THEN 1 ELSE 0 END) as shares_with_template,
    SUM(CASE WHEN show_full_email = 1 THEN 1 ELSE 0 END) as shares_showing_full_email
FROM share;

-- =====================================================
-- 使用说明
-- =====================================================

-- 本地开发环境执行:
-- wrangler d1 execute cloud-mail-db --local --file=./migrations/007_add_template_matching_fields.sql

-- 生产环境执行:
-- wrangler d1 execute cloud-mail-db --remote --file=./migrations/007_add_template_matching_fields.sql

-- =====================================================
-- 向后兼容性说明
-- =====================================================

-- - filter_mode 默认为 1（关键词过滤），保持现有功能不变
-- - template_id 默认为 NULL，表示不使用模板匹配
-- - show_full_email 默认为 1（显示完整邮件），保持现有行为
-- - 所有新字段都有合理的默认值，不影响现有分享链接

-- =====================================================
-- 错误处理说明
-- =====================================================

-- 如果字段已存在，ALTER TABLE 语句会失败并显示错误:
-- "duplicate column name: filter_mode" 或类似信息
-- 这是正常现象，表示字段已经存在，可以忽略此错误

-- 如果需要检查字段是否存在，可以使用:
-- PRAGMA table_info(share);

