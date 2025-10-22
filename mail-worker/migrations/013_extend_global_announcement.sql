-- =====================================================
-- Cloud-Mail 扩展全局公告系统
-- 版本: 13.0.0
-- 日期: 2025-10-22
-- 说明: 添加公告标题、展示模式、图片字段，创建用户已读状态表
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create email

BEGIN TRANSACTION;

-- =====================================================
-- 扩展 setting 表
-- =====================================================

-- 添加公告标题字段
ALTER TABLE setting ADD COLUMN global_announcement_title TEXT DEFAULT '' NOT NULL;

-- 添加展示模式字段 ('always' 或 'once')
ALTER TABLE setting ADD COLUMN global_announcement_display_mode TEXT DEFAULT 'always' NOT NULL;

-- 添加图片字段 (JSON 数组)
ALTER TABLE setting ADD COLUMN global_announcement_images TEXT DEFAULT '[]' NOT NULL;

-- =====================================================
-- 创建用户已读状态表
-- =====================================================

CREATE TABLE IF NOT EXISTS announcement_read (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    announcement_version INTEGER NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, announcement_version),
    FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_announcement_read_user_id ON announcement_read(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_read_version ON announcement_read(announcement_version);
CREATE INDEX IF NOT EXISTS idx_announcement_read_user_version ON announcement_read(user_id, announcement_version);

COMMIT;

-- =====================================================
-- 验证迁移结果
-- =====================================================

-- 检查 setting 表字段
PRAGMA table_info(setting);

-- 检查 announcement_read 表是否创建成功
PRAGMA table_info(announcement_read);

