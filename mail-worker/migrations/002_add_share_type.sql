-- =====================================================
-- Cloud-Mail 分享类型扩展数据库迁移脚本
-- 版本: 2.0.0 (简化版)
-- 日期: 2025-10-12
-- 说明: 基于现有架构添加分享类型支持
-- =====================================================

BEGIN TRANSACTION;

-- 添加分享类型字段
-- shareType: 1=单邮箱分享(默认), 2=白名单验证分享
ALTER TABLE share ADD COLUMN share_type INTEGER DEFAULT 1 
  CHECK(share_type IN (1, 2));

-- 为分享类型创建索引
CREATE INDEX IF NOT EXISTS idx_share_type ON share(share_type);

-- 更新现有数据为类型1
UPDATE share SET share_type = 1 WHERE share_type IS NULL;

COMMIT;

-- 验证迁移结果
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    SUM(CASE WHEN share_type = 1 THEN 1 ELSE 0 END) as type1_shares,
    SUM(CASE WHEN share_type = 2 THEN 1 ELSE 0 END) as type2_shares
FROM share;