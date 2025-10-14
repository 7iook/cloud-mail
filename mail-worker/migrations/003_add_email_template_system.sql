-- ============================================
-- 邮件分享验证码提取模板系统 - 数据库迁移
-- 版本: v1.0.0
-- 日期: 2025-01-13
-- 描述: 添加模板匹配功能,支持智能验证码提取
-- ============================================

-- 1. 创建邮件模板表
CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id TEXT NOT NULL UNIQUE,  -- 模板唯一标识 (UUID)
    user_id INTEGER NOT NULL,          -- 创建者用户ID
    name TEXT NOT NULL,                -- 模板名称 (如 "Augment Code 验证码")
    description TEXT,                  -- 模板描述
    
    -- 匹配规则 (至少配置一个)
    sender_pattern TEXT,               -- 发件人匹配正则 (如 "support@augmentcode\\.com")
    subject_pattern TEXT,              -- 主题匹配正则 (如 "Welcome to Augment Code")
    body_pattern TEXT,                 -- 正文匹配正则
    
    -- 提取规则
    extraction_regex TEXT NOT NULL,    -- 验证码提取正则 (如 "Your verification code is:\\s*(\\d{6})")
    extraction_group INTEGER DEFAULT 1, -- 正则分组索引 (默认第1组)
    code_format TEXT,                  -- 验证码格式描述 (如 "6位数字")
    
    -- 元数据
    is_active INTEGER DEFAULT 1,       -- 是否启用 (0=禁用, 1=启用)
    is_public INTEGER DEFAULT 0,       -- 是否公开模板 (0=私有, 1=公开)
    usage_count INTEGER DEFAULT 0,     -- 使用次数
    success_count INTEGER DEFAULT 0,   -- 成功提取次数
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(userId) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX idx_email_templates_user ON email_templates(user_id);
CREATE INDEX idx_email_templates_template_id ON email_templates(template_id);
CREATE INDEX idx_email_templates_public ON email_templates(is_public, is_active);

-- 2. 修改分享表,添加过滤模式字段
ALTER TABLE share ADD COLUMN filter_mode INTEGER DEFAULT 1;  -- 1=关键词, 2=模板
ALTER TABLE share ADD COLUMN template_id TEXT;                -- 关联的模板ID
ALTER TABLE share ADD COLUMN extraction_config TEXT;          -- JSON格式的提取配置

-- 创建索引
CREATE INDEX idx_share_filter_mode ON share(filter_mode);
CREATE INDEX idx_share_template_id ON share(template_id);

-- 3. 插入预设模板 (通用验证码模板)
INSERT INTO email_templates (
    template_id, 
    user_id, 
    name, 
    description,
    sender_pattern,
    subject_pattern,
    extraction_regex,
    code_format,
    is_public
) VALUES 
-- 模板1: 通用6位数字验证码
(
    '00000000-0000-0000-0000-000000000001',
    1,  -- 系统用户
    '通用6位数字验证码',
    '适用于大多数包含6位数字验证码的邮件',
    NULL,  -- 不限制发件人
    'verification|verify|code|OTP|验证码',
    '(?:verification code|verify code|code|OTP|验证码)[:\\s：]*([0-9]{6})',
    '6位数字',
    1  -- 公开模板
),

-- 模板2: Augment Code 验证码
(
    '00000000-0000-0000-0000-000000000002',
    1,
    'Augment Code 验证码',
    'Augment Code 官方验证码邮件',
    'support@augmentcode\\.com',
    'Welcome to Augment Code',
    'Your verification code is:\\s*([0-9]{6})',
    '6位数字',
    1
),

-- 模板3: GitHub 验证码
(
    '00000000-0000-0000-0000-000000000003',
    1,
    'GitHub 验证码',
    'GitHub 官方验证码邮件',
    'noreply@github\\.com',
    'verification code|Verify your',
    '(?:verification code|code)[:\\s]+([A-Z0-9]{6,8})',
    '6-8位字母数字',
    1
),

-- 模板4: 通用字母数字验证码
(
    '00000000-0000-0000-0000-000000000004',
    1,
    '通用字母数字验证码',
    '适用于字母数字混合验证码',
    NULL,
    'verification|verify|code|OTP',
    '(?:code|OTP)[:\\s]*([A-Z0-9]{4,8})',
    '4-8位字母数字',
    1
),

-- 模板5: 带分隔符验证码
(
    '00000000-0000-0000-0000-000000000005',
    1,
    '带分隔符验证码',
    '适用于 123-456 格式的验证码',
    NULL,
    'verification|verify|code',
    '(?:code|验证码)[:\\s]*([0-9]{3}-[0-9]{3})',
    '3-3位数字(带分隔符)',
    1
);

-- 4. 创建模板使用统计触发器
CREATE TRIGGER update_template_usage
AFTER UPDATE ON share
WHEN NEW.template_id IS NOT NULL
BEGIN
    UPDATE email_templates
    SET usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE template_id = NEW.template_id;
END;

-- 5. 创建模板更新时间触发器
CREATE TRIGGER update_template_timestamp
AFTER UPDATE ON email_templates
BEGIN
    UPDATE email_templates
    SET updated_at = CURRENT_TIMESTAMP
    WHERE template_id = NEW.template_id;
END;

-- ============================================
-- 回滚脚本 (如需回滚,执行以下SQL)
-- ============================================
/*
DROP TRIGGER IF EXISTS update_template_usage;
DROP TRIGGER IF EXISTS update_template_timestamp;
DROP INDEX IF EXISTS idx_email_templates_user;
DROP INDEX IF EXISTS idx_email_templates_template_id;
DROP INDEX IF EXISTS idx_email_templates_public;
DROP INDEX IF EXISTS idx_share_filter_mode;
DROP INDEX IF EXISTS idx_share_template_id;
DROP TABLE IF EXISTS email_templates;

-- 注意: SQLite不支持直接DROP COLUMN,需要重建表
-- ALTER TABLE share DROP COLUMN filter_mode;
-- ALTER TABLE share DROP COLUMN template_id;
-- ALTER TABLE share DROP COLUMN extraction_config;
*/
