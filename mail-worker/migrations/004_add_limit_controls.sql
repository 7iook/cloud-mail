-- =====================================================
-- Cloud-Mail 邮件分享限制功能完善
-- 版本: 2.1.0
-- 日期: 2025-01-14
-- 说明: 添加显示数量限制和访问次数限制的开关控制
-- =====================================================

BEGIN TRANSACTION;

-- 1. 添加显示数量限制字段
ALTER TABLE share ADD COLUMN verification_code_limit INTEGER DEFAULT 100 NOT NULL;
ALTER TABLE share ADD COLUMN verification_code_limit_enabled INTEGER DEFAULT 1 NOT NULL;

-- 2. 添加访问次数限制开关
ALTER TABLE share ADD COLUMN otp_limit_enabled INTEGER DEFAULT 1 NOT NULL;

-- 3. 为新字段创建索引（可选，提升查询性能）
CREATE INDEX IF NOT EXISTS idx_share_verification_limit ON share(verification_code_limit_enabled);
CREATE INDEX IF NOT EXISTS idx_share_otp_limit ON share(otp_limit_enabled);

-- 4. 更新现有记录（确保向后兼容）
UPDATE share SET 
  verification_code_limit = 100,
  verification_code_limit_enabled = 1,
  otp_limit_enabled = 1
WHERE verification_code_limit IS NULL;

COMMIT;

-- 验证迁移结果
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    SUM(CASE WHEN verification_code_limit_enabled = 1 THEN 1 ELSE 0 END) as display_limit_enabled,
    SUM(CASE WHEN otp_limit_enabled = 1 THEN 1 ELSE 0 END) as access_limit_enabled
FROM share;

