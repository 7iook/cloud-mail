-- =====================================================
-- Cloud-Mail 修复缺失的 share 表字段
-- 版本: 9.0.0
-- 日期: 2025-10-16
-- 说明: 添加所有缺失的字段到 share 表
-- =====================================================

BEGIN TRANSACTION;

-- 1. 添加分享类型字段（Type 1=单邮箱, Type 2=白名单验证）
ALTER TABLE share ADD COLUMN share_type INTEGER DEFAULT 1 NOT NULL CHECK(share_type IN (1, 2));

-- 2. 添加授权邮箱列表（JSON数组格式，用于Type 2分享）
ALTER TABLE share ADD COLUMN authorized_emails TEXT DEFAULT '[]' NOT NULL;

-- 3. 添加显示数量限制字段
ALTER TABLE share ADD COLUMN verification_code_limit INTEGER DEFAULT 100 NOT NULL;
ALTER TABLE share ADD COLUMN verification_code_limit_enabled INTEGER DEFAULT 1 NOT NULL;

-- 4. 添加访问次数限制开关
ALTER TABLE share ADD COLUMN otp_limit_enabled INTEGER DEFAULT 1 NOT NULL;

-- 5. 添加分享域名字段
ALTER TABLE share ADD COLUMN share_domain TEXT;

-- 6. 添加最新邮件数量限制字段
ALTER TABLE share ADD COLUMN latest_email_count INTEGER;

-- 7. 添加自动刷新功能字段
ALTER TABLE share ADD COLUMN auto_refresh_enabled INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE share ADD COLUMN auto_refresh_interval INTEGER DEFAULT 30 NOT NULL;

-- 8. 添加模板匹配功能字段
ALTER TABLE share ADD COLUMN filter_mode INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE share ADD COLUMN template_id TEXT;
ALTER TABLE share ADD COLUMN show_full_email INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE share ADD COLUMN extraction_regex TEXT;

-- 9. 添加冷却功能配置字段
ALTER TABLE share ADD COLUMN cooldown_enabled INTEGER DEFAULT 1 NOT NULL CHECK(cooldown_enabled IN (0, 1));
ALTER TABLE share ADD COLUMN cooldown_seconds INTEGER DEFAULT 10 NOT NULL CHECK(cooldown_seconds >= 1 AND cooldown_seconds <= 300);

-- =====================================================
-- 第二部分: 创建索引优化查询性能
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_share_type ON share(share_type);
CREATE INDEX IF NOT EXISTS idx_share_verification_limit ON share(verification_code_limit_enabled);
CREATE INDEX IF NOT EXISTS idx_share_otp_limit ON share(otp_limit_enabled);
CREATE INDEX IF NOT EXISTS idx_share_filter_mode ON share(filter_mode);
CREATE INDEX IF NOT EXISTS idx_share_template_id ON share(template_id);
CREATE INDEX IF NOT EXISTS idx_share_cooldown_config ON share(cooldown_enabled, cooldown_seconds);
CREATE INDEX IF NOT EXISTS idx_share_auto_recovery ON share(auto_recovery_seconds);

COMMIT;

-- 验证迁移结果
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    SUM(CASE WHEN share_type = 1 THEN 1 ELSE 0 END) as type1_shares,
    SUM(CASE WHEN share_type = 2 THEN 1 ELSE 0 END) as type2_shares
FROM share;
