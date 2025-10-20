-- =====================================================
-- Cloud-Mail 分享链接公告弹窗功能
-- 版本: 10.0.0
-- 日期: 2025-10-20
-- 说明: 添加公告内容字段到 share 表
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 添加公告内容字段
-- =====================================================

-- 添加 announcement_content 字段
-- 用于存储分享链接的公告内容
-- NULL 表示没有公告，字符串表示公告内容
ALTER TABLE share ADD COLUMN announcement_content TEXT;

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_share_announcement ON share(announcement_content);

COMMIT;

-- =====================================================
-- 验证迁移结果
-- =====================================================

-- 检查字段是否成功添加
PRAGMA table_info(share);

-- 验证现有数据
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    SUM(CASE WHEN announcement_content IS NOT NULL THEN 1 ELSE 0 END) as shares_with_announcement
FROM share;

