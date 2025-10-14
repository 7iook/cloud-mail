-- 添加 authorized_emails 字段到 share 表
-- 用于支持多邮箱分享功能（Type 2）

ALTER TABLE share ADD COLUMN authorized_emails TEXT DEFAULT '[]' NOT NULL;

-- 更新现有记录的 authorized_emails 字段
-- 对于 Type 1 分享，authorized_emails 保持为空数组 []
-- 对于 Type 2 分享，将 target_email 添加到 authorized_emails 中
UPDATE share 
SET authorized_emails = CASE 
    WHEN share_type = 2 THEN '["' || target_email || '"]'
    ELSE '[]'
END;