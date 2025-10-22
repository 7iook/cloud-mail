-- =====================================================
-- Cloud-Mail 全局公告系统功能
-- 版本: 12.0.0
-- 日期: 2025-10-22
-- 说明: 添加全局公告管理功能，支持全局公告和分享级别例外处理
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 第一部分: 为 setting 表添加全局公告字段
-- =====================================================

-- 1. 全局公告内容字段
-- global_announcement_content: 存储全局公告内容（支持纯文本和JSON富文本格式）
-- NULL 表示没有全局公告
ALTER TABLE setting ADD COLUMN global_announcement_content TEXT;

-- 2. 全局公告版本号字段
-- global_announcement_version: 时间戳，用于版本控制
-- 当全局公告更新时，此字段会更新，前端可通过比较版本号判断是否需要重新显示
ALTER TABLE setting ADD COLUMN global_announcement_version INTEGER;

-- 3. 全局公告启用开关
-- global_announcement_enabled: 1=启用全局公告, 0=禁用全局公告
-- 默认为 0（禁用），管理员需要明确启用
ALTER TABLE setting ADD COLUMN global_announcement_enabled INTEGER DEFAULT 0 NOT NULL;

-- =====================================================
-- 第二部分: 为 share 表添加全局公告控制字段
-- =====================================================

-- 1. 使用全局公告标记
-- use_global_announcement: 1=使用全局公告, 0=使用自定义公告
-- 默认为 1（使用全局公告），允许分享所有者覆盖为自定义公告
ALTER TABLE share ADD COLUMN use_global_announcement INTEGER DEFAULT 1 NOT NULL;

-- =====================================================
-- 第三部分: 创建索引以优化查询性能
-- =====================================================

-- 为全局公告字段创建索引
CREATE INDEX IF NOT EXISTS idx_setting_global_announcement ON setting(global_announcement_enabled);
CREATE INDEX IF NOT EXISTS idx_setting_global_announcement_version ON setting(global_announcement_version);

-- 为分享表的全局公告控制字段创建索引
CREATE INDEX IF NOT EXISTS idx_share_use_global_announcement ON share(use_global_announcement);

-- =====================================================
-- 第四部分: 数据初始化
-- =====================================================

-- 对于现有的分享，默认使用自定义公告（保持向后兼容）
-- 这样现有的分享不会被全局公告覆盖
UPDATE share 
SET use_global_announcement = 0 
WHERE announcement_content IS NOT NULL;

-- 对于没有公告的分享，默认使用全局公告
-- 这样新创建的分享可以自动应用全局公告
UPDATE share 
SET use_global_announcement = 1 
WHERE announcement_content IS NULL;

COMMIT;

-- =====================================================
-- 验证迁移结果
-- =====================================================

-- 检查 setting 表字段
PRAGMA table_info(setting);

-- 检查 share 表字段
PRAGMA table_info(share);

-- 验证数据初始化
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    SUM(CASE WHEN use_global_announcement = 1 THEN 1 ELSE 0 END) as shares_using_global,
    SUM(CASE WHEN use_global_announcement = 0 THEN 1 ELSE 0 END) as shares_using_custom
FROM share;

