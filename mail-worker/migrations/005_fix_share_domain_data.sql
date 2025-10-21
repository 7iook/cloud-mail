-- =====================================================
-- Cloud-Mail 分享域名数据修复脚本
-- 版本: 5.0.0
-- 日期: 2025-01-14
-- 说明: 修复 share_domain 字段中的错误数据
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 第一部分: 修复错误的 share_domain 数据
-- =====================================================

-- 将所有值为字面字符串 "share_domain" 的记录更新为 NULL
-- NULL 表示使用系统默认域名（从环境变量 domain 中获取）
UPDATE share 
SET share_domain = NULL 
WHERE share_domain = 'share_domain';

-- =====================================================
-- 第二部分: 验证修复结果
-- =====================================================

-- 检查修复后的数据
SELECT 
    'Data Fix Validation' as check_type,
    COUNT(*) as total_shares,
    COUNT(share_domain) as shares_with_custom_domain,
    COUNT(*) - COUNT(share_domain) as shares_using_default_domain,
    SUM(CASE WHEN share_domain = 'share_domain' THEN 1 ELSE 0 END) as shares_with_error_domain
FROM share;

-- 显示最近的几条记录以验证修复
SELECT 
    share_id,
    target_email,
    share_name,
    share_domain,
    CASE 
        WHEN share_domain IS NULL THEN '使用默认域名'
        WHEN share_domain = 'share_domain' THEN '错误数据'
        ELSE '自定义域名: ' || share_domain
    END as domain_status,
    create_time
FROM share 
ORDER BY create_time DESC 
LIMIT 10;

COMMIT;

-- =====================================================
-- 执行说明
-- =====================================================
-- 
-- 本地开发环境执行:
-- wrangler d1 execute cloud-mail-db --local --file=./migrations/005_fix_share_domain_data.sql
--
-- 生产环境执行:
-- wrangler d1 execute cloud-mail-db --remote --file=./migrations/005_fix_share_domain_data.sql
--
-- =====================================================

