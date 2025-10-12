-- =====================================================
-- Cloud-Mail 分享管理 MVP 数据库迁移脚本
-- 版本: 1.0.0
-- 日期: 2025-10-12
-- 说明: 为 share 表添加 MVP 功能所需字段
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 第一部分: 添加新字段
-- =====================================================

-- 1. 状态管理字段
ALTER TABLE share ADD COLUMN status TEXT DEFAULT 'active'
  CHECK(status IN ('active', 'expired', 'disabled'));

-- 2. 每日统计字段
ALTER TABLE share ADD COLUMN otp_count_daily INTEGER DEFAULT 0;
ALTER TABLE share ADD COLUMN otp_limit_daily INTEGER DEFAULT 100;
ALTER TABLE share ADD COLUMN last_reset_date TEXT; -- 格式: 'YYYY-MM-DD'

-- 3. 备注字段
ALTER TABLE share ADD COLUMN remark TEXT DEFAULT '';

-- 4. 更新时间戳字段（可选）
ALTER TABLE share ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- 第二部分: 创建索引优化查询性能
-- =====================================================

-- 按状态查询索引
CREATE INDEX IF NOT EXISTS idx_share_status ON share(status);

-- 按过期时间查询索引
CREATE INDEX IF NOT EXISTS idx_share_expire_time ON share(expire_time);

-- 组合索引：用户+状态
CREATE INDEX IF NOT EXISTS idx_share_user_status ON share(user_id, status);

-- 组合索引：用户+过期时间
CREATE INDEX IF NOT EXISTS idx_share_user_expire ON share(user_id, expire_time);

-- =====================================================
-- 第三部分: 初始化现有数据
-- =====================================================

-- 根据现有 is_active 和 expire_time 计算状态
UPDATE share
SET status = CASE
  WHEN is_active = 0 THEN 'disabled'
  WHEN datetime(expire_time) < datetime('now') THEN 'expired'
  ELSE 'active'
END
WHERE status IS NULL OR status = 'active';

-- 初始化 last_reset_date 为今天
UPDATE share
SET last_reset_date = date('now')
WHERE last_reset_date IS NULL;

COMMIT;

-- =====================================================
-- 验证脚本（执行后运行以检查结果）
-- =====================================================

-- 检查表结构
SELECT sql FROM sqlite_master WHERE type='table' AND name='share';

-- 检查索引
SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='share';

-- 统计各状态数量
SELECT
  status,
  COUNT(*) as count,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
  SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count,
  SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) as disabled_count
FROM share
GROUP BY status;

-- 检查字段是否正确添加
PRAGMA table_info(share);

-- =====================================================
-- 回滚脚本（如遇问题执行）
-- =====================================================
/*
BEGIN TRANSACTION;

-- 删除索引
DROP INDEX IF EXISTS idx_share_status;
DROP INDEX IF EXISTS idx_share_expire_time;
DROP INDEX IF EXISTS idx_share_user_status;
DROP INDEX IF EXISTS idx_share_user_expire;

-- 注意: SQLite 不支持 DROP COLUMN
-- 如需完全回滚，需要重建表：
-- 1. 创建新表（不包含新字段）
-- 2. 复制数据
-- 3. 删除旧表
-- 4. 重命名新表

COMMIT;
*/

-- =====================================================
-- 执行说明
-- =====================================================
/*
1. Cloudflare Workers 环境执行:
   wrangler d1 execute cloud-mail-db --file=./migrations/001_add_mvp_fields.sql

2. 本地SQLite执行:
   sqlite3 cloud-mail.db < ./migrations/001_add_mvp_fields.sql

3. 验证执行结果:
   - 检查是否有错误输出
   - 运行验证脚本确认字段和索引创建成功
   - 检查现有数据的 status 字段是否正确初始化

4. 测试建议:
   - 先在开发环境测试
   - 确认无误后再应用到生产环境
   - 执行前务必备份数据库
*/
