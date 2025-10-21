-- =====================================================
-- Cloud-Mail 冷却功能配置数据库迁移脚本
-- 版本: 8.0.0
-- 日期: 2025-10-15
-- 说明: 添加邮箱验证冷却功能的配置字段
-- =====================================================

-- ⚠️ 警告: 执行前请备份数据库！
-- 备份命令（Cloudflare D1）:
-- wrangler d1 backup create cloud-mail-db

BEGIN TRANSACTION;

-- =====================================================
-- 第一部分: 添加新字段
-- =====================================================

-- 1. 冷却功能开关字段
-- cooldown_enabled: 是否启用冷却功能（1=启用, 0=禁用）
ALTER TABLE share ADD COLUMN cooldown_enabled INTEGER DEFAULT 1 NOT NULL
  CHECK(cooldown_enabled IN (0, 1));

-- 2. 冷却时间配置字段
-- cooldown_seconds: 冷却时间（秒），范围1-300秒
ALTER TABLE share ADD COLUMN cooldown_seconds INTEGER DEFAULT 10 NOT NULL
  CHECK(cooldown_seconds >= 1 AND cooldown_seconds <= 300);

-- =====================================================
-- 第二部分: 为现有记录设置默认值
-- =====================================================

-- 确保现有记录有正确的默认值
UPDATE share 
SET cooldown_enabled = 1, cooldown_seconds = 10 
WHERE cooldown_enabled IS NULL OR cooldown_seconds IS NULL;

-- =====================================================
-- 第三部分: 创建索引优化查询性能
-- =====================================================

-- 为冷却配置创建索引（用于查询优化）
CREATE INDEX IF NOT EXISTS idx_share_cooldown_config ON share(cooldown_enabled, cooldown_seconds);

-- =====================================================
-- 第四部分: 验证迁移结果
-- =====================================================

-- 验证字段添加成功
SELECT 
    'Migration Validation' as check_type,
    COUNT(*) as total_shares,
    SUM(CASE WHEN cooldown_enabled = 1 THEN 1 ELSE 0 END) as enabled_count,
    SUM(CASE WHEN cooldown_enabled = 0 THEN 1 ELSE 0 END) as disabled_count,
    AVG(cooldown_seconds) as avg_cooldown_seconds,
    MIN(cooldown_seconds) as min_cooldown_seconds,
    MAX(cooldown_seconds) as max_cooldown_seconds
FROM share;

-- 检查表结构
PRAGMA table_info(share);

-- 检查约束是否生效
SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='share' AND name LIKE '%cooldown%';

COMMIT;

-- =====================================================
-- 回滚脚本（如遇问题执行）
-- =====================================================
/*
BEGIN TRANSACTION;

-- 删除索引
DROP INDEX IF EXISTS idx_share_cooldown_config;

-- 注意: SQLite 不支持 DROP COLUMN
-- 如需完全回滚，需要重建表：
-- 1. 创建新表（不包含冷却配置字段）
-- 2. 复制数据
-- 3. 删除旧表
-- 4. 重命名新表

-- 示例回滚步骤（谨慎使用）:
-- CREATE TABLE share_backup AS SELECT * FROM share;
-- CREATE TABLE share_new AS SELECT 
--   share_id, share_token, target_email, share_name, keyword_filter,
--   expire_time, create_time, user_id, is_active, rate_limit_per_second,
--   rate_limit_per_minute, status, otp_count_daily, otp_limit_daily,
--   last_reset_date, remark, share_type, authorized_emails,
--   verification_code_limit, verification_code_limit_enabled,
--   otp_limit_enabled, share_domain, latest_email_count,
--   auto_refresh_enabled, auto_refresh_interval, filter_mode,
--   template_id, show_full_email
-- FROM share;
-- DROP TABLE share;
-- ALTER TABLE share_new RENAME TO share;

COMMIT;
*/

-- =====================================================
-- 执行说明
-- =====================================================
/*
1. Cloudflare Workers 环境执行:
   wrangler d1 execute cloud-mail-db --file=./migrations/008_add_cooldown_config.sql

2. 本地SQLite执行:
   sqlite3 cloud-mail.db < ./migrations/008_add_cooldown_config.sql

3. 验证执行结果:
   - 检查是否有错误输出
   - 运行验证脚本确认字段和索引创建成功
   - 检查现有数据的冷却配置字段是否正确初始化

4. 测试建议:
   - 先在开发环境测试
   - 确认无误后再应用到生产环境
   - 执行前务必备份数据库
   - 验证约束条件是否正确生效

5. 功能说明:
   - cooldown_enabled=1: 启用冷却功能（默认）
   - cooldown_enabled=0: 禁用冷却功能，用户可无限制点击
   - cooldown_seconds: 冷却时间，默认10秒，范围1-300秒
   - 向后兼容: 现有分享保持原有10秒冷却行为
*/