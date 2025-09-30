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
	rateLimitPerMinute: integer('rate_limit_per_minute').default(60).notNull()
});

export default share;
