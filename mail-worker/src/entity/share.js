import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const share = sqliteTable('share', {
	shareId: integer('share_id').primaryKey({ autoIncrement: true }),
	shareToken: text('share_token').notNull().unique(),
	targetEmail: text('target_email').notNull(),
	shareName: text('share_name').notNull(),
	keywordFilter: text('keyword_filter').default(''),
	expireTime: text('expire_time').notNull(),
	createTime: text('create_time').default(sql`CURRENT_TIMESTAMP`).notNull(),
	userId: integer('user_id').notNull(),
	isActive: integer('is_active').default(1).notNull(),
	rateLimitPerSecond: integer('rate_limit_per_second').default(5).notNull(),
	rateLimitPerMinute: integer('rate_limit_per_minute').default(60).notNull(),
	status: text('status').default('active'),
	otpCountDaily: integer('otp_count_daily').default(0),
	otpLimitDaily: integer('otp_limit_daily').default(100),
	lastResetDate: text('last_reset_date'),
	remark: text('remark').default(''),
	// 新增字段：分享类型支持
	shareType: integer('share_type').default(1).notNull(), // 1=单邮箱分享, 2=白名单验证分享
	// 授权邮箱列表（JSON数组格式，用于Type 2分享）
	authorizedEmails: text('authorized_emails').default('[]').notNull(),
	// 显示数量限制功能
	verificationCodeLimit: integer('verification_code_limit').default(100).notNull(),
	verificationCodeLimitEnabled: integer('verification_code_limit_enabled').default(1).notNull(), // 1=启用, 0=禁用
	// 访问次数限制开关
	otpLimitEnabled: integer('otp_limit_enabled').default(1).notNull(), // 1=启用, 0=禁用
	// 分享域名字段
	shareDomain: text('share_domain') // 用户选择的分享域名，NULL表示使用默认域名
});

export default share;
