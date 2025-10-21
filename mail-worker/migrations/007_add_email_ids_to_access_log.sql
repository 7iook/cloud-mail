-- =====================================================
-- Cloud-Mail 访问日志增强功能数据库迁移脚本
-- 版本: 7.0.0
-- 日期: 2025-01-15
-- 说明: 添加邮件ID列表字段到访问日志表
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 第一部分: 添加新字段
-- =====================================================

-- 1. 邮件ID列表字段
-- email_ids: 存储访问时返回的邮件ID列表（JSON数组格式）
-- 用于在访问详情页面精确查询当时返回的邮件
ALTER TABLE share_access_log ADD COLUMN email_ids TEXT DEFAULT '[]';

-- =====================================================
-- 第二部分: 创建索引优化查询性能
-- =====================================================

-- 为访问日志ID创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_share_access_log_id ON share_access_log(log_id);

-- 为分享ID创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_share_access_log_share_id ON share_access_log(share_id);

-- =====================================================
-- 第三部分: 数据验证
-- =====================================================

-- 验证迁移结果
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_logs,
    SUM(CASE WHEN email_ids IS NOT NULL THEN 1 ELSE 0 END) as logs_with_email_ids_field
FROM share_access_log;

COMMIT;

-- =====================================================
-- 回滚脚本（如需回滚，请单独执行）
-- =====================================================

-- BEGIN TRANSACTION;
-- ALTER TABLE share_access_log DROP COLUMN email_ids;
-- COMMIT;

