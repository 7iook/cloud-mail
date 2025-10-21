import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const shareAccessLog = sqliteTable('share_access_log', {
	logId: integer('log_id').primaryKey({ autoIncrement: true }),
	shareId: integer('share_id').notNull(),
	shareToken: text('share_token').notNull(),
	accessIp: text('access_ip').notNull(),
	userAgent: text('user_agent').default(''),
	accessEmail: text('access_email').notNull(),
	extractedCodes: text('extracted_codes').default('[]'), // JSON数组存储提取的验证码
	accessResult: text('access_result').notNull(), // 'success', 'failed', 'rejected'
	errorMessage: text('error_message').default(''),
	accessTime: text('access_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
	responseTime: integer('response_time').default(0), // 响应时间(毫秒)
	emailCount: integer('email_count').default(0), // 返回的邮件数量
	emailIds: text('email_ids').default('[]') // JSON数组存储访问时返回的邮件ID列表
});

export default shareAccessLog;
