import app from '../hono/hono';
import settingService from '../service/setting-service';
import { t } from '../i18n/i18n';

class init {
	async init(c) {
		const secret = c.req.param('secret');
		if (secret !== c.env.jwt_secret) {
			return c.text(t('initFailed'));
		}

		// 执行所有初始化和迁移
		await this.v2_8DB(c); // 添加人机验证功能字段
		await this.migrateAddEmailIds(c); // 添加email_ids字段到share_access_log表
		await this.migrateAddAnnouncementContent(c); // 添加公告内容字段
		await this.migrateAddGlobalAnnouncement(c); // 添加全局公告字段
		await this.migrateExtendGlobalAnnouncement(c); // 扩展全局公告系统（标题、展示模式、图片、已读状态）
		await this.migrateExtendGlobalAnnouncementConfig(c); // 扩展全局公告配置（覆盖开关、自动应用开关）
		await settingService.refresh(c);
		return c.text(t('initSuccess'));
	}

	async v2_8DB(c) {
		try {
			const tableInfo = await c.env.db.prepare(`PRAGMA table_info(share)`).all();
			const hasEnableCaptcha = tableInfo.results.some(column => column.name === 'enable_captcha');

			if (!hasEnableCaptcha) {
				await c.env.db.prepare(`ALTER TABLE share ADD COLUMN enable_captcha INTEGER DEFAULT 0`).run();
				console.log('✓ enable_captcha 字段添加成功');
			}
		} catch (error) {
			console.error('enable_captcha 字段迁移失败:', error);
		}
	}

	async migrateAddEmailIds(c) {
		try {
			const tableInfo = await c.env.db.prepare(`PRAGMA table_info(share_access_log)`).all();
			const hasEmailIds = tableInfo.results.some(column => column.name === 'email_ids');

			if (!hasEmailIds) {
				await c.env.db.prepare(`ALTER TABLE share_access_log ADD COLUMN email_ids TEXT`).run();
				console.log('✓ email_ids 字段添加成功');
			}
		} catch (error) {
			console.error('email_ids 字段迁移失败:', error);
		}
	}

	// 执行数据库迁移 - 添加公告内容字段
	async migrateAddAnnouncementContent(c) {
		try {
			console.log('[MIGRATION] ========== 开始公告字段迁移 ==========');
			// 检查字段是否已存在
			const tableInfo = await c.env.db.prepare(`PRAGMA table_info(share)`).all();
			console.log('[MIGRATION] 表结构检查完成，共', tableInfo.results.length, '个字段');
			
			const hasAnnouncementContent = tableInfo.results.some(column => column.name === 'announcement_content');
			const hasAnnouncementVersion = tableInfo.results.some(column => column.name === 'announcement_version');

			console.log('[MIGRATION] announcement_content 存在:', hasAnnouncementContent);
			console.log('[MIGRATION] announcement_version 存在:', hasAnnouncementVersion);

			let addedFields = [];

			if (!hasAnnouncementContent) {
				console.log('[MIGRATION] 添加 announcement_content 字段...');
				// 添加announcement_content字段
				await c.env.db.prepare(`ALTER TABLE share ADD COLUMN announcement_content TEXT`).run();
				addedFields.push('announcement_content');
				console.log('[MIGRATION] ✓ announcement_content 字段添加成功');
			}

			if (!hasAnnouncementVersion) {
				console.log('[MIGRATION] 添加 announcement_version 字段...');
				// 添加announcement_version字段
				await c.env.db.prepare(`ALTER TABLE share ADD COLUMN announcement_version INTEGER`).run();
				addedFields.push('announcement_version');
				console.log('[MIGRATION] ✓ announcement_version 字段添加成功');
			}

			if (addedFields.length > 0) {
				console.log('[MIGRATION] 创建索引...');
				// 创建索引
				await c.env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_share_announcement ON share(announcement_content)`).run();
				await c.env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_share_announcement_version ON share(announcement_version)`).run();
				console.log('[MIGRATION] ✓ 索引创建成功');

				console.log('[MIGRATION] ========== 公告字段迁移完成 ==========');
				return {
					success: true,
					message: `公告字段添加成功: ${addedFields.join(', ')}`,
					addedFields: addedFields
				};
			} else {
				console.log('[MIGRATION] ========== 公告字段已存在，无需迁移 ==========');
				return { success: true, message: '公告字段已存在，无需迁移' };
			}
		} catch (error) {
			console.error('[MIGRATION] ========== 公告字段迁移失败 ==========');
			console.error('[MIGRATION] 错误详情:', error);
			return { success: false, message: '迁移失败: ' + error.message };
		}
	}

	// 执行数据库迁移 - 添加全局公告字段
	async migrateAddGlobalAnnouncement(c) {
		try {
			console.log('[MIGRATION] ========== 开始全局公告字段迁移 ==========');
			
			// 检查 setting 表字段
			const settingTableInfo = await c.env.db.prepare(`PRAGMA table_info(setting)`).all();
			const hasGlobalAnnouncementContent = settingTableInfo.results.some(column => column.name === 'global_announcement_content');
			const hasGlobalAnnouncementVersion = settingTableInfo.results.some(column => column.name === 'global_announcement_version');
			const hasGlobalAnnouncementEnabled = settingTableInfo.results.some(column => column.name === 'global_announcement_enabled');

			// 检查 share 表字段
			const shareTableInfo = await c.env.db.prepare(`PRAGMA table_info(share)`).all();
			const hasUseGlobalAnnouncement = shareTableInfo.results.some(column => column.name === 'use_global_announcement');

			let addedFields = [];

			// 添加 setting 表字段
			if (!hasGlobalAnnouncementContent) {
				console.log('[MIGRATION] 添加 global_announcement_content 字段...');
				await c.env.db.prepare(`ALTER TABLE setting ADD COLUMN global_announcement_content TEXT`).run();
				addedFields.push('global_announcement_content');
				console.log('[MIGRATION] ✓ global_announcement_content 字段添加成功');
			}

			if (!hasGlobalAnnouncementVersion) {
				console.log('[MIGRATION] 添加 global_announcement_version 字段...');
				await c.env.db.prepare(`ALTER TABLE setting ADD COLUMN global_announcement_version INTEGER`).run();
				addedFields.push('global_announcement_version');
				console.log('[MIGRATION] ✓ global_announcement_version 字段添加成功');
			}

			if (!hasGlobalAnnouncementEnabled) {
				console.log('[MIGRATION] 添加 global_announcement_enabled 字段...');
				await c.env.db.prepare(`ALTER TABLE setting ADD COLUMN global_announcement_enabled INTEGER DEFAULT 0 NOT NULL`).run();
				addedFields.push('global_announcement_enabled');
				console.log('[MIGRATION] ✓ global_announcement_enabled 字段添加成功');
			}

			// 添加 share 表字段
			if (!hasUseGlobalAnnouncement) {
				console.log('[MIGRATION] 添加 use_global_announcement 字段...');
				await c.env.db.prepare(`ALTER TABLE share ADD COLUMN use_global_announcement INTEGER DEFAULT 1 NOT NULL`).run();
				addedFields.push('use_global_announcement');
				console.log('[MIGRATION] ✓ use_global_announcement 字段添加成功');

				// 初始化数据
				console.log('[MIGRATION] 初始化 use_global_announcement 数据...');
				await c.env.db.prepare(`UPDATE share SET use_global_announcement = 0 WHERE announcement_content IS NOT NULL`).run();
				await c.env.db.prepare(`UPDATE share SET use_global_announcement = 1 WHERE announcement_content IS NULL`).run();
				console.log('[MIGRATION] ✓ 数据初始化成功');
			}

			if (addedFields.length > 0) {
				console.log('[MIGRATION] 创建索引...');
				await c.env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_setting_global_announcement ON setting(global_announcement_enabled)`).run();
				await c.env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_share_use_global_announcement ON share(use_global_announcement)`).run();
				console.log('[MIGRATION] ✓ 索引创建成功');

				console.log('[MIGRATION] ========== 全局公告字段迁移完成 ==========');
				return {
					success: true,
					message: `全局公告字段添加成功: ${addedFields.join(', ')}`,
					addedFields: addedFields
				};
			} else {
				console.log('[MIGRATION] ========== 全局公告字段已存在，无需迁移 ==========');
				return { success: true, message: '全局公告字段已存在，无需迁移' };
			}
		} catch (error) {
			console.error('[MIGRATION] ========== 全局公告字段迁移失败 ==========');
			console.error('[MIGRATION] 错误详情:', error);
			return { success: false, message: '迁移失败: ' + error.message };
		}
	}

	// 执行数据库迁移 - 扩展全局公告系统
	async migrateExtendGlobalAnnouncement(c) {
		try {
			console.log('[MIGRATION] ========== 开始扩展全局公告系统迁移 ==========');

			// 检查 setting 表字段
			const settingTableInfo = await c.env.db.prepare(`PRAGMA table_info(setting)`).all();
			const hasTitle = settingTableInfo.results.some(column => column.name === 'global_announcement_title');
			const hasDisplayMode = settingTableInfo.results.some(column => column.name === 'global_announcement_display_mode');
			const hasImages = settingTableInfo.results.some(column => column.name === 'global_announcement_images');

			// 检查 announcement_read 表是否存在
			const tables = await c.env.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='announcement_read'`).all();
			const hasAnnouncementReadTable = tables.results.length > 0;

			let addedFields = [];

			// 添加 setting 表字段
			if (!hasTitle) {
				console.log('[MIGRATION] 添加 global_announcement_title 字段...');
				await c.env.db.prepare(`ALTER TABLE setting ADD COLUMN global_announcement_title TEXT DEFAULT '' NOT NULL`).run();
				addedFields.push('global_announcement_title');
				console.log('[MIGRATION] ✓ global_announcement_title 字段添加成功');
			}

			if (!hasDisplayMode) {
				console.log('[MIGRATION] 添加 global_announcement_display_mode 字段...');
				await c.env.db.prepare(`ALTER TABLE setting ADD COLUMN global_announcement_display_mode TEXT DEFAULT 'always' NOT NULL`).run();
				addedFields.push('global_announcement_display_mode');
				console.log('[MIGRATION] ✓ global_announcement_display_mode 字段添加成功');
			}

			if (!hasImages) {
				console.log('[MIGRATION] 添加 global_announcement_images 字段...');
				await c.env.db.prepare(`ALTER TABLE setting ADD COLUMN global_announcement_images TEXT DEFAULT '[]' NOT NULL`).run();
				addedFields.push('global_announcement_images');
				console.log('[MIGRATION] ✓ global_announcement_images 字段添加成功');
			}

			// 创建 announcement_read 表
			if (!hasAnnouncementReadTable) {
				console.log('[MIGRATION] 创建 announcement_read 表...');
				await c.env.db.prepare(`
					CREATE TABLE announcement_read (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						user_id INTEGER NOT NULL,
						announcement_version INTEGER NOT NULL,
						read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
						UNIQUE(user_id, announcement_version),
						FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
					)
				`).run();
				addedFields.push('announcement_read_table');
				console.log('[MIGRATION] ✓ announcement_read 表创建成功');

				// 创建索引
				console.log('[MIGRATION] 创建 announcement_read 表索引...');
				await c.env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_announcement_read_user_id ON announcement_read(user_id)`).run();
				await c.env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_announcement_read_version ON announcement_read(announcement_version)`).run();
				await c.env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_announcement_read_user_version ON announcement_read(user_id, announcement_version)`).run();
				console.log('[MIGRATION] ✓ 索引创建成功');
			}

			if (addedFields.length > 0) {
				console.log('[MIGRATION] ========== 扩展全局公告系统迁移完成 ==========');
				return {
					success: true,
					message: `扩展全局公告系统成功: ${addedFields.join(', ')}`,
					addedFields: addedFields
				};
			} else {
				console.log('[MIGRATION] ========== 扩展全局公告系统字段已存在，无需迁移 ==========');
				return { success: true, message: '扩展全局公告系统字段已存在，无需迁移' };
			}
		} catch (error) {
			console.error('[MIGRATION] ========== 扩展全局公告系统迁移失败 ==========');
			console.error('[MIGRATION] 错误详情:', error);
			return { success: false, message: '迁移失败: ' + error.message };
		}
	}

	async migrateExtendGlobalAnnouncementConfig(c) {
		try {
			console.log('[MIGRATION] ========== 开始扩展全局公告配置迁移 ==========');

			// Check setting table fields
			const settingTableInfo = await c.env.db.prepare(`PRAGMA table_info(setting)`).all();
			const hasOverrideField = settingTableInfo.results.some(column => column.name === 'global_announcement_override_share_announcement');
			const hasAutoApplyField = settingTableInfo.results.some(column => column.name === 'global_announcement_auto_apply_new_share');

			let addedFields = [];

			// Add override field if missing
			if (!hasOverrideField) {
				await c.env.db.prepare(`ALTER TABLE setting ADD COLUMN global_announcement_override_share_announcement INTEGER DEFAULT 0 NOT NULL`).run();
				addedFields.push('global_announcement_override_share_announcement');
				console.log('✓ global_announcement_override_share_announcement 字段添加成功');
			}

			// Add auto-apply field if missing
			if (!hasAutoApplyField) {
				await c.env.db.prepare(`ALTER TABLE setting ADD COLUMN global_announcement_auto_apply_new_share INTEGER DEFAULT 1 NOT NULL`).run();
				addedFields.push('global_announcement_auto_apply_new_share');
				console.log('✓ global_announcement_auto_apply_new_share 字段添加成功');
			}

			if (addedFields.length === 0) {
				console.log('[MIGRATION] 全局公告配置字段已存在，无需迁移');
			} else {
				console.log(`[MIGRATION] 成功添加 ${addedFields.length} 个字段: ${addedFields.join(', ')}`);
			}

			console.log('[MIGRATION] ========== 全局公告配置迁移完成 ==========');
			return { success: true, message: '全局公告配置迁移完成', addedFields };
		} catch (error) {
			console.error('[MIGRATION] 全局公告配置迁移失败:', error);
			return { success: false, message: '迁移失败: ' + error.message };
		}
	}
}

export default new init();
