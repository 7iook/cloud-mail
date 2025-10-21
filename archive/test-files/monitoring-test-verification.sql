-- 邮件监控功能数据库验证查询
-- 用于验证监控匹配逻辑和数据完整性

-- 1. 查看所有活跃的监控配置
SELECT 
    config_id,
    user_id,
    email_address,
    alias_type,
    filter_config,
    is_active,
    share_token,
    create_time
FROM monitor_config 
WHERE is_del = 0 AND is_active = 1
ORDER BY create_time DESC;

-- 2. 查看最近的测试邮件
SELECT 
    email_id,
    send_email,
    name,
    subject,
    recipient,
    cc,
    bcc,
    to_email,
    message_id,
    create_time
FROM email 
WHERE message_id LIKE '%test-%'
ORDER BY create_time DESC
LIMIT 20;

-- 3. 查看监控匹配记录
SELECT 
    me.monitor_email_id,
    me.config_id,
    me.email_id,
    me.matched_address,
    me.match_type,
    me.filter_result,
    me.create_time,
    mc.email_address as config_email,
    mc.alias_type as config_alias_type,
    e.subject as email_subject,
    e.send_email as email_sender
FROM monitor_email me
JOIN monitor_config mc ON me.config_id = mc.config_id
JOIN email e ON me.email_id = e.email_id
WHERE me.is_del = 0
ORDER BY me.create_time DESC
LIMIT 50;

-- 4. 验证精确匹配测试结果
SELECT 
    me.matched_address,
    me.match_type,
    me.filter_result,
    e.recipient,
    e.subject
FROM monitor_email me
JOIN email e ON me.email_id = e.email_id
JOIN monitor_config mc ON me.config_id = mc.config_id
WHERE mc.alias_type = 'exact' 
    AND mc.email_address = 'test@example.com'
    AND me.is_del = 0
ORDER BY me.create_time DESC;

-- 5. 验证Gmail别名匹配测试结果
SELECT 
    me.matched_address,
    me.match_type,
    me.filter_result,
    e.recipient,
    e.subject
FROM monitor_email me
JOIN email e ON me.email_id = e.email_id
JOIN monitor_config mc ON me.config_id = mc.config_id
WHERE mc.alias_type = 'gmail_alias' 
    AND (mc.email_address LIKE '%@gmail.com' OR me.matched_address LIKE '%@gmail.com')
    AND me.is_del = 0
ORDER BY me.create_time DESC;

-- 6. 验证域名通配符匹配测试结果
SELECT 
    me.matched_address,
    me.match_type,
    me.filter_result,
    e.recipient,
    e.subject
FROM monitor_email me
JOIN email e ON me.email_id = e.email_id
JOIN monitor_config mc ON me.config_id = mc.config_id
WHERE mc.alias_type = 'domain_wildcard' 
    AND mc.email_address LIKE '*@%'
    AND me.is_del = 0
ORDER BY me.create_time DESC;

-- 7. 统计各种匹配类型的数量
SELECT 
    match_type,
    COUNT(*) as match_count,
    COUNT(DISTINCT email_id) as unique_emails,
    COUNT(DISTINCT config_id) as unique_configs
FROM monitor_email 
WHERE is_del = 0
GROUP BY match_type
ORDER BY match_count DESC;

-- 8. 查看多收件人邮件的匹配情况
SELECT 
    e.email_id,
    e.subject,
    e.recipient,
    e.cc,
    e.bcc,
    COUNT(me.monitor_email_id) as match_count,
    GROUP_CONCAT(me.matched_address) as matched_addresses,
    GROUP_CONCAT(me.match_type) as match_types
FROM email e
LEFT JOIN monitor_email me ON e.email_id = me.email_id AND me.is_del = 0
WHERE (
    JSON_ARRAY_LENGTH(e.recipient) > 1 
    OR JSON_ARRAY_LENGTH(e.cc) > 0 
    OR JSON_ARRAY_LENGTH(e.bcc) > 0
)
AND e.message_id LIKE '%test-%'
GROUP BY e.email_id
ORDER BY e.create_time DESC;

-- 9. 验证JSON数据格式正确性
SELECT 
    email_id,
    subject,
    CASE 
        WHEN JSON_VALID(recipient) THEN 'Valid'
        ELSE 'Invalid'
    END as recipient_json_status,
    CASE 
        WHEN JSON_VALID(cc) THEN 'Valid'
        ELSE 'Invalid'
    END as cc_json_status,
    CASE 
        WHEN JSON_VALID(bcc) THEN 'Valid'
        ELSE 'Invalid'
    END as bcc_json_status,
    recipient,
    cc,
    bcc
FROM email 
WHERE message_id LIKE '%test-%'
ORDER BY create_time DESC;

-- 10. 验证监控记录的JSON数据格式
SELECT 
    monitor_email_id,
    matched_address,
    match_type,
    CASE 
        WHEN JSON_VALID(filter_result) THEN 'Valid'
        ELSE 'Invalid'
    END as filter_result_json_status,
    filter_result
FROM monitor_email 
WHERE is_del = 0
ORDER BY create_time DESC
LIMIT 20;

-- 11. 查看监控配置的使用统计
SELECT 
    mc.config_id,
    mc.email_address,
    mc.alias_type,
    mc.is_active,
    COUNT(me.monitor_email_id) as total_matches,
    MAX(me.create_time) as last_match_time,
    MIN(me.create_time) as first_match_time
FROM monitor_config mc
LEFT JOIN monitor_email me ON mc.config_id = me.config_id AND me.is_del = 0
WHERE mc.is_del = 0
GROUP BY mc.config_id
ORDER BY total_matches DESC;

-- 12. 检查数据一致性 - 确保所有监控记录都有对应的邮件和配置
SELECT 
    'monitor_email without email' as issue_type,
    COUNT(*) as count
FROM monitor_email me
LEFT JOIN email e ON me.email_id = e.email_id
WHERE e.email_id IS NULL AND me.is_del = 0

UNION ALL

SELECT 
    'monitor_email without config' as issue_type,
    COUNT(*) as count
FROM monitor_email me
LEFT JOIN monitor_config mc ON me.config_id = mc.config_id
WHERE mc.config_id IS NULL AND me.is_del = 0;

-- 13. 查看测试邮件的完整监控链路
SELECT 
    e.email_id,
    e.subject,
    e.send_email,
    e.recipient,
    e.create_time as email_time,
    me.monitor_email_id,
    me.matched_address,
    me.match_type,
    me.create_time as match_time,
    mc.email_address as config_email,
    mc.alias_type as config_type,
    ROUND((JULIANDAY(me.create_time) - JULIANDAY(e.create_time)) * 24 * 60 * 60, 2) as match_delay_seconds
FROM email e
LEFT JOIN monitor_email me ON e.email_id = me.email_id AND me.is_del = 0
LEFT JOIN monitor_config mc ON me.config_id = mc.config_id AND mc.is_del = 0
WHERE e.message_id LIKE '%test-%'
ORDER BY e.create_time DESC, me.create_time ASC;

-- 14. 性能分析 - 查看监控匹配的响应时间
SELECT 
    DATE(e.create_time) as test_date,
    COUNT(e.email_id) as total_emails,
    COUNT(me.monitor_email_id) as total_matches,
    AVG(ROUND((JULIANDAY(me.create_time) - JULIANDAY(e.create_time)) * 24 * 60 * 60, 2)) as avg_match_delay_seconds,
    MAX(ROUND((JULIANDAY(me.create_time) - JULIANDAY(e.create_time)) * 24 * 60 * 60, 2)) as max_match_delay_seconds
FROM email e
LEFT JOIN monitor_email me ON e.email_id = me.email_id AND me.is_del = 0
WHERE e.message_id LIKE '%test-%'
GROUP BY DATE(e.create_time)
ORDER BY test_date DESC;

-- 15. 清理测试数据的查询（仅查看，不执行删除）
SELECT 
    'Emails to be cleaned' as data_type,
    COUNT(*) as count
FROM email 
WHERE message_id LIKE '%test-%'

UNION ALL

SELECT 
    'Monitor records to be cleaned' as data_type,
    COUNT(*) as count
FROM monitor_email 
WHERE email_id IN (
    SELECT email_id FROM email WHERE message_id LIKE '%test-%'
);

-- 使用说明：
-- 1. 运行测试前，执行查询1-3查看当前状态
-- 2. 运行测试后，执行查询4-8验证匹配结果
-- 3. 执行查询9-10验证数据格式正确性
-- 4. 执行查询11-14进行统计分析和性能检查
-- 5. 执行查询15查看需要清理的测试数据数量
