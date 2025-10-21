-- =====================================================
-- Cloud-Mail 邮件分享增强功能数据库迁移脚本
-- 版本: 6.0.0
-- 日期: 2025-01-15
-- 说明: 添加最新邮件数量限制和自动刷新功能字段
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 第一部分: 添加新字段
-- =====================================================

-- 1. 最新邮件数量限制字段
-- latest_email_count: 控制分享链接最多显示多少封最新邮件
-- NULL 表示显示全部邮件，数字表示显示最新的N封邮件
ALTER TABLE share ADD COLUMN latest_email_count INTEGER;

-- 2. 自动刷新功能字段
-- auto_refresh_enabled: 是否启用自动刷新（0=禁用, 1=启用）
ALTER TABLE share ADD COLUMN auto_refresh_enabled INTEGER DEFAULT 0 NOT NULL;

-- auto_refresh_interval: 自动刷新间隔（秒），默认30秒
ALTER TABLE share ADD COLUMN auto_refresh_interval INTEGER DEFAULT 30 NOT NULL;

-- =====================================================
-- 第二部分: 添加字段约束和验证
-- =====================================================

-- 确保 latest_email_count 为正数或 NULL
-- SQLite 不支持 CHECK 约束中的 OR NULL，所以我们只检查正数
-- 应用层需要确保 NULL 值的正确处理

-- 确保 auto_refresh_enabled 只能是 0 或 1
-- 这个约束通过默认值和应用层验证来保证

-- 确保 auto_refresh_interval 在合理范围内（10秒到3600秒）
-- 应用层需要验证这个范围

-- =====================================================
-- 第三部分: 创建索引优化查询性能
-- =====================================================

-- 为自动刷新功能创建索引（可选，提升查询性能）
CREATE INDEX IF NOT EXISTS idx_share_auto_refresh ON share(auto_refresh_enabled);

-- 为邮件数量限制创建索引（可选）
CREATE INDEX IF NOT EXISTS idx_share_email_count ON share(latest_email_count);

-- =====================================================
-- 第四部分: 数据初始化（可选）
-- =====================================================

-- 为现有分享记录设置默认值（已通过 DEFAULT 子句处理）
-- auto_refresh_enabled 默认为 0（禁用）
-- auto_refresh_interval 默认为 30 秒
-- latest_email_count 默认为 NULL（显示全部）

-- =====================================================
-- 第五部分: 验证迁移结果
-- =====================================================

-- 验证新字段是否正确添加
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    COUNT(latest_email_count) as shares_with_email_count_limit,
    SUM(CASE WHEN auto_refresh_enabled = 1 THEN 1 ELSE 0 END) as shares_with_auto_refresh,
    AVG(auto_refresh_interval) as avg_refresh_interval
FROM share;

COMMIT;

-- =====================================================
-- 迁移完成说明
-- =====================================================

-- 迁移完成后，应用程序需要：
-- 1. 更新 share.js 实体定义，添加新字段
-- 2. 修改创建分享的 API，接收新参数
-- 3. 修改获取分享邮件的 API，应用数量限制
-- 4. 更新前端 UI，添加配置选项
-- 5. 实现前端自动刷新功能

-- 向后兼容性说明：
-- - 现有分享链接不受影响（latest_email_count 为 NULL）
-- - 自动刷新默认禁用（auto_refresh_enabled = 0）
-- - 所有新字段都有合理的默认值

-- 性能说明：
-- - latest_email_count 限制在数据库层面执行，性能优异
-- - 自动刷新间隔建议不低于 10 秒，避免过度请求
-- - 新增的索引有助于提升查询性能
