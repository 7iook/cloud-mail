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
	autoRecoverySeconds: integer('auto_recovery_seconds').default(60).notNull(),
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
	shareDomain: text('share_domain'), // 用户选择的分享域名，NULL表示使用默认域名
	// 最新邮件数量限制功能
	latestEmailCount: integer('latest_email_count'), // 最新邮件显示数量，NULL表示显示全部
	// 自动刷新功能
	autoRefreshEnabled: integer('auto_refresh_enabled').default(0).notNull(), // 1=启用, 0=禁用
	autoRefreshInterval: integer('auto_refresh_interval').default(30).notNull(), // 自动刷新间隔（秒）
	// 模板匹配功能
	filterMode: integer('filter_mode').default(1).notNull(), // 1=关键词过滤, 2=模板匹配
	templateId: text('template_id'), // 关联的模板ID
	showFullEmail: integer('show_full_email').default(1).notNull(), // 1=显示完整邮件, 0=仅显示提取的验证码
	// 冷却功能配置
	cooldownEnabled: integer('cooldown_enabled').default(1).notNull(), // 1=启用冷却, 0=禁用冷却
	cooldownSeconds: integer('cooldown_seconds').default(10).notNull(), // 冷却时间（秒），默认10秒
	// 人机验证功能
	enableCaptcha: integer('enable_captcha').default(0).notNull(), // 1=启用人机验证, 0=禁用
	// 公告弹窗功能
	announcementContent: text('announcement_content') // 分享链接的公告内容，NULL表示没有公告
});

export default share;
