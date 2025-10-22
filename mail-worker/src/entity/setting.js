import { sqliteTable, text, integer} from 'drizzle-orm/sqlite-core';
export const setting = sqliteTable('setting', {
	register: integer('register').default(0).notNull(),
	receive: integer('receive').default(0).notNull(),
	title: text('title').default('').notNull(),
	manyEmail: integer('many_email').default(1).notNull(),
	addEmail: integer('add_email').default(0).notNull(),
	autoRefreshTime: integer('auto_refresh_time').default(0).notNull(),
	addEmailVerify: integer('add_email_verify').default(1).notNull(),
	registerVerify: integer('register_verify').default(1).notNull(),
	regVerifyCount: integer('reg_verify_count').default(1).notNull(),
	addVerifyCount: integer('add_verify_count').default(1).notNull(),
	send: integer('send').default(1).notNull(),
	r2Domain: text('r2_domain'),
	secretKey: text('secret_key'),
	siteKey: text('site_key'),
	regKey: integer('reg_key').default(1).notNull(),
	background: text('background'),
	tgBotToken: text('tg_bot_token').default('').notNull(),
	tgChatId: text('tg_chat_id').default('').notNull(),
	tgBotStatus: integer('tg_bot_status').default(1).notNull(),
	forwardEmail: text('forward_email').default('').notNull(),
	forwardStatus: integer('forward_status').default(1).notNull(),
	ruleEmail: text('rule_email').default('').notNull(),
	ruleType: integer('rule_type').default(0).notNull(),
	loginOpacity: integer('login_opacity').default(0.88),
	resendTokens: text('resend_tokens').default("{}").notNull(),
	noticeTitle: text('notice_title').default('').notNull(),
	noticeContent: text('notice_content').default('').notNull(),
	noticeType: text('notice_type').default('').notNull(),
	noticeDuration: integer('notice_duration').default(0).notNull(),
	noticePosition: text('notice_position').default('').notNull(),
	noticeOffset: integer('notice_offset').default(0).notNull(),
	noticeWidth: integer('notice_width').default(400).notNull(),
	notice: integer('notice').default(0).notNull(),
	// 全局公告功能字段
	globalAnnouncementContent: text('global_announcement_content'), // 全局公告内容，NULL表示没有全局公告
	globalAnnouncementVersion: integer('global_announcement_version'), // 全局公告版本号（时间戳）
	globalAnnouncementEnabled: integer('global_announcement_enabled').default(0).notNull(), // 1=启用全局公告, 0=禁用
	globalAnnouncementTitle: text('global_announcement_title').default('').notNull(), // 公告标题，最多100字符
	globalAnnouncementDisplayMode: text('global_announcement_display_mode').default('always').notNull(), // 'always'=总是显示, 'once'=仅显示一次
	globalAnnouncementImages: text('global_announcement_images').default('[]').notNull(), // 图片列表（JSON数组）
	globalAnnouncementOverrideShareAnnouncement: integer('global_announcement_override_share_announcement').default(0).notNull(), // 1=覆盖单链接公告, 0=不覆盖
	globalAnnouncementAutoApplyNewShare: integer('global_announcement_auto_apply_new_share').default(1).notNull(), // 1=新链接自动使用, 0=不自动使用
	noRecipient: integer('no_recipient').default(1).notNull(),
	loginDomain: integer('login_domain').default(0).notNull(),
	bucket: text('bucket').default('').notNull(),
	region: text('region').default('').notNull(),
	endpoint: text('endpoint').default('').notNull(),
	s3AccessKey: text('s3_access_key').default('').notNull(),
	s3SecretKey: text('s3_secret_key').default('').notNull(),
	shareWhitelist: text('share_whitelist').default('').notNull()
});
export default setting
