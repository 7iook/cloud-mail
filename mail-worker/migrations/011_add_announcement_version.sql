-- =====================================================
-- Cloud-Mail 分享链接公告版本控制功能
-- 版本: 11.0.0
-- 日期: 2025-10-20
-- 说明: 添加公告版本字段到 share 表，支持公告内容更新后重新推送
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 添加公告版本字段
-- =====================================================

-- 添加 announcement_version 字段
-- 用于存储公告的版本号（时间戳）
-- 当公告内容更新时，版本号会更新
-- 前端通过比较版本号来判断是否需要重新显示公告
ALTER TABLE share ADD COLUMN announcement_version INTEGER;

-- 为现有的有公告内容的记录设置版本号
-- 使用当前时间戳作为版本号
UPDATE share 
SET announcement_version = CAST(strftime('%s', 'now') AS INTEGER)
WHERE announcement_content IS NOT NULL AND announcement_version IS NULL;

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_share_announcement_version ON share(announcement_version);

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
    SUM(CASE WHEN announcement_content IS NOT NULL THEN 1 ELSE 0 END) as shares_with_announcement,
    SUM(CASE WHEN announcement_version IS NOT NULL THEN 1 ELSE 0 END) as shares_with_version
FROM share;

