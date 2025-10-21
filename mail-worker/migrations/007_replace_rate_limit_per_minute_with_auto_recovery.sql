-- =====================================================
-- Cloud-Mail 频率限制功能重构数据库迁移脚本
-- 版本: 7.0.0
-- 日期: 2025-01-16
-- 说明: 将"每分钟限制"功能替换为"自动恢复时间"功能
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 第一部分: 删除旧字段
-- =====================================================

-- 删除 rate_limit_per_minute 列
ALTER TABLE share DROP COLUMN rate_limit_per_minute;

-- =====================================================
-- 第二部分: 添加新字段
-- =====================================================

-- 添加 auto_recovery_seconds 列
-- 说明：当访问者触发频率限制后，需要等待多少秒才能恢复访问
-- 取值范围：0-3600（0表示禁用自动恢复，1-3600表示恢复时间）
-- 默认值：60秒
ALTER TABLE share ADD COLUMN auto_recovery_seconds INTEGER DEFAULT 60 NOT NULL;

-- =====================================================
-- 第三部分: 创建索引优化查询性能
-- =====================================================

-- 为新字段创建索引（可选，提升查询性能）
CREATE INDEX IF NOT EXISTS idx_share_auto_recovery ON share(auto_recovery_seconds);

-- =====================================================
-- 第四部分: 验证迁移结果
-- =====================================================

-- 验证迁移是否成功
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    COUNT(CASE WHEN auto_recovery_seconds IS NOT NULL THEN 1 END) as shares_with_recovery,
    MIN(auto_recovery_seconds) as min_recovery_seconds,
    MAX(auto_recovery_seconds) as max_recovery_seconds,
    AVG(auto_recovery_seconds) as avg_recovery_seconds
FROM share;

COMMIT;

