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
	shareType: integer('share_type').default(1).notNull() // 1=单邮箱分享, 2=白名单验证分享
});

export default share;
