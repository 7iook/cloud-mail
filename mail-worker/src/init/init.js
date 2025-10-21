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
}

export default new init();
