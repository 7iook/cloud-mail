-- =====================================================
-- Cloud-Mail 基础数据库表创建脚本
-- 版本: 0.0.0
-- 日期: 2025-10-22
-- 说明: 创建所有基础表结构（其他字段由迁移脚本添加）
-- =====================================================

BEGIN TRANSACTION;

-- =====================================================
-- 用户表
-- =====================================================
CREATE TABLE IF NOT EXISTS user (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    type INTEGER DEFAULT 1 NOT NULL,
    password TEXT NOT NULL,
    salt TEXT NOT NULL,
    status INTEGER DEFAULT 0 NOT NULL,
    create_time TEXT DEFAULT CURRENT_TIMESTAMP,
    active_time TEXT,
    create_ip TEXT,
    active_ip TEXT,
    os TEXT,
    browser TEXT,
    device TEXT,
    sort TEXT DEFAULT 0,
    send_count TEXT DEFAULT 0,
    reg_key_id INTEGER DEFAULT 0 NOT NULL,
    is_del INTEGER DEFAULT 0
);

-- =====================================================
-- 账户表
-- =====================================================
CREATE TABLE IF NOT EXISTS account (
    account_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT,
    status INTEGER DEFAULT 0,
    latest_email_time TEXT,
    create_time TEXT DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,
    is_del INTEGER DEFAULT 0
);

-- =====================================================
-- 邮件表
-- =====================================================
CREATE TABLE IF NOT EXISTS email (
    email_id INTEGER PRIMARY KEY AUTOINCREMENT,
    send_email TEXT,
    name TEXT,
    account_id INTEGER,
    user_id INTEGER,
    subject TEXT,
    text TEXT,
    content TEXT,
    cc TEXT,
    bcc TEXT,
    recipient TEXT,
    to_email TEXT,
    to_name TEXT,
    in_reply_to TEXT,
    relation TEXT,
    message_id TEXT,
    type TEXT DEFAULT '0',
    status TEXT,
    resend_email_id INTEGER,
    message TEXT,
    create_time TEXT DEFAULT CURRENT_TIMESTAMP,
    is_del INTEGER DEFAULT 0
);

-- =====================================================
-- 分享表 (基础字段，其他字段由迁移脚本添加)
-- =====================================================
CREATE TABLE IF NOT EXISTS share (
    share_id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_token TEXT NOT NULL UNIQUE,
    target_email TEXT NOT NULL,
    share_name TEXT NOT NULL,
    keyword_filter TEXT DEFAULT '',
    expire_time TEXT NOT NULL,
    create_time TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL
);

-- =====================================================
-- 系统设置表
-- =====================================================
CREATE TABLE IF NOT EXISTS setting (
    register INTEGER DEFAULT 0 NOT NULL,
    receive INTEGER DEFAULT 0 NOT NULL,
    title TEXT DEFAULT '' NOT NULL,
    many_email INTEGER DEFAULT 1 NOT NULL,
    add_email INTEGER DEFAULT 0 NOT NULL,
    auto_refresh_time INTEGER DEFAULT 0 NOT NULL,
    add_email_verify INTEGER DEFAULT 1 NOT NULL,
    register_verify INTEGER DEFAULT 1 NOT NULL,
    reg_verify_count INTEGER DEFAULT 0,
    add_verify_count INTEGER DEFAULT 0,
    send INTEGER DEFAULT 0 NOT NULL,
    r2_domain TEXT,
    secret_key TEXT,
    site_key TEXT,
    reg_key TEXT,
    background TEXT,
    tg_bot_token TEXT,
    tg_chat_id TEXT,
    tg_bot_status INTEGER DEFAULT 0,
    forward_email TEXT,
    forward_status INTEGER DEFAULT 0,
    rule_email TEXT,
    rule_type TEXT,
    login_opacity INTEGER DEFAULT 100,
    resend_tokens TEXT,
    notice_title TEXT,
    notice_content TEXT,
    notice_type TEXT,
    notice_duration INTEGER,
    notice_position TEXT,
    notice_offset INTEGER,
    notice_width INTEGER,
    notice INTEGER DEFAULT 0,
    no_recipient INTEGER DEFAULT 1 NOT NULL,
    login_domain TEXT,
    bucket TEXT,
    region TEXT,
    endpoint TEXT,
    s3_access_key TEXT,
    s3_secret_key TEXT,
    share_whitelist TEXT
);

-- =====================================================
-- 分享访问日志表
-- =====================================================
CREATE TABLE IF NOT EXISTS share_access_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id INTEGER,
    share_token TEXT,
    access_ip TEXT,
    user_agent TEXT,
    access_email TEXT,
    extracted_codes TEXT,
    access_result TEXT,
    error_message TEXT,
    access_time TEXT DEFAULT CURRENT_TIMESTAMP,
    response_time INTEGER,
    email_count INTEGER
);

-- =====================================================
-- 角色表
-- =====================================================
CREATE TABLE IF NOT EXISTS role (
    role_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    key TEXT,
    description TEXT,
    ban_email TEXT,
    ban_email_type TEXT,
    avail_domain TEXT,
    sort INTEGER,
    is_default INTEGER,
    create_time TEXT DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    send_count TEXT,
    send_type TEXT,
    account_count INTEGER
);

-- =====================================================
-- 创建索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE INDEX IF NOT EXISTS idx_account_email ON account(email);
CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);
CREATE INDEX IF NOT EXISTS idx_email_user_id ON email(user_id);
CREATE INDEX IF NOT EXISTS idx_email_account_id ON email(account_id);
CREATE INDEX IF NOT EXISTS idx_share_user_id ON share(user_id);
CREATE INDEX IF NOT EXISTS idx_share_token ON share(share_token);
CREATE INDEX IF NOT EXISTS idx_share_access_log_share_id ON share_access_log(share_id);
CREATE INDEX IF NOT EXISTS idx_share_access_log_token ON share_access_log(share_token);

COMMIT;
