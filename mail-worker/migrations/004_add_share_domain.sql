-- =====================================================
-- Cloud-Mail 分享域名选择功能修复数据库迁移脚本
-- 版本: 4.0.0
-- 日期: 2025-01-14
-- 说明: 添加 shareDomain 字段以支持用户自定义分享域名
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 第一部分: 添加 shareDomain 字段
-- =====================================================

-- 添加分享域名字段
-- shareDomain: 用户选择的分享域名，用于生成分享链接
ALTER TABLE share ADD COLUMN share_domain TEXT;

-- =====================================================
-- 第二部分: 创建索引优化查询性能
-- =====================================================

-- 为分享域名创建索引（可选，用于统计查询）
CREATE INDEX IF NOT EXISTS idx_share_domain ON share(share_domain);

-- =====================================================
-- 第三部分: 初始化现有数据
-- =====================================================

-- 为现有分享记录设置默认域名
-- 注意：这里使用 NULL 作为默认值，表示使用系统默认域名
-- 在实际应用中，getBaseUrl 函数会处理 NULL 值并回退到配置的域名
UPDATE share 
SET share_domain = NULL 
WHERE share_domain IS NULL;

COMMIT;

-- =====================================================
-- 验证脚本（执行后运行以检查结果）
-- =====================================================

-- 检查字段是否成功添加
PRAGMA table_info(share);

-- 检查现有数据
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    COUNT(share_domain) as shares_with_domain,
    COUNT(*) - COUNT(share_domain) as shares_with_null_domain
FROM share;

-- 显示最近的几条记录以验证结构
SELECT 
    share_id,
    target_email,
    share_name,
    share_domain,
    create_time
FROM share 
ORDER BY create_time DESC 
LIMIT 5;
